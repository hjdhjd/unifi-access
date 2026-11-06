/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * connection.test.ts: Tests for ConnectionMonitor - the derived state machine, restart detection through the controller's reported uptime, the folding of the
 * transport throttle and the stream stall into one health surface, and the guarded recovery sequence. Driven with a fake clock, a fake throttle source, and
 * injected stream, probe, and re-bootstrap functions, so every path runs without a live controller and without real waits.
 */
import { ACCESS_EVENTS_HEARTBEAT_TIMEOUT, ACCESS_REBOOT_UPTIME_DROP_MINIMUM, ACCESS_RECOVERY_BACKOFF_MS, ACCESS_RECOVERY_REFUSAL_SCHEDULE_MS,
  ACCESS_RECOVERY_STEADY_INTERVAL_MS } from "../settings.ts";
import { AccessAbortedError, AccessApiError, AccessAuthError, AccessAuthorizationError, AccessBootstrapError, AccessCertificateError, AccessError,
  AccessNetworkError, AccessRequestError, AccessStallError } from "../errors.ts";
import type { AccessControllerConfig, AccessEventPacket, Nullable } from "../types/index.ts";
import type { ConnectionState, ConnectionTransition, ThrottleSource } from "./connection.ts";
import { TestClock, advanceThroughSchedule, assertNoUnhandledRejections, capturingLog, errnoError, expectAt, logCount, loggedAt, settle, settleUntil,
  silentLog } from "homebridge-plugin-utils/testing";
import { accessBootstrap2026Fixture, accessControllerInfoFixture } from "../protocol/topology.fixtures.ts";
import { describe, test } from "node:test";
import type { AccessLogging } from "../logging.ts";
import type { AccessWireEvent } from "../protocol/events.ts";
import { ConnectionMonitor } from "./connection.ts";
import { EventBus } from "../event-bus.ts";
import { EventStream } from "../transport/events-stream.ts";
import { FakeWebSocket } from "../transport/events-stream.helpers.ts";
import { StateStore } from "../state/store.ts";
import type { TestLogEntry } from "homebridge-plugin-utils/testing";
import { UAH_ID } from "../protocol/capture.helpers.ts";
import assert from "node:assert/strict";
import { errors } from "undici";

const HOST = "10.0.0.1";

// The uptime the seeded controller document reports, in seconds. Every restart case moves from this value.
const BASE_UPTIME = 990090;

// A phrase unique to each of the lost line's sentences, so a count by sentence tells each class a loss is announced as apart from the others.
const LIMITING_SENTENCE = "is rate limiting requests";
const MUST_FIX_SENTENCE = "cannot be reached until its certificate or its address is fixed";
const NOT_READY_SENTENCE = "is not ready yet";
const REFUSAL_SENTENCE = "is refusing the sign-in";
const UNREACHABLE_SENTENCE = "appears unreachable";

// The awaits one recovery attempt makes, named so a test can say which of them a disposal should land inside.
type RecoveryStep = "probe" | "reBootstrap" | "relaunch";

// A throttle source a test can drive: the narrow surface the monitor consumes, plus a knob that flips the verdict and fires the matching rail - which mirrors the
// real breaker, whose rails fire only on an actual edge.
interface ThrottleControl extends ThrottleSource {

  set(next: boolean): void;
}

function fakeThrottle(initial = false): ThrottleControl {

  const bus = new EventBus<{ throttleEntered: []; throttleExited: [] }>(silentLog());

  let throttled = initial;

  return {

    get isThrottled(): boolean {

      return throttled;
    },

    on(event: "throttleEntered" | "throttleExited", handler: () => void): Disposable {

      return bus.on(event, handler);
    },

    set(next: boolean): void {

      if(next === throttled) {

        return;
      }

      throttled = next;
      bus.emit(next ? "throttleEntered" : "throttleExited");
    }
  };
}

/* A call that parks until its own cancellation, which is how a request behaves when the monitor is disposed underneath it: the transport hands the abort back to
 * its caller rather than absorbing it. Every caller here arrives with the monitor's lifetime signal, so none of them parks on nothing. A test supplying its own
 * rejection is asking for the other shape a cancelled call can take - a failure from outside the error hierarchy, which the monitor has to wrap before it can say
 * anything about it.
 */
function parkUntilAborted(signal?: AbortSignal, rejection: Nullable<Error> = null): Promise<never> {

  const pending = Promise.withResolvers<never>();

  signal?.addEventListener("abort", () => pending.reject(rejection ?? new AccessAbortedError("The UniFi Access request was cancelled.")), { once: true });

  return pending.promise;
}

// A socket that runs a hook each time it is asked to close, so a row can land a disposal inside the teardown that asked.
class HookedWebSocket extends FakeWebSocket {

  readonly #onClose: () => void;

  constructor(onClose: () => void) {

    super();
    this.#onClose = onClose;
  }

  override close(): void {

    super.close();
    this.#onClose();
  }
}

// The level of every line carrying a phrase, in the order they logged, so a row reads how many lost lines a walk produced and at which level in one assertion.
function levelsOf(entries: readonly TestLogEntry[], phrase: string): TestLogEntry["level"][] {

  return entries.filter((entry) => entry.message.includes(phrase)).map((entry) => entry.level);
}

// The context of every debug line that names a wait a hint lengthened, in the order logged, so a row reads how many were logged and what each carried.
function hintLines(entries: readonly TestLogEntry[]): unknown[][] {

  return entries.filter((entry) => (entry.level === "debug") && entry.message.includes("asked for more time")).map((entry) => entry.params);
}

// A device-update frame, as the controller frames one, with the wire's own key names preserved.
function deviceFrame(): string {

  return JSON.stringify({

    "data": { "unique_id": UAH_ID },
    "event": "access.data.device.update",
    "event_object_id": UAH_ID,
    "receiver_id": "",
    "save_to_history": false
  });
}

// A controller document reporting a given uptime, freshly parsed each time so no two dispatches share references.
function controllerAt(uptime: number): AccessControllerConfig {

  const document = structuredClone(accessControllerInfoFixture);

  document.host.uptime = uptime;

  return document;
}

// What a test asserts against.
interface CapturedEvents {

  lost: AccessError[];
  rebooted: { newUptime: number; previousUptime: number }[];
  recovered: number;
  throttleEntered: number;
  throttleExited: number;
  transitions: ConnectionTransition[];
}

interface Harness {

  clock: TestClock;
  control: {

    adminCalls: () => number;
    adminSignals: () => (AbortSignal | undefined)[];
    reBootstrapCalls: () => number;
    setAdminNeverResolves: (value: boolean) => void;
    setAdminRejection: (error: Nullable<Error>) => void;
    setAdminRejectsOnAbort: (value: boolean) => void;
    setNextUptime: (value: number) => void;
    setParkedRejection: (error: Nullable<Error>) => void;
    setParkedStep: (step: Nullable<RecoveryStep>) => void;
    setReBootstrapError: (error: Nullable<Error>) => void;
    setRelaunchError: (error: Nullable<Error>) => void;
    setVerifyAction: (action: Nullable<() => Promise<void>>) => void;
    setVerifyError: (error: Nullable<Error>) => void;
    verifyCalls: () => number;
  };
  events: CapturedEvents;
  monitor: ConnectionMonitor;
  rawSunk: AccessEventPacket[];
  store: StateStore;
  streams: FakeWebSocket[];
  sunk: AccessWireEvent[];
  throttle: ThrottleControl;
}

/* Build a monitor over fakes: a real store seeded with a real topology document and a controller document, a fake throttle source, a stream factory handing out
 * sockets a test can drive, and controllable probe, re-bootstrap, and privilege-check functions. A row that needs a socket of its own at some position in build
 * order hands it through `webSocket`, which is asked first for each socket the factory builds.
 */
async function harness(options: { initialUptime?: number; log?: AccessLogging; throttledAtStart?: boolean;
  webSocket?: (index: number) => Nullable<FakeWebSocket>; } = {}): Promise<Harness> {

  const clock = new TestClock();
  const log = options.log ?? silentLog();
  const initialUptime = options.initialUptime ?? BASE_UPTIME;
  const store = new StateStore({ clock, log, refresh: (): Promise<never> => new Promise<never>(() => undefined), refreshIntervalMs: false });

  store.applyRefreshDocuments({ controller: controllerAt(initialUptime), topology: structuredClone(accessBootstrap2026Fixture) });

  const throttle = fakeThrottle(options.throttledAtStart ?? false);
  const streams: FakeWebSocket[] = [];
  const sunk: AccessWireEvent[] = [];
  const rawSunk: AccessEventPacket[] = [];
  const adminSignals: (AbortSignal | undefined)[] = [];

  let verifyAction: Nullable<() => Promise<void>> = null;
  let verifyCalls = 0;
  let verifyError: Nullable<Error> = null;
  let reBootstrapCalls = 0;
  let reBootstrapError: Nullable<Error> = null;
  let relaunchError: Nullable<Error> = null;
  let nextUptime = initialUptime;
  let parkedStep: Nullable<RecoveryStep> = null;
  let parkedRejection: Nullable<Error> = null;
  let adminNeverResolves = false;
  let adminRejection: Nullable<Error> = null;
  let adminRejectsOnAbort = false;

  const verify = async (signal?: AbortSignal): Promise<void> => {

    verifyCalls++;

    // A row that sets an action is asking the probe to do exactly that and settle the way the action does.
    if(verifyAction !== null) {

      return verifyAction();
    }

    if(verifyError !== null) {

      throw verifyError;
    }

    if(parkedStep === "probe") {

      await parkUntilAborted(signal, parkedRejection);
    }
  };

  const reBootstrap = async (signal?: AbortSignal): Promise<void> => {

    reBootstrapCalls++;

    if(reBootstrapError !== null) {

      throw reBootstrapError;
    }

    if(parkedStep === "reBootstrap") {

      await parkUntilAborted(signal, parkedRejection);
    }

    store.applyRefreshDocuments({ controller: controllerAt(nextUptime), topology: structuredClone(accessBootstrap2026Fixture) });
  };

  const refreshAdminStatus = (signal?: AbortSignal): Promise<Nullable<boolean>> => {

    adminSignals.push(signal);

    if(adminRejection !== null) {

      return Promise.reject(adminRejection);
    }

    // Parking until the cancellation puts a disposal inside an in-flight re-check, where the rejection lands on a call nobody awaited.
    if(adminRejectsOnAbort) {

      return parkUntilAborted(signal);
    }

    // A check that never settles is what tells a fire-and-forget call apart from an awaited one: recovery has to complete anyway.
    return adminNeverResolves ? new Promise<Nullable<boolean>>(() => undefined) : Promise.resolve(true);
  };

  const eventStreamFactory = (signal?: AbortSignal): EventStream => {

    // A test that sets this is asking the relaunch step to fail with the value it supplied, which is the only way a failure outside the error hierarchy reaches the
    // monitor. It is set after the channel is open, so the initial stream is never the one that raises.
    if(relaunchError !== null) {

      throw relaunchError;
    }

    // A relaunch the test parks on gets a socket that never reaches its open event, which is what leaves the attempt inside that await when disposal lands.
    const ws = options.webSocket?.(streams.length) ?? new FakeWebSocket({ autoOpen: parkedStep !== "relaunch" });

    streams.push(ws);

    return new EventStream({ clock, host: HOST, log, ...((signal !== undefined) && { signal }), webSocket: (): FakeWebSocket => ws });
  };

  const monitor = new ConnectionMonitor({

    clock,
    eventStreamFactory,
    log,
    packetSink: (event: AccessWireEvent): void => void sunk.push(event),
    rawPacketSink: (packet: AccessEventPacket): void => void rawSunk.push(packet),
    reBootstrap,
    refreshAdminStatus,
    store,
    transport: throttle,
    verify
  });

  const events: CapturedEvents = { lost: [], rebooted: [], recovered: 0, throttleEntered: 0, throttleExited: 0, transitions: [] };

  monitor.on("controllerLost", (reason): void => void events.lost.push(reason));
  monitor.on("controllerRebooted", (info): void => void events.rebooted.push(info));
  monitor.on("controllerRecovered", (): void => { events.recovered++; });
  monitor.on("throttleEntered", (): void => { events.throttleEntered++; });
  monitor.on("throttleExited", (): void => { events.throttleExited++; });
  monitor.on("stateChanged", (transition): void => void events.transitions.push(transition));

  // The composition root's own staging: the monitor is assembled, its rails are subscribed, and only then is the channel opened, so nothing a test watches for can
  // fire before it is listening.
  await monitor.open();

  return {

    clock,
    control: {

      adminCalls: (): number => adminSignals.length,
      adminSignals: (): (AbortSignal | undefined)[] => adminSignals,
      reBootstrapCalls: (): number => reBootstrapCalls,
      setAdminNeverResolves: (value: boolean): void => { adminNeverResolves = value; },
      setAdminRejection: (error: Nullable<Error>): void => { adminRejection = error; },
      setAdminRejectsOnAbort: (value: boolean): void => { adminRejectsOnAbort = value; },
      setNextUptime: (value: number): void => { nextUptime = value; },
      setParkedRejection: (error: Nullable<Error>): void => { parkedRejection = error; },
      setParkedStep: (step: Nullable<RecoveryStep>): void => { parkedStep = step; },
      setReBootstrapError: (error: Nullable<Error>): void => { reBootstrapError = error; },
      setRelaunchError: (error: Nullable<Error>): void => { relaunchError = error; },
      setVerifyAction: (action: Nullable<() => Promise<void>>): void => { verifyAction = action; },
      setVerifyError: (error: Nullable<Error>): void => { verifyError = error; },
      verifyCalls: (): number => verifyCalls
    },
    events,
    monitor,
    rawSunk,
    store,
    streams,
    sunk,
    throttle
  };
}

/* A monitor over a test-supplied stream factory, left unopened. That is the one thing `harness()` cannot give a test, because it opens the channel exactly as the
 * composition root does; everything the open edge does not exercise is stubbed to the quietest thing that satisfies the surface. The clock and the reachability
 * probe are injectable so a row can share one `TestClock` with the stream it hands the factory and count what a recovery attempt asks of the controller.
 */
function unopenedMonitor(options: { clock?: TestClock; eventStreamFactory: (signal?: AbortSignal) => EventStream; signal?: AbortSignal;
  verify?: (signal?: AbortSignal) => Promise<void>; }): ConnectionMonitor {

  const clock = options.clock ?? new TestClock();
  const log = silentLog();
  const store = new StateStore({ clock, log, refresh: (): Promise<never> => new Promise<never>(() => undefined), refreshIntervalMs: false });

  return new ConnectionMonitor({

    clock,
    eventStreamFactory: options.eventStreamFactory,
    log,
    packetSink: (): void => undefined,
    rawPacketSink: (): void => undefined,
    reBootstrap: (): Promise<void> => Promise.resolve(),
    refreshAdminStatus: (): Promise<Nullable<boolean>> => Promise.resolve(true),
    store,
    transport: fakeThrottle(),
    verify: options.verify ?? ((): Promise<void> => Promise.resolve()),
    ...((options.signal !== undefined) && { signal: options.signal })
  });
}

// A stream over a socket the test holds short of its open event, so an abort lands on a handshake that is genuinely still in flight.
function unopeningStream(clock: TestClock, signal?: AbortSignal): EventStream {

  return new EventStream({ clock, host: HOST, log: silentLog(), ...((signal !== undefined) && { signal }),
    webSocket: (): FakeWebSocket => new FakeWebSocket({ autoOpen: false }) });
}

/* Read a recovery schedule behaviorally: for each expected delay, advancing by one less than it must not release the attempt, and advancing the last millisecond
 * must. The expected delays come out of the exported constants, so a changed delay fails here loudly rather than passing against a restated number, and the label
 * names the walk in every assertion so a failure says which walk it was.
 */
async function assertRecoveryDelays(options: { delays: readonly number[]; label: string; rig: Harness }): Promise<void> {

  const { clock, control } = options.rig;
  let attempts = control.verifyCalls();

  for(const delay of options.delays) {

    if(delay > 0) {

      clock.advance(delay - 1);

      // eslint-disable-next-line no-await-in-loop
      await settle();

      assert.equal(control.verifyCalls(), attempts, options.label + ": no attempt is made before its scheduled delay of " + String(delay) + " has elapsed");
    }

    clock.advance((delay > 0) ? 1 : 0);

    // eslint-disable-next-line no-await-in-loop
    await settle();

    assert.equal(control.verifyCalls(), attempts + 1, options.label + ": the attempt runs once its delay of " + String(delay) + " has elapsed");
    attempts += 1;
  }
}

// The loss fact as a synchronous stateChanged listener reads it at an edge, beside the state that edge reached.
interface EdgeFact {

  isLost: boolean;
  to: ConnectionState;
}

// Read the loss fact inside a stateChanged listener at every edge from here on, so a row asserts what a consumer sees at the moment each edge fires rather than after
// the work that follows it has run.
function factAtEachEdge(monitor: ConnectionMonitor): EdgeFact[] {

  const edges: EdgeFact[] = [];

  monitor.on("stateChanged", ({ to }): void => void edges.push({ isLost: monitor.isLost, to }));

  return edges;
}

describe("ConnectionMonitor", () => {

  describe("initial state", () => {

    test("starts healthy once the notification stream opens", async () => {

      const rig = await harness();

      await using monitor = rig.monitor;

      await monitor.opened;

      assert.equal(monitor.state, "healthy");
      assert.equal(monitor.isHealthy, true);
      assert.equal(monitor.isThrottled, false);
    });
  });

  describe("opening the channel", () => {

    test("the stream factory is not reached until open, so a factory that throws allocates nothing", async () => {

      let calls = 0;

      await using monitor = unopenedMonitor({ eventStreamFactory: (): EventStream => {

        calls++;

        throw new AccessNetworkError("the dispatcher could not be built");
      } });

      /* Assembly is not allocation. The factory is what builds the dispatcher and the socket, so a factory that has not been called is proof that neither exists -
       * and the throw it would answer with lands inside the caller's guard rather than ahead of it.
       */
      assert.equal(calls, 0, "assembling the monitor never reaches the stream factory");

      await assert.rejects(() => monitor.open(), AccessNetworkError);
      assert.equal(calls, 1, "open is what builds the first stream");
    });

    test("a failed open rejects the published handshake with the very error it threw", async () => {

      const clock = new TestClock();
      const controller = new AbortController();

      await using monitor = unopenedMonitor({ eventStreamFactory: (signal?: AbortSignal): EventStream => unopeningStream(clock, signal),
        signal: controller.signal });

      const opening = monitor.open();
      const handshake = monitor.opened;

      await settle();
      controller.abort();

      const thrown = await opening.catch((error: unknown) => error);

      // Identity rather than type: a deferred handshake that manufactured its own failure would still be an abort, and would still hide what actually went wrong.
      await assert.rejects(handshake, (error: unknown) => {

        assert.ok(error instanceof AccessAbortedError, "the handshake rejects with the abort the caller's signal raised");
        assert.equal(error, thrown, "the published handshake carries the very failure the open reported");

        return true;
      }, "the handshake rejects with the abort the caller's signal raised");
    });

    test("disposing before the channel opens releases a reader parked on the handshake", async () => {

      const monitor = unopenedMonitor({ eventStreamFactory: (): EventStream => assert.fail("disposal must not build a stream") });

      const handshake = monitor.opened;

      await monitor[Symbol.asyncDispose]();

      // A handshake nothing will ever answer has to be settled rather than abandoned, or a consumer holding it waits for the life of the process.
      await assert.rejects(handshake, AccessAbortedError);
    });

    test("a socket error before the first open rejects the handshake and starts no recovery", async () => {

      const clock = new TestClock();
      const ws = new FakeWebSocket({ autoOpen: false });
      let edges = 0;
      let probes = 0;

      await using monitor = unopenedMonitor({ clock,
        eventStreamFactory: (): EventStream => new EventStream({ clock, host: HOST, log: silentLog(), webSocket: (): FakeWebSocket => ws }),
        verify: (): Promise<void> => {

          probes++;

          return Promise.resolve();
        } });

      monitor.on("stateChanged", (): void => {

        edges++;
      });

      const opening = monitor.open();

      ws.emitError(new Error("connection refused"));

      await assert.rejects(opening, AccessNetworkError);

      /* A failure the caller is already being told about is the caller's to answer, so the recovery loop must never have been entered. The first recovery delay
       * is 0 ms and a TestClock delay of 0 settles only when the clock is advanced, so moving time nowhere is what would flush an attempt had one been scheduled.
       */
      clock.advance(0);
      await settle();

      assert.equal(edges, 0, "a fault before the first open announces no state edge");
      assert.equal(probes, 0, "a fault before the first open sends no reachability probe");
    });

    test("a watchdog stall before the first open rejects the handshake and starts no recovery", async () => {

      const clock = new TestClock();
      let edges = 0;
      let probes = 0;

      await using monitor = unopenedMonitor({ clock,
        eventStreamFactory: (signal?: AbortSignal): EventStream => unopeningStream(clock, signal),
        verify: (): Promise<void> => {

          probes++;

          return Promise.resolve();
        } });

      monitor.on("stateChanged", (): void => {

        edges++;
      });

      /* The expectation attaches before the clock moves, because the handshake rejects inside the settle below. A rejection with nothing attached to it is
       * reported by the runner as this test's own failure, which would hide every assertion behind it.
       */
      const rejected = assert.rejects(monitor.open(), AccessStallError);

      clock.advance(ACCESS_EVENTS_HEARTBEAT_TIMEOUT);
      await settle();
      await rejected;

      // The first recovery delay is 0 ms, so moving time nowhere is what would flush an attempt had one been scheduled.
      clock.advance(0);
      await settle();

      assert.equal(edges, 0, "a stall before the first open announces no state edge");
      assert.equal(probes, 0, "a stall before the first open sends no reachability probe");
    });
  });

  describe("throttle folding", () => {

    test("shows the breaker as the derived state and forwards its rails", async () => {

      const rig = await harness();

      await using monitor = rig.monitor;
      const { events, throttle } = rig;

      await monitor.opened;
      await settle();

      throttle.set(true);

      assert.equal(monitor.state, "throttled");
      assert.equal(monitor.isThrottled, true);
      assert.equal(monitor.isHealthy, false);
      assert.equal(events.throttleEntered, 1);
      assert.deepEqual(events.transitions.at(-1), { from: "healthy", to: "throttled" });

      throttle.set(false);

      assert.equal(monitor.state, "healthy");
      assert.equal(events.throttleExited, 1);
      assert.deepEqual(events.transitions.at(-1), { from: "throttled", to: "healthy" });
    });

    test("the recovery phase takes precedence over the breaker once recovery is underway", async () => {

      const rig = await harness();

      await using monitor = rig.monitor;
      const { clock, control, streams, throttle } = rig;

      await monitor.opened;
      await settle();

      control.setVerifyError(new AccessNetworkError("down"));
      streams[0]?.emitError(new Error("socket dropped"));
      await advanceThroughSchedule(clock, [ACCESS_RECOVERY_STEADY_INTERVAL_MS]);

      await settleUntil(() => monitor.state === "lost", { description: "the failing probe to drop the monitor to lost" });

      // The breaker opening during recovery does not mask the phase: the monitor rather than the breaker owns re-probing here, so lost is the more actionable answer.
      throttle.set(true);
      assert.equal(monitor.state, "lost");

      throttle.set(false);
      assert.equal(monitor.state, "lost");
    });
  });

  describe("restart detection", () => {

    test("a material drop in the reported uptime is read as a restart", async () => {

      const rig = await harness();

      await using monitor = rig.monitor;
      const { events, store } = rig;

      await monitor.opened;
      await settle();

      // A real restart returns the uptime to near zero, which is a drop of the controller's whole prior uptime.
      store.applyRefreshDocuments({ controller: controllerAt(12), topology: structuredClone(accessBootstrap2026Fixture) });

      await settleUntil(() => events.rebooted.length === 1, { description: "the restart to be detected" });
      assert.deepEqual(events.rebooted[0], { newUptime: 12, previousUptime: BASE_UPTIME });
    });

    test("a drop of exactly the minimum does not fire, and one past it does", async () => {

      const rig = await harness();

      await using monitor = rig.monitor;
      const { events, store } = rig;

      await monitor.opened;
      await settle();

      // The boundary itself: a drop of precisely the floor is not past it, so nothing fires.
      store.applyRefreshDocuments({ controller: controllerAt(BASE_UPTIME - ACCESS_REBOOT_UPTIME_DROP_MINIMUM),
        topology: structuredClone(accessBootstrap2026Fixture) });

      await settle();
      assert.equal(events.rebooted.length, 0, "a drop of exactly the minimum is not a restart");

      // One second further is past it, and does fire. The baseline has moved to the value above, so this drop is measured from there.
      store.applyRefreshDocuments({ controller: controllerAt(BASE_UPTIME - (2 * ACCESS_REBOOT_UPTIME_DROP_MINIMUM) - 1),
        topology: structuredClone(accessBootstrap2026Fixture) });

      await settleUntil(() => events.rebooted.length === 1, { description: "a drop past the minimum to fire" });
    });

    test("a sub-minimum decrease fires nothing", async () => {

      const rig = await harness();

      await using monitor = rig.monitor;
      const { events, store } = rig;

      await monitor.opened;
      await settle();

      // The shape a caching or clock-step mechanism could produce: the value moves backward by seconds rather than by days. The floor is what makes it
      // unrepresentable as a restart.
      for(const uptime of [ BASE_UPTIME - 3, BASE_UPTIME - 10, BASE_UPTIME - 12 ]) {

        store.applyRefreshDocuments({ controller: controllerAt(uptime), topology: structuredClone(accessBootstrap2026Fixture) });
      }

      await settle();
      assert.equal(events.rebooted.length, 0, "a small backward step is skew rather than a restart");
    });

    test("an advance fires nothing, however large", async () => {

      const rig = await harness();

      await using monitor = rig.monitor;
      const { events, store } = rig;

      await monitor.opened;
      await settle();

      // Ordinary advance, and then a jump of the size a delayed refresh produces. Neither is a restart: uptime moving forward is what uptime does.
      for(const uptime of [ BASE_UPTIME + 60, BASE_UPTIME + 100000 ]) {

        store.applyRefreshDocuments({ controller: controllerAt(uptime), topology: structuredClone(accessBootstrap2026Fixture) });
      }

      await settle();
      assert.equal(events.rebooted.length, 0);
    });

    test("an identical re-served value never wakes the observation at all", async () => {

      const rig = await harness();

      await using monitor = rig.monitor;
      const { events, store } = rig;

      await monitor.opened;
      await settle();

      // The live controller does serve the identical value twice within a short window. The reading is a number, so the observation dedups on the value itself and
      // the loop is never woken - which is why the flatness costs nothing.
      for(let i = 0; i < 3; i++) {

        store.applyRefreshDocuments({ controller: controllerAt(BASE_UPTIME), topology: structuredClone(accessBootstrap2026Fixture) });
      }

      await settle();
      assert.equal(events.rebooted.length, 0);
    });

    test("a restart arriving as the first observation after construction is still detected", async () => {

      /* The first-window case the pre-seeded baseline closes. The baseline is read at construction from what the store already holds, so a controller that restarts
       * before the first refresh has its drop measured against the connect-time reading rather than having that drop silently adopted as the baseline.
       */
      const rig = await harness();

      await using monitor = rig.monitor;
      const { events, store } = rig;

      await monitor.opened;
      await settle();

      store.applyRefreshDocuments({ controller: controllerAt(30), topology: structuredClone(accessBootstrap2026Fixture) });

      await settleUntil(() => events.rebooted.length === 1, { description: "the first-window restart to be detected" });
      assert.equal(events.rebooted[0]?.previousUptime, BASE_UPTIME, "measured against the reading present at construction");
    });

    test("a detected restart wakes a parked recovery so it relaunches without waiting out the backoff", async () => {

      const rig = await harness();

      await using monitor = rig.monitor;
      const { control, events, store, streams } = rig;

      await monitor.opened;
      await settle();

      // Drive to lost and leave recovery parked on its next wait.
      control.setVerifyError(new AccessNetworkError("restarting"));
      streams[0]?.emitError(new Error("socket dropped"));
      await settle();

      // The controller returns and the refresh observes the restart. The wake is what lets recovery relaunch now: without it, the loop could only leave that parked
      // wait by the clock advancing, and this test never advances it.
      control.setVerifyError(null);
      control.setNextUptime(20);
      store.applyRefreshDocuments({ controller: controllerAt(20), topology: structuredClone(accessBootstrap2026Fixture) });

      await settleUntil(() => monitor.state === "healthy", { description: "the detected restart to wake recovery and relaunch at once" });

      assert.equal(streams.length, 2, "recovery relaunched rather than sleeping out its backoff");
      assert.equal(events.rebooted.length, 1);
    });
  });

  describe("recovery", () => {

    test("a transient stall recovers without the controller ever being reported lost", async () => {

      const log = capturingLog();
      const rig = await harness({ log });

      await using monitor = rig.monitor;
      const { clock, control, events } = rig;

      await monitor.opened;
      await settle();

      // Drive the stream's own silence watchdog: advance to its deadline and let it wake, so it concludes the channel is dead and faults.
      clock.advance(ACCESS_EVENTS_HEARTBEAT_TIMEOUT);
      await settle();

      // The schedule opens with a zero delay, so the first attempt runs at once; it succeeds, and recovery walks straight back to healthy.
      await advanceThroughSchedule(clock, [ACCESS_RECOVERY_STEADY_INTERVAL_MS]);
      await settleUntil(() => monitor.state === "healthy", { description: "recovery to return the monitor to healthy" });

      assert.equal(events.lost.length, 0, "a reachable controller is never reported lost");
      assert.equal(events.recovered, 0, "and recovery is announced only after a genuine loss");
      assert.equal(control.verifyCalls(), 1);
      assert.equal(control.reBootstrapCalls(), 1);
      assert.deepEqual(events.transitions.map((transition) => transition.to), [ "degraded", "reconnecting", "healthy" ]);

      // The transient case confirms itself at the stream level rather than announcing a controller-level recovery that did not happen.
      assert.ok(loggedAt(log.entries, "info", "Reconnected the UniFi Access realtime notification channel."),
        "the transient drop confirms itself as a reconnected notification channel");
      assert.ok(!log.entries.some((entry) => entry.message.includes("Recovered the connection to the UniFi Access controller.")),
        "no controller-level recovery is announced for a drop that never reached lost");
    });

    test("an unreachable controller is reported lost once, then recovered when it returns", async () => {

      const log = capturingLog();
      const rig = await harness({ log });

      await using monitor = rig.monitor;
      const { clock, control, events, streams } = rig;

      await monitor.opened;
      await settle();

      control.setVerifyError(new AccessNetworkError("unreachable"));
      streams[0]?.emitError(new Error("socket dropped"));
      await advanceThroughSchedule(clock, [ACCESS_RECOVERY_STEADY_INTERVAL_MS]);

      await settleUntil(() => monitor.state === "lost", { description: "the connection to be reported lost" });
      assert.equal(events.lost.length, 1);
      assert.ok(events.lost[0] instanceof AccessError, "the lost announcement carries the typed error that ended the connection");

      // Several more failed polls, to show the announcement is on the edge into lost rather than per attempt.
      await advanceThroughSchedule(clock, [ACCESS_RECOVERY_STEADY_INTERVAL_MS]);
      await advanceThroughSchedule(clock, [ACCESS_RECOVERY_STEADY_INTERVAL_MS]);

      assert.equal(events.lost.length, 1, "lost is announced once per episode");
      assert.ok(control.verifyCalls() >= 3, "recovery kept probing");

      control.setVerifyError(null);
      await advanceThroughSchedule(clock, [ACCESS_RECOVERY_STEADY_INTERVAL_MS]);

      await settleUntil(() => monitor.state === "healthy", { description: "recovery to complete once the controller returned" });
      assert.equal(events.recovered, 1);
      assert.ok(loggedAt(log.entries, "info", "Recovered the connection to the UniFi Access controller."),
        "the recovery is announced at info once the controller returns");
    });

    test("recovery keeps polling across many failures rather than giving up", async () => {

      const rig = await harness();

      await using monitor = rig.monitor;
      const { clock, control, events, streams } = rig;

      await monitor.opened;
      await settle();

      control.setVerifyError(new AccessNetworkError("sluggish"));
      streams[0]?.emitError(new Error("socket dropped"));
      await advanceThroughSchedule(clock, [ACCESS_RECOVERY_STEADY_INTERVAL_MS]);
      await settleUntil(() => monitor.state === "lost", { description: "the failing probes to drop the monitor to lost" });

      for(let i = 0; i < 15; i++) {

        // eslint-disable-next-line no-await-in-loop
        await advanceThroughSchedule(clock, [ACCESS_RECOVERY_STEADY_INTERVAL_MS]);
      }

      assert.equal(monitor.state, "lost", "still polling after many failures");
      assert.ok(control.verifyCalls() >= 10, "recovery keeps probing through every failed poll");

      control.setVerifyError(null);
      await advanceThroughSchedule(clock, [ACCESS_RECOVERY_STEADY_INTERVAL_MS]);

      await settleUntil(() => monitor.state === "healthy", { description: "recovery to complete once the probe succeeds" });
      assert.equal(events.recovered, 1);
    });

    test("a failure at the re-bootstrap step drops to lost and is retried", async () => {

      const rig = await harness();

      await using monitor = rig.monitor;
      const { clock, control, streams } = rig;

      await monitor.opened;
      await settle();

      // The controller answers the probe but cannot serve its documents, which is a real intermediate state during a restart.
      control.setReBootstrapError(new AccessNetworkError("documents unavailable"));
      streams[0]?.emitError(new Error("socket dropped"));
      await advanceThroughSchedule(clock, [ACCESS_RECOVERY_STEADY_INTERVAL_MS]);

      await settleUntil(() => monitor.state === "lost", { description: "the failed re-bootstrap to drop the monitor to lost" });
      assert.ok(control.reBootstrapCalls() >= 1, "recovery reached the document re-fetch that failed");

      control.setReBootstrapError(null);
      await advanceThroughSchedule(clock, [ACCESS_RECOVERY_STEADY_INTERVAL_MS]);

      await settleUntil(() => monitor.state === "healthy", { description: "the retried re-bootstrap to return the monitor to healthy" });
    });

    test("a failure at the relaunch step that is not an AccessError is announced as a network error carrying it", async () => {

      const rig = await harness();

      await using monitor = rig.monitor;
      const { clock, control, events, streams } = rig;

      await monitor.opened;
      await settle();

      /* The one recovery failure that does not already belong to the error hierarchy: a relaunch that raises something raw. A consumer branches on that hierarchy, so
       * announcing a loss with a bare Error would be a hole in the contract every other announcement honors. The wrap is what closes it, and the cause is what keeps
       * the original failure readable.
       */
      const raw = new Error("the notification socket could not be built");

      control.setRelaunchError(raw);
      streams[0]?.emitError(new Error("socket dropped"));
      await advanceThroughSchedule(clock, [ACCESS_RECOVERY_STEADY_INTERVAL_MS]);

      await settleUntil(() => monitor.state === "lost", { description: "the failed relaunch to drop the monitor to lost" });
      assert.equal(events.lost.length, 1);

      const fault = events.lost[0];

      assert.ok(fault instanceof AccessNetworkError, "a raw failure reaches the consumer through the typed hierarchy");
      assert.equal(fault.cause, raw, "the failure that actually happened is carried rather than discarded");

      control.setRelaunchError(null);
    });

    test("a disposal that interrupts an attempt ends it quietly rather than concluding the controller lost", async () => {

      /* Every await the attempt makes, in turn, because the abort can land inside any of them and the guard has to read the same way from each: an attempt the
       * monitor's own disposal cut short learned nothing about the controller, so it announces nothing and leaves the phase where disposal found it.
       */
      const interrupted = async (step: RecoveryStep): Promise<void> => {

        const log = capturingLog();
        const { clock, control, events, monitor, streams } = await harness({ log });

        await settle();

        control.setParkedStep(step);
        streams[0]?.emitError(new Error("socket dropped"));
        await advanceThroughSchedule(clock, [ACCESS_RECOVERY_STEADY_INTERVAL_MS]);

        // Each step has its own arrival marker: the probe is called with the phase still degraded, the re-bootstrap runs once the phase reads reconnecting, and the
        // relaunch has built its second socket by the time it parks on an open that never comes.
        const arrived: Record<RecoveryStep, () => boolean> = {

          probe: (): boolean => (monitor.state === "degraded") && (control.verifyCalls() >= 1),
          reBootstrap: (): boolean => (monitor.state === "reconnecting") && (streams.length === 1),
          relaunch: (): boolean => (monitor.state === "reconnecting") && (streams.length === 2)
        };

        await settleUntil(arrived[step], { description: "the attempt to park inside the " + step + " step" });

        const phaseAtDisposal = monitor.state;
        const transitionsBefore = events.transitions.length;

        await monitor[Symbol.asyncDispose]();
        await settle();

        assert.equal(events.lost.length, 0, "no loss is announced when disposal interrupts the " + step + " step");
        assert.ok(!log.entries.some((entry) => entry.level === "warn"), "and nothing is warned about at the " + step + " step");

        // No edge means neither the phase nor the fault a transition would have carried moved, which is the whole of what the interrupted attempt must leave alone.
        assert.equal(events.transitions.length, transitionsBefore, "and no transition is announced at the " + step + " step");
        assert.equal(monitor.state, phaseAtDisposal, "and the phase is left where disposal found it at the " + step + " step");
      };

      await interrupted("probe");
      await interrupted("reBootstrap");
      await interrupted("relaunch");
    });

    test("a disposal that lands in the same turn a recovery probe resolves runs no reconnecting edge and no line", async () => {

      const log = capturingLog();
      const { clock, control, events, monitor, streams } = await harness({ log });

      const disposals: Promise<void>[] = [];

      await settle();

      // The probe answers, and the disposal it starts aborts the monitor's signal synchronously, before that answer reaches the recovery attempt waiting on it.
      control.setVerifyAction(async (): Promise<void> => {

        disposals.push(monitor[Symbol.asyncDispose]());
      });

      streams[0]?.emitError(new Error("socket dropped"));

      const lines = log.entries.length;
      const transitions = events.transitions.length;

      await advanceThroughSchedule(clock, [ACCESS_RECOVERY_STEADY_INTERVAL_MS]);
      await Promise.all(disposals);
      await settle();

      assert.equal(control.verifyCalls(), 1, "the probe ran");
      assert.equal(control.reBootstrapCalls(), 0, "and nothing after it");
      assert.equal(events.transitions.length, transitions, "no reconnecting edge follows a disposal");
      assert.deepEqual(log.entries.slice(lines).filter((entry) => entry.level !== "debug"), [], "and no line announces a reconnect");
    });

    test("a disposal that lands while a relaunch tears its stream down builds no socket and announces no recovery", async () => {

      const log = capturingLog();

      const disposals: Promise<void>[] = [];

      let onClose = (): void => undefined;

      const rig = await harness({ log, webSocket: (index) => (index === 0) ? new HookedWebSocket(() => onClose()) : null });
      const { control, events, monitor, streams } = rig;

      await settle();

      /* A frame that is not JSON faults the channel without closing it, so the stream is still open when a relaunch tears it down. The controller is unreachable at
       * first, so the episode reaches lost and a recovery would announce itself. Each attempt is released by its own rung alone, both inside the stream's
       * watchdog window, so the stream's own stall never closes it first.
       */
      control.setVerifyError(new AccessNetworkError("down"));
      streams[0]?.emitMessage("{");
      await assertRecoveryDelays({ delays: ACCESS_RECOVERY_BACKOFF_MS.slice(0, 1), label: "while unreachable", rig });

      assert.equal(monitor.state, "lost", "the failed probe concludes the connection lost");

      // The controller answers again, so the next attempt relaunches, and the relaunch's teardown of the faulted stream asks its socket to close, which is where the
      // disposal lands, once.
      control.setVerifyError(null);
      onClose = (): void => {

        onClose = (): void => undefined;
        disposals.push(monitor[Symbol.asyncDispose]());
      };

      await assertRecoveryDelays({ delays: ACCESS_RECOVERY_BACKOFF_MS.slice(1, 2), label: "once answering", rig });
      await Promise.all(disposals);

      assert.equal(disposals.length, 1, "the disposal landed inside the relaunch's teardown");
      await settle();

      assert.equal(control.reBootstrapCalls(), 1, "the attempt reached the relaunch");
      assert.equal(streams.length, 1, "a relaunch the disposal landed in builds no socket, which nothing would ever close");
      assert.equal(events.recovered, 0, "and announces no recovery");
      assert.ok(!events.transitions.some((transition) => transition.to === "healthy"), "and drives no edge back to healthy");
      assert.ok(!log.entries.some((entry) => entry.message.includes("Recovered the connection")), "and logs no recovery line");
    });

    test("the backoff walks its staged delays and then polls at the steady floor", async () => {

      const rig = await harness();

      await using monitor = rig.monitor;
      const { control, streams } = rig;

      await monitor.opened;
      await settle();

      // The probe keeps failing, so the loop walks the whole schedule rather than completing early.
      control.setVerifyError(new AccessNetworkError("down"));
      streams[0]?.emitError(new Error("socket dropped"));
      await settle();

      await assertRecoveryDelays({ delays: [ ...ACCESS_RECOVERY_BACKOFF_MS, ACCESS_RECOVERY_STEADY_INTERVAL_MS, ACCESS_RECOVERY_STEADY_INTERVAL_MS ],
        label: "the staged backoff into the steady floor", rig });
    });

    test("a refused identity or privilege, in every spelling, walks the refusal schedule out to its floor", async () => {

      // Every spelling of a refused sign-in the recovery loop can be handed: the transport's classification of a refused status, and the controller's own refusal code
      // answered inside a successful response, for a refused identity and a refused privilege alike.
      const refusals = [

        { error: new AccessAuthError("refused", { statusCode: 401 }), label: "AccessAuthError with status 401" },
        { error: new AccessApiError("refused", { code: "CODE_AUTH_FAILED" }), label: "AccessApiError with CODE_AUTH_FAILED" },
        { error: new AccessAuthorizationError("refused", { statusCode: 403 }), label: "AccessAuthorizationError with status 403" },
        { error: new AccessApiError("refused", { code: "CODE_OPERATION_FORBIDDEN" }), label: "AccessApiError with CODE_OPERATION_FORBIDDEN" }
      ];

      const walk = async (refusal: { error: Error; label: string }): Promise<void> => {

        const rig = await harness();

        await using monitor = rig.monitor;
        const { control, streams } = rig;

        await monitor.opened;
        await settle();

        control.setVerifyError(refusal.error);
        streams[0]?.emitError(new Error("socket dropped"));
        await settle();

        /* The episode opens on the stream's own fault, which is not a refusal, so the first wait is the network schedule's first rung. The attempt it releases is
         * refused, and every wait from there walks the refusal schedule: each of its rungs in turn, then its floor, held for a second interval.
         */
        await assertRecoveryDelays({ delays: [ ...ACCESS_RECOVERY_BACKOFF_MS.slice(0, 1), ...ACCESS_RECOVERY_REFUSAL_SCHEDULE_MS.backoff,
          ACCESS_RECOVERY_REFUSAL_SCHEDULE_MS.steady, ACCESS_RECOVERY_REFUSAL_SCHEDULE_MS.steady ], label: refusal.label, rig });
      };

      for(const refusal of refusals) {

        // Sequential by intent: each spelling walks its own monitor.
        // eslint-disable-next-line no-await-in-loop
        await walk(refusal);
      }
    });

    test("a controller that turns from unreachable to refusing walks the refusal schedule from its first rung", async () => {

      const rig = await harness();

      await using monitor = rig.monitor;
      const { control, streams } = rig;

      await monitor.opened;
      await settle();

      // Two attempts fail unreachable, released by the network schedule's first two rungs.
      control.setVerifyError(new AccessNetworkError("down"));
      streams[0]?.emitError(new Error("socket dropped"));
      await settle();
      await assertRecoveryDelays({ delays: ACCESS_RECOVERY_BACKOFF_MS.slice(0, 2), label: "while unreachable", rig });

      /* The controller turns to refusing. The wait already parked was chosen from the unreachable fault, so it runs out on the network schedule and releases the
       * first refused attempt; every wait after that walks the refusal schedule from its first rung rather than from the rung the network schedule had reached.
       * The walk runs out to the floor because the network and refusal schedules can agree at any single rung, and only the whole walk tells a schedule that
       * switched from one that never did.
       */
      control.setVerifyError(new AccessAuthError("refused", { statusCode: 401 }));
      await assertRecoveryDelays({ delays: [ ...ACCESS_RECOVERY_BACKOFF_MS.slice(2, 3), ...ACCESS_RECOVERY_REFUSAL_SCHEDULE_MS.backoff,
        ACCESS_RECOVERY_REFUSAL_SCHEDULE_MS.steady, ACCESS_RECOVERY_REFUSAL_SCHEDULE_MS.steady ], label: "once refusing", rig });
    });

    test("a controller that turns from refusing to unreachable walks the network schedule from its first rung", async () => {

      const rig = await harness();

      await using monitor = rig.monitor;
      const { control, streams } = rig;

      await monitor.opened;
      await settle();

      control.setVerifyError(new AccessAuthError("refused", { statusCode: 401 }));
      streams[0]?.emitError(new Error("socket dropped"));
      await settle();

      // The stream's own fault opens the episode on the network schedule's first rung, and the attempt it releases is refused; the refusal schedule's first two
      // rungs follow, each releasing another refused attempt.
      await assertRecoveryDelays({ delays: [ ...ACCESS_RECOVERY_BACKOFF_MS.slice(0, 1), ...ACCESS_RECOVERY_REFUSAL_SCHEDULE_MS.backoff.slice(0, 2) ],
        label: "while refusing", rig });

      /* The controller stops refusing and becomes unreachable. The wait already parked was chosen from the refusal, so it runs out on the refusal schedule and
       * releases the first unreachable attempt; every wait after that walks the network schedule from its first rung, an immediate attempt, out to its floor.
       */
      control.setVerifyError(new AccessNetworkError("down"));
      await assertRecoveryDelays({ delays: [ ...ACCESS_RECOVERY_REFUSAL_SCHEDULE_MS.backoff.slice(2, 3), ...ACCESS_RECOVERY_BACKOFF_MS,
        ACCESS_RECOVERY_STEADY_INTERVAL_MS, ACCESS_RECOVERY_STEADY_INTERVAL_MS ], label: "once unreachable", rig });
    });

    test("an episode that opens on a refusal is announced once, as a refusal at error, across every rung it walks", async () => {

      const log = capturingLog();
      const rig = await harness({ log });

      await using monitor = rig.monitor;
      const { control, events, streams } = rig;

      await monitor.opened;
      await settle();

      control.setVerifyError(new AccessAuthError("refused", { statusCode: 401 }));
      streams[0]?.emitError(new Error("socket dropped"));
      await settle();

      // The network schedule's first rung releases the first refused attempt, and every refusal rung follows, out to the floor and held there for a second interval.
      await assertRecoveryDelays({ delays: [ ...ACCESS_RECOVERY_BACKOFF_MS.slice(0, 1), ...ACCESS_RECOVERY_REFUSAL_SCHEDULE_MS.backoff,
        ACCESS_RECOVERY_REFUSAL_SCHEDULE_MS.steady, ACCESS_RECOVERY_REFUSAL_SCHEDULE_MS.steady ], label: "while refusing", rig });

      const announced = log.entries.find((entry) => (entry.level === "error") && entry.message.includes("the connection is lost"));

      assert.ok(announced?.message.includes(REFUSAL_SENTENCE), "the lost line, found by the phrase every lost line shares, is the refusal sentence");
      assert.equal(logCount(log.entries, "error", REFUSAL_SENTENCE), 1, "the refusal is announced once for the whole walk");
      assert.equal(logCount(log.entries, "warn", UNREACHABLE_SENTENCE), 0, "and never as an unreachable controller");
      assert.equal(events.lost.length, 1, "and controllerLost fires once for the episode");
    });

    test("a controller that turns from unreachable to refusing is announced once as each, in the lost line and on controllerLost", async () => {

      const log = capturingLog();
      const rig = await harness({ log });

      await using monitor = rig.monitor;
      const { control, events, streams } = rig;
      const unreachable = new AccessNetworkError("down");
      const refusal = new AccessAuthError("refused", { statusCode: 401 });

      await monitor.opened;
      await settle();

      // Two attempts fail unreachable, released by the network schedule's first two rungs.
      control.setVerifyError(unreachable);
      streams[0]?.emitError(new Error("socket dropped"));
      await settle();
      await assertRecoveryDelays({ delays: ACCESS_RECOVERY_BACKOFF_MS.slice(0, 2), label: "while unreachable", rig });

      assert.equal(logCount(log.entries, "warn", UNREACHABLE_SENTENCE), 1, "the loss is warned about once while the controller is unreachable");
      assert.equal(logCount(log.entries, "error", REFUSAL_SENTENCE), 0, "and not as a refusal");
      assert.equal(events.lost.length, 1, "controllerLost fires once while the controller is unreachable");
      assert.equal(events.lost[0], unreachable, "carrying the fault that concluded the loss");

      // The controller turns to refusing. The network wait already parked releases the first refused attempt, and the refusal schedule's first two rungs release
      // two more.
      control.setVerifyError(refusal);
      await assertRecoveryDelays({ delays: [ ...ACCESS_RECOVERY_BACKOFF_MS.slice(2, 3), ...ACCESS_RECOVERY_REFUSAL_SCHEDULE_MS.backoff.slice(0, 2) ],
        label: "once refusing", rig });

      assert.equal(logCount(log.entries, "error", REFUSAL_SENTENCE), 1, "the turn to refusing is announced once at error across its attempts");
      assert.equal(logCount(log.entries, "warn", UNREACHABLE_SENTENCE), 1, "and the unreachable warning is not repeated");
      assert.equal(events.lost.length, 2, "controllerLost fires again at the turn, and only then");
      assert.equal(events.lost[1], refusal, "carrying the refusal the loss turned to");
    });

    test("a controller that turns from refusing to unreachable is announced once as each, in the lost line and on controllerLost", async () => {

      const log = capturingLog();
      const rig = await harness({ log });

      await using monitor = rig.monitor;
      const { control, events, streams } = rig;
      const refusal = new AccessAuthError("refused", { statusCode: 401 });
      const unreachable = new AccessNetworkError("down");

      await monitor.opened;
      await settle();

      // The stream's own fault opens the episode on the network schedule's first rung, which releases the first refused attempt; the refusal schedule's first two
      // rungs release two more.
      control.setVerifyError(refusal);
      streams[0]?.emitError(new Error("socket dropped"));
      await settle();
      await assertRecoveryDelays({ delays: [ ...ACCESS_RECOVERY_BACKOFF_MS.slice(0, 1), ...ACCESS_RECOVERY_REFUSAL_SCHEDULE_MS.backoff.slice(0, 2) ],
        label: "while refusing", rig });

      assert.equal(logCount(log.entries, "error", REFUSAL_SENTENCE), 1, "the loss is announced once at error while the controller is refusing");
      assert.equal(logCount(log.entries, "warn", UNREACHABLE_SENTENCE), 0, "and not as an unreachable controller");
      assert.equal(events.lost.length, 1, "controllerLost fires once while the controller is refusing");
      assert.equal(events.lost[0], refusal, "carrying the refusal that concluded the loss");

      // The controller stops refusing and becomes unreachable. The refusal wait already parked releases the first unreachable attempt, and the network schedule's
      // first two rungs release two more.
      control.setVerifyError(unreachable);
      await assertRecoveryDelays({ delays: [ ...ACCESS_RECOVERY_REFUSAL_SCHEDULE_MS.backoff.slice(2, 3), ...ACCESS_RECOVERY_BACKOFF_MS.slice(0, 2) ],
        label: "once unreachable", rig });

      assert.equal(logCount(log.entries, "warn", UNREACHABLE_SENTENCE), 1, "the turn to unreachable is warned about once across its attempts");
      assert.equal(logCount(log.entries, "error", REFUSAL_SENTENCE), 1, "and the refusal line is not repeated");
      assert.equal(events.lost.length, 2, "controllerLost fires again at the turn, and only then");
      assert.equal(events.lost[1], unreachable, "carrying the fault the loss turned to");
    });

    test("a fault that keeps its kind is announced once across repeated attempts, including attempts that pass through reconnecting", async () => {

      /* Each walk fails attempt after attempt with one kind of fault after the controller answers the probe, so each attempt passes through reconnecting and drops
       * back to lost at the re-bootstrap. The loss is announced for the episode's first loss alone, in the lost line and on controllerLost alike, however many of
       * those drops follow. Each sentence is counted at the level its class logs at, a refusal at error and an unreachable controller at warning.
       */
      const walks: { delays: readonly number[]; error: Error; label: string; level: TestLogEntry["level"]; otherLevel: TestLogEntry["level"]; otherSentence: string;
        sentence: string; }[] = [

        { delays: [ ...ACCESS_RECOVERY_BACKOFF_MS.slice(0, 1), ...ACCESS_RECOVERY_REFUSAL_SCHEDULE_MS.backoff.slice(0, 3) ],
          error: new AccessAuthError("refused", { statusCode: 401 }), label: "refused", level: "error", otherLevel: "warn", otherSentence: UNREACHABLE_SENTENCE,
          sentence: REFUSAL_SENTENCE },
        { delays: ACCESS_RECOVERY_BACKOFF_MS.slice(0, 4), error: new AccessNetworkError("documents unavailable"), label: "unreachable", level: "warn",
          otherLevel: "error", otherSentence: REFUSAL_SENTENCE, sentence: UNREACHABLE_SENTENCE }
      ];

      const walk = async (options: { delays: readonly number[]; error: Error; label: string; level: TestLogEntry["level"]; otherLevel: TestLogEntry["level"];
        otherSentence: string; sentence: string; }): Promise<void> => {

        const log = capturingLog();
        const rig = await harness({ log });

        await using monitor = rig.monitor;
        const { control, events, streams } = rig;

        await monitor.opened;
        await settle();

        control.setReBootstrapError(options.error);
        streams[0]?.emitError(new Error("socket dropped"));
        await settle();
        await assertRecoveryDelays({ delays: options.delays, label: options.label, rig });

        assert.equal(control.reBootstrapCalls(), options.delays.length, options.label + ": every attempt answered the probe and failed at the re-bootstrap");
        assert.equal(logCount(log.entries, options.level, options.sentence), 1, options.label + ": the fault is announced once across every attempt");
        assert.equal(logCount(log.entries, options.otherLevel, options.otherSentence), 0, options.label + ": and never in the other sentence");
        assert.equal(events.lost.length, 1, options.label + ": and controllerLost fires once for the episode");
      };

      for(const options of walks) {

        // Sequential by intent: each kind walks its own monitor.
        // eslint-disable-next-line no-await-in-loop
        await walk(options);
      }
    });

    test("a refusal wrapped in a bootstrap error walks the refusal schedule and is announced as a refusal", async () => {

      const log = capturingLog();
      const rig = await harness({ log });

      await using monitor = rig.monitor;
      const { control, events, streams } = rig;

      await monitor.opened;
      await settle();

      /* The direct re-bootstrap wraps a refused document read in a bootstrap error, and that is how this refusal arrives: the probe answers, so each attempt passes
       * through reconnecting and fails at the re-bootstrap. The first wait was chosen from the stream's own fault, which is the network schedule's first rung, and
       * the attempt it releases lands the first wrapped refusal; every wait after that walks the refusal schedule out to its floor, held for a second interval.
       */
      control.setReBootstrapError(new AccessBootstrapError("refused", { cause: new AccessAuthError("refused", { statusCode: 401 }), stage: "fetch" }));
      streams[0]?.emitError(new Error("socket dropped"));
      await settle();
      await assertRecoveryDelays({ delays: [ ...ACCESS_RECOVERY_BACKOFF_MS.slice(0, 1), ...ACCESS_RECOVERY_REFUSAL_SCHEDULE_MS.backoff,
        ACCESS_RECOVERY_REFUSAL_SCHEDULE_MS.steady, ACCESS_RECOVERY_REFUSAL_SCHEDULE_MS.steady ], label: "a wrapped refusal", rig });

      const announced = log.entries.find((entry) => (entry.level === "error") && entry.message.includes("the connection is lost"));

      assert.ok(announced?.message.includes(REFUSAL_SENTENCE), "the lost line, found by the phrase every lost line shares, is the refusal sentence");
      assert.equal(logCount(log.entries, "error", REFUSAL_SENTENCE), 1, "the wrapped refusal is announced once for the whole walk");
      assert.equal(logCount(log.entries, "warn", UNREACHABLE_SENTENCE), 0, "and never as an unreachable controller");
      assert.equal(events.lost.length, 1, "and controllerLost fires once for the episode");
    });

    test("a refusal carried below a network fault is read as the network fault and walks the network schedule", async () => {

      const log = capturingLog();
      const rig = await harness({ log });

      await using monitor = rig.monitor;
      const { control, streams } = rig;

      await monitor.opened;
      await settle();

      // A bootstrap error is the one wrapper read by its cause, so a network fault that carries a refusal below it is read as the network fault it is.
      control.setVerifyError(new AccessNetworkError("unreachable", { cause: new AccessAuthError("refused", { statusCode: 401 }) }));
      streams[0]?.emitError(new Error("socket dropped"));
      await settle();
      await assertRecoveryDelays({ delays: [ ...ACCESS_RECOVERY_BACKOFF_MS, ACCESS_RECOVERY_STEADY_INTERVAL_MS, ACCESS_RECOVERY_STEADY_INTERVAL_MS ],
        label: "a refusal below a network fault", rig });

      assert.equal(logCount(log.entries, "warn", UNREACHABLE_SENTENCE), 1, "the loss is warned about once, as an unreachable controller");
      assert.equal(logCount(log.entries, "error", REFUSAL_SENTENCE), 0, "and never as a refusal");
    });

    test("a rate limit on the probe walks the refusal schedule out to its floor", async () => {

      const rig = await harness();

      await using monitor = rig.monitor;
      const { control, streams } = rig;

      await monitor.opened;
      await settle();

      control.setVerifyError(new AccessRequestError("limited", { statusCode: 429 }));
      streams[0]?.emitError(new Error("socket dropped"));
      await settle();

      /* The episode opens on the stream's own fault, which is no refusal, so the first wait is the network schedule's first rung. The attempt it releases is rate
       * limited with no hint, and every wait from there walks the refusal schedule: each of its rungs in turn, then its floor, held for a second interval.
       */
      await assertRecoveryDelays({ delays: [ ...ACCESS_RECOVERY_BACKOFF_MS.slice(0, 1), ...ACCESS_RECOVERY_REFUSAL_SCHEDULE_MS.backoff,
        ACCESS_RECOVERY_REFUSAL_SCHEDULE_MS.steady, ACCESS_RECOVERY_REFUSAL_SCHEDULE_MS.steady ], label: "a rate limit", rig });
    });

    test("a rate limit wrapped in a bootstrap error walks the refusal schedule and is announced as a rate limit", async () => {

      const log = capturingLog();
      const rig = await harness({ log });

      await using monitor = rig.monitor;
      const { control, events, streams } = rig;

      await monitor.opened;
      await settle();

      /* The direct re-bootstrap wraps a rate-limited document read in a bootstrap error, and that is how this rate limit arrives: the probe answers, so each attempt
       * passes through reconnecting and fails at the re-bootstrap. The first wait was chosen from the stream's own fault, which is the network schedule's first rung,
       * and the attempt it releases lands the first wrapped rate limit; every wait after that walks the refusal schedule out to its floor, held for a second interval.
       */
      control.setReBootstrapError(new AccessBootstrapError("limited", { cause: new AccessRequestError("limited", { statusCode: 429 }), stage: "fetch" }));
      streams[0]?.emitError(new Error("socket dropped"));
      await settle();
      await assertRecoveryDelays({ delays: [ ...ACCESS_RECOVERY_BACKOFF_MS.slice(0, 1), ...ACCESS_RECOVERY_REFUSAL_SCHEDULE_MS.backoff,
        ACCESS_RECOVERY_REFUSAL_SCHEDULE_MS.steady, ACCESS_RECOVERY_REFUSAL_SCHEDULE_MS.steady ], label: "a wrapped rate limit", rig });

      assert.deepEqual(levelsOf(log.entries, LIMITING_SENTENCE), ["warn"], "the wrapped rate limit is announced once, at warning, for the whole walk");
      assert.deepEqual(levelsOf(log.entries, UNREACHABLE_SENTENCE), [], "and never as an unreachable controller");
      assert.deepEqual(levelsOf(log.entries, NOT_READY_SENTENCE), [], "nor as a controller not ready yet");
      assert.deepEqual(levelsOf(log.entries, REFUSAL_SENTENCE), [], "nor as a refused sign-in");
      assert.equal(events.lost.length, 1, "and controllerLost fires once for the episode");
    });

    test("a controller that turns from rate limiting to unreachable walks the network schedule from its first rung", async () => {

      const rig = await harness();

      await using monitor = rig.monitor;
      const { control, streams } = rig;

      await monitor.opened;
      await settle();

      // The stream's own fault opens the episode on the network schedule's first rung, which releases the first rate-limited attempt; the refusal schedule's opening
      // rungs follow, each releasing another rate-limited attempt.
      control.setVerifyError(new AccessRequestError("limited", { statusCode: 429 }));
      streams[0]?.emitError(new Error("socket dropped"));
      await settle();
      await assertRecoveryDelays({ delays: [ ...ACCESS_RECOVERY_BACKOFF_MS.slice(0, 1), ...ACCESS_RECOVERY_REFUSAL_SCHEDULE_MS.backoff.slice(0, 2) ],
        label: "while rate limited", rig });

      /* The controller stops rate limiting and becomes unreachable. The wait already parked was chosen from the rate limit, so it runs out on the refusal schedule
       * and releases the first unreachable attempt; every wait after that walks the network schedule from its first rung, an immediate attempt, out to its floor.
       */
      control.setVerifyError(new AccessNetworkError("down"));
      await assertRecoveryDelays({ delays: [ ...ACCESS_RECOVERY_REFUSAL_SCHEDULE_MS.backoff.slice(2, 3), ...ACCESS_RECOVERY_BACKOFF_MS,
        ACCESS_RECOVERY_STEADY_INTERVAL_MS, ACCESS_RECOVERY_STEADY_INTERVAL_MS ], label: "once unreachable", rig });
    });

    test("a refused sign-in that turns into a rate limit keeps its rung on the refusal schedule", async () => {

      const rig = await harness();

      await using monitor = rig.monitor;
      const { control, streams } = rig;

      await monitor.opened;
      await settle();

      // The stream's own fault opens the episode on the network schedule's first rung, which releases the first refused attempt; the refusal schedule's opening rungs
      // follow, each releasing another refused attempt.
      control.setVerifyError(new AccessAuthError("refused", { statusCode: 401 }));
      streams[0]?.emitError(new Error("socket dropped"));
      await settle();
      await assertRecoveryDelays({ delays: [ ...ACCESS_RECOVERY_BACKOFF_MS.slice(0, 1), ...ACCESS_RECOVERY_REFUSAL_SCHEDULE_MS.backoff.slice(0, 2) ],
        label: "while refusing", rig });

      /* The controller turns to rate limiting. A rate limit is a refusal as a refused sign-in is, so the schedule holds and so does its rung: the wait already parked
       * releases the first rate-limited attempt, and every wait after it walks on from the rung the refusal had reached, out to the floor, rather than from the
       * schedule's first rung.
       */
      control.setVerifyError(new AccessRequestError("limited", { statusCode: 429 }));
      await assertRecoveryDelays({ delays: [ ...ACCESS_RECOVERY_REFUSAL_SCHEDULE_MS.backoff.slice(2), ACCESS_RECOVERY_REFUSAL_SCHEDULE_MS.steady,
        ACCESS_RECOVERY_REFUSAL_SCHEDULE_MS.steady ], label: "once rate limited", rig });
    });
  });

  describe("the loss fact", () => {

    test("a fault that recovers on its first probe reads not lost at every edge", async () => {

      const rig = await harness();

      await using monitor = rig.monitor;
      const { clock, streams } = rig;

      await monitor.opened;
      await settle();

      assert.equal(monitor.isLost, false, "a healthy connection is not lost");

      const edges = factAtEachEdge(monitor);

      streams[0]?.emitError(new Error("socket dropped"));
      await advanceThroughSchedule(clock, [ACCESS_RECOVERY_STEADY_INTERVAL_MS]);
      await settleUntil(() => monitor.state === "healthy", { description: "the first probe to recover the connection" });

      assert.deepEqual(edges, [ { isLost: false, to: "degraded" }, { isLost: false, to: "reconnecting" }, { isLost: false, to: "healthy" } ]);
    });

    test("a loss reads lost from the edge into lost, through a failed attempt and reconnecting, until the edge back to healthy", async () => {

      const rig = await harness();

      await using monitor = rig.monitor;
      const { clock, control, streams } = rig;

      await monitor.opened;
      await settle();

      const edges = factAtEachEdge(monitor);

      control.setVerifyError(new AccessNetworkError("down"));
      streams[0]?.emitError(new Error("socket dropped"));
      await advanceThroughSchedule(clock, [ACCESS_RECOVERY_STEADY_INTERVAL_MS]);
      await settleUntil(() => monitor.state === "lost", { description: "the failed probe to report the connection lost" });

      // A failed attempt inside the loss crosses no edge, so the fact is read directly here.
      await advanceThroughSchedule(clock, [ACCESS_RECOVERY_STEADY_INTERVAL_MS]);
      assert.equal(monitor.isLost, true, "a failed attempt holds the fact");

      // The probe answers and the re-bootstrap fails, which walks reconnecting and back into lost.
      control.setVerifyError(null);
      control.setReBootstrapError(new AccessNetworkError("documents unavailable"));
      await advanceThroughSchedule(clock, [ACCESS_RECOVERY_STEADY_INTERVAL_MS]);
      await settleUntil(() => edges.length === 4, { description: "the failed re-bootstrap to return to lost" });

      control.setReBootstrapError(null);
      await advanceThroughSchedule(clock, [ACCESS_RECOVERY_STEADY_INTERVAL_MS]);
      await settleUntil(() => monitor.state === "healthy", { description: "recovery once the controller returned" });

      assert.deepEqual(edges, [ { isLost: false, to: "degraded" }, { isLost: true, to: "lost" }, { isLost: true, to: "reconnecting" }, { isLost: true, to: "lost" },
        { isLost: true, to: "reconnecting" }, { isLost: false, to: "healthy" } ]);
    });

    test("recovery into an open breaker reads not lost at the edge into throttled", async () => {

      const rig = await harness();

      await using monitor = rig.monitor;
      const { clock, control, streams, throttle } = rig;

      await monitor.opened;
      await settle();

      const edges = factAtEachEdge(monitor);

      control.setVerifyError(new AccessNetworkError("down"));
      streams[0]?.emitError(new Error("socket dropped"));
      await advanceThroughSchedule(clock, [ACCESS_RECOVERY_STEADY_INTERVAL_MS]);
      await settleUntil(() => monitor.state === "lost", { description: "the failed probe to report the connection lost" });

      // The breaker opens while recovery owns the phase, so it drives no edge of its own, and recovery completes into it.
      throttle.set(true);
      control.setVerifyError(null);
      await advanceThroughSchedule(clock, [ACCESS_RECOVERY_STEADY_INTERVAL_MS]);
      await settleUntil(() => monitor.state === "throttled", { description: "recovery to complete into the open breaker" });

      assert.deepEqual(edges, [ { isLost: false, to: "degraded" }, { isLost: true, to: "lost" }, { isLost: true, to: "reconnecting" },
        { isLost: false, to: "throttled" } ]);
    });

    test("a class change re-announcing a loss holds the fact and crosses no edge", async () => {

      const rig = await harness();

      await using monitor = rig.monitor;
      const { clock, control, events, streams } = rig;

      await monitor.opened;
      await settle();

      const edges = factAtEachEdge(monitor);
      const atAnnouncement: boolean[] = [];

      monitor.on("controllerLost", (): void => void atAnnouncement.push(monitor.isLost));

      control.setVerifyError(new AccessNetworkError("down"));
      streams[0]?.emitError(new Error("socket dropped"));
      await advanceThroughSchedule(clock, [ACCESS_RECOVERY_STEADY_INTERVAL_MS]);
      await settleUntil(() => monitor.state === "lost", { description: "the failed probe to report the connection lost" });

      control.setVerifyError(new AccessAuthError("refused", { statusCode: 401 }));
      await advanceThroughSchedule(clock, [ACCESS_RECOVERY_STEADY_INTERVAL_MS]);
      await settleUntil(() => events.lost.length === 2, { description: "the turn to refusing to be announced" });

      assert.deepEqual(atAnnouncement, [ true, true ], "every announcement reads the fact true");
      assert.deepEqual(edges, [ { isLost: false, to: "degraded" }, { isLost: true, to: "lost" } ], "the turn crosses no edge");
    });

    test("disposal mid-loss emits no edge and keeps the fact it last held", async () => {

      const { clock, control, monitor, streams } = await harness();

      await monitor.opened;
      await settle();

      const edges = factAtEachEdge(monitor);

      control.setVerifyError(new AccessNetworkError("down"));
      streams[0]?.emitError(new Error("socket dropped"));
      await advanceThroughSchedule(clock, [ACCESS_RECOVERY_STEADY_INTERVAL_MS]);
      await settleUntil(() => monitor.state === "lost", { description: "the failed probe to report the connection lost" });

      await monitor[Symbol.asyncDispose]();
      await settle();

      assert.deepEqual(edges, [ { isLost: false, to: "degraded" }, { isLost: true, to: "lost" } ], "disposal emits no edge");
      assert.equal(monitor.isLost, true, "a disposed monitor keeps the loss it last held");
    });
  });

  describe("a controller's Retry-After hint", () => {

    // The seconds a row's controller hints, beside the wait a hint given as an HTTP date names ahead of the test clock's time of day.
    const HINT_SECONDS = 120;
    const DATE_AHEAD_MS = 90000;

    // A controller not ready yet, its answer carrying the hint a row names, as the transport classifies that answer.
    const notReady = (hint: string): AccessRequestError => new AccessRequestError("The UniFi Access controller answered the request with HTTP status 503.",
      { headers: { "retry-after": hint }, statusCode: 503 });

    // The wait the network schedule's second rung asks for, which is the wait after an episode's first attempt when no hint lengthens it.
    const SECOND_RUNG_MS = expectAt(ACCESS_RECOVERY_BACKOFF_MS, 1, "the network schedule's second rung");

    /* Each row opens the episode on the stream's own fault, whose first wait is the network schedule's first rung and carries no hint. The attempt it releases is
     * answered with the hint, and the wait after it is what the row reads: the hint where it asks for longer than the rung, capped at the refusal schedule's steady
     * interval, and the rung where the value is not a hint at all.
     */
    const rows: readonly { delayMs: number; hint: string; name: string }[] = [

      { delayMs: HINT_SECONDS * 1000, hint: String(HINT_SECONDS), name: "hinting seconds longer than its rung waits them out" },
      { delayMs: ACCESS_RECOVERY_REFUSAL_SCHEDULE_MS.steady, hint: "3600", name: "hinting an hour waits no longer than the refusal schedule's steady interval" },
      { delayMs: SECOND_RUNG_MS, hint: "soon", name: "hinting what is neither seconds nor a date waits its rung" },
      { delayMs: SECOND_RUNG_MS, hint: "1e3", name: "hinting seconds in exponent form waits its rung, the form being no count of seconds" }
    ];

    for(const { delayMs, hint, name } of rows) {

      test("a 503 " + name, async () => {

        const rig = await harness();

        await using monitor = rig.monitor;
        const { control, streams } = rig;

        await monitor.opened;
        await settle();

        control.setVerifyError(notReady(hint));
        streams[0]?.emitError(new Error("socket dropped"));
        await settle();
        await assertRecoveryDelays({ delays: [ ...ACCESS_RECOVERY_BACKOFF_MS.slice(0, 1), delayMs ], label: "a 503 hinting " + JSON.stringify(hint), rig });
      });
    }

    test("a 503 hinting an HTTP date waits until that time of day", async () => {

      const rig = await harness();

      await using monitor = rig.monitor;
      const { clock, control, streams } = rig;

      await monitor.opened;
      await settle();

      // The date is built on the test clock's own timeline, whose time of day the wait is measured from, at the one-second resolution an HTTP date carries.
      control.setVerifyError(notReady(new Date(clock.now() + DATE_AHEAD_MS).toUTCString()));
      streams[0]?.emitError(new Error("socket dropped"));
      await settle();
      await assertRecoveryDelays({ delays: [ ...ACCESS_RECOVERY_BACKOFF_MS.slice(0, 1), DATE_AHEAD_MS ], label: "a 503 hinting an HTTP date", rig });
    });

    test("a 503 hinting longer than its rung names the lengthened wait in one debug line carrying the hint", async () => {

      const log = capturingLog();
      const rig = await harness({ log });

      await using monitor = rig.monitor;
      const { control, streams } = rig;

      await monitor.opened;
      await settle();

      control.setVerifyError(notReady(String(HINT_SECONDS)));
      streams[0]?.emitError(new Error("socket dropped"));
      await settle();
      await assertRecoveryDelays({ delays: ACCESS_RECOVERY_BACKOFF_MS.slice(0, 1), label: "the episode's first attempt", rig });

      assert.deepEqual(hintLines(log.entries), [[{ hintMs: HINT_SECONDS * 1000 }]], "the wait the hint lengthens is named in one debug line carrying the hint");

      await assertRecoveryDelays({ delays: [HINT_SECONDS * 1000], label: "a 503 hinting longer than its rung", rig });
    });

    test("a 503 hinting shorter than its rung waits the rung, and no line names a hint", async () => {

      const log = capturingLog();
      const rig = await harness({ log });

      await using monitor = rig.monitor;
      const { control, streams } = rig;

      await monitor.opened;
      await settle();

      // Every attempt is answered with a hint shorter than each rung that follows it, so the schedule's own delays hold.
      control.setVerifyError(notReady("2"));
      streams[0]?.emitError(new Error("socket dropped"));
      await settle();
      await assertRecoveryDelays({ delays: ACCESS_RECOVERY_BACKOFF_MS.slice(0, 3), label: "a 503 hinting shorter than its rung", rig });

      assert.deepEqual(hintLines(log.entries), [], "a hint that lengthens no wait is named in no line");
    });

    test("a restart detected during a hinted wait ends the wait, the hint no longer describing the controller that came back", async () => {

      const rig = await harness();

      await using monitor = rig.monitor;
      const { clock, control, store, streams } = rig;

      await monitor.opened;
      await settle();

      control.setVerifyError(notReady("3600"));
      streams[0]?.emitError(new Error("socket dropped"));
      await settle();
      await assertRecoveryDelays({ delays: ACCESS_RECOVERY_BACKOFF_MS.slice(0, 1), label: "the episode's first attempt", rig });

      // That attempt is answered with the hint, so recovery is parked past the rung it would otherwise have waited.
      clock.advance(SECOND_RUNG_MS);
      await settle();

      assert.equal(control.verifyCalls(), 1, "the hinted wait outlasts the rung");

      // The controller restarts and the refresh observes it, which wakes the parked wait so the attempt runs now rather than once the hint has elapsed.
      control.setVerifyError(null);
      control.setNextUptime(20);
      store.applyRefreshDocuments({ controller: controllerAt(20), topology: structuredClone(accessBootstrap2026Fixture) });

      await settleUntil(() => monitor.state === "healthy", { description: "the detected restart to end the hinted wait and recover at once" });

      assert.equal(control.verifyCalls(), 2, "the woken attempt is the one that recovered");
    });

    test("a rate limit answered with a hint longer than its refusal-schedule rung waits the hint, and the rungs after it are the schedule's own", async () => {

      const log = capturingLog();
      const rig = await harness({ log });

      await using monitor = rig.monitor;
      const { control, streams } = rig;

      // A hint longer than the refusal schedule's first rung and shorter than its second.
      const hintSeconds = 45;

      await monitor.opened;
      await settle();

      /* Every attempt is answered 429 with that hint. The first wait is the network schedule's first rung, chosen from the stream's own fault; the rate-limited
       * attempt it releases puts recovery on the refusal schedule, whose first rung the hint lengthens. The hint moves no rung, and every rung after it is longer than
       * the hint, so each of those waits is the schedule's own.
       */
      control.setVerifyError(new AccessRequestError("limited", { headers: { "retry-after": String(hintSeconds) }, statusCode: 429 }));
      streams[0]?.emitError(new Error("socket dropped"));
      await settle();
      await assertRecoveryDelays({ delays: [ ...ACCESS_RECOVERY_BACKOFF_MS.slice(0, 1), hintSeconds * 1000, ...ACCESS_RECOVERY_REFUSAL_SCHEDULE_MS.backoff.slice(1, 3) ],
        label: "a hinted rate limit", rig });

      assert.deepEqual(hintLines(log.entries), [[{ hintMs: hintSeconds * 1000 }]], "the one wait the hint lengthens is named in one debug line carrying the hint");
    });
  });

  describe("the lost line's class and level", () => {

    /* The lost line's level by its cause, a row per cause: a fault a person must fix at error in its own sentence, and every fault that heals itself at warning. A
     * pool reset is among the last, the level table reading its kind as quiet while dialing, because a lost connection always matters to a user and the line is
     * never quieter than a warning. A controller limiting requests and one not ready yet each log at warning in a sentence of their own, read ahead of the level
     * table, and a refused sign-in is read by the refusal rows above.
     */
    const lossLevels: readonly { level: TestLogEntry["level"]; name: string; reason: AccessError; sentence: string }[] = [

      { level: "error", name: "a certificate nothing trusts", reason: new AccessCertificateError({ cause: errnoError("self-signed certificate",
        "DEPTH_ZERO_SELF_SIGNED_CERT"), host: HOST, identity: "credentials" }), sentence: MUST_FIX_SENTENCE },
      { level: "error", name: "a host name that does not resolve", reason: new AccessNetworkError("A network error occurred communicating with the controller.",
        { cause: errnoError("getaddrinfo ENOTFOUND controller", "ENOTFOUND") }), sentence: MUST_FIX_SENTENCE },
      { level: "warn", name: "a reason carrying no code", reason: new AccessNetworkError("down"), sentence: UNREACHABLE_SENTENCE },
      { level: "warn", name: "a pool reset", reason: new AccessNetworkError("The request was interrupted because the connection pool was reset.",
        { cause: new errors.ClientDestroyedError() }), sentence: UNREACHABLE_SENTENCE },
      { level: "warn", name: "a probe answered 429", reason: new AccessRequestError("The UniFi Access controller answered the request with HTTP status 429.",
        { statusCode: 429 }), sentence: LIMITING_SENTENCE },
      { level: "warn", name: "a probe answered 503", reason: new AccessRequestError("The UniFi Access controller answered the request with HTTP status 503.",
        { statusCode: 503 }), sentence: NOT_READY_SENTENCE }
    ];

    for(const { level, name, reason, sentence } of lossLevels) {

      test("a loss on " + name + " is announced in its own sentence at " + level, async () => {

        const log = capturingLog();
        const rig = await harness({ log });

        await using monitor = rig.monitor;
        const { clock, control, events, streams } = rig;

        await monitor.opened;
        await settle();

        control.setVerifyError(reason);
        streams[0]?.emitError(new Error("socket dropped"));
        await advanceThroughSchedule(clock, [ACCESS_RECOVERY_STEADY_INTERVAL_MS]);
        await settleUntil(() => monitor.state === "lost", { description: "the failed probe to conclude the connection lost" });

        assert.deepEqual(levelsOf(log.entries, "the connection is lost"), [level], "the loss is announced once, at " + level);
        assert.deepEqual(levelsOf(log.entries, sentence), [level], "in the sentence its cause calls for");
        assert.deepEqual(events.lost, [reason], "and controllerLost carries the fault that concluded it");
      });
    }

    test("a re-bootstrap answered 503 is announced as a controller not ready yet, read through its bootstrap wrapper", async () => {

      const log = capturingLog();
      const rig = await harness({ log });

      await using monitor = rig.monitor;
      const { clock, control, events, streams } = rig;
      const reason = new AccessBootstrapError("Unable to fetch the controller configuration.",
        { cause: new AccessRequestError("The UniFi Access controller answered the request with HTTP status 503.", { statusCode: 503 }), stage: "fetch" });

      await monitor.opened;
      await settle();

      // The probe answers, so the attempt passes through reconnecting and fails at the re-bootstrap, whose document fetch wraps the status the controller answered.
      control.setReBootstrapError(reason);
      streams[0]?.emitError(new Error("socket dropped"));
      await advanceThroughSchedule(clock, [ACCESS_RECOVERY_STEADY_INTERVAL_MS]);
      await settleUntil(() => monitor.state === "lost", { description: "the failed re-bootstrap to conclude the connection lost" });

      assert.deepEqual(levelsOf(log.entries, "the connection is lost"), ["warn"], "the loss is announced once, at warning");
      assert.deepEqual(levelsOf(log.entries, NOT_READY_SENTENCE), ["warn"], "as a controller not ready yet rather than an unreachable one");
      assert.deepEqual(events.lost, [reason], "and controllerLost carries the wrapper the re-bootstrap threw");
    });

    test("an episode that turns between an unreachable controller and a certificate verdict announces each turn at its level, while the network schedule runs on",
      async () => {

        const log = capturingLog();
        const rig = await harness({ log });

        await using monitor = rig.monitor;
        const { control, events, streams } = rig;
        const unreachable = new AccessNetworkError("down");
        const certificate = new AccessCertificateError({ cause: errnoError("self-signed certificate", "DEPTH_ZERO_SELF_SIGNED_CERT"), host: HOST,
          identity: "credentials" });

        await monitor.opened;
        await settle();

        // The episode opens unreachable: the stream's own fault releases the first attempt at once, and it fails unreachable.
        control.setVerifyError(unreachable);
        streams[0]?.emitError(new Error("socket dropped"));
        await settle();
        await assertRecoveryDelays({ delays: ACCESS_RECOVERY_BACKOFF_MS.slice(0, 1), label: "while unreachable", rig });

        // The controller turns to presenting a certificate nothing trusts, met on consecutive attempts. Neither class is a refusal, so the network schedule walks on.
        control.setVerifyError(certificate);
        await assertRecoveryDelays({ delays: ACCESS_RECOVERY_BACKOFF_MS.slice(1, 3), label: "while the certificate is refused", rig });

        // And back to unreachable, its attempts released by the rest of the schedule and then its floor.
        control.setVerifyError(unreachable);
        await assertRecoveryDelays({ delays: [ ...ACCESS_RECOVERY_BACKOFF_MS.slice(3), ACCESS_RECOVERY_STEADY_INTERVAL_MS ], label: "once unreachable again", rig });

        assert.deepEqual(log.entries.filter((entry) => entry.message.includes("the connection is lost")).map(({ level, message }) => ({ level, message })), [

          { level: "warn", message: "The UniFi Access controller appears unreachable; the connection is lost and recovery is polling." },
          { level: "error", message: "The UniFi Access controller cannot be reached until its certificate or its address is fixed; the connection is lost and " +
            "recovery is polling." },
          { level: "warn", message: "The UniFi Access controller appears unreachable; the connection is lost and recovery is polling." }
        ], "each turn of class is announced once, the certificate verdict met twice in a row announced once, at error with the sentence that asks for the fix");
        assert.deepEqual(events.lost, [ unreachable, certificate, unreachable ], "and controllerLost fires at each turn and only then");
      });

    test("a refused sign-in that turns into a rate limit is announced once as each, at its own level, in the lost line and on controllerLost", async () => {

      const log = capturingLog();
      const rig = await harness({ log });

      await using monitor = rig.monitor;
      const { control, events, streams } = rig;
      const refusal = new AccessAuthError("refused", { statusCode: 401 });
      const rateLimit = new AccessRequestError("limited", { statusCode: 429 });

      await monitor.opened;
      await settle();

      // The stream's own fault releases the first attempt at once, and the refusal schedule's first rung releases another, each met by the refusal.
      control.setVerifyError(refusal);
      streams[0]?.emitError(new Error("socket dropped"));
      await settle();
      await assertRecoveryDelays({ delays: [ ...ACCESS_RECOVERY_BACKOFF_MS.slice(0, 1), ...ACCESS_RECOVERY_REFUSAL_SCHEDULE_MS.backoff.slice(0, 1) ],
        label: "while refusing", rig });

      // The controller turns to rate limiting, met on consecutive attempts the refusal schedule's next rungs release.
      control.setVerifyError(rateLimit);
      await assertRecoveryDelays({ delays: ACCESS_RECOVERY_REFUSAL_SCHEDULE_MS.backoff.slice(1, 3), label: "once rate limited", rig });

      assert.deepEqual(log.entries.filter((entry) => entry.message.includes("the connection is lost")).map(({ level, message }) => ({ level, message })), [

        { level: "error",
          message: "The UniFi Access controller is refusing the sign-in; the connection is lost and recovery is retrying on the slower refusal schedule." },
        { level: "warn",
          message: "The UniFi Access controller is rate limiting requests; the connection is lost and recovery is retrying on the slower refusal schedule." }
      ], "the refusal is announced once at error, and the turn to a rate limit once at warning, in its own sentence, across the attempts that meet it");
      assert.deepEqual(events.lost, [ refusal, rateLimit ], "and controllerLost fires at the turn and only then");
    });
  });

  describe("the rendered failure text", () => {

    test("the stream fault's debug line carries the socket's own failure below the transport's sentence", async () => {

      const log = capturingLog();
      const rig = await harness({ log });

      await using monitor = rig.monitor;
      const { streams } = rig;

      await monitor.opened;
      await settle();

      streams[0]?.emitError(new Error("socket dropped"));
      await settle();

      const faulted = log.entries.find((entry) => (entry.level === "debug") && entry.message.includes("notification channel faulted"));

      assert.ok(faulted, "the fault that starts recovery is recorded at debug");
      assert.deepEqual(faulted.params, [{ reason: "The UniFi Access realtime notification API connection failed: socket dropped" }],
        "the transport's sentence carries the socket's own words below it rather than dropping them");
    });

    test("the lost warning and the edge into lost both carry the failure's whole chain", async () => {

      const log = capturingLog();
      const rig = await harness({ log });

      await using monitor = rig.monitor;
      const { clock, control, events, streams } = rig;

      await monitor.opened;
      await settle();

      control.setVerifyError(new AccessNetworkError("The UniFi Access controller could not be reached.", { cause: new Error("connect ECONNREFUSED") }));
      streams[0]?.emitError(new Error("socket dropped"));
      await advanceThroughSchedule(clock, [ACCESS_RECOVERY_STEADY_INTERVAL_MS]);

      await settleUntil(() => monitor.state === "lost", { description: "the connection to be reported lost" });

      const warned = log.entries.find((entry) => (entry.level === "warn") && entry.message.includes("the connection is lost"));

      assert.ok(warned, "the loss is warned about");
      assert.deepEqual(warned.params, [{ reason: "The UniFi Access controller could not be reached: connect ECONNREFUSED" }],
        "the warning carries the errno the cause held rather than the wrapper's sentence alone");

      const intoLost = events.transitions.find((transition) => transition.to === "lost");

      assert.ok(intoLost, "the edge into lost is announced");
      assert.equal(intoLost.reason, "The UniFi Access controller could not be reached: connect ECONNREFUSED",
        "a consumer reading the transition sees exactly what the warning said");
    });

    test("a disposal ending an attempt that failed outside the hierarchy records the wrapped chain at debug", async () => {

      const log = capturingLog();
      const { clock, control, events, monitor, streams } = await harness({ log });

      await settle();

      /* The one recovery failure the monitor has to wrap before it can say anything: a cancelled call handed back as a raw failure. The wrapper's own sentence says
       * nothing about what went wrong, so the words that do are the ones the cause carries.
       */
      control.setParkedStep("probe");
      control.setParkedRejection(new Error("the probe socket was torn down"));
      streams[0]?.emitError(new Error("socket dropped"));
      await advanceThroughSchedule(clock, [ACCESS_RECOVERY_STEADY_INTERVAL_MS]);

      await settleUntil(() => (monitor.state === "degraded") && (control.verifyCalls() >= 1), { description: "the attempt to park inside the probe step" });

      await monitor[Symbol.asyncDispose]();
      await settle();

      const ended = log.entries.find((entry) => (entry.level === "debug") && entry.message.includes("ended with its disposal"));

      assert.ok(ended, "the disposal that ended the attempt is recorded at debug");
      assert.deepEqual(ended.params, [{ reason: "Recovery of the connection to the UniFi Access controller failed: the probe socket was torn down" }],
        "the raw failure's words sit below the wrapper's sentence");
      assert.equal(events.lost.length, 0, "and a disposal still announces no loss");
    });
  });

  describe("the privilege re-check", () => {

    test("is issued once per recovery and never gates it", async () => {

      const rig = await harness();

      await using monitor = rig.monitor;
      const { clock, control } = rig;

      await monitor.opened;
      await settle();

      /* The check is made to never settle. Recovery must still complete, which is what tells a fire-and-forget call apart from an awaited one - an implementation
       * that awaited this would leave the connection in `reconnecting` forever.
       */
      control.setAdminNeverResolves(true);

      clock.advance(ACCESS_EVENTS_HEARTBEAT_TIMEOUT);
      await settle();
      await advanceThroughSchedule(clock, [ACCESS_RECOVERY_STEADY_INTERVAL_MS]);

      await settleUntil(() => monitor.state === "healthy", { description: "recovery to complete without waiting on the privilege check" });

      assert.equal(control.adminCalls(), 1, "issued exactly once for the recovery cycle");

      // It carries the monitor's lifetime signal, so a check still in flight at disposal is released rather than left hanging.
      const signal = control.adminSignals()[0];

      assert.ok(signal instanceof AbortSignal, "the privilege check carries the monitor's lifetime signal");
      assert.equal(signal.aborted, false);

      // The explicit call is what the assertion observes, and repeat disposal is safe, which is what makes it compatible with the guard on the declaration.
      await monitor[Symbol.asyncDispose]();
      assert.equal(signal.aborted, true, "disposal releases a check still in flight");
    });

    test("is not issued when recovery never reaches a successful relaunch", async () => {

      const rig = await harness();

      await using monitor = rig.monitor;
      const { clock, control, streams } = rig;

      await monitor.opened;
      await settle();

      control.setVerifyError(new AccessNetworkError("down"));
      streams[0]?.emitError(new Error("socket dropped"));
      await advanceThroughSchedule(clock, [ACCESS_RECOVERY_STEADY_INTERVAL_MS]);

      await settleUntil(() => monitor.state === "lost", { description: "the failing probe to drop the monitor to lost" });
      assert.equal(control.adminCalls(), 0, "a failed attempt re-checks nothing");
    });

    test("a disposal that cancels a check still in flight is absorbed rather than surfacing as an unhandled rejection", async () => {

      const { clock, control, monitor } = await harness();

      await monitor.opened;
      await settle();

      /* The check is made to reject on its own cancellation, which is what the real privilege check does with an abort. Disposal fires that cancellation while it
       * is in flight, so the rejection lands on a call nobody awaited - the shape that becomes a process-level warning unless the caller absorbs it.
       */
      control.setAdminRejectsOnAbort(true);

      await assertNoUnhandledRejections(async () => {

        clock.advance(ACCESS_EVENTS_HEARTBEAT_TIMEOUT);
        await settle();
        await advanceThroughSchedule(clock, [ACCESS_RECOVERY_STEADY_INTERVAL_MS]);

        await settleUntil(() => monitor.state === "healthy", { description: "recovery to complete and issue the re-check" });
        assert.equal(control.adminCalls(), 1);

        await monitor[Symbol.asyncDispose]();
        await settle();
      });
    });

    test("a failure that is not a cancellation is logged at debug and goes no further", async () => {

      const log = capturingLog();
      const rig = await harness({ log });

      await using monitor = rig.monitor;
      const { clock, control } = rig;

      await monitor.opened;
      await settle();

      // Only a cancellation is meant to escape the injected check, so anything else means that contract broke and the debug line is the record of it.
      const broken = new AccessNetworkError("the account record could not be read");

      control.setAdminRejection(broken);

      await assertNoUnhandledRejections(async () => {

        clock.advance(ACCESS_EVENTS_HEARTBEAT_TIMEOUT);
        await settle();
        await advanceThroughSchedule(clock, [ACCESS_RECOVERY_STEADY_INTERVAL_MS]);

        await settleUntil(() => monitor.state === "healthy", { description: "recovery to complete either way, since the re-check gates nothing" });
        await settle();
      });

      const absorbed = log.entries.find((entry) => (entry.level === "debug") && entry.message.includes("privilege re-check"));

      assert.ok(absorbed, "the absorbed failure is recorded at debug");
      assert.equal(absorbed.params[0], broken, "and the record carries the failure itself rather than a restatement of it");
    });
  });

  describe("stream relaunch", () => {

    test("re-attaches both bridges to the new socket and detaches the old one", async () => {

      const rig = await harness();

      await using monitor = rig.monitor;
      const { clock, rawSunk, streams, sunk } = rig;

      await monitor.opened;
      await settle();

      clock.advance(ACCESS_EVENTS_HEARTBEAT_TIMEOUT);
      await settle();
      await advanceThroughSchedule(clock, [ACCESS_RECOVERY_STEADY_INTERVAL_MS]);

      await settleUntil(() => monitor.state === "healthy", { description: "the relaunch to complete" });
      assert.equal(streams.length, 2, "a fresh socket was built");

      // A frame on the live socket reaches both sinks; one on the dead socket reaches neither, which is the detach working.
      streams[1]?.emitMessage(deviceFrame());
      streams[0]?.emitMessage(deviceFrame());

      await settle();

      assert.equal(sunk.length, 1, "only the live socket's frame is sunk");
      assert.equal(sunk[0]?.kind, "deviceChanged");
      assert.equal(rawSunk.length, 1, "and the raw bridge re-attached too");
    });
  });

  describe("verify, observe, and the rails", () => {

    test("verify delegates to the injected probe and propagates its failure", async () => {

      const rig = await harness();

      await using monitor = rig.monitor;
      const { control } = rig;

      await monitor.opened;
      await monitor.verify();
      assert.equal(control.verifyCalls(), 1);

      control.setVerifyError(new AccessNetworkError("unreachable"));
      await assert.rejects(() => monitor.verify(), AccessNetworkError);
    });

    test("observe yields each transition until the signal aborts", async () => {

      const rig = await harness();

      await using monitor = rig.monitor;
      const { throttle } = rig;

      await monitor.opened;
      await settle();

      const controller = new AbortController();
      const seen: ConnectionState[] = [];
      const consumer = (async (): Promise<void> => {

        for await (const transition of monitor.observe({ signal: controller.signal })) {

          seen.push(transition.to);
        }
      })();

      await settle();
      throttle.set(true);
      throttle.set(false);

      await settleUntil(() => seen.length === 2, { description: "observe to yield the throttled and healthy transitions" });
      assert.deepEqual(seen, [ "throttled", "healthy" ]);

      controller.abort();
      await consumer;
    });

    test("observe rethrows a failure that is not the caller's abort", async () => {

      const { monitor, throttle } = await harness();

      await monitor.opened;
      await settle();

      const iterator = monitor.observe();
      const pending = iterator.next();

      // One transition resolves the first read and leaves the generator resting at its yield, which is where a thrown failure has to land to reach the catch.
      throttle.set(true);
      await pending;

      /* The catch finds no aborted signal - this consumer passed none - so the rethrow is what rejects the call, which is the arm the abort sugar is defined
       * against. The disposal is in a finally because a failing assertion that skipped it would leave the monitor holding the event loop, and the file would run
       * to the runner's ceiling rather than failing fast.
       */
      try {

        await assert.rejects(iterator.throw(new Error("injected")), { message: "injected" });
      } finally {

        await monitor[Symbol.asyncDispose]();
      }
    });

    test("once resolves on the next emission and stream yields the raw tuples", async () => {

      const rig = await harness();

      await using monitor = rig.monitor;
      const { throttle } = rig;

      await monitor.opened;
      await settle();

      const entered = monitor.once("throttleEntered");

      throttle.set(true);
      await entered;

      const controller = new AbortController();
      const seen: ConnectionState[] = [];
      const consumer = (async (): Promise<void> => {

        try {

          for await (const [transition] of monitor.stream("stateChanged", { signal: controller.signal })) {

            seen.push(transition.to);
          }
        } catch {

          // The raw rail rejects with the abort reason, which is its own contract - the observe sugar is what smooths that.
        }
      })();

      await settle();
      throttle.set(false);

      await settleUntil(() => seen.length === 1, { description: "the raw rail to deliver the transition" });
      assert.deepEqual(seen, ["healthy"]);

      controller.abort();
      await consumer;
    });
  });

  describe("consumer-code isolation", () => {

    test("a throwing controllerRebooted listener leaves restart detection running", async () => {

      const rig = await harness();

      await using monitor = rig.monitor;
      const { events, store } = rig;

      await monitor.opened;
      await settle();

      // The harness's own listener registered first, so it records every restart; this one throws on each, from inside the restart watch's loop.
      using thrower = monitor.on("controllerRebooted", () => {

        throw new Error("the consumer's restart handler failed");
      });

      store.applyRefreshDocuments({ controller: controllerAt(12), topology: structuredClone(accessBootstrap2026Fixture) });
      await settleUntil(() => events.rebooted.length === 1, { description: "the first restart to be detected" });

      // A watch the throw had ended would never see the second restart. The uptime climbs back before it drops again, so the second drop is a restart of its own.
      store.applyRefreshDocuments({ controller: controllerAt(BASE_UPTIME), topology: structuredClone(accessBootstrap2026Fixture) });
      store.applyRefreshDocuments({ controller: controllerAt(20), topology: structuredClone(accessBootstrap2026Fixture) });
      await settleUntil(() => events.rebooted.length === 2, { description: "the restart watch to survive the throwing listener and detect the second restart" });
    });

    test("a throwing controllerLost listener leaves recovery running to healthy", async () => {

      const rig = await harness();

      await using monitor = rig.monitor;
      const { clock, control, events, streams } = rig;

      await monitor.opened;
      await settle();

      using thrower = monitor.on("controllerLost", () => {

        throw new Error("the consumer's loss handler failed");
      });

      control.setVerifyError(new AccessNetworkError("unreachable"));
      streams[0]?.emitError(new Error("socket dropped"));
      await advanceThroughSchedule(clock, [ACCESS_RECOVERY_STEADY_INTERVAL_MS]);
      await settleUntil(() => monitor.state === "lost", { description: "the connection to be reported lost" });

      // A recovery loop the throw had ended would leave the connection lost however long the controller had been back.
      control.setVerifyError(null);
      await advanceThroughSchedule(clock, [ACCESS_RECOVERY_STEADY_INTERVAL_MS]);

      await settleUntil(() => monitor.state === "healthy", { description: "recovery to survive the throwing listener" });
      assert.equal(events.recovered, 1);
    });

    test("a throwing stateChanged listener leaves recovery running and every transition announced", async () => {

      const rig = await harness();

      await using monitor = rig.monitor;
      const { clock, events, streams } = rig;

      await monitor.opened;
      await settle();

      // The first edge a fault drives is the one into degraded, announced before recovery starts, so a throw that escaped it would leave recovery unstarted.
      using thrower = monitor.on("stateChanged", () => {

        throw new Error("the consumer's transition handler failed");
      });

      streams[0]?.emitError(new Error("socket dropped"));
      await advanceThroughSchedule(clock, [ACCESS_RECOVERY_STEADY_INTERVAL_MS]);

      await settleUntil(() => monitor.state === "healthy", { description: "recovery to survive the throwing listener" });
      assert.deepEqual(events.transitions.map(({ from, to }) => [ from, to ]),
        [ [ "healthy", "degraded" ], [ "degraded", "reconnecting" ], [ "reconnecting", "healthy" ] ],
        "the listener registered ahead of the thrower still heard each step after the throw");
    });

    test("a throwing controllerRecovered listener is logged once and the recovered connection stays healthy", async () => {

      const log = capturingLog();
      const rig = await harness({ log });

      await using monitor = rig.monitor;
      const { clock, control, events, streams } = rig;
      const failure = new Error("the consumer's recovery handler failed");

      await monitor.opened;
      await settle();

      using thrower = monitor.on("controllerRecovered", () => {

        throw failure;
      });

      control.setVerifyError(new AccessNetworkError("unreachable"));
      streams[0]?.emitError(new Error("socket dropped"));
      await advanceThroughSchedule(clock, [ACCESS_RECOVERY_STEADY_INTERVAL_MS]);
      await settleUntil(() => monitor.state === "lost", { description: "the connection to be reported lost" });

      control.setVerifyError(null);
      await advanceThroughSchedule(clock, [ACCESS_RECOVERY_STEADY_INTERVAL_MS]);
      await settleUntil(() => monitor.state === "healthy", { description: "recovery to return the monitor to healthy" });

      /* Read as a failed attempt, the throw would mark the relaunched connection lost again within the attempt that recovered it, and cycle through a fresh
       * relaunch on every scheduled attempt after. The queue is let come to rest rather than the clock advanced, because the relaunched socket carries no frames
       * and a clock walked past its silence window would stall it, a transient stall with a relaunch of its own that says nothing about the throw.
       */
      await settle();

      assert.equal(monitor.state, "healthy", "the recovered connection stays healthy");
      assert.equal(events.lost.length, 1, "the throw is not read as a fresh loss");
      assert.equal(events.recovered, 1, "and the recovery is announced once");
      assert.equal(streams.length, 2, "and drives no further relaunch");

      // The lost line and the recovery line share this logger, so the listener's line is read by its sentence.
      const thrown = log.entries.filter((entry) => (entry.level === "error") && (entry.message === "An event listener threw; the remaining listeners still run."));

      assert.equal(thrown.length, 1, "the throw is logged once, through the monitor's own logger");
      assert.deepEqual(thrown[0]?.params, [{ error: failure, event: "controllerRecovered" }], "naming the event the listener threw on");
    });
  });

  describe("teardown", () => {

    test("disposal closes the stream and detaches every subscription", async () => {

      const { events, monitor, store, streams, throttle } = await harness();

      await monitor.opened;
      await settle();

      await monitor[Symbol.asyncDispose]();

      assert.equal(streams[0]?.closeRequested, true, "the live socket was asked to close");

      const transitionsBefore = events.transitions.length;
      const rebootsBefore = events.rebooted.length;

      throttle.set(true);
      store.applyRefreshDocuments({ controller: controllerAt(5), topology: structuredClone(accessBootstrap2026Fixture) });

      await settle();

      assert.equal(events.transitions.length, transitionsBefore, "no transition is announced after disposal");
      assert.equal(events.rebooted.length, rebootsBefore, "and the restart-observation loop has ended");
    });

    test("disposal while recovery is parked ends the loop without relaunching", async () => {

      const { clock, control, monitor, streams } = await harness();

      await monitor.opened;
      await settle();

      control.setVerifyError(new AccessNetworkError("down"));
      streams[0]?.emitError(new Error("socket dropped"));
      await advanceThroughSchedule(clock, [ACCESS_RECOVERY_STEADY_INTERVAL_MS]);

      await settleUntil(() => monitor.state === "lost", { description: "the failing probe to drop the monitor to lost" });

      const before = streams.length;

      // Disposal aborts the monitor's lifetime signal, which is the parked wait's other composed signal. The loop has to read that as disposal and end rather than
      // falling through to an attempt - which a relaunch would show, and which is the assertion that tells disposal apart from a wake.
      await monitor[Symbol.asyncDispose]();
      await settle();

      assert.equal(streams.length, before, "disposal must not relaunch the stream");
      assert.equal(streams[0]?.closeRequested, true);
    });

    test("disposal while recovery is parked on the refusal schedule ends the loop without a further attempt", async () => {

      const { clock, control, monitor, streams } = await harness();

      await monitor.opened;
      await settle();

      control.setVerifyError(new AccessAuthError("refused", { statusCode: 401 }));
      streams[0]?.emitError(new Error("socket dropped"));
      await advanceThroughSchedule(clock, ACCESS_RECOVERY_BACKOFF_MS.slice(0, 1));

      await settleUntil(() => monitor.state === "lost", { description: "the refused probe to drop the monitor to lost" });

      const attempts = control.verifyCalls();
      const before = streams.length;

      // The refused attempt parks recovery on the refusal schedule's first rung. Advancing to one short of it leaves the wait pending, which is where disposal lands.
      clock.advance(ACCESS_RECOVERY_REFUSAL_SCHEDULE_MS.backoff[0] - 1);
      await settle();

      assert.equal(control.verifyCalls(), attempts, "recovery is parked on the refusal schedule's first rung");

      // Disposal aborts the monitor's lifetime signal, which is the parked wait's other composed signal. Carrying the clock past the rung afterward is what shows
      // the wait ended with disposal rather than releasing its attempt on schedule.
      await monitor[Symbol.asyncDispose]();
      clock.advance(1);
      await settle();

      assert.equal(control.verifyCalls(), attempts, "disposal must not release a further attempt");
      assert.equal(streams.length, before, "disposal must not relaunch the stream");
      assert.equal(streams[0]?.closeRequested, true);
    });

    test("disposal is safe to repeat", async () => {

      const { monitor } = await harness();

      await monitor.opened;

      await monitor[Symbol.asyncDispose]();
      await monitor[Symbol.asyncDispose]();
    });
  });
});

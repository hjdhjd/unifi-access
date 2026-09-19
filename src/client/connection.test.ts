/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * connection.test.ts: Tests for ConnectionMonitor - the derived state machine, restart detection through the controller's reported uptime, the folding of the
 * transport throttle and the stream stall into one health surface, and the guarded recovery sequence. Driven with a fake clock, a fake throttle source, and
 * injected stream, probe, and re-bootstrap functions, so every path runs without a live controller and without real waits.
 */
import { ACCESS_EVENTS_HEARTBEAT_TIMEOUT, ACCESS_REBOOT_UPTIME_DROP_MINIMUM, ACCESS_RECOVERY_BACKOFF_MS,
  ACCESS_RECOVERY_STEADY_INTERVAL_MS } from "../settings.ts";
import { AccessAbortedError, AccessError, AccessNetworkError, AccessStallError } from "../errors.ts";
import type { AccessControllerConfig, AccessEventPacket, Nullable } from "../types/index.ts";
import type { ConnectionState, ConnectionTransition, ThrottleSource } from "./connection.ts";
import { TestClock, advanceThroughSchedule, assertNoUnhandledRejections, capturingLog, settle, silentLog } from "homebridge-plugin-utils/testing";
import { accessBootstrap2026Fixture, accessControllerInfoFixture } from "../protocol/topology.fixtures.ts";
import { describe, test } from "node:test";
import type { AccessLogging } from "../logging.ts";
import type { AccessWireEvent } from "../protocol/events.ts";
import { ConnectionMonitor } from "./connection.ts";
import { EventBus } from "../event-bus.ts";
import { EventStream } from "../transport/events-stream.ts";
import { FakeWebSocket } from "../transport/events-stream.helpers.ts";
import { StateStore } from "../state/store.ts";
import assert from "node:assert/strict";
import { settleUntil } from "../testing.helpers.ts";

const HOST = "10.0.0.1";

// The uptime the seeded controller document reports, in seconds. Every restart case moves from this value.
const BASE_UPTIME = 990090;

// The awaits one recovery attempt makes, named so a test can say which of them a disposal should land inside.
type RecoveryStep = "probe" | "reBootstrap" | "relaunch";

// A throttle source a test can drive: the narrow surface the monitor consumes, plus a knob that flips the verdict and fires the matching rail - which mirrors the
// real breaker, whose rails fire only on an actual edge.
interface ThrottleControl extends ThrottleSource {

  set(next: boolean): void;
}

function fakeThrottle(initial = false): ThrottleControl {

  const bus = new EventBus<{ throttleEntered: []; throttleExited: [] }>();

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

// A device-update frame, as the controller frames one, with the wire's own key names preserved.
function deviceFrame(): string {

  return JSON.stringify({

    "data": { "unique_id": "aabbcc000001" },
    "event": "access.data.device.update",
    "event_object_id": "aabbcc000001",
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
 * sockets a test can drive, and controllable probe, re-bootstrap, and privilege-check functions.
 */
async function harness(options: { initialUptime?: number; log?: AccessLogging; throttledAtStart?: boolean } = {}): Promise<Harness> {

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
    const ws = new FakeWebSocket({ autoOpen: parkedStep !== "relaunch" });

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
      const observed = await handshake.catch((error: unknown) => error);

      // Identity rather than type: a deferred handshake that manufactured its own failure would still be an abort, and would still hide what actually went wrong.
      assert.ok(thrown instanceof AccessAbortedError, "the open rejects with the abort the caller's signal raised");
      assert.equal(observed, thrown, "the published handshake carries the very failure the open reported");
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

      await settleUntil(() => monitor.state === "lost");

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

      await settleUntil(() => events.rebooted.length === 1, { message: "expected the restart to be detected" });
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

      await settleUntil(() => events.rebooted.length === 1, { message: "expected a drop past the minimum to fire" });
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

      await settleUntil(() => events.rebooted.length === 1, { message: "expected the first-window restart to be detected" });
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

      await settleUntil(() => monitor.state === "healthy", { message: "expected the detected restart to wake recovery and relaunch at once" });

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
      await settleUntil(() => monitor.state === "healthy", { message: "expected recovery back to healthy" });

      assert.equal(events.lost.length, 0, "a reachable controller is never reported lost");
      assert.equal(events.recovered, 0, "and recovery is announced only after a genuine loss");
      assert.equal(control.verifyCalls(), 1);
      assert.equal(control.reBootstrapCalls(), 1);
      assert.deepEqual(events.transitions.map((transition) => transition.to), [ "degraded", "reconnecting", "healthy" ]);

      // The transient case confirms itself at the stream level rather than announcing a controller-level recovery that did not happen.
      assert.ok(log.entries.some((entry) => (entry.level === "info") && entry.message.includes("Reconnected the UniFi Access realtime notification channel.")),
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

      await settleUntil(() => monitor.state === "lost", { message: "expected the connection to be reported lost" });
      assert.equal(events.lost.length, 1);
      assert.ok(events.lost[0] instanceof AccessError, "the lost announcement carries the typed error that ended the connection");

      // Several more failed polls, to show the announcement is on the edge into lost rather than per attempt.
      await advanceThroughSchedule(clock, [ACCESS_RECOVERY_STEADY_INTERVAL_MS]);
      await advanceThroughSchedule(clock, [ACCESS_RECOVERY_STEADY_INTERVAL_MS]);

      assert.equal(events.lost.length, 1, "lost is announced once per episode");
      assert.ok(control.verifyCalls() >= 3, "recovery kept probing");

      control.setVerifyError(null);
      await advanceThroughSchedule(clock, [ACCESS_RECOVERY_STEADY_INTERVAL_MS]);

      await settleUntil(() => monitor.state === "healthy", { message: "expected recovery once the controller returned" });
      assert.equal(events.recovered, 1);
      assert.ok(log.entries.some((entry) => (entry.level === "info") && entry.message.includes("Recovered the connection to the UniFi Access controller.")),
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
      await settleUntil(() => monitor.state === "lost");

      for(let i = 0; i < 15; i++) {

        // eslint-disable-next-line no-await-in-loop
        await advanceThroughSchedule(clock, [ACCESS_RECOVERY_STEADY_INTERVAL_MS]);
      }

      assert.equal(monitor.state, "lost", "still polling after many failures");
      assert.ok(control.verifyCalls() >= 10, "recovery keeps probing through every failed poll");

      control.setVerifyError(null);
      await advanceThroughSchedule(clock, [ACCESS_RECOVERY_STEADY_INTERVAL_MS]);

      await settleUntil(() => monitor.state === "healthy");
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

      await settleUntil(() => monitor.state === "lost");
      assert.ok(control.reBootstrapCalls() >= 1, "recovery reached the document re-fetch that failed");

      control.setReBootstrapError(null);
      await advanceThroughSchedule(clock, [ACCESS_RECOVERY_STEADY_INTERVAL_MS]);

      await settleUntil(() => monitor.state === "healthy");
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

      await settleUntil(() => monitor.state === "lost");
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

        await settleUntil(arrived[step], { message: "expected the attempt to park inside the " + step + " step" });

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

    test("the backoff walks its staged delays and then polls at the steady floor", async () => {

      const rig = await harness();

      await using monitor = rig.monitor;
      const { clock, control, streams } = rig;

      await monitor.opened;
      await settle();

      // The probe keeps failing, so the loop walks the whole schedule rather than completing early.
      control.setVerifyError(new AccessNetworkError("down"));
      streams[0]?.emitError(new Error("socket dropped"));
      await settle();

      /* Read the schedule behaviorally: for each expected delay, advancing by one less than it must not release the attempt, and advancing the last millisecond
       * must. That reads the schedule out of the constants rather than restating it, and it fails loudly if a delay changes.
       */
      const expected = [ ...ACCESS_RECOVERY_BACKOFF_MS, ACCESS_RECOVERY_STEADY_INTERVAL_MS, ACCESS_RECOVERY_STEADY_INTERVAL_MS ];
      let attempts = control.verifyCalls();

      for(const delay of expected) {

        if(delay > 0) {

          clock.advance(delay - 1);

          // eslint-disable-next-line no-await-in-loop
          await settle();

          assert.equal(control.verifyCalls(), attempts, "no attempt is made before its scheduled delay of " + String(delay) + " has elapsed");
        }

        clock.advance(delay > 0 ? 1 : 0);

        // eslint-disable-next-line no-await-in-loop
        await settle();

        assert.equal(control.verifyCalls(), attempts + 1, "the attempt runs once its delay of " + String(delay) + " has elapsed");
        attempts += 1;
      }
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

      await settleUntil(() => monitor.state === "lost", { message: "expected the connection to be reported lost" });

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

      await settleUntil(() => (monitor.state === "degraded") && (control.verifyCalls() >= 1), { message: "expected the attempt to park inside the probe step" });

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

      await settleUntil(() => monitor.state === "healthy", { message: "recovery must complete without waiting on the privilege check" });

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

      await settleUntil(() => monitor.state === "lost");
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

        await settleUntil(() => monitor.state === "healthy", { message: "expected recovery to complete and issue the re-check" });
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

        await settleUntil(() => monitor.state === "healthy", { message: "the re-check gates nothing, so recovery completes either way" });
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

      await settleUntil(() => monitor.state === "healthy", { message: "expected the relaunch to complete" });
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

      await settleUntil(() => seen.length === 2);
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

      await settleUntil(() => seen.length === 1);
      assert.deepEqual(seen, ["healthy"]);

      controller.abort();
      await consumer;
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

      await settleUntil(() => monitor.state === "lost");

      const before = streams.length;

      // Disposal aborts the monitor's lifetime signal, which is the parked wait's other composed signal. The loop has to read that as disposal and end rather than
      // falling through to an attempt - which a relaunch would show, and which is the assertion that tells disposal apart from a wake.
      await monitor[Symbol.asyncDispose]();
      await settle();

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

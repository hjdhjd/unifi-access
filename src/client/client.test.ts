/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * client.test.ts: Tests for AccessClient.connect() - the atomic connect sequence, the single-flight document fetch every path shares, the projection surface over a
 * real controller document, the typed error for each failure stage, the diagnostics the client publishes, and clean teardown. Driven against a mocked controller
 * and an injected notification socket, so the whole composition runs without a live controller.
 */
import { AccessApiError, AccessAuthError, AccessBootstrapError, AccessProtocolError } from "../errors.ts";
import type { AccessConnectionTransitionPayload, AccessStoreDispatchPayload } from "../diagnostics.ts";
import { CONTROLLER_PATH, DOOR_HUB, HOST, HUB, LOGIN_PATH, SELF_PATH, TOPOLOGY_PATH, mockController } from "./client-modes.helpers.ts";
import type { Interceptable, MockAgent } from "undici";
import { TestClock, settle, silentLog } from "homebridge-plugin-utils/testing";
import { accessBootstrap2026Fixture, accessControllerInfoFixture } from "../protocol/topology.fixtures.ts";
import { assertRejectsWith, present, settleUntil, subscribeTo } from "../testing.helpers.ts";
import { describe, test } from "node:test";
import { AccessClient } from "./client.ts";
import type { AccessWireEvent } from "../protocol/events.ts";
import { FakeWebSocket } from "../transport/events-stream.helpers.ts";
import assert from "node:assert/strict";
import { channels } from "../diagnostics.ts";

// The controller wraps every REST result in an envelope, and the two documents sit in it differently: the controller's own information is the payload itself, while
// the topology arrives as a single-element collection. Both unwraps are what connect has to get right.
const controllerBody = (uptime?: number): string => JSON.stringify({ code: 200, codeS: "SUCCESS",
  data: (uptime === undefined) ? accessControllerInfoFixture : { ...accessControllerInfoFixture, host: { ...accessControllerInfoFixture.host, uptime } },
  error: "", msg: "" });
const topologyBody = (documents: unknown[] = [accessBootstrap2026Fixture]): string => JSON.stringify({ code: 200, codeS: "SUCCESS", data: documents,
  error: "", msg: "" });

/* Two envelopes a bootstrap read can meet inside a 200. The first is the refusal a door hub answered a close command with on 2026-09-16, carried verbatim, standing
 * here for the controller declining to hand a document over; the second reports success and then carries no document at all.
 */
const REFUSAL_BODY = JSON.stringify({ "cloud_code": "", "code": -3, "codeS": "CODE_SYSTEM_ERROR", "error": "CODE[-3];Mesg:;CauseBy:",
  "msg": "Server system error. " });
const DOCUMENTLESS_BODY = JSON.stringify({ "code": 1, "codeS": "SUCCESS", "msg": "success" });

// The account record the privilege check reads, with the grant that marks an administrator.
const selfBody = (admin: boolean): string => JSON.stringify({ scopes: admin ? [ "edit:access.device", "view:access.device" ] : ["view:access.device"] });

function interceptLogin(pool: Interceptable): void {

  pool.intercept({ method: "POST", path: LOGIN_PATH }).reply(200, "", { headers: { "set-cookie": "TOKEN=abc", "x-csrf-token": "csrf1" } });
}

// The pair of documents one connect or refresh pass fetches, plus the privilege check that follows a connect.
function interceptPass(pool: Interceptable, options: { admin?: boolean; topology?: unknown[] } = {}): void {

  pool.intercept({ method: "GET", path: CONTROLLER_PATH }).reply(200, controllerBody());
  pool.intercept({ method: "GET", path: TOPOLOGY_PATH }).reply(200, topologyBody(options.topology));
  pool.intercept({ method: "GET", path: SELF_PATH }).reply(200, selfBody(options.admin ?? true));
}

// Connect with the test defaults: the mocked dispatcher, an injected socket that opens on its own so the atomic connect completes, the refresh failsafe disabled,
// and a silent logger.
function connect(agent: MockAgent, options: { clock?: TestClock; refreshIntervalMs?: number | false } = {}): Promise<AccessClient> {

  return AccessClient.connect({ dispatcher: agent, host: HOST, log: silentLog(), password: "p",
    refreshIntervalMs: options.refreshIntervalMs ?? false, username: "u", webSocket: () => new FakeWebSocket(),
    ...((options.clock !== undefined) && { clock: options.clock }) });
}

// What a capturing connect hands back: the client, and the notification socket its factory built.
interface CapturedConnect {

  client: AccessClient;
  ws: FakeWebSocket;
}

// Connect while capturing the notification socket the factory builds, so a test can drive realtime frames into the live client.
async function connectCapturing(agent: MockAgent, options: { clock?: TestClock; refreshIntervalMs?: number | false } = {}): Promise<CapturedConnect> {

  let ws: Nullable<FakeWebSocket> = null;
  const client = await AccessClient.connect({ dispatcher: agent, host: HOST, log: silentLog(), password: "p",
    refreshIntervalMs: options.refreshIntervalMs ?? false, username: "u", webSocket: () => (ws = new FakeWebSocket()),
    ...((options.clock !== undefined) && { clock: options.clock }) });

  assert.ok(ws, "the notification socket factory must have been invoked during connect");

  return { client, ws };
}

// A device-update frame, as the controller frames one. The wire's own key names and ordering are preserved, because what these tests drive has to be what the
// controller actually sends.
function deviceFrame(id: string, payload: Record<string, unknown> = {}): string {

  return JSON.stringify({

    "data": { "unique_id": id, ...payload },
    "event": "access.data.device.update",
    "event_object_id": id,
    "receiver_id": "",
    "save_to_history": false
  });
}

// A frame carrying a notification the library deliberately does not model, for the raw rail.
function unmodeledFrame(): string {

  return JSON.stringify({

    "data": { "top_log_count": 1 },
    "event": "access.base.info",
    "event_object_id": "00000000-0000-4000-8000-000000000001",
    "receiver_id": "",
    "save_to_history": false
  });
}

// A door-state frame, as the controller frames one, so a test can drive the door-state path end to end through the real decode.
function doorStateFrame(locationId: string, lock: string): string {

  return JSON.stringify({

    "data": { "id": HUB, "location_states": [{ "dps": "close", "dps_connected": true, "emergency": { "hardware": "none", "software": "none" },
      "is_unavailable": false, "location_id": locationId, "lock": lock }] },
    "event": "access.data.v2.device.update",
    "event_object_id": "00000000-0000-4000-8000-000000000000",
    "meta": { "all_field": false, "id": HUB, "object_type": "device", "source": "", "target_field": ["location_states"] },
    "receiver_id": "",
    "save_to_history": false
  });
}

type Nullable<T> = T | null;

describe("AccessClient.connect", () => {

  describe("the connect sequence", () => {

    test("returns a ready client whose projections reflect both documents", async () => {

      const { agent, pool } = mockController();

      interceptLogin(pool);
      interceptPass(pool);

      await using client = await connect(agent);

      // The topology document reached the state model, unwrapped from its single-element collection.
      assert.equal(client.state.snapshot().devices.size, 5);
      assert.equal(client.device(HUB)?.name, "Test alias 13");
      assert.equal(client.device("no-such-device"), undefined);

      // And the controller's own document reached it too, unwrapped from the envelope's payload.
      assert.equal(client.controllerName, "host-2.test.local");
      assert.equal(client.controllerInfo?.host.uptime, accessControllerInfoFixture.host.uptime);

      // The privilege check ran as part of connect, so a consumer reading it at return gets an answer rather than "not yet determined".
      assert.equal(client.isAdmin, true);
    });

    test("exposes every projection view and the escape hatch", async () => {

      const { agent, pool } = mockController();

      interceptLogin(pool);
      interceptPass(pool);

      await using client = await connect(agent);

      assert.equal(client.devices.length, 5);
      assert.equal(client.hubs.length, 3);
      assert.deepEqual(client.accessPoints, [], "the 2026 topology carries no Enterprise Access Hub to expand");
      assert.equal(client.hub(HUB)?.id, HUB);
      assert.equal(client.accessPoint("no-such-port"), undefined);
      assert.equal(client.doorStates.size, 3, "every door the topology's own hardware establishes something about carries an entry from the connect seed");
      assert.ok(client.transport, "the transport escape hatch is exposed");
      assert.ok(client.connection.isHealthy, "the connection reports healthy once the connect completes");
    });

    test("wires the notification socket with the session cookie and nothing else", async () => {

      /* The stream's own suite proves that whatever closure it is handed becomes the upgrade's headers. This proves what the composition root hands it, which is a
       * separate question with a tempting wrong answer: the authenticated session's full header set is right there, and wiring it would add the CSRF token to
       * every notification connection this library opens. An exact comparison is the only shape of assertion that catches that.
       */
      const { agent, pool } = mockController();

      interceptLogin(pool);
      interceptPass(pool);

      let captured: Record<string, string> = {};

      await using client = await AccessClient.connect({ dispatcher: agent, host: HOST, log: silentLog(), password: "p", refreshIntervalMs: false, username: "u",
        webSocket: (_target, headers) => {

          captured = headers;

          return new FakeWebSocket();
        } });

      assert.ok(client.connection.isHealthy, "the connection reports healthy once the connect completes");

      // The login interception answers with this cookie, so the value here is the one the session really holds rather than one the test asserted into place.
      assert.deepEqual(captured, { Cookie: "TOKEN=abc" });
    });

    test("a non-administrator session reads its verdict honestly", async () => {

      const { agent, pool } = mockController();

      interceptLogin(pool);
      interceptPass(pool, { admin: false });

      await using client = await connect(agent);

      assert.equal(client.isAdmin, false);
    });

    test("a privilege check the controller refuses leaves the verdict undetermined without failing the connect", async () => {

      const { agent, pool } = mockController();

      interceptLogin(pool);
      pool.intercept({ method: "GET", path: CONTROLLER_PATH }).reply(200, controllerBody());
      pool.intercept({ method: "GET", path: TOPOLOGY_PATH }).reply(200, topologyBody());
      pool.intercept({ method: "GET", path: SELF_PATH }).reply(401, "unauthorized");

      await using client = await connect(agent);

      // Not learning whether the account is privileged is different from learning that it is not, so the verdict stays undetermined and the client is still usable.
      assert.equal(client.isAdmin, null);
      assert.equal(client.controllerName, "host-2.test.local");
    });
  });

  describe("failures are typed and leave no client behind", () => {

    test("bad credentials reject with the authentication error", async () => {

      const { agent, pool } = mockController();

      pool.intercept({ method: "POST", path: LOGIN_PATH }).reply(401, "bad");
      pool.intercept({ method: "GET", path: "/" }).reply(500, "unavailable");

      await assertRejectsWith(connect(agent), AccessAuthError, { check: (error) => {

        assert.equal(error.identity, "credentials", "a credential-only connect can only have been refused its credentials");
      } });
    });

    test("a refused document fetch rejects at the fetch stage", async () => {

      const { agent, pool } = mockController();

      interceptLogin(pool);
      pool.intercept({ method: "GET", path: CONTROLLER_PATH }).reply(200, controllerBody());
      pool.intercept({ method: "GET", path: TOPOLOGY_PATH }).reply(500, "boom");

      await assertRejectsWith(connect(agent), AccessBootstrapError, { check: (error) => {

        assert.equal(error.stage, "fetch");
      } });
    });

    test("a topology collection with no document rejects at the parse stage", async () => {

      const { agent, pool } = mockController();

      interceptLogin(pool);
      pool.intercept({ method: "GET", path: CONTROLLER_PATH }).reply(200, controllerBody());

      // The endpoint answers with an empty collection. Taking that as an empty topology would silently model a controller with no doors at all, so it is a parse
      // failure instead.
      pool.intercept({ method: "GET", path: TOPOLOGY_PATH }).reply(200, topologyBody([]));

      await assertRejectsWith(connect(agent), AccessBootstrapError, { check: (error) => {

        assert.equal(error.stage, "parse");
      } });
    });

    test("a body that will not parse rejects at the parse stage", async () => {

      const { agent, pool } = mockController();

      interceptLogin(pool);
      pool.intercept({ method: "GET", path: CONTROLLER_PATH }).reply(200, controllerBody());
      pool.intercept({ method: "GET", path: TOPOLOGY_PATH }).reply(200, "not-json{");

      await assertRejectsWith(connect(agent), AccessBootstrapError, { check: (error) => {

        assert.equal(error.stage, "parse");
      } });
    });

    test("a document read the controller refuses inside a 200 rejects at the fetch stage, with the refusal as the cause", async () => {

      const { agent, pool } = mockController();

      /* A refusal in the envelope is the controller declining to hand the document over, which is the same event as the non-2xx the fetch stage already reports -
       * so it classifies there rather than as a document that arrived and could not be read. The controller's own code travels one link down the chain.
       */
      interceptLogin(pool);
      pool.intercept({ method: "GET", path: CONTROLLER_PATH }).reply(200, REFUSAL_BODY);
      pool.intercept({ method: "GET", path: TOPOLOGY_PATH }).reply(200, topologyBody());

      await assertRejectsWith(connect(agent), AccessBootstrapError, { check: (error) => {

        assert.equal(error.stage, "fetch");
        assert.ok(error.cause instanceof AccessApiError, "the controller's refusal is the cause rather than a message this layer composed");
        assert.equal(error.cause.code, "CODE_SYSTEM_ERROR");
      } });
    });

    test("a refused topology read rejects at the fetch stage exactly as a refused controller read does", async () => {

      const { agent, pool } = mockController();

      // The pair is read by one rule, so which of the two documents the controller declined does not change how the failure reports.
      interceptLogin(pool);
      pool.intercept({ method: "GET", path: CONTROLLER_PATH }).reply(200, controllerBody());
      pool.intercept({ method: "GET", path: TOPOLOGY_PATH }).reply(200, REFUSAL_BODY);

      await assertRejectsWith(connect(agent), AccessBootstrapError, { check: (error) => {

        assert.equal(error.stage, "fetch");
        assert.ok(error.cause instanceof AccessApiError, "the controller's refusal is the cause");
        assert.equal(error.cause.code, "CODE_SYSTEM_ERROR");
      } });
    });

    test("a 200 carrying a document that is not an envelope rejects at the parse stage", async () => {

      const { agent, pool } = mockController();

      // The other polarity of the read: a body that parses but reports no verdict at all is the document arriving and not being the document.
      interceptLogin(pool);
      pool.intercept({ method: "GET", path: CONTROLLER_PATH }).reply(200, "{}");
      pool.intercept({ method: "GET", path: TOPOLOGY_PATH }).reply(200, topologyBody());

      await assertRejectsWith(connect(agent), AccessBootstrapError, { check: (error) => {

        assert.equal(error.stage, "parse");
        assert.ok(error.cause instanceof AccessProtocolError, "a body that is not an envelope surfaces as the protocol error the reader raised");
      } });
    });

    test("a success envelope carrying no document rejects at the parse stage, for either document", async () => {

      const first = mockController();

      /* The controller reported success and then sent nothing to read. Taking that as a document would hand the store an undefined controller record, which is the
       * silence this presence test exists to end - and it reads the same way whichever of the two documents came back empty.
       */
      interceptLogin(first.pool);
      first.pool.intercept({ method: "GET", path: CONTROLLER_PATH }).reply(200, DOCUMENTLESS_BODY);
      first.pool.intercept({ method: "GET", path: TOPOLOGY_PATH }).reply(200, topologyBody());

      await assertRejectsWith(connect(first.agent), AccessBootstrapError, { check: (error) => {

        assert.equal(error.stage, "parse");
        assert.ok(error.cause instanceof TypeError, "the absent controller document surfaces as the presence test's own refusal");
      } });

      const second = mockController();

      interceptLogin(second.pool);
      second.pool.intercept({ method: "GET", path: CONTROLLER_PATH }).reply(200, controllerBody());
      second.pool.intercept({ method: "GET", path: TOPOLOGY_PATH }).reply(200, DOCUMENTLESS_BODY);

      await assertRejectsWith(connect(second.agent), AccessBootstrapError, { check: (error) => {

        assert.equal(error.stage, "parse");
        assert.ok(error.cause instanceof TypeError, "the absent topology document surfaces the same way");
      } });
    });

    test("a notification socket that never opens rejects and leaves nothing behind", async () => {

      const { agent, pool } = mockController();

      interceptLogin(pool);
      interceptPass(pool);

      await assert.rejects(AccessClient.connect({ dispatcher: agent, host: HOST, log: silentLog(), password: "p", refreshIntervalMs: false, username: "u",
        webSocket: () => {

          const ws = new FakeWebSocket({ autoOpen: false });

          queueMicrotask(() => ws.emitClose(1006, "connection refused"));

          return ws;
        } }));
    });
  });

  describe("the single-flight document fetch", () => {

    test("two overlapping passes share one fetch rather than issuing two", async () => {

      const { agent, pool } = mockController();
      const clock = new TestClock();

      interceptLogin(pool);
      interceptPass(pool);

      /* The controller document is held on a gate this test releases, so the first pass is provably still in flight when the second reaches for the pair - a
       * real-time delay makes that ordering a race against the machine's load, and it was lost once under a concurrent suite run. Every response persists, so a
       * second fetch would be served rather than failing for want of an interceptor, which is what makes the count below a real measurement rather than an
       * artifact of the mock.
       */
      const release = Promise.withResolvers<undefined>();

      pool.intercept({ method: "GET", path: CONTROLLER_PATH }).reply(async () => {

        await release.promise;

        return { data: controllerBody(), statusCode: 200 };
      }).persist();
      pool.intercept({ method: "GET", path: TOPOLOGY_PATH }).reply(200, () => topologyBody()).persist();
      pool.intercept({ method: "GET", path: SELF_PATH }).reply(200, () => selfBody(true)).persist();

      const captured = await connectCapturing(agent, { clock, refreshIntervalMs: 1000 });

      await using client = captured.client;
      const { ws } = captured;

      /* Count the controller-information requests as they are dispatched rather than as they are answered, which is what lets a request still in flight be counted
       * at all. Only the document fetch asks for that endpoint - the reachability probe asks for the topology - so it is what cleanly tells one shared fetch from
       * two. The connection's edges are read from the same diagnostics surface, because the reconnecting edge is what marks recovery reaching for the pair.
       */
      let controllerRequests = 0;
      const phases: string[] = [];

      using startSub = subscribeTo(channels.httpRequestStart, (message) => {

        if(message.url.includes("/access/info")) {

          controllerRequests++;
        }
      });
      using transitionSub = subscribeTo(channels.connectionTransition, (message) => void phases.push(message.to));

      clock.advance(1000);
      await settle();
      assert.equal(controllerRequests, 1, "expected the refresh pass to be dispatched");

      /* The pass is now in flight and parked on the gate. Fault the channel so recovery probes and then re-bootstraps, which reaches for the same pair while the
       * first is still outstanding. Joining it is what makes two passes unable to settle out of order, and so unable to land a stale controller document on top
       * of a fresher one. Recovery parks on the clock before its first attempt, so the clock is released on every poll until the reconnecting edge appears; the
       * edge is announced immediately before recovery reaches for the pair, and one more turn of the event loop is the join.
       */
      ws.emitError(new Error("socket dropped"));

      await settleUntil(() => {

        clock.advance(0);

        return phases.includes("reconnecting");
      }, { message: "expected recovery to reach the re-bootstrap" });
      await settle();

      assert.equal(controllerRequests, 1, "the second caller joined the fetch already in flight rather than dispatching its own");

      release.resolve(undefined);

      await settleUntil(() => client.connection.state === "healthy", { message: "expected recovery to complete" });

      assert.equal(controllerRequests, 1, "and the shared pass settled both callers without a second fetch");
    });

    test("a rejected fetch clears the slot so the next pass starts fresh", async () => {

      const { agent, pool } = mockController();
      const clock = new TestClock();

      interceptLogin(pool);
      interceptPass(pool);

      // The first pass after connect is refused; the next must be a genuinely new fetch rather than joining the failed one for the rest of the client's life. The
      // second pass carries a moved uptime, so that its documents reaching the state model is observable rather than merely assumed.
      pool.intercept({ method: "GET", path: CONTROLLER_PATH }).reply(500, "boom");
      pool.intercept({ method: "GET", path: TOPOLOGY_PATH }).reply(200, topologyBody());
      pool.intercept({ method: "GET", path: CONTROLLER_PATH }).reply(200, controllerBody(accessControllerInfoFixture.host.uptime + 3600));
      pool.intercept({ method: "GET", path: TOPOLOGY_PATH }).reply(200, topologyBody());

      await using client = await connect(agent, { clock, refreshIntervalMs: 1000 });

      // Count dispatches rather than replies, which is independent of how the mock chooses to serve them.
      let controllerRequests = 0;
      let controllerSettled = 0;

      using startSub = subscribeTo(channels.httpRequestStart, (message) => {

        if(message.url.includes("/access/info")) {

          controllerRequests++;
        }
      });
      using endSub = subscribeTo(channels.httpRequestEnd, (message) => {

        if(message.url.includes("/access/info")) {

          controllerSettled++;
        }
      });

      clock.advance(1000);
      await settle();
      assert.equal(controllerRequests, 1, "expected the first pass to be dispatched");

      // The refusal has to settle before the next pass can start fresh: the slot clears when the refused fetch rejects, and the transport announces every
      // request's end on one signal whatever its outcome. Waiting on that signal rather than on the wall clock makes the second dispatch a measurement of the
      // slot, not of timing.
      await settleUntil(() => controllerSettled === 1, { message: "expected the refused fetch to settle" });
      await settle();

      clock.advance(1000);
      await settle();
      assert.equal(controllerRequests, 2, "the pass after a failure must dispatch its own fetch rather than joining the failed one");

      await settleUntil(() => client.controllerInfo?.host.uptime === (accessControllerInfoFixture.host.uptime + 3600),
        { message: "the second pass's documents reached the state model" });
    });

    test("a pass still in flight at disposal neither hangs nor dispatches into the disposed store", async () => {

      const { agent, pool } = mockController();
      const clock = new TestClock();

      interceptLogin(pool);
      interceptPass(pool);

      // Both documents are held on one gate, so the pass is provably in flight at disposal, and both of its requests are provably settled before the wakes are read.
      const release = Promise.withResolvers<undefined>();
      const held = async (body: string): Promise<{ data: string; statusCode: number }> => {

        await release.promise;

        return { data: body, statusCode: 200 };
      };

      pool.intercept({ method: "GET", path: CONTROLLER_PATH }).reply(() => held(controllerBody()));
      pool.intercept({ method: "GET", path: TOPOLOGY_PATH }).reply(() => held(topologyBody()));

      const client = await connect(agent, { clock, refreshIntervalMs: 1000 });

      // Watch for any observer wake at all, so a late dispatch reaching the store would be visible rather than merely improbable.
      const ac = new AbortController();
      const wakes: number[] = [];
      const watching = (async (): Promise<void> => {

        for await (const _state of client.state.observe((state) => state, { signal: ac.signal })) {

          wakes.push(1);
        }
      })();

      // The pass's two requests are counted as they settle, on the transport's end-of-request signal, which fires for an answered request and an aborted one alike.
      let settled = 0;

      using endSub = subscribeTo(channels.httpRequestEnd, () => { settled++; });

      await settle();
      clock.advance(1000);
      await settle();

      // Dispose while the pass is parked on the gate, then release the gate and let both requests settle. Whatever the pass does next meets the store's terminal
      // guard and changes nothing.
      await client[Symbol.asyncDispose]();
      release.resolve(undefined);

      await settleUntil(() => settled === 2, { message: "expected both of the pass's requests to settle" });
      await settle();

      assert.equal(wakes.length, 0, "the late settlement woke no observer");

      ac.abort();
      await watching;
    });
  });

  describe("the realtime bridge and the projection surface", () => {

    test("one frame advances the state model and reaches the firehose from a single decode", async () => {

      const { agent, pool } = mockController();

      interceptLogin(pool);
      interceptPass(pool);

      const captured = await connectCapturing(agent);

      await using client = captured.client;
      const { ws } = captured;
      const firehose: AccessWireEvent[] = [];

      client.on("packet", (event) => void firehose.push(event));

      ws.emitMessage(deviceFrame(HUB, { "alias": "Renamed" }));

      // The store advanced and the same event reached the firehose, both from the one decode - and the store first, so a consumer reading state inside its handler
      // sees the post-event value.
      assert.equal(client.device(HUB)?.name, "Renamed");
      assert.equal(firehose.length, 1);
      assert.equal(firehose[0]?.kind, "deviceChanged");
    });

    test("a door-state frame reaches both the door-state view and the hub that drives that door", async () => {

      const { agent, pool } = mockController();

      interceptLogin(pool);
      interceptPass(pool);

      const captured = await connectCapturing(agent);

      await using client = captured.client;
      const { ws } = captured;
      const hub = present(client.hub(HUB), "the hub");

      // What the connect seed established for this door from the hub's own flags: a lock at rest, and no report-only members.
      const before = hub.doorState;

      assert.equal(before?.lock, "locked");
      assert.equal(Object.hasOwn(before ?? {}, "emergency"), false);

      ws.emitMessage(doorStateFrame(DOOR_HUB, "unlocked"));

      const reported = hub.doorState;

      assert.equal(client.doorStates.get(DOOR_HUB)?.lock, "unlocked", "the door-state view carries it");
      assert.equal(reported?.lock, "unlocked", "and the hub reads its own door's entry without the consumer resolving the door");
    });

    test("a handle taken from the connected client observes through the real wiring", async () => {

      const { agent, pool } = mockController();

      interceptLogin(pool);
      interceptPass(pool);

      const captured = await connectCapturing(agent);

      await using client = captured.client;
      const { ws } = captured;
      const hub = present(client.hub(HUB), "the hub");

      /* The composition check: the handle's observation runs through the read-only store slice the client built into its context, so this fails if that wiring is
       * wrong in a way no unit test with a hand-built context would catch.
       */
      const ac = new AbortController();
      const seen: string[] = [];
      const watching = (async (): Promise<void> => {

        for await (const updated of hub.observe({ signal: ac.signal })) {

          seen.push(updated.name);
        }
      })();

      await settle();

      ws.emitMessage(deviceFrame(HUB, { "alias": "Observed" }));

      await settleUntil(() => seen.length === 1);
      assert.deepEqual(seen, ["Observed"]);

      ac.abort();
      await watching;
    });

    test("the raw firehose carries the frames the classifier declines", async () => {

      const { agent, pool } = mockController();

      interceptLogin(pool);
      interceptPass(pool);

      const captured = await connectCapturing(agent);

      await using client = captured.client;
      const { ws } = captured;
      const controller = new AbortController();
      const raw: string[] = [];
      const task = (async (): Promise<void> => {

        for await (const packet of client.rawPackets({ signal: controller.signal })) {

          raw.push(packet.event);
        }
      })();

      // One modeled frame and one the library deliberately does not model: the typed rail drops the second, the raw rail carries both.
      ws.emitMessage(deviceFrame(HUB));
      ws.emitMessage(unmodeledFrame());

      await settleUntil(() => raw.length === 2);

      controller.abort();
      await task;

      assert.deepEqual(raw, [ "access.data.device.update", "access.base.info" ]);
    });

    test("the typed firehose ends quietly on the caller's own abort", async () => {

      const { agent, pool } = mockController();

      interceptLogin(pool);
      interceptPass(pool);

      const captured = await connectCapturing(agent);

      await using client = captured.client;
      const { ws } = captured;
      const controller = new AbortController();
      const collected: AccessWireEvent[] = [];
      const task = (async (): Promise<void> => {

        for await (const event of client.events({ signal: controller.signal })) {

          collected.push(event);
        }
      })();

      ws.emitMessage(deviceFrame(HUB));
      await settleUntil(() => collected.length === 1);

      controller.abort();
      await task;

      assert.equal(collected.length, 1);
    });

    test("the typed firehose rethrows a failure that is not the caller's abort", async () => {

      const { agent, pool } = mockController();

      interceptLogin(pool);
      interceptPass(pool);

      const { client, ws } = await connectCapturing(agent);
      const iterator = client.events();
      const pending = iterator.next();

      // One frame resolves the first read and leaves the generator resting at its yield, which is where a thrown failure has to land to reach the catch at all.
      ws.emitMessage(deviceFrame(HUB));
      await pending;

      /* The catch finds no aborted signal - this consumer passed none - so the rethrow is what rejects the call. That is the arm the abort sugar is defined
       * against: a caller's own cancellation ends the loop quietly and everything else reaches the consumer intact. The disposal is in a finally because a
       * failing assertion that skipped it would leave the mock dispatcher and the notification stream holding the event loop, and the file would run to the
       * runner's ceiling rather than failing fast.
       */
      try {

        await assert.rejects(iterator.throw(new Error("injected")), { message: "injected" });
      } finally {

        await client[Symbol.asyncDispose]();
      }
    });

    test("the raw firehose rethrows a failure that is not the caller's abort", async () => {

      const { agent, pool } = mockController();

      interceptLogin(pool);
      interceptPass(pool);

      const { client, ws } = await connectCapturing(agent);
      const iterator = client.rawPackets();
      const pending = iterator.next();

      ws.emitMessage(deviceFrame(HUB));
      await pending;

      // The raw rail carries the same contract as the typed one, and it is a separate generator with its own catch, so it needs its own case.
      try {

        await assert.rejects(iterator.throw(new Error("injected")), { message: "injected" });
      } finally {

        await client[Symbol.asyncDispose]();
      }
    });

    test("once resolves on the next emission and stream yields the raw tuples", async () => {

      const { agent, pool } = mockController();

      interceptLogin(pool);
      interceptPass(pool);

      const captured = await connectCapturing(agent);

      await using client = captured.client;
      const { ws } = captured;

      // once registers synchronously, so it catches the emission that follows it.
      const pending = client.once("packet");

      ws.emitMessage(deviceFrame(HUB));

      const [event] = await pending;

      assert.equal(event.kind, "deviceChanged");

      // The raw stream rail rejects with the abort reason when its signal fires - the contract the firehose sugar smooths, and which a direct consumer handles.
      const controller = new AbortController();
      const seen: string[] = [];
      const consumer = (async (): Promise<void> => {

        try {

          for await (const [packet] of client.stream("packet", { signal: controller.signal })) {

            seen.push(packet.kind);
          }
        } catch {

          // The abort reason ends the iteration.
        }
      })();

      await settle();
      ws.emitMessage(deviceFrame(HUB, { "alias": "Streamed" }));

      await settleUntil(() => seen.length === 1);
      assert.deepEqual(seen, ["deviceChanged"]);

      controller.abort();
      await consumer;
    });

    test("an already-aborted firehose signal ends both rails quietly", async () => {

      const { agent, pool } = mockController();

      interceptLogin(pool);
      interceptPass(pool);

      await using client = await connect(agent);
      const controller = new AbortController();

      controller.abort();

      const events: unknown[] = [];
      const raw: unknown[] = [];

      for await (const event of client.events({ signal: controller.signal })) {

        events.push(event);
      }

      for await (const packet of client.rawPackets({ signal: controller.signal })) {

        raw.push(packet);
      }

      assert.deepEqual([ events.length, raw.length ], [ 0, 0 ], "an aborted firehose ends rather than throwing at its consumer");
    });

    test("fetchBootstrap reports a refused or unreadable answer at the stage it failed", async () => {

      const { agent, pool } = mockController();

      interceptLogin(pool);
      interceptPass(pool);

      await using client = await connect(agent);

      pool.intercept({ method: "GET", path: TOPOLOGY_PATH }).reply(500, "boom");

      await assertRejectsWith(() => client.fetchBootstrap(), AccessBootstrapError, { check: (error) => {

        assert.equal(error.stage, "fetch");
      } });

      pool.intercept({ method: "GET", path: TOPOLOGY_PATH }).reply(200, "not-json{");

      await assertRejectsWith(() => client.fetchBootstrap(), AccessBootstrapError, { check: (error) => {

        assert.equal(error.stage, "parse");
      } });
    });

    test("fetchBootstrap reports a refusal inside a 200 at the fetch stage, carrying the controller's code", async () => {

      const { agent, pool } = mockController();

      interceptLogin(pool);
      interceptPass(pool);

      await using client = await connect(agent);

      // The on-demand read of the topology document judges the envelope by the same rule the connect-time read does, so one endpoint is not read two ways.
      pool.intercept({ method: "GET", path: TOPOLOGY_PATH }).reply(200, REFUSAL_BODY);

      await assertRejectsWith(() => client.fetchBootstrap(), AccessBootstrapError, { check: (error) => {

        assert.equal(error.stage, "fetch");
        assert.ok(error.cause instanceof AccessApiError, "the controller's refusal is the cause");
        assert.equal(error.cause.code, "CODE_SYSTEM_ERROR");
      } });
    });

    test("the static classifier runs without a connection", () => {

      const packet = { "data": { "unique_id": HUB }, "event": "access.data.device.update", "event_object_id": HUB, "receiver_id": "",
        "save_to_history": false };

      assert.equal(AccessClient.classifyPacket(packet)?.kind, "deviceChanged");
      assert.equal(AccessClient.classifyPacket({ ...packet, "event": "access.something.invented" }), null);
    });

    test("fetchBootstrap returns the controller's own document without folding it into state", async () => {

      const { agent, pool } = mockController();

      interceptLogin(pool);
      interceptPass(pool);

      await using client = await connect(agent);

      // A different topology for the explicit fetch: it must come back verbatim and must NOT advance the state model.
      const trimmed = JSON.parse(JSON.stringify(accessBootstrap2026Fixture)) as { floors?: { doors: unknown[] }[] };

      if(trimmed.floors?.[0] !== undefined) {

        trimmed.floors[0].doors = [];
      }

      pool.intercept({ method: "GET", path: TOPOLOGY_PATH }).reply(200, topologyBody([trimmed]));

      const fetched = await client.fetchBootstrap() as { data: { floors: { doors: unknown[] }[] }[] };

      assert.equal(fetched.data[0]?.floors[0]?.doors.length, 0, "the fetch returned what the controller sent");
      assert.equal(client.state.snapshot().doors.size, 3, "and the state model is untouched by it");
    });
  });

  describe("diagnostics", () => {

    test("the store-dispatch channel reports each committed event with the controller stamped on", async () => {

      const { agent, pool } = mockController();

      interceptLogin(pool);
      interceptPass(pool);

      const captured = await connectCapturing(agent);

      await using client = captured.client;
      const { ws } = captured;
      const payloads: AccessStoreDispatchPayload[] = [];

      using dispatchSub = subscribeTo(channels.storeDispatch, (message) => void payloads.push(message));

      ws.emitMessage(deviceFrame(HUB, { "alias": "Published" }));
      ws.emitMessage(doorStateFrame(DOOR_HUB, "unlocked"));

      // Content rather than counts: the host is the controller this client addresses, and the kind is the reducer's own vocabulary.
      assert.deepEqual(payloads, [ { host: HOST, kind: "deviceChanged" }, { host: HOST, kind: "doorStateChanged" } ]);
    });

    test("the connection-transition channel reports each edge with the controller stamped on", async () => {

      const { agent, pool } = mockController();
      const clock = new TestClock();

      interceptLogin(pool);
      interceptPass(pool);
      pool.intercept({ method: "GET", path: TOPOLOGY_PATH }).reply(200, topologyBody());
      pool.intercept({ method: "GET", path: CONTROLLER_PATH }).reply(200, controllerBody());
      pool.intercept({ method: "GET", path: TOPOLOGY_PATH }).reply(200, topologyBody());
      pool.intercept({ method: "GET", path: SELF_PATH }).reply(200, selfBody(true));

      const payloads: AccessConnectionTransitionPayload[] = [];
      const captured = await connectCapturing(agent, { clock });

      await using client = captured.client;
      const { ws } = captured;

      using transitionSub = subscribeTo(channels.connectionTransition, (message) => void payloads.push(message));

      // Fault the channel and let recovery run: the edges are degraded, then reconnecting, then healthy.
      ws.emitError(new Error("socket dropped"));

      // Recovery parks on the clock before its first attempt, so the clock is released on every poll until the connection reads healthy again.
      await settleUntil(() => {

        clock.advance(0);

        return client.connection.state === "healthy";
      }, { message: "expected recovery to complete" });

      assert.deepEqual(payloads.map((payload) => payload.to), [ "degraded", "reconnecting", "healthy" ]);
      assert.ok(payloads.every((payload) => payload.host === HOST), "every edge carries the controller it belongs to");
      assert.equal(payloads[0]?.from, "healthy");
      assert.equal(typeof payloads[0].reason, "string", "the edge a fault drove carries that fault's reason");
    });
  });

  describe("teardown", () => {

    test("disposal is safe to repeat", async () => {

      const { agent, pool } = mockController();

      interceptLogin(pool);
      interceptPass(pool);

      const client = await connect(agent);

      await client[Symbol.asyncDispose]();
      await client[Symbol.asyncDispose]();
    });

    test("disposal ends the session and stops the state model", async () => {

      const { agent, pool } = mockController();

      interceptLogin(pool);
      interceptPass(pool);

      const client = await connect(agent);

      assert.equal(client.isAdmin, true);

      await client[Symbol.asyncDispose]();

      // The session was ended, so the privilege verdict it earned is gone with it rather than being reported as still held.
      assert.equal(client.isAdmin, null);
    });
  });
});

/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * devices.test.ts: Tests for the device projections - liveness (a held handle reflects later store changes), the absent-record guard, the door-state read-through,
 * and the write-through commands. Every command test asserts the wire shape through an intercepted request rather than through the projection's own return value,
 * so what is being checked is what the controller would actually receive.
 */
import { AccessAuthorizationError, AccessCapabilityError, AccessOfficialApiError, AccessProtocolError, AccessRequestError } from "../errors.ts";
import type { AccessBootstrapConfig, AccessEventPacket } from "../types/index.ts";
import { accessBootstrap2026Fixture, accessBootstrapEahFixture } from "../protocol/topology.fixtures.ts";
import { accessOfficialDevicesFixture, accessOfficialDoorsFixture } from "../official/devices.fixtures.ts";
import { describe, test } from "node:test";
import { doorStateEntry, officialDeviceRecord, officialDoorRecord } from "../client/census.ts";
import { expectAt, fakeClock, silentLog } from "../testing.helpers.ts";
import type { AccessApiOverride } from "../client/routing.ts";
import type { AccessDeviceContext } from "./context.ts";
import { AccessDeviceRegistry } from "./registry.ts";
import type { AccessOfficialCallOptions } from "../official/dispatch.ts";
import type { AccessOfficialDoorUnlockOptions } from "../official/spaces.ts";
import { AccessRoutingService } from "../client/routing.ts";
import type { AccessTypedEvent } from "../protocol/events.ts";
import type { MockTransport } from "../transport/mock-controller.helpers.ts";
import { StateStore } from "../state/store.ts";
import assert from "node:assert/strict";
import { classifyPacket } from "../protocol/events.ts";
import { setTimeout as delay } from "node:timers/promises";
import { makeMockTransport } from "../transport/mock-controller.helpers.ts";

// Named entries from the 2026 document: a single-door hub, the door it drives, and a reader that is not hub-capable.
const HUB = "aabbcc000001";
const DOOR_HUB = "00000000-0000-0000-0000-000000000006";
const READER = "aabbcc000002";
const DOOR_MINI = "aabbcc000004";
const DOOR_MINI_DOOR = "00000000-0000-0000-0000-00000000000e";

// The UA Ultra of the same document, the one device in it whose hardware detects tampering.
const ULTRA = "aabbcc000000";

// Named entries from the 2024 document: the building-hosted Enterprise Access Hub, two of its ports, and the doors those ports serve.
const EAH_HUB = "aabbcc000005";
const EAH_PORT_2 = "00000000-0000-0000-0000-00000000002a";
const EAH_PORT_3 = "00000000-0000-0000-0000-00000000002b";
const EAH_DOOR_2 = "00000000-0000-0000-0000-000000000013";

// The controller's own success envelope, and the shape it uses to refuse an operation it nonetheless answered 200 to.
const SUCCESS = JSON.stringify({ code: 200, codeS: "SUCCESS", data: {}, error: "", msg: "" });
const REFUSED = JSON.stringify({ code: 400, codeS: "OPERATION_ERROR", data: {}, error: "", msg: "the door is already unlocked" });

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/* One request as the controller would have received it. The interceptor's reply callback is what makes this possible: it runs with the dispatch options in hand, so
 * a test can assert on the method and the exact body bytes - including their absence, which no assertion on the projection's return value could show.
 */
interface CapturedRequest {

  body: unknown;
  method: string;
  path: string;
}

// Build a registry over a real store seeded with a real topology document, and a mocked transport whose requests are captured. The refresh failsafe is disabled:
// these tests advance state by explicit dispatch, so an unexpected refresh would be noise rather than signal.
interface DeviceFixture {

  captured: CapturedRequest[];
  ctx: AccessDeviceContext;
  mock: MockTransport;
  registry: AccessDeviceRegistry;
  store: StateStore;
}

function deviceFixture(bootstrap: AccessBootstrapConfig): DeviceFixture {

  const mock = makeMockTransport();
  const store = new StateStore({ clock: fakeClock(), log: silentLog(),
    refresh: () => Promise.reject(new Error("the refresh callback must not be called")), refreshIntervalMs: false });

  store.dispatch({ data: clone(bootstrap), kind: "bootstrapLoaded" });

  /* The real routing service rather than a stand-in, configured as a credential-only client: no official surface, so every routed command falls through to the
   * direct path these tests are about. That means the direct-path assertions below run through the genuine routing decision rather than around it, and a routing
   * change that broke the fallback would fail here rather than only in the routed suites.
   */
  const routing = new AccessRoutingService({ capabilities: { mode: "credential", official: false, override: "auto" }, official: null, store });
  const ctx: AccessDeviceContext = { host: mock.host, log: silentLog(), routing, store, transport: mock.transport };

  return { captured: [], ctx, mock, registry: new AccessDeviceRegistry(ctx), store };
}

// Intercept one request on a path, record what arrived, and answer with the given body. The recorded `body` is the raw value undici was handed, so an absent body
// records as undefined and a present one as its exact bytes.
interface InterceptOptions {

  body?: string;
  method: string;
  path: string;
  status?: number;
}

function intercept(fixture: DeviceFixture, options: InterceptOptions): void {

  fixture.mock.pool.intercept({ method: options.method, path: options.path }).reply(options.status ?? 200, (opts): string => {

    fixture.captured.push({ body: opts.body, method: opts.method ?? "", path: opts.path });

    return options.body ?? SUCCESS;
  });
}

// A door-state report, so a test can put a door's live state into the store without a wire round trip.
const doorStateEvent = (locationId: string, lock: string): AccessTypedEvent => ({ device: { id: HUB, payload: {} },
  eventName: "access.data.v2.device.update", kind: "doorStateChanged",
  states: [{ "dps": "close", "dps_connected": true, "emergency": { "hardware": "none", "software": "none" }, "is_unavailable": false,
    "location_id": locationId, "lock": lock }] });

// The same report as the controller would have framed it, for the cases that need to go through the classifier's admission contract rather than around it.
const wirePacket = (locationId: string, lock: string, extra: Record<string, unknown> = {}): AccessEventPacket => ({

  "data": { "id": HUB, "location_states": [{ "alarms": undefined, "dps": "close", "dps_connected": true,
    "emergency": { "hardware": "none", "software": "none" }, "is_unavailable": false, "location_id": locationId, "lock": lock, ...extra }] },
  "event": "access.data.v2.device.update",
  "event_object_id": "00000000-0000-4000-8000-000000000000",
  "meta": { "all_field": false, "id": HUB, "object_type": "device", "source": "", "target_field": ["location_states"] },
  "receiver_id": "",
  "save_to_history": false
});

describe("device projections", () => {

  describe("liveness and read-through", () => {

    test("a held handle reflects a later store change rather than a value captured at lookup", () => {

      const { registry, store } = deviceFixture(accessBootstrap2026Fixture);
      const device = registry.device(HUB);

      assert.ok(device);
      assert.equal(device.name, "Test alias 13");
      assert.equal(device.isOnline, true);

      store.dispatch({ eventName: "access.data.device.update", id: HUB, kind: "deviceChanged", payload: { "alias": "Renamed", "is_online": false } });

      assert.equal(device.name, "Renamed", "the handle re-read rather than answering from a captured value");
      assert.equal(device.isOnline, false);
    });

    test("the display name falls through to the controller's own name when the alias is empty", () => {

      const { registry, store } = deviceFixture(accessBootstrap2026Fixture);
      const device = registry.device(HUB);

      assert.ok(device);

      // Clearing an alias in the controller's interface reads on the wire as the empty string rather than as an absent member, so the fall-through has to treat it
      // as unset.
      store.dispatch({ eventName: "access.data.device.update", id: HUB, kind: "deviceChanged", payload: { "alias": "" } });

      assert.equal(device.name, device.config.name);
      assert.notEqual(device.name, "");
    });

    test("isOnline reads the controller's own flag rather than a composition of the enrollment flags", () => {

      /* The case that tells the two definitions apart: a device the controller reports online while the flags describing how it is enrolled read false. Composing
       * those flags in would make this getter one consumer's policy; reading the controller's own report keeps it the controller's answer.
       */
      const { registry, store } = deviceFixture(accessBootstrap2026Fixture);
      const device = registry.device(HUB);

      assert.ok(device);

      store.dispatch({ eventName: "access.data.device.update", id: HUB, kind: "deviceChanged",
        payload: { "is_adopted": false, "is_connected": false, "is_online": true } });

      assert.equal(device.config.is_connected, false, "the enrollment flags really are false on this record");
      assert.equal(device.config.is_adopted, false);
      assert.equal(device.isOnline, true, "and the online verdict is still the controller's own flag");
    });

    test("peek reports an absent record while the asserting reads throw", () => {

      const { registry, store } = deviceFixture(accessBootstrap2026Fixture);
      const device = registry.device(HUB);

      assert.ok(device);
      assert.equal(device.peek()?.unique_id, HUB);

      store.dispatch({ eventName: "access.data.v2.device.delete", id: HUB, kind: "deviceRemoved" });

      assert.equal(device.peek(), undefined, "a departed record reads as absent rather than throwing");
      assert.throws(() => device.name, ReferenceError, "while the asserting read fails loudly");
      assert.equal(registry.device(HUB), undefined, "and a fresh lookup finds nothing");
    });

    test("observe yields the handle on each change to its own record and stays silent otherwise", async () => {

      const { registry, store } = deviceFixture(accessBootstrap2026Fixture);
      const device = registry.device(HUB);

      assert.ok(device);

      const ac = new AbortController();
      const seen: string[] = [];
      const done = (async (): Promise<void> => {

        for await (const updated of device.observe({ signal: ac.signal })) {

          seen.push(updated.name);
        }
      })();

      await delay(0);

      // An unrelated device changing must not wake this handle's observer.
      store.dispatch({ eventName: "access.data.device.update", id: READER, kind: "deviceChanged", payload: { "alias": "Other" } });
      await delay(5);
      assert.equal(seen.length, 0);

      store.dispatch({ eventName: "access.data.device.update", id: HUB, kind: "deviceChanged", payload: { "alias": "Renamed" } });
      await expectAt(() => seen.length === 1);
      assert.deepEqual(seen, ["Renamed"]);

      ac.abort();
      await done;
    });

    test("the tamper getters read the record through the selectors rather than answering from a captured value", () => {

      const { registry, store } = deviceFixture(accessBootstrap2026Fixture);
      const ultra = registry.device(ULTRA);
      const hub = registry.device(HUB);

      assert.ok(ultra && hub);

      // The capability is mirrored on the handle because it produces no projection class a consumer could ask about instead, so this is where a consumer asks.
      assert.equal(ultra.isTamperCapable, true);
      assert.equal(hub.isTamperCapable, false, "the UAH carries the hub capability without this one");
      assert.equal(ultra.tamperState, undefined, "the captured document has this device's tampering alert switched off");

      const rows = ultra.config.configs;

      assert.ok(rows, "the document should carry the UA Ultra's configuration rows");

      // The wire's own delivery shape: the original device-update dialect sends the whole record, so both rows arrive inside the whole row array. The alert
      // setting moves with the input it gates, because a reading is established only while the setting is on.
      const flipped: Readonly<Record<string, string>> = { "tamper_event": "true", "tampering": "true" };

      store.dispatch({ eventName: "access.data.device.update", id: ULTRA, kind: "deviceChanged",
        payload: { configs: rows.map((row) => ({ ...row, "value": flipped[row.key] ?? row.value })) } });

      assert.equal(ultra.tamperState, true, "the handle re-read rather than answering from a captured value");
      assert.equal(ultra.isTamperCapable, true, "and the capability the flip said nothing about is where it was");
    });

    test("the tamper getters throw once the record has left the state", () => {

      const { registry, store } = deviceFixture(accessBootstrap2026Fixture);
      const ultra = registry.device(ULTRA);

      assert.ok(ultra);

      store.dispatch({ eventName: "access.data.v2.device.delete", id: ULTRA, kind: "deviceRemoved" });

      // The asserting reads fail loudly, exactly as every other one on this handle does: a handle to an absent record is a caller's own error.
      assert.throws(() => ultra.tamperState, ReferenceError);
      assert.throws(() => ultra.isTamperCapable, ReferenceError);
    });
  });

  describe("the registry's three views", () => {

    test("device reaches every modeled record, hub only the hub-capable ones", () => {

      const { registry } = deviceFixture(accessBootstrap2026Fixture);

      assert.equal(registry.device(READER)?.id, READER);
      assert.equal(registry.hub(READER), undefined, "a reader drives no door, so there is no hub handle for it");
      assert.equal(registry.hub(HUB)?.id, HUB);
      assert.equal(registry.device("no-such-device"), undefined);
      assert.equal(registry.hub("no-such-device"), undefined);

      assert.deepEqual(registry.devices().map((device) => device.id).sort(), [...registry.devices()].map((device) => device.id).sort());
      assert.deepEqual(registry.hubs().map((hub) => hub.id).sort(), [ DOOR_MINI, "aabbcc000000", HUB ].sort());
    });

    test("handles are minted fresh per lookup rather than cached", () => {

      const { registry } = deviceFixture(accessBootstrap2026Fixture);

      assert.ok(!Object.is(registry.device(HUB), registry.device(HUB)), "a handle is a thin view, so identity across lookups is meaningless");
    });
  });

  describe("the device commands", () => {

    test("updateDevice writes a hub's settings under the hub collection and returns what the controller echoed", async () => {

      const fixture = deviceFixture(accessBootstrap2026Fixture);
      const echoed = { ...clone(fixture.store.snapshot().devices.get(HUB)), "alias": "Echoed" };

      intercept(fixture, { body: JSON.stringify(echoed), method: "PUT", path: "/proxy/access/api/v2/device/" + HUB + "/configs" });

      const hub = fixture.registry.device(HUB);

      assert.ok(hub);

      const result = await hub.updateDevice({ "alias": "Echoed" });

      assert.equal(fixture.captured[0]?.method, "PUT");
      assert.equal(fixture.captured[0].path, "/proxy/access/api/v2/device/" + HUB + "/configs");
      assert.deepEqual(JSON.parse(String(fixture.captured[0].body)), { "alias": "Echoed" });
      assert.equal(result.alias, "Echoed", "the echoed record reaches the caller");

      // Write-through: the echo is a convenience, not a second source of state, so the store is untouched by it.
      assert.equal(fixture.store.snapshot().devices.get(HUB)?.alias, "Test alias 13");
    });

    test("updateDevice writes a non-hub device's settings under the other collection", async () => {

      const fixture = deviceFixture(accessBootstrap2026Fixture);

      intercept(fixture, { body: JSON.stringify(clone(fixture.store.snapshot().devices.get(READER))), method: "PUT",
        path: "/proxy/access/api/v2/device/" + READER + "/settings" });

      const reader = fixture.registry.device(READER);

      assert.ok(reader);
      await reader.updateDevice({ "alias": "Renamed Reader" });

      // The suffix follows the device's live capability, and a reader is not hub-capable - the widened surface reaching any modeled device is the point here.
      assert.equal(fixture.captured[0]?.path, "/proxy/access/api/v2/device/" + READER + "/settings");
    });

    test("restart puts to the device's restart resource with an empty object body", async () => {

      const fixture = deviceFixture(accessBootstrap2026Fixture);

      intercept(fixture, { method: "PUT", path: "/proxy/access/api/v2/device/" + READER + "/restart" });

      const reader = fixture.registry.device(READER);

      assert.ok(reader);
      await reader.restart();

      assert.equal(fixture.captured[0]?.method, "PUT");
      assert.equal(fixture.captured[0].path, "/proxy/access/api/v2/device/" + READER + "/restart");

      // The body is present and empty, which is the opposite polarity from the close command below - both are asserted, because the difference is on the wire.
      assert.equal(String(fixture.captured[0].body), "{}");
    });

    test("a refusal the controller answers with a status surfaces as its classified error", async () => {

      const fixture = deviceFixture(accessBootstrap2026Fixture);

      intercept(fixture, { body: "forbidden", method: "PUT", path: "/proxy/access/api/v2/device/" + HUB + "/configs", status: 403 });

      const hub = fixture.registry.device(HUB);

      assert.ok(hub);
      await assert.rejects(() => hub.updateDevice({ "alias": "Nope" }), AccessAuthorizationError);
    });
  });

  describe("the hub commands", () => {

    test("unlock puts to the door's own resource with an empty object body", async () => {

      const fixture = deviceFixture(accessBootstrap2026Fixture);

      intercept(fixture, { method: "PUT", path: "/proxy/access/api/v2/location/" + DOOR_HUB + "/unlock" });

      const hub = fixture.registry.hub(HUB);

      assert.ok(hub);
      await hub.unlock();

      // The command addresses the door rather than the hardware, which is what lets one hub drive several doors independently.
      assert.equal(fixture.captured[0]?.method, "PUT");
      assert.equal(fixture.captured[0].path, "/proxy/access/api/v2/location/" + DOOR_HUB + "/unlock");
      assert.equal(String(fixture.captured[0].body), "{}");
    });

    test("close puts to the same resource with the control parameter and no body at all", async () => {

      const fixture = deviceFixture(accessBootstrap2026Fixture);

      intercept(fixture, { method: "PUT", path: "/proxy/access/api/v2/location/" + DOOR_HUB + "/unlock?control_cmd=close" });

      const hub = fixture.registry.hub(HUB);

      assert.ok(hub);
      await hub.close();

      assert.equal(fixture.captured[0]?.method, "PUT");
      assert.ok(fixture.captured[0].path.includes("control_cmd=close"));

      // Body ABSENCE is the claim, and it is asserted directly rather than inferred from the presence of one elsewhere.
      assert.equal(fixture.captured[0].body, undefined, "the close command carries no body at all");
    });

    test("each lock rule sends its own payload to the rule resource", async () => {

      const fixture = deviceFixture(accessBootstrap2026Fixture);
      const path = "/proxy/access/api/v2/device/" + HUB + "/lock_rule?get_result=true";

      for(let i = 0; i < 3; i++) {

        intercept(fixture, { method: "PUT", path });
      }

      const hub = fixture.registry.hub(HUB);

      assert.ok(hub);

      await hub.setLockRule({ type: "reset" });
      await hub.setLockRule({ type: "keep_unlock" });

      // The valid-custom case is the validator's other polarity: a well-formed interval passes the guard and reaches the wire.
      await hub.setLockRule({ interval: 30, type: "custom" });

      assert.deepEqual(fixture.captured.map((request) => request.method), [ "PUT", "PUT", "PUT" ]);
      assert.deepEqual(fixture.captured.map((request) => String(request.body)),
        [ JSON.stringify({ type: "reset" }), JSON.stringify({ type: "keep_unlock" }), JSON.stringify({ interval: 30, type: "custom" }) ]);
    });

    test("a custom rule whose interval is not a positive whole number is refused before anything is sent", async () => {

      const fixture = deviceFixture(accessBootstrap2026Fixture);
      const hub = fixture.registry.hub(HUB);

      assert.ok(hub);

      // A caller's own bad argument is a programming error, so it raises the language's own type rather than the library's request error, which exists to carry a
      // status the controller answered with. No request is registered, so a dispatched one would fail the mock agent's own net-connect guard.
      const rejected = [ 0, -5, 1.5, Number.NaN, Number.POSITIVE_INFINITY ].map((interval) => assert.rejects(() => hub.setLockRule({ interval, type: "custom" }),
        TypeError));

      await Promise.all(rejected);

      assert.equal(fixture.captured.length, 0, "nothing reached the wire");
    });

    test("a refusal inside a 200 body throws, carrying the status the controller answered with", async () => {

      const fixture = deviceFixture(accessBootstrap2026Fixture);

      intercept(fixture, { body: REFUSED, method: "PUT", path: "/proxy/access/api/v2/location/" + DOOR_HUB + "/unlock" });

      const hub = fixture.registry.hub(HUB);

      assert.ok(hub);

      await assert.rejects(() => hub.unlock(), (error: unknown) => {

        assert.ok(error instanceof AccessRequestError);

        // The status is the response's real one - the controller answered, and what it said is the refusal in the envelope.
        assert.equal(error.statusCode, 200);

        return true;
      });
    });

    test("a 200 carrying no envelope at all is a protocol error rather than a quiet success", async () => {

      const fixture = deviceFixture(accessBootstrap2026Fixture);

      /* A controller that answers a command with 200 and an empty body has reported a status and nothing about the outcome, and the one thing a door command must
       * never do is resolve on that. The envelope read is where it surfaces, as the typed protocol error the caller catches by class - and the rejection being
       * typed is also what shows nothing escaped as an unhandled one.
       */
      intercept(fixture, { body: "", method: "PUT", path: "/proxy/access/api/v2/location/" + DOOR_HUB + "/unlock" });

      const hub = fixture.registry.hub(HUB);

      assert.ok(hub);

      await assert.rejects(() => hub.unlock(), AccessProtocolError);
    });

    test("every door command reads the envelope, so a refusal inside a 200 throws whichever one drew it", async () => {

      /* The three door commands share one reading of the result envelope, and this is what that sharing is worth: a refusal is reported identically whichever
       * command met it, rather than each command having its own idea of what the controller's answer meant.
       */
      const fixture = deviceFixture(accessBootstrap2026Fixture);

      intercept(fixture, { body: REFUSED, method: "PUT", path: "/proxy/access/api/v2/location/" + DOOR_HUB + "/unlock?control_cmd=close" });
      intercept(fixture, { body: REFUSED, method: "PUT", path: "/proxy/access/api/v2/device/" + HUB + "/lock_rule?get_result=true" });

      const hub = fixture.registry.hub(HUB);

      assert.ok(hub);

      for(const command of [ (): Promise<void> => hub.close(), (): Promise<void> => hub.setLockRule({ type: "reset" }) ]) {

        // eslint-disable-next-line no-await-in-loop
        await assert.rejects(command, (error: unknown) => {

          assert.ok(error instanceof AccessRequestError);
          assert.equal(error.statusCode, 200);
          assert.equal(error.message, "The UniFi Access controller refused the door command.");

          return true;
        });
      }
    });

    test("a successful envelope resolves each door command quietly", async () => {

      // The other polarity of the same check: the commands are not merely throwing on everything, they are reading the verdict the envelope carries.
      const fixture = deviceFixture(accessBootstrap2026Fixture);

      intercept(fixture, { method: "PUT", path: "/proxy/access/api/v2/location/" + DOOR_HUB + "/unlock" });
      intercept(fixture, { method: "PUT", path: "/proxy/access/api/v2/location/" + DOOR_HUB + "/unlock?control_cmd=close" });
      intercept(fixture, { method: "PUT", path: "/proxy/access/api/v2/device/" + HUB + "/lock_rule?get_result=true" });

      const hub = fixture.registry.hub(HUB);

      assert.ok(hub);

      await hub.unlock();
      await hub.close();
      await hub.setLockRule({ type: "reset" });

      assert.equal(fixture.captured.length, 3);
    });

    test("updateDevice is exempt, because its endpoint answers the record rather than an envelope", async () => {

      /* The device-settings endpoint does not wrap its answer, so there is no verdict to read: what comes back is the device record itself. A body that would read
       * as a refusal anywhere else is simply not an envelope here, and it reaches the caller as the echoed record rather than throwing.
       */
      const fixture = deviceFixture(accessBootstrap2026Fixture);

      intercept(fixture, { body: REFUSED, method: "PUT", path: "/proxy/access/api/v2/device/" + HUB + "/configs" });

      const hub = fixture.registry.hub(HUB);

      assert.ok(hub);

      const echoed = await hub.updateDevice({ "alias": "Echoed" });

      assert.equal(Object.hasOwn(echoed, "codeS"), true, "whatever the endpoint answered is what the caller receives");
    });

    test("restart reads the envelope, resolving on the shape a live restart answers with", async () => {

      /* The body here is what a real device restart answered on 2026-08-16, verbatim: the same result envelope the door commands read, with a success code inside a
       * 200. That is what makes reading it correct rather than presumptuous.
       */
      const fixture = deviceFixture(accessBootstrap2026Fixture);

      intercept(fixture, { body: JSON.stringify({ "code": 1, "codeS": "SUCCESS", "data": "success", "error": "", "msg": "success" }), method: "PUT",
        path: "/proxy/access/api/v2/device/" + READER + "/restart" });

      const reader = fixture.registry.device(READER);

      assert.ok(reader);
      await reader.restart();

      assert.equal(fixture.captured[0]?.path, "/proxy/access/api/v2/device/" + READER + "/restart");
    });

    test("restart throws when the envelope refuses inside a 200, carrying the status the controller answered with", async () => {

      // The other polarity. A restart the controller declined is a failure the caller has to see, and before the envelope was read it would have resolved as though
      // the device were rebooting.
      const fixture = deviceFixture(accessBootstrap2026Fixture);

      intercept(fixture, { body: REFUSED, method: "PUT", path: "/proxy/access/api/v2/device/" + READER + "/restart" });

      const reader = fixture.registry.device(READER);

      assert.ok(reader);

      await assert.rejects(async () => reader.restart(), (error: unknown) => {

        assert.ok(error instanceof AccessRequestError);
        assert.equal(error.statusCode, 200);
        assert.equal(error.message, "The UniFi Access controller refused the device restart.");

        return true;
      });
    });

    test("unlocks the door the caller named rather than the hub's own", async () => {

      /* The named door has to reach the URL itself, which is the half a change threading the target into the routed request alone would miss - the direct
       * expression builds its own endpoint. The id is another of the fixture's doors, so a resolution that ignored the target would address a visibly different one
       * and find no interceptor waiting.
       */
      const fixture = deviceFixture(accessBootstrap2026Fixture);

      intercept(fixture, { method: "PUT", path: "/proxy/access/api/v2/location/" + DOOR_MINI_DOOR + "/unlock" });

      const hub = fixture.registry.hub(HUB);

      assert.ok(hub);
      assert.notEqual(DOOR_MINI_DOOR, hub.doorId, "the target names a different door from the one this handle resolves for itself");
      await hub.unlock({ doorId: DOOR_MINI_DOOR });

      assert.equal(fixture.captured[0]?.path, "/proxy/access/api/v2/location/" + DOOR_MINI_DOOR + "/unlock");
      assert.equal(String(fixture.captured[0].body), "{}", "and the unlock's own body is what it always is");
    });

    test("closes the door the caller named rather than the hub's own", async () => {

      const fixture = deviceFixture(accessBootstrap2026Fixture);

      intercept(fixture, { method: "PUT", path: "/proxy/access/api/v2/location/" + DOOR_MINI_DOOR + "/unlock?control_cmd=close" });

      const hub = fixture.registry.hub(HUB);

      assert.ok(hub);
      assert.notEqual(DOOR_MINI_DOOR, hub.doorId, "the target names a different door from the one this handle resolves for itself");
      await hub.close({ doorId: DOOR_MINI_DOOR });

      assert.equal(fixture.captured[0]?.path, "/proxy/access/api/v2/location/" + DOOR_MINI_DOOR + "/unlock?control_cmd=close");
      assert.equal(fixture.captured[0].body, undefined, "and the body-absent shape of a close is untouched by naming a door");
    });

    test("sends a lock rule naming this hub's own door to the direct resource, exactly as the untargeted call does", async () => {

      /* The one row here whose target is the hub's own door, deliberately: what decides the direct path is the door the target resolves to rather than whether a
       * target was named at all, so a caller spelling out the door this handle would have chosen reaches the same device-keyed resource with the same bytes.
       */
      const fixture = deviceFixture(accessBootstrap2026Fixture);
      const path = "/proxy/access/api/v2/device/" + HUB + "/lock_rule?get_result=true";

      intercept(fixture, { method: "PUT", path });

      const hub = fixture.registry.hub(HUB);

      assert.ok(hub);
      await hub.setLockRule({ interval: 2, type: "custom" }, { doorId: hub.doorId });

      assert.equal(fixture.captured[0]?.path, path);
      assert.equal(String(fixture.captured[0].body), JSON.stringify({ interval: 2, type: "custom" }));
    });

    test("refuses a lock rule aimed at another door on a client holding no official path", async () => {

      /* The direct rule resource is keyed by the device, so it governs the door that device resolves for itself and can say nothing about any other one. A rule
       * aimed elsewhere therefore has no direct expression to fall back on, and a client holding nothing else refuses it rather than writing it to the wrong door.
       */
      const fixture = deviceFixture(accessBootstrap2026Fixture);
      const hub = fixture.registry.hub(HUB);

      assert.ok(hub);
      assert.notEqual(DOOR_MINI_DOOR, hub.doorId, "the target names a different door from the one this handle resolves for itself");
      await assert.rejects(async () => hub.setLockRule({ interval: 2, type: "custom" }, { doorId: DOOR_MINI_DOOR }), AccessCapabilityError);

      assert.equal(fixture.captured.length, 0, "and nothing reached the direct transport, which could only have addressed this device's own door");
    });

    test("each door command still fails loudly on a handle whose device has left the state, named target or not", async () => {

      /* Every verb reads the handle's own door before it does anything else, and that read is what asserts the record is still there. A caller naming a target must
       * not be able to route around it, so each verb is issued with one after the device is gone.
       */
      const fixture = deviceFixture(accessBootstrap2026Fixture);
      const hub = fixture.registry.hub(HUB);

      assert.ok(hub);

      fixture.store.dispatch({ eventName: "access.data.v2.device.delete", id: HUB, kind: "deviceRemoved" });

      const commands: { issue: () => Promise<void>; verb: string }[] = [
        { issue: async (): Promise<void> => hub.unlock({ doorId: DOOR_MINI_DOOR }), verb: "unlock" },
        { issue: async (): Promise<void> => hub.close({ doorId: DOOR_MINI_DOOR }), verb: "close" },
        { issue: async (): Promise<void> => hub.stop({ doorId: DOOR_MINI_DOOR }), verb: "stop" },
        { issue: async (): Promise<void> => hub.setLockRule({ type: "reset" }, { doorId: DOOR_MINI_DOOR }), verb: "setLockRule" }
      ];

      for(const command of commands) {

        // eslint-disable-next-line no-await-in-loop
        await assert.rejects(command.issue, ReferenceError, command.verb + " reads the departed record before anything the caller supplied can matter");
      }

      // A caller's own bad argument still comes first of all, ahead of that read: a malformed interval is a TypeError whether or not the record is still there.
      await assert.rejects(async () => hub.setLockRule({ interval: 0.5, type: "custom" }, { doorId: DOOR_MINI_DOOR }), TypeError);

      assert.equal(fixture.captured.length, 0, "and none of it reached a transport");
    });
  });

  describe("the hub commands under routing", () => {

    /* What each path puts on the wire, asserted per path. The direct bodies here are the same bytes the direct-path rows above assert, which is the point: routing
     * chooses between two expressions of a command and changes neither of them.
     */
    /* The record shape carries a name of its own so that the factory below still declares its return type on one line - spelling the widened unlock options out
     * inline pushes the annotation past the arrow, which is the linebreak the arrow-linebreak rule refuses.
     */
    interface RoutedOfficialCalls {

      lockRules: { call: AccessOfficialCallOptions | undefined; id: string; rule: unknown }[];
      unlocks: { call: AccessOfficialCallOptions | undefined; id: string; opts: AccessOfficialDoorUnlockOptions | undefined }[];
    }

    const officialCalls = (): RoutedOfficialCalls => ({ lockRules: [], unlocks: [] });

    function routedFixture(options: { override?: AccessApiOverride;
      refuse?: () => Error; } = {}): ReturnType<typeof deviceFixture> & { official: ReturnType<typeof officialCalls> } {

      const fixture = deviceFixture(accessBootstrap2026Fixture);
      const calls = officialCalls();
      const routing = new AccessRoutingService({

        capabilities: { mode: "dual", official: true, override: options.override ?? "auto" },
        official: {

          spaces: {

            setLockRule: async (id: string, rule: unknown, call?: AccessOfficialCallOptions): Promise<void> => {

              if(options.refuse !== undefined) {

                throw options.refuse();
              }

              calls.lockRules.push({ call, id, rule });
            },
            unlock: async (id: string, opts?: AccessOfficialDoorUnlockOptions, call?: AccessOfficialCallOptions): Promise<void> => {

              if(options.refuse !== undefined) {

                throw options.refuse();
              }

              calls.unlocks.push({ call, id, opts });
            }
          }
        },
        store: fixture.store
      });

      return { ...fixture, ctx: { ...fixture.ctx, routing }, official: calls,
        registry: new AccessDeviceRegistry({ ...fixture.ctx, routing }) };
    }

    test("sends a plain unlock down the official path, addressed by door", async () => {

      const fixture = routedFixture();
      const hub = fixture.registry.hub(HUB);

      assert.ok(hub);
      await hub.unlock();

      assert.deepEqual(fixture.official.unlocks, [{ call: {}, id: DOOR_HUB, opts: {} }]);
      assert.equal(fixture.captured.length, 0, "nothing went out on the direct path");
    });

    test("carries an actor onto the official call", async () => {

      const fixture = routedFixture();
      const hub = fixture.registry.hub(HUB);

      assert.ok(hub);
      await hub.unlock({ actor: { id: "a1", name: "Nightly Automation" } });

      assert.deepEqual(fixture.official.unlocks, [{ call: {}, id: DOOR_HUB, opts: { actor: { id: "a1", name: "Nightly Automation" } } }]);
    });

    test("falls back to the direct path's own body when the device sits below the endpoint's firmware floor", async () => {

      /* The floor case end to end: the official path is attempted first, refused for this device, and the direct expression is what the door actually receives -
       * byte for byte the same request the direct-path row above asserts.
       */
      const fixture = routedFixture({ refuse: () => new AccessOfficialApiError("too old", { code: "CODE_DEVICE_API_NOT_SUPPORTED" }) });

      intercept(fixture, { method: "PUT", path: "/proxy/access/api/v2/location/" + DOOR_HUB + "/unlock" });

      const hub = fixture.registry.hub(HUB);

      assert.ok(hub);
      await hub.unlock();

      assert.deepEqual(fixture.official.unlocks, [], "the official attempt was refused rather than recorded");
      assert.equal(fixture.captured[0]?.method, "PUT");
      assert.equal(fixture.captured[0].path, "/proxy/access/api/v2/location/" + DOOR_HUB + "/unlock");
      assert.equal(String(fixture.captured[0].body), "{}");
    });

    test("routes each lock rule by what its own path can express", async () => {

      const fixture = routedFixture();
      const hub = fixture.registry.hub(HUB);

      assert.ok(hub);

      await hub.setLockRule({ interval: 2, type: "custom" });
      await hub.setLockRule({ type: "lock_now" });

      // Both took the official path, addressed by door, with the rule carried through unchanged in each case.
      assert.deepEqual(fixture.official.lockRules,
        [ { call: {}, id: DOOR_HUB, rule: { interval: 2, type: "custom" } }, { call: {}, id: DOOR_HUB, rule: { type: "lock_now" } } ]);
    });

    test("sends the direct lock rule's proven bytes when the official path refuses the device", async () => {

      const fixture = routedFixture({ refuse: () => new AccessOfficialApiError("too old", { code: "CODE_DEVICE_API_NOT_SUPPORTED" }) });

      intercept(fixture, { method: "PUT", path: "/proxy/access/api/v2/device/" + HUB + "/lock_rule?get_result=true" });

      const hub = fixture.registry.hub(HUB);

      assert.ok(hub);
      await hub.setLockRule({ interval: 2, type: "custom" });

      // The direct wire shape is unchanged by routing: the same device-keyed resource and the same body the direct-path rows assert.
      assert.equal(fixture.captured[0]?.path, "/proxy/access/api/v2/device/" + HUB + "/lock_rule?get_result=true");
      assert.equal(String(fixture.captured[0].body), JSON.stringify({ interval: 2, type: "custom" }));
    });

    test("refuses an official-only rule outright when the device is floor-refused and no direct expression exists", async () => {

      const fixture = routedFixture({ refuse: () => new AccessOfficialApiError("too old", { code: "CODE_DEVICE_API_NOT_SUPPORTED" }) });
      const hub = fixture.registry.hub(HUB);

      assert.ok(hub);
      await assert.rejects(async () => hub.setLockRule({ type: "lock_now" }), AccessCapabilityError);
      assert.equal(fixture.captured.length, 0, "and nothing reached the direct path, which cannot express it");
    });

    test("closes on the direct path even where the official one is preferred", async () => {

      const fixture = routedFixture();

      intercept(fixture, { method: "PUT", path: "/proxy/access/api/v2/location/" + DOOR_HUB + "/unlock?control_cmd=close" });

      const hub = fixture.registry.hub(HUB);

      assert.ok(hub);
      await hub.close();

      const captured = fixture.captured[0];

      assert.ok(captured);
      assert.ok(captured.path.includes("control_cmd=close"));
      assert.equal(captured.body, undefined, "and the close command's body-absent shape is untouched by routing");
    });

    test("refuses the direct-only commands outright on a client held to the official API", async () => {

      // The override reaches the projections whole: a command that channel cannot express is refused where it is issued, before the direct transport sees it.
      const fixture = routedFixture({ override: "official-only" });
      const hub = fixture.registry.hub(HUB);

      assert.ok(hub);

      const commands: { issue: () => Promise<unknown>; operation: RegExp }[] = [
        { issue: async (): Promise<unknown> => hub.restart(), operation: /a device restart/ },
        { issue: async (): Promise<unknown> => hub.updateDevice({}), operation: /a device configuration write/ }
      ];

      for(const command of commands) {

        // eslint-disable-next-line no-await-in-loop
        await assert.rejects(command.issue, (error: unknown) => {

          assert.ok(error instanceof AccessCapabilityError);
          assert.match(error.message, command.operation, "the message names the operation");
          assert.match(error.message, /held to the official API/, "and the override that left it nowhere to go");

          return true;
        });
      }

      assert.equal(fixture.captured.length, 0, "nothing reached the direct transport");
    });

    test("closes through the official gate control command on a client held away from the direct path", async () => {

      // The override leaves no direct expression, and the published API's own control command is what carries the close instead.
      const fixture = routedFixture({ override: "official-only" });
      const hub = fixture.registry.hub(HUB);

      assert.ok(hub);
      await hub.close();

      assert.deepEqual(fixture.official.unlocks, [{ call: {}, id: DOOR_HUB, opts: { controlCmd: "close" } }]);
      assert.equal(fixture.captured.length, 0, "nothing went out on the direct path");
    });

    test("halts a gate with the stop control command, which has no direct expression at all", async () => {

      const fixture = routedFixture();
      const hub = fixture.registry.hub(HUB);

      assert.ok(hub);
      await hub.stop();

      assert.deepEqual(fixture.official.unlocks, [{ call: {}, id: DOOR_HUB, opts: { controlCmd: "stop" } }]);
      assert.equal(fixture.captured.length, 0, "a stop reaches the official path or nothing at all");
    });

    test("carries an entry direction onto the official call", async () => {

      const fixture = routedFixture();
      const hub = fixture.registry.hub(HUB);

      assert.ok(hub);
      await hub.unlock({ entryMethod: "out" });

      assert.deepEqual(fixture.official.unlocks, [{ call: {}, id: DOOR_HUB, opts: { entryMethod: "out" } }]);
      assert.equal(fixture.captured.length, 0, "the direct endpoint cannot say which approach was taken, so it was never offered");
    });

    test("validates a custom interval before routing decides anything", async () => {

      // The caller's own bad argument is caught ahead of the routing decision, so a malformed rule reaches neither path.
      const fixture = routedFixture();
      const hub = fixture.registry.hub(HUB);

      assert.ok(hub);
      await assert.rejects(async () => hub.setLockRule({ interval: 0.5, type: "custom" }), TypeError);

      assert.deepEqual(fixture.official.lockRules, []);
      assert.equal(fixture.captured.length, 0);
    });

    test("carries a named door onto the official call beside an actor and an entry direction", async () => {

      /* All three options travel on one unlock: the target is the door the call addresses, while the other two travel in the payload beside it. A change that
       * threaded one of them through at the cost of another shows here rather than in the rows that exercise each alone.
       */
      const fixture = routedFixture();
      const hub = fixture.registry.hub(HUB);

      assert.ok(hub);
      assert.notEqual(DOOR_MINI_DOOR, hub.doorId, "the target names a different door from the one this handle resolves for itself");
      await hub.unlock({ actor: { id: "a1", name: "Nightly Automation" }, doorId: DOOR_MINI_DOOR, entryMethod: "out" });

      assert.deepEqual(fixture.official.unlocks,
        [{ call: {}, id: DOOR_MINI_DOOR, opts: { actor: { id: "a1", name: "Nightly Automation" }, entryMethod: "out" } }]);
      assert.equal(fixture.captured.length, 0, "nothing went out on the direct path");
    });

    test("closes a named door through the official gate control command on a client with no direct path", async () => {

      const fixture = routedFixture({ override: "official-only" });
      const hub = fixture.registry.hub(HUB);

      assert.ok(hub);
      assert.notEqual(DOOR_MINI_DOOR, hub.doorId, "the target names a different door from the one this handle resolves for itself");
      await hub.close({ doorId: DOOR_MINI_DOOR });

      assert.deepEqual(fixture.official.unlocks, [{ call: {}, id: DOOR_MINI_DOOR, opts: { controlCmd: "close" } }]);
      assert.equal(fixture.captured.length, 0, "nothing went out on the direct path");
    });

    test("halts a named door's gate with the stop control command", async () => {

      const fixture = routedFixture();
      const hub = fixture.registry.hub(HUB);

      assert.ok(hub);
      assert.notEqual(DOOR_MINI_DOOR, hub.doorId, "the target names a different door from the one this handle resolves for itself");
      await hub.stop({ doorId: DOOR_MINI_DOOR });

      assert.deepEqual(fixture.official.unlocks, [{ call: {}, id: DOOR_MINI_DOOR, opts: { controlCmd: "stop" } }]);
      assert.equal(fixture.captured.length, 0, "a stop reaches the official path or nothing at all");
    });

    test("puts a lock rule aimed at another door on the official path alone, whichever verb it is", async () => {

      /* The direct rule resource addresses the device rather than the door, so a rule naming a different door has no direct expression even when its verb is one
       * the direct endpoint speaks. Both rules here take the official path, addressed by the door the caller named.
       */
      const fixture = routedFixture();
      const hub = fixture.registry.hub(HUB);

      assert.ok(hub);
      assert.notEqual(DOOR_MINI_DOOR, hub.doorId, "the target names a different door from the one this handle resolves for itself");

      await hub.setLockRule({ interval: 2, type: "custom" }, { doorId: DOOR_MINI_DOOR });
      await hub.setLockRule({ type: "lock_now" }, { doorId: DOOR_MINI_DOOR });

      assert.deepEqual(fixture.official.lockRules,
        [ { call: {}, id: DOOR_MINI_DOOR, rule: { interval: 2, type: "custom" } }, { call: {}, id: DOOR_MINI_DOOR, rule: { type: "lock_now" } } ]);
      assert.equal(fixture.captured.length, 0, "and the device-keyed direct resource was never reached");
    });

    describe("the caller's abort signal", () => {

      test("threads the caller's signal through the official unlock", async () => {

        const fixture = routedFixture();
        const hub = fixture.registry.hub(HUB);
        const controller = new AbortController();

        assert.ok(hub);
        await hub.unlock({ signal: controller.signal });

        assert.deepEqual(fixture.official.unlocks, [{ call: { signal: controller.signal }, id: DOOR_HUB, opts: {} }]);
        assert.equal(fixture.captured.length, 0, "nothing went out on the direct path");

        // Two unaborted signals compare equal under deepEqual, so the identity check is what rules out a stand-in minted somewhere along the way.
        assert.equal(fixture.official.unlocks[0]?.call?.signal, controller.signal, "and the official call holds the caller's own signal");
      });

      test("threads the caller's signal through a gate stop", async () => {

        const fixture = routedFixture();
        const hub = fixture.registry.hub(HUB);
        const controller = new AbortController();

        assert.ok(hub);
        await hub.stop({ signal: controller.signal });

        assert.deepEqual(fixture.official.unlocks, [{ call: { signal: controller.signal }, id: DOOR_HUB, opts: { controlCmd: "stop" } }]);
        assert.equal(fixture.official.unlocks[0]?.call?.signal, controller.signal, "and the official call holds the caller's own signal");
      });
    });
  });

  describe("the door record through a hub", () => {

    test("each hub answers its own door's record, and nothing where the state holds none", () => {

      const { registry, store } = deviceFixture(accessBootstrap2026Fixture);
      const hub = registry.hub(HUB);
      const mini = registry.hub(DOOR_MINI);

      assert.ok(hub && mini);

      /* The handles drive different doors and the state holds more doors than there are handles, so a getter answering with any present door rather than with the
       * one this handle drives could not satisfy both readings. The size assertion is what keeps that condition from quietly lapsing under a fixture edit.
       */
      assert.equal(store.snapshot().doors.size, 3);
      assert.equal(hub.door?.unique_id, DOOR_HUB);
      assert.equal(hub.door?.name, "Test Name 10");
      assert.equal(hub.door?.full_name, "Test Name 11");
      assert.equal(mini.door?.unique_id, DOOR_MINI_DOOR);
      assert.equal(mini.door?.name, "Test Name 22");
      assert.equal(mini.door?.full_name, "Test Name 23");

      // An enumerating census that no longer names one hub's door takes it out of the collection, which is the state a handle whose door was never censused is
      // in: the handle is still there and the record behind it is not.
      store.applyCensus({ devices: [], doorStates: [],
        doors: accessOfficialDoorsFixture.filter((entry) => entry.id === DOOR_MINI_DOOR).map(officialDoorRecord) }, { complete: true });

      assert.equal(hub.door, undefined, "the door the census dropped reads as absent rather than as some other door");
      assert.equal(mini.door?.unique_id, DOOR_MINI_DOOR, "while the door it did name is untouched");
    });
  });

  describe("door state through a hub", () => {

    test("reads the door's entry, seeded from the topology and then replaced by what the door reports", () => {

      const { registry, store } = deviceFixture(accessBootstrap2026Fixture);
      const hub = registry.hub(HUB);

      assert.ok(hub);

      const before = hub.doorState;

      assert.equal(before?.lock, "locked", "the topology's own flags established a lock at rest");
      assert.equal(before.location_id, DOOR_HUB);

      store.dispatch(doorStateEvent(DOOR_HUB, "unlocked"));

      const reported = hub.doorState;

      assert.equal(reported?.lock, "unlocked");
      assert.equal(reported?.location_id, DOOR_HUB, "the hub resolved its own door rather than the consumer having to");

      // A second single-door hub in the same topology resolves its own door and reads nothing from the first one's report, which is what shows the resolution is
      // per-handle rather than incidental.
      const mini = registry.hub(DOOR_MINI);

      assert.ok(mini);
      assert.equal(mini.config.location_id, DOOR_MINI_DOOR);
      assert.equal(mini.doorState?.lock, "locked", "the other hub's door still shows what its own hardware established");
      assert.equal(mini.doorState?.location_id, DOOR_MINI_DOOR);
    });

    test("an entry whose optional member is malformed leaves the previously stored one standing", () => {

      const { registry, store } = deviceFixture(accessBootstrap2026Fixture);
      const hub = registry.hub(HUB);

      assert.ok(hub);

      store.dispatch(doorStateEvent(DOOR_HUB, "unlocked"));

      const clean = hub.doorState;

      assert.equal(clean?.lock, "unlocked");

      /* Both optional members, each unreadable on its own predicate, sent through the classifier rather than hand-built into the store - which is the point: an
       * unreadable report never becomes an entry at all, so the last clean reading stands rather than being replaced by a partial one.
       */
      for(const malformed of [ { "alarms": "not-an-array" }, { "unlock_suspend": { "status": 42, "unlock_type": "" } } ]) {

        const packet = wirePacket(DOOR_HUB, "locked", malformed);

        assert.equal(classifyPacket(packet)?.kind, "deviceChanged", "the malformed report is not a door-state event at all");
      }

      const afterMalformed = hub.doorState;

      assert.equal(afterMalformed?.lock, "unlocked", "the last clean reading still stands");

      // A well-formed report does advance it, which is what shows the rejections above are the guard working rather than the door being unreachable.
      store.dispatch(doorStateEvent(DOOR_HUB, "locked"));

      assert.equal(hub.doorState?.lock, "locked");
    });
  });

  describe("the Enterprise Access Hub port matrix", () => {

    test("every port surfaces as its own handle while the whole-hub record is withheld from the hub views", () => {

      const { registry } = deviceFixture(accessBootstrapEahFixture);
      const points = registry.accessPoints();

      assert.equal(points.length, 8, "one handle per door-serving port");
      assert.ok(points.every((point) => point.id !== EAH_HUB), "no handle carries the whole hub's identity");

      // The two hub accessors share one predicate, so both must withhold the record - and both are asserted, because a consumer can arrive through either.
      assert.equal(registry.hub(EAH_HUB), undefined, "the whole-hub record answers no hub handle");
      assert.ok(!registry.hubs().some((hub) => hub.id === EAH_HUB), "and it is absent from the collection too");

      // It stays fully reachable for configuration, which is what makes the withholding a routing decision rather than a hidden record.
      assert.equal(registry.device(EAH_HUB)?.id, EAH_HUB);
      assert.equal(registry.device(EAH_HUB)?.config.device_type, "UAH-Ent");

      assert.equal(registry.accessPoint(EAH_PORT_2)?.id, EAH_PORT_2);
      assert.equal(registry.accessPoint("no-such-port"), undefined);
    });

    test("two ports' unlocks address two different doors", async () => {

      const fixture = deviceFixture(accessBootstrapEahFixture);
      const port2 = fixture.registry.accessPoint(EAH_PORT_2);
      const port3 = fixture.registry.accessPoint(EAH_PORT_3);

      assert.ok(port2 && port3);

      const door2 = port2.config.location_id;
      const door3 = port3.config.location_id;

      assert.equal(door2, EAH_DOOR_2);
      assert.notEqual(door2, door3, "the two ports serve different doors");

      intercept(fixture, { method: "PUT", path: "/proxy/access/api/v2/location/" + door2 + "/unlock" });
      intercept(fixture, { method: "PUT", path: "/proxy/access/api/v2/location/" + door3 + "/unlock" });

      await port2.unlock();
      await port3.unlock();

      // The synthesized record carries the port's own door and no extensions, so each handle resolves to its own door by construction.
      assert.deepEqual(fixture.captured.map((request) => request.path),
        [ "/proxy/access/api/v2/location/" + door2 + "/unlock", "/proxy/access/api/v2/location/" + door3 + "/unlock" ]);
    });

    test("a port's device-scoped command keys on the port's own identity", async () => {

      const fixture = deviceFixture(accessBootstrapEahFixture);
      const port2 = fixture.registry.accessPoint(EAH_PORT_2);

      assert.ok(port2);
      assert.equal(port2.config.unique_id, EAH_PORT_2, "the handle reads the synthesized record rather than the hub's");

      intercept(fixture, { method: "PUT", path: "/proxy/access/api/v2/device/" + EAH_PORT_2 + "/lock_rule?get_result=true" });

      await port2.setLockRule({ type: "reset" });

      assert.ok(fixture.captured[0]?.path.startsWith("/proxy/access/api/v2/device/" + EAH_PORT_2 + "/"));
    });

    test("each port handle reads its own door's state and not a sibling's", () => {

      const { registry, store } = deviceFixture(accessBootstrapEahFixture);
      const port2 = registry.accessPoint(EAH_PORT_2);
      const port3 = registry.accessPoint(EAH_PORT_3);

      assert.ok(port2 && port3);

      const door2 = port2.config.location_id;
      const door3 = port3.config.location_id;

      // Two doors reporting different states, so reading one handle's state cannot accidentally satisfy the other's assertion.
      store.dispatch(doorStateEvent(door2, "unlocked"));
      store.dispatch(doorStateEvent(door3, "locked"));

      assert.equal(port2.doorState?.lock, "unlocked");
      assert.equal(port2.doorState?.location_id, door2);
      assert.equal(port3.doorState?.lock, "locked");
      assert.equal(port3.doorState?.location_id, door3);
    });

    test("a port handle observes through the expansion and survives an unrelated device's change", async () => {

      const { registry, store } = deviceFixture(accessBootstrapEahFixture);
      const port2 = registry.accessPoint(EAH_PORT_2);

      assert.ok(port2);

      const ac = new AbortController();
      const seen: string[] = [];
      const done = (async (): Promise<void> => {

        for await (const updated of port2.observe({ signal: ac.signal })) {

          seen.push(updated.config.ip ?? "");
        }
      })();

      await delay(0);

      // A device that is not this port's hub changes: the port's own record is rebuilt from an unchanged hub record, so its observer must stay asleep.
      store.dispatch({ eventName: "access.data.device.update", id: "aabbcc000008", kind: "deviceChanged", payload: { "ip": "172.16.9.9" } });
      await delay(5);
      assert.equal(seen.length, 0, "an unrelated device must not wake a port handle");

      // Its own hub changing does wake it.
      store.dispatch({ eventName: "access.data.device.update", id: EAH_HUB, kind: "deviceChanged", payload: { "ip": "172.16.9.8" } });
      await expectAt(() => seen.length === 1);
      assert.deepEqual(seen, ["172.16.9.8"]);

      ac.abort();
      await done;
    });

    /* The uplink assertions live beside the port matrix because the port is what makes the question hard. Every other record answers it out of its own fields; a
     * synthesized port cannot, so the whole classification is asserted here against real synthesis and against the captured devices that give it its contrast.
     */
    test("a synthesized port reports no uplink, and neither does the hub whose hardware it is", () => {

      const { registry } = deviceFixture(accessBootstrapEahFixture);
      const points = registry.accessPoints();

      assert.equal(points.length, 8, "one handle per door-serving port");

      // Each port record inherits the hub's own self-referential uplink field beside an identifier of its own, so reading that field raw would report every
      // port as attached to the hub it is part of.
      assert.ok(points.every((point) => point.uplinkId === null), "a port is hub hardware wearing a port's identity, so nothing carries it");

      // The whole-hub record is the same fact from the other side: the controller writes its uplink as a reference to itself.
      assert.equal(registry.device(EAH_HUB)?.uplinkId, null);
    });

    test("a device reports the identifier of the hub that carries it", () => {

      const { registry } = deviceFixture(accessBootstrap2026Fixture);

      // Captured material rather than a constructed case - the reader on this door genuinely runs its uplink through the hub beside it.
      assert.equal(registry.device(READER)?.uplinkId, HUB);
      assert.equal(registry.device(HUB)?.uplinkId, null, "the hub connects in its own right");
    });

    test("an empty uplink field reads as a device that connects in its own right", () => {

      const bootstrap = clone(accessBootstrap2026Fixture);
      const group = bootstrap.floors?.[0]?.doors?.[1]?.device_groups?.[0];
      const reader = group?.[1];

      assert.ok(group && reader);
      assert.equal(reader.unique_id, READER);

      // The controller spells the same thing two ways, and no capture carries the empty spelling - so this one is constructed.
      group[1] = { ...reader, "connected_uah_id": "" };

      const { registry } = deviceFixture(bootstrap);

      assert.equal(registry.device(READER)?.uplinkId, null);
    });

    test("a hub-capable device still reports the device that carries it", () => {

      const bootstrap = clone(accessBootstrap2026Fixture);
      const group = bootstrap.floors?.[0]?.doors?.[1]?.device_groups?.[0];
      const hub = group?.[0];

      assert.ok(group && hub);
      assert.equal(hub.unique_id, HUB);
      assert.ok(hub.capabilities.includes("is_hub"), "this assertion needs a record the controller marks hub-capable");

      group[0] = { ...hub, "connected_uah_id": DOOR_MINI };

      const { registry } = deviceFixture(bootstrap);

      // Hub capability is not the question. A port is exempt because of how it came to exist, not because of what it can do, and every port inherits its hub's
      // capabilities through the expansion - so classifying on capability would pass every other assertion here and fail this one.
      assert.equal(registry.device(HUB)?.uplinkId, DOOR_MINI);
    });
  });
});

describe("a projection over a token-only client's census", () => {

  /* The tier running in the mode it never ran in before: a context with no transport at all, over a store seeded from the official listings rather than from a
   * topology document. Every read below comes from a projected record, and the one command that has no official expression refuses through routing rather than
   * reaching a transport that does not exist.
   */
  function tokenFixture(): { registry: AccessDeviceRegistry; store: StateStore } {

    const store = new StateStore({ clock: fakeClock(), log: silentLog(),
      refresh: () => Promise.reject(new Error("the refresh callback must not be called")), refreshIntervalMs: false });

    store.applyCensus({ devices: accessOfficialDevicesFixture.flat().map(officialDeviceRecord), doorStates: accessOfficialDoorsFixture.map(doorStateEntry),
      doors: accessOfficialDoorsFixture.map(officialDoorRecord) }, { complete: true });

    const routing = new AccessRoutingService({ capabilities: { mode: "token", official: true, override: "auto" }, official: null, store });
    const ctx: AccessDeviceContext = { host: "10.0.0.1", log: silentLog(), routing, store, transport: null };

    return { registry: new AccessDeviceRegistry(ctx), store };
  }

  test("reads a device's identity, name, and enrollment from a projected record", () => {

    const { registry } = tokenFixture();
    const hub = registry.device(HUB);

    assert.ok(hub, "the census seeded the hub, so the registry mints a handle for it");
    assert.equal(hub.name, "Test alias 13", "the alias the listing carried wins over the hardware name, exactly as it does on a topology record");
    assert.equal(hub.isOnline, true);
    assert.equal(hub.uplinkId, null, "an empty carrier field means nothing carries this hub");
    assert.equal(registry.device(READER)?.uplinkId, HUB, "and a reader names the hub it reaches the controller through");
  });

  test("resolves a hub's door and its state from the same census", () => {

    const { registry } = tokenFixture();
    const hub = registry.hub(HUB);

    assert.ok(hub, "a hub-capable projected record is reachable as a hub");
    assert.equal(hub.doorId, DOOR_HUB, "with no port extensions, the door is the device's own location");
    assert.deepEqual(hub.doorState, { "dps": "none", "location_id": DOOR_HUB, "lock": "locked" });
  });

  test("refuses a restart through routing, without reaching a transport that does not exist", async () => {

    const { registry } = tokenFixture();
    const hub = registry.device(HUB);

    assert.ok(hub);

    await assert.rejects(async () => hub.restart(), (error: unknown) => {

      assert.ok(error instanceof AccessCapabilityError);
      assert.match(error.message, /a device restart/);
      assert.match(error.message, /holds no credentials for the Access application's own endpoints/);

      return true;
    });
  });

  test("refuses a configuration write and a close on the same terms", async () => {

    const { registry } = tokenFixture();
    const hub = registry.hub(HUB);

    assert.ok(hub);

    await assert.rejects(async () => hub.updateDevice({}), AccessCapabilityError);
    await assert.rejects(async () => hub.close(), AccessCapabilityError);
  });
});

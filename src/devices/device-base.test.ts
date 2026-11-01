/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * device-base.test.ts: Tests for the AccessDevice base - liveness (a held handle reflects later store changes), the absent-record guard, the door-state
 * read-through, and the write-through commands. Every command test asserts the wire shape through an intercepted request rather than through the projection's own
 * return value, so what is being checked is what the controller would actually receive.
 */
import { CAMERA, HUB, READER, REFUSED, ULTRA, cameraBootstrap, deviceFixture, intercept } from "./device.helpers.ts";
import { describe, test } from "node:test";
import { expectAt, present, settle, settleUntil } from "homebridge-plugin-utils/testing";
import { ACCESS_METHODS } from "../protocol/vocabulary.ts";
import { AccessAuthorizationError } from "../errors.ts";
import type { AccessMethod } from "../protocol/vocabulary.ts";
import { accessBootstrap2026Fixture } from "../protocol/topology.fixtures.ts";
import assert from "node:assert/strict";

describe("liveness and read-through", () => {

  test("a held handle reflects a later store change rather than a value captured at lookup", () => {

    const { registry, store } = deviceFixture(accessBootstrap2026Fixture);
    const device = present(registry.device(HUB), "the hub");

    assert.equal(device.name, "Test alias 13");
    assert.equal(device.isOnline, true);

    store.dispatch({ eventName: "access.data.device.update", id: HUB, kind: "deviceChanged", payload: { "alias": "Renamed", "is_online": false } });

    assert.equal(device.name, "Renamed", "the handle re-read rather than answering from a captured value");
    assert.equal(device.isOnline, false);
  });

  test("the display name falls through to the controller's own name when the alias is empty", () => {

    const { registry, store } = deviceFixture(accessBootstrap2026Fixture);
    const device = present(registry.device(HUB), "the hub");

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
    const device = present(registry.device(HUB), "the hub");

    store.dispatch({ eventName: "access.data.device.update", id: HUB, kind: "deviceChanged",
      payload: { "is_adopted": false, "is_connected": false, "is_online": true } });

    assert.equal(device.config.is_connected, false, "the enrollment flags really are false on this record");
    assert.equal(device.config.is_adopted, false);
    assert.equal(device.isOnline, true, "and the online verdict is still the controller's own flag");
  });

  test("peek reports an absent record while the asserting reads throw", () => {

    const { registry, store } = deviceFixture(accessBootstrap2026Fixture);
    const device = present(registry.device(HUB), "the hub");

    assert.equal(device.peek()?.unique_id, HUB);

    store.dispatch({ eventName: "access.data.v2.device.delete", id: HUB, kind: "deviceRemoved" });

    assert.equal(device.peek(), undefined, "a departed record reads as absent rather than throwing");
    assert.throws(() => device.name, ReferenceError, "while the asserting read fails loudly");
    assert.equal(registry.device(HUB), undefined, "and a fresh lookup finds nothing");
  });

  test("observe yields the handle on each change to its own record and stays silent otherwise", async () => {

    const { registry, store } = deviceFixture(accessBootstrap2026Fixture);
    const device = present(registry.device(HUB), "the hub");

    const ac = new AbortController();
    const seen: string[] = [];
    const done = (async (): Promise<void> => {

      for await (const updated of device.observe({ signal: ac.signal })) {

        seen.push(updated.name);
      }
    })();

    await settle();

    // An unrelated device changing must not wake this handle's observer.
    store.dispatch({ eventName: "access.data.device.update", id: READER, kind: "deviceChanged", payload: { "alias": "Other" } });
    await settle();
    assert.equal(seen.length, 0);

    store.dispatch({ eventName: "access.data.device.update", id: HUB, kind: "deviceChanged", payload: { "alias": "Renamed" } });
    await settleUntil(() => seen.length === 1, { description: "the hub's observer to see the rename" });
    assert.deepEqual(seen, ["Renamed"]);

    ac.abort();
    await done;
  });

  test("the tamper getters read the record through the selectors rather than answering from a captured value", () => {

    const { registry, store } = deviceFixture(accessBootstrap2026Fixture);
    const ultra = present(registry.device(ULTRA), "the Ultra");
    const hub = present(registry.device(HUB), "the hub");

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
    const ultra = present(registry.device(ULTRA), "the Ultra");

    store.dispatch({ eventName: "access.data.v2.device.delete", id: ULTRA, kind: "deviceRemoved" });

    // The asserting reads fail loudly, exactly as every other one on this handle does: a handle to an absent record is a caller's own error.
    assert.throws(() => ultra.tamperState, ReferenceError);
    assert.throws(() => ultra.isTamperCapable, ReferenceError);
  });

  test("the access-method getter reads the record through the selector rather than answering from a captured value", () => {

    const { registry, store } = deviceFixture(accessBootstrap2026Fixture);
    const reader = present(registry.device(READER), "the G2 Pro");

    // The captured pin row carries a scrubbed placeholder, so pin is unestablished here, and the hub carries no access-method rows at all.
    assert.deepEqual(reader.accessMethodStates, { face: true, mobile: true, nfc: true, qr: true, touchPass: false });
    assert.deepEqual(present(registry.device(HUB), "the hub").accessMethodStates, {});

    const rows = reader.config.configs;

    assert.ok(rows, "the document should carry the G2 Pro's configuration rows");

    store.dispatch({ eventName: "access.data.device.update", id: READER, kind: "deviceChanged",
      payload: { configs: rows.map((row) => ((row.key === "nfc") ? { ...row, "value": "no" } : row)) } });

    assert.equal(reader.accessMethodStates.nfc, false, "the handle re-read rather than answering from a captured value");

    store.dispatch({ eventName: "access.data.v2.device.delete", id: READER, kind: "deviceRemoved" });

    assert.throws(() => reader.accessMethodStates, ReferenceError, "and it fails loudly once the record has left the state");
  });
});

describe("the device commands", () => {

  test("updateDevice writes a hub's settings under the hub collection and returns what the controller echoed", async () => {

    const fixture = deviceFixture(accessBootstrap2026Fixture);
    const echoed = { ...structuredClone(fixture.store.snapshot().devices.get(HUB)), "alias": "Echoed" };

    intercept(fixture, { body: JSON.stringify(echoed), method: "PUT", path: "/proxy/access/api/v2/device/" + HUB + "/configs" });

    const hub = present(fixture.registry.device(HUB), "the hub");

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

    intercept(fixture, { body: JSON.stringify(structuredClone(fixture.store.snapshot().devices.get(READER))), method: "PUT",
      path: "/proxy/access/api/v2/device/" + READER + "/settings" });

    const reader = present(fixture.registry.device(READER), "the reader");

    await reader.updateDevice({ "alias": "Renamed Reader" });

    // The suffix follows the device's live capability, and a reader is not hub-capable - the widened surface reaching any modeled device is the point here.
    assert.equal(fixture.captured[0]?.path, "/proxy/access/api/v2/device/" + READER + "/settings");
  });

  test("restart puts to the device's restart resource with an empty object body", async () => {

    const fixture = deviceFixture(accessBootstrap2026Fixture);

    intercept(fixture, { method: "PUT", path: "/proxy/access/api/v2/device/" + READER + "/restart" });

    const reader = present(fixture.registry.device(READER), "the reader");

    await reader.restart();

    assert.equal(fixture.captured[0]?.method, "PUT");
    assert.equal(fixture.captured[0].path, "/proxy/access/api/v2/device/" + READER + "/restart");

    // The body is present and empty, which is the opposite polarity from the close command below - both are asserted, because the difference is on the wire.
    assert.equal(String(fixture.captured[0].body), "{}");
  });

  test("a refusal the controller answers with a status surfaces as its classified error", async () => {

    const fixture = deviceFixture(accessBootstrap2026Fixture);

    intercept(fixture, { body: "forbidden", method: "PUT", path: "/proxy/access/api/v2/device/" + HUB + "/configs", status: 403 });

    const hub = present(fixture.registry.device(HUB), "the hub");

    await assert.rejects(() => hub.updateDevice({ "alias": "Nope" }), AccessAuthorizationError);
  });
});

describe("the access-method write", () => {

  /* The bodies below are compared as exact strings rather than parsed, because everything that tells this request apart from a near miss is on the wire: the tag,
   * the value spelling, the member order, and a bare array rather than an object wrapping one. Each string is the request homebridge-unifi-access composes by hand
   * for the same device and keys, which is the parity this method is held to.
   */
  test("a reader's method goes to its settings collection as one row, spelled as the record's own rows are", async () => {

    const fixture = deviceFixture(accessBootstrap2026Fixture);

    intercept(fixture, { method: "PUT", path: "/proxy/access/api/v2/device/" + READER + "/settings" });

    await present(fixture.registry.device(READER), "the reader").setAccessMethod("nfc", false);

    const captured = expectAt(fixture.captured, 0, "the access-method write");

    assert.equal(captured.method, "PUT");
    assert.equal(captured.path, "/proxy/access/api/v2/device/" + READER + "/settings");
    assert.equal(captured.body, "[{\"key\":\"nfc\",\"tag\":\"open_door_mode\",\"value\":\"no\"}]");
  });

  test("a hub takes its methods on the settings collection, where its configuration write takes the hub collection", async () => {

    const fixture = deviceFixture(accessBootstrap2026Fixture);
    const ultra = present(fixture.registry.device(ULTRA), "the Ultra");

    // The UA Ultra drives a door and reads credentials at it, so a write routed by a role capability would send it somewhere other than the settings collection.
    assert.ok(ultra.config.capabilities.includes("is_hub") && ultra.config.capabilities.includes("is_reader"), "the UA Ultra is a hub as well as a reader");

    intercept(fixture, { method: "PUT", path: "/proxy/access/api/v2/device/" + ULTRA + "/settings" });

    await ultra.setAccessMethod("pin", true);

    assert.equal(expectAt(fixture.captured, 0, "the access-method write").path, "/proxy/access/api/v2/device/" + ULTRA + "/settings");
  });

  test("the captured camera-class record takes its methods on the camera configuration endpoint, mobile unlock as its Bluetooth keys in one request", async () => {

    const fixture = deviceFixture(cameraBootstrap());

    intercept(fixture, { method: "PUT", path: "/proxy/access/api/v2/device/" + CAMERA + "/configs?is_camera=true" });

    await present(fixture.registry.device(CAMERA), "the camera-class reader").setAccessMethod("mobile", true);

    const captured = expectAt(fixture.captured, 0, "the access-method write");

    assert.equal(captured.path, "/proxy/access/api/v2/device/" + CAMERA + "/configs?is_camera=true");
    assert.equal(captured.body, "[{\"key\":\"bt\",\"tag\":\"open_door_mode\",\"value\":\"yes\"},{\"key\":\"bt_button\",\"tag\":\"open_door_mode\",\"value\":\"yes\"}," +
      "{\"key\":\"bt_tap\",\"tag\":\"open_door_mode\",\"value\":\"yes\"}]");
    assert.equal(fixture.captured.length, 1, "and one request carries every row");
  });

  test("the same record without its camera flag takes them on the settings collection, whatever else it carries", async () => {

    const { is_camera: _flag, ...unflagged } = present(cameraBootstrap().device_groups?.[0]?.[0], "the camera-class record");

    // The record keeps everything a wrong reading could mistake for the flag: the camera capability among its capabilities, and its camera model.
    assert.ok(unflagged.capabilities.includes("identity_is_camera"), "the record still carries the camera capability");
    assert.equal(unflagged.device_type, "UVC G6 Pro Entry", "and its camera model");

    const fixture = deviceFixture({ ...accessBootstrap2026Fixture, "device_groups": [[unflagged]] });

    intercept(fixture, { method: "PUT", path: "/proxy/access/api/v2/device/" + CAMERA + "/settings" });

    await present(fixture.registry.device(CAMERA), "the unflagged record").setAccessMethod("nfc", true);

    assert.equal(expectAt(fixture.captured, 0, "the access-method write").path, "/proxy/access/api/v2/device/" + CAMERA + "/settings");
  });

  test("each name sends the keys it spans, one row per key, on a reader's settings collection and on the camera configuration endpoint alike", async () => {

    /* The vocabulary's direct and camera columns restated by hand, so the table and the requests it produces are checked against each other rather than against
     * themselves. Mobile unlock's keys differ from one endpoint to the other, and TouchPass is spelled the configuration rows' way on each.
     */
    const keys: Record<AccessMethod, { camera: string[]; direct: string[] }> = {

      face: { camera: ["face"], direct: ["face"] },
      mobile: { camera: [ "bt", "bt_button", "bt_tap" ], direct: ["bt_button"] },
      nfc: { camera: ["nfc"], direct: ["nfc"] },
      pin: { camera: ["pin_code"], direct: ["pin_code"] },
      qr: { camera: ["qr_code"], direct: ["qr_code"] },
      touchPass: { camera: ["apple_pass"], direct: ["apple_pass"] },
      wave: { camera: ["wave"], direct: ["wave"] }
    };
    const endpoints = [ { bootstrap: accessBootstrap2026Fixture, column: "direct", id: READER, path: "/settings" },
      { bootstrap: cameraBootstrap(), column: "camera", id: CAMERA, path: "/configs?is_camera=true" } ] as const;

    for(const endpoint of endpoints) {

      for(const method of ACCESS_METHODS) {

        const fixture = deviceFixture(endpoint.bootstrap);
        const expected = keys[method][endpoint.column].map((key) => ({ key, tag: "open_door_mode", value: "yes" }));
        const label = method + " on the " + endpoint.column + " endpoint";

        intercept(fixture, { method: "PUT", path: "/proxy/access/api/v2/device/" + endpoint.id + endpoint.path });

        // eslint-disable-next-line no-await-in-loop
        await present(fixture.registry.device(endpoint.id), endpoint.column + " device").setAccessMethod(method, true);

        assert.equal(expectAt(fixture.captured, 0, label).body, JSON.stringify(expected), label);
        assert.equal(fixture.captured.length, 1, label + " goes out as one request carrying every row");
      }
    }
  });

  test("any 2xx answer is success whatever its body, a refusal envelope and a body that is not JSON among them", async () => {

    const fixture = deviceFixture(accessBootstrap2026Fixture);
    const reader = present(fixture.registry.device(READER), "the reader");

    intercept(fixture, { body: REFUSED, method: "PUT", path: "/proxy/access/api/v2/device/" + READER + "/settings" });
    intercept(fixture, { body: "accepted", method: "PUT", path: "/proxy/access/api/v2/device/" + READER + "/settings" });

    await reader.setAccessMethod("nfc", false);
    await reader.setAccessMethod("nfc", true);

    assert.equal(fixture.captured.length, 2, "every write went out and resolved");
  });

  test("a refusal the controller answers with a status surfaces as its classified error", async () => {

    const fixture = deviceFixture(accessBootstrap2026Fixture);

    intercept(fixture, { body: "forbidden", method: "PUT", path: "/proxy/access/api/v2/device/" + READER + "/settings", status: 403 });

    await assert.rejects(() => present(fixture.registry.device(READER), "the reader").setAccessMethod("nfc", false), AccessAuthorizationError);
  });
});

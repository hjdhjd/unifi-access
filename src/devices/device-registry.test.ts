/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * device-registry.test.ts: Tests for the device registry - the three views it answers with, and the projection it produces over a token-only client's census.
 *
 * The census rows drive the tier over a store seeded from the official listings rather than from a topology document, in a context holding no transport at all,
 * so a read that reached for the wire would fail loudly rather than pass unnoticed.
 */
import { DOOR_HUB, DOOR_MINI, HUB, READER, deviceFixture } from "./device.helpers.ts";
import { TestClock, silentLog } from "homebridge-plugin-utils/testing";
import { accessOfficialDevicesFixture, accessOfficialDoorsFixture } from "../official/devices.fixtures.ts";
import { assertRejectsWith, present } from "../testing.helpers.ts";
import { describe, test } from "node:test";
import { doorStateEntry, officialDeviceRecord, officialDoorRecord } from "../client/census.ts";
import { AccessCapabilityError } from "../errors.ts";
import type { AccessDeviceContext } from "./context.ts";
import { AccessDeviceRegistry } from "./registry.ts";
import { AccessRoutingService } from "../client/routing.ts";
import { StateStore } from "../state/store.ts";
import { accessBootstrap2026Fixture } from "../protocol/topology.fixtures.ts";
import assert from "node:assert/strict";

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

describe("a projection over a token-only client's census", () => {

  /* The tier running in the mode it never ran in before: a context with no transport at all, over a store seeded from the official listings rather than from a
   * topology document. Every read below comes from a projected record, and the one command that has no official expression refuses through routing rather than
   * reaching a transport that does not exist.
   */
  function tokenFixture(): { registry: AccessDeviceRegistry; store: StateStore } {

    const store = new StateStore({ clock: new TestClock(), log: silentLog(),
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
    const hub = present(registry.device(HUB), "the hub");

    await assertRejectsWith(async () => hub.restart(), AccessCapabilityError, { check: (error) => {

      assert.match(error.message, /a restart for device "Test alias 13"/);
      assert.match(error.message, /holds no credentials for the Access application's own endpoints/);
    } });
  });

  test("refuses a configuration write and a close on the same terms", async () => {

    const { registry } = tokenFixture();
    const hub = present(registry.hub(HUB), "the hub");

    await assert.rejects(async () => hub.updateDevice({}), AccessCapabilityError);
    await assert.rejects(async () => hub.close(), AccessCapabilityError);
  });
});

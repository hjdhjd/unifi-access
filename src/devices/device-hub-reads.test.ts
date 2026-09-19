/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * device-hub-reads.test.ts: Tests for what a hub answers without a wire round trip - the door record it resolves, the door state it reads through, the terminals
 * it reports, and the port bindings it carries. Each of these is a read of controller state through the projection, so a handle whose record has left the state
 * fails loudly rather than answering from a captured value.
 */
import { DOOR_HUB, DOOR_MINI, DOOR_MINI_DOOR, EAH_DOOR_2, EAH_HUB, EAH_PORT_2, EAH_PORT_3, HUB, ULTRA, ULTRA_BINDING, deviceFixture, doorStateEvent,
  wirePacket } from "./device.helpers.ts";
import { accessBootstrap2026Fixture, accessBootstrapEahFixture } from "../protocol/topology.fixtures.ts";
import { describe, test } from "node:test";
import { present, topologyDevices } from "../testing.helpers.ts";
import { accessOfficialDoorsFixture } from "../official/devices.fixtures.ts";
import assert from "node:assert/strict";
import { classifyPacket } from "../protocol/events.ts";
import { officialDoorRecord } from "../client/census.ts";

describe("the door record through a hub", () => {

  test("each hub answers its own door's record, and nothing where the state holds none", () => {

    const { registry, store } = deviceFixture(accessBootstrap2026Fixture);
    const hub = present(registry.hub(HUB), "the hub");
    const mini = present(registry.hub(DOOR_MINI), "the Door Mini");

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
    const hub = present(registry.hub(HUB), "the hub");

    const before = hub.doorState;

    assert.equal(before?.lock, "locked", "the topology's own flags established a lock at rest");
    assert.equal(before.location_id, DOOR_HUB);

    store.dispatch(doorStateEvent(DOOR_HUB, "unlocked"));

    const reported = hub.doorState;

    assert.equal(reported?.lock, "unlocked");
    assert.equal(reported?.location_id, DOOR_HUB, "the hub resolved its own door rather than the consumer having to");

    // A second single-door hub in the same topology resolves its own door and reads nothing from the first one's report, which is what shows the resolution is
    // per-handle rather than incidental.
    const mini = present(registry.hub(DOOR_MINI), "the Door Mini");

    assert.equal(mini.config.location_id, DOOR_MINI_DOOR);
    assert.equal(mini.doorState?.lock, "locked", "the other hub's door still shows what its own hardware established");
    assert.equal(mini.doorState?.location_id, DOOR_MINI_DOOR);
  });

  test("an entry whose optional member is malformed leaves the previously stored one standing", () => {

    const { registry, store } = deviceFixture(accessBootstrap2026Fixture);
    const hub = present(registry.hub(HUB), "the hub");

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

describe("terminal reads through a hub", () => {

  test("reads every terminal the UA Hub reports, each with nothing wired to it", () => {

    const { registry } = deviceFixture(accessBootstrap2026Fixture);
    const hub = present(registry.hub(HUB), "the hub");

    for(const input of [ "rel", "ren", "rex", "dps" ] as const) {

      assert.deepEqual(hub.terminalInput(input), { "wired": false }, input + " reports nothing wired on the captured hub");
    }
  });

  test("reads a UA Ultra's terminals through the duty its port setting assigns", () => {

    // The Ultra detects no wiring at all, so its duty selector is what puts one terminal in service and leaves the other reporting nothing wired. Asserting
    // both is what shows the handle threads the argument rather than answering the same way whatever it is asked.
    const { registry } = deviceFixture(accessBootstrap2026Fixture);
    const ultra = present(registry.hub(ULTRA), "the Ultra");

    assert.deepEqual(ultra.terminalInput("dps"), { "state": false, "wired": true });
    assert.deepEqual(ultra.terminalInput("rex"), { "wired": false });
  });

  test("a port handle reads its own port's rows rather than a sibling's", () => {

    /* The whole hub's row array travels onto every synthesized port, so the second port's request to exit is raised here on rows the first port's handle
     * carries too. A read that took the first family it found rather than this port's would answer from the first port, whose pair the document leaves dark.
     */
    const document = structuredClone(accessBootstrapEahFixture);
    const raised = new Set([ "input_d2_button", "wiring_state_d2-button-neg", "wiring_state_d2-button-pos" ]);

    for(const row of topologyDevices(document).find((device) => device.unique_id === EAH_HUB)?.configs ?? []) {

      if(raised.has(row.key)) {

        row.value = "on";
      }
    }

    const { registry } = deviceFixture(document);
    const second = present(registry.accessPoint(EAH_PORT_2), "the second access point");
    const third = present(registry.accessPoint(EAH_PORT_3), "the third access point");

    assert.deepEqual(second.terminalInput("rex"), { "state": true, "wired": true });
    assert.deepEqual(second.terminalInput("dps"), { "wired": false }, "the same port's position sensor still reports nothing wired");
    assert.deepEqual(third.terminalInput("rex"), { "wired": false }, "and a sibling port reads its own dark pair rather than the raised one");
  });

  test("a handle whose record has left controller state fails loudly rather than answering", () => {

    const { registry, store } = deviceFixture(accessBootstrap2026Fixture);
    const hub = present(registry.hub(HUB), "the hub");

    store.dispatch({ eventName: "access.data.v2.device.delete", id: HUB, kind: "deviceRemoved" });

    assert.throws(() => hub.terminalInput("dps"), ReferenceError);
  });
});

describe("the port bindings a hub answers", () => {

  test("reads the door each captured hub's port is bound to, and resolves its own door through the first of them", () => {

    const { registry } = deviceFixture(accessBootstrap2026Fixture);
    const ultra = present(registry.hub(ULTRA), "the Ultra");
    const hub = present(registry.hub(HUB), "the hub");

    assert.deepEqual(ultra.portBindings, [ULTRA_BINDING]);
    assert.equal(ultra.doorId, ULTRA_BINDING.doorId, "the door this handle commands is the one its first binding names");

    // The UA Hub binds its door through no extension at all, so it answers no bindings and resolves its door through the fallback instead.
    assert.deepEqual(hub.portBindings, []);
    assert.equal(hub.doorId, DOOR_HUB);
  });

  test("a per-port handle of a multi-port hub answers no bindings, because it already is one port", () => {

    // The expansion strips the hub's extensions on the way through, so a port's own record carries none. Its door comes from the location the expansion gave it
    // rather than from a binding, which is the fallback reached by construction rather than by a special case.
    const { registry } = deviceFixture(accessBootstrapEahFixture);
    const port2 = present(registry.accessPoint(EAH_PORT_2), "port 2");

    assert.deepEqual(port2.portBindings, []);
    assert.equal(port2.doorId, EAH_DOOR_2);
  });

  test("resolves the bound door rather than the record's own location where the two name different doors", () => {

    /* Every captured single-door hub is installed at the door it serves, so its location and its binding name the same door and no capture can tell the two
     * reads apart. Moving the record's location is what does: the binding is what the resolution answers with, and the location is only the fallback.
     */
    const document = structuredClone(accessBootstrap2026Fixture);
    const record = topologyDevices(document).find((device) => device.unique_id === ULTRA);

    assert.ok(record, "the 2026 document should carry the UA Ultra");

    Object.assign(record, { "location_id": DOOR_HUB });

    const { registry } = deviceFixture(document);
    const ultra = present(registry.hub(ULTRA), "the Ultra");

    assert.equal(ultra.config.location_id, DOOR_HUB, "the record really does sit at a door other than the one its port binds");
    assert.equal(ultra.doorId, ULTRA_BINDING.doorId, "and the door it commands is still the door that port binds");
  });

  test("the bindings getter throws once the record has left the state", () => {

    const { registry, store } = deviceFixture(accessBootstrap2026Fixture);
    const ultra = present(registry.hub(ULTRA), "the Ultra");

    store.dispatch({ eventName: "access.data.v2.device.delete", id: ULTRA, kind: "deviceRemoved" });

    // The asserting read fails loudly, exactly as every other one on this handle does: a handle to an absent record is a caller's own error.
    assert.throws(() => ultra.portBindings, ReferenceError);
  });
});

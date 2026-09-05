/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * reducer.test.ts: Unit tests for the state reducer. The reducer's guarantees are immutability, structural sharing, and no-op fidelity, so alongside the value
 * assertions these tests assert reference identity in both directions: a change must mint a new reference on the path it touched, and a no-change must return the
 * very same object. The topology fixtures are real controller documents, so the flattening and pruning assertions run against wire material rather than mock shapes.
 */
import type { AccessBootstrapConfig, AccessControllerConfig, AccessDeviceConfig, AccessDeviceConfigPayload,
  AccessDeviceEntryConfig } from "../types/index.ts";
import { accessBootstrap2026Fixture, accessBootstrapEahFixture, accessControllerInfoFixture } from "./topology.fixtures.ts";
import { accessEventPacketsDoorStateFixture, accessEventPacketsFixture } from "./events.fixtures.ts";
import { accessOfficialDevicesFixture, accessOfficialDoorsFixture } from "../official/devices.fixtures.ts";
import { applyBootstrap, createInitialState, reduce } from "./reducer.ts";
import { describe, test } from "node:test";
import { doorStateEntry, officialDeviceRecord, officialDoorRecord } from "../client/census.ts";
import type { AccessOfficialDevice } from "../official/devices.ts";
import type { AccessOfficialDoor } from "../official/spaces.ts";
import { AccessProtocolError } from "../errors.ts";
import type { AccessState } from "./reducer.ts";
import type { AccessTypedEvent } from "./events.ts";
import assert from "node:assert/strict";
import { classifyPacket } from "./events.ts";
import { topologyDevices } from "../testing.helpers.ts";

// The identity the captured camera-class doorbell reports. It appears throughout the notification corpus while being absent from every real topology document, which
// is why a state that needs it present has to seed it deliberately.
const DOORBELL_ID = "00000000000000000000000c";

// Named entries from the real topology documents, so assertions cite a specific record rather than a count re-derived from the same fixture.
const ROOT_2026 = "00000000-0000-0000-0000-000000000000";
const FLOOR_2026 = "00000000-0000-0000-0000-000000000001";
const DOOR_HUB = "00000000-0000-0000-0000-000000000006";
const HUB_ID = "aabbcc000001";
const READER_ID = "aabbcc000002";
const EAH_ROOT = "00000000-0000-0000-0000-000000000011";
const EAH_BUILDING_HOSTED_DEVICE = "aabbcc000005";

// The one door in the 2024 document with a hub attached to the door itself, rather than to the building or nothing at all.
const EAH_HUB_DOOR = "00000000-0000-0000-0000-000000000024";

// The Door Mini and the door it drives, which is the hardware the door-state capture window worked through.
const DOOR_MINI = "aabbcc000004";
const DOOR_MINI_DOOR = "00000000-0000-0000-0000-00000000000e";

// The UA Ultra's door, the one whose hardware reports no wiring pair at all.
const DOOR_ULTRA = "00000000-0000-0000-0000-000000000002";

// The identity carried by the synthesized record that arrives without a capabilities array. No captured document holds a record in that shape, so the tests for the
// admission normalization build one, and it takes an identity of its own so it can never be confused with a device a fixture supplied.
const CAPABILITY_LESS_ID = "02ffee00b001";

// A fresh structural copy, so a test that mutates or re-applies a document can never pass by sharing the fixture's own object identity.
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const bootstrapEvent = (bootstrap: AccessBootstrapConfig): AccessTypedEvent => ({ data: bootstrap, kind: "bootstrapLoaded" });

// One device out of the captured official listing, failing loudly rather than silently narrowing the corpus if it ever stops carrying that record.
const listedDevice = (id: string): AccessOfficialDevice => {

  const device = accessOfficialDevicesFixture.flat().find((candidate) => candidate.id === id);

  assert.ok(device, "the official listing fixture should carry device " + id);

  return device;
};

const stateFrom = (bootstrap: AccessBootstrapConfig): AccessState => applyBootstrap(createInitialState(), clone(bootstrap));

const findPacket = (predicate: (packet: (typeof accessEventPacketsFixture)[number]) => boolean, description: string) => {

  const packet = accessEventPacketsFixture.find(predicate);

  assert.ok(packet, "the fixture corpus should carry " + description);

  return packet;
};

const classify = (packet: (typeof accessEventPacketsFixture)[number]): AccessTypedEvent => {

  const event = classifyPacket(packet);

  assert.ok(event, "the packet should classify");

  return event;
};

// The door-state member of the event union, named once so the helper below reads without restating the extraction at every mention.
type DoorStateEvent = Extract<AccessTypedEvent, { kind: "doorStateChanged" }>;

const controllerEvent = (controller: AccessControllerConfig): AccessTypedEvent => ({ data: controller, kind: "controllerChanged" });

/* Classify a door-state specimen selected by what the resulting event says, so a test names the report it wants ("the one that found the door closed") rather than
 * a corpus position. Each call re-classifies from the fixture, so two calls naming the same specimen produce two independently-built events that share nothing.
 */
const classifyDoorState = (predicate: (event: DoorStateEvent) => boolean): DoorStateEvent => {

  for(const packet of accessEventPacketsDoorStateFixture) {

    const event = classifyPacket(clone(packet));

    if((event?.kind === "doorStateChanged") && predicate(event)) {

      return event;
    }
  }

  return assert.fail("the door-state corpus should carry a matching report");
};

// A door-state report for a door the corpus never worked, so a test can put two doors into the map. The entry shape is the wire's own; only the door it names is
// chosen here.
const syntheticDoorState = (locationId: string): AccessTypedEvent => ({ device: { id: DOOR_MINI, payload: {} }, eventName: "access.data.v2.device.update",
  kind: "doorStateChanged", states: [{ "dps": "close", "dps_connected": true, "emergency": { "hardware": "none", "software": "none" }, "is_unavailable": false,
    "location_id": locationId, "lock": "locked" }] });

/* A 2026 document with the camera-class doorbell added, because the reducer only ever advances devices the topology gave it and the doorbell is in no real document.
 * The seeded record is a clone of a real bootstrap device with the doorbell's own captured identity written over it: cloning a complete record means the result
 * type-checks by construction and carries every member a device record is supposed to have, where a hand-built stub would not.
 *
 * It is attached at root level, as hardware the building hosts directly, which keeps the synthetic document one key different from the real one.
 */
const seededBootstrap = (): AccessBootstrapConfig => {

  const bootstrap = clone(accessBootstrap2026Fixture);
  const template = clone(bootstrap.floors?.[0]?.doors?.[0]?.device_groups?.[0]?.[0]);

  assert.ok(template, "the 2026 document should carry a device record to clone");

  const synthetic: AccessDeviceConfig = { ...template, "device_type": "UVC G6 Pro Entry", "guid": "00000000-0000-0000-0000-000000000034", "ip": "192.0.2.13",
    "mac": "aa:bb:cc:00:00:10", "name": "Acme shortname 3", "unique_id": DOORBELL_ID };

  return { ...bootstrap, "device_groups": [[synthetic]] };
};

/* A complete device record arriving without a capabilities array, which is a shape the field has produced. It is a clone of a real bootstrap device under an identity
 * of its own, with the member excluded by naming it in the rest destructure: the binding exists to be discarded rather than read, and the underscore prefix says so.
 * The downcast is what admits the result as a device record, because the rest type is missing a member the record type requires - which is precisely the wire shape
 * being modeled here.
 */
const capabilityLessDevice = (): AccessDeviceConfig => {

  const template = clone(accessBootstrap2026Fixture.floors?.[0]?.doors?.[0]?.device_groups?.[0]?.[0]);

  assert.ok(template, "the 2026 document should carry a device record to clone");

  const { capabilities: _stripped, ...bare } = { ...template, "unique_id": CAPABILITY_LESS_ID };

  return bare as AccessDeviceConfig;
};

// The 2026 document carrying that record at root level, as hardware the building hosts directly, which keeps the synthetic document one key different from the real
// one and leaves every door-hosted record exactly as the capture holds it.
const capabilityLessBootstrap = (): AccessBootstrapConfig => ({ ...clone(accessBootstrap2026Fixture), "device_groups": [[capabilityLessDevice()]] });

describe("applyBootstrap flattening", () => {

  test("flattens every door-hosted device of the 2026 document into the devices map", () => {

    const state = stateFrom(accessBootstrap2026Fixture);

    for(const id of [ "aabbcc000000", HUB_ID, READER_ID, "aabbcc000003", "aabbcc000004" ]) {

      assert.ok(state.devices.has(id), "the devices map should hold " + id);
    }

    // Every device the document holds reaches the map, checked against the document itself rather than against a remembered count.
    for(const device of topologyDevices(accessBootstrap2026Fixture)) {

      assert.ok(state.devices.has(device.unique_id), "device " + device.unique_id + " should reach the devices map");
    }
  });

  test("flattens the doors and floors of the 2026 document into their maps", () => {

    const state = stateFrom(accessBootstrap2026Fixture);

    assert.ok(state.floors.has(FLOOR_2026));
    assert.equal(state.floors.get(FLOOR_2026)?.name, "Test Name 2");

    for(const id of [ "00000000-0000-0000-0000-000000000002", DOOR_HUB, "00000000-0000-0000-0000-00000000000e" ]) {

      assert.ok(state.doors.has(id), "the doors map should hold " + id);
    }

    assert.equal(state.doors.get(DOOR_HUB)?.name, "Test Name 10");
    assert.equal(state.root?.unique_id, ROOT_2026);
    assert.equal(state.root?.name, "Test Name 1");
  });

  test("flattens the building-hosted device of the 2024 document, which attaches hardware to its root", () => {

    // This document really does carry a root-level device group, so the root-level flatten path is exercised by wire material rather than by a synthetic shape.
    assert.ok(Object.hasOwn(accessBootstrapEahFixture, "device_groups"), "the 2024 document should carry hardware on its root");

    const state = stateFrom(accessBootstrapEahFixture);

    assert.ok(state.devices.has(EAH_BUILDING_HOSTED_DEVICE), "the building-hosted device should reach the devices map");
    assert.equal(state.devices.get(EAH_BUILDING_HOSTED_DEVICE)?.name, "Test Name 61");
    assert.equal(state.root?.unique_id, EAH_ROOT);

    for(const device of topologyDevices(accessBootstrapEahFixture)) {

      assert.ok(state.devices.has(device.unique_id), "device " + device.unique_id + " should reach the devices map");
    }
  });

  test("unwraps the double nesting the wire wraps hardware in", () => {

    // The wire groups devices as an array of arrays; a reducer that flattened only one level would put arrays into the map instead of records.
    const group = accessBootstrap2026Fixture.floors?.[0]?.doors?.[1]?.device_groups;

    assert.ok(Array.isArray(group?.[0]), "the door's device group should be doubly nested on the wire");

    const state = stateFrom(accessBootstrap2026Fixture);

    assert.equal(state.devices.get(HUB_ID)?.unique_id, HUB_ID);
    assert.equal(state.devices.get(HUB_ID)?.device_type, "UAH");
  });
});

describe("applyBootstrap door-state seeding", () => {

  test("seeds each door with exactly what its own serving hardware establishes", () => {

    /* The per-door values, asserted against what the catalog predicts for the hardware this real document carries, because an assertion that entries merely exist
     * would pass just as well against a derivation that read the wrong flags. The Ultra reports no wiring pair, so it establishes its lock alone; the other two
     * report their pairs dark, which is a sensor that is not connected; and all three relays are at rest.
     */
    const state = stateFrom(accessBootstrap2026Fixture);

    assert.deepEqual(state.doorStates.get(DOOR_ULTRA), { "location_id": DOOR_ULTRA, "lock": "locked" });
    assert.deepEqual(state.doorStates.get(DOOR_HUB), { "dps": "none", "dps_connected": false, "location_id": DOOR_HUB, "lock": "locked" });
    assert.deepEqual(state.doorStates.get(DOOR_MINI_DOOR), { "dps": "none", "dps_connected": false, "location_id": DOOR_MINI_DOOR, "lock": "locked" });
    assert.equal(state.doorStates.size, 3);
  });

  test("leaves a member the hardware never established absent rather than undefined", () => {

    // The seed spreads its facts into the entry, so a member present and undefined would be a key that overwrites. The Ultra is the door that proves it: no wiring
    // pair means no position evidence in either direction.
    const entry = stateFrom(accessBootstrap2026Fixture).doorStates.get(DOOR_ULTRA);

    assert.ok(entry);

    for(const member of [ "dps", "dps_connected", "emergency", "is_unavailable" ]) {

      assert.equal(Object.hasOwn(entry, member), false, member + " should be absent from a seeded entry that did not establish it");
    }
  });

  test("never regresses a door that has already reported", () => {

    /* The rule the seed lives by. A door that reported `close` over the wire keeps that reading through every later refresh, even though the same document's flags
     * would derive an unconnected sensor for it - a live reading always outranks an interpretation of hardware.
     */
    const reported = reduce(stateFrom(accessBootstrap2026Fixture), syntheticDoorState(DOOR_MINI_DOOR));
    const entry = reported.doorStates.get(DOOR_MINI_DOOR);
    const refreshed = reduce(reported, bootstrapEvent(clone(accessBootstrap2026Fixture)));

    assert.equal(refreshed.doorStates.get(DOOR_MINI_DOOR)?.dps, "close");
    assert.equal(Object.is(refreshed.doorStates.get(DOOR_MINI_DOOR), entry), true, "the reported entry keeps its exact reference across a refresh");
  });

  test("mints no new map when a refresh seeds nothing", () => {

    // Every door is already established after the first document, so the second one adds nothing and the whole state hands back its own reference.
    const state = stateFrom(accessBootstrap2026Fixture);
    const again = reduce(state, bootstrapEvent(clone(accessBootstrap2026Fixture)));

    assert.equal(Object.is(again, state), true);
    assert.equal(Object.is(again.doorStates, state.doorStates), true);
  });

  test("gives a door whose hardware establishes nothing no entry at all", () => {

    /* The 2024 document is the whole taxonomy of silence in one real capture. Of its nine doors, exactly one is driven by a hub attached to it - and that hub sits
     * alongside a reader, which is the everyday shape that has to keep deriving. The rest divide into doors whose only hardware is a reader, and doors driven by the
     * Enterprise hub the building hosts directly, which serves no door in the document's own structure.
     */
    const eah = stateFrom(accessBootstrapEahFixture);

    assert.equal(eah.doors.size, 9);
    assert.deepEqual([...eah.doorStates.keys()], [EAH_HUB_DOOR], "only the door with a hub of its own establishes anything");
    assert.deepEqual(eah.doorStates.get(EAH_HUB_DOOR), { "dps": "none", "dps_connected": false, "location_id": EAH_HUB_DOOR, "lock": "locked" });

    const readersOnly = clone(accessBootstrap2026Fixture);
    const floor = readersOnly.floors?.[0];

    assert.ok(floor);

    floor.doors = floor.doors.map((door) => ({ ...door, "device_groups": [] }));

    assert.equal(stateFrom(readersOnly).doorStates.size, 0, "a door with no serving hardware establishes nothing");
  });

  test("seeds a door the previous document did not carry", () => {

    // The seed runs on every document rather than only the first, so a door added to the controller is established the moment a refresh brings it in.
    const withoutMini = clone(accessBootstrap2026Fixture);
    const floor = withoutMini.floors?.[0];

    assert.ok(floor);
    floor.doors = floor.doors.filter((door) => door.unique_id !== DOOR_MINI_DOOR);

    const state = stateFrom(withoutMini);

    assert.equal(state.doorStates.has(DOOR_MINI_DOOR), false);

    const restored = reduce(state, bootstrapEvent(clone(accessBootstrap2026Fixture)));

    assert.equal(restored.doorStates.get(DOOR_MINI_DOOR)?.dps, "none");
  });
});

describe("applyBootstrap pruning", () => {

  test("a stored door carries no device group, on both real documents", () => {

    for(const [ label, fixture ] of [ [ "2026", accessBootstrap2026Fixture ], [ "2024", accessBootstrapEahFixture ] ] as const) {

      const state = stateFrom(fixture);

      assert.ok(state.doors.size > 0, label + " should contribute doors");

      for(const [ id, door ] of state.doors) {

        assert.equal(Object.hasOwn(door, "device_groups"), false, label + " stored door " + id + " should not embed the devices map's records");
      }
    }
  });

  test("a stored floor carries no doors, on both real documents", () => {

    for(const [ label, fixture ] of [ [ "2026", accessBootstrap2026Fixture ], [ "2024", accessBootstrapEahFixture ] ] as const) {

      const state = stateFrom(fixture);

      assert.ok(state.floors.size > 0, label + " should contribute floors");

      for(const [ id, floor ] of state.floors) {

        assert.equal(Object.hasOwn(floor, "doors"), false, label + " stored floor " + id + " should not embed the doors map's records");
      }
    }
  });

  test("the stored root carries neither floors nor a device group, against a document that really sends both", () => {

    // The 2024 document is the one carrying both members on its root, so this assertion is answering a real question rather than being vacuously true.
    assert.ok(Object.hasOwn(accessBootstrapEahFixture, "floors"));
    assert.ok(Object.hasOwn(accessBootstrapEahFixture, "device_groups"));

    const state = stateFrom(accessBootstrapEahFixture);

    assert.ok(state.root);
    assert.equal(Object.hasOwn(state.root, "floors"), false, "the stored root should not embed the floors map's records");
    assert.equal(Object.hasOwn(state.root, "device_groups"), false, "the stored root should not embed the devices map's records");

    // The root keeps everything else it declared.
    assert.equal(state.root.name, "Test Name 27");
    assert.equal(state.root.location_type, "building");
  });

  test("the stored root of a document with no root-level hardware is likewise pruned of its floors", () => {

    assert.equal(Object.hasOwn(accessBootstrap2026Fixture, "device_groups"), false, "the 2026 document attaches all hardware to doors");

    const state = stateFrom(accessBootstrap2026Fixture);

    assert.ok(state.root);
    assert.equal(Object.hasOwn(state.root, "floors"), false);
    assert.equal(Object.hasOwn(state.root, "device_groups"), false);
  });
});

describe("applyBootstrap reconciliation", () => {

  test("re-applying an equal document returns the very same state object", () => {

    // Two independent parses, so a pass here cannot come from the two applications sharing input objects.
    const state = applyBootstrap(createInitialState(), clone(accessBootstrap2026Fixture));
    const again = applyBootstrap(state, clone(accessBootstrap2026Fixture));

    assert.equal(Object.is(again, state), true, "a refresh that found no drift should produce no new state");
    assert.equal(Object.is(again.devices, state.devices), true);
    assert.equal(Object.is(again.doors, state.doors), true);
    assert.equal(Object.is(again.floors, state.floors), true);
    assert.equal(Object.is(again.root, state.root), true);
  });

  test("an unchanged record keeps its reference while a changed one does not", () => {

    const state = stateFrom(accessBootstrap2026Fixture);
    const drifted = clone(accessBootstrap2026Fixture);
    const target = drifted.floors?.[0]?.doors?.[1]?.device_groups?.[0]?.[0];

    assert.ok(target);
    assert.equal(target.unique_id, HUB_ID);

    target.ip = "192.0.2.1";

    const next = applyBootstrap(state, drifted);

    assert.notEqual(Object.is(next, state), true, "a drifted document should mint a new state");
    assert.equal(next.devices.get(HUB_ID)?.ip, "192.0.2.1");
    assert.notEqual(Object.is(next.devices.get(HUB_ID), state.devices.get(HUB_ID)), true, "the changed device should be a new reference");
    assert.equal(Object.is(next.devices.get(READER_ID), state.devices.get(READER_ID)), true, "an untouched device should keep its reference");

    // The collections that saw no change keep their own references, so no observer of doors or floors is woken by a device change.
    assert.equal(Object.is(next.doors, state.doors), true);
    assert.equal(Object.is(next.floors, state.floors), true);
    assert.equal(Object.is(next.root, state.root), true);
  });

  test("a device absent from a later document is dropped", () => {

    const state = stateFrom(accessBootstrap2026Fixture);

    assert.ok(state.devices.has("aabbcc000004"));

    const reduced = clone(accessBootstrap2026Fixture);
    const doors = reduced.floors?.[0]?.doors;

    const emptied = doors?.[2];

    assert.ok(doors);
    assert.ok(emptied);
    doors[2] = { ...emptied, "device_groups": [] };

    const next = applyBootstrap(state, reduced);

    assert.equal(next.devices.has("aabbcc000004"), false, "a device the document no longer carries should leave the map");
    assert.ok(next.devices.has(HUB_ID));
  });

  test("the document is authoritative over a value a live notification had advanced", () => {

    // A notification advances a stored record, then a refresh arrives carrying the older value. The document wins wholesale, which is the eventual-consistency
    // behavior the design accepts: the next notification or refresh advances it again.
    const state = stateFrom(accessBootstrap2026Fixture);
    const packet = findPacket((entry) => (entry.event === "access.data.v2.device.update") && (entry.meta?.id === HUB_ID), "the v2 hub update");
    const advanced = reduce(state, classify(packet));

    assert.equal(advanced.devices.get(HUB_ID)?.revision, "1786095367040183648");

    const refreshed = applyBootstrap(advanced, clone(accessBootstrap2026Fixture));

    assert.equal(refreshed.devices.get(HUB_ID)?.revision, "1785876758583455467", "the document's value replaces the advanced one wholesale");
  });
});

describe("applyBootstrap capability normalization", () => {

  test("a record arriving without a capabilities array is admitted carrying an empty one", () => {

    const document = capabilityLessBootstrap();
    const carrier = document.floors?.[0]?.doors?.[1]?.device_groups?.[0]?.[0];

    assert.ok(carrier);
    assert.equal(carrier.unique_id, HUB_ID);

    const state = applyBootstrap(createInitialState(), document);
    const admitted = state.devices.get(CAPABILITY_LESS_ID);

    assert.ok(admitted, "the record should reach the devices map rather than being turned away");
    assert.deepEqual(admitted.capabilities, [], "admission supplies the array the record arrived without");

    // The substitution is selective rather than a rewrite of everything that passes through: a record that arrived with the array keeps the very array the document
    // carried. The record itself is a copy, because its address takes the library's spelling on the way in, and the array is held in that copy by reference.
    assert.equal(Object.is(state.devices.get(HUB_ID)?.capabilities, carrier.capabilities), true, "a record carrying capabilities keeps its own array");
  });

  test("re-applying a document carrying that record returns the very same state", () => {

    // Two independently built documents, so a pass here cannot come from the two applications sharing input objects. Each application normalizes into a fresh object,
    // so this is what asserts that a substituted record still reconciles down to the stored one rather than minting state on every refresh.
    const state = applyBootstrap(createInitialState(), capabilityLessBootstrap());
    const again = applyBootstrap(state, capabilityLessBootstrap());

    assert.equal(Object.is(again, state), true, "a refresh that found no drift should produce no new state");
    assert.equal(Object.is(again.devices, state.devices), true);
    assert.equal(Object.is(again.devices.get(CAPABILITY_LESS_ID), state.devices.get(CAPABILITY_LESS_ID)), true, "the normalized record keeps its reference");
  });

  test("a notification carrying a whole capability-less record for a device the topology never gave us is a no-op", () => {

    const state = stateFrom(accessBootstrap2026Fixture);

    assert.equal(state.devices.has(CAPABILITY_LESS_ID), false, "no real topology document carries this record");

    const event: AccessTypedEvent = { eventName: "access.data.device.update", id: CAPABILITY_LESS_ID, kind: "deviceChanged", payload: capabilityLessDevice() };
    const next = reduce(state, event);

    // Sharpening the unknown-device no-op above: a device record only ever enters state through the topology flatten, which is what makes normalizing there complete
    // coverage rather than one of two admission paths.
    assert.equal(Object.is(next, state), true, "a notification cannot introduce a device, whatever shape its record arrives in");
    assert.equal(next.devices.has(CAPABILITY_LESS_ID), false);
  });
});

describe("applyBootstrap address spelling", () => {

  // The 2026 document spells this reader's address in uppercase where it spells its siblings' in lowercase, which is the wire's own inconsistency and what makes it
  // the specimen. The premise is asserted first, so the test cannot pass vacuously if the fixture is ever re-captured.
  const G2_ID = "aabbcc000003";

  // One record of a document by identity, failing loudly rather than skipping if the document ever stops carrying it. The record is the document's own object,
  // which is what lets a caller re-spell it in place on a clone.
  const documentRecord = (document: AccessBootstrapConfig, id: string): AccessDeviceConfig => {

    const record = topologyDevices(document).find((candidate) => candidate.unique_id === id);

    assert.ok(record, "the document should carry device " + id);

    return record;
  };

  test("a record whose address the document spells in uppercase with separators is stored in the library's spelling", () => {

    assert.equal(documentRecord(accessBootstrap2026Fixture, G2_ID).mac, "AA:BB:CC:00:00:03", "the document itself spells this address with separators");

    const stored = stateFrom(accessBootstrap2026Fixture).devices.get(G2_ID);

    assert.ok(stored);
    assert.equal(stored.mac, "AABBCC000003");
  });

  test("a record that already carries the library's spelling is admitted as the very object the document carried", () => {

    // No captured topology document spells an address the library's way, so the record is prepared on a clone: the assertion is that the fold hands back the very
    // object when it has nothing to do, which is what keeps a canonical record from being rebuilt on every pass.
    const document = clone(accessBootstrap2026Fixture);
    const carrier = documentRecord(document, HUB_ID);

    carrier.mac = "AABBCC000001";

    assert.equal(Object.is(applyBootstrap(createInitialState(), document).devices.get(HUB_ID), carrier), true, "nothing to fold means nothing to rebuild");
  });

  test("a document that re-spells every address in the other case reconciles to the very same state", () => {

    // The controller does exactly this between reads of one site. A refresh that only re-cased addresses must be the no-op the failsafe promises, all the way up
    // to the state reference itself.
    const state = stateFrom(accessBootstrap2026Fixture);
    const recased = clone(accessBootstrap2026Fixture);

    for(const record of topologyDevices(recased)) {

      record.mac = (record.mac === record.mac.toUpperCase()) ? record.mac.toLowerCase() : record.mac.toUpperCase();
    }

    assert.notDeepEqual(topologyDevices(recased).map((record) => record.mac), topologyDevices(accessBootstrap2026Fixture).map((record) => record.mac),
      "the re-cased document really does differ from the original");
    assert.equal(Object.is(applyBootstrap(state, recased), state), true, "a refresh that only re-cased addresses should produce no new state");
  });

  test("the rule reaches a record's own address and nothing nested inside it", () => {

    // A hub embeds the camera records it serves - the companion Protect controller's own material, which this library does not model. Those are wire material inside
    // the record rather than the record's own identity, so they are kept exactly as sent. The wire happens to spell them the library's way already, which would make
    // an assertion on the captured value vacuous, so the nested address is re-spelled on a clone and must come back untouched.
    const document = clone(accessBootstrap2026Fixture);
    const camera = documentRecord(document, HUB_ID).cameras?.[0];

    assert.ok(camera, "the hub should embed a camera record");
    assert.equal(camera["mac"], "AABBCC000002", "the document itself spells the embedded address the library's way");
    camera["mac"] = "aa:bb:cc:00:00:02";

    assert.equal(applyBootstrap(createInitialState(), document).devices.get(HUB_ID)?.cameras?.[0]?.["mac"], "aa:bb:cc:00:00:02");
  });
});

describe("deviceChanged", () => {

  test("merges a real sparse v2 payload, updating what changed and preserving what did not", () => {

    const state = stateFrom(accessBootstrap2026Fixture);
    const stored = state.devices.get(HUB_ID);

    assert.ok(stored);
    assert.equal(stored.revision, "1785876758583455467");

    const packet = findPacket((entry) => (entry.event === "access.data.v2.device.update") && (entry.meta?.id === HUB_ID), "the v2 hub update");
    const next = reduce(state, classify(packet));
    const merged = next.devices.get(HUB_ID);

    assert.ok(merged);
    assert.equal(merged.revision, "1786095367040183648", "the changed field should take the notification's value");
    assert.notEqual(Object.is(merged, stored), true, "a changed device should be a new reference");

    // Everything the sparse payload did not mention survives, and the nested objects it did not touch keep their references.
    assert.equal(Object.is(merged.images, stored.images), true, "an untouched nested object should keep its reference");
    assert.equal(Object.is(merged.configs, stored.configs), true);
    assert.equal(merged.mac, stored.mac);
    assert.equal(merged.name, stored.name);
    assert.equal(Object.is(next.doors, state.doors), true, "a device change should not disturb the other collections");
  });

  test("a merge that changes nothing returns the very same state", () => {

    const state = stateFrom(accessBootstrap2026Fixture);
    const packet = findPacket((entry) => (entry.event === "access.data.v2.device.update") && (entry.meta?.id === HUB_ID), "the v2 hub update");
    const event = classify(packet);
    const once = reduce(state, event);
    const twice = reduce(once, event);

    assert.notEqual(Object.is(once, state), true, "the first application really did change something");
    assert.equal(Object.is(twice, once), true, "re-applying the same notification should produce no new state");
    assert.equal(Object.is(twice.devices, once.devices), true);
    assert.equal(Object.is(twice.devices.get(HUB_ID), once.devices.get(HUB_ID)), true);
  });

  test("a null-valued field means not-carried and leaves the stored value standing", () => {

    // A routine legacy update nulls more than a dozen keys whose stored values are real, so a merge that honored null as a clear would erase live state.
    const state = stateFrom(seededBootstrap());
    const stored = state.devices.get(DOORBELL_ID);

    assert.ok(stored);

    // The seeded record is a clone of the document's own first device, so its stored values are that device's.
    assert.equal(stored.revision, "1764007943753538037");

    const packet = findPacket((entry) => (entry.event === "access.data.device.update") && (entry.event_object_id === DOORBELL_ID), "the legacy doorbell update");

    assert.equal(packet.data?.["revision"], null, "this specimen really does null the field");
    assert.equal(packet.data?.["last_seen"], null);

    const next = reduce(state, classify(packet));
    const merged = next.devices.get(DOORBELL_ID);

    assert.ok(merged);
    assert.equal(merged.revision, "1764007943753538037", "a null must not clear a stored value");
    assert.equal(merged.last_seen, stored.last_seen);

    // The same payload's non-null fields do land, so the skip is selective rather than the merge doing nothing at all.
    assert.equal(merged.firmware, "5.3.95");
  });

  test("a partial nested object merges key by key rather than replacing its siblings", () => {

    const state = stateFrom(accessBootstrap2026Fixture);
    const stored = state.devices.get(READER_ID);

    assert.ok(stored);

    // The topology census establishes the icon set, which is what these reads assert before comparing against it - the stored type states only that a census may
    // have established it, because the official inventory carries no icons at all.
    assert.ok(stored.images);

    const originalMedium = stored.images.m;
    const originalSmall = stored.images.s;

    assert.ok(originalMedium);
    assert.ok(originalSmall);

    // A payload naming one key of a nested object. A shallow merge would drop every sibling key the payload did not mention.
    const event: AccessTypedEvent = { eventName: "access.data.device.update", id: READER_ID, kind: "deviceChanged",
      payload: { images: { l: "https://example.invalid/icon-64.png" } } };
    const merged = reduce(state, event).devices.get(READER_ID);

    assert.ok(merged);
    assert.ok(merged.images);
    assert.equal(merged.images.l, "https://example.invalid/icon-64.png", "the named key should land");
    assert.equal(merged.images.m, originalMedium, "a sibling key should survive with its value");
    assert.equal(merged.images.s, originalSmall);
    assert.notEqual(Object.is(merged.images, stored.images), true, "the changed nested object should be a new reference");
    assert.equal(Object.is(merged.configs, stored.configs), true, "an unrelated nested value should keep its reference");
  });

  test("a notification restating the stored address in the other case is a no-op by reference", () => {

    // The controller re-cases an address between one read and the next, and the older dialect carries the address on every update. Folding the payload before the
    // merge is what makes this the reference-preserving no-op it is; folding after it would mint a new record - and wake every observer - for a spelling.
    const state = stateFrom(accessBootstrap2026Fixture);
    const stored = state.devices.get(HUB_ID);

    assert.ok(stored);
    assert.equal(stored.mac, "AABBCC000001");

    const event: AccessTypedEvent = { eventName: "access.data.device.update", id: HUB_ID, kind: "deviceChanged", payload: { "mac": "AA:BB:CC:00:00:01" } };

    assert.equal(Object.is(reduce(state, event), state), true, "a re-spelled address changes nothing, so the state reference must not move");
  });

  test("a notification carrying a real change beside a re-cased address stores the address in the library's spelling", () => {

    const state = stateFrom(accessBootstrap2026Fixture);
    const stored = state.devices.get(HUB_ID);

    assert.ok(stored);
    // The premise, asserted so the row cannot pass on a value the record already holds: the firmware below is a real change to this record.
    assert.notEqual(stored.firmware, "v9.9.9");

    const event: AccessTypedEvent = { eventName: "access.data.device.update", id: HUB_ID, kind: "deviceChanged",
      payload: { "firmware": "v9.9.9", "mac": "AA:BB:CC:00:00:01" } };
    const next = reduce(state, event);
    const merged = next.devices.get(HUB_ID);

    assert.ok(merged);
    assert.notEqual(Object.is(next, state), true, "a real change moves the state");
    assert.equal(merged.firmware, "v9.9.9", "the real change lands");
    assert.equal(merged.mac, "AABBCC000001", "the address keeps the library's spelling whatever spelling the payload used");
  });

  test("a null address in a payload reaches the merge's own null rule rather than the fold", () => {

    // A routine legacy update nulls fields whose stored values are real, and the merge reads a null as not-carried. The fold has no opinion about a null and must
    // not turn it into anything the merge would then honor.
    const state = stateFrom(accessBootstrap2026Fixture);
    const event: AccessTypedEvent = { eventName: "access.data.device.update", id: HUB_ID, kind: "deviceChanged", payload: { "mac": null } };

    assert.equal(Object.is(reduce(state, event), state), true, "a null is not-carried, so nothing changes");
    assert.equal(reduce(state, event).devices.get(HUB_ID)?.mac, "AABBCC000001");
  });

  test("a notification for a device the topology never gave us leaves the state untouched", () => {

    const state = stateFrom(accessBootstrap2026Fixture);

    assert.equal(state.devices.has(DOORBELL_ID), false, "the camera-class doorbell is in no real topology document");

    const packet = findPacket((entry) => (entry.event === "access.data.device.update") && (entry.event_object_id === DOORBELL_ID), "the legacy doorbell update");
    const next = reduce(state, classify(packet));

    assert.equal(Object.is(next, state), true, "membership comes from the topology, so an unknown device is a no-op");
    assert.equal(next.devices.has(DOORBELL_ID), false);
  });
});

/* The device-record merge, the one entry every path into a stored device record takes. What these assert is the pair of collections that would otherwise replace
 * wholesale - the configuration rows, joined by row identity, and the capability set, joined by union - and the reference discipline each of them keeps.
 */
describe("the device-record merge", () => {

  // A capability no captured listing or document carries, so a test asserting that a delivery can only add is naming something no census could have supplied.
  const ADDED_CAPABILITY = "test_only_capability";

  // A well-formed row under an identity no captured device holds, carrying every member the wire type requires.
  const NEW_ROW = { "device_id": HUB_ID, "key": "test_only_row", "tag": "test_only", "value": "1" };

  // The rows a device holds, with the suite failing loudly rather than asserting over an array that is not there.
  const heldRows = (state: AccessState, id: string): AccessDeviceEntryConfig[] => {

    const rows = state.devices.get(id)?.configs;

    assert.ok(rows, "the record for " + id + " should carry configuration rows");

    return rows;
  };

  // One row of a held array by position, so an assertion about a neighbour is about a row that is really there rather than about two absences comparing equal.
  const rowAt = (rows: readonly AccessDeviceEntryConfig[], index: number): AccessDeviceEntryConfig => {

    const row = rows[index];

    assert.ok(row, "the array should carry a row at index " + String(index));

    return row;
  };

  // The capabilities a device holds, on the same failing-loudly terms.
  const heldCapabilities = (state: AccessState, id: string): string[] => {

    const capabilities = state.devices.get(id)?.capabilities;

    assert.ok(capabilities, "the record for " + id + " should carry a capability set");

    return capabilities;
  };

  // A device update carrying nothing but a configuration-row array, which is the delivery shape most of these assertions are about.
  const rowDelivery = (rows: AccessDeviceConfigPayload["configs"]): AccessTypedEvent => ({ eventName: "access.data.device.update", id: HUB_ID,
    kind: "deviceChanged", payload: { configs: rows } });

  // The same, carrying nothing but a capability list.
  const capabilityDelivery = (capabilities: readonly string[]): AccessTypedEvent => ({ eventName: "access.data.device.update", id: HUB_ID,
    kind: "deviceChanged", payload: { capabilities: [...capabilities] } });

  /* A state seeded the way a token-only client's is: the official listing projected into device records, which carry a capability set and no configuration rows at
   * all. It is the starting point for a record whose rows a delivery is the first to establish.
   */
  const listingSeeded = (): AccessState => reduce(createInitialState(), { complete: false,
    devices: accessOfficialDevicesFixture.flat().map(officialDeviceRecord), doorStates: [], doors: [], kind: "censusApplied" });

  test("a delivery naming one row leaves every other row standing, each by its own reference", () => {

    const state = stateFrom(accessBootstrap2026Fixture);
    const held = heldRows(state, HUB_ID);
    const merged = heldRows(reduce(state, rowDelivery([{ ...rowAt(held, 0), "value": "Renamed" }])), HUB_ID);

    // Wholesale replacement would store the one row the delivery named and lose every other row the document supplied, which is what makes this the assertion
    // that the keyed merge landed at all.
    assert.equal(merged.length, held.length, "a delivery that named one row said nothing about the rest");

    for(const [ index, row ] of held.entries()) {

      if(index === 0) {

        continue;
      }

      assert.equal(Object.is(rowAt(merged, index), row), true, "the row at index " + String(index) + " should be the very object the document supplied");
    }
  });

  test("a changed row is replaced at the position it already held", () => {

    const state = stateFrom(accessBootstrap2026Fixture);
    const held = heldRows(state, HUB_ID);
    const target = held.findIndex((row) => row.key === "dps_mode");

    assert.ok((target > 0) && (target < (held.length - 1)), "the hub's rows should carry the door-position mode with a neighbour on either side");

    const merged = heldRows(reduce(state, rowDelivery([{ "key": "dps_mode", "value": "not_available" }])), HUB_ID);

    assert.equal(rowAt(merged, target).key, "dps_mode", "a changed row stays where the document put it rather than moving to the tail");
    assert.equal(rowAt(merged, target).value, "not_available");
    assert.equal(rowAt(merged, target).tag, rowAt(held, target).tag, "and keeps the members the delivery was silent about");
    assert.notEqual(Object.is(rowAt(merged, target), rowAt(held, target)), true, "the changed row is a new reference");
    assert.equal(Object.is(rowAt(merged, target - 1), rowAt(held, target - 1)), true, "while the rows around it are not");
    assert.equal(Object.is(rowAt(merged, target + 1), rowAt(held, target + 1)), true);
  });

  test("a delivery restating a row exactly returns the held array and the held state", () => {

    /* The no-op guarantee, which the keyed path has to preserve rather than establish: the generic merge already satisfied it, and a keyed join that rebuilt the
     * array on every delivery would wake every observer of the device on every update the controller sent.
     */
    const state = stateFrom(accessBootstrap2026Fixture);
    const held = heldRows(state, HUB_ID);
    const next = reduce(state, rowDelivery([{ ...rowAt(held, 0) }]));

    assert.equal(Object.is(next, state), true, "a delivery that changed nothing changes nothing at all");
    assert.equal(Object.is(heldRows(next, HUB_ID), held), true, "down to the array's own reference");
  });

  test("a row the record has never held is appended after the rows it has", () => {

    const state = stateFrom(accessBootstrap2026Fixture);
    const held = heldRows(state, HUB_ID);
    const merged = heldRows(reduce(state, rowDelivery([NEW_ROW])), HUB_ID);

    assert.equal(merged.length, held.length + 1);
    assert.deepEqual(rowAt(merged, merged.length - 1), NEW_ROW, "the new row lands at the tail, which is where the delivery order puts it");
    assert.equal(Object.is(rowAt(merged, 0), rowAt(held, 0)), true, "and the held rows are untouched");
  });

  test("a row carrying no identity is ignored", () => {

    const state = stateFrom(accessBootstrap2026Fixture);
    const held = heldRows(state, HUB_ID);
    const next = reduce(state, rowDelivery([{ "device_id": HUB_ID, "tag": "test_only", "value": "1" }]));

    assert.equal(Object.is(next, state), true, "a row that names nothing can neither match a held row nor be admitted as a new one");
    assert.equal(Object.is(heldRows(next, HUB_ID), held), true);
  });

  test("a row the record has never held is admitted only when it carries every member the wire type requires", () => {

    const state = stateFrom(accessBootstrap2026Fixture);
    const held = heldRows(state, HUB_ID);
    const merged = heldRows(reduce(state, rowDelivery([ { "device_id": HUB_ID, "key": "test_only_missing_tag", "value": "1" },
      { "device_id": HUB_ID, "key": "test_only_missing_value", "tag": "test_only" }, NEW_ROW ])), HUB_ID);

    // Not admitted rather than invented: an incomplete row stored as though it were whole would read back as a row the controller had sent whole.
    assert.equal(merged.length, held.length + 1, "only the complete row joined the record");
    assert.deepEqual(rowAt(merged, merged.length - 1), NEW_ROW);
  });

  test("a record holding no rows at all admits the well-formed rows of a delivery and nothing else", () => {

    // The token-only census establishes no configuration rows, so here the admission guard governs the whole delivered array rather than only its new members.
    const state = listingSeeded();

    assert.equal(state.devices.get(HUB_ID)?.configs, undefined, "a projected listing establishes no rows");

    const merged = heldRows(reduce(state, rowDelivery([ NEW_ROW, { "device_id": HUB_ID, "key": "test_only_incomplete", "value": "1" } ])), HUB_ID);

    assert.deepEqual(merged, [NEW_ROW]);
  });

  test("a full snapshot that stops carrying a row leaves it standing", () => {

    /* The documented cost of reading absence as silence, asserted so the trade-off is deliberate rather than accidental. The merge cannot tell a row the
     * controller dropped from one it simply did not mention, so a dropped row outlives its deletion until a full topology reconcile replaces the record outright.
     */
    const state = stateFrom(accessBootstrap2026Fixture);
    const held = heldRows(state, HUB_ID);
    const merged = heldRows(reduce(state, rowDelivery(held.slice(1))), HUB_ID);

    assert.equal(merged.length, held.length);
    assert.equal(Object.is(rowAt(merged, 0), rowAt(held, 0)), true, "the row the snapshot omitted is the very one the document supplied");
  });

  test("a capability list naming a subset leaves the held set whole, by its own reference", () => {

    const state = stateFrom(accessBootstrap2026Fixture);
    const held = heldCapabilities(state, HUB_ID);
    const next = reduce(state, capabilityDelivery(["is_hub"]));

    assert.equal(Object.is(next, state), true, "a list that said less than the record holds says nothing new");
    assert.equal(Object.is(heldCapabilities(next, HUB_ID), held), true, "and the held set comes back by reference");
  });

  test("a capability list carrying a member the record lacks appends it after the held ones", () => {

    const state = stateFrom(accessBootstrap2026Fixture);
    const held = heldCapabilities(state, HUB_ID);
    const merged = heldCapabilities(reduce(state, capabilityDelivery([ ADDED_CAPABILITY, ADDED_CAPABILITY ])), HUB_ID);

    // Repeating a member within one delivery stores it once, which is what makes this a set rather than a concatenation.
    assert.deepEqual(merged, [ ...held, ADDED_CAPABILITY ]);
  });

  test("a capability list that stops carrying a member leaves it standing", () => {

    // The union's own half of the documented cost: a capability is added by a delivery and removed only by a full reconcile.
    const state = stateFrom(accessBootstrap2026Fixture);
    const held = heldCapabilities(state, HUB_ID);

    assert.ok(held.includes("is_hub"));

    const merged = heldCapabilities(reduce(state, capabilityDelivery(held.filter((capability) => capability !== "is_hub"))), HUB_ID);

    assert.deepEqual(merged, held, "a hub that stopped listing its own hub capability is still a hub");
  });

  test("a delivery naming one held row twice layers the later row onto the earlier one", () => {

    const state = stateFrom(accessBootstrap2026Fixture);
    const held = heldRows(state, HUB_ID);
    const target = held.findIndex((row) => row.key === "dps_mode");

    assert.ok(target >= 0, "the hub's rows should carry the door-position mode");

    // Two partial rows under one identity, each naming a member the other does not. Resolving each against the rows as merged so far keeps both statements, where
    // resolving each against the held row alone lets the second discard the first.
    const merged = heldRows(reduce(state, rowDelivery([ { "key": "dps_mode", "value": "not_available" }, { "key": "dps_mode", "tag": "test_only_tag" } ])), HUB_ID);

    assert.equal(merged.length, held.length, "a repeated identity adds no row");
    assert.equal(rowAt(merged, target).value, "not_available", "the first row's statement survives the second");
    assert.equal(rowAt(merged, target).tag, "test_only_tag", "and the second row's statement lands on top of it");
  });

  test("a delivery carrying a row the record has never held twice admits it once, carrying the later statement", () => {

    const state = stateFrom(accessBootstrap2026Fixture);
    const held = heldRows(state, HUB_ID);
    const merged = heldRows(reduce(state, rowDelivery([ NEW_ROW, { ...NEW_ROW, "value": "2" } ])), HUB_ID);

    assert.equal(merged.length, held.length + 1, "one identity, one row");
    assert.deepEqual(rowAt(merged, merged.length - 1), { ...NEW_ROW, "value": "2" }, "and the row carries the later statement");
  });
});

describe("deviceRemoved", () => {

  test("both delete dialects remove a seeded device", () => {

    for(const name of [ "access.data.device.delete", "access.data.v2.device.delete" ]) {

      const state = stateFrom(seededBootstrap());

      assert.ok(state.devices.has(DOORBELL_ID));

      const packet = findPacket((entry) => entry.event === name, "a " + name + " packet");
      const event = classify(packet);

      assert.equal(event.kind, "deviceRemoved");

      const next = reduce(state, event);

      assert.equal(next.devices.has(DOORBELL_ID), false, name + " should remove the device");
      assert.equal(next.devices.size, state.devices.size - 1);

      // Removing a device disturbs nothing else.
      assert.equal(Object.is(next.doors, state.doors), true);
      assert.equal(Object.is(next.floors, state.floors), true);
      assert.equal(Object.is(next.root, state.root), true);
    }
  });

  test("removing a device we do not hold returns the very same state", () => {

    const state = stateFrom(accessBootstrap2026Fixture);
    const packet = findPacket((entry) => entry.event === "access.data.v2.device.delete", "a v2 device delete");

    assert.equal(Object.is(reduce(state, classify(packet)), state), true);
  });
});

describe("locationChanged", () => {

  test("a real v2 door notification lands its translated fields and skips the null one", () => {

    const state = stateFrom(accessBootstrap2026Fixture);
    const stored = state.doors.get(DOOR_HUB);

    assert.ok(stored);

    const storedExtras = stored.extras;
    const packet = findPacket((entry) => (entry.event === "access.data.v2.location.update") && (entry.meta?.id === DOOR_HUB), "a v2 door update");
    const event = classify(packet);

    assert.equal(event.kind, "locationChanged");
    assert.equal(event.payload.extras, null, "this specimen really does null the extras");

    const next = reduce(state, event);
    const merged = next.doors.get(DOOR_HUB);

    assert.ok(merged);
    assert.equal(merged.unique_id, DOOR_HUB);
    assert.equal(merged.name, "Test Name 10");
    assert.equal(merged.location_type, "door");

    // The null extras is not-carried rather than a clear, so the stored value stands.
    assert.equal(Object.is(merged.extras, storedExtras), true, "a null extras must not clear the stored extras");

    // No translated location payload can re-introduce the pruned collection.
    assert.equal(Object.hasOwn(merged, "device_groups"), false);
  });

  test("a real legacy door notification merges into the same door", () => {

    const state = stateFrom(accessBootstrap2026Fixture);
    const packet = findPacket((entry) => (entry.event === "access.data.location.update") && (entry.event_object_id === DOOR_HUB), "the legacy door update");
    const next = reduce(state, classify(packet));
    const merged = next.doors.get(DOOR_HUB);

    assert.ok(merged);
    assert.equal(merged.full_name, "Test Name 11");
    assert.equal(Object.hasOwn(merged, "device_groups"), false);
  });

  test("a floor-targeted notification merges into the floors map", () => {

    // No captured notification targets a floor, so this one is synthetic; the routing it exercises is real.
    const state = stateFrom(accessBootstrap2026Fixture);
    const event: AccessTypedEvent = { eventName: "access.data.location.update", id: FLOOR_2026, kind: "locationChanged", payload: { name: "Ground Floor" } };
    const next = reduce(state, event);

    assert.equal(next.floors.get(FLOOR_2026)?.name, "Ground Floor");
    assert.equal(Object.hasOwn(next.floors.get(FLOOR_2026) ?? {}, "doors"), false, "merging must not re-introduce the pruned collection");
    assert.equal(Object.is(next.doors, state.doors), true);
    assert.equal(Object.is(next.devices, state.devices), true);
  });

  test("a root-targeted notification merges into the root record", () => {

    // Synthetic as well, for the same reason: the corpus's location notifications all name the same door.
    const state = stateFrom(accessBootstrap2026Fixture);
    const event: AccessTypedEvent = { eventName: "access.data.location.update", id: ROOT_2026, kind: "locationChanged", payload: { name: "Acme HQ Campus" } };
    const next = reduce(state, event);

    assert.equal(next.root?.name, "Acme HQ Campus");
    assert.equal(next.root?.unique_id, ROOT_2026);
    assert.equal(Object.hasOwn(next.root ?? {}, "floors"), false, "merging must not re-introduce the pruned collections");
    assert.equal(Object.hasOwn(next.root ?? {}, "device_groups"), false);
    assert.equal(Object.is(next.floors, state.floors), true);
  });

  test("a notification naming no location we hold returns the very same state", () => {

    const state = stateFrom(accessBootstrap2026Fixture);
    const event: AccessTypedEvent = { eventName: "access.data.location.update", id: "1d2f9d3f-0000-4000-8000-000000000000", kind: "locationChanged",
      payload: { name: "Nowhere" } };

    assert.equal(Object.is(reduce(state, event), state), true);
  });

  test("a merge that changes nothing returns the very same state", () => {

    const state = stateFrom(accessBootstrap2026Fixture);
    const event: AccessTypedEvent = { eventName: "access.data.location.update", id: DOOR_HUB, kind: "locationChanged", payload: { name: "Test Name 10" } };

    assert.equal(Object.is(reduce(state, event), state), true);
  });

  test("a floor merge that changes nothing returns the very same state", () => {

    const state = stateFrom(accessBootstrap2026Fixture);
    const event: AccessTypedEvent = { eventName: "access.data.location.update", id: FLOOR_2026, kind: "locationChanged", payload: { name: "Test Name 2" } };

    assert.equal(Object.is(reduce(state, event), state), true);
  });

  test("a root merge that changes nothing returns the very same state", () => {

    const state = stateFrom(accessBootstrap2026Fixture);
    const event: AccessTypedEvent = { eventName: "access.data.location.update", id: ROOT_2026, kind: "locationChanged", payload: { name: "Test Name 1" } };

    assert.equal(Object.is(reduce(state, event), state), true);
  });
});

describe("activity signals and the exhaustiveness guard", () => {

  test("the occurrence kinds leave the state untouched", () => {

    const state = stateFrom(accessBootstrap2026Fixture);
    const events: AccessTypedEvent[] = [

      { eventName: "access.data.device.remote_unlock", id: HUB_ID, kind: "unlock" },
      { eventName: "access.remote_view.change", kind: "doorbellCancel", payload: { "reason_code": 0, "remote_call_request_id": "call" } },
      { eventName: "access.remote_view", id: READER_ID, kind: "doorbellRing",
        payload: { "channel": "channel", "clear_request_id": "", "connected_uah_id": "", "connected_uah_type": "", "controller_id": "", "create_time": 0,
          "device_id": READER_ID, "device_name": "", "device_type": "", "door_guard_ids": [], "door_name": "", "floor_name": "", "host_device_mac": "",
          "in_or_out": "", "reason_code": 0, "request_id": "", "room_id": "", "support_feature": [], "token": "" } }
    ];

    for(const event of events) {

      assert.equal(Object.is(reduce(state, event), state), true, event.kind + " should not change the state");
    }
  });

  test("an unrecognized event kind is a loud failure rather than a silent fall-through", () => {

    const state = stateFrom(accessBootstrap2026Fixture);
    const rogue = { eventName: "access.invented", id: HUB_ID, kind: "inventedKind" } as unknown as AccessTypedEvent;

    assert.throws(() => reduce(state, rogue), AccessProtocolError);
    assert.throws(() => reduce(state, rogue), /inventedKind/);
  });

  test("a bootstrap dispatched through reduce reaches the same place as applying it directly", () => {

    const viaReduce = reduce(createInitialState(), bootstrapEvent(clone(accessBootstrap2026Fixture)));
    const viaApply = applyBootstrap(createInitialState(), clone(accessBootstrap2026Fixture));

    assert.deepEqual([...viaReduce.devices.keys()].sort(), [...viaApply.devices.keys()].sort());
    assert.equal(viaReduce.root?.unique_id, viaApply.root?.unique_id);
  });
});

describe("doorStateChanged", () => {

  test("a door-state event writes the wire's own complete report over what the hardware was read to say", () => {

    const empty = createInitialState();

    assert.equal(empty.doorStates.size, 0, "a state that has applied no document at all carries none");
    assert.equal(empty.controller, null);

    const state = stateFrom(accessBootstrap2026Fixture);
    const seeded = state.doorStates.get(DOOR_MINI_DOOR);

    // What the document's own hardware flags established for this door: an unwired sensor and a locked relay, and nothing about the members only a report carries.
    assert.ok(seeded);
    assert.equal(seeded.dps, "none");
    assert.equal(Object.hasOwn(seeded, "emergency"), false, "a seeded entry states only what its source answered");

    const next = reduce(state, classifyDoorState((entry) => entry.states[0]?.dps === "close"));
    const stored = next.doorStates.get(DOOR_MINI_DOOR);

    // The report replaces it wholesale, which is how a live reading always wins over an interpretation of hardware flags.
    assert.ok(stored, "the reported door carries the wire's entry");
    assert.equal(stored.lock, "locked");
    assert.equal(stored.dps, "close");
    assert.ok(stored.emergency, "and the members only a report carries are now present");
    assert.equal(next.doorStates.size, state.doorStates.size, "the packet reported a door the document had already established");
  });

  test("re-applying the same report keeps the stored entry and the map reference", () => {

    // Two independent parses of the same specimen, so a pass here cannot come from the two events sharing an object.
    const state = reduce(stateFrom(accessBootstrap2026Fixture), classifyDoorState((entry) => entry.states[0]?.dps === "close"));
    const again = reduce(state, classifyDoorState((entry) => entry.states[0]?.dps === "close"));

    assert.equal(Object.is(again, state), true, "a door reporting what it already reported changes nothing");
    assert.equal(Object.is(again.doorStates, state.doorStates), true);
    assert.equal(Object.is(again.doorStates.get(DOOR_MINI_DOOR), state.doorStates.get(DOOR_MINI_DOOR)), true);
  });

  test("a later report replaces the entry wholesale, so an omitted optional reads as cleared", () => {

    /* The corpus supplies both halves of this: the same door reports a force-unlock alarm, then reports again without one. Replacement is what makes the second
     * report mean the alarm cleared - a merge would leave the alarm standing forever, because there is no way for the wire to say "and no alarms" other than by
     * omitting the member.
     */
    const alarmed = reduce(stateFrom(accessBootstrap2026Fixture), classifyDoorState((entry) => entry.states[0]?.alarms !== undefined));

    assert.deepEqual(alarmed.doorStates.get(DOOR_MINI_DOOR)?.alarms, [{ type: "force_unlock" }]);

    const cleared = reduce(alarmed, classifyDoorState((entry) => (entry.states[0]?.alarms === undefined) && (entry.states[0]?.lock === "unlocked")));
    const stored = cleared.doorStates.get(DOOR_MINI_DOOR);

    assert.ok(stored);
    assert.equal(stored.alarms, undefined, "the omitted optional reads as cleared rather than as unmentioned");
    assert.equal(stored.lock, "unlocked", "and the rest of the entry advanced");
  });

  test("the device facet advances the device record it names", () => {

    // The Door Mini is in the 2026 topology, so the facet has a record to merge onto.
    const state = stateFrom(accessBootstrap2026Fixture);
    const stored = state.devices.get(DOOR_MINI);

    assert.ok(stored);

    const before = stored.revision;
    const event = classifyDoorState((entry) => entry.states[0]?.dps === "close");

    assert.equal(event.kind, "doorStateChanged");
    assert.ok(event.device, "this specimen is the device carrier");

    const merged = reduce(state, event).devices.get(DOOR_MINI);

    assert.ok(merged);

    // Field-level assertions rather than a reference comparison: the facet's own translated values have to land, and the fields it did not mention have to survive.
    assert.equal(merged.revision, event.device.payload.revision);
    assert.notEqual(merged.revision, before, "the facet really did advance the record");
    assert.equal(merged.ip, "192.0.2.17");
    assert.equal(merged.mac, stored.mac, "a field the facet never mentions is untouched");
    assert.equal(merged.name, stored.name);
  });

  test("the location facet advances the door record it names", () => {

    const state = stateFrom(accessBootstrap2026Fixture);
    const stored = state.doors.get(DOOR_MINI_DOOR);

    assert.ok(stored);

    const event = classifyDoorState((entry) => entry.location !== undefined);

    assert.equal(event.kind, "doorStateChanged");
    assert.ok(event.location, "this specimen is the location carrier");

    const merged = reduce(state, event).doors.get(DOOR_MINI_DOOR);

    assert.ok(merged);
    assert.equal(merged.name, "Test Name 22");
    assert.equal(merged.location_type, "door");
    assert.equal(merged.unique_id, DOOR_MINI_DOOR);
    assert.equal(merged.full_name, stored.full_name, "a field the facet never mentions is untouched");
    assert.equal(Object.hasOwn(merged, "device_groups"), false, "and the pruned collection is not re-introduced");
  });

  test("a fresh topology prunes the doors it no longer carries and preserves the rest by reference", () => {

    /* Two doors reporting state. Both reports carry an empty device facet, which merges nothing, so the only thing this state differs from the document by is the
     * door state itself - which is what lets the no-drift assertion below be about pruning rather than about the facet's own merge being reverted.
     */
    const state = reduce(reduce(stateFrom(accessBootstrap2026Fixture), syntheticDoorState(DOOR_MINI_DOOR)), syntheticDoorState(DOOR_HUB));

    // Three doors on this document, each carrying an entry: two that reported and one the hardware flags alone established.
    assert.equal(state.doorStates.size, 3);

    const survivor = state.doorStates.get(DOOR_HUB);

    // A document carrying no drift changes nothing at all, the map reference included, so the failsafe stays invisible to an observer of door state.
    const unchanged = reduce(state, bootstrapEvent(clone(accessBootstrap2026Fixture)));

    assert.equal(Object.is(unchanged, state), true);
    assert.equal(Object.is(unchanged.doorStates, state.doorStates), true);

    // A document that dropped the Door Mini's door prunes its entry and leaves the survivor's own reference untouched.
    const reduced = clone(accessBootstrap2026Fixture);
    const floor = reduced.floors?.[0];

    assert.ok(floor);
    floor.doors = floor.doors.filter((door) => door.unique_id !== DOOR_MINI_DOOR);

    const pruned = reduce(state, bootstrapEvent(reduced));

    assert.equal(pruned.doorStates.has(DOOR_MINI_DOOR), false, "the departed door's state left with it");
    assert.equal(pruned.doorStates.size, 2);
    assert.equal(Object.is(pruned.doorStates.get(DOOR_HUB), survivor), true, "the surviving entry keeps its exact reference");
  });

  test("removing a device leaves the door state it reported standing", () => {

    const state = reduce(stateFrom(seededBootstrap()), syntheticDoorState(DOOR_HUB));
    const before = state.doorStates.size;

    assert.ok(state.doorStates.has(DOOR_HUB));

    const packet = findPacket((entry) => entry.event === "access.data.v2.device.delete", "a v2 device delete");
    const next = reduce(state, classify(packet));

    // Losing the hardware that reported a door is not the door leaving the controller, so its last reported state stands until the topology says otherwise.
    assert.equal(Object.is(next.doorStates, state.doorStates), true, "a device removal does not touch door state");
    assert.equal(next.doorStates.size, before);
  });
});

describe("controllerChanged", () => {

  test("stores the controller document and keeps it on an identical independent parse", () => {

    const state = reduce(stateFrom(accessBootstrap2026Fixture), controllerEvent(clone(accessControllerInfoFixture)));

    assert.equal(state.controller?.host.hostname, "host-2.test.local");
    assert.equal(state.controller.version, accessControllerInfoFixture.version);

    // A second parse of the same document shares no references with the first, so reference preservation here is the structural compare doing its job.
    const again = reduce(state, controllerEvent(clone(accessControllerInfoFixture)));

    assert.equal(Object.is(again, state), true, "a re-served identical document changes nothing");
    assert.equal(Object.is(again.controller, state.controller), true);
  });

  test("advances on a document that differs only in uptime", () => {

    const state = reduce(stateFrom(accessBootstrap2026Fixture), controllerEvent(clone(accessControllerInfoFixture)));
    const before = state.controller?.host.uptime;
    const advanced = clone(accessControllerInfoFixture);

    advanced.host.uptime = (before ?? 0) + 3600;

    const next = reduce(state, controllerEvent(advanced));

    assert.notEqual(Object.is(next, state), true, "the document moved, so the state moved");
    assert.equal(next.controller?.host.uptime, (before ?? 0) + 3600);

    // The controller document advancing does not disturb the topology beside it.
    assert.equal(Object.is(next.root, state.root), true);
    assert.equal(Object.is(next.devices, state.devices), true);
  });

  test("stores the host's address in the library's spelling whichever way the document spelled it", () => {

    // Both wire spellings the controller has produced for the host: the captured document's own, and the same address re-cased as a later read spells it.
    for(const spelling of [ "aa:bb:cc:00:00:0f", "AA:BB:CC:00:00:0F" ]) {

      const document = clone(accessControllerInfoFixture);

      document.host.mac = spelling;

      assert.equal(reduce(stateFrom(accessBootstrap2026Fixture), controllerEvent(document)).controller?.host.mac, "AABBCC00000F", spelling);
    }
  });

  test("keeps the held document on one re-served in another spelling", () => {

    // The controller re-cases the host's address between reads exactly as it does a device's, and a document that differs only in that spelling must wake nobody:
    // the fold runs before the structural compare, which is what lets the compare see the no-op.
    const state = reduce(stateFrom(accessBootstrap2026Fixture), controllerEvent(clone(accessControllerInfoFixture)));
    const recased = clone(accessControllerInfoFixture);

    assert.equal(recased.host.mac, "aa:bb:cc:00:00:0f", "the captured document spells the address with separators, in lowercase");
    recased.host.mac = "AA:BB:CC:00:00:0F";

    const again = reduce(state, controllerEvent(recased));

    assert.equal(Object.is(again, state), true, "a re-spelled address changes nothing, so the state reference must not move");
    assert.equal(Object.is(again.controller, state.controller), true);
  });

  test("leaves every other collection alone on the first document", () => {

    const state = stateFrom(accessBootstrap2026Fixture);
    const next = reduce(state, controllerEvent(clone(accessControllerInfoFixture)));

    assert.equal(Object.is(next.devices, state.devices), true);
    assert.equal(Object.is(next.doors, state.doors), true);
    assert.equal(Object.is(next.floors, state.floors), true);
    assert.equal(Object.is(next.doorStates, state.doorStates), true);
  });
});

describe("the door state entry's honest unknowns", () => {

  /* These rows are compile-surface rather than behavior: they assert that a consumer cannot read a member of a door state entry as though it were always there. A
   * seeded entry states only what its source established, so every member but the door's own identity may be absent, and the compiler is what makes a consumer reckon
   * with that rather than reading a value the entry never carried.
   */
  test("refuses an unguarded read of a member a seeded entry may not carry", () => {

    const entry = stateFrom(accessBootstrap2026Fixture).doorStates.get(DOOR_ULTRA);

    assert.ok(entry);

    // @ts-expect-error - the lock condition is established only where the hardware or the controller answered it.
    const lock: string = entry.lock;

    // @ts-expect-error - the position is established only where a sensor's wiring proves there is one to read.
    const dps: string = entry.dps;

    // @ts-expect-error - whether the sensor is connected is the member the widening exists for, because hardware exists that carries no wiring evidence at all.
    const connected: boolean = entry.dps_connected;

    // The guarded read is what a consumer writes instead, and the values it produces are what this entry actually established.
    assert.equal(lock ?? "locked", "locked");
    assert.equal(dps ?? "none", "none");
    assert.equal(connected ?? false, false);
  });

  test("keeps the door's own identity required, because an entry that names no door addresses nothing", () => {

    const entry = stateFrom(accessBootstrap2026Fixture).doorStates.get(DOOR_ULTRA);

    assert.ok(entry);

    const locationId: string = entry.location_id;

    assert.equal(locationId, DOOR_ULTRA);
  });
});

describe("censusApplied", () => {

  /* One census as the client assembles it, over the captured official listings projected through the census module. Building it through the projections rather
   * than by hand is deliberate: it is the shape the client actually dispatches, so a projection change that broke the reducer's expectations fails here.
   */
  const census = (options: { complete?: boolean; devices?: readonly AccessOfficialDevice[]; doors?: readonly AccessOfficialDoor[] } = {}): AccessTypedEvent => {

    const doors = options.doors ?? accessOfficialDoorsFixture;

    return { complete: options.complete ?? false, devices: (options.devices ?? accessOfficialDevicesFixture.flat()).map(officialDeviceRecord),
      doorStates: doors.map(doorStateEntry), doors: doors.map(officialDoorRecord), kind: "censusApplied" };
  };

  test("admits the devices, the doors, and their state in one reduction", () => {

    const state = reduce(createInitialState(), census());

    assert.equal(state.devices.size, 5);
    assert.equal(state.doors.size, 3);
    assert.equal(state.doorStates.size, 3);

    // The hub and the door it drives landed together, which is the whole reason the three collections travel as one event.
    assert.equal(state.devices.get(HUB_ID)?.location_id, DOOR_HUB);
    assert.equal(state.doors.get(DOOR_HUB)?.name, "Test Name 10");
    assert.equal(state.doorStates.get(DOOR_HUB)?.lock, "locked");

    // Nothing the listing does not carry is invented, at either level.
    assert.equal(Object.hasOwn(state.devices.get(HUB_ID) ?? {}, "firmware"), false);
    assert.equal(state.root, null, "a census places no topology root");
    assert.equal(state.floors.size, 0, "and lists no floors");
  });

  test("admits a device carrying the canonical address, composed by the census before dispatch", () => {

    // The census boundary applies no reducer-side fold: the projection composes the address in the library's spelling from the listing's identifier, so what the
    // state holds here is what the projection produced. Asserted at the state rather than at the projection so the boundary itself is on record.
    assert.equal(reduce(createInitialState(), census()).devices.get(HUB_ID)?.mac, "AABBCC000001");
  });

  test("a second, identical census returns the very same state reference", () => {

    // The no-op guarantee, which is what makes re-reading on the refresh interval invisible. A reconciliation that minted a new map on every pass would fail here.
    const state = reduce(createInitialState(), census());

    assert.equal(Object.is(reduce(state, census()), state), true, "a census that changed nothing wakes no observer");
  });

  test("a census that changes one member mints a new reference and keeps every untouched record by reference", () => {

    const state = reduce(createInitialState(), census());
    const untouched = state.devices.get(READER_ID);
    const renamed = accessOfficialDevicesFixture.flat().map((device) => (device.id === HUB_ID) ? { ...device, "alias": "Front Hub" } : device);
    const next = reduce(state, census({ devices: renamed }));

    assert.notEqual(Object.is(next, state), true, "the changed record advances the state");
    assert.equal(next.devices.get(HUB_ID)?.alias, "Front Hub");
    assert.equal(Object.is(next.devices.get(READER_ID), untouched), true, "an untouched record keeps its reference");
    assert.equal(Object.is(next.doors, state.doors), true, "and an untouched collection keeps its own");
  });

  test("a member the census never speaks of survives a re-census", () => {

    /* The merge half of the contract, and the one that a replace-wholesale implementation would break silently. The socket establishes a firmware the listing has
     * no member for at all, and a later census must leave it standing rather than erasing it by omission.
     */
    const seeded = reduce(createInitialState(), census());
    const withFirmware = reduce(seeded, { eventName: "access.data.device.update", id: HUB_ID, kind: "deviceChanged", payload: { "firmware": "v4.12.19.0" } });

    assert.equal(withFirmware.devices.get(HUB_ID)?.firmware, "v4.12.19.0");

    const reseeded = reduce(withFirmware, census());

    assert.equal(reseeded.devices.get(HUB_ID)?.firmware, "v4.12.19.0", "a member the listing is silent about survives");
    assert.equal(reseeded.devices.get(HUB_ID)?.alias, "Test alias 13", "and the members it does supply still stand");
  });

  test("a complete, non-empty census removes a device and a door it no longer names", () => {

    const seeded = reduce(createInitialState(), census({ complete: true }));
    const fewerDevices = accessOfficialDevicesFixture.flat().filter((device) => device.id !== READER_ID);
    const fewerDoors = accessOfficialDoorsFixture.filter((door) => door.id !== DOOR_ULTRA);
    const next = reduce(seeded, census({ complete: true, devices: fewerDevices, doors: fewerDoors }));

    assert.equal(next.devices.has(READER_ID), false, "the device the enumeration no longer names left with it");
    assert.equal(next.doors.has(DOOR_ULTRA), false, "and so did the door");
    assert.equal(next.doorStates.has(DOOR_ULTRA), false, "and the state that door had reported");
    assert.equal(next.devices.size, 4);
  });

  test("a complete census naming nothing removes nothing at all", () => {

    // The asymmetry the door facts already carry: a degraded controller answering an empty list is a real hazard where losing a site's last record is degenerate.
    const seeded = reduce(createInitialState(), census({ complete: true }));
    const next = reduce(seeded, census({ complete: true, devices: [], doors: [] }));

    assert.equal(Object.is(next, seeded), true, "an enumeration of nothing changes nothing, down to the state reference");
  });

  test("a partial census removes nothing, however few records it names", () => {

    const seeded = reduce(createInitialState(), census({ complete: true }));
    const next = reduce(seeded, census({ devices: [listedDevice(HUB_ID)], doors: [] }));

    assert.equal(next.devices.size, 5, "a source that spoke about one device has said nothing about the others");
    assert.equal(next.doors.size, 3);
  });

  test("a listing that carries no capabilities at all leaves the held set standing, down to the state reference", () => {

    /* The census reaches a stored device record through the same device-record merge the notification path takes, so the union governs the token client's only
     * reconcile too: a degraded listing the projection fills with an empty array can say nothing, and saying nothing has to change nothing.
     */
    const seeded = reduce(createInitialState(), census());
    const held = seeded.devices.get(HUB_ID)?.capabilities;

    assert.ok(held?.length);

    const stripped = accessOfficialDevicesFixture.flat().map((device) => (device.id === HUB_ID) ? { ...device, "capabilities": [] } : device);
    const next = reduce(seeded, census({ devices: stripped }));

    assert.equal(Object.is(next, seeded), true, "a listing that stopped naming a device's capabilities wakes no observer");
    assert.equal(Object.is(next.devices.get(HUB_ID)?.capabilities, held), true);
  });

  test("a listing naming only a capability the record lacks appends it after every held member", () => {

    // Wholesale replacement would leave the record holding the one capability the listing named, which is exactly what a hub classification reads and would then
    // answer false to.
    const seeded = reduce(createInitialState(), census());
    const held = seeded.devices.get(HUB_ID)?.capabilities;

    assert.ok(held);

    const narrowed = accessOfficialDevicesFixture.flat().map((device) => (device.id === HUB_ID) ?
      { ...device, "capabilities": [ "test_only_capability", "test_only_capability" ] } : device);
    const next = reduce(seeded, census({ devices: narrowed }));

    // Repeated within one listing, the new member is stored once.
    assert.deepEqual(next.devices.get(HUB_ID)?.capabilities, [ ...held, "test_only_capability" ]);
  });

  test("a listing leaves a device's configuration rows standing, because it carries none of its own", () => {

    // A regression assertion of the projection's shape rather than a check on the merge: the listing has no configuration rows to offer, so the rows a topology
    // established survive a census by the merge's own absent-key rule, array reference and all.
    const seeded = stateFrom(accessBootstrap2026Fixture);
    const held = seeded.devices.get(HUB_ID)?.configs;

    assert.ok(held?.length);

    const next = reduce(seeded, census());

    assert.equal(Object.is(next.devices.get(HUB_ID)?.configs, held), true, "the rows the document supplied are the rows the record still holds");
    assert.equal(next.devices.get(HUB_ID)?.name, "Test Name 76", "while the members the listing does carry landed");
  });

  test("a census admits a record the state did not hold", () => {

    const seeded = reduce(createInitialState(), census({ complete: true, devices: [listedDevice(HUB_ID)] }));

    assert.equal(seeded.devices.size, 1);

    const next = reduce(seeded, census({ complete: true }));

    assert.equal(next.devices.size, 5, "the records the earlier census never named are admitted whole");
    assert.equal(next.devices.get(READER_ID)?.unique_id, READER_ID);
  });
});

describe("createInitialState", () => {

  test("returns an empty state", () => {

    const state = createInitialState();

    assert.equal(state.devices.size, 0);
    assert.equal(state.doors.size, 0);
    assert.equal(state.floors.size, 0);
    assert.equal(state.root, null);
  });

  test("returns fresh maps each call, so two clients are never aliased to each other", () => {

    const first = createInitialState();
    const second = createInitialState();

    assert.notEqual(Object.is(first.devices, second.devices), true);
    assert.notEqual(Object.is(first.doors, second.doors), true);
    assert.notEqual(Object.is(first.floors, second.floors), true);
  });
});

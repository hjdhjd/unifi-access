/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * selectors.test.ts: Unit tests for the memoized derived views. Two things are pinned throughout: the values each view derives, against named entries of the real
 * topology documents rather than counts re-derived from the same fixture, and the reference identity that makes the observer dedup work - stable across a change the
 * view does not depend on, fresh across one it does.
 */
import type { AccessBootstrapConfig, AccessControllerConfig, AccessDeviceConfig, AccessDeviceConfigPayload } from "../types/index.ts";
import { accessBootstrap2026Fixture, accessBootstrapEahFixture, accessControllerInfoFixture } from "../protocol/topology.fixtures.ts";
import { applyBootstrap, createInitialState, reduce } from "../protocol/reducer.ts";
import { describe, test } from "node:test";
import { isEnterpriseHubRecord, isHub, isReader, selectAccessPoints, selectController, selectControllerName, selectControllerUptime, selectDevicesByType,
  selectDoorDevices, selectDoorStates, selectHubs } from "./selectors.ts";
import type { AccessState } from "../protocol/reducer.ts";
import type { AccessStateDevice } from "../protocol/reducer.ts";
import type { AccessTypedEvent } from "../protocol/events.ts";
import assert from "node:assert/strict";

// Named entries from the 2026 document: three doors, five devices, all of them door-attached.
const DOOR_ULTRA = "00000000-0000-0000-0000-000000000002";
const DOOR_HUB = "00000000-0000-0000-0000-000000000006";
const DOOR_HUB_MINI = "00000000-0000-0000-0000-00000000000e";
const FLOOR_2026 = "00000000-0000-0000-0000-000000000001";
const ULTRA = "aabbcc000000";
const HUB = "aabbcc000001";
const READER_PRO = "aabbcc000002";
const READER_MINI = "aabbcc000003";
const HUB_DOOR_MINI = "aabbcc000004";

// Named entries from the EAH document: nine doors on one floor, with an Enterprise Access Hub the building hosts directly and one door served by its own hub.
const EAH_ROOT = "00000000-0000-0000-0000-000000000011";
const EAH_HUB = "aabbcc000005";
const EAH_DOOR_2 = "00000000-0000-0000-0000-000000000013";
const EAH_DOOR_GARAGE = "00000000-0000-0000-0000-000000000024";
const EAH_DOOR_FRONT = "00000000-0000-0000-0000-000000000017";
const EAH_DOOR_NORTHEAST = "00000000-0000-0000-0000-000000000025";
const EAH_DOOR_NORTHWEST = "00000000-0000-0000-0000-000000000027";
const EAH_GARAGE_HUB = "aabbcc000008";
const EAH_GARAGE_READER = "aabbcc000009";
const EAH_FRONT_READER = "aabbcc000006";
const EAH_NORTHEAST_READER = "aabbcc00000a";
const EAH_NORTHWEST_READER = "aabbcc00000c";

// The port-2 extension of the Enterprise Access Hub, the named access point the per-field mapping is pinned against.
const EAH_PORT_2_EXTENSION = "00000000-0000-0000-0000-00000000002a";

// A second Enterprise Access Hub and its one port, synthesized for the isolation case: no captured topology carries two of them, and the question of whether one
// hub's expansion is cached independently of another's needs two.
const SECOND_EAH_HUB = "02ffee00b004";
const SECOND_EAH_PORT = "00000000-0000-4000-8000-000000000002";

// Every extension identity the hub carries, in the order the document lists them, which is the order the expansion produces.
const EAH_EXTENSIONS = [ "00000000-0000-0000-0000-00000000002a", "00000000-0000-0000-0000-00000000002b", "00000000-0000-0000-0000-00000000002c",
  "00000000-0000-0000-0000-00000000002d", "00000000-0000-0000-0000-00000000002e", "00000000-0000-0000-0000-00000000002f",
  "00000000-0000-0000-0000-000000000030", "00000000-0000-0000-0000-000000000031" ];

// The identity carried by the record that arrives without a capabilities array. No captured document holds a record in that shape, so it is synthesized below under
// an identity of its own, where it can never be confused with a device a fixture supplied.
const CAPABILITY_LESS_ID = "02ffee00b001";

// A fresh structural copy, so a test that mutates or re-applies a document can never pass by sharing the fixture's own object identity.
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const stateFrom = (bootstrap: AccessBootstrapConfig): AccessState => applyBootstrap(createInitialState(), clone(bootstrap));

/* The 2026 document with one record more: a clone of its UA Ultra under an identity of its own, arriving without the capabilities array at all - a shape the
 * field has produced. The member is excluded by naming it in the rest destructure, so the binding exists to be discarded rather than read and the underscore prefix
 * says so, and the downcast admits the result as a device record because the rest type is missing a member the record type requires. It is attached at root level,
 * as hardware the building hosts directly, so every door-hosted record stays exactly as the capture holds it.
 */
const capabilityLessBootstrap = (): AccessBootstrapConfig => {

  const bootstrap = clone(accessBootstrap2026Fixture);
  const template = clone(bootstrap.floors?.[0]?.doors?.[0]?.device_groups?.[0]?.[0]);

  assert.ok(template, "the 2026 document should carry a device record to clone");

  const { capabilities: _stripped, ...bare } = { ...template, "unique_id": CAPABILITY_LESS_ID };

  return { ...bootstrap, "device_groups": [[bare as AccessDeviceConfig]] };
};

const deviceChange = (id: string, payload: AccessDeviceConfigPayload): AccessTypedEvent => ({ eventName: "access.data.device.update", id,
  kind: "deviceChanged", payload });

const locationChange = (id: string, name: string): AccessTypedEvent => ({ eventName: "access.data.location.update", id, kind: "locationChanged",
  payload: { name } });

const idsOf = (devices: readonly AccessStateDevice[] | undefined): string[] => (devices ?? []).map((device) => device.unique_id);

const controllerEvent = (controller: AccessControllerConfig): AccessTypedEvent => ({ data: controller, kind: "controllerChanged" });

// A door reporting its lock state, with an empty device facet so the report advances door state and nothing else.
const doorState = (locationId: string, lock: string): AccessTypedEvent => ({ device: { id: HUB, payload: {} }, eventName: "access.data.v2.device.update",
  kind: "doorStateChanged", states: [{ "dps": "close", "dps_connected": true, "emergency": { "hardware": "none", "software": "none" }, "is_unavailable": false,
    "location_id": locationId, "lock": lock }] });

describe("isHub", () => {

  test("reads the controller's own hub capability rather than a model name", () => {

    const state = stateFrom(accessBootstrap2026Fixture);
    const ultra = state.devices.get(ULTRA);
    const reader = state.devices.get(READER_PRO);

    assert.ok(ultra && reader, "the document should carry both devices");

    // The UA Ultra is where a list of hub model names would go wrong: it carries the hub capability alongside the reader capability, so a check that branched on
    // the model would have to know this one reads credentials too.
    assert.ok(ultra.capabilities.includes("is_reader"), "the UA Ultra is a reader as well as a hub");
    assert.equal(isHub(ultra), true);
    assert.equal(isHub(reader), false);
  });

  test("answers for a record the controller sent without any capabilities at all", () => {

    const state = stateFrom(capabilityLessBootstrap());
    const admitted = state.devices.get(CAPABILITY_LESS_ID);

    assert.ok(admitted, "the record has to be in the map to be classified at all");

    /* The record is a clone of the document's hub-capable UA Ultra, so the capability read is what decides it rather than anything else the record carries. Each
     * of these three reads the member off the record, directly or through the view, so reaching an answer at all is half of what they pin and the answer itself is
     * the other half.
     */
    assert.equal(isHub(admitted), false);
    assert.deepEqual(idsOf(selectHubs(state)), [ ULTRA, HUB, HUB_DOOR_MINI ], "the hub view answers over the whole map and leaves the record out of it");
    assert.deepEqual(idsOf(selectDevicesByType(state).get("UA-ULTRA")), [ CAPABILITY_LESS_ID, ULTRA ], "it is still a device, grouped under the type it reported");
    assert.deepEqual(admitted.capabilities, [], "what makes all of that total is the array admission supplied");
  });
});

describe("isReader", () => {

  test("reads the controller's own reader capability rather than a model name", () => {

    const state = stateFrom(accessBootstrap2026Fixture);
    const ultra = state.devices.get(ULTRA);
    const reader = state.devices.get(READER_PRO);
    const hub = state.devices.get(HUB);

    assert.ok(ultra && reader && hub, "the document should carry all three devices");

    // The UA Ultra is where a list of reader model names would go wrong from the other direction: it drives a door's lock and reads credentials at it, so a
    // check that branched on the model would have to know this hub is a reader too.
    assert.ok(ultra.capabilities.includes("is_hub"), "the UA Ultra is a hub as well as a reader");
    assert.equal(isReader(ultra), true);
    assert.equal(isReader(reader), true);
    assert.equal(isReader(hub), false);
  });

  test("answers for a record the controller sent without any capabilities at all", () => {

    const state = stateFrom(capabilityLessBootstrap());
    const admitted = state.devices.get(CAPABILITY_LESS_ID);

    assert.ok(admitted, "the record has to be in the map to be classified at all");

    // The record is a clone of the document's UA Ultra, which carries the reader capability, so the capability read is what decides the answer rather than
    // anything else the record carries.
    assert.equal(isReader(admitted), false);
  });
});

describe("selectDevicesByType", () => {

  test("groups the 2026 document's devices under the types the controller reported", () => {

    const byType = selectDevicesByType(stateFrom(accessBootstrap2026Fixture));

    assert.deepEqual([...byType.keys()], [ "UA-ULTRA", "UAH", "UA-G2-PRO", "UA-G2-MINI", "UA-Hub-Door-Mini" ]);
    assert.deepEqual(idsOf(byType.get("UA-ULTRA")), [ULTRA]);
    assert.deepEqual(idsOf(byType.get("UAH")), [HUB]);
    assert.deepEqual(idsOf(byType.get("UA-G2-PRO")), [READER_PRO]);
    assert.deepEqual(idsOf(byType.get("UA-G2-MINI")), [READER_MINI]);
    assert.deepEqual(idsOf(byType.get("UA-Hub-Door-Mini")), [HUB_DOOR_MINI]);
  });

  test("groups the EAH document's devices, including the hub the building hosts directly", () => {

    const byType = selectDevicesByType(stateFrom(accessBootstrapEahFixture));

    assert.deepEqual(idsOf(byType.get("UAH-Ent")), [EAH_HUB]);
    assert.deepEqual(idsOf(byType.get("UAH")), [EAH_GARAGE_HUB]);
    assert.deepEqual(idsOf(byType.get("UA-G2-PRO")), [ EAH_FRONT_READER, EAH_NORTHEAST_READER ]);
    assert.deepEqual(idsOf(byType.get("UA-G2-MINI")), [ EAH_GARAGE_READER, EAH_NORTHWEST_READER ]);
  });

  test("returns the same reference on repeat reads and across a change it does not depend on", () => {

    const state = stateFrom(accessBootstrap2026Fixture);
    const first = selectDevicesByType(state);

    assert.ok(Object.is(first, selectDevicesByType(state)), "repeat reads of an unchanged state return the identical map");

    // A door rename leaves the devices map alone, so this view must not recompute.
    const renamed = reduce(state, locationChange(DOOR_HUB, "Renamed"));

    assert.ok(!Object.is(renamed, state), "the rename is a real state change");
    assert.ok(Object.is(first, selectDevicesByType(renamed)), "a change to a collection this view does not read must not recompute it");
  });

  test("recomputes when the devices map changes", () => {

    const state = stateFrom(accessBootstrap2026Fixture);
    const before = selectDevicesByType(state);
    const relabeled = reduce(state, deviceChange(READER_PRO, { "device_type": "UA-G2-PRO-2" }));

    assert.ok(!Object.is(before, selectDevicesByType(relabeled)));
    assert.deepEqual(idsOf(selectDevicesByType(relabeled).get("UA-G2-PRO-2")), [READER_PRO]);
    assert.equal(selectDevicesByType(relabeled).has("UA-G2-PRO"), false, "the emptied bucket is gone rather than left behind");
  });
});

describe("selectHubs", () => {

  test("selects the 2026 document's hub-capable devices and none of its readers", () => {

    assert.deepEqual(idsOf(selectHubs(stateFrom(accessBootstrap2026Fixture))), [ ULTRA, HUB, HUB_DOOR_MINI ]);
  });

  test("selects both of the EAH document's hubs and neither of its readers", () => {

    assert.deepEqual(idsOf(selectHubs(stateFrom(accessBootstrapEahFixture))), [ EAH_HUB, EAH_GARAGE_HUB ]);
  });

  test("memoizes on the devices map", () => {

    const state = stateFrom(accessBootstrap2026Fixture);
    const first = selectHubs(state);

    assert.ok(Object.is(first, selectHubs(state)));

    // A drift-free re-bootstrap reconciles to the same devices map, so the derived array survives it.
    const rebootstrapped = applyBootstrap(state, clone(accessBootstrap2026Fixture));

    assert.ok(Object.is(first, selectHubs(rebootstrapped)), "a re-bootstrap that found no drift preserves the derived reference");
  });
});

describe("selectDoorDevices", () => {

  test("groups the 2026 document's hardware under the door it serves", () => {

    const byDoor = selectDoorDevices(stateFrom(accessBootstrap2026Fixture));

    assert.deepEqual([...byDoor.keys()], [ DOOR_ULTRA, DOOR_HUB, DOOR_HUB_MINI ]);
    assert.deepEqual(idsOf(byDoor.get(DOOR_ULTRA)), [ULTRA]);
    assert.deepEqual(idsOf(byDoor.get(DOOR_HUB)), [ HUB, READER_PRO, READER_MINI ]);
    assert.deepEqual(idsOf(byDoor.get(DOOR_HUB_MINI)), [HUB_DOOR_MINI]);
  });

  test("lists every EAH door, leaves the hardware-less ones empty, and excludes the building-hosted hub", () => {

    const state = stateFrom(accessBootstrapEahFixture);
    const byDoor = selectDoorDevices(state);

    assert.equal(byDoor.size, state.doors.size, "every door in the state is a key");
    assert.equal(byDoor.size, 9);
    assert.deepEqual(idsOf(byDoor.get(EAH_DOOR_FRONT)), [EAH_FRONT_READER]);
    assert.deepEqual(idsOf(byDoor.get(EAH_DOOR_GARAGE)), [ EAH_GARAGE_HUB, EAH_GARAGE_READER ]);
    assert.deepEqual(idsOf(byDoor.get(EAH_DOOR_NORTHEAST)), [EAH_NORTHEAST_READER]);
    assert.deepEqual(idsOf(byDoor.get(EAH_DOOR_NORTHWEST)), [EAH_NORTHWEST_READER]);
    assert.deepEqual(idsOf(byDoor.get(EAH_DOOR_2)), [], "a door with no hardware maps to an empty array rather than being absent");

    // The Enterprise Access Hub is hosted by the building, so it belongs to no door and appears in no entry.
    for(const [ door, devices ] of byDoor) {

      assert.ok(!idsOf(devices).includes(EAH_HUB), "the building-hosted hub must not appear under " + door);
    }
  });

  test("joins on the device's live location rather than the door snapshot the device record carries", () => {

    const state = stateFrom(accessBootstrap2026Fixture);

    // Relocating the reader updates its live location_id and leaves the door record embedded in it naming the door it came from - the exact disagreement a join
    // that read the embedded snapshot would resolve the wrong way.
    const relocated = reduce(state, deviceChange(READER_PRO, { "location_id": DOOR_ULTRA }));
    const moved = relocated.devices.get(READER_PRO);

    assert.ok(moved, "the reader should still be in the devices map");
    assert.equal(moved.location_id, DOOR_ULTRA, "the live field names the new door");
    assert.equal(moved.door?.unique_id, DOOR_HUB, "the embedded snapshot still names the old door");

    const byDoor = selectDoorDevices(relocated);

    assert.deepEqual(idsOf(byDoor.get(DOOR_ULTRA)), [ ULTRA, READER_PRO ], "the device groups under the door its live location names");
    assert.deepEqual(idsOf(byDoor.get(DOOR_HUB)), [ HUB, READER_MINI ], "and no longer under the door its stale snapshot names");
  });

  test("recomputes on a doors-only change and on a devices-only change alike", () => {

    const state = stateFrom(accessBootstrap2026Fixture);
    const first = selectDoorDevices(state);

    assert.ok(Object.is(first, selectDoorDevices(state)), "repeat reads of an unchanged state return the identical map");

    // Doors churn while the devices map stays put: a view keyed on devices alone would answer this from cache.
    const renamed = reduce(state, locationChange(DOOR_HUB, "Renamed"));

    assert.ok(Object.is(renamed.devices, state.devices), "the rename left the devices map alone");
    assert.ok(!Object.is(first, selectDoorDevices(renamed)), "a doors-only change refreshes the join");

    // Devices churn while the doors map stays put: a view keyed on doors alone would answer this from cache.
    const relocated = reduce(state, deviceChange(READER_PRO, { "location_id": DOOR_ULTRA }));

    assert.ok(Object.is(relocated.doors, state.doors), "the relocation left the doors map alone");
    assert.ok(!Object.is(first, selectDoorDevices(relocated)), "a devices-only change refreshes the join");
  });

  test("holds its reference across a change to neither of its inputs", () => {

    const state = stateFrom(accessBootstrap2026Fixture);
    const first = selectDoorDevices(state);
    const renamedFloor = reduce(state, locationChange(FLOOR_2026, "Ground"));

    assert.ok(!Object.is(renamedFloor, state), "the floor rename is a real state change");
    assert.ok(Object.is(first, selectDoorDevices(renamedFloor)), "a floor rename touches neither input, so the join is served from cache");
  });

  test("keeps two independently-advancing states in separate cache entries", () => {

    const first = stateFrom(accessBootstrap2026Fixture);
    const second = stateFrom(accessBootstrapEahFixture);

    // Reading the two states in alternation through the one selector: each must keep answering with its own cached result rather than evicting the other's.
    const firstInitial = selectDoorDevices(first);
    const secondInitial = selectDoorDevices(second);

    assert.ok(Object.is(firstInitial, selectDoorDevices(first)), "the first state's result survived a read of the second");
    assert.ok(Object.is(secondInitial, selectDoorDevices(second)), "the second state's result survived a read of the first");
    assert.ok(Object.is(firstInitial, selectDoorDevices(first)), "and survives the alternation repeating");
    assert.ok(!Object.is(firstInitial, secondInitial), "the two states have their own results");
  });
});

describe("isEnterpriseHubRecord", () => {

  test("qualifies the hub the building hosts and no other record in a rooted state", () => {

    const state = stateFrom(accessBootstrapEahFixture);
    const hub = state.devices.get(EAH_HUB);
    const reader = state.devices.get(EAH_FRONT_READER);

    assert.ok(hub && reader);
    assert.equal(isEnterpriseHubRecord(hub, state), true, "the building-hosted Enterprise hub is what the hub views withhold");
    assert.equal(isEnterpriseHubRecord(reader, state), false, "a reader is neither the type nor the placement");
  });

  test("does not qualify an Enterprise hub a rooted state places at a door", () => {

    /* The placement half of the rule, which is what keeps a door-hosted Enterprise hub reachable as a whole hub: it drives that one door, so the per-port view has
     * nothing to add and the whole-hub handle resolves correctly.
     */
    const state = stateFrom(accessBootstrapEahFixture);
    const hub = state.devices.get(EAH_HUB);

    assert.ok(hub);
    assert.equal(isEnterpriseHubRecord({ ...hub, "location_id": EAH_DOOR_2 }, state), false);
  });

  test("qualifies an Enterprise hub in a state no topology has placed", () => {

    /* The census-width arm. Without a root there is no building identity to match a placement against and no port extensions to expand, so a whole-hub handle
     * would resolve its door to the hub's own location and command the wrong resource. Withholding it is the honest answer until a topology places it.
     */
    const unrooted = createInitialState();
    const hub = stateFrom(accessBootstrapEahFixture).devices.get(EAH_HUB);

    assert.ok(hub);
    assert.equal(unrooted.root, null);
    assert.equal(isEnterpriseHubRecord(hub, unrooted), true, "an unplaced Enterprise hub is withheld from the hub views");
    assert.deepEqual(selectAccessPoints(unrooted), [], "and the per-port view answers empty there for the same reason");
  });
});

describe("selectAccessPoints", () => {

  test("expands every port of the Enterprise Access Hub, one access point per extension", () => {

    const points = selectAccessPoints(stateFrom(accessBootstrapEahFixture));

    assert.equal(points.length, 8);
    assert.deepEqual(points.map((point) => point.unique_id), EAH_EXTENSIONS, "each access point takes the extension's own identity, not the hub's");
  });

  test("maps the port-2 access point field by field", () => {

    const points = selectAccessPoints(stateFrom(accessBootstrapEahFixture));
    const port2 = points.find((point) => point.unique_id === EAH_PORT_2_EXTENSION);
    const hub = stateFrom(accessBootstrapEahFixture).devices.get(EAH_HUB);

    assert.ok(port2 && hub, "the port-2 access point and its hub should both be present");

    assert.equal(port2.alias, "Test Name 29", "the alias is the door the port serves");
    assert.equal(port2.name, "Test alias 60", "the name is the hub's alias");
    assert.equal(port2.location_id, EAH_DOOR_2, "the location is the door the port targets");
    assert.equal(port2.display_model, "EAH 8 Port2", "the model label carries the hub's model and the titlecased port");
    assert.equal(port2.device_type, "UAH-Ent", "every other hardware field comes from the hub");
    assert.equal(port2.mac, hub.mac);

    // The destructures exist to keep these off the result: the hub's roster of sibling ports, and the targeting fields the mapping already consumed.
    assert.equal(Object.hasOwn(port2, "extensions"), false, "an access point does not carry the hub's extensions array");
    assert.equal(Object.hasOwn(port2, "target_name"), false, "an access point does not leak the extension's target name");
    assert.equal(Object.hasOwn(port2, "target_value"), false, "an access point does not leak the extension's target value");
  });

  test("leaves the source records untouched", () => {

    const state = stateFrom(accessBootstrapEahFixture);
    const hub = state.devices.get(EAH_HUB);

    assert.ok(hub, "the hub should be in the devices map");

    selectAccessPoints(state);

    assert.ok(Object.is(hub, state.devices.get(EAH_HUB)), "the device record is the same object after the view is derived");
    assert.equal(hub.extensions?.length, 8, "the hub still carries its own extensions");
    assert.equal(hub.alias, "Test alias 60", "and its own alias");
    assert.equal(hub.location_id, EAH_ROOT, "and its own location");
  });

  test("expands nothing on a controller with no Enterprise Access Hub, and nothing before a document has been applied", () => {

    assert.deepEqual(selectAccessPoints(stateFrom(accessBootstrap2026Fixture)), []);

    const empty = createInitialState();
    const first = selectAccessPoints(empty);

    assert.deepEqual(first, []);
    assert.ok(Object.is(first, selectAccessPoints(createInitialState())), "the pre-bootstrap answer is one shared reference, so nobody is woken by it");
  });

  test("expands an extension of any kind, because the device type is what scopes the expansion", () => {

    /* A synthetic extension, marked as such: no Enterprise Access Hub in any capture carries anything but port extensions, so this case is constructed rather than
     * captured. It also exercises every fallback at once, carrying none of the port fields the mapping reads.
     */
    const bootstrap = clone(accessBootstrapEahFixture);
    const hub = bootstrap.device_groups?.[0]?.[0];

    assert.ok(hub?.extensions, "the EAH document should host its hub at the building level");
    assert.equal(hub.unique_id, EAH_HUB);

    hub.extensions.push({ "device_id": EAH_HUB, "extension_name": "intercom_pair", "target_config": [], "target_type": "admin",
      "unique_id": "00000000-0000-4000-8000-000000000001" });

    const points = selectAccessPoints(applyBootstrap(createInitialState(), bootstrap));
    const synthetic = points.at(-1);

    assert.equal(points.length, 9, "an extension the mapping has no port fields for is still expanded");
    assert.equal(synthetic?.unique_id, "00000000-0000-4000-8000-000000000001");
    assert.equal(synthetic?.alias, "Unknown", "with no target name, the alias falls back");
    assert.equal(synthetic?.location_id, EAH_ROOT, "with no target value, the location stays the hub's own");
    assert.equal(synthetic?.display_model, "EAH 8", "and with no port, the model label gains no suffix");
  });

  test("carries no model label on the ports of a hub whose census never established one", () => {

    /* The census-width consequence, at the one place the expansion composes a string from a member. The official inventory carries no model at all, so a port of a
     * hub seeded that way must carry no label rather than one reading "undefined Port2".
     */
    const bootstrap = clone(accessBootstrapEahFixture);
    const hub = bootstrap.device_groups?.[0]?.[0];

    assert.ok(hub, "the EAH document should host its hub at the building level");

    const { display_model: _stripped, ...bare } = hub;
    const stripped = { ...bootstrap, "device_groups": [[bare as AccessDeviceConfig]] };
    const points = selectAccessPoints(applyBootstrap(createInitialState(), stripped));
    const port2 = points.find((point) => point.unique_id === EAH_PORT_2_EXTENSION);

    assert.ok(port2, "the port is still expanded");
    assert.equal(Object.hasOwn(port2, "display_model"), false, "a label composed around an unestablished member is not a label");
    assert.equal(port2.alias, "Test Name 29", "and every other member of the port is unchanged");
  });

  test("recomputes when the hub's extensions change", () => {

    const state = stateFrom(accessBootstrapEahFixture);
    const before = selectAccessPoints(state);

    assert.ok(Object.is(before, selectAccessPoints(state)), "repeat reads of an unchanged state return the identical array");

    const hub = state.devices.get(EAH_HUB);

    assert.ok(hub?.extensions, "the hub should carry its extensions");

    const trimmed = reduce(state, deviceChange(EAH_HUB, { "extensions": hub.extensions.slice(0, 7) }));
    const after = selectAccessPoints(trimmed);

    assert.ok(!Object.is(before, after), "a device update that changed the extensions refreshes the expansion");
    assert.equal(after.length, 7);
  });

  test("recomputes when the topology root changes", () => {

    const state = stateFrom(accessBootstrapEahFixture);
    const before = selectAccessPoints(state);
    const renamedRoot = reduce(state, locationChange(EAH_ROOT, "Renamed Building"));

    assert.ok(Object.is(renamedRoot.devices, state.devices), "the rename left the devices map alone");
    assert.ok(!Object.is(before, selectAccessPoints(renamedRoot)), "a root-only change refreshes the expansion");
    assert.deepEqual(selectAccessPoints(renamedRoot).map((point) => point.unique_id), EAH_EXTENSIONS);
  });

  test("keeps two independently-advancing states in separate cache entries", () => {

    const first = stateFrom(accessBootstrapEahFixture);
    const second = stateFrom(accessBootstrapEahFixture);
    const firstInitial = selectAccessPoints(first);
    const secondInitial = selectAccessPoints(second);

    assert.ok(!Object.is(firstInitial, secondInitial), "two separately-built states are two cache entries");
    assert.ok(Object.is(firstInitial, selectAccessPoints(first)), "the first state's result survived a read of the second");
    assert.ok(Object.is(secondInitial, selectAccessPoints(second)), "the second state's result survived a read of the first");
  });

  test("an unrelated device changing leaves each port object reference-identical", () => {

    /* The property a consumer holding a per-port handle depends on. Such a handle reads its port by identity out of this expansion, so if an unrelated device's
     * update rebuilt the port objects, every handle's observer would wake on every packet the controller sends. The array itself is expected to be fresh - it is
     * rebuilt whenever the devices map changes, exactly as every sibling collection view behaves - so the assertion is about the entries.
     */
    const state = stateFrom(accessBootstrapEahFixture);
    const before = selectAccessPoints(state);
    const port2 = before.find((point) => point.unique_id === EAH_PORT_2_EXTENSION);

    // A reader that has nothing to do with the Enterprise Access Hub changes.
    const touched = reduce(state, deviceChange(EAH_FRONT_READER, { "ip": "172.16.9.9" }));
    const after = selectAccessPoints(touched);

    assert.ok(!Object.is(touched.devices, state.devices), "the unrelated device really did change");
    assert.ok(Object.is(after.find((point) => point.unique_id === EAH_PORT_2_EXTENSION), port2),
      "the port object survives an unrelated device's change by reference");
  });

  test("one hub's change refreshes its own ports and leaves a sibling hub's untouched", () => {

    // Two Enterprise Access Hubs on one building, so the isolation between their cached expansions is a real question rather than a vacuous one.
    const bootstrap = clone(accessBootstrapEahFixture);
    const hub = bootstrap.device_groups?.[0]?.[0];

    assert.ok(hub?.extensions);

    const template = hub.extensions[0];

    assert.ok(template, "the hub carries a port extension to clone");

    const siblingPort = { ...clone(template), "unique_id": SECOND_EAH_PORT };
    const sibling = { ...clone(hub), "alias": "Sibling Access Hub", "extensions": [siblingPort], "unique_id": SECOND_EAH_HUB };

    bootstrap.device_groups?.[0]?.push(sibling);

    const state = applyBootstrap(createInitialState(), bootstrap);
    const before = selectAccessPoints(state);
    const siblingBefore = before.find((point) => point.unique_id === SECOND_EAH_PORT);
    const firstBefore = before.find((point) => point.unique_id === EAH_PORT_2_EXTENSION);

    assert.ok(siblingBefore && firstBefore, "both hubs expanded");

    // Change the first hub only.
    const touched = reduce(state, deviceChange(EAH_HUB, { "ip": "172.16.9.8" }));
    const after = selectAccessPoints(touched);

    assert.ok(!Object.is(after.find((point) => point.unique_id === EAH_PORT_2_EXTENSION), firstBefore), "the changed hub's ports are rebuilt from its new record");
    assert.equal(after.find((point) => point.unique_id === EAH_PORT_2_EXTENSION)?.ip, "172.16.9.8");
    assert.ok(Object.is(after.find((point) => point.unique_id === SECOND_EAH_PORT), siblingBefore), "the untouched hub's ports keep their references");
  });
});

describe("selectDoorStates", () => {

  test("carries what the topology established before any door reports, and what a door reported after one does", () => {

    const state = stateFrom(accessBootstrap2026Fixture);
    const seeded = selectDoorStates(state).get(DOOR_HUB);

    // The connect seed reads the serving hardware's own flags, so a door that has never reported still has something honest to show.
    assert.equal(seeded?.lock, "locked");
    assert.equal(seeded.dps, "none");

    const reported = reduce(state, doorState(DOOR_HUB, "unlocked"));
    const entry = selectDoorStates(reported).get(DOOR_HUB);

    assert.equal(entry?.lock, "unlocked");
    assert.equal(entry.dps, "close");
  });

  test("returns the reducer's own map, so it is reference-stable across a dispatch that touched no door", () => {

    const state = reduce(stateFrom(accessBootstrap2026Fixture), doorState(DOOR_HUB, "locked"));
    const before = selectDoorStates(state);

    assert.ok(Object.is(before, selectDoorStates(state)), "repeat reads of an unchanged state return the identical map");

    const renamed = reduce(state, locationChange(DOOR_HUB_MINI, "Renamed"));

    assert.ok(!Object.is(renamed, state), "the rename is a real state change");
    assert.ok(Object.is(before, selectDoorStates(renamed)), "a change that touched no door state leaves the map reference alone");
  });
});

describe("the controller selectors", () => {

  test("read null before a controller document has been fetched", () => {

    const state = stateFrom(accessBootstrap2026Fixture);

    assert.equal(selectController(state), null);
    assert.equal(selectControllerName(state), null);
    assert.equal(selectControllerUptime(state), null);
  });

  test("read the document, its display name, and its uptime once one has been fetched", () => {

    const state = reduce(stateFrom(accessBootstrap2026Fixture), controllerEvent(clone(accessControllerInfoFixture)));

    assert.ok(Object.is(selectController(state), state.controller), "the document selector is the direct read");

    // The display name is the host's own hostname - what an administrator named the console - rather than the shortname beside it, which names the model.
    assert.equal(selectControllerName(state), "host-2.test.local");
    assert.equal(accessControllerInfoFixture.host.shortname, "Test shortname 63", "the shortname really is a different value, so the choice above is a choice");
    assert.equal(selectControllerUptime(state), accessControllerInfoFixture.host.uptime);
  });

  test("hold their values across a dispatch that did not touch the controller", () => {

    const state = reduce(stateFrom(accessBootstrap2026Fixture), controllerEvent(clone(accessControllerInfoFixture)));
    const document = selectController(state);
    const renamed = reduce(state, locationChange(DOOR_HUB, "Renamed"));

    assert.ok(!Object.is(renamed, state), "the rename is a real state change");
    assert.ok(Object.is(selectController(renamed), document), "an unrelated change leaves the controller document reference alone");
    assert.equal(selectControllerUptime(renamed), selectControllerUptime(state));
  });
});

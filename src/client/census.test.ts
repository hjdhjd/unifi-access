/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * census.test.ts: Unit tests for the official-listing projections. These are pure functions over real captured records, so what is asserted is the exact shape
 * each one produces: which members it carries, which it leaves absent, and that the identity it hands the state is the identity the topology addresses the same
 * hardware by. That last group runs both fixture corpora against each other, which is the only way to establish that the two censuses describe one controller.
 */
import { accessOfficialDevicesFixture, accessOfficialDoorsFixture } from "../official/devices.fixtures.ts";
import { describe, test } from "node:test";
import { doorStateEntry, officialDeviceRecord, officialDoorRecord } from "./census.ts";
import { isTamperCapable, tamperState } from "../state/selectors.ts";
import type { AccessOfficialDevice } from "../official/devices.ts";
import type { AccessOfficialDoor } from "../official/spaces.ts";
import { accessBootstrap2026Fixture } from "../protocol/topology.fixtures.ts";
import assert from "node:assert/strict";
import { topologyDevices } from "../testing.helpers.ts";

// Named entries from the captured listing: the hub that describes itself, the reader attached to it, and the doors the three groups are keyed by.
const ULTRA = "aabbcc000000";
const HUB = "aabbcc000001";
const READER_PRO = "aabbcc000002";
const DOOR_MINI_HW = "aabbcc000004";
const DOOR_HUB = "00000000-0000-0000-0000-000000000006";
const FLOOR = "00000000-0000-0000-0000-000000000001";

// Every device the captured listing carried, flattened out of its per-door groups the way the seed flattens them.
const listedDevices = accessOfficialDevicesFixture.flat();

// One listed device by identity, failing loudly rather than skipping if the corpus ever stops carrying it.
function listed(id: string): AccessOfficialDevice {

  const device = listedDevices.find((candidate) => candidate.id === id);

  assert.ok(device, "the captured listing should carry device " + id);

  return device;
}

function listedDoor(id: string): AccessOfficialDoor {

  const door = accessOfficialDoorsFixture.find((candidate) => candidate.id === id);

  assert.ok(door, "the captured listing should carry door " + id);

  return door;
}

const topologyRecords = topologyDevices(accessBootstrap2026Fixture);
const topologyDoorIds = (accessBootstrap2026Fixture.floors ?? []).flatMap((floor) => floor.doors.map((door) => door.unique_id));

describe("officialDeviceRecord", () => {

  test("projects a hub into exactly the members the listing establishes, and nothing more", () => {

    /* The whole key set rather than a few members, because what this projection leaves ABSENT is as much of its contract as what it carries: a consumer's fallback
     * handling rests on a member being missing rather than on it being present and empty.
     */
    assert.deepEqual(officialDeviceRecord(listed(HUB)), {

      "alias": "Test alias 13",
      "capabilities": listed(HUB).capabilities,
      "connected_uah_id": "",
      "device_type": "UAH",
      "is_adopted": true,
      "is_connected": true,
      "is_managed": true,
      "is_online": true,
      "location_id": DOOR_HUB,
      "mac": "AABBCC000001",
      "name": "Test Name 76",
      "unique_id": HUB
    });
  });

  test("projects a reader the same way, carrying the hub it names and its own empty alias", () => {

    assert.deepEqual(officialDeviceRecord(listed(READER_PRO)), {

      "alias": "",
      "capabilities": listed(READER_PRO).capabilities,
      "connected_uah_id": HUB,
      "device_type": "UA-G2-PRO",
      "is_adopted": true,
      "is_connected": true,
      "is_managed": true,
      "is_online": true,
      "location_id": DOOR_HUB,
      "mac": "AABBCC000002",
      "name": "Test Name 68",
      "unique_id": READER_PRO
    });
  });

  test("carries the capability set the library's own predicates read, and none of the rows the value read needs", () => {

    /* The token-mode contract in one place: the listing establishes what a device's hardware can do, and nothing about what it currently reports. So the
     * capability predicate answers over a projected record exactly as it does over a topology one, while the reading it gates stays honestly unestablished.
     */
    assert.equal(isTamperCapable(officialDeviceRecord(listed(ULTRA))), true);
    assert.equal(isTamperCapable(officialDeviceRecord(listed(HUB))), false, "the listed UAH carries no tamper capability");
    assert.equal(tamperState(officialDeviceRecord(listed(ULTRA))), undefined, "a listing carries no configuration rows, so nothing establishes a reading");
  });

  test("copies the capabilities array rather than sharing the listing's own", () => {

    // The listing's array is read-only where the stored member is not, so a shared reference would let a consumer mutate the record the listing handed over.
    const source = listed(HUB);
    const projected = officialDeviceRecord(source);

    assert.deepEqual(projected.capabilities, source.capabilities);
    assert.equal(Object.is(projected.capabilities, source.capabilities), false, "the stored array must be a copy");
  });

  test("fills an empty capabilities array for a record that carries none, both ways a record can lack one", () => {

    /* Both shapes the rule tells apart. A presence-only check passes the second and fails only the first, so asserting the key-absent case alone would leave a
     * regression to a `in` test invisible.
     */
    const { capabilities: _stripped, ...keyAbsent } = listed(HUB);

    assert.deepEqual(officialDeviceRecord(keyAbsent as AccessOfficialDevice).capabilities, [], "a record with no capabilities key at all");
    assert.deepEqual(officialDeviceRecord({ ...listed(HUB), "capabilities": null } as unknown as AccessOfficialDevice).capabilities, [],
      "a record whose capabilities member is present but is not an array");
  });

  test("derives the hardware address from an address-shaped identifier, and derives none from any other", () => {

    /* The derivation's whole licence is that the identifier IS the address with its separators removed. An identifier that is not address-shaped licenses nothing,
     * and the record then carries no `mac` key at all rather than an empty string or a mangled one.
     */
    const rows: { id: string; mac?: string }[] = [
      { id: HUB, mac: "AABBCC000001" },
      { id: DOOR_MINI_HW, mac: "AABBCC000004" },
      { id: "aa:bb:cc:00:00:01", mac: "AABBCC000001" },
      { id: "00000000-0000-0000-0000-000000000031" }
    ];

    for(const row of rows) {

      const projected = officialDeviceRecord({ ...listed(HUB), "id": row.id });

      assert.equal(projected.unique_id, row.id);

      if(row.mac === undefined) {

        assert.equal(Object.hasOwn(projected, "mac"), false, row.id + " is not an address, so nothing licenses a mac member");

        continue;
      }

      assert.equal(projected.mac, row.mac);
    }
  });

  test("derives the same address from an identifier the listing spells in uppercase", () => {

    // The controller re-cases a device's address between reads of the topology, so an identifier arriving in uppercase is the possibility the shape test has to
    // admit. The identity itself is carried as the listing spelled it: only the address folds, because only the address is what a consumer keys on.
    const projected = officialDeviceRecord({ ...listed(HUB), "id": HUB.toUpperCase() });

    assert.equal(projected.mac, officialDeviceRecord(listed(HUB)).mac);
    assert.equal(projected.mac, "AABBCC000001");
    assert.equal(projected.unique_id, HUB.toUpperCase());
  });

  test("leaves every member the listing does not carry absent rather than inventing one", () => {

    const projected = officialDeviceRecord(listed(HUB));

    for(const member of [ "configs", "display_model", "door", "extensions", "firmware", "floor", "images", "ip", "location", "model", "start_time", "version" ]) {

      assert.equal(Object.hasOwn(projected, member), false, member + " is not something the listing establishes");
    }
  });
});

describe("officialDoorRecord", () => {

  test("projects a door into exactly the members the listing establishes", () => {

    assert.deepEqual(officialDoorRecord(listedDoor(DOOR_HUB)), {

      "full_name": "Test Name 11",
      "location_type": "door",
      "name": "Test Name 10",
      "unique_id": DOOR_HUB,
      "up_id": FLOOR
    });
  });

  test("leaves the state members and the wire members it does not project absent", () => {

    const projected = officialDoorRecord(listedDoor(DOOR_HUB));

    // The lock and the position belong to door state; the extras and the hub binding are reachable on the official surface and establish nothing this record
    // needs.
    for(const member of [ "door_lock_relay_status", "door_position_status", "extras", "is_bind_hub", "device_groups", "level", "timezone" ]) {

      assert.equal(Object.hasOwn(projected, member), false, member + " does not belong on the stored door record");
    }
  });
});

describe("doorStateEntry", () => {

  test("carries the position and the lock a listing established, translated onto the stream's own spelling", () => {

    assert.deepEqual(doorStateEntry(listedDoor(DOOR_HUB)), { "dps": "none", "location_id": DOOR_HUB, "lock": "locked" });
    assert.deepEqual(doorStateEntry({ ...listedDoor(DOOR_HUB), "door_lock_relay_status": "unlock" }),
      { "dps": "none", "location_id": DOOR_HUB, "lock": "unlocked" });
  });

  test("carries no position member for a door the listing has no position for", () => {

    const entry = doorStateEntry({ ...listedDoor(DOOR_HUB), "door_position_status": null });

    assert.equal(Object.hasOwn(entry, "dps"), false, "a null position is absence rather than a value");
    assert.equal(entry.lock, "locked");
  });

  test("carries no lock member for a spelling the vocabulary does not model", () => {

    const entry = doorStateEntry({ ...listedDoor(DOOR_HUB), "door_lock_relay_status": "something-new" });

    assert.equal(Object.hasOwn(entry, "lock"), false, "an unmodeled spelling establishes nothing rather than being carried through raw");
    assert.equal(entry.dps, "none");
  });
});

describe("the two censuses describe one controller", () => {

  test("every projected device identity is a device the topology holds, with the same address", () => {

    /* The claim the whole census rests on: the two APIs address the same hardware by the same identifier. Running it THROUGH the projection rather than over the
     * raw listing is what makes it a test of this code. The address comparison spells the topology's own address the library's way - computed here rather than
     * through the fold under test - because the document itself varies the case from record to record.
     */
    for(const device of listedDevices) {

      const projected = officialDeviceRecord(device);
      const topology = topologyRecords.find((record) => record.unique_id === projected.unique_id);

      assert.ok(topology, "the topology document should hold device " + projected.unique_id);
      assert.equal(projected.mac, topology.mac.replaceAll(":", "").toUpperCase(), "the derived address should be the topology's own, in the library's spelling");
      assert.equal(projected.device_type, topology.device_type);
    }

    assert.equal(listedDevices.length, 5, "the corpus should carry every device of the site, so the walk above is not vacuous");
  });

  test("every projected device's door is a door the topology holds, and one the door projection also names", () => {

    for(const device of listedDevices) {

      const projected = officialDeviceRecord(device);

      assert.ok(topologyDoorIds.includes(projected.location_id), "the topology should hold door " + projected.location_id);

      const door = accessOfficialDoorsFixture.find((candidate) => candidate.id === projected.location_id);

      assert.ok(door, "the door listing should carry the door device " + projected.unique_id + " serves");
      assert.equal(officialDoorRecord(door).unique_id, projected.location_id);
    }
  });

  test("every projected door is a door the topology holds, on the floor the topology places it under", () => {

    const topologyFloorIds = (accessBootstrap2026Fixture.floors ?? []).map((floor) => floor.unique_id);

    for(const door of accessOfficialDoorsFixture) {

      const projected = officialDoorRecord(door);

      assert.ok(topologyDoorIds.includes(projected.unique_id), "the topology should hold door " + projected.unique_id);
      assert.ok(topologyFloorIds.includes(projected.up_id), "the topology should hold floor " + projected.up_id);
    }
  });

  test("every per-door group shares one door, so flattening the groups loses nothing", () => {

    for(const group of accessOfficialDevicesFixture) {

      const doors = new Set(group.map((device) => officialDeviceRecord(device).location_id));

      assert.equal(doors.size, 1, "a group whose members served different doors could not be flattened");
    }
  });
});

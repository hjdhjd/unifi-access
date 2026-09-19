/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * census.ts: The official API's listings projected into the records and facts the state holds.
 */

/**
 * One reality spelled two ways, translated in one place. A controller describes the same hardware and the same doors to the Access application's own endpoints and
 * to the published API, in different vocabularies and at different widths, and this module is where the second spelling becomes the first. The library owns that
 * translation so a consumer never sees an official record in state: it reads one record shape through one set of selectors, whichever identity its client holds.
 *
 * This is client-tier material rather than protocol-tier material, for reasons that agree. The composition root is where official records are read and where
 * the one existing official-to-state mapping already lives, and the protocol tier's own official-channel folds take primitive values - a lock status, a position
 * status - rather than whole records, so putting a whole-record projection there would add a protocol-to-official type edge the architecture does not carry.
 *
 * @module AccessCensus
 */
import type { AccessDeviceConfig, AccessDoorConfig, AccessDoorStateEntry } from "../types/index.ts";
import type { AccessStateDevice, AccessStateDoor } from "../protocol/reducer.ts";
import { isMacAddress, normalizeMacAddress } from "../protocol/vocabulary.ts";
import { officialDoorPosition, officialLockState } from "../protocol/door-state.ts";
import type { AccessOfficialDevice } from "../official/devices.ts";
import type { AccessOfficialDoor } from "../official/spaces.ts";
import { carriesCapabilities } from "../protocol/reducer.ts";

/* The projected records are built as closed literals - the core members plus exactly what the projection derives - and only then widened to the stored record type.
 * The stored types carry the wire interfaces' index signature, under which TypeScript stops checking an object literal for unknown members, so a typo in a member
 * name would compile silently against them. Against the closed type it is an error.
 */
type ProjectedDevice = Pick<AccessDeviceConfig, "alias" | "capabilities" | "connected_uah_id" | "device_type" | "is_adopted" | "is_connected" | "is_managed" |
  "is_online" | "location_id" | "name" | "unique_id"> & Partial<Pick<AccessDeviceConfig, "mac">>;
type ProjectedDoor = Pick<AccessDoorConfig, "full_name" | "location_type" | "name" | "unique_id" | "up_id">;

/**
 * Project one device from the official API's inventory into the record the state holds.
 *
 * The identity translates directly: the listing's `id` is the `unique_id` the topology addresses the same hardware by, and its `type` is that document's
 * `device_type`. `name` is the listing's own spelling, which can differ from the topology's display name for the same hardware, and it is carried as the wire truth
 * it is rather than folded into something else.
 *
 * `mac` is the one member derived rather than copied. The controller's device identifier is the hardware address without its separators, which holds across every
 * Access device in the capture corpus, so carrying it as the address is a spelling of the same identity rather than a value the listing never gave. It is carried in
 * the library's one spelling - uppercase, without separators - through the same fold every other admission applies, whatever case or separator style the
 * identifier arrived in. A device whose identifier is not address-shaped, which is how the controller addresses camera-class hardware, carries no `mac` at all,
 * because nothing licenses one.
 *
 * Everything the listing does not carry stays absent: no addresses beyond the derived one, no firmware, no configuration rows, no port extensions, and none of the
 * embedded `door`, `floor`, or `location` snapshots a topology record brings. A consumer reads an absent member as not established by this census.
 *
 * @param device - One device as the official inventory listed it.
 *
 * @returns The device record as the state holds it.
 *
 * @category Client
 */
export function officialDeviceRecord(device: AccessOfficialDevice): AccessStateDevice {

  /* The capabilities array is copied rather than referenced, because the listing's array is read-only where the stored member is not, and the same rule the
   * topology admission applies is applied here: a record arriving without the array is stored carrying an empty one.
   *
   * The address is licensed and spelled by the protocol tier's own pair of rules: the shape test says whether the identifier is an address at all, and the fold
   * gives it the library's spelling.
   */
  const projected: ProjectedDevice = {

    "alias": device.alias,
    "capabilities": carriesCapabilities(device) ? [...device.capabilities] : [],
    "connected_uah_id": device.connected_uah_id,
    "device_type": device.type,
    "is_adopted": device.is_adopted,
    "is_connected": device.is_connected,
    "is_managed": device.is_managed,
    "is_online": device.is_online,
    "location_id": device.location_id,
    ...(isMacAddress(device.id) && { "mac": normalizeMacAddress(device.id) }),
    "name": device.name,
    "unique_id": device.id
  };

  return projected;
}

/**
 * Project one door from the official API's door listing into the record the state holds.
 *
 * The identity translates directly: the listing's `id` is the `unique_id` the topology addresses the same door by, its `floor_id` is the identity of the floor
 * above it, and its `type` is that document's `location_type`.
 *
 * The lock and position members are deliberately not projected here. They are door STATE rather than door configuration, and they reach the door-state facts through
 * the existing folds, which is what keeps one door's condition in one collection. `extras` and `is_bind_hub` are not projected either: the door-state facts already
 * carry what the extras would establish, and the official surface keeps the whole record reachable for a consumer that wants the rest.
 *
 * @param door - One door as the official listing carried it.
 *
 * @returns The door record as the state holds it.
 *
 * @category Client
 */
export function officialDoorRecord(door: AccessOfficialDoor): AccessStateDoor {

  const projected: ProjectedDoor = {

    "full_name": door.full_name,
    "location_type": door.type,
    "name": door.name,
    "unique_id": door.id,
    "up_id": door.floor_id
  };

  return projected;
}

/**
 * Project one door from the official API's door listing into the door-state facts it establishes.
 *
 * The lock and position vocabularies are translated through the protocol tier's one home for them rather than here, which is what keeps a spelling from the official
 * channel out of a member the notification stream fills with its own. Each member appears only where the read established it: a door the listing has no position for
 * carries no position member at all, rather than a null or an invented one.
 *
 * @param door - One door as the official listing carried it.
 *
 * @returns What the listing established about that door.
 *
 * @category Client
 */
export function doorStateEntry(door: AccessOfficialDoor): AccessDoorStateEntry {

  const position = officialDoorPosition(door.door_position_status);
  const lock = officialLockState(door.door_lock_relay_status);

  return { "location_id": door.id, ...((position !== undefined) && { "dps": position }), ...((lock !== undefined) && { "lock": lock }) };
}

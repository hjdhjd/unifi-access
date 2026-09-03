/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * topology.ts: The UniFi Access location hierarchy - the bootstrap root, its floors and doors, the shared location record, and the location extras shapes.
 */
import type { AccessKnownJsonValue, DeepWirePartial, Nullable } from "./common.ts";
import type { AccessDeviceConfigInterface } from "./device.ts";

/**
 * The UniFi Access location hierarchy: the topology document we bootstrap from, the floors and doors beneath it, the location record the controller reuses at every
 * level, and the extras shapes a location carries depending on what kind of location it is.
 *
 * @module AccessTypesTopology
 */

/**
 * A description of the extras a `door` location carries: the door's thumbnail image and the door position sensor (DPS) state reported by an attached hub.
 *
 * Every field is optional because the controller emits these as independently-appearing groups...a door may carry the thumbnail pair alone, the `uah-*` triple
 * alone, both, or neither, and which groups appear varies by the hardware attached to the door rather than by firmware.
 *
 * The `uah-*` fields are strings rather than booleans: the wire carries the DPS state as `"off"` on every reader sampled through 2026, never as a JSON boolean.
 */
// The alias form is compiler-required: an interface has no implicit index signature, so it cannot sit under an open wire parent; closedness keeps the union narrowing.
// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
export type AccessDoorExtrasConfigInterface = {

  door_thumbnail?: string;
  door_thumbnail_last_update?: number;
  "uah-input_state_dps"?: string;
  "uah-wiring_state_dps-neg"?: string;
  "uah-wiring_state_dps-pos"?: string;
};

/**
 * A description of the extras a `building` location carries: one thumbnail entry per door hub hosted directly by the building, rather than the flat per-door scalars a
 * `door` location reports. The cover is typed as an open JSON value because the controller has only ever sent it as `null`, so its non-null shape is unpinned.
 */
// The alias form is compiler-required: an interface has no implicit index signature, so it cannot sit under an open wire parent; closedness keeps the union narrowing.
// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
export type AccessBuildingExtrasConfigInterface = {

  door_thumbnails: {

    door_cover: Nullable<AccessKnownJsonValue>;
    door_thumbnail: string;
    door_thumbnail_last_update: number;
    hub_id: string;
  }[];
};

/**
 * The extras a location carries, selected by that location's own `location_type`. A `door` location carries the scalar thumbnail and DPS fields; a `building` location
 * carries the per-hub `door_thumbnails` array. A `floor` location carries an extras object whose fields are simply all absent, which satisfies the scalar shape
 * structurally, so it needs no branch of its own.
 */
export type AccessLocationExtrasConfig = AccessBuildingExtrasConfigInterface | AccessDoorExtrasConfigInterface;

/**
 * A description of the UniFi Access location JSON.
 *
 * The controller uses this one record shape everywhere it names a place: for a standalone location, and for the `door`, `floor`, and `location` members embedded in a
 * device record. Defining it once and referencing it from each of those positions keeps the shape in a single place rather than restating it per position.
 */
export interface AccessLocationConfigInterface {

  extra_type: string;
  extras: AccessLocationExtrasConfig;
  full_name: string;
  level: number;
  location_type: string;
  name: string;
  // Carried by 2026 firmware and absent from earlier controllers. The element shape is not pinned: the array has only ever been observed empty, so the open JSON type
  // admits whatever the controller puts in it.
  previous_name?: AccessKnownJsonValue[];
  timezone: string;
  unique_id: string;
  up_id: string;
  // The controller sends the work-time schedule as a JSON-encoded string rather than as a JSON array. Every occurrence across every capture, 2024 through 2026, is the
  // literal string `"[]"`, so a consumer that wants the schedule parses this value rather than indexing it.
  work_time: string;
  work_time_id: string;

  [key: string]: AccessKnownJsonValue;
}

/**
 * A description of the UniFi Access door JSON: a location that hardware is attached to, carrying the readers assigned to it and the door-specific guard, hotel, and
 * camera associations.
 */
export interface AccessDoorConfigInterface {

  camera_resource_ids: string[];
  /* The wire nests this twice: an outer array wrapping the inner array of device records. The outer array is length 0 when nothing is assigned to the door and length 1
   * when something is, so the nesting is the controller's grouping level rather than a quirk of one firmware.
   *
   * The key itself is always emitted at door level even when the door has no hardware, so it is required here and optional only at the bootstrap root.
   */
  device_groups: AccessDeviceConfigInterface[][];
  door_guard: string[];
  extra_type: string;
  extras: AccessLocationExtrasConfig;
  full_name: string;
  hotel_devices: string[];
  level: number;
  location_type: string;
  name: string;
  previous_name?: AccessKnownJsonValue[];
  timezone: string;
  unique_id: string;
  up_id: string;
  // A JSON-encoded string rather than an array. See the note on {@link AccessLocationConfigInterface.work_time}.
  work_time: string;
  work_time_id: string;

  [key: string]: AccessKnownJsonValue;
}

/**
 * A description of the UniFi Access floor JSON: the level of the hierarchy between a building and its doors.
 */
export interface AccessFloorConfigInterface {

  doors: AccessDoorConfigInterface[];
  extra_type: string;
  extras: AccessLocationExtrasConfig;
  full_name: string;
  level: number;
  location_type: string;
  name: string;
  previous_name?: AccessKnownJsonValue[];
  timezone: string;
  unique_id: string;
  up_id: string;
  // A JSON-encoded string rather than an array. See the note on {@link AccessLocationConfigInterface.work_time}.
  work_time: string;
  work_time_id: string;

  [key: string]: AccessKnownJsonValue;
}

/**
 * A semi-complete description of the UniFi Access topology JSON, which we use to bootstrap. This is the root of the location hierarchy: a `building` location holding
 * the floors, and optionally holding hardware directly when a device is attached to the building rather than to one of its doors.
 */
export interface AccessBootstrapConfigInterface {

  alias?: string;
  // Doubly nested, as at door level. Optional here because the root omits the key entirely when no hardware is attached directly to the building.
  device_groups?: AccessDeviceConfigInterface[][];
  extra_type: string;
  extras: AccessLocationExtrasConfig;
  floors?: AccessFloorConfigInterface[];
  full_name: string;
  level: number;
  location_type: string;
  name: string;
  previous_name?: AccessKnownJsonValue[];
  timezone: string;
  unique_id: string;
  up_id: string;
  // A JSON-encoded string rather than an array. See the note on {@link AccessLocationConfigInterface.work_time}.
  work_time: string;
  work_time_id: string;

  [key: string]: AccessKnownJsonValue;
}

/** @see {@link AccessBootstrapConfigInterface} */
export type AccessBootstrapConfig = AccessBootstrapConfigInterface;

/** @see {@link AccessBuildingExtrasConfigInterface} */
export type AccessBuildingExtrasConfig = AccessBuildingExtrasConfigInterface;

/** @see {@link AccessDoorConfigInterface} */
export type AccessDoorConfig = AccessDoorConfigInterface;

/** @see {@link AccessDoorConfigInterface} */
export type AccessDoorConfigPayload = DeepWirePartial<AccessDoorConfigInterface>;

/** @see {@link AccessDoorExtrasConfigInterface} */
export type AccessDoorExtrasConfig = AccessDoorExtrasConfigInterface;

/** @see {@link AccessFloorConfigInterface} */
export type AccessFloorConfig = AccessFloorConfigInterface;

/** @see {@link AccessFloorConfigInterface} */
export type AccessFloorConfigPayload = DeepWirePartial<AccessFloorConfigInterface>;

/** @see {@link AccessLocationConfigInterface} */
export type AccessLocationConfig = AccessLocationConfigInterface;

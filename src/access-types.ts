/* Copyright(C) 2019-2024, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * access-types.ts: Type definitions for UniFi Access.
 */

/**
 * UniFi Access API response JSON.
 */
export type AccessApiResponse = {
  code: number,
  codeS: string,
  msg: string,
  error: string,
  data: string
};

/**
 * UniFi Access event packet.
 *
 * @param event - Access event topic.
 * @param data  - Access event payload.
 *
 * @remarks A UniFi Access event packet is the representation of a notification event from a UniFi Access controller. The Access `event` property informs us of the
 * notification type, such as `access.data.device.remote_unlock`, for door unlock events. The details of the event are delivered as a JSON payload in the `data`
 * property.
 */
// A complete description of the UniFi Access notification events API packet format.
export type AccessEventPacket = {

  event: string,
  receiver_id: string,
  event_object_id: string,
  save_to_history: boolean,
  data: Record<string, string>
};

// An semi-complete description of the UniFi Access device JSON.
export interface AccessDeviceConfigInterface {

  adopt_time: number,
  adopting: boolean,
  alias: string,
  bom_rev: string,
  capabilities: string[],
  connected_uah_id: string,
  device_type: string,
  display_model: string,
  configs: AccessDeviceEntryConfigInterface[],
  door: {

    extra_type: string,
    full_name: string,
    level: number,
    location_type: string,
    name: string,
    timezone: string,
    unique_id: string,
    up_id: string,
    work_time: string[],
    work_time_id: string,
    extras: AccessDeviceExtrasConfigInterface
  },
  firmware_update_time: number,
  firmware: string,
  floor: {

    extra_type: string,
    extras: AccessDeviceExtrasConfigInterface,
    full_name: string,
    level: number,
    location_type: string,
    name: string,
    timezone: string,
    unique_id: string,
    up_id: string,
    work_time: string[],
    work_time_id: string
  },
  guid: string,
  hw_type: string,
  images: {

    l: string,
    m: string,
    s: string,
    xl: string,
    xs: string
  },
  ip: string,
  is_adopted: boolean,
  is_connected: boolean,
  is_managed: boolean,
  is_online: boolean,
  location: {

    extra_type: string,
    extras: AccessDeviceExtrasConfigInterface,
    full_name: string,
    level: number,
    location_type: string,
    name: string,
    timezone: string,
    unique_id: string,
    up_id: string,
    work_time_id: string,
    work_time: string[]
  },
  location_id: string,
  mac: string,
  model: string,
  name: string,
  need_advisory: boolean,
  resource_name: string,
  revision_update_time: number,
  revision: number,
  security_check: boolean,
  source: string,
  start_time: number,
  unique_id: string,
  update: string,
  update_manual: {

    device_version_upgrade_status: {

      completed: boolean,
      failed: boolean,
      failure_reason: string,
      is_downloading: boolean,
      is_upgrading: boolean,
      is_waiting: boolean,
      timed_out: boolean,
      upgrade_seconds: number
    },

    from_version: string,
    last_upgrade_start_time: string,
    last_upgrade_success: string,
    last_upgrade_failure_reason: string
  },
  version_update_time: number,
  version: string
}

// An semi-complete description of the UniFi Access device entry configuration JSON.
export interface AccessDeviceEntryConfigInterface {

  device_id: string,
  key: string,
  source: string,
  tag: string,
  value: string
}

// An semi-complete description of the UniFi Access device extras JSON.
export interface AccessDeviceExtrasConfigInterface {

  door_thumbnail: string,
  door_thumbnail_last_update: number,
  "uah-input_state_dps": boolean,
  "uah-wiring_state_dps-neg": boolean,
  "uah-wiring_state_dps-pos": boolean
}

// An semi-complete description of the UniFi Access door JSON.
export interface AccessDoorConfigInterface {

  camera_resource_ids: string[],
  device_groups: AccessDeviceConfigInterface[],
  door_guard: string[],
  extra_type: string,
  extras: AccessDeviceExtrasConfigInterface,
  full_name: string,
  hotel_devices: string[],
  level: number,
  location_type: string,
  name: string,
  timezone: string,
  unique_id: string,
  up_id: string,
  work_time_id: string,
  work_time: string[],

}

// An semi-complete description of the UniFi Access floor JSON.
export interface AccessFloorConfigInterface {

  doors: AccessDoorConfigInterface[],
  extra_type: string,
  extras: AccessDeviceExtrasConfigInterface,
  full_name: string,
  level: number,
  location_type: string,
  name: string,
  timezone: string,
  unique_id: string,
  up_id: string,
  work_time: string[],
  work_time_id: string
}

// An semi-complete description of the UniFi Access topology JSON.
export interface AccessTopologyConfigInterface {

  extra_type: string,
  extras: AccessDeviceExtrasConfigInterface,
  floors: AccessFloorConfigInterface[],
  full_name: string,
  level: number,
  location_type: string,
  name: string,
  timezone: string,
  unique_id: string,
  up_id: string,
  work_time_id: string,
  work_time: string[]
}

// This type declaration make all properties optional recursively including nested objects. This should
// only be used on JSON objects only. Otherwise...you're going to end up with class methods marked as
// optional as well. Credit for this belongs to: https://github.com/joonhocho/tsdef. #Grateful
/** @ignore */
export type DeepPartial<T> = {

  [P in keyof T]?: T[P] extends Array<infer I> ? Array<DeepPartial<I>> : DeepPartial<T[P]>
};

// We use types instead of interfaces here because we can more easily set the entire thing as readonly. Unfortunately, interfaces can't be quickly set as readonly in
// Typescript without marking each and every property as readonly along the way.
/** @interface */
export type AccessDeviceConfig = Readonly<AccessDeviceConfigInterface>;
/** @interface */
export type AccessDeviceConfigPayload = DeepPartial<AccessDeviceConfigInterface>;
/** @interface */
export type AccessDeviceEntryConfig = Readonly<AccessDeviceEntryConfigInterface>;
/** @interface */
export type AccessDeviceEntryConfigPayload = DeepPartial<AccessDeviceEntryConfigInterface>;
/** @interface */
export type AccessDoorConfig = Readonly<AccessDoorConfigInterface>;
/** @interface */
export type AccessDoorConfigPayload = DeepPartial<AccessDoorConfigInterface>;
/** @interface */
export type AccessFloorConfig = Readonly<AccessFloorConfigInterface>;
/** @interface */
export type AccessFloorConfigPayload = DeepPartial<AccessFloorConfigInterface>;
/** @interface */
export type AccessTopologyConfig = Readonly<AccessTopologyConfigInterface>;
/** @interface */
export type AccessTopologyConfigPayload = DeepPartial<AccessTopologyConfigInterface>;

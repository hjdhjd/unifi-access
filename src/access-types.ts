/* Copyright(C) 2019-2024, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * access-types.ts: Type definitions for UniFi Access.
 */

export interface AccessDeviceConfigEntryInterface {

  device_id: string,
  key: string,
  source: string,
  tag: string,
  value: string
}

// An semi-complete description of the UniFi Access device JSON.
export interface AccessDeviceConfigInterface {

  adopt_time: number,
  alias: string,
  bom_rev: string,
  capabilities: string[],
  configs: AccessDeviceConfigEntryInterface[],
  connected_uah_id: string,
  device_type: string,
  firmware: string,
  firmware_update_time: number,
  guid: string,
  hw_type: string,
  ip: string,
  is_adopted: boolean,
  is_connected: boolean,
  is_managed: boolean,
  is_online: boolean,
  is_revision_up_to_date: boolean,
  location: {
    extra_type: string,
    extras: {
      "uah-input_state_dps": string,
      "uah-wiring_state_dps-neg": string,
      "uah-wiring_state_dps-pos": string,
      door_thumbnail: string,
      door_thumbnail_last_update: number
    },
    full_name: string,
    level: number,
    location_type: string,
    name: string,
    timezone: string,
    unique_id: string,
    up_id: string,
    work_time: string,
    work_time_id: string
  },
  location_id: string,
  mac: string,
  name: string,
  need_advisory: boolean,
  resource_name: string,
  revision: string,
  revision_update_time: number,
  security_check: boolean,
  source: string,
  start_time: number,
  unique_id: string,
  update: string,
  version: string,
  version_update_time: number
}

// This type declaration make all properties optional recursively including nested objects. This should
// only be used on JSON objects only. Otherwise...you're going to end up with class methods marked as
// optional as well. Credit for this belongs to: https://github.com/joonhocho/tsdef. #Grateful
/** @ignore */
export type DeepPartial<T> = {

  [P in keyof T]?: T[P] extends Array<infer I> ? Array<DeepPartial<I>> : DeepPartial<T[P]>
};

// We use types instead of interfaces here because we can more easily set the entire thing as readonly.
// Unfortunately, interfaces can't be quickly set as readonly in Typescript without marking each and
// every property as readonly along the way.
/** @interface */
export type AccessDeviceConfig = Readonly<AccessDeviceConfigInterface>;
/** @interface */
export type AccessDeviceConfigPayload = DeepPartial<AccessDeviceConfigInterface>;

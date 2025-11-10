/* Copyright(C) 2019-2025, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * access-types.ts: Type definitions for UniFi Access.
 */
/** @ignore */
export type DeepPartial<T> = {

  [P in keyof T]?: T[P] extends Array<infer I> ? Array<DeepPartial<I>> : DeepPartial<T[P]>
};

/** @ignore */
export type Nullable<T> = T | null;

/**
 * UniFi Access API response JSON.
 */
export type AccessApiResponse = {

  code: number;
  codeS: string;
  msg: string;
  error: string;
  data: Record<string, unknown> | Record<string, unknown>[] | string;
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

  event: string;
  event_object_id: string;
  meta?: {

    all_field: boolean;
    id: string;
    object_type: string;
    source: string;
    target_field: string[];
  };
  receiver_id: string;
  save_to_history: boolean;
  data: Record<string, string> | Record<string, unknown> | AccessControllerConfig | AccessDeviceConfig;
};

// Access doorbell ring event data payload.
export type AccessEventDoorbellRing = {

  channel: string;
  clear_request_id: string;
  connected_uah_id: string;
  connected_uah_type: string;
  controller_id: string;
  create_time: number;
  device_id: string;
  device_name: string;
  device_type: string;
  door_guard_ids: string[];
  door_name: string;
  floor_name: string;
  host_device_mac: string;
  in_or_out: string;
  reason_code: number;
  request_id: string;
  room_id: string;
  support_feature: string[];
  token: string;
};

// Access doorbell ring cancel event data payload.
export type AccessEventDoorbellCancel = {

  reason_code: number;
  remote_call_request_id: string;
};

// An semi-complete description of the UniFi Access topology JSON, which we use to bootstrap.
export interface AccessBootstrapConfigInterface {

  alias?: string;
  device_groups?: AccessDeviceConfigInterface[];
  extra_type: string;
  extras: AccessDeviceExtrasConfigInterface;
  floors?: AccessFloorConfigInterface[];
  full_name: string;
  level: number;
  location_type: string;
  name?: string;
  timezone: string;
  unique_id: string;
  up_id: string;
  work_time_id: string;
  work_time: string[];
}

// An semi-complete description of the UniFi Access controller JSON.
export interface AccessControllerConfigInterface {

  adopted_by_uid: boolean;
  agent_info: {

    admin_portal: string | null;
    company_id: string;
    company_logo: string;
    company_name: string;
    configured: boolean;
    controller_id: string;
    current_admin_portal: string | null;
    endpoints: {

      admin: string;
      api: string;
      cell_name: string;
      "core-login": string;
    };
    host_device_id: string;
    is_access_kua: boolean;
    is_install: boolean;
    is_kua: boolean;
    is_migrating: boolean;
    is_running: boolean;
    is_setup: boolean;
    is_workspace_consistent: boolean;
    mqtt_connected: boolean;
    site_info: string | null;
    software_version: string;
    token_valid: boolean;
  };
  bt_config_revision: number;
  capabilities: string[];
  configured: boolean;
  disabled_by_uid: boolean;
  has_door_group: boolean;
  has_top_log: number;
  host: {

    device_type: string;
    firmware_version: string;
    gateway_ip: string;
    hostname: string;
    ip: string;
    mac: string;
    release_channel: string;
    shortname: string;
    time_zone: string;
    uptime: number;
    wan_ip: string;
  };
  protect_version: string;
  root_user_group: {

    create_time: string;
    name: string;
    system_name: string;
    unique_id: string;
    up_id: string;
    up_ids: string[];
  };
  support_qr_code: boolean;
  ucore_capabilities: string[];
  ui_cdn: string;
  uid_acess_portal: string;
  uid_adopt_info: string | null;
  uid_capabilities: string[];
  ulp_capabilities: string[];
  ulp_version: string;
  user_bt_revision: number;
  version: string;
}

// An semi-complete description of the UniFi Access device JSON.
export interface AccessDeviceConfigInterface {

  adopt_time: number;
  adopting: boolean;
  alias?: string;
  bom_rev: string;
  capabilities: string[];
  connected_uah_id: string;
  device_type: string;
  display_model?: string;
  configs?: AccessDeviceEntryConfigInterface[];
  door: {

    extra_type: string;
    full_name: string;
    level: number;
    location_type: string;
    name: string;
    timezone: string;
    unique_id: string;
    up_id: string;
    work_time: string[];
    work_time_id: string;
    extras: AccessDeviceExtrasConfigInterface;
  };
  extensions?: {

    device_id: string;
    extension_name: string;
    source_id?: string;
    target_config: {

      config_key: string;
      config_tag: string;
      config_value: boolean | number | string;
    }[];
    target_name?: string;
    target_type?: string;
    target_value?: string;
    unique_id: string;
  }[];
  firmware_update_time: number;
  firmware: string;
  floor: {

    extra_type: string;
    extras: AccessDeviceExtrasConfigInterface;
    full_name: string;
    level: number;
    location_type: string;
    name: string;
    timezone: string;
    unique_id: string;
    up_id: string;
    work_time: string[];
    work_time_id: string;
  };
  guid: string;
  hw_type: string;
  images: {

    l: string;
    m: string;
    s: string;
    xl: string;
    xs: string;
  };
  ip: string;
  is_adopted: boolean;
  is_connected: boolean;
  is_managed: boolean;
  is_online?: boolean;
  is_rebooting: boolean;
  location: {

    extra_type: string;
    extras: AccessDeviceExtrasConfigInterface;
    full_name: string;
    level: number;
    location_type: string;
    name: string;
    timezone: string;
    unique_id: string;
    up_id: string;
    work_time_id: string;
    work_time: string[];
  };
  location_id: string;
  mac: string;
  model: string;
  name?: string;
  need_advisory: boolean;
  resource_name: string;
  revision_update_time: number;
  revision: number;
  security_check: boolean;
  source: string;
  source_id: string;
  start_time: number;
  unique_id: string;
  update: string;
  update_manual: {

    device_version_upgrade_status: {

      completed: boolean;
      failed: boolean;
      failure_reason: string;
      is_downloading: boolean;
      is_upgrading: boolean;
      is_waiting: boolean;
      timed_out: boolean;
      upgrade_seconds: number;
    };

    from_version: string;
    last_upgrade_start_time: string;
    last_upgrade_success: string;
    last_upgrade_failure_reason: string;
  };
  version_update_time: number;
  version: string;
}

// An semi-complete description of the UniFi Access device entry configuration JSON.
export interface AccessDeviceEntryConfigInterface {

  device_id: string;
  key: string;
  source: string;
  tag: string;
  value: string;
}

// An semi-complete description of the UniFi Access device extras JSON.
export interface AccessDeviceExtrasConfigInterface {

  door_thumbnail: string;
  door_thumbnail_last_update: number;
  "uah-input_state_dps": boolean;
  "uah-wiring_state_dps-neg": boolean;
  "uah-wiring_state_dps-pos": boolean;
}

// An semi-complete description of the UniFi Access door JSON.
export interface AccessDoorConfigInterface {

  camera_resource_ids: string[];
  device_groups?: AccessDeviceConfigInterface[];
  door_guard: string[];
  extra_type: string;
  extras: AccessDeviceExtrasConfigInterface;
  full_name: string;
  hotel_devices: string[];
  level: number;
  location_type: string;
  name: string;
  timezone: string;
  unique_id: string;
  up_id: string;
  work_time_id: string;
  work_time: string[];
}

// An semi-complete description of the UniFi Access floor JSON.
export interface AccessFloorConfigInterface {

  doors: AccessDoorConfigInterface[];
  extra_type: string;
  extras: AccessDeviceExtrasConfigInterface;
  full_name: string;
  level: number;
  location_type: string;
  name: string;
  timezone: string;
  unique_id: string;
  up_id: string;
  work_time: string[];
  work_time_id: string;
}

// We use types instead of interfaces here because we can more easily set the entire thing as readonly. Unfortunately, interfaces can't be quickly set as readonly in
// Typescript without marking each and every property as readonly along the way.
/** @interface */
export type AccessBootstrapConfig = Readonly<AccessBootstrapConfigInterface>;
/** @interface */
export type AccessControllerConfig = Readonly<AccessControllerConfigInterface>;
/** @interface */
export type AccessControllerConfigPayload = DeepPartial<AccessControllerConfigInterface>;
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

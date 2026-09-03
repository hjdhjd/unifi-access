/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * device.ts: The UniFi Access device configuration types, including the per-device entry configuration, firmware update, and extension shapes.
 */
import type { AccessKnownJsonValue, DeepWirePartial, Nullable } from "./common.ts";
import type { AccessLocationConfigInterface } from "./topology.ts";

/**
 * The UniFi Access device configuration types: the device record itself and the device-scoped shapes it composes - the entry configuration rows the controller stores
 * per device, the firmware update state, and the extensions that bind a device to the doors and intercoms it serves.
 *
 * @module AccessTypesDevice
 */

/**
 * A semi-complete description of the UniFi Access device entry configuration JSON. Each entry is one key-value setting row the controller keeps for a device.
 */
export interface AccessDeviceEntryConfigInterface {

  // Timestamps the controller began emitting with 2026 firmware, and only on bootstrap responses.
  create_time?: string;
  device_id: string;
  key: string;
  // Present on entries arriving in an event payload and absent from entries in a bootstrap response, so it is optional in both directions.
  source?: string;
  tag: string;
  update_time?: string;
  value: string;

  [key: string]: AccessKnownJsonValue;
}

/**
 * A semi-complete description of the UniFi Access device JSON.
 */
export interface AccessDeviceConfigInterface {

  adopt_time: number;
  adopting: boolean;
  alias: string;
  bom_rev: string;
  /* A camera-capable reader carries the full camera payload of the companion UniFi Protect controller under these members. This library deliberately does not model
   * that shape: it belongs to Protect's own type surface, and mirroring it here would put a second, drifting copy of it in this package. The open record keeps the
   * fields reachable without casting for a consumer that wants them.
   */
  camera_setting?: Record<string, AccessKnownJsonValue>;
  cameras?: Record<string, AccessKnownJsonValue>[];
  capabilities: string[];
  configs: AccessDeviceEntryConfigInterface[];
  connected_uah_id: string;
  device_type: string;
  display_model: string;
  // Hardware attached to a door carries both the door and the floor above it. Hardware hosted directly by a building carries neither, so both are optional while the
  // location a device always belongs to is required.
  door?: AccessLocationConfigInterface;
  extensions?: {

    device_id: string;
    extension_name: string;
    source_id?: string;
    /* The entries do double duty, selected by `extension_name`. A `port_setting` extension carries real configuration keys whose values are booleans, numbers, or
     * strings. An `intercom_pair` extension carries an empty key and tag with the paired identifier as the value. The declared value union admits both, so a consumer
     * branches on `extension_name` rather than on the value's type.
     */
    target_config: {

      config_key: string;
      config_tag: string;
      config_value: boolean | number | string;
    }[];
    target_name?: string;
    target_type: string;
    target_value?: string;
    unique_id: string;
  }[];
  firmware: string;
  firmware_update_time: number;
  floor?: AccessLocationConfigInterface;
  guid: string;
  hw_type: string;
  // The sized icons are always present. The bootstrap response adds the animated icon set and the further sizes that event payloads omit. Only `animation` is a
  // list...`base` and `xxl` are single URLs like the sized icons.
  images: {

    animation?: string[];
    base?: string;
    l: string;
    m: string;
    s: string;
    xl: string;
    xs: string;
    xxl?: string;
  };
  ip: string;
  is_adopted: boolean;
  is_camera?: boolean;
  is_connected: boolean;
  is_export_sf_blocked?: boolean;
  is_managed: boolean;
  is_online: boolean;
  // Reported on bootstrap responses from 2026 firmware and absent from earlier controllers and from event payloads.
  is_rebooting?: boolean;
  is_unavailable?: boolean;
  is_upgrade_blocked?: boolean;
  last_seen?: number;
  location: AccessLocationConfigInterface;
  location_id: string;
  // The controller spells this in either case from one read to the next.
  mac: string;
  model: string;
  name: string;
  need_advisory: boolean;
  resource_name: string;
  /* A numeric string, not a number. The controller sends values beyond `Number.MAX_SAFE_INTEGER` here (specimens through 2026 run to nineteen digits), so parsing this
   * into a number silently corrupts it. Consumers compare these as strings.
   */
  revision: string;
  revision_update_time: number;
  security_check: boolean;
  // Null on every device the controller reports as managing itself, and a string on devices that name an upgrade source. Both forms are on the wire.
  source: Nullable<string>;
  // The port identity a per-port extension entry of an Enterprise Access Hub carries. It is declared at the top level as well because the access-point expansion
  // spreads a port's extension onto the record it synthesizes, so an expanded access point carries the member here and a consumer reads it as declared surface
  // rather than through the index signature.
  source_id?: string;
  start_time: number;
  // Sent as `null` wherever it appears, so the populated shape is unpinned and the open JSON type admits whatever the controller sends.
  template?: Nullable<AccessKnownJsonValue>;
  unique_id: string;
  update: Nullable<string>;
  update_manual: {

    device_type?: string;
    device_version_upgrade_status: {

      completed: boolean;
      failed: boolean;
      failure_reason: string;
      is_downloading: boolean;
      is_preparing?: boolean;
      is_upgrading: boolean;
      is_waiting: boolean;
      timed_out: boolean;
      upgrade_seconds: number;
    };
    downloaded?: boolean;
    from_version: string;
    // The download fields arrive with 2026 firmware on bootstrap responses only. The timestamps are nullable for the same reason as the upgrade timestamps below.
    last_download_failure_reason?: string;
    last_download_start_time?: Nullable<string>;
    last_download_success?: Nullable<string>;
    last_upgrade_failure_reason: string;
    // Null on a device that has never been upgraded through the controller, which is every device observed across the capture corpus.
    last_upgrade_start_time: Nullable<string>;
    last_upgrade_success: Nullable<string>;
  };
  version: Nullable<string>;
  version_update_time: number;

  [key: string]: AccessKnownJsonValue;
}

/** @see {@link AccessDeviceConfigInterface} */
export type AccessDeviceConfig = AccessDeviceConfigInterface;

/** @see {@link AccessDeviceConfigInterface} */
export type AccessDeviceConfigPayload = DeepWirePartial<AccessDeviceConfigInterface>;

/** @see {@link AccessDeviceEntryConfigInterface} */
export type AccessDeviceEntryConfig = AccessDeviceEntryConfigInterface;

/** @see {@link AccessDeviceEntryConfigInterface} */
export type AccessDeviceEntryConfigPayload = DeepWirePartial<AccessDeviceEntryConfigInterface>;

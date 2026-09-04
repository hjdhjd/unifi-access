/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * settings.ts: The UniFi Access controller settings types, describing the site-wide configuration a controller applies to its doors and readers.
 */
import type { AccessKnownJsonValue, Nullable } from "./common.ts";

/**
 * The site-wide UniFi Access controller settings: the management network and discovery configuration, the capture and live view behavior, the face, PIN, NFC and wallet
 * credential policy, the greeting and language presentation, and the firmware update channel.
 *
 * @module AccessTypesSettings
 */

/**
 * A semi-complete description of the UniFi Access controller settings JSON.
 *
 * Several members are string-encoded rather than typed as the booleans or numbers they read as - `face_anti_spoofing_enable_v2` arrives as `"no"` alongside genuine
 * JSON booleans, and the rate limits arrive as patterns like `"5-count/10-seconds"`. These are typed as the strings the controller actually sends, so a consumer parses
 * them rather than being handed a type that quietly disagrees with the wire.
 */
export interface AccessControllerSettingsConfigInterface {

  agreed_terms: boolean;
  all_kiosk_mode_count: number;
  allow_storing_face_photo: boolean;
  allow_storing_face_photo_for_uid: boolean;
  allow_third_party_nfc_cards: boolean;
  allow_user_to_upload_face_photo_for_uid: boolean;
  auto_update_device: boolean;
  auto_update_device_time: number;
  capture_enable: boolean;
  capture_record_seconds: number;
  capture_save_minute: number;
  capture_time_purge: boolean;
  card_format: string;
  controller_ip: string;
  // The keypad digits that answer an intercom call and release a door, each a single character.
  dial_key: {

    answer_key: string;
    unlock_key: string;
  };
  // The element shape is not settled: this list has only ever been observed empty, so the open JSON type admits whatever the controller sends.
  disabled_live_view_for_clients: AccessKnownJsonValue[];
  discovery_broadcast_ips: string[];
  door_bell_ring_expire_second: number;
  // The unlock methods offered on each reader class. Every one of these lists has only ever been observed empty, so their element shapes stay open.
  door_method_config: {

    lite_door_method: AccessKnownJsonValue[];
    mobile_door_method: AccessKnownJsonValue[];
    pro_door_method: AccessKnownJsonValue[];
  };
  enable_express_mode: boolean;
  // The misspelling of "flexible" is the controller's own field name, preserved here because it is the protocol rather than our error.
  enable_flexiable_schedule: boolean;
  enable_kiosk_mode_count: number;
  enable_local_user_credential_manage: boolean;
  // Whether door activity is recorded on the companion UniFi Protect controller.
  enable_recording_in_protect: boolean;
  enable_visitor_mgnt_from_identity_app: boolean;
  // The transposition of "enable" is the controller's own field name, preserved here because it is the protocol rather than our error.
  enbale_user_remote_unlock: boolean;
  entry_greet: string;
  entry_salutation: string;
  evacuation: boolean;
  exit_greet: string;
  exit_salutation: string;
  express_mode_device_ids: AccessKnownJsonValue[];
  face_anti_spoofing_device_ids: AccessKnownJsonValue[];
  // A string-encoded boolean, sent as `"no"` rather than as `false`.
  face_anti_spoofing_enable_v2: string;
  face_anti_spoofing_level: string;
  face_detect_distance: string;
  face_detect_threshold: string;
  face_enable: boolean;
  face_enable_for_uid: boolean;
  // Sent as `null` when no error is outstanding, and the populated shape has not been observed, so the open JSON type admits whatever the controller sends.
  face_error_code: Nullable<AccessKnownJsonValue>;
  // A rate limit expressed as a count-over-interval pattern, such as `"5-count/10-seconds"`.
  face_limit: string;
  has_capture_resource: boolean;
  has_ea_device: boolean;
  has_hdd_exist: boolean;
  has_low_device_version: boolean;
  has_user_used_id_card: boolean;
  is_gateway: boolean;
  language: string;
  language_device: string;
  live_view_timeout_for_doorbell: number;
  lockdown: boolean;
  /* The management network the controller binds to. Note the spelling against `mngt_network_id` below: the controller transposes the same abbreviation two different
   * ways across these two field names, and both are the protocol as sent rather than our error.
   */
  mgnt_network: {

    broadcast_ip: string;
    broadcast_ips: string[];
    gateway_ip: string;
    id: string;
    ip_subnet: string;
    ip_subnets: string[];
    is_any_networks: boolean;
    is_primary: boolean;
    name: string;
    vlan: string;
  };
  // Transposed the other way from `mgnt_network` above. Both spellings are the controller's own.
  mngt_network_id: string;
  nfc_limit: string;
  notify_to_admin: boolean;
  pin_code_length: number;
  pin_code_length_range: string;
  pin_code_length_type: string;
  pin_code_shuffle: boolean;
  pin_code_strong: boolean;
  pin_limit: string;
  // Sent as `null`, so the populated shape is unpinned and the open JSON type admits whatever the controller sends.
  pro_remote_channel: Nullable<AccessKnownJsonValue>;
  record_audio: boolean;
  show_card_format_setting: boolean;
  show_entry_greet: boolean;
  show_exit_greet: boolean;
  show_face_early_access_label: boolean;
  show_free_card_tips: boolean;
  show_old_ui: boolean;
  // Whether door recordings are surfaced in the companion UniFi Protect interface.
  show_recording_in_protect: boolean;
  show_wave: boolean;
  support_ble_bridge: boolean;
  support_change_pin_length: boolean;
  support_face_device_ids: string[];
  support_face_devices: number;
  support_face_feature: boolean;
  support_wallet_nfc_devices: number;
  time_format: number;
  touch_pass_count: number;
  uda_pro_capture_tof_enable: boolean;
  uda_pro_live_view_timeout: number;
  uda_pro_tof_trigger_value: number;
  unlock_failure_limit: boolean;
  update_channel: string;

  [key: string]: AccessKnownJsonValue;
}

/** @see {@link AccessControllerSettingsConfigInterface} */
export type AccessControllerSettingsConfig = AccessControllerSettingsConfigInterface;

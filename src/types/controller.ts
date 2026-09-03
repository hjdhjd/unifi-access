/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * controller.ts: The UniFi Access controller configuration types, describing the controller itself and the UniFi OS host it runs on.
 */
import type { AccessKnownJsonValue, DeepWirePartial, Nullable } from "./common.ts";

/**
 * The UniFi Access controller configuration: the controller's own identity and version, the capability and feature-flag lists it advertises, the cloud agent state, the
 * UniFi OS host it runs on, and the root user group.
 *
 * @module AccessTypesController
 */

/**
 * A semi-complete description of the UniFi Access controller JSON.
 */
export interface AccessControllerConfigInterface {

  adopted_by_ucs: boolean;
  adopted_by_uid: boolean;
  agent_info: {

    admin_portal: Nullable<string>;
    company_id: string;
    company_logo: string;
    company_name: string;
    configured: boolean;
    controller_id: string;
    current_admin_portal: Nullable<string>;
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
    site_info: Nullable<string>;
    software_version: string;
    token_valid: boolean;
  };
  bt_config_revision: number;
  capabilities: string[];
  configured: boolean;
  // The element shape is not pinned: this list has only ever been observed empty, so the open JSON type admits whatever the controller sends.
  critical_logs: AccessKnownJsonValue[];
  disabled_by_uid: boolean;
  face_sdk: boolean;
  feature_flags: string[];
  has_door_group: boolean;
  has_support_fingerprint_device: boolean;
  has_support_lpr_device: boolean;
  has_top_log: number;
  host: {

    device_type: string;
    firmware_version: string;
    gateway_ip: string;
    hostname: string;
    ip: string;
    // The controller spells this in either case from one read to the next.
    mac: string;
    release_channel: string;
    shortname: string;
    time_zone: string;
    uptime: number;
    wan_ip: string;
  };
  identity_standard_enable: boolean;
  is_fingerprint_disabled: boolean;
  // The misspelling of "device" is the controller's own field name, preserved here because it is the protocol rather than our error.
  prompt_upgrade_devcie_for_easy_provision: boolean;
  // The capabilities and version of the companion UniFi Protect controller, as Access reports them.
  protect_capabilities: string[];
  protect_version: string;
  remote_access_enabled: boolean;
  root_user_group: {

    create_time: string;
    name: string;
    system_name: string;
    unique_id: string;
    up_id: string;
    up_ids: string[];
  };
  should_reupload_photo: boolean;
  show_viewer_attendant: boolean;
  support_alarm_manager: boolean;
  support_apple_pass: boolean;
  support_assign_location_to_door_guard: boolean;
  support_callflow: boolean;
  support_easy_provision: boolean;
  support_google_pass: boolean;
  support_license_plate: boolean;
  support_qr_code: boolean;
  support_twilio_sip: boolean;
  system_log_cache_topic: string[];
  ucore_capabilities: string[];
  ucs_capabilities: string[];
  // As with `critical_logs`, observed only as an empty list, so the element shape stays open.
  ucs_feature: AccessKnownJsonValue[];
  ui_cdn: string;
  uid_access_portal: string;
  uid_adopt_info: Nullable<string>;
  uid_capabilities: string[];
  ulp_capabilities: string[];
  ulp_features: string[];
  ulp_version: string;
  user_assets_available: boolean;
  user_bt_revision: number;
  version: string;

  [key: string]: AccessKnownJsonValue;
}

/** @see {@link AccessControllerConfigInterface} */
export type AccessControllerConfig = AccessControllerConfigInterface;

/** @see {@link AccessControllerConfigInterface} */
export type AccessControllerConfigPayload = DeepWirePartial<AccessControllerConfigInterface>;

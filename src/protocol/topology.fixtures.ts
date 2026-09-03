/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * topology.fixtures.ts: The real documents a UniFi Access controller serves about itself and its topology, captured from live controllers and embedded verbatim.
 */
import type { AccessBootstrapConfig, AccessControllerConfig } from "../types/index.ts";

/* Real controller documents, each embedded exactly as its controller sent it. They are declared against the wire types rather than cast to them, so the compiler
 * checks the type model against real controller output every time the suite type-checks.
 *
 * The two bootstrap documents differ in the ways that matter to the reducer's flattening. The 2026 document attaches all of its hardware to doors and carries no
 * root-level device_groups at all; the 2024 document hosts one device directly on the building, so its root carries the doubly-nested device_groups the door level
 * also uses. Between them they exercise both flatten paths and both pruning targets with real wire material.
 */

// Captured from a live controller, 2026. Three doors on one floor, five devices, all door-attached.
export const accessBootstrap2026Fixture: AccessBootstrapConfig = {

  "unique_id": "00000000-0000-0000-0000-000000000000",
  "name": "Test Name 1",
  "up_id": "",
  "timezone": "",
  "location_type": "building",
  "extra_type": "",
  "full_name": "Test Name 1",
  "level": 0,
  "work_time": "[]",
  "work_time_id": "",
  "extras": {},
  "previous_name": [],
  "floors": [
    {

      "unique_id": "00000000-0000-0000-0000-000000000001",
      "name": "Test Name 2",
      "up_id": "00000000-0000-0000-0000-000000000000",
      "timezone": "",
      "location_type": "floor",
      "extra_type": "",
      "full_name": "Test Name 3",
      "level": 1,
      "work_time": "[]",
      "work_time_id": "",
      "extras": {},
      "previous_name": [],
      "doors": [
        {

          "unique_id": "00000000-0000-0000-0000-000000000002",
          "name": "Test Name 4",
          "up_id": "00000000-0000-0000-0000-000000000001",
          "timezone": "",
          "location_type": "door",
          "extra_type": "",
          "full_name": "Test Name 5",
          "level": 0,
          "work_time": "[]",
          "work_time_id": "",
          "extras": {},
          "previous_name": [],
          "device_groups": [
            [
              {

                "unique_id": "aabbcc000000",
                "name": "Test Name 6",
                "alias": "Test alias 7",
                "device_type": "UA-ULTRA",
                "connected_uah_id": "aabbcc000000",
                "location_id": "00000000-0000-0000-0000-000000000002",
                "firmware": "v1.7.4.0",
                "version": null,
                "ip": "192.0.2.1",
                "mac": "aa:bb:cc:00:00:00",
                "hw_type": "GA",
                "start_time": 1762223257,
                "last_seen": 1764008026,
                "security_check": true,
                "source": null,
                "bom_rev": "",
                "guid": "00000000-0000-0000-0000-000000000003",
                "need_advisory": false,
                "is_camera": false,
                "is_adopted": false,
                "is_managed": true,
                "is_connected": false,
                "is_online": false,
                "is_rebooting": false,
                "is_unavailable": false,
                "is_upgrade_blocked": false,
                "is_export_sf_blocked": false,
                "adopting": false,
                "location": {

                  "unique_id": "00000000-0000-0000-0000-000000000002",
                  "name": "Test Name 4",
                  "up_id": "00000000-0000-0000-0000-000000000001",
                  "timezone": "",
                  "location_type": "door",
                  "extra_type": "",
                  "full_name": "Test Name 5",
                  "level": 0,
                  "work_time": "[]",
                  "work_time_id": "",
                  "extras": {},
                  "previous_name": []
                },
                "door": {

                  "unique_id": "00000000-0000-0000-0000-000000000002",
                  "name": "Test Name 4",
                  "up_id": "00000000-0000-0000-0000-000000000001",
                  "timezone": "",
                  "location_type": "door",
                  "extra_type": "",
                  "full_name": "Test Name 5",
                  "level": 0,
                  "work_time": "[]",
                  "work_time_id": "",
                  "extras": {},
                  "previous_name": []
                },
                "floor": {

                  "unique_id": "00000000-0000-0000-0000-000000000001",
                  "name": "Test Name 2",
                  "up_id": "00000000-0000-0000-0000-000000000000",
                  "timezone": "",
                  "location_type": "floor",
                  "extra_type": "",
                  "full_name": "Test Name 3",
                  "level": 1,
                  "work_time": "[]",
                  "work_time_id": "",
                  "extras": {},
                  "previous_name": []
                },
                "configs": [
                  {

                    "device_id": "aabbcc000000",
                    "key": "alias",
                    "value": "Test alias 7",
                    "tag": "device_extra",
                    "update_time": "2025-06-14T11:37:05-05:00",
                    "create_time": "2025-05-15T12:47:59-05:00"
                  },
                  {

                    "device_id": "aabbcc000000",
                    "key": "apple_pass",
                    "value": "no",
                    "tag": "open_door_mode",
                    "update_time": "2025-07-16T13:49:37-05:00",
                    "create_time": "2025-07-16T08:49:37-05:00"
                  },
                  {

                    "device_id": "aabbcc000000",
                    "key": "aux_delay_dry",
                    "value": "0.1",
                    "tag": "uah_config",
                    "update_time": "2026-07-12T11:26:33-05:00",
                    "create_time": "2026-07-12T11:26:33-05:00"
                  },
                  {

                    "device_id": "aabbcc000000",
                    "key": "aux_delay_time",
                    "value": "0.1",
                    "tag": "uah_config",
                    "update_time": "2026-07-12T11:26:33-05:00",
                    "create_time": "2026-07-12T11:26:33-05:00"
                  },
                  {

                    "device_id": "aabbcc000000",
                    "key": "aux_delay_wet",
                    "value": "5",
                    "tag": "uah_config",
                    "update_time": "2026-07-12T11:26:33-05:00",
                    "create_time": "2026-07-12T11:26:33-05:00"
                  },
                  {

                    "device_id": "aabbcc000000",
                    "key": "aux_dry_bell_time",
                    "value": "0.5",
                    "tag": "uah_config",
                    "update_time": "2026-07-12T11:26:33-05:00",
                    "create_time": "2026-07-12T11:26:33-05:00"
                  },
                  {

                    "device_id": "aabbcc000000",
                    "key": "aux_dry_siren_time",
                    "value": "60",
                    "tag": "uah_config",
                    "update_time": "2026-07-12T11:26:33-05:00",
                    "create_time": "2026-07-12T11:26:33-05:00"
                  },
                  {

                    "device_id": "aabbcc000000",
                    "key": "aux_hold_dry",
                    "value": "5",
                    "tag": "uah_config",
                    "update_time": "2026-07-12T11:26:33-05:00",
                    "create_time": "2026-07-12T11:26:33-05:00"
                  },
                  {

                    "device_id": "aabbcc000000",
                    "key": "aux_mode_dry",
                    "value": "opener",
                    "tag": "uah_config",
                    "update_time": "2026-07-12T11:26:33-05:00",
                    "create_time": "2026-07-12T11:26:33-05:00"
                  },
                  {

                    "device_id": "aabbcc000000",
                    "key": "aux_mode_wet",
                    "value": "bell",
                    "tag": "uah_config",
                    "update_time": "2026-07-12T11:26:33-05:00",
                    "create_time": "2026-07-12T11:26:33-05:00"
                  },
                  {

                    "device_id": "aabbcc000000",
                    "key": "aux_wet_bell_time",
                    "value": "0.5",
                    "tag": "uah_config",
                    "update_time": "2026-07-12T11:26:33-05:00",
                    "create_time": "2026-07-12T11:26:33-05:00"
                  },
                  {

                    "device_id": "aabbcc000000",
                    "key": "aux_wet_siren_time",
                    "value": "60",
                    "tag": "uah_config",
                    "update_time": "2026-07-12T11:26:33-05:00",
                    "create_time": "2026-07-12T11:26:33-05:00"
                  },
                  {

                    "device_id": "aabbcc000000",
                    "key": "brightness",
                    "value": "0",
                    "tag": "uah_config",
                    "update_time": "2025-05-17T02:23:12-05:00",
                    "create_time": "2025-05-15T12:47:59-05:00"
                  },
                  {

                    "device_id": "aabbcc000000",
                    "key": "bt",
                    "value": "yes",
                    "tag": "open_door_mode",
                    "update_time": "2025-05-15T17:48:00-05:00",
                    "create_time": "2025-05-15T12:48:00-05:00"
                  },
                  {

                    "device_id": "aabbcc000000",
                    "key": "bt_button",
                    "value": "yes",
                    "tag": "open_door_mode",
                    "update_time": "2025-05-15T17:48:00-05:00",
                    "create_time": "2025-05-15T12:48:00-05:00"
                  },
                  {

                    "device_id": "aabbcc000000",
                    "key": "bt_tap",
                    "value": "yes",
                    "tag": "open_door_mode",
                    "update_time": "2025-05-15T17:48:00-05:00",
                    "create_time": "2025-05-15T12:48:00-05:00"
                  },
                  {

                    "device_id": "aabbcc000000",
                    "key": "cert_fingerprint",
                    "value": "0000000000000000000000000000000000000000",
                    "tag": "credential",
                    "update_time": "2025-05-15T17:47:59-05:00",
                    "create_time": "2025-05-15T12:47:59-05:00"
                  },
                  {

                    "device_id": "aabbcc000000",
                    "key": "door_entry_method",
                    "value": "in",
                    "tag": "door_entry_method",
                    "update_time": "2025-05-15T17:47:59-05:00",
                    "create_time": "2025-05-15T12:47:59-05:00"
                  },
                  {

                    "device_id": "aabbcc000000",
                    "key": "dps_mode",
                    "value": "no",
                    "tag": "uah_config",
                    "update_time": "2026-07-12T11:26:33-05:00",
                    "create_time": "2026-07-12T11:26:33-05:00"
                  },
                  {

                    "device_id": "aabbcc000000",
                    "key": "emergency_mode",
                    "value": "evacuate",
                    "tag": "uah_config",
                    "update_time": "2026-07-12T11:26:33-05:00",
                    "create_time": "2026-07-12T11:26:33-05:00"
                  },
                  {

                    "device_id": "aabbcc000000",
                    "key": "hold_relay_seconds",
                    "value": "5",
                    "tag": "uah_config",
                    "update_time": "2026-07-12T11:26:33-05:00",
                    "create_time": "2026-07-12T11:26:33-05:00"
                  },
                  {

                    "device_id": "aabbcc000000",
                    "key": "ibeacon_major",
                    "value": "0",
                    "tag": "device_setting",
                    "update_time": "2025-05-15T17:48:00-05:00",
                    "create_time": "2025-05-15T12:48:00-05:00"
                  },
                  {

                    "device_id": "aabbcc000000",
                    "key": "ibeacon_minor",
                    "value": "3",
                    "tag": "device_setting",
                    "update_time": "2025-05-15T17:56:39-05:00",
                    "create_time": "2025-05-15T12:48:00-05:00"
                  },
                  {

                    "device_id": "aabbcc000000",
                    "key": "ibeacon_uuid",
                    "value": "00000000-0000-0000-0000-000000000004",
                    "tag": "device_setting",
                    "update_time": "2025-05-15T17:48:00-05:00",
                    "create_time": "2025-05-15T12:48:00-05:00"
                  },
                  {

                    "device_id": "aabbcc000000",
                    "key": "input_d1_button",
                    "value": "off",
                    "tag": "hub_action",
                    "update_time": "2025-05-15T21:20:32-05:00",
                    "create_time": "2025-05-15T16:20:32-05:00"
                  },
                  {

                    "device_id": "aabbcc000000",
                    "key": "input_d1_dps",
                    "value": "off",
                    "tag": "hub_action",
                    "update_time": "2025-05-15T21:20:32-05:00",
                    "create_time": "2025-05-15T16:20:32-05:00"
                  },
                  {

                    "device_id": "aabbcc000000",
                    "key": "input_emer_mode",
                    "value": "no",
                    "tag": "uah_config",
                    "update_time": "2026-07-12T11:26:33-05:00",
                    "create_time": "2026-07-12T11:26:33-05:00"
                  },
                  {

                    "device_id": "aabbcc000000",
                    "key": "input_rel_mode",
                    "value": "no",
                    "tag": "uah_config",
                    "update_time": "2026-07-12T11:26:33-05:00",
                    "create_time": "2026-07-12T11:26:33-05:00"
                  },
                  {

                    "device_id": "aabbcc000000",
                    "key": "input_ren_mode",
                    "value": "no",
                    "tag": "uah_config",
                    "update_time": "2026-07-12T11:26:33-05:00",
                    "create_time": "2026-07-12T11:26:33-05:00"
                  },
                  {

                    "device_id": "aabbcc000000",
                    "key": "input_rex_mode",
                    "value": "no",
                    "tag": "uah_config",
                    "update_time": "2026-07-12T11:26:33-05:00",
                    "create_time": "2026-07-12T11:26:33-05:00"
                  },
                  {

                    "device_id": "aabbcc000000",
                    "key": "mobile_unlock_ver2",
                    "value": "yes",
                    "tag": "device_setting",
                    "update_time": "2025-05-15T17:50:28-05:00",
                    "create_time": "2025-05-15T12:50:28-05:00"
                  },
                  {

                    "device_id": "aabbcc000000",
                    "key": "nfc",
                    "value": "yes",
                    "tag": "open_door_mode",
                    "update_time": "2025-05-15T17:47:59-05:00",
                    "create_time": "2025-05-15T12:47:59-05:00"
                  },
                  {

                    "device_id": "aabbcc000000",
                    "key": "output_aux_mode",
                    "value": "opener",
                    "tag": "uah_config",
                    "update_time": "2026-07-12T11:26:33-05:00",
                    "create_time": "2026-07-12T11:26:33-05:00"
                  },
                  {

                    "device_id": "aabbcc000000",
                    "key": "output_d1_lock_relay",
                    "value": "off",
                    "tag": "hub_action",
                    "update_time": "2025-06-15T20:49:02-05:00",
                    "create_time": "2025-05-15T16:20:32-05:00"
                  },
                  {

                    "device_id": "aabbcc000000",
                    "key": "ren_button_mode",
                    "value": "push",
                    "tag": "uah_config",
                    "update_time": "2026-07-12T11:26:33-05:00",
                    "create_time": "2026-07-12T11:26:33-05:00"
                  },
                  {

                    "device_id": "aabbcc000000",
                    "key": "rex_button_mode",
                    "value": "push",
                    "tag": "uah_config",
                    "update_time": "2026-07-12T11:26:33-05:00",
                    "create_time": "2026-07-12T11:26:33-05:00"
                  },
                  {

                    "device_id": "aabbcc000000",
                    "key": "ssh_password",
                    "value": "REDACTED-00000000-xx",
                    "tag": "credential",
                    "update_time": "2025-11-01T05:00:00-05:00",
                    "create_time": "2025-05-15T12:47:59-05:00"
                  },
                  {

                    "device_id": "aabbcc000000",
                    "key": "ssh_user",
                    "value": "Test username 8",
                    "tag": "credential",
                    "update_time": "2025-05-15T17:47:59-05:00",
                    "create_time": "2025-05-15T12:47:59-05:00"
                  },
                  {

                    "device_id": "aabbcc000000",
                    "key": "tamper_event",
                    "value": "false",
                    "tag": "input_state",
                    "update_time": "2025-06-15T20:43:03-05:00",
                    "create_time": "2025-06-15T15:25:08-05:00"
                  },
                  {

                    "device_id": "aabbcc000000",
                    "key": "tampering",
                    "value": "false",
                    "tag": "uah_config",
                    "update_time": "2025-06-15T20:43:03-05:00",
                    "create_time": "2025-05-15T12:47:59-05:00"
                  },
                  {

                    "device_id": "aabbcc000000",
                    "key": "volume",
                    "value": "100",
                    "tag": "uah_config",
                    "update_time": "2025-05-15T17:47:59-05:00",
                    "create_time": "2025-05-15T12:47:59-05:00"
                  }
                ],
                "update": null,
                "update_manual": {

                  "device_version_upgrade_status": {

                    "completed": false,
                    "is_waiting": false,
                    "is_preparing": false,
                    "is_upgrading": false,
                    "upgrade_seconds": 0,
                    "timed_out": false,
                    "failed": false,
                    "failure_reason": "",
                    "is_downloading": false
                  },
                  "device_type": "",
                  "from_version": "",
                  "last_upgrade_start_time": null,
                  "last_upgrade_success": null,
                  "last_upgrade_failure_reason": "",
                  "last_download_start_time": null,
                  "last_download_success": null,
                  "last_download_failure_reason": "",
                  "downloaded": false
                },
                "capabilities": [
                  "ssh_change",
                  "support_ui_account",
                  "support_register_card",
                  "is_hub",
                  "identity_is_hub",
                  "support_upgrade_by_url",
                  "is_reader",
                  "identity_is_reader",
                  "support_reboot",
                  "first_person_in",
                  "unlock_schedule",
                  "incremental_update_setting",
                  "tamper_proofing",
                  "mobile_unlock_ver2",
                  "unlock_time_period_v2",
                  "rex_button_mode",
                  "dps_mode_selectable",
                  "nfc_card_easy_provision"
                ],
                "resource_name": "Test Name 9",
                "display_model": "UA Ultra",
                "revision": "1764007943753538037",
                "revision_update_time": 1764007952,
                "version_update_time": -62135596800,
                "firmware_update_time": -62135596800,
                "adopt_time": 1747331279,
                "extensions": [
                  {

                    "unique_id": "00000000-0000-0000-0000-000000000005",
                    "device_id": "aabbcc000000",
                    "extension_name": "port_setting",
                    "source_id": "port1",
                    "target_type": "door",
                    "target_value": "00000000-0000-0000-0000-000000000002",
                    "target_name": "Test Name 4",
                    "target_config": [
                      {

                        "config_tag": "device_setting",
                        "config_key": "lock_unlock_time",
                        "config_value": 60
                      },
                      {

                        "config_tag": "device_setting",
                        "config_key": "button_reverse",
                        "config_value": false
                      },
                      {

                        "config_tag": "device_setting",
                        "config_key": "is_relay_nc",
                        "config_value": false
                      },
                      {

                        "config_tag": "device_setting",
                        "config_key": "rex_button_mode",
                        "config_value": "dps"
                      },
                      {

                        "config_tag": "device_setting",
                        "config_key": "dps_reverse",
                        "config_value": false
                      },
                      {

                        "config_tag": "device_setting",
                        "config_key": "lock_type",
                        "config_value": ""
                      },
                      {

                        "config_tag": "device_setting",
                        "config_key": "lock_end_time",
                        "config_value": "0"
                      },
                      {

                        "config_tag": "device_setting",
                        "config_key": "unlock_time_period",
                        "config_value": ""
                      },
                      {

                        "config_tag": "device_setting",
                        "config_key": "lock_time_period",
                        "config_value": ""
                      },
                      {

                        "config_tag": "device_setting",
                        "config_key": "temp_lock_type",
                        "config_value": "reset"
                      }
                    ]
                  }
                ],
                "model": "UA Ultra",
                "images": {

                  "xs": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006d_25x25.png",
                  "s": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006d_32x32.png",
                  "m": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006d_51x51.png",
                  "l": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006d_64x64.png",
                  "xl": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006d_101x101.png",
                  "xxl": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006d_128x128.png",
                  "base": "icons/00000000-0000-0000-0000-00000000006d_257x257.png",
                  "animation": [
                    "icons/ua-ultra-close.png",
                    "icons/ua-ultra-open.png"
                  ]
                },
                "template": null
              }
            ]
          ],
          "hotel_devices": [],
          "door_guard": [],
          "camera_resource_ids": []
        },
        {

          "unique_id": "00000000-0000-0000-0000-000000000006",
          "name": "Test Name 10",
          "up_id": "00000000-0000-0000-0000-000000000001",
          "timezone": "",
          "location_type": "door",
          "extra_type": "",
          "full_name": "Test Name 11",
          "level": 0,
          "work_time": "[]",
          "work_time_id": "",
          "extras": {

            "door_thumbnail": "REDACTED-00000001-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
            "door_thumbnail_last_update": 1786602788,
            "uah-input_state_dps": "off",
            "uah-wiring_state_dps-neg": "off",
            "uah-wiring_state_dps-pos": "off"
          },
          "previous_name": [],
          "device_groups": [
            [
              {

                "unique_id": "aabbcc000001",
                "name": "Test Name 12",
                "alias": "Test alias 13",
                "device_type": "UAH",
                "connected_uah_id": "aabbcc000001",
                "location_id": "00000000-0000-0000-0000-000000000006",
                "firmware": "v4.12.19.0",
                "version": null,
                "ip": "192.0.2.2",
                "mac": "aa:bb:cc:00:00:01",
                "hw_type": "",
                "start_time": 1780317315,
                "last_seen": 1786606285,
                "security_check": false,
                "source": null,
                "bom_rev": "",
                "guid": "00000000-0000-0000-0000-000000000007",
                "need_advisory": false,
                "is_camera": false,
                "is_adopted": true,
                "is_managed": true,
                "is_connected": true,
                "is_online": true,
                "is_rebooting": false,
                "is_unavailable": false,
                "is_upgrade_blocked": false,
                "is_export_sf_blocked": false,
                "adopting": false,
                "location": {

                  "unique_id": "00000000-0000-0000-0000-000000000006",
                  "name": "Test Name 10",
                  "up_id": "00000000-0000-0000-0000-000000000001",
                  "timezone": "",
                  "location_type": "door",
                  "extra_type": "",
                  "full_name": "Test Name 11",
                  "level": 0,
                  "work_time": "[]",
                  "work_time_id": "",
                  "extras": {

                    "door_thumbnail": "REDACTED-00000001-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
                    "door_thumbnail_last_update": 1786602788,
                    "uah-input_state_dps": "off",
                    "uah-wiring_state_dps-neg": "off",
                    "uah-wiring_state_dps-pos": "off"
                  },
                  "previous_name": []
                },
                "door": {

                  "unique_id": "00000000-0000-0000-0000-000000000006",
                  "name": "Test Name 10",
                  "up_id": "00000000-0000-0000-0000-000000000001",
                  "timezone": "",
                  "location_type": "door",
                  "extra_type": "",
                  "full_name": "Test Name 11",
                  "level": 0,
                  "work_time": "[]",
                  "work_time_id": "",
                  "extras": {

                    "door_thumbnail": "REDACTED-00000001-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
                    "door_thumbnail_last_update": 1786602788,
                    "uah-input_state_dps": "off",
                    "uah-wiring_state_dps-neg": "off",
                    "uah-wiring_state_dps-pos": "off"
                  },
                  "previous_name": []
                },
                "floor": {

                  "unique_id": "00000000-0000-0000-0000-000000000001",
                  "name": "Test Name 2",
                  "up_id": "00000000-0000-0000-0000-000000000000",
                  "timezone": "",
                  "location_type": "floor",
                  "extra_type": "",
                  "full_name": "Test Name 3",
                  "level": 1,
                  "work_time": "[]",
                  "work_time_id": "",
                  "extras": {},
                  "previous_name": []
                },
                "configs": [
                  {

                    "device_id": "aabbcc000001",
                    "key": "alias",
                    "value": "Test alias 13",
                    "tag": "device_extra",
                    "update_time": "2025-06-14T11:36:47-05:00",
                    "create_time": "2024-06-30T13:03:48-05:00"
                  },
                  {

                    "device_id": "aabbcc000001",
                    "key": "aux_delay_dry",
                    "value": "0.1",
                    "tag": "uah_config",
                    "update_time": "2026-07-12T11:26:33-05:00",
                    "create_time": "2026-07-12T11:26:33-05:00"
                  },
                  {

                    "device_id": "aabbcc000001",
                    "key": "aux_delay_time",
                    "value": "0.1",
                    "tag": "uah_config",
                    "update_time": "2024-06-30T18:03:48-05:00",
                    "create_time": "2024-06-30T13:03:48-05:00"
                  },
                  {

                    "device_id": "aabbcc000001",
                    "key": "aux_delay_wet",
                    "value": "0.1",
                    "tag": "uah_config",
                    "update_time": "2024-06-30T18:03:53-05:00",
                    "create_time": "2024-06-30T13:03:53-05:00"
                  },
                  {

                    "device_id": "aabbcc000001",
                    "key": "aux_dry_bell_time",
                    "value": "0.5",
                    "tag": "uah_config",
                    "update_time": "2026-07-12T11:26:33-05:00",
                    "create_time": "2026-07-12T11:26:33-05:00"
                  },
                  {

                    "device_id": "aabbcc000001",
                    "key": "aux_dry_siren_time",
                    "value": "60",
                    "tag": "uah_config",
                    "update_time": "2026-07-12T11:26:33-05:00",
                    "create_time": "2026-07-12T11:26:33-05:00"
                  },
                  {

                    "device_id": "aabbcc000001",
                    "key": "aux_hold_dry",
                    "value": "5",
                    "tag": "uah_config",
                    "update_time": "2026-07-12T11:26:33-05:00",
                    "create_time": "2026-07-12T11:26:33-05:00"
                  },
                  {

                    "device_id": "aabbcc000001",
                    "key": "aux_mode_dry",
                    "value": "opener",
                    "tag": "uah_config",
                    "update_time": "2024-06-30T18:03:48-05:00",
                    "create_time": "2024-06-30T13:03:48-05:00"
                  },
                  {

                    "device_id": "aabbcc000001",
                    "key": "aux_mode_wet",
                    "value": "bell",
                    "tag": "uah_config",
                    "update_time": "2024-06-30T18:03:48-05:00",
                    "create_time": "2024-06-30T13:03:48-05:00"
                  },
                  {

                    "device_id": "aabbcc000001",
                    "key": "aux_wet_bell_time",
                    "value": "0.5",
                    "tag": "uah_config",
                    "update_time": "2026-07-12T11:26:33-05:00",
                    "create_time": "2026-07-12T11:26:33-05:00"
                  },
                  {

                    "device_id": "aabbcc000001",
                    "key": "aux_wet_siren_time",
                    "value": "60",
                    "tag": "uah_config",
                    "update_time": "2026-07-12T11:26:33-05:00",
                    "create_time": "2026-07-12T11:26:33-05:00"
                  },
                  {

                    "device_id": "aabbcc000001",
                    "key": "cert_fingerprint",
                    "value": "0000000000000000000000000000000000000001",
                    "tag": "credential",
                    "update_time": "2024-06-30T18:03:48-05:00",
                    "create_time": "2024-06-30T13:03:48-05:00"
                  },
                  {

                    "device_id": "aabbcc000001",
                    "key": "dps_mode",
                    "value": "no",
                    "tag": "uah_config",
                    "update_time": "2026-07-12T11:26:33-05:00",
                    "create_time": "2026-07-12T11:26:33-05:00"
                  },
                  {

                    "device_id": "aabbcc000001",
                    "key": "emergency_mode",
                    "value": "evacuate",
                    "tag": "uah_config",
                    "update_time": "2026-07-12T11:26:33-05:00",
                    "create_time": "2026-07-12T11:26:33-05:00"
                  },
                  {

                    "device_id": "aabbcc000001",
                    "key": "hold_relay_seconds",
                    "value": "5",
                    "tag": "uah_config",
                    "update_time": "2024-06-30T18:03:48-05:00",
                    "create_time": "2024-06-30T13:03:48-05:00"
                  },
                  {

                    "device_id": "aabbcc000001",
                    "key": "input_emer_mode",
                    "value": "no",
                    "tag": "uah_config",
                    "update_time": "2026-07-12T11:26:33-05:00",
                    "create_time": "2026-07-12T11:26:33-05:00"
                  },
                  {

                    "device_id": "aabbcc000001",
                    "key": "input_rel_mode",
                    "value": "no",
                    "tag": "uah_config",
                    "update_time": "2026-07-12T11:26:33-05:00",
                    "create_time": "2026-07-12T11:26:33-05:00"
                  },
                  {

                    "device_id": "aabbcc000001",
                    "key": "input_ren_mode",
                    "value": "no",
                    "tag": "uah_config",
                    "update_time": "2026-07-12T11:26:33-05:00",
                    "create_time": "2026-07-12T11:26:33-05:00"
                  },
                  {

                    "device_id": "aabbcc000001",
                    "key": "input_rex_mode",
                    "value": "no",
                    "tag": "uah_config",
                    "update_time": "2026-07-12T11:26:33-05:00",
                    "create_time": "2026-07-12T11:26:33-05:00"
                  },
                  {

                    "device_id": "aabbcc000001",
                    "key": "input_state_EMERGY",
                    "value": "off",
                    "tag": "input_state",
                    "update_time": "2024-06-30T18:04:01-05:00",
                    "create_time": "2024-06-30T13:04:01-05:00"
                  },
                  {

                    "device_id": "aabbcc000001",
                    "key": "input_state_SW-EMERGY",
                    "value": "off",
                    "tag": "input_state",
                    "update_time": "2024-06-30T18:04:01-05:00",
                    "create_time": "2024-06-30T13:04:01-05:00"
                  },
                  {

                    "device_id": "aabbcc000001",
                    "key": "input_state_dps",
                    "value": "off",
                    "tag": "input_state",
                    "update_time": "2024-06-30T18:04:01-05:00",
                    "create_time": "2024-06-30T13:04:01-05:00"
                  },
                  {

                    "device_id": "aabbcc000001",
                    "key": "input_state_rel",
                    "value": "off",
                    "tag": "input_state",
                    "update_time": "2024-06-30T18:04:01-05:00",
                    "create_time": "2024-06-30T13:04:01-05:00"
                  },
                  {

                    "device_id": "aabbcc000001",
                    "key": "input_state_ren",
                    "value": "off",
                    "tag": "input_state",
                    "update_time": "2024-06-30T18:04:01-05:00",
                    "create_time": "2024-06-30T13:04:01-05:00"
                  },
                  {

                    "device_id": "aabbcc000001",
                    "key": "input_state_rex",
                    "value": "off",
                    "tag": "input_state",
                    "update_time": "2024-06-30T18:04:01-05:00",
                    "create_time": "2024-06-30T13:04:01-05:00"
                  },
                  {

                    "device_id": "aabbcc000001",
                    "key": "input_state_rly-lock_dry",
                    "value": "off",
                    "tag": "input_state",
                    "update_time": "2025-03-29T21:05:46-05:00",
                    "create_time": "2024-06-30T13:04:01-05:00"
                  },
                  {

                    "device_id": "aabbcc000001",
                    "key": "lock_end_time",
                    "value": "0",
                    "tag": "uah_config",
                    "update_time": "2025-03-29T22:02:40-05:00",
                    "create_time": "2024-06-30T13:05:14-05:00"
                  },
                  {

                    "device_id": "aabbcc000001",
                    "key": "lock_now_mode",
                    "value": "disable_unlock_period",
                    "tag": "uah_config",
                    "update_time": "2025-03-29T21:49:02-05:00",
                    "create_time": "2025-03-29T16:49:02-05:00"
                  },
                  {

                    "device_id": "aabbcc000001",
                    "key": "lock_time_period",
                    "value": "",
                    "tag": "uah_config",
                    "update_time": "2024-10-04T15:31:27-05:00",
                    "create_time": "2024-07-12T12:04:54-05:00"
                  },
                  {

                    "device_id": "aabbcc000001",
                    "key": "lock_type",
                    "value": "",
                    "tag": "uah_config",
                    "update_time": "2025-03-29T22:02:40-05:00",
                    "create_time": "2024-06-30T13:05:14-05:00"
                  },
                  {

                    "device_id": "aabbcc000001",
                    "key": "nacl_private_key",
                    "value": "REDACTED-00000002-xxxxxxxxxxxxxxxxxxxxxxxxxx",
                    "tag": "credential",
                    "update_time": "2026-04-24T21:59:56-05:00",
                    "create_time": "2026-04-24T16:59:56-05:00"
                  },
                  {

                    "device_id": "aabbcc000001",
                    "key": "nacl_public_key",
                    "value": "REDACTED-00000003-xxxxxxxxxxxxxxxxxxxxxxxxxx",
                    "tag": "credential",
                    "update_time": "2024-06-30T18:03:48-05:00",
                    "create_time": "2024-06-30T13:03:48-05:00"
                  },
                  {

                    "device_id": "aabbcc000001",
                    "key": "output_aux_mode",
                    "value": "normal",
                    "tag": "uah_config",
                    "update_time": "2024-06-30T18:03:48-05:00",
                    "create_time": "2024-06-30T13:03:48-05:00"
                  },
                  {

                    "device_id": "aabbcc000001",
                    "key": "poe-type",
                    "value": "802.3bt",
                    "tag": "device_extra",
                    "update_time": "2024-06-30T18:04:01-05:00",
                    "create_time": "2024-06-30T13:04:01-05:00"
                  },
                  {

                    "device_id": "aabbcc000001",
                    "key": "port-mac-1",
                    "value": "aa:bb:cc:00:00:02",
                    "tag": "hub_action",
                    "update_time": "2026-07-14T11:07:27-05:00",
                    "create_time": "2024-07-09T12:25:12-05:00"
                  },
                  {

                    "device_id": "aabbcc000001",
                    "key": "port-mac-136",
                    "value": "",
                    "tag": "hub_action",
                    "update_time": "2025-11-07T21:25:18-06:00",
                    "create_time": "2025-11-07T15:25:08-06:00"
                  },
                  {

                    "device_id": "aabbcc000001",
                    "key": "port-mac-2",
                    "value": "",
                    "tag": "hub_action",
                    "update_time": "2026-01-24T04:16:34-06:00",
                    "create_time": "2026-01-22T16:07:54-06:00"
                  },
                  {

                    "device_id": "aabbcc000001",
                    "key": "port-mac-4",
                    "value": "aa:bb:cc:00:00:03",
                    "tag": "hub_action",
                    "update_time": "2026-07-12T11:43:53-05:00",
                    "create_time": "2024-07-09T12:25:12-05:00"
                  },
                  {

                    "device_id": "aabbcc000001",
                    "key": "port-mac-6",
                    "value": "aa:bb:cc:00:00:01",
                    "tag": "hub_action",
                    "update_time": "2024-07-09T17:25:12-05:00",
                    "create_time": "2024-07-09T12:25:12-05:00"
                  },
                  {

                    "device_id": "aabbcc000001",
                    "key": "port-mac-8",
                    "value": "",
                    "tag": "hub_action",
                    "update_time": "2025-10-05T23:07:13-05:00",
                    "create_time": "2025-10-05T18:07:01-05:00"
                  },
                  {

                    "device_id": "aabbcc000001",
                    "key": "ren_button_mode",
                    "value": "push",
                    "tag": "uah_config",
                    "update_time": "2026-07-12T11:26:33-05:00",
                    "create_time": "2026-07-12T11:26:33-05:00"
                  },
                  {

                    "device_id": "aabbcc000001",
                    "key": "rex_button_mode",
                    "value": "push",
                    "tag": "uah_config",
                    "update_time": "2026-07-12T11:26:33-05:00",
                    "create_time": "2026-07-12T11:26:33-05:00"
                  },
                  {

                    "device_id": "aabbcc000001",
                    "key": "ssh_password",
                    "value": "REDACTED-00000004-xx",
                    "tag": "credential",
                    "update_time": "2026-08-01T00:00:00-05:00",
                    "create_time": "2024-06-30T13:03:48-05:00"
                  },
                  {

                    "device_id": "aabbcc000001",
                    "key": "ssh_user",
                    "value": "Test username 8",
                    "tag": "credential",
                    "update_time": "2024-06-30T18:03:48-05:00",
                    "create_time": "2024-06-30T13:03:48-05:00"
                  },
                  {

                    "device_id": "aabbcc000001",
                    "key": "temp_lock_type",
                    "value": "lock_now",
                    "tag": "uah_config",
                    "update_time": "2025-03-29T22:02:40-05:00",
                    "create_time": "2024-07-09T10:37:08-05:00"
                  },
                  {

                    "device_id": "aabbcc000001",
                    "key": "temporary_unlock_suspend_end_time",
                    "value": "0",
                    "tag": "device_setting",
                    "update_time": "2026-06-01T12:38:12-05:00",
                    "create_time": "2026-06-01T07:38:12-05:00"
                  },
                  {

                    "device_id": "aabbcc000001",
                    "key": "uah_token",
                    "value": "REDACTED-00000005-xxxxxxxxxxxxxxxxxx",
                    "tag": "uah_config",
                    "update_time": "2024-06-30T18:03:48-05:00",
                    "create_time": "2024-06-30T13:03:48-05:00"
                  },
                  {

                    "device_id": "aabbcc000001",
                    "key": "unlock_schedule_suspend_end_time",
                    "value": "0",
                    "tag": "device_setting",
                    "update_time": "2026-06-01T12:38:12-05:00",
                    "create_time": "2026-06-01T07:38:12-05:00"
                  },
                  {

                    "device_id": "aabbcc000001",
                    "key": "unlock_suspend_status",
                    "value": "end",
                    "tag": "device_setting",
                    "update_time": "2026-06-01T12:38:12-05:00",
                    "create_time": "2026-06-01T07:38:12-05:00"
                  },
                  {

                    "device_id": "aabbcc000001",
                    "key": "unlock_suspend_type",
                    "value": "",
                    "tag": "device_setting",
                    "update_time": "2026-06-01T12:38:12-05:00",
                    "create_time": "2026-06-01T07:38:12-05:00"
                  },
                  {

                    "device_id": "aabbcc000001",
                    "key": "unlock_suspend_types",
                    "value": "",
                    "tag": "device_setting",
                    "update_time": "2026-06-01T12:38:12-05:00",
                    "create_time": "2026-06-01T07:38:12-05:00"
                  },
                  {

                    "device_id": "aabbcc000001",
                    "key": "unlock_time_period",
                    "value": "",
                    "tag": "uah_config",
                    "update_time": "2025-03-29T22:02:40-05:00",
                    "create_time": "2024-07-09T10:37:08-05:00"
                  },
                  {

                    "device_id": "aabbcc000001",
                    "key": "wiring_state_12v-neg",
                    "value": "off",
                    "tag": "wiring_state",
                    "update_time": "2024-06-30T18:04:00-05:00",
                    "create_time": "2024-06-30T13:04:00-05:00"
                  },
                  {

                    "device_id": "aabbcc000001",
                    "key": "wiring_state_12v-pos",
                    "value": "off",
                    "tag": "wiring_state",
                    "update_time": "2024-06-30T18:04:00-05:00",
                    "create_time": "2024-06-30T13:04:00-05:00"
                  },
                  {

                    "device_id": "aabbcc000001",
                    "key": "wiring_state_aux-dry-cn",
                    "value": "off",
                    "tag": "wiring_state",
                    "update_time": "2024-06-30T18:04:01-05:00",
                    "create_time": "2024-06-30T13:04:01-05:00"
                  },
                  {

                    "device_id": "aabbcc000001",
                    "key": "wiring_state_aux-dry-com",
                    "value": "off",
                    "tag": "wiring_state",
                    "update_time": "2024-06-30T18:04:01-05:00",
                    "create_time": "2024-06-30T13:04:01-05:00"
                  },
                  {

                    "device_id": "aabbcc000001",
                    "key": "wiring_state_aux-dry-nc",
                    "value": "off",
                    "tag": "wiring_state",
                    "update_time": "2024-06-30T18:04:01-05:00",
                    "create_time": "2024-06-30T13:04:01-05:00"
                  },
                  {

                    "device_id": "aabbcc000001",
                    "key": "wiring_state_aux-dry-no",
                    "value": "off",
                    "tag": "wiring_state",
                    "update_time": "2024-06-30T18:04:01-05:00",
                    "create_time": "2024-06-30T13:04:01-05:00"
                  },
                  {

                    "device_id": "aabbcc000001",
                    "key": "wiring_state_aux-wet-com",
                    "value": "off",
                    "tag": "wiring_state",
                    "update_time": "2024-06-30T18:04:01-05:00",
                    "create_time": "2024-06-30T13:04:01-05:00"
                  },
                  {

                    "device_id": "aabbcc000001",
                    "key": "wiring_state_aux-wet-nc",
                    "value": "off",
                    "tag": "wiring_state",
                    "update_time": "2024-06-30T18:04:01-05:00",
                    "create_time": "2024-06-30T13:04:01-05:00"
                  },
                  {

                    "device_id": "aabbcc000001",
                    "key": "wiring_state_aux-wet-no",
                    "value": "off",
                    "tag": "wiring_state",
                    "update_time": "2024-06-30T18:04:01-05:00",
                    "create_time": "2024-06-30T13:04:01-05:00"
                  },
                  {

                    "device_id": "aabbcc000001",
                    "key": "wiring_state_bitmap",
                    "value": "83886080",
                    "tag": "wiring_state",
                    "update_time": "2026-01-24T04:16:31-06:00",
                    "create_time": "2024-06-30T13:04:00-05:00"
                  },
                  {

                    "device_id": "aabbcc000001",
                    "key": "wiring_state_dps-neg",
                    "value": "off",
                    "tag": "wiring_state",
                    "update_time": "2024-06-30T18:04:01-05:00",
                    "create_time": "2024-06-30T13:04:01-05:00"
                  },
                  {

                    "device_id": "aabbcc000001",
                    "key": "wiring_state_dps-pos",
                    "value": "off",
                    "tag": "wiring_state",
                    "update_time": "2024-06-30T18:04:01-05:00",
                    "create_time": "2024-06-30T13:04:01-05:00"
                  },
                  {

                    "device_id": "aabbcc000001",
                    "key": "wiring_state_lock-dry-com",
                    "value": "off",
                    "tag": "wiring_state",
                    "update_time": "2024-06-30T18:04:01-05:00",
                    "create_time": "2024-06-30T13:04:01-05:00"
                  },
                  {

                    "device_id": "aabbcc000001",
                    "key": "wiring_state_lock-dry-nc",
                    "value": "off",
                    "tag": "wiring_state",
                    "update_time": "2024-06-30T18:04:01-05:00",
                    "create_time": "2024-06-30T13:04:01-05:00"
                  },
                  {

                    "device_id": "aabbcc000001",
                    "key": "wiring_state_lock-dry-no",
                    "value": "off",
                    "tag": "wiring_state",
                    "update_time": "2024-06-30T18:04:01-05:00",
                    "create_time": "2024-06-30T13:04:01-05:00"
                  },
                  {

                    "device_id": "aabbcc000001",
                    "key": "wiring_state_lock-wet-com",
                    "value": "off",
                    "tag": "wiring_state",
                    "update_time": "2024-06-30T18:04:01-05:00",
                    "create_time": "2024-06-30T13:04:01-05:00"
                  },
                  {

                    "device_id": "aabbcc000001",
                    "key": "wiring_state_lock-wet-nc",
                    "value": "off",
                    "tag": "wiring_state",
                    "update_time": "2024-06-30T18:04:01-05:00",
                    "create_time": "2024-06-30T13:04:01-05:00"
                  },
                  {

                    "device_id": "aabbcc000001",
                    "key": "wiring_state_lock-wet-no",
                    "value": "off",
                    "tag": "wiring_state",
                    "update_time": "2024-06-30T18:04:01-05:00",
                    "create_time": "2024-06-30T13:04:01-05:00"
                  },
                  {

                    "device_id": "aabbcc000001",
                    "key": "wiring_state_poe-p1-exit",
                    "value": "on",
                    "tag": "wiring_state",
                    "update_time": "2025-05-16T16:15:32-05:00",
                    "create_time": "2024-06-30T13:04:01-05:00"
                  },
                  {

                    "device_id": "aabbcc000001",
                    "key": "wiring_state_poe-p2-enter",
                    "value": "off",
                    "tag": "wiring_state",
                    "update_time": "2026-01-24T04:18:32-06:00",
                    "create_time": "2024-06-30T13:04:01-05:00"
                  },
                  {

                    "device_id": "aabbcc000001",
                    "key": "wiring_state_poe-p3-camera",
                    "value": "on",
                    "tag": "wiring_state",
                    "update_time": "2025-05-16T17:10:32-05:00",
                    "create_time": "2024-06-30T13:04:01-05:00"
                  },
                  {

                    "device_id": "aabbcc000001",
                    "key": "wiring_state_rel-neg",
                    "value": "off",
                    "tag": "wiring_state",
                    "update_time": "2024-06-30T18:04:01-05:00",
                    "create_time": "2024-06-30T13:04:01-05:00"
                  },
                  {

                    "device_id": "aabbcc000001",
                    "key": "wiring_state_rel-pos",
                    "value": "off",
                    "tag": "wiring_state",
                    "update_time": "2024-06-30T18:04:01-05:00",
                    "create_time": "2024-06-30T13:04:01-05:00"
                  },
                  {

                    "device_id": "aabbcc000001",
                    "key": "wiring_state_ren-neg",
                    "value": "off",
                    "tag": "wiring_state",
                    "update_time": "2024-06-30T18:04:00-05:00",
                    "create_time": "2024-06-30T13:04:00-05:00"
                  },
                  {

                    "device_id": "aabbcc000001",
                    "key": "wiring_state_ren-pos",
                    "value": "off",
                    "tag": "wiring_state",
                    "update_time": "2024-06-30T18:04:00-05:00",
                    "create_time": "2024-06-30T13:04:00-05:00"
                  },
                  {

                    "device_id": "aabbcc000001",
                    "key": "wiring_state_rex-neg",
                    "value": "off",
                    "tag": "wiring_state",
                    "update_time": "2024-06-30T18:04:01-05:00",
                    "create_time": "2024-06-30T13:04:01-05:00"
                  },
                  {

                    "device_id": "aabbcc000001",
                    "key": "wiring_state_rex-pos",
                    "value": "off",
                    "tag": "wiring_state",
                    "update_time": "2024-06-30T18:04:01-05:00",
                    "create_time": "2024-06-30T13:04:01-05:00"
                  },
                  {

                    "device_id": "aabbcc000001",
                    "key": "wiring_state_support-bitmap",
                    "value": "on",
                    "tag": "wiring_state",
                    "update_time": "2024-06-30T18:04:01-05:00",
                    "create_time": "2024-06-30T13:04:01-05:00"
                  }
                ],
                "update": null,
                "update_manual": {

                  "device_version_upgrade_status": {

                    "completed": false,
                    "is_waiting": false,
                    "is_preparing": false,
                    "is_upgrading": false,
                    "upgrade_seconds": 0,
                    "timed_out": false,
                    "failed": false,
                    "failure_reason": "",
                    "is_downloading": false
                  },
                  "device_type": "",
                  "from_version": "",
                  "last_upgrade_start_time": null,
                  "last_upgrade_success": null,
                  "last_upgrade_failure_reason": "",
                  "last_download_start_time": null,
                  "last_download_success": null,
                  "last_download_failure_reason": "",
                  "downloaded": false
                },
                "capabilities": [
                  "unlock_failure_limit",
                  "emergency_settings",
                  "user_access_control",
                  "visitor_access_control",
                  "schedule_v1",
                  "unlock_schedule",
                  "incremental_update_user_token",
                  "support_upgrade_by_url",
                  "support_reboot",
                  "first_person_in",
                  "pin_code",
                  "is_hub",
                  "identity_is_hub",
                  "dps_alarm",
                  "input_mode_switch",
                  "aux_alarm",
                  "aux_delay_time",
                  "hold_time_0.1s",
                  "lock_relay_report",
                  "ssh_change",
                  "door_bell",
                  "multi_unlock_schedule",
                  "support_ui_account",
                  "aux_option_change",
                  "unlock_time_period",
                  "incremental_update_setting",
                  "incremental_update_credentials",
                  "mqtt_topic_update_setting",
                  "support_lpr_unlock",
                  "mobile_unlock_ver2",
                  "report_viewer_id",
                  "two_factor_auth",
                  "nfc_card_easy_provision",
                  "power_state",
                  "double_badge",
                  "unlock_suspend",
                  "location_state",
                  "any_auth_type"
                ],
                "resource_name": "Test Name 14",
                "display_model": "UA Hub",
                "revision": "1785876758583455467",
                "revision_update_time": 1785876788,
                "version_update_time": -62135596800,
                "firmware_update_time": -62135596800,
                "adopt_time": 1719770628,
                "cameras": [
                  {

                    "mac": "AABBCC000002",
                    "ip": "192.0.2.3",
                    "name": "Test Name 15",
                    "status": "online",
                    "firmwareStatus": "upToDate",
                    "firmware": "1.14.17.0",
                    "startupTime": 1784045238000,
                    "model": "UA G2 PRO",
                    "shortname": "Test shortname 16",
                    "isManaged": true,
                    "isAdopted": true,
                    "isConnected": true,
                    "isAdoptedByAccessApp": true,
                    "metadata": {

                      "deviceType": "camera",
                      "uniqueId": "000000000000000000000002"
                    },
                    "guid": "00000000-0000-0000-0000-000000000008",
                    "source": "protect",
                    "uniqueId": "000000000000000000000002",
                    "type": "UA G2 PRO",
                    "supportLicensePlate": false,
                    "supportDetectLPOnly": false,
                    "videoWidth": 1200,
                    "videoHeight": 1600,
                    "videoCodec": "h264",
                    "lastSeen": 1786606200097,
                    "hubMac": "",
                    "smartDetectZones": [
                      {

                        "id": 10001,
                        "name": "Test Name 17",
                        "color": "#AB46BC",
                        "points": [
                          [
                            0,
                            0
                          ],
                          [
                            1,
                            0
                          ],
                          [
                            1,
                            1
                          ],
                          [
                            0,
                            1
                          ]
                        ],
                        "sensitivity": 50,
                        "objectTypes": [
                          "person",
                          "vehicle",
                          "animal",
                          "face",
                          "licensePlate"
                        ],
                        "isTriggerLightEnabled": true,
                        "triggerAccessTypes": [],
                        "source": "unifi-access",
                        "enableAccessLPOnlyMode": false
                      }
                    ],
                    "allSmartDetectZones": [],
                    "smartDetectSettings": {

                      "objectTypes": [],
                      "autoTrackingObjectTypes": [],
                      "autoTrackingWithZoom": true,
                      "audioTypes": [],
                      "enableTamperDetection": false,
                      "detectionRange": {

                        "max": 0,
                        "min": 0
                      }
                    },
                    "supportDoorAccessConfig": false,
                    "recordingSettings": {

                      "mode": "never",
                      "prePaddingSecs": 5,
                      "postPaddingSecs": 5,
                      "smartDetectPrePaddingSecs": 2,
                      "smartDetectPostPaddingSecs": 2,
                      "minMotionEventTrigger": 1000,
                      "endMotionEventDelay": 3000,
                      "suppressIlluminationSurge": false,
                      "inScheduleMode": "always",
                      "outScheduleMode": "never",
                      "geofencing": "off",
                      "motionAlgorithm": "enhanced",
                      "enableMotionDetection": false,
                      "createAccessEvent": true,
                      "useNewMotionAlgorithm": true
                    },
                    "osdSettings": {

                      "isNameEnabled": false,
                      "isDateEnabled": false,
                      "isLogoEnabled": false,
                      "isDebugEnabled": false
                    },
                    "micVolume": 100,
                    "isMicEnabled": true,
                    "talkbackSettings": {

                      "bindAddr": "",
                      "bindPort": 8182,
                      "bitsPerSample": 16,
                      "channels": 1,
                      "filterAddr": "",
                      "filterPort": 0,
                      "quality": 0,
                      "samplingRate": 48000,
                      "typeFmt": "aac",
                      "typeIn": ""
                    },
                    "hasSpeaker": true,
                    "isWaterproofCaseAttached": false,
                    "ispSettings": {

                      "aeMode": "auto",
                      "irLedMode": "auto",
                      "irLedLevel": 255,
                      "wdr": 1,
                      "icrSensitivity": 0,
                      "icrSwitchMode": "sensitivity",
                      "icrCustomValue": 2,
                      "brightness": 50,
                      "contrast": 50,
                      "hue": 50,
                      "saturation": 50,
                      "sharpness": 50,
                      "denoise": 50,
                      "isColorNightVisionEnabled": false,
                      "spotlightDuration": 15,
                      "isFlippedVertical": false,
                      "isFlippedHorizontal": false,
                      "isAutoRotateEnabled": false,
                      "isLdcEnabled": true,
                      "is3dnrEnabled": true,
                      "isExternalIrEnabled": false,
                      "isAggressiveAntiFlickerEnabled": false,
                      "isPauseMotionEnabled": false,
                      "dZoomCenterX": 50,
                      "dZoomCenterY": 50,
                      "dZoomScale": 0,
                      "dZoomStreamId": 4,
                      "focusPosition": 0,
                      "touchFocusX": 0,
                      "touchFocusY": 0,
                      "zoomPosition": 0,
                      "mountPosition": null,
                      "hdrMode": "normal",
                      "sceneMode": "auto",
                      "isSmokeCoverModeEnabled": false
                    },
                    "isPoorNetwork": false,
                    "featureFlags": {

                      "smartDetectTypes": [],
                      "supportDoorAccessConfig": false,
                      "supportNfc": false,
                      "supportLpOnly": false,
                      "supportLpDetectionWithoutVehicle": false,
                      "hasMic": true,
                      "hasPackageCamera": false,
                      "hasPackageZoneSupportForSecondaryLens": false,
                      "canOpticalZoom": false,
                      "hotPlug": {

                        "audio": null
                      },
                      "reader": {

                        "supportAccessMethods": [],
                        "support2fa": false,
                        "supportLocate": false,
                        "supportDoorDirection": false,
                        "supportCallerManager": false,
                        "supportInterfaceDirectory": false,
                        "supportGreetings": false,
                        "supportShowInterfaceImage": false,
                        "supportShowStatusBar": false,
                        "supportShowHeading": false,
                        "supportGateStop": false
                      }
                    },
                    "currentResolution": "HD",
                    "supportNfc": false,
                    "supportTouchPass": false,
                    "supportFaceUnlock": false,
                    "supportBtButton": false,
                    "supportBtTap": false,
                    "supportQrCode": false,
                    "supportPIN": false,
                    "supportTwoStepAuth": false,
                    "supportGreeting": false,
                    "supportDirection": false,
                    "supportCallerManager": false,
                    "supportMobileUnlockV2": false,
                    "supportCallerDirectory": false,
                    "supportTwilioSip": false,
                    "supportGateStop": false,
                    "supportShowInterfaceImage": false,
                    "supportShowStatusBar": false,
                    "supportShowHeading": false,
                    "isFloodlightTriggerEnabled": false,
                    "stats": {

                      "video": {

                        "recordingStart": 0,
                        "recordingEnd": 0,
                        "recordingStartLQ": 0,
                        "recordingEndLQ": 0
                      }
                    }
                  }
                ],
                "model": "UA Hub",
                "images": {

                  "xs": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-000000000067_25x25.png",
                  "s": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-000000000067_32x32.png",
                  "m": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-000000000067_51x51.png",
                  "l": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-000000000067_64x64.png",
                  "xl": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-000000000067_101x101.png",
                  "xxl": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-000000000067_128x128.png",
                  "base": "icons/00000000-0000-0000-0000-000000000067_257x257.png"
                },
                "template": null
              },
              {

                "unique_id": "aabbcc000002",
                "name": "Test Name 18",
                "alias": "",
                "device_type": "UA-G2-PRO",
                "connected_uah_id": "aabbcc000001",
                "location_id": "00000000-0000-0000-0000-000000000006",
                "firmware": "v1.14.17.0",
                "version": null,
                "ip": "192.0.2.3",
                "mac": "aa:bb:cc:00:00:02",
                "hw_type": "GA",
                "start_time": 1784045238,
                "last_seen": 1786606285,
                "security_check": true,
                "source": null,
                "bom_rev": "",
                "guid": "00000000-0000-0000-0000-000000000009",
                "need_advisory": false,
                "is_camera": false,
                "is_adopted": true,
                "is_managed": true,
                "is_connected": true,
                "is_online": true,
                "is_rebooting": false,
                "is_unavailable": false,
                "is_upgrade_blocked": false,
                "is_export_sf_blocked": false,
                "adopting": false,
                "location": {

                  "unique_id": "00000000-0000-0000-0000-000000000006",
                  "name": "Test Name 10",
                  "up_id": "00000000-0000-0000-0000-000000000001",
                  "timezone": "",
                  "location_type": "door",
                  "extra_type": "",
                  "full_name": "Test Name 11",
                  "level": 0,
                  "work_time": "[]",
                  "work_time_id": "",
                  "extras": {

                    "door_thumbnail": "REDACTED-00000001-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
                    "door_thumbnail_last_update": 1786602788,
                    "uah-input_state_dps": "off",
                    "uah-wiring_state_dps-neg": "off",
                    "uah-wiring_state_dps-pos": "off"
                  },
                  "previous_name": []
                },
                "door": {

                  "unique_id": "00000000-0000-0000-0000-000000000006",
                  "name": "Test Name 10",
                  "up_id": "00000000-0000-0000-0000-000000000001",
                  "timezone": "",
                  "location_type": "door",
                  "extra_type": "",
                  "full_name": "Test Name 11",
                  "level": 0,
                  "work_time": "[]",
                  "work_time_id": "",
                  "extras": {

                    "door_thumbnail": "REDACTED-00000001-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
                    "door_thumbnail_last_update": 1786602788,
                    "uah-input_state_dps": "off",
                    "uah-wiring_state_dps-neg": "off",
                    "uah-wiring_state_dps-pos": "off"
                  },
                  "previous_name": []
                },
                "floor": {

                  "unique_id": "00000000-0000-0000-0000-000000000001",
                  "name": "Test Name 2",
                  "up_id": "00000000-0000-0000-0000-000000000000",
                  "timezone": "",
                  "location_type": "floor",
                  "extra_type": "",
                  "full_name": "Test Name 3",
                  "level": 1,
                  "work_time": "[]",
                  "work_time_id": "",
                  "extras": {},
                  "previous_name": []
                },
                "configs": [
                  {

                    "device_id": "aabbcc000002",
                    "key": "alias",
                    "value": "",
                    "tag": "device_extra",
                    "update_time": "2024-06-30T18:03:49-05:00",
                    "create_time": "2024-06-30T13:03:49-05:00"
                  },
                  {

                    "device_id": "aabbcc000002",
                    "key": "apple_pass",
                    "value": "no",
                    "tag": "open_door_mode",
                    "update_time": "2025-07-16T13:49:37-05:00",
                    "create_time": "2025-07-16T08:49:37-05:00"
                  },
                  {

                    "device_id": "aabbcc000002",
                    "key": "brightness",
                    "value": "36",
                    "tag": "device_setting",
                    "update_time": "2024-06-30T18:03:50-05:00",
                    "create_time": "2024-06-30T13:03:50-05:00"
                  },
                  {

                    "device_id": "aabbcc000002",
                    "key": "bt",
                    "value": "yes",
                    "tag": "open_door_mode",
                    "update_time": "2024-09-06T04:16:42-05:00",
                    "create_time": "2024-06-30T13:03:49-05:00"
                  },
                  {

                    "device_id": "aabbcc000002",
                    "key": "bt_button",
                    "value": "yes",
                    "tag": "open_door_mode",
                    "update_time": "2026-01-24T02:41:01-06:00",
                    "create_time": "2024-06-30T13:03:49-05:00"
                  },
                  {

                    "device_id": "aabbcc000002",
                    "key": "bt_tap",
                    "value": "yes",
                    "tag": "open_door_mode",
                    "update_time": "2026-01-24T02:41:01-06:00",
                    "create_time": "2025-03-29T15:50:00-05:00"
                  },
                  {

                    "device_id": "aabbcc000002",
                    "key": "call_volume",
                    "value": "80",
                    "tag": "device_setting",
                    "update_time": "2025-01-28T13:52:43-06:00",
                    "create_time": "2025-01-28T07:52:43-06:00"
                  },
                  {

                    "device_id": "aabbcc000002",
                    "key": "capture_enable",
                    "value": "no",
                    "tag": "device_setting",
                    "update_time": "2025-01-28T15:24:16-06:00",
                    "create_time": "2025-01-28T09:24:16-06:00"
                  },
                  {

                    "device_id": "aabbcc000002",
                    "key": "capture_record_extra_after",
                    "value": "5",
                    "tag": "device_setting",
                    "update_time": "2024-06-30T18:03:49-05:00",
                    "create_time": "2024-06-30T13:03:49-05:00"
                  },
                  {

                    "device_id": "aabbcc000002",
                    "key": "capture_record_extra_before",
                    "value": "5",
                    "tag": "device_setting",
                    "update_time": "2024-06-30T18:03:49-05:00",
                    "create_time": "2024-06-30T13:03:49-05:00"
                  },
                  {

                    "device_id": "aabbcc000002",
                    "key": "capture_tof_enable",
                    "value": "yes",
                    "tag": "device_setting",
                    "update_time": "2026-07-12T11:26:33-05:00",
                    "create_time": "2026-07-12T11:26:33-05:00"
                  },
                  {

                    "device_id": "aabbcc000002",
                    "key": "cert_fingerprint",
                    "value": "0000000000000000000000000000000000000003",
                    "tag": "credential",
                    "update_time": "2024-06-30T18:03:49-05:00",
                    "create_time": "2024-06-30T13:03:49-05:00"
                  },
                  {

                    "device_id": "aabbcc000002",
                    "key": "disable_recording_default",
                    "value": "yes",
                    "tag": "device_setting",
                    "update_time": "2025-01-17T16:57:19-06:00",
                    "create_time": "2025-01-17T10:57:19-06:00"
                  },
                  {

                    "device_id": "aabbcc000002",
                    "key": "door_bell_trigger_interface",
                    "value": "swipe",
                    "tag": "device_setting",
                    "update_time": "2024-06-30T18:03:50-05:00",
                    "create_time": "2024-06-30T13:03:50-05:00"
                  },
                  {

                    "device_id": "aabbcc000002",
                    "key": "door_bell_trigger_type",
                    "value": "on",
                    "tag": "device_setting",
                    "update_time": "2026-07-12T11:26:33-05:00",
                    "create_time": "2026-07-12T11:26:33-05:00"
                  },
                  {

                    "device_id": "aabbcc000002",
                    "key": "door_entry_method",
                    "value": "in",
                    "tag": "door_entry_method",
                    "update_time": "2024-06-30T18:03:49-05:00",
                    "create_time": "2024-06-30T13:03:49-05:00"
                  },
                  {

                    "device_id": "aabbcc000002",
                    "key": "face",
                    "value": "yes",
                    "tag": "open_door_mode",
                    "update_time": "2026-01-24T03:15:58-06:00",
                    "create_time": "2025-09-13T11:19:58-05:00"
                  },
                  {

                    "device_id": "aabbcc000002",
                    "key": "face_anti_spoofing_level",
                    "value": "high",
                    "tag": "device_setting",
                    "update_time": "2026-01-24T03:15:54-06:00",
                    "create_time": "2025-09-13T11:19:58-05:00"
                  },
                  {

                    "device_id": "aabbcc000002",
                    "key": "face_detect_distance",
                    "value": "near",
                    "tag": "device_setting",
                    "update_time": "2026-01-24T03:15:54-06:00",
                    "create_time": "2025-09-13T11:30:00-05:00"
                  },
                  {

                    "device_id": "aabbcc000002",
                    "key": "greeting_broadcast_name",
                    "value": "first_name_only",
                    "tag": "device_setting",
                    "update_time": "2024-06-30T18:03:50-05:00",
                    "create_time": "2024-06-30T13:03:50-05:00"
                  },
                  {

                    "device_id": "aabbcc000002",
                    "key": "greeting_text",
                    "value": "welcome",
                    "tag": "device_setting",
                    "update_time": "2024-06-30T18:03:50-05:00",
                    "create_time": "2024-06-30T13:03:50-05:00"
                  },
                  {

                    "device_id": "aabbcc000002",
                    "key": "ibeacon_major",
                    "value": "0",
                    "tag": "device_setting",
                    "update_time": "2024-09-06T04:16:42-05:00",
                    "create_time": "2024-06-30T13:03:49-05:00"
                  },
                  {

                    "device_id": "aabbcc000002",
                    "key": "ibeacon_minor",
                    "value": "1",
                    "tag": "device_setting",
                    "update_time": "2024-09-06T04:16:42-05:00",
                    "create_time": "2024-06-30T13:03:49-05:00"
                  },
                  {

                    "device_id": "aabbcc000002",
                    "key": "ibeacon_uuid",
                    "value": "00000000-0000-0000-0000-000000000004",
                    "tag": "device_setting",
                    "update_time": "2024-09-06T04:16:42-05:00",
                    "create_time": "2024-06-30T13:03:49-05:00"
                  },
                  {

                    "device_id": "aabbcc000002",
                    "key": "mobile_unlock_ver2",
                    "value": "yes",
                    "tag": "device_setting",
                    "update_time": "2024-12-07T01:06:22-06:00",
                    "create_time": "2024-12-06T19:06:22-06:00"
                  },
                  {

                    "device_id": "aabbcc000002",
                    "key": "nacl_private_key",
                    "value": "REDACTED-00000006-xxxxxxxxxxxxxxxxxxxxxxxxxx",
                    "tag": "credential",
                    "update_time": "2026-02-10T15:44:17-06:00",
                    "create_time": "2026-02-10T09:44:17-06:00"
                  },
                  {

                    "device_id": "aabbcc000002",
                    "key": "nacl_public_key",
                    "value": "REDACTED-00000007-xxxxxxxxxxxxxxxxxxxxxxxxxx",
                    "tag": "credential",
                    "update_time": "2024-06-30T18:03:49-05:00",
                    "create_time": "2024-06-30T13:03:49-05:00"
                  },
                  {

                    "device_id": "aabbcc000002",
                    "key": "nfc",
                    "value": "yes",
                    "tag": "open_door_mode",
                    "update_time": "2026-01-24T03:15:48-06:00",
                    "create_time": "2024-06-30T13:03:49-05:00"
                  },
                  {

                    "device_id": "aabbcc000002",
                    "key": "pin_code",
                    "value": "REDACTED-00000008-",
                    "tag": "open_door_mode",
                    "update_time": "2025-11-10T01:14:50-06:00",
                    "create_time": "2024-06-30T13:03:49-05:00"
                  },
                  {

                    "device_id": "aabbcc000002",
                    "key": "pin_code_disable",
                    "value": "no",
                    "tag": "device_setting",
                    "update_time": "2024-06-30T18:07:02-05:00",
                    "create_time": "2024-06-30T13:07:02-05:00"
                  },
                  {

                    "device_id": "aabbcc000002",
                    "key": "pin_code_shuffle",
                    "value": "no",
                    "tag": "device_setting",
                    "update_time": "2024-06-30T18:03:50-05:00",
                    "create_time": "2024-06-30T13:03:50-05:00"
                  },
                  {

                    "device_id": "aabbcc000002",
                    "key": "preview",
                    "value": "REDACTED-00000009-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
                    "tag": "device_extra",
                    "update_time": "2026-08-13T01:33:08-05:00",
                    "create_time": "2024-06-30T13:03:51-05:00"
                  },
                  {

                    "device_id": "aabbcc000002",
                    "key": "qr_code",
                    "value": "yes",
                    "tag": "open_door_mode",
                    "update_time": "2025-11-09T20:37:39-06:00",
                    "create_time": "2025-01-28T07:52:44-06:00"
                  },
                  {

                    "device_id": "aabbcc000002",
                    "key": "show_auth_method",
                    "value": "yes",
                    "tag": "device_setting",
                    "update_time": "2026-07-12T11:26:33-05:00",
                    "create_time": "2026-07-12T11:26:33-05:00"
                  },
                  {

                    "device_id": "aabbcc000002",
                    "key": "show_entry_greet",
                    "value": "yes",
                    "tag": "device_setting",
                    "update_time": "2025-03-10T20:40:51-05:00",
                    "create_time": "2025-03-10T15:40:51-05:00"
                  },
                  {

                    "device_id": "aabbcc000002",
                    "key": "show_unlock_schedule",
                    "value": "yes",
                    "tag": "device_setting",
                    "update_time": "2025-03-10T20:41:01-05:00",
                    "create_time": "2025-03-10T15:41:01-05:00"
                  },
                  {

                    "device_id": "aabbcc000002",
                    "key": "ssh_password",
                    "value": "REDACTED-0000000a-xx",
                    "tag": "credential",
                    "update_time": "2026-08-01T00:00:00-05:00",
                    "create_time": "2024-06-30T13:03:49-05:00"
                  },
                  {

                    "device_id": "aabbcc000002",
                    "key": "ssh_user",
                    "value": "Test username 8",
                    "tag": "credential",
                    "update_time": "2024-06-30T18:03:49-05:00",
                    "create_time": "2024-06-30T13:03:49-05:00"
                  },
                  {

                    "device_id": "aabbcc000002",
                    "key": "status_led",
                    "value": "yes",
                    "tag": "device_setting",
                    "update_time": "2026-07-12T11:26:33-05:00",
                    "create_time": "2026-07-12T11:26:33-05:00"
                  },
                  {

                    "device_id": "aabbcc000002",
                    "key": "tof_distance",
                    "value": "2000",
                    "tag": "device_setting",
                    "update_time": "2024-06-30T18:03:50-05:00",
                    "create_time": "2024-06-30T13:03:50-05:00"
                  },
                  {

                    "device_id": "aabbcc000002",
                    "key": "volume",
                    "value": "36",
                    "tag": "device_setting",
                    "update_time": "2024-06-30T18:03:50-05:00",
                    "create_time": "2024-06-30T13:03:50-05:00"
                  },
                  {

                    "device_id": "aabbcc000002",
                    "key": "welcome_led",
                    "value": "yes",
                    "tag": "device_setting",
                    "update_time": "2026-07-12T11:26:33-05:00",
                    "create_time": "2026-07-12T11:26:33-05:00"
                  }
                ],
                "update": null,
                "update_manual": {

                  "device_version_upgrade_status": {

                    "completed": false,
                    "is_waiting": false,
                    "is_preparing": false,
                    "is_upgrading": false,
                    "upgrade_seconds": 0,
                    "timed_out": false,
                    "failed": false,
                    "failure_reason": "",
                    "is_downloading": false
                  },
                  "device_type": "",
                  "from_version": "",
                  "last_upgrade_start_time": null,
                  "last_upgrade_success": null,
                  "last_upgrade_failure_reason": "",
                  "last_download_start_time": null,
                  "last_download_success": null,
                  "last_download_failure_reason": "",
                  "downloaded": false
                },
                "capabilities": [
                  "pin_code",
                  "pin_code_length",
                  "change_setting",
                  "remote_view",
                  "remote_call",
                  "ssh_change",
                  "support_register_card",
                  "is_reader",
                  "identity_is_reader",
                  "identity_remote_view",
                  "support_reboot",
                  "support_greeting",
                  "support_greeting_message",
                  "support_salutation",
                  "keypad_layout",
                  "support_ui_account",
                  "support_webrtc",
                  "identity_support_webrtc",
                  "support_uid_webrtc",
                  "support_upgrade_by_url",
                  "support_record_extra",
                  "doorbell_timeout",
                  "doorbell_bind",
                  "post_capture",
                  "hold_to_call",
                  "support_face",
                  "identity_face_unlock",
                  "mobile_unlock_ver2",
                  "adopt_under_console",
                  "support_ems",
                  "identity_support_ems",
                  "anti_spoofing_level",
                  "show_face_method",
                  "support_faceme_sdk",
                  "support_twilio_sip",
                  "qr_code",
                  "support_record_hq_stream",
                  "report_audio_setting",
                  "support_interface_design",
                  "support_generic_resource_key",
                  "show_unlock_schedule",
                  "video_overlay",
                  "two_factor_auth",
                  "support_face_sensitivity",
                  "support_third_party_sip",
                  "nfc_card_easy_provision",
                  "mic_management",
                  "screen_off_timeout",
                  "support_sip_tls",
                  "identity_unlock_control_cmd",
                  "double_badge"
                ],
                "resource_name": "Test Name 19",
                "display_model": "UA G2 Pro",
                "revision": "1785876758583455467",
                "revision_update_time": 1785876788,
                "version_update_time": -62135596800,
                "firmware_update_time": -62135596800,
                "adopt_time": 1719770629,
                "extensions": [
                  {

                    "unique_id": "00000000-0000-0000-0000-00000000000a",
                    "device_id": "aabbcc000002",
                    "extension_name": "intercom_pair",
                    "target_type": "admin",
                    "target_config": [
                      {

                        "config_tag": "",
                        "config_key": "",
                        "config_value": "00000000-0000-0000-0000-00000000000b"
                      },
                      {

                        "config_tag": "",
                        "config_key": "",
                        "config_value": "00000000-0000-0000-0000-00000000000c"
                      }
                    ]
                  }
                ],
                "model": "UA G2 Pro",
                "images": {

                  "xs": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006a_25x25.png",
                  "s": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006a_32x32.png",
                  "m": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006a_51x51.png",
                  "l": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006a_64x64.png",
                  "xl": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006a_101x101.png",
                  "xxl": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006a_128x128.png",
                  "base": "icons/00000000-0000-0000-0000-00000000006a_257x257.png",
                  "animation": [
                    "icons/g2-pro-black-close.png",
                    "icons/g2-pro-black-open.png"
                  ]
                },
                "camera_setting": {

                  "cameraId": "000000000000000000000002",
                  "recordingSettings": {

                    "mode": "never",
                    "prePaddingSecs": 5,
                    "postPaddingSecs": 5,
                    "smartDetectPrePaddingSecs": 2,
                    "smartDetectPostPaddingSecs": 2,
                    "minMotionEventTrigger": 1000,
                    "endMotionEventDelay": 3000,
                    "suppressIlluminationSurge": false,
                    "inScheduleMode": "always",
                    "outScheduleMode": "never",
                    "geofencing": "off",
                    "motionAlgorithm": "enhanced",
                    "enableMotionDetection": false,
                    "createAccessEvent": true,
                    "useNewMotionAlgorithm": true
                  },
                  "osdSettings": {

                    "isNameEnabled": false,
                    "isDateEnabled": false,
                    "isLogoEnabled": false,
                    "isDebugEnabled": false
                  },
                  "micVolume": 100,
                  "isMicEnabled": true
                },
                "template": null
              },
              {

                "unique_id": "aabbcc000003",
                "name": "Test Name 20",
                "alias": "",
                "device_type": "UA-G2-MINI",
                "connected_uah_id": "aabbcc000001",
                "location_id": "00000000-0000-0000-0000-000000000006",
                "firmware": "v3.18.21.0",
                "version": null,
                "ip": "192.0.2.4",
                "mac": "AA:BB:CC:00:00:03",
                "hw_type": "GA",
                "start_time": 1783874602,
                "last_seen": 1786606285,
                "security_check": false,
                "source": null,
                "bom_rev": "",
                "guid": "00000000-0000-0000-0000-00000000000d",
                "need_advisory": false,
                "is_camera": false,
                "is_adopted": true,
                "is_managed": true,
                "is_connected": true,
                "is_online": true,
                "is_rebooting": false,
                "is_unavailable": false,
                "is_upgrade_blocked": false,
                "is_export_sf_blocked": false,
                "adopting": false,
                "location": {

                  "unique_id": "00000000-0000-0000-0000-000000000006",
                  "name": "Test Name 10",
                  "up_id": "00000000-0000-0000-0000-000000000001",
                  "timezone": "",
                  "location_type": "door",
                  "extra_type": "",
                  "full_name": "Test Name 11",
                  "level": 0,
                  "work_time": "[]",
                  "work_time_id": "",
                  "extras": {

                    "door_thumbnail": "REDACTED-00000001-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
                    "door_thumbnail_last_update": 1786602788,
                    "uah-input_state_dps": "off",
                    "uah-wiring_state_dps-neg": "off",
                    "uah-wiring_state_dps-pos": "off"
                  },
                  "previous_name": []
                },
                "door": {

                  "unique_id": "00000000-0000-0000-0000-000000000006",
                  "name": "Test Name 10",
                  "up_id": "00000000-0000-0000-0000-000000000001",
                  "timezone": "",
                  "location_type": "door",
                  "extra_type": "",
                  "full_name": "Test Name 11",
                  "level": 0,
                  "work_time": "[]",
                  "work_time_id": "",
                  "extras": {

                    "door_thumbnail": "REDACTED-00000001-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
                    "door_thumbnail_last_update": 1786602788,
                    "uah-input_state_dps": "off",
                    "uah-wiring_state_dps-neg": "off",
                    "uah-wiring_state_dps-pos": "off"
                  },
                  "previous_name": []
                },
                "floor": {

                  "unique_id": "00000000-0000-0000-0000-000000000001",
                  "name": "Test Name 2",
                  "up_id": "00000000-0000-0000-0000-000000000000",
                  "timezone": "",
                  "location_type": "floor",
                  "extra_type": "",
                  "full_name": "Test Name 3",
                  "level": 1,
                  "work_time": "[]",
                  "work_time_id": "",
                  "extras": {},
                  "previous_name": []
                },
                "configs": [
                  {

                    "device_id": "aabbcc000003",
                    "key": "alias",
                    "value": "",
                    "tag": "device_extra",
                    "update_time": "2025-11-10T01:48:18-06:00",
                    "create_time": "2025-11-09T19:48:18-06:00"
                  },
                  {

                    "device_id": "aabbcc000003",
                    "key": "apple_pass",
                    "value": "no",
                    "tag": "open_door_mode",
                    "update_time": "2025-11-10T01:48:18-06:00",
                    "create_time": "2025-11-09T19:48:18-06:00"
                  },
                  {

                    "device_id": "aabbcc000003",
                    "key": "bt",
                    "value": "yes",
                    "tag": "open_door_mode",
                    "update_time": "2025-11-10T01:48:19-06:00",
                    "create_time": "2025-11-09T19:48:19-06:00"
                  },
                  {

                    "device_id": "aabbcc000003",
                    "key": "bt_button",
                    "value": "yes",
                    "tag": "open_door_mode",
                    "update_time": "2025-11-10T01:55:05-06:00",
                    "create_time": "2025-11-09T19:48:19-06:00"
                  },
                  {

                    "device_id": "aabbcc000003",
                    "key": "bt_tap",
                    "value": "yes",
                    "tag": "open_door_mode",
                    "update_time": "2025-11-10T01:55:18-06:00",
                    "create_time": "2025-11-09T19:48:19-06:00"
                  },
                  {

                    "device_id": "aabbcc000003",
                    "key": "cert_fingerprint",
                    "value": "0000000000000000000000000000000000000004",
                    "tag": "credential",
                    "update_time": "2025-11-10T01:48:18-06:00",
                    "create_time": "2025-11-09T19:48:18-06:00"
                  },
                  {

                    "device_id": "aabbcc000003",
                    "key": "door_entry_method",
                    "value": "out",
                    "tag": "door_entry_method",
                    "update_time": "2025-11-10T01:48:18-06:00",
                    "create_time": "2025-11-09T19:48:18-06:00"
                  },
                  {

                    "device_id": "aabbcc000003",
                    "key": "greeting_broadcast_name",
                    "value": "none",
                    "tag": "device_setting",
                    "update_time": "2025-11-10T01:48:18-06:00",
                    "create_time": "2025-11-09T19:48:18-06:00"
                  },
                  {

                    "device_id": "aabbcc000003",
                    "key": "greeting_text",
                    "value": "see_you",
                    "tag": "device_setting",
                    "update_time": "2025-11-10T01:48:18-06:00",
                    "create_time": "2025-11-09T19:48:18-06:00"
                  },
                  {

                    "device_id": "aabbcc000003",
                    "key": "ibeacon_major",
                    "value": "0",
                    "tag": "device_setting",
                    "update_time": "2025-11-10T01:48:19-06:00",
                    "create_time": "2025-11-09T19:48:19-06:00"
                  },
                  {

                    "device_id": "aabbcc000003",
                    "key": "ibeacon_minor",
                    "value": "1",
                    "tag": "device_setting",
                    "update_time": "2025-11-10T01:48:19-06:00",
                    "create_time": "2025-11-09T19:48:19-06:00"
                  },
                  {

                    "device_id": "aabbcc000003",
                    "key": "ibeacon_uuid",
                    "value": "00000000-0000-0000-0000-000000000004",
                    "tag": "device_setting",
                    "update_time": "2025-11-10T01:48:19-06:00",
                    "create_time": "2025-11-09T19:48:19-06:00"
                  },
                  {

                    "device_id": "aabbcc000003",
                    "key": "mobile_unlock_ver2",
                    "value": "yes",
                    "tag": "device_setting",
                    "update_time": "2025-11-10T01:48:19-06:00",
                    "create_time": "2025-11-09T19:48:19-06:00"
                  },
                  {

                    "device_id": "aabbcc000003",
                    "key": "nacl_private_key",
                    "value": "REDACTED-0000000b-xxxxxxxxxxxxxxxxxxxxxxxxxx",
                    "tag": "credential",
                    "update_time": "2026-03-10T13:25:43-05:00",
                    "create_time": "2026-03-10T08:25:43-05:00"
                  },
                  {

                    "device_id": "aabbcc000003",
                    "key": "nacl_public_key",
                    "value": "REDACTED-0000000c-xxxxxxxxxxxxxxxxxxxxxxxxxx",
                    "tag": "credential",
                    "update_time": "2025-11-10T01:48:19-06:00",
                    "create_time": "2025-11-09T19:48:19-06:00"
                  },
                  {

                    "device_id": "aabbcc000003",
                    "key": "nfc",
                    "value": "yes",
                    "tag": "open_door_mode",
                    "update_time": "2025-11-10T01:54:17-06:00",
                    "create_time": "2025-11-09T19:48:18-06:00"
                  },
                  {

                    "device_id": "aabbcc000003",
                    "key": "ps_sensitivity",
                    "value": "0",
                    "tag": "device_setting",
                    "update_time": "2025-11-10T01:48:18-06:00",
                    "create_time": "2025-11-09T19:48:18-06:00"
                  },
                  {

                    "device_id": "aabbcc000003",
                    "key": "show_entry_greet",
                    "value": "yes",
                    "tag": "device_setting",
                    "update_time": "2025-11-10T01:48:18-06:00",
                    "create_time": "2025-11-09T19:48:18-06:00"
                  },
                  {

                    "device_id": "aabbcc000003",
                    "key": "ssh_password",
                    "value": "REDACTED-0000000d-xx",
                    "tag": "credential",
                    "update_time": "2026-08-01T00:00:05-05:00",
                    "create_time": "2025-11-09T19:48:18-06:00"
                  },
                  {

                    "device_id": "aabbcc000003",
                    "key": "ssh_user",
                    "value": "Test username 8",
                    "tag": "credential",
                    "update_time": "2025-11-10T01:48:18-06:00",
                    "create_time": "2025-11-09T19:48:18-06:00"
                  },
                  {

                    "device_id": "aabbcc000003",
                    "key": "volume",
                    "value": "yes",
                    "tag": "device_setting",
                    "update_time": "2025-11-10T01:48:18-06:00",
                    "create_time": "2025-11-09T19:48:18-06:00"
                  },
                  {

                    "device_id": "aabbcc000003",
                    "key": "wave",
                    "value": "yes",
                    "tag": "open_door_mode",
                    "update_time": "2025-11-10T01:52:58-06:00",
                    "create_time": "2025-11-09T19:48:18-06:00"
                  }
                ],
                "update": null,
                "update_manual": {

                  "device_version_upgrade_status": {

                    "completed": false,
                    "is_waiting": false,
                    "is_preparing": false,
                    "is_upgrading": false,
                    "upgrade_seconds": 0,
                    "timed_out": false,
                    "failed": false,
                    "failure_reason": "",
                    "is_downloading": false
                  },
                  "device_type": "",
                  "from_version": "",
                  "last_upgrade_start_time": null,
                  "last_upgrade_success": null,
                  "last_upgrade_failure_reason": "",
                  "last_download_start_time": null,
                  "last_download_success": null,
                  "last_download_failure_reason": "",
                  "downloaded": false
                },
                "capabilities": [
                  "ssh_change",
                  "support_register_card",
                  "is_reader",
                  "identity_is_reader",
                  "adopt_under_console",
                  "support_upgrade_by_url",
                  "support_greeting",
                  "hand_wave",
                  "support_ui_account",
                  "sensitivity",
                  "mobile_unlock_ver2",
                  "support_reboot",
                  "nfc_card_easy_provision",
                  "incremental_update_setting",
                  "identity_unlock_control_cmd"
                ],
                "resource_name": "Test Name 21",
                "display_model": "UA G2",
                "revision": "1785876758583455467",
                "revision_update_time": 1785876788,
                "version_update_time": -62135596800,
                "firmware_update_time": -62135596800,
                "adopt_time": 1762739298,
                "model": "UA G2 Black",
                "images": {

                  "xs": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-000000000069_25x25.png",
                  "s": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-000000000069_32x32.png",
                  "m": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-000000000069_51x51.png",
                  "l": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-000000000069_64x64.png",
                  "xl": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-000000000069_101x101.png",
                  "xxl": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-000000000069_128x128.png",
                  "base": "icons/00000000-0000-0000-0000-000000000069_257x257.png",
                  "animation": [
                    "icons/g2-mini-black-close.png",
                    "icons/g2-mini-black-open.png"
                  ]
                },
                "template": null
              }
            ]
          ],
          "hotel_devices": [],
          "door_guard": [],
          "camera_resource_ids": []
        },
        {

          "unique_id": "00000000-0000-0000-0000-00000000000e",
          "name": "Test Name 22",
          "up_id": "00000000-0000-0000-0000-000000000001",
          "timezone": "",
          "location_type": "door",
          "extra_type": "",
          "full_name": "Test Name 23",
          "level": 0,
          "work_time": "[]",
          "work_time_id": "",
          "extras": {},
          "previous_name": [],
          "device_groups": [
            [
              {

                "unique_id": "aabbcc000004",
                "name": "Test Name 24",
                "alias": "Test alias 25",
                "device_type": "UA-Hub-Door-Mini",
                "connected_uah_id": "aabbcc000004",
                "location_id": "00000000-0000-0000-0000-00000000000e",
                "firmware": "v1.3.4.0",
                "version": null,
                "ip": "192.0.2.5",
                "mac": "aa:bb:cc:00:00:04",
                "hw_type": "GA",
                "start_time": 1757780067,
                "last_seen": 1764008026,
                "security_check": true,
                "source": null,
                "bom_rev": "",
                "guid": "00000000-0000-0000-0000-00000000000f",
                "need_advisory": false,
                "is_camera": false,
                "is_adopted": false,
                "is_managed": true,
                "is_connected": false,
                "is_online": false,
                "is_rebooting": false,
                "is_unavailable": false,
                "is_upgrade_blocked": false,
                "is_export_sf_blocked": false,
                "adopting": false,
                "location": {

                  "unique_id": "00000000-0000-0000-0000-00000000000e",
                  "name": "Test Name 22",
                  "up_id": "00000000-0000-0000-0000-000000000001",
                  "timezone": "",
                  "location_type": "door",
                  "extra_type": "",
                  "full_name": "Test Name 23",
                  "level": 0,
                  "work_time": "[]",
                  "work_time_id": "",
                  "extras": {},
                  "previous_name": []
                },
                "door": {

                  "unique_id": "00000000-0000-0000-0000-00000000000e",
                  "name": "Test Name 22",
                  "up_id": "00000000-0000-0000-0000-000000000001",
                  "timezone": "",
                  "location_type": "door",
                  "extra_type": "",
                  "full_name": "Test Name 23",
                  "level": 0,
                  "work_time": "[]",
                  "work_time_id": "",
                  "extras": {},
                  "previous_name": []
                },
                "floor": {

                  "unique_id": "00000000-0000-0000-0000-000000000001",
                  "name": "Test Name 2",
                  "up_id": "00000000-0000-0000-0000-000000000000",
                  "timezone": "",
                  "location_type": "floor",
                  "extra_type": "",
                  "full_name": "Test Name 3",
                  "level": 1,
                  "work_time": "[]",
                  "work_time_id": "",
                  "extras": {},
                  "previous_name": []
                },
                "configs": [
                  {

                    "device_id": "aabbcc000004",
                    "key": "alias",
                    "value": "Test alias 25",
                    "tag": "device_extra",
                    "update_time": "2025-06-14T11:36:56-05:00",
                    "create_time": "2025-05-26T09:45:39-05:00"
                  },
                  {

                    "device_id": "aabbcc000004",
                    "key": "cert_fingerprint",
                    "value": "0000000000000000000000000000000000000005",
                    "tag": "credential",
                    "update_time": "2025-05-26T14:45:39-05:00",
                    "create_time": "2025-05-26T09:45:39-05:00"
                  },
                  {

                    "device_id": "aabbcc000004",
                    "key": "input_d1_button",
                    "value": "off",
                    "tag": "hub_action",
                    "update_time": "2025-05-26T16:03:54-05:00",
                    "create_time": "2025-05-26T11:03:54-05:00"
                  },
                  {

                    "device_id": "aabbcc000004",
                    "key": "input_d1_dps",
                    "value": "off",
                    "tag": "hub_action",
                    "update_time": "2025-05-26T21:13:54-05:00",
                    "create_time": "2025-05-26T11:03:54-05:00"
                  },
                  {

                    "device_id": "aabbcc000004",
                    "key": "nacl_public_key",
                    "value": "REDACTED-0000000e-xxxxxxxxxxxxxxxxxxxxxxxxxx",
                    "tag": "credential",
                    "update_time": "2025-05-26T14:45:40-05:00",
                    "create_time": "2025-05-26T09:45:40-05:00"
                  },
                  {

                    "device_id": "aabbcc000004",
                    "key": "output_d1_lock_relay",
                    "value": "off",
                    "tag": "hub_action",
                    "update_time": "2025-05-26T16:03:54-05:00",
                    "create_time": "2025-05-26T11:03:54-05:00"
                  },
                  {

                    "device_id": "aabbcc000004",
                    "key": "poe-type",
                    "value": "802.3at",
                    "tag": "device_extra",
                    "update_time": "2025-05-26T14:45:42-05:00",
                    "create_time": "2025-05-26T09:45:42-05:00"
                  },
                  {

                    "device_id": "aabbcc000004",
                    "key": "power_budget_mw",
                    "value": "22000",
                    "tag": "hub_power",
                    "update_time": "2025-08-08T22:55:26-05:00",
                    "create_time": "2025-08-08T17:55:26-05:00"
                  },
                  {

                    "device_id": "aabbcc000004",
                    "key": "power_d1_ma",
                    "value": "0",
                    "tag": "hub_power",
                    "update_time": "2025-08-08T22:55:26-05:00",
                    "create_time": "2025-08-08T17:55:26-05:00"
                  },
                  {

                    "device_id": "aabbcc000004",
                    "key": "power_d1_mv",
                    "value": "0",
                    "tag": "hub_power",
                    "update_time": "2025-11-07T14:05:03-06:00",
                    "create_time": "2025-08-08T17:55:26-05:00"
                  },
                  {

                    "device_id": "aabbcc000004",
                    "key": "power_d1_mw",
                    "value": "0",
                    "tag": "hub_power",
                    "update_time": "2025-08-08T22:55:26-05:00",
                    "create_time": "2025-08-08T17:55:26-05:00"
                  },
                  {

                    "device_id": "aabbcc000004",
                    "key": "power_d1_ocp",
                    "value": "false",
                    "tag": "hub_power",
                    "update_time": "2025-08-08T22:55:26-05:00",
                    "create_time": "2025-08-08T17:55:26-05:00"
                  },
                  {

                    "device_id": "aabbcc000004",
                    "key": "power_free_budget_mw",
                    "value": "19805",
                    "tag": "hub_power",
                    "update_time": "2025-11-24T18:07:15-06:00",
                    "create_time": "2025-08-08T17:55:26-05:00"
                  },
                  {

                    "device_id": "aabbcc000004",
                    "key": "power_poe_p1_mw",
                    "value": "0",
                    "tag": "hub_power",
                    "update_time": "2025-08-08T22:55:26-05:00",
                    "create_time": "2025-08-08T17:55:26-05:00"
                  },
                  {

                    "device_id": "aabbcc000004",
                    "key": "power_poe_p2_mw",
                    "value": "2195",
                    "tag": "hub_power",
                    "update_time": "2025-11-24T18:07:15-06:00",
                    "create_time": "2025-08-08T17:55:26-05:00"
                  },
                  {

                    "device_id": "aabbcc000004",
                    "key": "power_total_used_12v_mw",
                    "value": "0",
                    "tag": "hub_power",
                    "update_time": "2025-08-08T22:55:26-05:00",
                    "create_time": "2025-08-08T17:55:26-05:00"
                  },
                  {

                    "device_id": "aabbcc000004",
                    "key": "power_total_used_poe_mw",
                    "value": "2195",
                    "tag": "hub_power",
                    "update_time": "2025-11-24T18:07:15-06:00",
                    "create_time": "2025-08-08T17:55:26-05:00"
                  },
                  {

                    "device_id": "aabbcc000004",
                    "key": "ssh_password",
                    "value": "REDACTED-0000000f-xx",
                    "tag": "credential",
                    "update_time": "2025-11-01T05:00:06-05:00",
                    "create_time": "2025-05-26T09:45:39-05:00"
                  },
                  {

                    "device_id": "aabbcc000004",
                    "key": "ssh_user",
                    "value": "Test username 8",
                    "tag": "credential",
                    "update_time": "2025-05-26T14:45:39-05:00",
                    "create_time": "2025-05-26T09:45:39-05:00"
                  },
                  {

                    "device_id": "aabbcc000004",
                    "key": "wiring_state_bitmap",
                    "value": "3328",
                    "tag": "wiring_state",
                    "update_time": "2025-09-13T16:14:05-05:00",
                    "create_time": "2025-05-26T09:45:42-05:00"
                  },
                  {

                    "device_id": "aabbcc000004",
                    "key": "wiring_state_d1-button-neg",
                    "value": "off",
                    "tag": "wiring_state",
                    "update_time": "2025-05-26T14:48:54-05:00",
                    "create_time": "2025-05-26T09:48:54-05:00"
                  },
                  {

                    "device_id": "aabbcc000004",
                    "key": "wiring_state_d1-button-pos",
                    "value": "off",
                    "tag": "wiring_state",
                    "update_time": "2025-06-15T21:19:02-05:00",
                    "create_time": "2025-05-26T09:48:54-05:00"
                  },
                  {

                    "device_id": "aabbcc000004",
                    "key": "wiring_state_d1-dps-neg",
                    "value": "off",
                    "tag": "wiring_state",
                    "update_time": "2025-05-28T02:33:32-05:00",
                    "create_time": "2025-05-26T09:48:54-05:00"
                  },
                  {

                    "device_id": "aabbcc000004",
                    "key": "wiring_state_d1-dps-pos",
                    "value": "off",
                    "tag": "wiring_state",
                    "update_time": "2025-05-30T22:43:51-05:00",
                    "create_time": "2025-05-26T09:48:54-05:00"
                  },
                  {

                    "device_id": "aabbcc000004",
                    "key": "wiring_state_d1-lock-com",
                    "value": "off",
                    "tag": "wiring_state",
                    "update_time": "2025-05-26T14:48:54-05:00",
                    "create_time": "2025-05-26T09:48:54-05:00"
                  },
                  {

                    "device_id": "aabbcc000004",
                    "key": "wiring_state_d1-lock-nc",
                    "value": "off",
                    "tag": "wiring_state",
                    "update_time": "2025-05-26T14:48:54-05:00",
                    "create_time": "2025-05-26T09:48:54-05:00"
                  },
                  {

                    "device_id": "aabbcc000004",
                    "key": "wiring_state_d1-lock-no",
                    "value": "off",
                    "tag": "wiring_state",
                    "update_time": "2025-05-26T14:48:54-05:00",
                    "create_time": "2025-05-26T09:48:54-05:00"
                  },
                  {

                    "device_id": "aabbcc000004",
                    "key": "wiring_state_d1-power-sw",
                    "value": "off",
                    "tag": "wiring_state",
                    "update_time": "2025-05-26T14:48:54-05:00",
                    "create_time": "2025-05-26T09:48:54-05:00"
                  },
                  {

                    "device_id": "aabbcc000004",
                    "key": "wiring_state_poe-p0",
                    "value": "on",
                    "tag": "wiring_state",
                    "update_time": "2025-05-26T14:48:54-05:00",
                    "create_time": "2025-05-26T09:48:54-05:00"
                  },
                  {

                    "device_id": "aabbcc000004",
                    "key": "wiring_state_poe-p1",
                    "value": "off",
                    "tag": "wiring_state",
                    "update_time": "2025-07-04T22:37:54-05:00",
                    "create_time": "2025-05-26T09:48:54-05:00"
                  },
                  {

                    "device_id": "aabbcc000004",
                    "key": "wiring_state_poe-p2",
                    "value": "on",
                    "tag": "wiring_state",
                    "update_time": "2025-09-12T15:58:33-05:00",
                    "create_time": "2025-05-26T09:48:54-05:00"
                  }
                ],
                "update": null,
                "update_manual": {

                  "device_version_upgrade_status": {

                    "completed": false,
                    "is_waiting": false,
                    "is_preparing": false,
                    "is_upgrading": false,
                    "upgrade_seconds": 0,
                    "timed_out": false,
                    "failed": false,
                    "failure_reason": "",
                    "is_downloading": false
                  },
                  "device_type": "",
                  "from_version": "",
                  "last_upgrade_start_time": null,
                  "last_upgrade_success": null,
                  "last_upgrade_failure_reason": "",
                  "last_download_start_time": null,
                  "last_download_success": null,
                  "last_download_failure_reason": "",
                  "downloaded": false
                },
                "capabilities": [
                  "ssh_change",
                  "support_ui_account",
                  "is_hub",
                  "identity_is_hub",
                  "incremental_update_setting",
                  "pin_code",
                  "support_reboot",
                  "first_person_in",
                  "unlock_schedule",
                  "mobile_unlock_ver2",
                  "dps_trigger_level",
                  "unlock_time_period_v2",
                  "report_viewer_id",
                  "nfc_card_easy_provision",
                  "two_factor_auth",
                  "power_state"
                ],
                "resource_name": "Test Name 26",
                "display_model": "UA Hub Door Mini",
                "revision": "1764007943753538037",
                "revision_update_time": 1764007966,
                "version_update_time": -62135596800,
                "firmware_update_time": -62135596800,
                "adopt_time": 1748270739,
                "extensions": [
                  {

                    "unique_id": "00000000-0000-0000-0000-000000000010",
                    "device_id": "aabbcc000004",
                    "extension_name": "port_setting",
                    "source_id": "port1",
                    "target_type": "door",
                    "target_value": "00000000-0000-0000-0000-00000000000e",
                    "target_name": "Test Name 22",
                    "target_config": [
                      {

                        "config_tag": "device_setting",
                        "config_key": "lock_unlock_time",
                        "config_value": 5
                      },
                      {

                        "config_tag": "device_setting",
                        "config_key": "button_reverse",
                        "config_value": false
                      },
                      {

                        "config_tag": "device_setting",
                        "config_key": "is_relay_nc",
                        "config_value": false
                      },
                      {

                        "config_tag": "device_setting",
                        "config_key": "dps_reverse",
                        "config_value": false
                      }
                    ]
                  }
                ],
                "model": "UA Hub Door Mini",
                "images": {

                  "xs": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006c_25x25.png",
                  "s": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006c_32x32.png",
                  "m": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006c_51x51.png",
                  "l": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006c_64x64.png",
                  "xl": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006c_101x101.png",
                  "xxl": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006c_128x128.png",
                  "base": "icons/00000000-0000-0000-0000-00000000006c_257x257.png"
                },
                "template": null
              }
            ]
          ],
          "hotel_devices": [],
          "door_guard": [],
          "camera_resource_ids": []
        }
      ]
    }
  ]
};

// Captured from a live controller, 2024. Nine doors on one floor and six devices, one of which the building hosts directly through the root's device_groups.
export const accessBootstrapEahFixture: AccessBootstrapConfig = {

  "unique_id": "00000000-0000-0000-0000-000000000011",
  "name": "Test Name 27",
  "up_id": "",
  "timezone": "",
  "location_type": "building",
  "extra_type": "",
  "full_name": "Test Name 27",
  "level": 0,
  "work_time": "[]",
  "work_time_id": "",
  "extras": {

    "door_thumbnails": [
      {

        "door_cover": null,
        "door_thumbnail": "",
        "door_thumbnail_last_update": 0,
        "hub_id": "aabbcc000005"
      }
    ]
  },
  "floors": [
    {

      "unique_id": "00000000-0000-0000-0000-000000000012",
      "name": "Test Name 2",
      "up_id": "00000000-0000-0000-0000-000000000011",
      "timezone": "",
      "location_type": "floor",
      "extra_type": "",
      "full_name": "Test Name 28",
      "level": 1,
      "work_time": "[]",
      "work_time_id": "",
      "extras": {},
      "doors": [
        {

          "unique_id": "00000000-0000-0000-0000-000000000013",
          "name": "Test Name 29",
          "up_id": "00000000-0000-0000-0000-000000000012",
          "timezone": "",
          "location_type": "door",
          "extra_type": "",
          "full_name": "Test Name 30",
          "level": 0,
          "work_time": "[]",
          "work_time_id": "",
          "extras": {

            "door_thumbnail": "",
            "door_thumbnail_last_update": 0
          },
          "device_groups": [],
          "hotel_devices": [],
          "door_guard": [],
          "camera_resource_ids": []
        },
        {

          "unique_id": "00000000-0000-0000-0000-000000000014",
          "name": "Test Name 31",
          "up_id": "00000000-0000-0000-0000-000000000012",
          "timezone": "",
          "location_type": "door",
          "extra_type": "",
          "full_name": "Test Name 32",
          "level": 0,
          "work_time": "[]",
          "work_time_id": "",
          "extras": {

            "door_thumbnail": "",
            "door_thumbnail_last_update": 0
          },
          "device_groups": [],
          "hotel_devices": [],
          "door_guard": [],
          "camera_resource_ids": []
        },
        {

          "unique_id": "00000000-0000-0000-0000-000000000015",
          "name": "Test Name 33",
          "up_id": "00000000-0000-0000-0000-000000000012",
          "timezone": "",
          "location_type": "door",
          "extra_type": "",
          "full_name": "Test Name 34",
          "level": 0,
          "work_time": "[]",
          "work_time_id": "",
          "extras": {},
          "device_groups": [],
          "hotel_devices": [],
          "door_guard": [],
          "camera_resource_ids": []
        },
        {

          "unique_id": "00000000-0000-0000-0000-000000000016",
          "name": "Test Name 35",
          "up_id": "00000000-0000-0000-0000-000000000012",
          "timezone": "",
          "location_type": "door",
          "extra_type": "",
          "full_name": "Test Name 36",
          "level": 0,
          "work_time": "[]",
          "work_time_id": "",
          "extras": {},
          "device_groups": [],
          "hotel_devices": [],
          "door_guard": [],
          "camera_resource_ids": []
        },
        {

          "unique_id": "00000000-0000-0000-0000-000000000017",
          "name": "Test Name 37",
          "up_id": "00000000-0000-0000-0000-000000000012",
          "timezone": "",
          "location_type": "door",
          "extra_type": "",
          "full_name": "Test Name 38",
          "level": 0,
          "work_time": "[]",
          "work_time_id": "",
          "extras": {

            "door_thumbnail": "REDACTED-00000010-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
            "door_thumbnail_last_update": 1727912739
          },
          "device_groups": [
            [
              {

                "unique_id": "aabbcc000006",
                "name": "Test Name 39",
                "alias": "",
                "device_type": "UA-G2-PRO",
                "connected_uah_id": "aabbcc000005",
                "location_id": "00000000-0000-0000-0000-000000000017",
                "firmware": "v1.6.28",
                "version": null,
                "ip": "192.0.2.6",
                "mac": "aa:bb:cc:00:00:06",
                "hw_type": "GA",
                "start_time": 1727482903,
                "security_check": true,
                "source": null,
                "bom_rev": "",
                "guid": "00000000-0000-0000-0000-000000000009",
                "need_advisory": false,
                "is_adopted": true,
                "is_managed": true,
                "is_connected": true,
                "is_online": true,
                "adopting": false,
                "location": {

                  "unique_id": "00000000-0000-0000-0000-000000000017",
                  "name": "Test Name 37",
                  "up_id": "00000000-0000-0000-0000-000000000012",
                  "timezone": "",
                  "location_type": "door",
                  "extra_type": "",
                  "full_name": "Test Name 38",
                  "level": 0,
                  "work_time": "[]",
                  "work_time_id": "",
                  "extras": {

                    "door_thumbnail": "REDACTED-00000010-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
                    "door_thumbnail_last_update": 1727912739
                  }
                },
                "door": {

                  "unique_id": "00000000-0000-0000-0000-000000000017",
                  "name": "Test Name 37",
                  "up_id": "00000000-0000-0000-0000-000000000012",
                  "timezone": "",
                  "location_type": "door",
                  "extra_type": "",
                  "full_name": "Test Name 38",
                  "level": 0,
                  "work_time": "[]",
                  "work_time_id": "",
                  "extras": {

                    "door_thumbnail": "REDACTED-00000010-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
                    "door_thumbnail_last_update": 1727912739
                  }
                },
                "floor": {

                  "unique_id": "00000000-0000-0000-0000-000000000012",
                  "name": "Test Name 2",
                  "up_id": "00000000-0000-0000-0000-000000000011",
                  "timezone": "",
                  "location_type": "floor",
                  "extra_type": "",
                  "full_name": "Test Name 28",
                  "level": 1,
                  "work_time": "[]",
                  "work_time_id": "",
                  "extras": {}
                },
                "configs": [
                  {

                    "device_id": "aabbcc000006",
                    "key": "alias",
                    "value": "",
                    "tag": "device_extra"
                  },
                  {

                    "device_id": "aabbcc000006",
                    "key": "brightness",
                    "value": "100",
                    "tag": "device_setting"
                  },
                  {

                    "device_id": "aabbcc000006",
                    "key": "bt",
                    "value": "yes",
                    "tag": "open_door_mode"
                  },
                  {

                    "device_id": "aabbcc000006",
                    "key": "bt_button",
                    "value": "yes",
                    "tag": "open_door_mode"
                  },
                  {

                    "device_id": "aabbcc000006",
                    "key": "bt_tap",
                    "value": "yes",
                    "tag": "open_door_mode"
                  },
                  {

                    "device_id": "aabbcc000006",
                    "key": "capture_record_extra_before",
                    "value": "5",
                    "tag": "device_setting"
                  },
                  {

                    "device_id": "aabbcc000006",
                    "key": "cert_fingerprint",
                    "value": "0000000000000000000000000000000000000006",
                    "tag": "credential"
                  },
                  {

                    "device_id": "aabbcc000006",
                    "key": "door_bell_trigger_interface",
                    "value": "swipe",
                    "tag": "device_setting"
                  },
                  {

                    "device_id": "aabbcc000006",
                    "key": "door_bell_trigger_type",
                    "value": "tap",
                    "tag": "device_setting"
                  },
                  {

                    "device_id": "aabbcc000006",
                    "key": "door_entry_method",
                    "value": "in",
                    "tag": "door_entry_method"
                  },
                  {

                    "device_id": "aabbcc000006",
                    "key": "greeting_broadcast_name",
                    "value": "first_name_only",
                    "tag": "device_setting"
                  },
                  {

                    "device_id": "aabbcc000006",
                    "key": "greeting_text",
                    "value": "welcome",
                    "tag": "device_setting"
                  },
                  {

                    "device_id": "aabbcc000006",
                    "key": "ibeacon_major",
                    "value": "0",
                    "tag": "device_setting"
                  },
                  {

                    "device_id": "aabbcc000006",
                    "key": "ibeacon_minor",
                    "value": "7",
                    "tag": "device_setting"
                  },
                  {

                    "device_id": "aabbcc000006",
                    "key": "ibeacon_uuid",
                    "value": "00000000-0000-0000-0000-000000000018",
                    "tag": "device_setting"
                  },
                  {

                    "device_id": "aabbcc000006",
                    "key": "nacl_public_key",
                    "value": "REDACTED-00000011-xxxxxxxxxxxxxxxxxxxxxxxxxx",
                    "tag": "credential"
                  },
                  {

                    "device_id": "aabbcc000006",
                    "key": "nfc",
                    "value": "yes",
                    "tag": "open_door_mode"
                  },
                  {

                    "device_id": "aabbcc000006",
                    "key": "pin_code",
                    "value": "REDACTED-00000012-",
                    "tag": "open_door_mode"
                  },
                  {

                    "device_id": "aabbcc000006",
                    "key": "pin_code_disable",
                    "value": "no",
                    "tag": "device_setting"
                  },
                  {

                    "device_id": "aabbcc000006",
                    "key": "pin_code_shuffle",
                    "value": "yes",
                    "tag": "device_setting"
                  },
                  {

                    "device_id": "aabbcc000006",
                    "key": "preview",
                    "value": "REDACTED-00000013-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
                    "tag": "device_extra"
                  },
                  {

                    "device_id": "aabbcc000006",
                    "key": "ssh_password",
                    "value": "REDACTED-00000014-",
                    "tag": "credential"
                  },
                  {

                    "device_id": "aabbcc000006",
                    "key": "ssh_user",
                    "value": "Test username 40",
                    "tag": "credential"
                  },
                  {

                    "device_id": "aabbcc000006",
                    "key": "tof_distance",
                    "value": "2000",
                    "tag": "device_setting"
                  },
                  {

                    "device_id": "aabbcc000006",
                    "key": "volume",
                    "value": "100",
                    "tag": "device_setting"
                  }
                ],
                "update": null,
                "update_manual": {

                  "device_version_upgrade_status": {

                    "completed": false,
                    "is_waiting": false,
                    "is_upgrading": false,
                    "upgrade_seconds": 0,
                    "timed_out": false,
                    "failed": false,
                    "failure_reason": "",
                    "is_downloading": false
                  },
                  "from_version": "",
                  "last_upgrade_start_time": null,
                  "last_upgrade_success": null,
                  "last_upgrade_failure_reason": ""
                },
                "capabilities": [
                  "pin_code",
                  "pin_code_length",
                  "change_setting",
                  "remote_view",
                  "remote_call",
                  "ssh_change",
                  "support_register_card",
                  "is_reader",
                  "identity_is_reader",
                  "identity_remote_view",
                  "support_ui_account",
                  "support_webrtc",
                  "identity_support_webrtc",
                  "support_uid_webrtc",
                  "support_upgrade_by_url",
                  "support_record_extra",
                  "doorbell_timeout",
                  "doorbell_bind",
                  "post_capture",
                  "hold_to_call",
                  "support_face",
                  "identity_face_unlock",
                  "mobile_unlock_ver2",
                  "adopt_under_console",
                  "support_ems",
                  "identity_support_ems",
                  "anti_spoofing_level",
                  "show_face_method"
                ],
                "resource_name": "Test Name 41",
                "display_model": "UA G2 Pro",
                "revision": "1727732634833636479",
                "revision_update_time": 1727732636,
                "version_update_time": -62135596800,
                "firmware_update_time": -62135596800,
                "adopt_time": 1714086455,
                "extensions": [
                  {

                    "unique_id": "00000000-0000-0000-0000-000000000019",
                    "device_id": "aabbcc000006",
                    "extension_name": "intercom_pair",
                    "target_type": "admin",
                    "target_config": [
                      {

                        "config_tag": "",
                        "config_key": "",
                        "config_value": "00000000-0000-0000-0000-00000000001a"
                      },
                      {

                        "config_tag": "",
                        "config_key": "",
                        "config_value": "00000000-0000-0000-0000-00000000001b"
                      },
                      {

                        "config_tag": "",
                        "config_key": "",
                        "config_value": "00000000-0000-0000-0000-00000000001c"
                      },
                      {

                        "config_tag": "",
                        "config_key": "",
                        "config_value": "00000000-0000-0000-0000-00000000001d"
                      },
                      {

                        "config_tag": "",
                        "config_key": "",
                        "config_value": "00000000-0000-0000-0000-00000000001e"
                      },
                      {

                        "config_tag": "",
                        "config_key": "",
                        "config_value": "00000000-0000-0000-0000-00000000001f"
                      },
                      {

                        "config_tag": "",
                        "config_key": "",
                        "config_value": "00000000-0000-0000-0000-000000000020"
                      },
                      {

                        "config_tag": "",
                        "config_key": "",
                        "config_value": "00000000-0000-0000-0000-000000000021"
                      },
                      {

                        "config_tag": "",
                        "config_key": "",
                        "config_value": "00000000-0000-0000-0000-000000000022"
                      },
                      {

                        "config_tag": "",
                        "config_key": "",
                        "config_value": "00000000-0000-0000-0000-000000000023"
                      }
                    ]
                  }
                ],
                "model": "UA G2 Pro",
                "images": {

                  "xs": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006a_25x25.png",
                  "s": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006a_32x32.png",
                  "m": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006a_51x51.png",
                  "l": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006a_64x64.png",
                  "xl": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006a_101x101.png",
                  "xxl": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006a_128x128.png",
                  "base": "icons/00000000-0000-0000-0000-00000000006a_257x257.png",
                  "animation": [
                    "icons/g2-pro-black-close.png",
                    "icons/g2-pro-black-open.png"
                  ]
                }
              }
            ]
          ],
          "hotel_devices": [],
          "door_guard": [],
          "camera_resource_ids": [
            "AABBCC000007"
          ]
        },
        {

          "unique_id": "00000000-0000-0000-0000-000000000024",
          "name": "Test Name 42",
          "up_id": "00000000-0000-0000-0000-000000000012",
          "timezone": "",
          "location_type": "door",
          "extra_type": "",
          "full_name": "Test Name 43",
          "level": 0,
          "work_time": "[]",
          "work_time_id": "",
          "extras": {

            "uah-input_state_dps": "off",
            "uah-wiring_state_dps-neg": "off",
            "uah-wiring_state_dps-pos": "off"
          },
          "device_groups": [
            [
              {

                "unique_id": "aabbcc000008",
                "name": "Test Name 44",
                "alias": "Test alias 45",
                "device_type": "UAH",
                "connected_uah_id": "aabbcc000008",
                "location_id": "00000000-0000-0000-0000-000000000024",
                "firmware": "v4.6.2.0",
                "version": null,
                "ip": "192.0.2.7",
                "mac": "aa:bb:cc:00:00:08",
                "hw_type": "",
                "start_time": 1726934872,
                "security_check": false,
                "source": null,
                "bom_rev": "",
                "guid": "00000000-0000-0000-0000-000000000007",
                "need_advisory": false,
                "is_adopted": false,
                "is_managed": true,
                "is_connected": false,
                "is_online": false,
                "adopting": false,
                "location": {

                  "unique_id": "00000000-0000-0000-0000-000000000024",
                  "name": "Test Name 42",
                  "up_id": "00000000-0000-0000-0000-000000000012",
                  "timezone": "",
                  "location_type": "door",
                  "extra_type": "",
                  "full_name": "Test Name 43",
                  "level": 0,
                  "work_time": "[]",
                  "work_time_id": "",
                  "extras": {

                    "uah-input_state_dps": "off",
                    "uah-wiring_state_dps-neg": "off",
                    "uah-wiring_state_dps-pos": "off"
                  }
                },
                "door": {

                  "unique_id": "00000000-0000-0000-0000-000000000024",
                  "name": "Test Name 42",
                  "up_id": "00000000-0000-0000-0000-000000000012",
                  "timezone": "",
                  "location_type": "door",
                  "extra_type": "",
                  "full_name": "Test Name 43",
                  "level": 0,
                  "work_time": "[]",
                  "work_time_id": "",
                  "extras": {

                    "uah-input_state_dps": "off",
                    "uah-wiring_state_dps-neg": "off",
                    "uah-wiring_state_dps-pos": "off"
                  }
                },
                "floor": {

                  "unique_id": "00000000-0000-0000-0000-000000000012",
                  "name": "Test Name 2",
                  "up_id": "00000000-0000-0000-0000-000000000011",
                  "timezone": "",
                  "location_type": "floor",
                  "extra_type": "",
                  "full_name": "Test Name 28",
                  "level": 1,
                  "work_time": "[]",
                  "work_time_id": "",
                  "extras": {}
                },
                "configs": [
                  {

                    "device_id": "aabbcc000008",
                    "key": "alias",
                    "value": "Test alias 45",
                    "tag": "device_extra"
                  },
                  {

                    "device_id": "aabbcc000008",
                    "key": "aux_delay_time",
                    "value": "0.1",
                    "tag": "uah_config"
                  },
                  {

                    "device_id": "aabbcc000008",
                    "key": "aux_delay_wet",
                    "value": "0.1",
                    "tag": "uah_config"
                  },
                  {

                    "device_id": "aabbcc000008",
                    "key": "aux_mode_wet",
                    "value": "opener",
                    "tag": "uah_config"
                  },
                  {

                    "device_id": "aabbcc000008",
                    "key": "cert_fingerprint",
                    "value": "0000000000000000000000000000000000000007",
                    "tag": "credential"
                  },
                  {

                    "device_id": "aabbcc000008",
                    "key": "hold_relay_seconds",
                    "value": "5",
                    "tag": "uah_config"
                  },
                  {

                    "device_id": "aabbcc000008",
                    "key": "input_state_EMERGY",
                    "value": "off",
                    "tag": "input_state"
                  },
                  {

                    "device_id": "aabbcc000008",
                    "key": "input_state_SW-EMERGY",
                    "value": "off",
                    "tag": "input_state"
                  },
                  {

                    "device_id": "aabbcc000008",
                    "key": "input_state_dps",
                    "value": "off",
                    "tag": "input_state"
                  },
                  {

                    "device_id": "aabbcc000008",
                    "key": "input_state_rel",
                    "value": "off",
                    "tag": "input_state"
                  },
                  {

                    "device_id": "aabbcc000008",
                    "key": "input_state_ren",
                    "value": "off",
                    "tag": "input_state"
                  },
                  {

                    "device_id": "aabbcc000008",
                    "key": "input_state_rex",
                    "value": "off",
                    "tag": "input_state"
                  },
                  {

                    "device_id": "aabbcc000008",
                    "key": "input_state_rly-lock_dry",
                    "value": "off",
                    "tag": "input_state"
                  },
                  {

                    "device_id": "aabbcc000008",
                    "key": "lock_end_time",
                    "value": "0",
                    "tag": "uah_config"
                  },
                  {

                    "device_id": "aabbcc000008",
                    "key": "lock_type",
                    "value": "",
                    "tag": "uah_config"
                  },
                  {

                    "device_id": "aabbcc000008",
                    "key": "nacl_public_key",
                    "value": "REDACTED-00000015-xxxxxxxxxxxxxxxxxxxxxxxxxx",
                    "tag": "credential"
                  },
                  {

                    "device_id": "aabbcc000008",
                    "key": "output_aux_mode",
                    "value": "normal",
                    "tag": "uah_config"
                  },
                  {

                    "device_id": "aabbcc000008",
                    "key": "poe-type",
                    "value": "802.3bt",
                    "tag": "device_extra"
                  },
                  {

                    "device_id": "aabbcc000008",
                    "key": "port-mac-1",
                    "value": "aa:bb:cc:00:00:09",
                    "tag": "hub_action"
                  },
                  {

                    "device_id": "aabbcc000008",
                    "key": "port-mac-2",
                    "value": "",
                    "tag": "hub_action"
                  },
                  {

                    "device_id": "aabbcc000008",
                    "key": "port-mac-6",
                    "value": "aa:bb:cc:00:00:08",
                    "tag": "hub_action"
                  },
                  {

                    "device_id": "aabbcc000008",
                    "key": "ssh_password",
                    "value": "REDACTED-00000014-",
                    "tag": "credential"
                  },
                  {

                    "device_id": "aabbcc000008",
                    "key": "ssh_user",
                    "value": "Test username 40",
                    "tag": "credential"
                  },
                  {

                    "device_id": "aabbcc000008",
                    "key": "uah_token",
                    "value": "REDACTED-00000016-xxxxxxxxxxxxxxxxxx",
                    "tag": "uah_config"
                  },
                  {

                    "device_id": "aabbcc000008",
                    "key": "wiring_state_12v-neg",
                    "value": "off",
                    "tag": "wiring_state"
                  },
                  {

                    "device_id": "aabbcc000008",
                    "key": "wiring_state_12v-pos",
                    "value": "off",
                    "tag": "wiring_state"
                  },
                  {

                    "device_id": "aabbcc000008",
                    "key": "wiring_state_aux-dry-cn",
                    "value": "off",
                    "tag": "wiring_state"
                  },
                  {

                    "device_id": "aabbcc000008",
                    "key": "wiring_state_aux-dry-com",
                    "value": "off",
                    "tag": "wiring_state"
                  },
                  {

                    "device_id": "aabbcc000008",
                    "key": "wiring_state_aux-dry-nc",
                    "value": "off",
                    "tag": "wiring_state"
                  },
                  {

                    "device_id": "aabbcc000008",
                    "key": "wiring_state_aux-dry-no",
                    "value": "off",
                    "tag": "wiring_state"
                  },
                  {

                    "device_id": "aabbcc000008",
                    "key": "wiring_state_aux-wet-com",
                    "value": "off",
                    "tag": "wiring_state"
                  },
                  {

                    "device_id": "aabbcc000008",
                    "key": "wiring_state_aux-wet-nc",
                    "value": "off",
                    "tag": "wiring_state"
                  },
                  {

                    "device_id": "aabbcc000008",
                    "key": "wiring_state_aux-wet-no",
                    "value": "off",
                    "tag": "wiring_state"
                  },
                  {

                    "device_id": "aabbcc000008",
                    "key": "wiring_state_bitmap",
                    "value": "16777216",
                    "tag": "wiring_state"
                  },
                  {

                    "device_id": "aabbcc000008",
                    "key": "wiring_state_dps-neg",
                    "value": "off",
                    "tag": "wiring_state"
                  },
                  {

                    "device_id": "aabbcc000008",
                    "key": "wiring_state_dps-pos",
                    "value": "off",
                    "tag": "wiring_state"
                  },
                  {

                    "device_id": "aabbcc000008",
                    "key": "wiring_state_lock-dry-com",
                    "value": "off",
                    "tag": "wiring_state"
                  },
                  {

                    "device_id": "aabbcc000008",
                    "key": "wiring_state_lock-dry-nc",
                    "value": "off",
                    "tag": "wiring_state"
                  },
                  {

                    "device_id": "aabbcc000008",
                    "key": "wiring_state_lock-dry-no",
                    "value": "off",
                    "tag": "wiring_state"
                  },
                  {

                    "device_id": "aabbcc000008",
                    "key": "wiring_state_lock-wet-com",
                    "value": "off",
                    "tag": "wiring_state"
                  },
                  {

                    "device_id": "aabbcc000008",
                    "key": "wiring_state_lock-wet-nc",
                    "value": "off",
                    "tag": "wiring_state"
                  },
                  {

                    "device_id": "aabbcc000008",
                    "key": "wiring_state_lock-wet-no",
                    "value": "off",
                    "tag": "wiring_state"
                  },
                  {

                    "device_id": "aabbcc000008",
                    "key": "wiring_state_poe-p1-exit",
                    "value": "on",
                    "tag": "wiring_state"
                  },
                  {

                    "device_id": "aabbcc000008",
                    "key": "wiring_state_poe-p2-enter",
                    "value": "off",
                    "tag": "wiring_state"
                  },
                  {

                    "device_id": "aabbcc000008",
                    "key": "wiring_state_poe-p3-camera",
                    "value": "off",
                    "tag": "wiring_state"
                  },
                  {

                    "device_id": "aabbcc000008",
                    "key": "wiring_state_rel-neg",
                    "value": "off",
                    "tag": "wiring_state"
                  },
                  {

                    "device_id": "aabbcc000008",
                    "key": "wiring_state_rel-pos",
                    "value": "off",
                    "tag": "wiring_state"
                  },
                  {

                    "device_id": "aabbcc000008",
                    "key": "wiring_state_ren-neg",
                    "value": "off",
                    "tag": "wiring_state"
                  },
                  {

                    "device_id": "aabbcc000008",
                    "key": "wiring_state_ren-pos",
                    "value": "off",
                    "tag": "wiring_state"
                  },
                  {

                    "device_id": "aabbcc000008",
                    "key": "wiring_state_rex-neg",
                    "value": "off",
                    "tag": "wiring_state"
                  },
                  {

                    "device_id": "aabbcc000008",
                    "key": "wiring_state_rex-pos",
                    "value": "off",
                    "tag": "wiring_state"
                  },
                  {

                    "device_id": "aabbcc000008",
                    "key": "wiring_state_support-bitmap",
                    "value": "on",
                    "tag": "wiring_state"
                  }
                ],
                "update": null,
                "update_manual": {

                  "device_version_upgrade_status": {

                    "completed": false,
                    "is_waiting": false,
                    "is_upgrading": false,
                    "upgrade_seconds": 0,
                    "timed_out": false,
                    "failed": false,
                    "failure_reason": "",
                    "is_downloading": false
                  },
                  "from_version": "",
                  "last_upgrade_start_time": null,
                  "last_upgrade_success": null,
                  "last_upgrade_failure_reason": ""
                },
                "capabilities": [
                  "support_upgrade_by_url",
                  "pin_code",
                  "is_hub",
                  "identity_is_hub",
                  "dps_alarm",
                  "input_mode_switch",
                  "aux_alarm",
                  "aux_delay_time",
                  "hold_time_0.1s",
                  "lock_relay_report",
                  "ssh_change",
                  "door_bell",
                  "multi_unlock_schedule",
                  "support_ui_account",
                  "aux_option_change",
                  "unlock_time_period",
                  "incremental_update_setting",
                  "mqtt_topic_update_setting",
                  "mobile_unlock_ver2"
                ],
                "resource_name": "Test Name 46",
                "display_model": "UA Hub",
                "revision": "1726935221512825025",
                "revision_update_time": 1726935251,
                "version_update_time": -62135596800,
                "firmware_update_time": -62135596800,
                "adopt_time": 1721949338,
                "model": "UA Hub",
                "images": {

                  "xs": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-000000000067_25x25.png",
                  "s": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-000000000067_32x32.png",
                  "m": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-000000000067_51x51.png",
                  "l": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-000000000067_64x64.png",
                  "xl": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-000000000067_101x101.png",
                  "xxl": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-000000000067_128x128.png",
                  "base": "icons/00000000-0000-0000-0000-000000000067_257x257.png"
                }
              },
              {

                "unique_id": "aabbcc000009",
                "name": "Test Name 47",
                "alias": "Test alias 48",
                "device_type": "UA-G2-MINI",
                "connected_uah_id": "aabbcc000008",
                "location_id": "00000000-0000-0000-0000-000000000024",
                "firmware": "v3.12.9.0",
                "version": null,
                "ip": "192.0.2.8",
                "mac": "aa:bb:cc:00:00:09",
                "hw_type": "GA",
                "start_time": 1726935292,
                "security_check": true,
                "source": null,
                "bom_rev": "",
                "guid": "00000000-0000-0000-0000-00000000000d",
                "need_advisory": false,
                "is_adopted": false,
                "is_managed": true,
                "is_connected": false,
                "is_online": false,
                "adopting": false,
                "location": {

                  "unique_id": "00000000-0000-0000-0000-000000000024",
                  "name": "Test Name 42",
                  "up_id": "00000000-0000-0000-0000-000000000012",
                  "timezone": "",
                  "location_type": "door",
                  "extra_type": "",
                  "full_name": "Test Name 43",
                  "level": 0,
                  "work_time": "[]",
                  "work_time_id": "",
                  "extras": {

                    "uah-input_state_dps": "off",
                    "uah-wiring_state_dps-neg": "off",
                    "uah-wiring_state_dps-pos": "off"
                  }
                },
                "door": {

                  "unique_id": "00000000-0000-0000-0000-000000000024",
                  "name": "Test Name 42",
                  "up_id": "00000000-0000-0000-0000-000000000012",
                  "timezone": "",
                  "location_type": "door",
                  "extra_type": "",
                  "full_name": "Test Name 43",
                  "level": 0,
                  "work_time": "[]",
                  "work_time_id": "",
                  "extras": {

                    "uah-input_state_dps": "off",
                    "uah-wiring_state_dps-neg": "off",
                    "uah-wiring_state_dps-pos": "off"
                  }
                },
                "floor": {

                  "unique_id": "00000000-0000-0000-0000-000000000012",
                  "name": "Test Name 2",
                  "up_id": "00000000-0000-0000-0000-000000000011",
                  "timezone": "",
                  "location_type": "floor",
                  "extra_type": "",
                  "full_name": "Test Name 28",
                  "level": 1,
                  "work_time": "[]",
                  "work_time_id": "",
                  "extras": {}
                },
                "configs": [
                  {

                    "device_id": "aabbcc000009",
                    "key": "alias",
                    "value": "Test alias 48",
                    "tag": "device_extra"
                  },
                  {

                    "device_id": "aabbcc000009",
                    "key": "bt",
                    "value": "no",
                    "tag": "open_door_mode"
                  },
                  {

                    "device_id": "aabbcc000009",
                    "key": "bt_button",
                    "value": "no",
                    "tag": "open_door_mode"
                  },
                  {

                    "device_id": "aabbcc000009",
                    "key": "bt_tap",
                    "value": "yes",
                    "tag": "open_door_mode"
                  },
                  {

                    "device_id": "aabbcc000009",
                    "key": "cert_fingerprint",
                    "value": "0000000000000000000000000000000000000008",
                    "tag": "credential"
                  },
                  {

                    "device_id": "aabbcc000009",
                    "key": "door_entry_method",
                    "value": "in",
                    "tag": "door_entry_method"
                  },
                  {

                    "device_id": "aabbcc000009",
                    "key": "ibeacon_major",
                    "value": "0",
                    "tag": "device_setting"
                  },
                  {

                    "device_id": "aabbcc000009",
                    "key": "ibeacon_minor",
                    "value": "6",
                    "tag": "device_setting"
                  },
                  {

                    "device_id": "aabbcc000009",
                    "key": "ibeacon_uuid",
                    "value": "00000000-0000-0000-0000-000000000018",
                    "tag": "device_setting"
                  },
                  {

                    "device_id": "aabbcc000009",
                    "key": "nacl_public_key",
                    "value": "REDACTED-00000017-xxxxxxxxxxxxxxxxxxxxxxxxxx",
                    "tag": "credential"
                  },
                  {

                    "device_id": "aabbcc000009",
                    "key": "nfc",
                    "value": "yes",
                    "tag": "open_door_mode"
                  },
                  {

                    "device_id": "aabbcc000009",
                    "key": "ssh_password",
                    "value": "REDACTED-00000014-",
                    "tag": "credential"
                  },
                  {

                    "device_id": "aabbcc000009",
                    "key": "ssh_user",
                    "value": "Test username 40",
                    "tag": "credential"
                  },
                  {

                    "device_id": "aabbcc000009",
                    "key": "volume",
                    "value": "yes",
                    "tag": "device_setting"
                  },
                  {

                    "device_id": "aabbcc000009",
                    "key": "wave",
                    "value": "no",
                    "tag": "open_door_mode"
                  }
                ],
                "update": null,
                "update_manual": {

                  "device_version_upgrade_status": {

                    "completed": false,
                    "is_waiting": false,
                    "is_upgrading": false,
                    "upgrade_seconds": 0,
                    "timed_out": false,
                    "failed": false,
                    "failure_reason": "",
                    "is_downloading": false
                  },
                  "from_version": "",
                  "last_upgrade_start_time": null,
                  "last_upgrade_success": null,
                  "last_upgrade_failure_reason": ""
                },
                "capabilities": [
                  "ssh_change",
                  "support_register_card",
                  "is_reader",
                  "identity_is_reader",
                  "adopt_under_console",
                  "support_upgrade_by_url",
                  "support_ui_account",
                  "sensitivity",
                  "mobile_unlock_ver2"
                ],
                "resource_name": "Test Name 49",
                "display_model": "UA G2",
                "revision": "1726935221512825025",
                "revision_update_time": 1726935352,
                "version_update_time": -62135596800,
                "firmware_update_time": -62135596800,
                "adopt_time": 1721949653,
                "model": "UA G2 Black",
                "images": {

                  "xs": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-000000000069_25x25.png",
                  "s": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-000000000069_32x32.png",
                  "m": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-000000000069_51x51.png",
                  "l": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-000000000069_64x64.png",
                  "xl": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-000000000069_101x101.png",
                  "xxl": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-000000000069_128x128.png",
                  "base": "icons/00000000-0000-0000-0000-000000000069_257x257.png",
                  "animation": [
                    "icons/g2-mini-black-close.png",
                    "icons/g2-mini-black-open.png"
                  ]
                }
              }
            ]
          ],
          "hotel_devices": [],
          "door_guard": [],
          "camera_resource_ids": []
        },
        {

          "unique_id": "00000000-0000-0000-0000-000000000025",
          "name": "Test Name 50",
          "up_id": "00000000-0000-0000-0000-000000000012",
          "timezone": "",
          "location_type": "door",
          "extra_type": "",
          "full_name": "Test Name 51",
          "level": 0,
          "work_time": "[]",
          "work_time_id": "",
          "extras": {

            "door_thumbnail": "REDACTED-00000018-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
            "door_thumbnail_last_update": 1727910331
          },
          "device_groups": [
            [
              {

                "unique_id": "aabbcc00000a",
                "name": "Test Name 52",
                "alias": "",
                "device_type": "UA-G2-PRO",
                "connected_uah_id": "aabbcc000005",
                "location_id": "00000000-0000-0000-0000-000000000025",
                "firmware": "v1.6.28",
                "version": null,
                "ip": "192.0.2.9",
                "mac": "aa:bb:cc:00:00:0a",
                "hw_type": "GA",
                "start_time": 1727482902,
                "security_check": true,
                "source": null,
                "bom_rev": "",
                "guid": "00000000-0000-0000-0000-000000000009",
                "need_advisory": false,
                "is_adopted": true,
                "is_managed": true,
                "is_connected": true,
                "is_online": true,
                "adopting": false,
                "location": {

                  "unique_id": "00000000-0000-0000-0000-000000000025",
                  "name": "Test Name 50",
                  "up_id": "00000000-0000-0000-0000-000000000012",
                  "timezone": "",
                  "location_type": "door",
                  "extra_type": "",
                  "full_name": "Test Name 51",
                  "level": 0,
                  "work_time": "[]",
                  "work_time_id": "",
                  "extras": {

                    "door_thumbnail": "REDACTED-00000018-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
                    "door_thumbnail_last_update": 1727910331
                  }
                },
                "door": {

                  "unique_id": "00000000-0000-0000-0000-000000000025",
                  "name": "Test Name 50",
                  "up_id": "00000000-0000-0000-0000-000000000012",
                  "timezone": "",
                  "location_type": "door",
                  "extra_type": "",
                  "full_name": "Test Name 51",
                  "level": 0,
                  "work_time": "[]",
                  "work_time_id": "",
                  "extras": {

                    "door_thumbnail": "REDACTED-00000018-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
                    "door_thumbnail_last_update": 1727910331
                  }
                },
                "floor": {

                  "unique_id": "00000000-0000-0000-0000-000000000012",
                  "name": "Test Name 2",
                  "up_id": "00000000-0000-0000-0000-000000000011",
                  "timezone": "",
                  "location_type": "floor",
                  "extra_type": "",
                  "full_name": "Test Name 28",
                  "level": 1,
                  "work_time": "[]",
                  "work_time_id": "",
                  "extras": {}
                },
                "configs": [
                  {

                    "device_id": "aabbcc00000a",
                    "key": "alias",
                    "value": "",
                    "tag": "device_extra"
                  },
                  {

                    "device_id": "aabbcc00000a",
                    "key": "brightness",
                    "value": "36",
                    "tag": "device_setting"
                  },
                  {

                    "device_id": "aabbcc00000a",
                    "key": "bt",
                    "value": "yes",
                    "tag": "open_door_mode"
                  },
                  {

                    "device_id": "aabbcc00000a",
                    "key": "bt_button",
                    "value": "yes",
                    "tag": "open_door_mode"
                  },
                  {

                    "device_id": "aabbcc00000a",
                    "key": "bt_tap",
                    "value": "yes",
                    "tag": "open_door_mode"
                  },
                  {

                    "device_id": "aabbcc00000a",
                    "key": "capture_record_extra_before",
                    "value": "5",
                    "tag": "device_setting"
                  },
                  {

                    "device_id": "aabbcc00000a",
                    "key": "cert_fingerprint",
                    "value": "0000000000000000000000000000000000000009",
                    "tag": "credential"
                  },
                  {

                    "device_id": "aabbcc00000a",
                    "key": "door_bell_trigger_interface",
                    "value": "swipe",
                    "tag": "device_setting"
                  },
                  {

                    "device_id": "aabbcc00000a",
                    "key": "door_bell_trigger_type",
                    "value": "off",
                    "tag": "device_setting"
                  },
                  {

                    "device_id": "aabbcc00000a",
                    "key": "door_entry_method",
                    "value": "in",
                    "tag": "door_entry_method"
                  },
                  {

                    "device_id": "aabbcc00000a",
                    "key": "greeting_broadcast_name",
                    "value": "first_name_only",
                    "tag": "device_setting"
                  },
                  {

                    "device_id": "aabbcc00000a",
                    "key": "greeting_text",
                    "value": "welcome",
                    "tag": "device_setting"
                  },
                  {

                    "device_id": "aabbcc00000a",
                    "key": "ibeacon_major",
                    "value": "0",
                    "tag": "device_setting"
                  },
                  {

                    "device_id": "aabbcc00000a",
                    "key": "ibeacon_minor",
                    "value": "9",
                    "tag": "device_setting"
                  },
                  {

                    "device_id": "aabbcc00000a",
                    "key": "ibeacon_uuid",
                    "value": "00000000-0000-0000-0000-000000000018",
                    "tag": "device_setting"
                  },
                  {

                    "device_id": "aabbcc00000a",
                    "key": "nacl_public_key",
                    "value": "REDACTED-00000019-xxxxxxxxxxxxxxxxxxxxxxxxxx",
                    "tag": "credential"
                  },
                  {

                    "device_id": "aabbcc00000a",
                    "key": "nfc",
                    "value": "yes",
                    "tag": "open_door_mode"
                  },
                  {

                    "device_id": "aabbcc00000a",
                    "key": "pin_code",
                    "value": "REDACTED-00000012-",
                    "tag": "open_door_mode"
                  },
                  {

                    "device_id": "aabbcc00000a",
                    "key": "pin_code_disable",
                    "value": "no",
                    "tag": "device_setting"
                  },
                  {

                    "device_id": "aabbcc00000a",
                    "key": "pin_code_shuffle",
                    "value": "yes",
                    "tag": "device_setting"
                  },
                  {

                    "device_id": "aabbcc00000a",
                    "key": "preview",
                    "value": "REDACTED-0000001a-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
                    "tag": "device_extra"
                  },
                  {

                    "device_id": "aabbcc00000a",
                    "key": "ssh_password",
                    "value": "REDACTED-00000014-",
                    "tag": "credential"
                  },
                  {

                    "device_id": "aabbcc00000a",
                    "key": "ssh_user",
                    "value": "Test username 40",
                    "tag": "credential"
                  },
                  {

                    "device_id": "aabbcc00000a",
                    "key": "tof_distance",
                    "value": "2000",
                    "tag": "device_setting"
                  },
                  {

                    "device_id": "aabbcc00000a",
                    "key": "volume",
                    "value": "36",
                    "tag": "device_setting"
                  }
                ],
                "update": null,
                "update_manual": {

                  "device_version_upgrade_status": {

                    "completed": false,
                    "is_waiting": false,
                    "is_upgrading": false,
                    "upgrade_seconds": 0,
                    "timed_out": false,
                    "failed": false,
                    "failure_reason": "",
                    "is_downloading": false
                  },
                  "from_version": "",
                  "last_upgrade_start_time": null,
                  "last_upgrade_success": null,
                  "last_upgrade_failure_reason": ""
                },
                "capabilities": [
                  "pin_code",
                  "pin_code_length",
                  "change_setting",
                  "remote_view",
                  "remote_call",
                  "ssh_change",
                  "support_register_card",
                  "is_reader",
                  "identity_is_reader",
                  "identity_remote_view",
                  "support_ui_account",
                  "support_webrtc",
                  "identity_support_webrtc",
                  "support_uid_webrtc",
                  "support_upgrade_by_url",
                  "support_record_extra",
                  "doorbell_timeout",
                  "doorbell_bind",
                  "post_capture",
                  "hold_to_call",
                  "support_face",
                  "identity_face_unlock",
                  "mobile_unlock_ver2",
                  "adopt_under_console",
                  "support_ems",
                  "identity_support_ems",
                  "anti_spoofing_level",
                  "show_face_method"
                ],
                "resource_name": "Test Name 53",
                "display_model": "UA G2 Pro",
                "revision": "1727732634833636479",
                "revision_update_time": 1727732638,
                "version_update_time": -62135596800,
                "firmware_update_time": -62135596800,
                "adopt_time": 1714086302,
                "extensions": [
                  {

                    "unique_id": "00000000-0000-0000-0000-000000000026",
                    "device_id": "aabbcc00000a",
                    "extension_name": "intercom_pair",
                    "target_type": "admin",
                    "target_config": [
                      {

                        "config_tag": "",
                        "config_key": "",
                        "config_value": "00000000-0000-0000-0000-00000000001a"
                      },
                      {

                        "config_tag": "",
                        "config_key": "",
                        "config_value": "00000000-0000-0000-0000-000000000023"
                      },
                      {

                        "config_tag": "",
                        "config_key": "",
                        "config_value": "00000000-0000-0000-0000-000000000022"
                      },
                      {

                        "config_tag": "",
                        "config_key": "",
                        "config_value": "00000000-0000-0000-0000-000000000020"
                      },
                      {

                        "config_tag": "",
                        "config_key": "",
                        "config_value": "00000000-0000-0000-0000-000000000021"
                      }
                    ]
                  }
                ],
                "model": "UA G2 Pro",
                "images": {

                  "xs": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006a_25x25.png",
                  "s": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006a_32x32.png",
                  "m": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006a_51x51.png",
                  "l": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006a_64x64.png",
                  "xl": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006a_101x101.png",
                  "xxl": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006a_128x128.png",
                  "base": "icons/00000000-0000-0000-0000-00000000006a_257x257.png",
                  "animation": [
                    "icons/g2-pro-black-close.png",
                    "icons/g2-pro-black-open.png"
                  ]
                }
              }
            ]
          ],
          "hotel_devices": [],
          "door_guard": [],
          "camera_resource_ids": [
            "AABBCC00000B"
          ]
        },
        {

          "unique_id": "00000000-0000-0000-0000-000000000027",
          "name": "Test Name 54",
          "up_id": "00000000-0000-0000-0000-000000000012",
          "timezone": "",
          "location_type": "door",
          "extra_type": "",
          "full_name": "Test Name 55",
          "level": 0,
          "work_time": "[]",
          "work_time_id": "",
          "extras": {

            "door_thumbnail": "REDACTED-0000001b-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
            "door_thumbnail_last_update": 1727910219
          },
          "device_groups": [
            [
              {

                "unique_id": "aabbcc00000c",
                "name": "Test Name 56",
                "alias": "",
                "device_type": "UA-G2-MINI",
                "connected_uah_id": "aabbcc000005",
                "location_id": "00000000-0000-0000-0000-000000000027",
                "firmware": "v3.12.9.0",
                "version": null,
                "ip": "192.0.2.10",
                "mac": "AA:BB:CC:00:00:0C",
                "hw_type": "GA",
                "start_time": 1726926767,
                "security_check": true,
                "source": null,
                "bom_rev": "",
                "guid": "00000000-0000-0000-0000-00000000000d",
                "need_advisory": false,
                "is_adopted": true,
                "is_managed": true,
                "is_connected": true,
                "is_online": true,
                "adopting": false,
                "location": {

                  "unique_id": "00000000-0000-0000-0000-000000000027",
                  "name": "Test Name 54",
                  "up_id": "00000000-0000-0000-0000-000000000012",
                  "timezone": "",
                  "location_type": "door",
                  "extra_type": "",
                  "full_name": "Test Name 55",
                  "level": 0,
                  "work_time": "[]",
                  "work_time_id": "",
                  "extras": {

                    "door_thumbnail": "REDACTED-0000001b-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
                    "door_thumbnail_last_update": 1727910219
                  }
                },
                "door": {

                  "unique_id": "00000000-0000-0000-0000-000000000027",
                  "name": "Test Name 54",
                  "up_id": "00000000-0000-0000-0000-000000000012",
                  "timezone": "",
                  "location_type": "door",
                  "extra_type": "",
                  "full_name": "Test Name 55",
                  "level": 0,
                  "work_time": "[]",
                  "work_time_id": "",
                  "extras": {

                    "door_thumbnail": "REDACTED-0000001b-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
                    "door_thumbnail_last_update": 1727910219
                  }
                },
                "floor": {

                  "unique_id": "00000000-0000-0000-0000-000000000012",
                  "name": "Test Name 2",
                  "up_id": "00000000-0000-0000-0000-000000000011",
                  "timezone": "",
                  "location_type": "floor",
                  "extra_type": "",
                  "full_name": "Test Name 28",
                  "level": 1,
                  "work_time": "[]",
                  "work_time_id": "",
                  "extras": {}
                },
                "configs": [
                  {

                    "device_id": "aabbcc00000c",
                    "key": "alias",
                    "value": "",
                    "tag": "device_extra"
                  },
                  {

                    "device_id": "aabbcc00000c",
                    "key": "bt",
                    "value": "yes",
                    "tag": "open_door_mode"
                  },
                  {

                    "device_id": "aabbcc00000c",
                    "key": "bt_button",
                    "value": "yes",
                    "tag": "open_door_mode"
                  },
                  {

                    "device_id": "aabbcc00000c",
                    "key": "bt_tap",
                    "value": "yes",
                    "tag": "open_door_mode"
                  },
                  {

                    "device_id": "aabbcc00000c",
                    "key": "cert_fingerprint",
                    "value": "000000000000000000000000000000000000000a",
                    "tag": "credential"
                  },
                  {

                    "device_id": "aabbcc00000c",
                    "key": "door_entry_method",
                    "value": "in",
                    "tag": "door_entry_method"
                  },
                  {

                    "device_id": "aabbcc00000c",
                    "key": "ibeacon_major",
                    "value": "0",
                    "tag": "device_setting"
                  },
                  {

                    "device_id": "aabbcc00000c",
                    "key": "ibeacon_minor",
                    "value": "8",
                    "tag": "device_setting"
                  },
                  {

                    "device_id": "aabbcc00000c",
                    "key": "ibeacon_uuid",
                    "value": "00000000-0000-0000-0000-000000000018",
                    "tag": "device_setting"
                  },
                  {

                    "device_id": "aabbcc00000c",
                    "key": "nacl_public_key",
                    "value": "REDACTED-0000001c-xxxxxxxxxxxxxxxxxxxxxxxxxx",
                    "tag": "credential"
                  },
                  {

                    "device_id": "aabbcc00000c",
                    "key": "nfc",
                    "value": "yes",
                    "tag": "open_door_mode"
                  },
                  {

                    "device_id": "aabbcc00000c",
                    "key": "operator_pair",
                    "value": "",
                    "tag": "device_setting"
                  },
                  {

                    "device_id": "aabbcc00000c",
                    "key": "ssh_password",
                    "value": "REDACTED-00000014-",
                    "tag": "credential"
                  },
                  {

                    "device_id": "aabbcc00000c",
                    "key": "ssh_user",
                    "value": "Test username 40",
                    "tag": "credential"
                  },
                  {

                    "device_id": "aabbcc00000c",
                    "key": "volume",
                    "value": "yes",
                    "tag": "device_setting"
                  },
                  {

                    "device_id": "aabbcc00000c",
                    "key": "wave",
                    "value": "no",
                    "tag": "open_door_mode"
                  }
                ],
                "update": null,
                "update_manual": {

                  "device_version_upgrade_status": {

                    "completed": false,
                    "is_waiting": false,
                    "is_upgrading": false,
                    "upgrade_seconds": 0,
                    "timed_out": false,
                    "failed": false,
                    "failure_reason": "",
                    "is_downloading": false
                  },
                  "from_version": "",
                  "last_upgrade_start_time": null,
                  "last_upgrade_success": null,
                  "last_upgrade_failure_reason": ""
                },
                "capabilities": [
                  "ssh_change",
                  "support_register_card",
                  "is_reader",
                  "identity_is_reader",
                  "adopt_under_console",
                  "support_upgrade_by_url",
                  "support_ui_account",
                  "sensitivity",
                  "mobile_unlock_ver2"
                ],
                "resource_name": "Test Name 57",
                "display_model": "UA G2",
                "revision": "1727732634833636479",
                "revision_update_time": 1727869259,
                "version_update_time": -62135596800,
                "firmware_update_time": -62135596800,
                "adopt_time": 1714086335,
                "model": "UA G2 Black",
                "images": {

                  "xs": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-000000000069_25x25.png",
                  "s": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-000000000069_32x32.png",
                  "m": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-000000000069_51x51.png",
                  "l": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-000000000069_64x64.png",
                  "xl": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-000000000069_101x101.png",
                  "xxl": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-000000000069_128x128.png",
                  "base": "icons/00000000-0000-0000-0000-000000000069_257x257.png",
                  "animation": [
                    "icons/g2-mini-black-close.png",
                    "icons/g2-mini-black-open.png"
                  ]
                }
              }
            ]
          ],
          "hotel_devices": [],
          "door_guard": [],
          "camera_resource_ids": [
            "AABBCC00000D"
          ]
        },
        {

          "unique_id": "00000000-0000-0000-0000-000000000028",
          "name": "Test Name 58",
          "up_id": "00000000-0000-0000-0000-000000000012",
          "timezone": "",
          "location_type": "door",
          "extra_type": "",
          "full_name": "Test Name 59",
          "level": 0,
          "work_time": "[]",
          "work_time_id": "",
          "extras": {

            "door_thumbnail": "REDACTED-0000001d-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
            "door_thumbnail_last_update": 1727911839
          },
          "device_groups": [],
          "hotel_devices": [],
          "door_guard": [],
          "camera_resource_ids": [
            "AABBCC00000E"
          ]
        }
      ]
    }
  ],
  "device_groups": [
    [
      {

        "adopt_time": 1714085705,
        "adopting": false,
        "alias": "Test alias 60",
        "bom_rev": "",
        "connected_uah_id": "aabbcc000005",
        "device_type": "UAH-Ent",
        "display_model": "EAH 8",
        "firmware_update_time": -62135596800,
        "firmware": "v5.5.8.0",
        "guid": "00000000-0000-0000-0000-000000000029",
        "hw_type": "",
        "ip": "192.0.2.11",
        "is_adopted": true,
        "is_connected": true,
        "is_managed": true,
        "is_online": true,
        "location_id": "00000000-0000-0000-0000-000000000011",
        "mac": "aa:bb:cc:00:00:05",
        "model": "EAH 8",
        "name": "Test Name 61",
        "need_advisory": false,
        "resource_name": "Test Name 62",
        "revision_update_time": 1727732649,
        "revision": "1727732634833636479",
        "security_check": false,
        "source": null,
        "start_time": 1727869144,
        "unique_id": "aabbcc000005",
        "update": null,
        "version_update_time": -62135596800,
        "version": null,
        "location": {

          "unique_id": "00000000-0000-0000-0000-000000000011",
          "name": "Test Name 27",
          "up_id": "",
          "timezone": "",
          "location_type": "building",
          "extra_type": "",
          "full_name": "Test Name 27",
          "level": 0,
          "work_time": "[]",
          "work_time_id": "",
          "extras": {

            "door_thumbnails": [
              {

                "door_cover": null,
                "door_thumbnail": "",
                "door_thumbnail_last_update": 0,
                "hub_id": "aabbcc000005"
              }
            ]
          }
        },
        "configs": [
          {

            "device_id": "aabbcc000005",
            "key": "alias",
            "value": "Test alias 60",
            "tag": "device_extra"
          },
          {

            "device_id": "aabbcc000005",
            "key": "aux_delay_wet",
            "value": "0.1",
            "tag": "uah_config"
          },
          {

            "device_id": "aabbcc000005",
            "key": "aux_mode_wet",
            "value": "opener",
            "tag": "uah_config"
          },
          {

            "device_id": "aabbcc000005",
            "key": "bt",
            "value": "yes",
            "tag": "open_door_mode"
          },
          {

            "device_id": "aabbcc000005",
            "key": "bt_button",
            "value": "yes",
            "tag": "open_door_mode"
          },
          {

            "device_id": "aabbcc000005",
            "key": "cert_fingerprint",
            "value": "000000000000000000000000000000000000000b",
            "tag": "credential"
          },
          {

            "device_id": "aabbcc000005",
            "key": "door_entry_method",
            "value": "in",
            "tag": "door_entry_method"
          },
          {

            "device_id": "aabbcc000005",
            "key": "ibeacon_major",
            "value": "0",
            "tag": "device_setting"
          },
          {

            "device_id": "aabbcc000005",
            "key": "ibeacon_minor",
            "value": "2",
            "tag": "device_setting"
          },
          {

            "device_id": "aabbcc000005",
            "key": "ibeacon_uuid",
            "value": "00000000-0000-0000-0000-000000000018",
            "tag": "device_setting"
          },
          {

            "device_id": "aabbcc000005",
            "key": "input_d1_button",
            "value": "off",
            "tag": "hub_action"
          },
          {

            "device_id": "aabbcc000005",
            "key": "input_d1_dps",
            "value": "off",
            "tag": "hub_action"
          },
          {

            "device_id": "aabbcc000005",
            "key": "input_d2_button",
            "value": "off",
            "tag": "hub_action"
          },
          {

            "device_id": "aabbcc000005",
            "key": "input_d2_dps",
            "value": "off",
            "tag": "hub_action"
          },
          {

            "device_id": "aabbcc000005",
            "key": "input_d3_button",
            "value": "off",
            "tag": "hub_action"
          },
          {

            "device_id": "aabbcc000005",
            "key": "input_d3_dps",
            "value": "off",
            "tag": "hub_action"
          },
          {

            "device_id": "aabbcc000005",
            "key": "input_d4_button",
            "value": "off",
            "tag": "hub_action"
          },
          {

            "device_id": "aabbcc000005",
            "key": "input_d4_dps",
            "value": "off",
            "tag": "hub_action"
          },
          {

            "device_id": "aabbcc000005",
            "key": "input_d5_button",
            "value": "off",
            "tag": "hub_action"
          },
          {

            "device_id": "aabbcc000005",
            "key": "input_d5_dps",
            "value": "off",
            "tag": "hub_action"
          },
          {

            "device_id": "aabbcc000005",
            "key": "input_d6_button",
            "value": "off",
            "tag": "hub_action"
          },
          {

            "device_id": "aabbcc000005",
            "key": "input_d6_dps",
            "value": "off",
            "tag": "hub_action"
          },
          {

            "device_id": "aabbcc000005",
            "key": "input_d7_button",
            "value": "off",
            "tag": "hub_action"
          },
          {

            "device_id": "aabbcc000005",
            "key": "input_d7_dps",
            "value": "off",
            "tag": "hub_action"
          },
          {

            "device_id": "aabbcc000005",
            "key": "input_d8_button",
            "value": "off",
            "tag": "hub_action"
          },
          {

            "device_id": "aabbcc000005",
            "key": "input_d8_dps",
            "value": "off",
            "tag": "hub_action"
          },
          {

            "device_id": "aabbcc000005",
            "key": "input_emer",
            "value": "off",
            "tag": "hub_action"
          },
          {

            "device_id": "aabbcc000005",
            "key": "input_sw_emer",
            "value": "off",
            "tag": "hub_action"
          },
          {

            "device_id": "aabbcc000005",
            "key": "nacl_public_key",
            "value": "REDACTED-0000001e-xxxxxxxxxxxxxxxxxxxxxxxxxx",
            "tag": "credential"
          },
          {

            "device_id": "aabbcc000005",
            "key": "nfc",
            "value": "no",
            "tag": "open_door_mode"
          },
          {

            "device_id": "aabbcc000005",
            "key": "output_d1_aux_relay",
            "value": "off",
            "tag": "hub_action"
          },
          {

            "device_id": "aabbcc000005",
            "key": "output_d1_lock_relay",
            "value": "off",
            "tag": "hub_action"
          },
          {

            "device_id": "aabbcc000005",
            "key": "output_d2_aux_relay",
            "value": "off",
            "tag": "hub_action"
          },
          {

            "device_id": "aabbcc000005",
            "key": "output_d2_lock_relay",
            "value": "off",
            "tag": "hub_action"
          },
          {

            "device_id": "aabbcc000005",
            "key": "output_d3_aux_relay",
            "value": "off",
            "tag": "hub_action"
          },
          {

            "device_id": "aabbcc000005",
            "key": "output_d3_lock_relay",
            "value": "off",
            "tag": "hub_action"
          },
          {

            "device_id": "aabbcc000005",
            "key": "output_d4_aux_relay",
            "value": "off",
            "tag": "hub_action"
          },
          {

            "device_id": "aabbcc000005",
            "key": "output_d4_lock_relay",
            "value": "off",
            "tag": "hub_action"
          },
          {

            "device_id": "aabbcc000005",
            "key": "output_d5_aux_relay",
            "value": "off",
            "tag": "hub_action"
          },
          {

            "device_id": "aabbcc000005",
            "key": "output_d5_lock_relay",
            "value": "on",
            "tag": "hub_action"
          },
          {

            "device_id": "aabbcc000005",
            "key": "output_d6_aux_relay",
            "value": "off",
            "tag": "hub_action"
          },
          {

            "device_id": "aabbcc000005",
            "key": "output_d6_lock_relay",
            "value": "off",
            "tag": "hub_action"
          },
          {

            "device_id": "aabbcc000005",
            "key": "output_d7_aux_relay",
            "value": "off",
            "tag": "hub_action"
          },
          {

            "device_id": "aabbcc000005",
            "key": "output_d7_lock_relay",
            "value": "off",
            "tag": "hub_action"
          },
          {

            "device_id": "aabbcc000005",
            "key": "output_d8_aux_relay",
            "value": "off",
            "tag": "hub_action"
          },
          {

            "device_id": "aabbcc000005",
            "key": "output_d8_lock_relay",
            "value": "off",
            "tag": "hub_action"
          },
          {

            "device_id": "aabbcc000005",
            "key": "ssh_password",
            "value": "REDACTED-00000014-",
            "tag": "credential"
          },
          {

            "device_id": "aabbcc000005",
            "key": "ssh_user",
            "value": "Test username 40",
            "tag": "credential"
          },
          {

            "device_id": "aabbcc000005",
            "key": "wiring_state_bitmap",
            "value": "6947928325126619662",
            "tag": "wiring_state"
          },
          {

            "device_id": "aabbcc000005",
            "key": "wiring_state_d1-button-neg",
            "value": "off",
            "tag": "wiring_state"
          },
          {

            "device_id": "aabbcc000005",
            "key": "wiring_state_d1-button-pos",
            "value": "off",
            "tag": "wiring_state"
          },
          {

            "device_id": "aabbcc000005",
            "key": "wiring_state_d1-dps-neg",
            "value": "off",
            "tag": "wiring_state"
          },
          {

            "device_id": "aabbcc000005",
            "key": "wiring_state_d1-dps-pos",
            "value": "off",
            "tag": "wiring_state"
          },
          {

            "device_id": "aabbcc000005",
            "key": "wiring_state_d1-lock-com",
            "value": "on",
            "tag": "wiring_state"
          },
          {

            "device_id": "aabbcc000005",
            "key": "wiring_state_d1-lock-nc",
            "value": "off",
            "tag": "wiring_state"
          },
          {

            "device_id": "aabbcc000005",
            "key": "wiring_state_d1-lock-no",
            "value": "on",
            "tag": "wiring_state"
          },
          {

            "device_id": "aabbcc000005",
            "key": "wiring_state_d1-power-sw",
            "value": "off",
            "tag": "wiring_state"
          },
          {

            "device_id": "aabbcc000005",
            "key": "wiring_state_d2-button-neg",
            "value": "off",
            "tag": "wiring_state"
          },
          {

            "device_id": "aabbcc000005",
            "key": "wiring_state_d2-button-pos",
            "value": "off",
            "tag": "wiring_state"
          },
          {

            "device_id": "aabbcc000005",
            "key": "wiring_state_d2-dps-neg",
            "value": "off",
            "tag": "wiring_state"
          },
          {

            "device_id": "aabbcc000005",
            "key": "wiring_state_d2-dps-pos",
            "value": "off",
            "tag": "wiring_state"
          },
          {

            "device_id": "aabbcc000005",
            "key": "wiring_state_d2-lock-com",
            "value": "off",
            "tag": "wiring_state"
          },
          {

            "device_id": "aabbcc000005",
            "key": "wiring_state_d2-lock-nc",
            "value": "off",
            "tag": "wiring_state"
          },
          {

            "device_id": "aabbcc000005",
            "key": "wiring_state_d2-lock-no",
            "value": "off",
            "tag": "wiring_state"
          },
          {

            "device_id": "aabbcc000005",
            "key": "wiring_state_d2-power-sw",
            "value": "off",
            "tag": "wiring_state"
          },
          {

            "device_id": "aabbcc000005",
            "key": "wiring_state_d3-button-neg",
            "value": "off",
            "tag": "wiring_state"
          },
          {

            "device_id": "aabbcc000005",
            "key": "wiring_state_d3-button-pos",
            "value": "off",
            "tag": "wiring_state"
          },
          {

            "device_id": "aabbcc000005",
            "key": "wiring_state_d3-dps-neg",
            "value": "off",
            "tag": "wiring_state"
          },
          {

            "device_id": "aabbcc000005",
            "key": "wiring_state_d3-dps-pos",
            "value": "off",
            "tag": "wiring_state"
          },
          {

            "device_id": "aabbcc000005",
            "key": "wiring_state_d3-lock-com",
            "value": "off",
            "tag": "wiring_state"
          },
          {

            "device_id": "aabbcc000005",
            "key": "wiring_state_d3-lock-nc",
            "value": "off",
            "tag": "wiring_state"
          },
          {

            "device_id": "aabbcc000005",
            "key": "wiring_state_d3-lock-no",
            "value": "off",
            "tag": "wiring_state"
          },
          {

            "device_id": "aabbcc000005",
            "key": "wiring_state_d3-power-sw",
            "value": "off",
            "tag": "wiring_state"
          },
          {

            "device_id": "aabbcc000005",
            "key": "wiring_state_d4-button-neg",
            "value": "off",
            "tag": "wiring_state"
          },
          {

            "device_id": "aabbcc000005",
            "key": "wiring_state_d4-button-pos",
            "value": "off",
            "tag": "wiring_state"
          },
          {

            "device_id": "aabbcc000005",
            "key": "wiring_state_d4-dps-neg",
            "value": "off",
            "tag": "wiring_state"
          },
          {

            "device_id": "aabbcc000005",
            "key": "wiring_state_d4-dps-pos",
            "value": "off",
            "tag": "wiring_state"
          },
          {

            "device_id": "aabbcc000005",
            "key": "wiring_state_d4-lock-com",
            "value": "off",
            "tag": "wiring_state"
          },
          {

            "device_id": "aabbcc000005",
            "key": "wiring_state_d4-lock-nc",
            "value": "off",
            "tag": "wiring_state"
          },
          {

            "device_id": "aabbcc000005",
            "key": "wiring_state_d4-lock-no",
            "value": "off",
            "tag": "wiring_state"
          },
          {

            "device_id": "aabbcc000005",
            "key": "wiring_state_d4-power-sw",
            "value": "off",
            "tag": "wiring_state"
          },
          {

            "device_id": "aabbcc000005",
            "key": "wiring_state_d5-aux-com",
            "value": "on",
            "tag": "wiring_state"
          },
          {

            "device_id": "aabbcc000005",
            "key": "wiring_state_d5-aux-nc",
            "value": "off",
            "tag": "wiring_state"
          },
          {

            "device_id": "aabbcc000005",
            "key": "wiring_state_d5-aux-no",
            "value": "on",
            "tag": "wiring_state"
          },
          {

            "device_id": "aabbcc000005",
            "key": "wiring_state_d5-button-neg",
            "value": "off",
            "tag": "wiring_state"
          },
          {

            "device_id": "aabbcc000005",
            "key": "wiring_state_d5-button-pos",
            "value": "off",
            "tag": "wiring_state"
          },
          {

            "device_id": "aabbcc000005",
            "key": "wiring_state_d5-dps-neg",
            "value": "off",
            "tag": "wiring_state"
          },
          {

            "device_id": "aabbcc000005",
            "key": "wiring_state_d5-dps-pos",
            "value": "off",
            "tag": "wiring_state"
          },
          {

            "device_id": "aabbcc000005",
            "key": "wiring_state_d5-lock-com",
            "value": "on",
            "tag": "wiring_state"
          },
          {

            "device_id": "aabbcc000005",
            "key": "wiring_state_d5-lock-nc",
            "value": "off",
            "tag": "wiring_state"
          },
          {

            "device_id": "aabbcc000005",
            "key": "wiring_state_d5-lock-no",
            "value": "on",
            "tag": "wiring_state"
          },
          {

            "device_id": "aabbcc000005",
            "key": "wiring_state_d5-power-sw",
            "value": "off",
            "tag": "wiring_state"
          },
          {

            "device_id": "aabbcc000005",
            "key": "wiring_state_d6-aux-com",
            "value": "on",
            "tag": "wiring_state"
          },
          {

            "device_id": "aabbcc000005",
            "key": "wiring_state_d6-aux-nc",
            "value": "off",
            "tag": "wiring_state"
          },
          {

            "device_id": "aabbcc000005",
            "key": "wiring_state_d6-aux-no",
            "value": "on",
            "tag": "wiring_state"
          },
          {

            "device_id": "aabbcc000005",
            "key": "wiring_state_d6-button-neg",
            "value": "off",
            "tag": "wiring_state"
          },
          {

            "device_id": "aabbcc000005",
            "key": "wiring_state_d6-button-pos",
            "value": "off",
            "tag": "wiring_state"
          },
          {

            "device_id": "aabbcc000005",
            "key": "wiring_state_d6-dps-neg",
            "value": "off",
            "tag": "wiring_state"
          },
          {

            "device_id": "aabbcc000005",
            "key": "wiring_state_d6-dps-pos",
            "value": "off",
            "tag": "wiring_state"
          },
          {

            "device_id": "aabbcc000005",
            "key": "wiring_state_d6-lock-com",
            "value": "on",
            "tag": "wiring_state"
          },
          {

            "device_id": "aabbcc000005",
            "key": "wiring_state_d6-lock-nc",
            "value": "off",
            "tag": "wiring_state"
          },
          {

            "device_id": "aabbcc000005",
            "key": "wiring_state_d6-lock-no",
            "value": "on",
            "tag": "wiring_state"
          },
          {

            "device_id": "aabbcc000005",
            "key": "wiring_state_d6-power-sw",
            "value": "on",
            "tag": "wiring_state"
          },
          {

            "device_id": "aabbcc000005",
            "key": "wiring_state_d7-aux-com",
            "value": "on",
            "tag": "wiring_state"
          },
          {

            "device_id": "aabbcc000005",
            "key": "wiring_state_d7-aux-nc",
            "value": "off",
            "tag": "wiring_state"
          },
          {

            "device_id": "aabbcc000005",
            "key": "wiring_state_d7-aux-no",
            "value": "on",
            "tag": "wiring_state"
          },
          {

            "device_id": "aabbcc000005",
            "key": "wiring_state_d7-button-neg",
            "value": "off",
            "tag": "wiring_state"
          },
          {

            "device_id": "aabbcc000005",
            "key": "wiring_state_d7-button-pos",
            "value": "off",
            "tag": "wiring_state"
          },
          {

            "device_id": "aabbcc000005",
            "key": "wiring_state_d7-dps-neg",
            "value": "off",
            "tag": "wiring_state"
          },
          {

            "device_id": "aabbcc000005",
            "key": "wiring_state_d7-dps-pos",
            "value": "off",
            "tag": "wiring_state"
          },
          {

            "device_id": "aabbcc000005",
            "key": "wiring_state_d7-lock-com",
            "value": "on",
            "tag": "wiring_state"
          },
          {

            "device_id": "aabbcc000005",
            "key": "wiring_state_d7-lock-nc",
            "value": "off",
            "tag": "wiring_state"
          },
          {

            "device_id": "aabbcc000005",
            "key": "wiring_state_d7-lock-no",
            "value": "on",
            "tag": "wiring_state"
          },
          {

            "device_id": "aabbcc000005",
            "key": "wiring_state_d7-power-sw",
            "value": "on",
            "tag": "wiring_state"
          },
          {

            "device_id": "aabbcc000005",
            "key": "wiring_state_d8-aux-com",
            "value": "off",
            "tag": "wiring_state"
          },
          {

            "device_id": "aabbcc000005",
            "key": "wiring_state_d8-aux-nc",
            "value": "off",
            "tag": "wiring_state"
          },
          {

            "device_id": "aabbcc000005",
            "key": "wiring_state_d8-aux-no",
            "value": "off",
            "tag": "wiring_state"
          },
          {

            "device_id": "aabbcc000005",
            "key": "wiring_state_d8-button-neg",
            "value": "off",
            "tag": "wiring_state"
          },
          {

            "device_id": "aabbcc000005",
            "key": "wiring_state_d8-button-pos",
            "value": "off",
            "tag": "wiring_state"
          },
          {

            "device_id": "aabbcc000005",
            "key": "wiring_state_d8-dps-neg",
            "value": "off",
            "tag": "wiring_state"
          },
          {

            "device_id": "aabbcc000005",
            "key": "wiring_state_d8-dps-pos",
            "value": "off",
            "tag": "wiring_state"
          },
          {

            "device_id": "aabbcc000005",
            "key": "wiring_state_d8-lock-com",
            "value": "off",
            "tag": "wiring_state"
          },
          {

            "device_id": "aabbcc000005",
            "key": "wiring_state_d8-lock-nc",
            "value": "off",
            "tag": "wiring_state"
          },
          {

            "device_id": "aabbcc000005",
            "key": "wiring_state_d8-lock-no",
            "value": "off",
            "tag": "wiring_state"
          },
          {

            "device_id": "aabbcc000005",
            "key": "wiring_state_d8-power-sw",
            "value": "off",
            "tag": "wiring_state"
          },
          {

            "device_id": "aabbcc000005",
            "key": "wiring_state_emer-neg",
            "value": "off",
            "tag": "wiring_state"
          },
          {

            "device_id": "aabbcc000005",
            "key": "wiring_state_emer-pos",
            "value": "off",
            "tag": "wiring_state"
          },
          {

            "device_id": "aabbcc000005",
            "key": "wiring_state_poe-p1",
            "value": "on",
            "tag": "wiring_state"
          },
          {

            "device_id": "aabbcc000005",
            "key": "wiring_state_poe-p10",
            "value": "off",
            "tag": "wiring_state"
          },
          {

            "device_id": "aabbcc000005",
            "key": "wiring_state_poe-p2",
            "value": "on",
            "tag": "wiring_state"
          },
          {

            "device_id": "aabbcc000005",
            "key": "wiring_state_poe-p3",
            "value": "on",
            "tag": "wiring_state"
          },
          {

            "device_id": "aabbcc000005",
            "key": "wiring_state_poe-p4",
            "value": "off",
            "tag": "wiring_state"
          },
          {

            "device_id": "aabbcc000005",
            "key": "wiring_state_poe-p5",
            "value": "off",
            "tag": "wiring_state"
          },
          {

            "device_id": "aabbcc000005",
            "key": "wiring_state_poe-p6",
            "value": "off",
            "tag": "wiring_state"
          },
          {

            "device_id": "aabbcc000005",
            "key": "wiring_state_poe-p7",
            "value": "off",
            "tag": "wiring_state"
          },
          {

            "device_id": "aabbcc000005",
            "key": "wiring_state_poe-p8",
            "value": "off",
            "tag": "wiring_state"
          },
          {

            "device_id": "aabbcc000005",
            "key": "wiring_state_poe-p9",
            "value": "on",
            "tag": "wiring_state"
          }
        ],
        "update_manual": {

          "device_version_upgrade_status": {

            "completed": false,
            "is_waiting": false,
            "is_upgrading": false,
            "upgrade_seconds": 0,
            "timed_out": false,
            "failed": false,
            "failure_reason": "",
            "is_downloading": false
          },
          "from_version": "",
          "last_upgrade_start_time": null,
          "last_upgrade_success": null,
          "last_upgrade_failure_reason": ""
        },
        "capabilities": [
          "pin_code",
          "dps_alarm",
          "input_mode_switch",
          "aux_alarm",
          "aux_delay_time",
          "hold_time_0.1s",
          "lock_relay_report",
          "ssh_change",
          "door_bell",
          "multi_unlock_schedule",
          "support_ui_account",
          "aux_option_change",
          "is_hub",
          "identity_is_hub",
          "support_upgrade_by_url",
          "incremental_update_setting",
          "emergency_reverse",
          "mobile_unlock_ver2",
          "unlock_time_period_v2"
        ],
        "extensions": [
          {

            "unique_id": "00000000-0000-0000-0000-00000000002a",
            "device_id": "aabbcc000005",
            "extension_name": "port_setting",
            "source_id": "port2",
            "target_type": "door",
            "target_value": "00000000-0000-0000-0000-000000000013",
            "target_name": "Test Name 29",
            "target_config": [
              {

                "config_tag": "device_setting",
                "config_key": "lock_unlock_time",
                "config_value": 5
              },
              {

                "config_tag": "device_setting",
                "config_key": "dps_reverse",
                "config_value": false
              },
              {

                "config_tag": "device_setting",
                "config_key": "button_reverse",
                "config_value": false
              },
              {

                "config_tag": "device_setting",
                "config_key": "button_mode",
                "config_value": "push"
              },
              {

                "config_tag": "device_setting",
                "config_key": "aux_mode",
                "config_value": "opener"
              },
              {

                "config_tag": "device_setting",
                "config_key": "bell_time",
                "config_value": 0.5
              },
              {

                "config_tag": "device_setting",
                "config_key": "siren_leadtime",
                "config_value": 60
              },
              {

                "config_tag": "device_setting",
                "config_key": "aux_unlock_time",
                "config_value": 0.5
              },
              {

                "config_tag": "device_setting",
                "config_key": "aux_delay_unlock_time",
                "config_value": 0.1
              },
              {

                "config_tag": "device_setting",
                "config_key": "lock_type",
                "config_value": ""
              },
              {

                "config_tag": "device_setting",
                "config_key": "lock_end_time",
                "config_value": "0"
              }
            ]
          },
          {

            "unique_id": "00000000-0000-0000-0000-00000000002b",
            "device_id": "aabbcc000005",
            "extension_name": "port_setting",
            "source_id": "port6",
            "target_type": "door",
            "target_value": "00000000-0000-0000-0000-000000000027",
            "target_name": "Test Name 54",
            "target_config": [
              {

                "config_tag": "device_setting",
                "config_key": "lock_unlock_time",
                "config_value": 5
              },
              {

                "config_tag": "device_setting",
                "config_key": "dps_reverse",
                "config_value": false
              },
              {

                "config_tag": "device_setting",
                "config_key": "button_reverse",
                "config_value": false
              },
              {

                "config_tag": "device_setting",
                "config_key": "button_mode",
                "config_value": "push"
              },
              {

                "config_tag": "device_setting",
                "config_key": "aux_mode",
                "config_value": "opener"
              },
              {

                "config_tag": "device_setting",
                "config_key": "bell_time",
                "config_value": 0.5
              },
              {

                "config_tag": "device_setting",
                "config_key": "siren_leadtime",
                "config_value": 60
              },
              {

                "config_tag": "device_setting",
                "config_key": "aux_unlock_time",
                "config_value": 2
              },
              {

                "config_tag": "device_setting",
                "config_key": "aux_delay_unlock_time",
                "config_value": 0
              },
              {

                "config_tag": "device_setting",
                "config_key": "lock_type",
                "config_value": ""
              },
              {

                "config_tag": "device_setting",
                "config_key": "lock_end_time",
                "config_value": "0"
              }
            ]
          },
          {

            "unique_id": "00000000-0000-0000-0000-00000000002c",
            "device_id": "aabbcc000005",
            "extension_name": "port_setting",
            "source_id": "port3",
            "target_type": "door",
            "target_value": "00000000-0000-0000-0000-000000000014",
            "target_name": "Test Name 31",
            "target_config": [
              {

                "config_tag": "device_setting",
                "config_key": "lock_unlock_time",
                "config_value": 5
              },
              {

                "config_tag": "device_setting",
                "config_key": "dps_reverse",
                "config_value": false
              },
              {

                "config_tag": "device_setting",
                "config_key": "button_reverse",
                "config_value": false
              },
              {

                "config_tag": "device_setting",
                "config_key": "button_mode",
                "config_value": "push"
              },
              {

                "config_tag": "device_setting",
                "config_key": "aux_mode",
                "config_value": "opener"
              },
              {

                "config_tag": "device_setting",
                "config_key": "bell_time",
                "config_value": 0.5
              },
              {

                "config_tag": "device_setting",
                "config_key": "siren_leadtime",
                "config_value": 60
              },
              {

                "config_tag": "device_setting",
                "config_key": "aux_unlock_time",
                "config_value": 0.5
              },
              {

                "config_tag": "device_setting",
                "config_key": "aux_delay_unlock_time",
                "config_value": 0.1
              },
              {

                "config_tag": "device_setting",
                "config_key": "lock_type",
                "config_value": ""
              },
              {

                "config_tag": "device_setting",
                "config_key": "lock_end_time",
                "config_value": "0"
              }
            ]
          },
          {

            "unique_id": "00000000-0000-0000-0000-00000000002d",
            "device_id": "aabbcc000005",
            "extension_name": "port_setting",
            "source_id": "port8",
            "target_type": "door",
            "target_value": "00000000-0000-0000-0000-000000000016",
            "target_name": "Test Name 35",
            "target_config": [
              {

                "config_tag": "device_setting",
                "config_key": "lock_unlock_time",
                "config_value": 5
              },
              {

                "config_tag": "device_setting",
                "config_key": "dps_reverse",
                "config_value": false
              },
              {

                "config_tag": "device_setting",
                "config_key": "button_reverse",
                "config_value": false
              },
              {

                "config_tag": "device_setting",
                "config_key": "button_mode",
                "config_value": "push"
              },
              {

                "config_tag": "device_setting",
                "config_key": "aux_mode",
                "config_value": "opener"
              },
              {

                "config_tag": "device_setting",
                "config_key": "bell_time",
                "config_value": 0.5
              },
              {

                "config_tag": "device_setting",
                "config_key": "siren_leadtime",
                "config_value": 60
              },
              {

                "config_tag": "device_setting",
                "config_key": "aux_unlock_time",
                "config_value": 0.5
              },
              {

                "config_tag": "device_setting",
                "config_key": "aux_delay_unlock_time",
                "config_value": 0.1
              },
              {

                "config_tag": "device_setting",
                "config_key": "lock_type",
                "config_value": ""
              },
              {

                "config_tag": "device_setting",
                "config_key": "lock_end_time",
                "config_value": "0"
              }
            ]
          },
          {

            "unique_id": "00000000-0000-0000-0000-00000000002e",
            "device_id": "aabbcc000005",
            "extension_name": "port_setting",
            "source_id": "port1",
            "target_type": "door",
            "target_value": "00000000-0000-0000-0000-000000000028",
            "target_name": "Test Name 58",
            "target_config": [
              {

                "config_tag": "device_setting",
                "config_key": "lock_unlock_time",
                "config_value": 5
              },
              {

                "config_tag": "device_setting",
                "config_key": "dps_reverse",
                "config_value": false
              },
              {

                "config_tag": "device_setting",
                "config_key": "button_reverse",
                "config_value": false
              },
              {

                "config_tag": "device_setting",
                "config_key": "button_mode",
                "config_value": "push"
              },
              {

                "config_tag": "device_setting",
                "config_key": "aux_mode",
                "config_value": "opener"
              },
              {

                "config_tag": "device_setting",
                "config_key": "bell_time",
                "config_value": 0.5
              },
              {

                "config_tag": "device_setting",
                "config_key": "siren_leadtime",
                "config_value": 60
              },
              {

                "config_tag": "device_setting",
                "config_key": "aux_unlock_time",
                "config_value": 0.5
              },
              {

                "config_tag": "device_setting",
                "config_key": "aux_delay_unlock_time",
                "config_value": 0.1
              },
              {

                "config_tag": "device_setting",
                "config_key": "lock_type",
                "config_value": ""
              },
              {

                "config_tag": "device_setting",
                "config_key": "lock_end_time",
                "config_value": "0"
              }
            ]
          },
          {

            "unique_id": "00000000-0000-0000-0000-00000000002f",
            "device_id": "aabbcc000005",
            "extension_name": "port_setting",
            "source_id": "port4",
            "target_type": "door",
            "target_value": "00000000-0000-0000-0000-000000000015",
            "target_name": "Test Name 33",
            "target_config": [
              {

                "config_tag": "device_setting",
                "config_key": "lock_unlock_time",
                "config_value": 5
              },
              {

                "config_tag": "device_setting",
                "config_key": "dps_reverse",
                "config_value": false
              },
              {

                "config_tag": "device_setting",
                "config_key": "button_reverse",
                "config_value": false
              },
              {

                "config_tag": "device_setting",
                "config_key": "button_mode",
                "config_value": "push"
              },
              {

                "config_tag": "device_setting",
                "config_key": "aux_mode",
                "config_value": "opener"
              },
              {

                "config_tag": "device_setting",
                "config_key": "bell_time",
                "config_value": 0.5
              },
              {

                "config_tag": "device_setting",
                "config_key": "siren_leadtime",
                "config_value": 60
              },
              {

                "config_tag": "device_setting",
                "config_key": "aux_unlock_time",
                "config_value": 0.5
              },
              {

                "config_tag": "device_setting",
                "config_key": "aux_delay_unlock_time",
                "config_value": 0.1
              },
              {

                "config_tag": "device_setting",
                "config_key": "lock_type",
                "config_value": ""
              },
              {

                "config_tag": "device_setting",
                "config_key": "lock_end_time",
                "config_value": "0"
              }
            ]
          },
          {

            "unique_id": "00000000-0000-0000-0000-000000000030",
            "device_id": "aabbcc000005",
            "extension_name": "port_setting",
            "source_id": "port7",
            "target_type": "door",
            "target_value": "00000000-0000-0000-0000-000000000025",
            "target_name": "Test Name 50",
            "target_config": [
              {

                "config_tag": "device_setting",
                "config_key": "lock_unlock_time",
                "config_value": 5
              },
              {

                "config_tag": "device_setting",
                "config_key": "dps_reverse",
                "config_value": false
              },
              {

                "config_tag": "device_setting",
                "config_key": "button_reverse",
                "config_value": false
              },
              {

                "config_tag": "device_setting",
                "config_key": "button_mode",
                "config_value": "push"
              },
              {

                "config_tag": "device_setting",
                "config_key": "aux_mode",
                "config_value": "opener"
              },
              {

                "config_tag": "device_setting",
                "config_key": "bell_time",
                "config_value": 0.5
              },
              {

                "config_tag": "device_setting",
                "config_key": "siren_leadtime",
                "config_value": 60
              },
              {

                "config_tag": "device_setting",
                "config_key": "aux_unlock_time",
                "config_value": 2
              },
              {

                "config_tag": "device_setting",
                "config_key": "aux_delay_unlock_time",
                "config_value": 0
              },
              {

                "config_tag": "device_setting",
                "config_key": "lock_type",
                "config_value": ""
              },
              {

                "config_tag": "device_setting",
                "config_key": "lock_end_time",
                "config_value": "0"
              }
            ]
          },
          {

            "unique_id": "00000000-0000-0000-0000-000000000031",
            "device_id": "aabbcc000005",
            "extension_name": "port_setting",
            "source_id": "port5",
            "target_type": "door",
            "target_value": "00000000-0000-0000-0000-000000000017",
            "target_name": "Test Name 37",
            "target_config": [
              {

                "config_tag": "device_setting",
                "config_key": "lock_unlock_time",
                "config_value": 5
              },
              {

                "config_tag": "device_setting",
                "config_key": "dps_reverse",
                "config_value": false
              },
              {

                "config_tag": "device_setting",
                "config_key": "button_reverse",
                "config_value": false
              },
              {

                "config_tag": "device_setting",
                "config_key": "button_mode",
                "config_value": "push"
              },
              {

                "config_tag": "device_setting",
                "config_key": "aux_mode",
                "config_value": "opener"
              },
              {

                "config_tag": "device_setting",
                "config_key": "bell_time",
                "config_value": 0.5
              },
              {

                "config_tag": "device_setting",
                "config_key": "siren_leadtime",
                "config_value": 60
              },
              {

                "config_tag": "device_setting",
                "config_key": "aux_unlock_time",
                "config_value": 2
              },
              {

                "config_tag": "device_setting",
                "config_key": "aux_delay_unlock_time",
                "config_value": 0
              },
              {

                "config_tag": "device_setting",
                "config_key": "lock_type",
                "config_value": "schedule"
              },
              {

                "config_tag": "device_setting",
                "config_key": "lock_end_time",
                "config_value": "1727914559"
              },
              {

                "config_tag": "device_setting",
                "config_key": "unlock_time_period",
                "config_value": "1727732477/1727736077"
              },
              {

                "config_tag": "device_setting",
                "config_key": "temp_lock_type",
                "config_value": "custom"
              },
              {

                "config_tag": "device_setting",
                "config_key": "disable_unlock_schedule",
                "config_value": ""
              }
            ]
          }
        ],
        "images": {

          "xs": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-000000000068_25x25.png",
          "s": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-000000000068_32x32.png",
          "m": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-000000000068_51x51.png",
          "l": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-000000000068_64x64.png",
          "xl": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-000000000068_101x101.png",
          "xxl": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-000000000068_128x128.png",
          "base": "icons/00000000-0000-0000-0000-000000000068_257x257.png"
        }
      }
    ]
  ]
};

/* The controller's own information document, the second of the two documents one refresh pass fetches. It describes the controller and the UniFi OS host it runs
 * on rather than the hardware below it, which is why it is a separate document from the topology above and why the two reconcile independently: the host's uptime
 * advances with elapsed time, so this document is expected to differ on every genuine fetch where a drift-free topology document is expected not to.
 *
 * Captured from a live controller, 2026.
 */
export const accessControllerInfoFixture: AccessControllerConfig = {

  "configured": true,
  "version": "v4.3.3+12030",
  "ulp_version": "v1.13.10+6128",
  "protect_version": "v7.1.87",
  "host": {

    "device_type": "UNVRAI8",
    "hostname": "host-2.test.local",
    "mac": "aa:bb:cc:00:00:0f",
    "firmware_version": "5.1.25",
    "release_channel": "release",
    "time_zone": "Etc/UTC",
    "shortname": "Test shortname 63",
    "ip": "192.0.2.12",
    "wan_ip": "192.0.2.12",
    "gateway_ip": "192.0.2.12",
    "uptime": 990090.84
  },
  "disabled_by_uid": false,
  "adopted_by_uid": false,
  "adopted_by_ucs": false,
  "user_assets_available": true,
  "uid_access_portal": "",
  "capabilities": [
    "pin_code",
    "hotel_lock",
    "uid:management",
    "uid:webrtc",
    "qr_code",
    "receiver:normal_user",
    "access_detect_zone",
    "visitor_lpr",
    "device:stats",
    "pin_code_variable_length",
    "device:thumbnail_in_bytes",
    "support_greeting",
    "support_lock_now",
    "camera_live_stream",
    "support_face_register_session",
    "support_default_policy"
  ],
  "ulp_capabilities": [
    "onboard_time",
    "remote_call",
    "custom_role",
    "simple_user_list",
    "door_guard",
    "system_log_setting",
    "active_uid_user",
    "identity_standard",
    "open_api",
    "support_user_email",
    "service_status_mgnt",
    "jsonrpc_heart",
    "agent_in_ulp",
    "all_users",
    "identity_mobile_tap",
    "disable_manifest_check",
    "mobile_unlock_ver2",
    "identity_status_update",
    "support_identity_user_doorbell",
    "bulk_send_identity_invitation_emails",
    "validate_user_param",
    "search_active_uid_user",
    "support_apple_pass",
    "support_systemLog_search",
    "support_systemLog_search_by_cache",
    "assign_location_to_door_guard",
    "support_new_systemLog_search",
    "support_systemLog_search_by_category",
    "support_reupload_photo"
  ],
  "ucore_capabilities": [
    "remote_view",
    "remote_call",
    "identity_standard",
    "support_ems",
    "support_identity_user_doorbell",
    "support_playback",
    "support_playback_export"
  ],
  "protect_capabilities": [
    "support_nfc",
    "smart_zone_source",
    "show_readers",
    "report_event_id",
    "recording_24_7"
  ],
  "uid_capabilities": [
    "support_kua",
    "support_enterprise",
    "support_sync_health",
    "support_update_floor",
    "support_elevator",
    "support_doorbell_bind",
    "elevator_unlock_schedule",
    "elevator_in_door_group",
    "access_thumbnail_report",
    "support_enterprise_caller_receiver",
    "assign_location_to_door_guard",
    "support_kua_call_flow"
  ],
  "ucs_capabilities": [
    "support_global_settings"
  ],
  "ulp_features": [
    "supportFeatures",
    "userConsolidationViaGlobalFunc",
    "identityCertificateDistribution",
    "userConsolidation",
    "assignmentFlags",
    "fetchServiceStatusFromAccess",
    "driveUIComponentForUserConsolidation",
    "upgradeUcs",
    "upgradeUcsAgentBeforeAdoption",
    "supportAPIGetUcsUpdateConfig",
    "supportAPIKeysMigration",
    "supportAPIUcsSetupState",
    "supportUserDelegateAuthOnDrivePortal",
    "supportCsvImportAccessCredentials",
    "supportProtectGranularPermissions",
    "supportRadiusULPUserIdProvisioning",
    "apiIntegration"
  ],
  "support_qr_code": true,
  "support_license_plate": true,
  "has_support_lpr_device": true,
  "has_support_fingerprint_device": false,
  "root_user_group": {

    "unique_id": "00000000-0000-0000-0000-000000000032",
    "name": "Test Name 1",
    "up_id": "",
    "up_ids": [],
    "system_name": "Test system_name 64",
    "create_time": "2024-12-06T19:05:28-06:00"
  },
  "has_door_group": false,
  "has_top_log": 0,
  "ui_cdn": "https://host-3.test.local/unifi-access-ui/4.3.2-6534-840cb4b7b1",
  "bt_config_revision": 1785615849,
  "user_bt_revision": 1785615848,
  "agent_info": {

    "token_valid": false,
    "mqtt_connected": false,
    "controller_id": "",
    "company_name": "",
    "company_logo": "",
    "company_id": "",
    "site_info": null,
    "admin_portal": null,
    "current_admin_portal": null,
    "endpoints": {

      "api": "",
      "admin": "",
      "core-login": "",
      "cell_name": ""
    },
    "is_workspace_consistent": true,
    "is_kua": false,
    "is_running": false,
    "is_setup": true,
    "is_install": true,
    "is_migrating": false,
    "software_version": "1.61.5+3313",
    "is_access_kua": false,
    "configured": false,
    "host_device_id": ""
  },
  "uid_adopt_info": null,
  "show_viewer_attendant": false,
  "identity_standard_enable": true,
  "support_apple_pass": true,
  "support_google_pass": true,
  "support_easy_provision": true,
  "face_sdk": true,
  "support_twilio_sip": true,
  "system_log_cache_topic": [
    "door_unlocks",
    "access_denial",
    "critical",
    "ring",
    "updates",
    "admin_activity",
    "unlocks",
    "rings",
    "admin"
  ],
  "support_callflow": true,
  "support_assign_location_to_door_guard": true,
  "remote_access_enabled": true,
  "feature_flags": [
    "supportMspPlayback",
    "supportKioskMode",
    "supportKioskVisitorCreation",
    "supportKuaCallFlow"
  ],
  "support_alarm_manager": true,
  "prompt_upgrade_devcie_for_easy_provision": false,
  "critical_logs": [],
  "should_reupload_photo": false,
  "ucs_feature": [],
  "is_fingerprint_disabled": false
};

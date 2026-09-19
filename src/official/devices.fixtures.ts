/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * devices.fixtures.ts: The official API's device and door listings, captured from a live controller and embedded verbatim.
 *
 * The controller document the topology fixtures carry was captured on 2026-08-13 and reported UniFi Access v4.3.3+12030, and every capture in this file comes from
 * that controller. Beyond the v1 in the developer API's path, the payloads carry no schema version of their own, so that application version is what a recapture
 * is compared against.
 */
import type { AccessOfficialDevice } from "./devices.ts";
import type { AccessOfficialDoor } from "./spaces.ts";

/* One `GET /devices` payload exactly as the controller answered it, declared against the listing type so the suite type-checks the projection against real wire
 * material rather than against a restatement of itself. Nothing here is tidied: key order, casing, and the full capability vocabulary are the controller's own.
 *
 * The nesting is the payload's own. The endpoint groups devices by the door they serve, and every device in a group carries that group's door in `location_id`, so
 * the grouping is recoverable from the records themselves and flattening loses nothing. The groups are keyed by the same doors of the same controller the topology
 * fixtures describe for this capture, which is what lets the identity assertions run across both censuses of one site.
 *
 * The set covers what the projection has to get right: a hub describing itself with an empty `connected_uah_id`, a hub naming its own identifier there, readers
 * naming their hub, an offline device, an unadopted one, and an empty `alias` beside a populated one.
 *
 * Captured from a live controller, 2026-08-15.
 */
export const accessOfficialDevicesFixture: readonly AccessOfficialDevice[][] = [

  [
    {

      "alias": "Test alias 13",
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
      "connected_uah_id": "",
      "id": "aabbcc000001",
      "is_adopted": true,
      "is_connected": true,
      "is_managed": true,
      "is_online": true,
      "location_id": "00000000-0000-0000-0000-000000000006",
      "name": "Test Name 76",
      "type": "UAH"
    },
    {

      "alias": "",
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
      "connected_uah_id": "aabbcc000001",
      "id": "aabbcc000002",
      "is_adopted": true,
      "is_connected": true,
      "is_managed": true,
      "is_online": true,
      "location_id": "00000000-0000-0000-0000-000000000006",
      "name": "Test Name 68",
      "type": "UA-G2-PRO"
    },
    {

      "alias": "",
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
      "connected_uah_id": "aabbcc000001",
      "id": "aabbcc000003",
      "is_adopted": true,
      "is_connected": false,
      "is_managed": true,
      "is_online": false,
      "location_id": "00000000-0000-0000-0000-000000000006",
      "name": "Test Name 20",
      "type": "UA-G2-MINI"
    }
  ],
  [
    {

      "alias": "Test alias 7",
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
      "connected_uah_id": "aabbcc000000",
      "id": "aabbcc000000",
      "is_adopted": false,
      "is_connected": false,
      "is_managed": true,
      "is_online": false,
      "location_id": "00000000-0000-0000-0000-000000000002",
      "name": "Test Name 6",
      "type": "UA-ULTRA"
    }
  ],
  [
    {

      "alias": "Test alias 25",
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
        "power_state",
        "double_badge",
        "unlock_suspend",
        "any_auth_type",
        "location_state"
      ],
      "connected_uah_id": "",
      "id": "aabbcc000004",
      "is_adopted": true,
      "is_connected": true,
      "is_managed": true,
      "is_online": true,
      "location_id": "00000000-0000-0000-0000-00000000000e",
      "name": "Test Name 24",
      "type": "UA-Hub-Door-Mini"
    }
  ]
];


/* The `GET /doors` payload from the same controller and the same capture window, embedded on the same terms. The three doors are the three the device listing's
 * groups are keyed by, and their `floor_id` is the one floor the topology fixtures place them on.
 *
 * The positions differ across the set - two open doors and one reporting none - and one door carries the extras a UA Hub populates while the other two send an
 * empty object, which is the spread the door-state projection is measured against.
 *
 * Captured from a live controller, 2026-08-15.
 */
export const accessOfficialDoorsFixture: readonly AccessOfficialDoor[] = [

  {

    "door_lock_relay_status": "lock",
    "door_position_status": "open",
    "extras": {},
    "floor_id": "00000000-0000-0000-0000-000000000001",
    "full_name": "Test Name 23",
    "id": "00000000-0000-0000-0000-00000000000e",
    "is_bind_hub": true,
    "name": "Test Name 22",
    "type": "door"
  },
  {

    "door_lock_relay_status": "lock",
    "door_position_status": "open",
    "extras": {},
    "floor_id": "00000000-0000-0000-0000-000000000001",
    "full_name": "Test Name 5",
    "id": "00000000-0000-0000-0000-000000000002",
    "is_bind_hub": true,
    "name": "Test Name 4",
    "type": "door"
  },
  {

    "door_lock_relay_status": "lock",
    "door_position_status": "none",
    "extras": {

      "door_thumbnail": "REDACTED-0000002b-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      "door_thumbnail_last_update": 1786822236,
      "uah-input_state_dps": "off",
      "uah-wiring_state_dps-neg": "off",
      "uah-wiring_state_dps-pos": "off"
    },
    "floor_id": "00000000-0000-0000-0000-000000000001",
    "full_name": "Test Name 11",
    "id": "00000000-0000-0000-0000-000000000006",
    "is_bind_hub": true,
    "name": "Test Name 10",
    "type": "door"
  }
];

[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessControllerSettingsConfigInterface

# Interface: AccessControllerSettingsConfigInterface

A semi-complete description of the UniFi Access controller settings JSON.

Several members are string-encoded rather than typed as the booleans or numbers they read as - `face_anti_spoofing_enable_v2` arrives as `"no"` alongside genuine
JSON booleans, and the rate limits arrive as patterns like `"5-count/10-seconds"`. These are typed as the strings the controller actually sends, so a consumer parses
them rather than being handed a type that quietly disagrees with the wire.

## Indexable

```ts
[key: string]: AccessKnownJsonValue
```

## Properties

| Property | Type |
| ------ | ------ |
| <a id="agreed_terms"></a> `agreed_terms` | `boolean` |
| <a id="all_kiosk_mode_count"></a> `all_kiosk_mode_count` | `number` |
| <a id="allow_storing_face_photo"></a> `allow_storing_face_photo` | `boolean` |
| <a id="allow_storing_face_photo_for_uid"></a> `allow_storing_face_photo_for_uid` | `boolean` |
| <a id="allow_third_party_nfc_cards"></a> `allow_third_party_nfc_cards` | `boolean` |
| <a id="allow_user_to_upload_face_photo_for_uid"></a> `allow_user_to_upload_face_photo_for_uid` | `boolean` |
| <a id="auto_update_device"></a> `auto_update_device` | `boolean` |
| <a id="auto_update_device_time"></a> `auto_update_device_time` | `number` |
| <a id="capture_enable"></a> `capture_enable` | `boolean` |
| <a id="capture_record_seconds"></a> `capture_record_seconds` | `number` |
| <a id="capture_save_minute"></a> `capture_save_minute` | `number` |
| <a id="capture_time_purge"></a> `capture_time_purge` | `boolean` |
| <a id="card_format"></a> `card_format` | `string` |
| <a id="controller_ip"></a> `controller_ip` | `string` |
| <a id="dial_key"></a> `dial_key` | \{ `answer_key`: `string`; `unlock_key`: `string`; \} |
| `dial_key.answer_key` | `string` |
| `dial_key.unlock_key` | `string` |
| <a id="disabled_live_view_for_clients"></a> `disabled_live_view_for_clients` | `AccessKnownJsonValue`[] |
| <a id="discovery_broadcast_ips"></a> `discovery_broadcast_ips` | `string`[] |
| <a id="door_bell_ring_expire_second"></a> `door_bell_ring_expire_second` | `number` |
| <a id="door_method_config"></a> `door_method_config` | \{ `lite_door_method`: `AccessKnownJsonValue`[]; `mobile_door_method`: `AccessKnownJsonValue`[]; `pro_door_method`: `AccessKnownJsonValue`[]; \} |
| `door_method_config.lite_door_method` | `AccessKnownJsonValue`[] |
| `door_method_config.mobile_door_method` | `AccessKnownJsonValue`[] |
| `door_method_config.pro_door_method` | `AccessKnownJsonValue`[] |
| <a id="enable_express_mode"></a> `enable_express_mode` | `boolean` |
| <a id="enable_flexiable_schedule"></a> `enable_flexiable_schedule` | `boolean` |
| <a id="enable_kiosk_mode_count"></a> `enable_kiosk_mode_count` | `number` |
| <a id="enable_local_user_credential_manage"></a> `enable_local_user_credential_manage` | `boolean` |
| <a id="enable_recording_in_protect"></a> `enable_recording_in_protect` | `boolean` |
| <a id="enable_visitor_mgnt_from_identity_app"></a> `enable_visitor_mgnt_from_identity_app` | `boolean` |
| <a id="enbale_user_remote_unlock"></a> `enbale_user_remote_unlock` | `boolean` |
| <a id="entry_greet"></a> `entry_greet` | `string` |
| <a id="entry_salutation"></a> `entry_salutation` | `string` |
| <a id="evacuation"></a> `evacuation` | `boolean` |
| <a id="exit_greet"></a> `exit_greet` | `string` |
| <a id="exit_salutation"></a> `exit_salutation` | `string` |
| <a id="express_mode_device_ids"></a> `express_mode_device_ids` | `AccessKnownJsonValue`[] |
| <a id="face_anti_spoofing_device_ids"></a> `face_anti_spoofing_device_ids` | `AccessKnownJsonValue`[] |
| <a id="face_anti_spoofing_enable_v2"></a> `face_anti_spoofing_enable_v2` | `string` |
| <a id="face_anti_spoofing_level"></a> `face_anti_spoofing_level` | `string` |
| <a id="face_detect_distance"></a> `face_detect_distance` | `string` |
| <a id="face_detect_threshold"></a> `face_detect_threshold` | `string` |
| <a id="face_enable"></a> `face_enable` | `boolean` |
| <a id="face_enable_for_uid"></a> `face_enable_for_uid` | `boolean` |
| <a id="face_error_code"></a> `face_error_code` | `Nullable`\<`AccessKnownJsonValue`\> |
| <a id="face_limit"></a> `face_limit` | `string` |
| <a id="has_capture_resource"></a> `has_capture_resource` | `boolean` |
| <a id="has_ea_device"></a> `has_ea_device` | `boolean` |
| <a id="has_hdd_exist"></a> `has_hdd_exist` | `boolean` |
| <a id="has_low_device_version"></a> `has_low_device_version` | `boolean` |
| <a id="has_user_used_id_card"></a> `has_user_used_id_card` | `boolean` |
| <a id="is_gateway"></a> `is_gateway` | `boolean` |
| <a id="language"></a> `language` | `string` |
| <a id="language_device"></a> `language_device` | `string` |
| <a id="live_view_timeout_for_doorbell"></a> `live_view_timeout_for_doorbell` | `number` |
| <a id="lockdown"></a> `lockdown` | `boolean` |
| <a id="mgnt_network"></a> `mgnt_network` | \{ `broadcast_ip`: `string`; `broadcast_ips`: `string`[]; `gateway_ip`: `string`; `id`: `string`; `ip_subnet`: `string`; `ip_subnets`: `string`[]; `is_any_networks`: `boolean`; `is_primary`: `boolean`; `name`: `string`; `vlan`: `string`; \} |
| `mgnt_network.broadcast_ip` | `string` |
| `mgnt_network.broadcast_ips` | `string`[] |
| `mgnt_network.gateway_ip` | `string` |
| `mgnt_network.id` | `string` |
| `mgnt_network.ip_subnet` | `string` |
| `mgnt_network.ip_subnets` | `string`[] |
| `mgnt_network.is_any_networks` | `boolean` |
| `mgnt_network.is_primary` | `boolean` |
| `mgnt_network.name` | `string` |
| `mgnt_network.vlan` | `string` |
| <a id="mngt_network_id"></a> `mngt_network_id` | `string` |
| <a id="nfc_limit"></a> `nfc_limit` | `string` |
| <a id="notify_to_admin"></a> `notify_to_admin` | `boolean` |
| <a id="pin_code_length"></a> `pin_code_length` | `number` |
| <a id="pin_code_length_range"></a> `pin_code_length_range` | `string` |
| <a id="pin_code_length_type"></a> `pin_code_length_type` | `string` |
| <a id="pin_code_shuffle"></a> `pin_code_shuffle` | `boolean` |
| <a id="pin_code_strong"></a> `pin_code_strong` | `boolean` |
| <a id="pin_limit"></a> `pin_limit` | `string` |
| <a id="pro_remote_channel"></a> `pro_remote_channel` | `Nullable`\<`AccessKnownJsonValue`\> |
| <a id="record_audio"></a> `record_audio` | `boolean` |
| <a id="show_card_format_setting"></a> `show_card_format_setting` | `boolean` |
| <a id="show_entry_greet"></a> `show_entry_greet` | `boolean` |
| <a id="show_exit_greet"></a> `show_exit_greet` | `boolean` |
| <a id="show_face_early_access_label"></a> `show_face_early_access_label` | `boolean` |
| <a id="show_free_card_tips"></a> `show_free_card_tips` | `boolean` |
| <a id="show_old_ui"></a> `show_old_ui` | `boolean` |
| <a id="show_recording_in_protect"></a> `show_recording_in_protect` | `boolean` |
| <a id="show_wave"></a> `show_wave` | `boolean` |
| <a id="support_ble_bridge"></a> `support_ble_bridge` | `boolean` |
| <a id="support_change_pin_length"></a> `support_change_pin_length` | `boolean` |
| <a id="support_face_device_ids"></a> `support_face_device_ids` | `string`[] |
| <a id="support_face_devices"></a> `support_face_devices` | `number` |
| <a id="support_face_feature"></a> `support_face_feature` | `boolean` |
| <a id="support_wallet_nfc_devices"></a> `support_wallet_nfc_devices` | `number` |
| <a id="time_format"></a> `time_format` | `number` |
| <a id="touch_pass_count"></a> `touch_pass_count` | `number` |
| <a id="uda_pro_capture_tof_enable"></a> `uda_pro_capture_tof_enable` | `boolean` |
| <a id="uda_pro_live_view_timeout"></a> `uda_pro_live_view_timeout` | `number` |
| <a id="uda_pro_tof_trigger_value"></a> `uda_pro_tof_trigger_value` | `number` |
| <a id="unlock_failure_limit"></a> `unlock_failure_limit` | `boolean` |
| <a id="update_channel"></a> `update_channel` | `string` |

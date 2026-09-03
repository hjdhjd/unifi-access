[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessControllerConfigInterface

# Interface: AccessControllerConfigInterface

A semi-complete description of the UniFi Access controller JSON.

## Indexable

```ts
[key: string]: AccessKnownJsonValue
```

## Properties

| Property | Type |
| ------ | ------ |
| <a id="adopted_by_ucs"></a> `adopted_by_ucs` | `boolean` |
| <a id="adopted_by_uid"></a> `adopted_by_uid` | `boolean` |
| <a id="agent_info"></a> `agent_info` | \{ `admin_portal`: `Nullable`\<`string`\>; `company_id`: `string`; `company_logo`: `string`; `company_name`: `string`; `configured`: `boolean`; `controller_id`: `string`; `current_admin_portal`: `Nullable`\<`string`\>; `endpoints`: \{ `admin`: `string`; `api`: `string`; `cell_name`: `string`; `core-login`: `string`; \}; `host_device_id`: `string`; `is_access_kua`: `boolean`; `is_install`: `boolean`; `is_kua`: `boolean`; `is_migrating`: `boolean`; `is_running`: `boolean`; `is_setup`: `boolean`; `is_workspace_consistent`: `boolean`; `mqtt_connected`: `boolean`; `site_info`: `Nullable`\<`string`\>; `software_version`: `string`; `token_valid`: `boolean`; \} |
| `agent_info.admin_portal` | `Nullable`\<`string`\> |
| `agent_info.company_id` | `string` |
| `agent_info.company_logo` | `string` |
| `agent_info.company_name` | `string` |
| `agent_info.configured` | `boolean` |
| `agent_info.controller_id` | `string` |
| `agent_info.current_admin_portal` | `Nullable`\<`string`\> |
| `agent_info.endpoints` | \{ `admin`: `string`; `api`: `string`; `cell_name`: `string`; `core-login`: `string`; \} |
| `agent_info.endpoints.admin` | `string` |
| `agent_info.endpoints.api` | `string` |
| `agent_info.endpoints.cell_name` | `string` |
| `agent_info.endpoints.core-login` | `string` |
| `agent_info.host_device_id` | `string` |
| `agent_info.is_access_kua` | `boolean` |
| `agent_info.is_install` | `boolean` |
| `agent_info.is_kua` | `boolean` |
| `agent_info.is_migrating` | `boolean` |
| `agent_info.is_running` | `boolean` |
| `agent_info.is_setup` | `boolean` |
| `agent_info.is_workspace_consistent` | `boolean` |
| `agent_info.mqtt_connected` | `boolean` |
| `agent_info.site_info` | `Nullable`\<`string`\> |
| `agent_info.software_version` | `string` |
| `agent_info.token_valid` | `boolean` |
| <a id="bt_config_revision"></a> `bt_config_revision` | `number` |
| <a id="capabilities"></a> `capabilities` | `string`[] |
| <a id="configured"></a> `configured` | `boolean` |
| <a id="critical_logs"></a> `critical_logs` | `AccessKnownJsonValue`[] |
| <a id="disabled_by_uid"></a> `disabled_by_uid` | `boolean` |
| <a id="face_sdk"></a> `face_sdk` | `boolean` |
| <a id="feature_flags"></a> `feature_flags` | `string`[] |
| <a id="has_door_group"></a> `has_door_group` | `boolean` |
| <a id="has_support_fingerprint_device"></a> `has_support_fingerprint_device` | `boolean` |
| <a id="has_support_lpr_device"></a> `has_support_lpr_device` | `boolean` |
| <a id="has_top_log"></a> `has_top_log` | `number` |
| <a id="host"></a> `host` | \{ `device_type`: `string`; `firmware_version`: `string`; `gateway_ip`: `string`; `hostname`: `string`; `ip`: `string`; `mac`: `string`; `release_channel`: `string`; `shortname`: `string`; `time_zone`: `string`; `uptime`: `number`; `wan_ip`: `string`; \} |
| `host.device_type` | `string` |
| `host.firmware_version` | `string` |
| `host.gateway_ip` | `string` |
| `host.hostname` | `string` |
| `host.ip` | `string` |
| `host.mac` | `string` |
| `host.release_channel` | `string` |
| `host.shortname` | `string` |
| `host.time_zone` | `string` |
| `host.uptime` | `number` |
| `host.wan_ip` | `string` |
| <a id="identity_standard_enable"></a> `identity_standard_enable` | `boolean` |
| <a id="is_fingerprint_disabled"></a> `is_fingerprint_disabled` | `boolean` |
| <a id="prompt_upgrade_devcie_for_easy_provision"></a> `prompt_upgrade_devcie_for_easy_provision` | `boolean` |
| <a id="protect_capabilities"></a> `protect_capabilities` | `string`[] |
| <a id="protect_version"></a> `protect_version` | `string` |
| <a id="remote_access_enabled"></a> `remote_access_enabled` | `boolean` |
| <a id="root_user_group"></a> `root_user_group` | \{ `create_time`: `string`; `name`: `string`; `system_name`: `string`; `unique_id`: `string`; `up_id`: `string`; `up_ids`: `string`[]; \} |
| `root_user_group.create_time` | `string` |
| `root_user_group.name` | `string` |
| `root_user_group.system_name` | `string` |
| `root_user_group.unique_id` | `string` |
| `root_user_group.up_id` | `string` |
| `root_user_group.up_ids` | `string`[] |
| <a id="should_reupload_photo"></a> `should_reupload_photo` | `boolean` |
| <a id="show_viewer_attendant"></a> `show_viewer_attendant` | `boolean` |
| <a id="support_alarm_manager"></a> `support_alarm_manager` | `boolean` |
| <a id="support_apple_pass"></a> `support_apple_pass` | `boolean` |
| <a id="support_assign_location_to_door_guard"></a> `support_assign_location_to_door_guard` | `boolean` |
| <a id="support_callflow"></a> `support_callflow` | `boolean` |
| <a id="support_easy_provision"></a> `support_easy_provision` | `boolean` |
| <a id="support_google_pass"></a> `support_google_pass` | `boolean` |
| <a id="support_license_plate"></a> `support_license_plate` | `boolean` |
| <a id="support_qr_code"></a> `support_qr_code` | `boolean` |
| <a id="support_twilio_sip"></a> `support_twilio_sip` | `boolean` |
| <a id="system_log_cache_topic"></a> `system_log_cache_topic` | `string`[] |
| <a id="ucore_capabilities"></a> `ucore_capabilities` | `string`[] |
| <a id="ucs_capabilities"></a> `ucs_capabilities` | `string`[] |
| <a id="ucs_feature"></a> `ucs_feature` | `AccessKnownJsonValue`[] |
| <a id="ui_cdn"></a> `ui_cdn` | `string` |
| <a id="uid_access_portal"></a> `uid_access_portal` | `string` |
| <a id="uid_adopt_info"></a> `uid_adopt_info` | `Nullable`\<`string`\> |
| <a id="uid_capabilities"></a> `uid_capabilities` | `string`[] |
| <a id="ulp_capabilities"></a> `ulp_capabilities` | `string`[] |
| <a id="ulp_features"></a> `ulp_features` | `string`[] |
| <a id="ulp_version"></a> `ulp_version` | `string` |
| <a id="user_assets_available"></a> `user_assets_available` | `boolean` |
| <a id="user_bt_revision"></a> `user_bt_revision` | `number` |
| <a id="version"></a> `version` | `string` |

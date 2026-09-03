[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessDeviceConfigInterface

# Interface: AccessDeviceConfigInterface

A semi-complete description of the UniFi Access device JSON.

## Indexable

```ts
[key: string]: AccessKnownJsonValue
```

## Properties

| Property | Type |
| ------ | ------ |
| <a id="adopt_time"></a> `adopt_time` | `number` |
| <a id="adopting"></a> `adopting` | `boolean` |
| <a id="alias"></a> `alias` | `string` |
| <a id="bom_rev"></a> `bom_rev` | `string` |
| <a id="camera_setting"></a> `camera_setting?` | `Record`\<`string`, `AccessKnownJsonValue`\> |
| <a id="cameras"></a> `cameras?` | `Record`\<`string`, `AccessKnownJsonValue`\>[] |
| <a id="capabilities"></a> `capabilities` | `string`[] |
| <a id="configs"></a> `configs` | [`AccessDeviceEntryConfigInterface`](AccessDeviceEntryConfigInterface.md)[] |
| <a id="connected_uah_id"></a> `connected_uah_id` | `string` |
| <a id="device_type"></a> `device_type` | `string` |
| <a id="display_model"></a> `display_model` | `string` |
| <a id="door"></a> `door?` | [`AccessLocationConfigInterface`](AccessLocationConfigInterface.md) |
| <a id="extensions"></a> `extensions?` | \{ `device_id`: `string`; `extension_name`: `string`; `source_id?`: `string`; `target_config`: \{ `config_key`: `string`; `config_tag`: `string`; `config_value`: `string` \| `number` \| `boolean`; \}[]; `target_name?`: `string`; `target_type`: `string`; `target_value?`: `string`; `unique_id`: `string`; \}[] |
| <a id="firmware"></a> `firmware` | `string` |
| <a id="firmware_update_time"></a> `firmware_update_time` | `number` |
| <a id="floor"></a> `floor?` | [`AccessLocationConfigInterface`](AccessLocationConfigInterface.md) |
| <a id="guid"></a> `guid` | `string` |
| <a id="hw_type"></a> `hw_type` | `string` |
| <a id="images"></a> `images` | \{ `animation?`: `string`[]; `base?`: `string`; `l`: `string`; `m`: `string`; `s`: `string`; `xl`: `string`; `xs`: `string`; `xxl?`: `string`; \} |
| `images.animation?` | `string`[] |
| `images.base?` | `string` |
| `images.l` | `string` |
| `images.m` | `string` |
| `images.s` | `string` |
| `images.xl` | `string` |
| `images.xs` | `string` |
| `images.xxl?` | `string` |
| <a id="ip"></a> `ip` | `string` |
| <a id="is_adopted"></a> `is_adopted` | `boolean` |
| <a id="is_camera"></a> `is_camera?` | `boolean` |
| <a id="is_connected"></a> `is_connected` | `boolean` |
| <a id="is_export_sf_blocked"></a> `is_export_sf_blocked?` | `boolean` |
| <a id="is_managed"></a> `is_managed` | `boolean` |
| <a id="is_online"></a> `is_online` | `boolean` |
| <a id="is_rebooting"></a> `is_rebooting?` | `boolean` |
| <a id="is_unavailable"></a> `is_unavailable?` | `boolean` |
| <a id="is_upgrade_blocked"></a> `is_upgrade_blocked?` | `boolean` |
| <a id="last_seen"></a> `last_seen?` | `number` |
| <a id="location"></a> `location` | [`AccessLocationConfigInterface`](AccessLocationConfigInterface.md) |
| <a id="location_id"></a> `location_id` | `string` |
| <a id="mac"></a> `mac` | `string` |
| <a id="model"></a> `model` | `string` |
| <a id="name"></a> `name` | `string` |
| <a id="need_advisory"></a> `need_advisory` | `boolean` |
| <a id="resource_name"></a> `resource_name` | `string` |
| <a id="revision"></a> `revision` | `string` |
| <a id="revision_update_time"></a> `revision_update_time` | `number` |
| <a id="security_check"></a> `security_check` | `boolean` |
| <a id="source"></a> `source` | `Nullable`\<`string`\> |
| <a id="source_id"></a> `source_id?` | `string` |
| <a id="start_time"></a> `start_time` | `number` |
| <a id="template"></a> `template?` | `Nullable`\<`AccessKnownJsonValue`\> |
| <a id="unique_id"></a> `unique_id` | `string` |
| <a id="update"></a> `update` | `Nullable`\<`string`\> |
| <a id="update_manual"></a> `update_manual` | \{ `device_type?`: `string`; `device_version_upgrade_status`: \{ `completed`: `boolean`; `failed`: `boolean`; `failure_reason`: `string`; `is_downloading`: `boolean`; `is_preparing?`: `boolean`; `is_upgrading`: `boolean`; `is_waiting`: `boolean`; `timed_out`: `boolean`; `upgrade_seconds`: `number`; \}; `downloaded?`: `boolean`; `from_version`: `string`; `last_download_failure_reason?`: `string`; `last_download_start_time?`: `Nullable`\<`string`\>; `last_download_success?`: `Nullable`\<`string`\>; `last_upgrade_failure_reason`: `string`; `last_upgrade_start_time`: `Nullable`\<`string`\>; `last_upgrade_success`: `Nullable`\<`string`\>; \} |
| `update_manual.device_type?` | `string` |
| `update_manual.device_version_upgrade_status` | \{ `completed`: `boolean`; `failed`: `boolean`; `failure_reason`: `string`; `is_downloading`: `boolean`; `is_preparing?`: `boolean`; `is_upgrading`: `boolean`; `is_waiting`: `boolean`; `timed_out`: `boolean`; `upgrade_seconds`: `number`; \} |
| `update_manual.device_version_upgrade_status.completed` | `boolean` |
| `update_manual.device_version_upgrade_status.failed` | `boolean` |
| `update_manual.device_version_upgrade_status.failure_reason` | `string` |
| `update_manual.device_version_upgrade_status.is_downloading` | `boolean` |
| `update_manual.device_version_upgrade_status.is_preparing?` | `boolean` |
| `update_manual.device_version_upgrade_status.is_upgrading` | `boolean` |
| `update_manual.device_version_upgrade_status.is_waiting` | `boolean` |
| `update_manual.device_version_upgrade_status.timed_out` | `boolean` |
| `update_manual.device_version_upgrade_status.upgrade_seconds` | `number` |
| `update_manual.downloaded?` | `boolean` |
| `update_manual.from_version` | `string` |
| `update_manual.last_download_failure_reason?` | `string` |
| `update_manual.last_download_start_time?` | `Nullable`\<`string`\> |
| `update_manual.last_download_success?` | `Nullable`\<`string`\> |
| `update_manual.last_upgrade_failure_reason` | `string` |
| `update_manual.last_upgrade_start_time` | `Nullable`\<`string`\> |
| `update_manual.last_upgrade_success` | `Nullable`\<`string`\> |
| <a id="version"></a> `version` | `Nullable`\<`string`\> |
| <a id="version_update_time"></a> `version_update_time` | `number` |

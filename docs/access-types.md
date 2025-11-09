[**unifi-access**](README.md)

***

[Home](README.md) / access-types

# access-types

## Interfaces

### AccessBootstrapConfig

#### Properties

| Property | Modifier | Type |
| ------ | ------ | ------ |
| <a id="alias"></a> `alias?` | `readonly` | `string` |
| <a id="device_groups"></a> `device_groups?` | `readonly` | [`AccessDeviceConfigInterface`](#accessdeviceconfiginterface)[] |
| <a id="extra_type"></a> `extra_type` | `readonly` | `string` |
| <a id="extras"></a> `extras` | `readonly` | [`AccessDeviceExtrasConfigInterface`](#accessdeviceextrasconfiginterface) |
| <a id="floors"></a> `floors?` | `readonly` | [`AccessFloorConfigInterface`](#accessfloorconfiginterface)[] |
| <a id="full_name"></a> `full_name` | `readonly` | `string` |
| <a id="level"></a> `level` | `readonly` | `number` |
| <a id="location_type"></a> `location_type` | `readonly` | `string` |
| <a id="name"></a> `name?` | `readonly` | `string` |
| <a id="timezone"></a> `timezone` | `readonly` | `string` |
| <a id="unique_id"></a> `unique_id` | `readonly` | `string` |
| <a id="up_id"></a> `up_id` | `readonly` | `string` |
| <a id="work_time"></a> `work_time` | `readonly` | `string`[] |
| <a id="work_time_id"></a> `work_time_id` | `readonly` | `string` |

***

### AccessBootstrapConfigInterface

#### Properties

| Property | Type |
| ------ | ------ |
| <a id="alias-1"></a> `alias?` | `string` |
| <a id="device_groups-1"></a> `device_groups?` | [`AccessDeviceConfigInterface`](#accessdeviceconfiginterface)[] |
| <a id="extra_type-1"></a> `extra_type` | `string` |
| <a id="extras-1"></a> `extras` | [`AccessDeviceExtrasConfigInterface`](#accessdeviceextrasconfiginterface) |
| <a id="floors-1"></a> `floors?` | [`AccessFloorConfigInterface`](#accessfloorconfiginterface)[] |
| <a id="full_name-1"></a> `full_name` | `string` |
| <a id="level-1"></a> `level` | `number` |
| <a id="location_type-1"></a> `location_type` | `string` |
| <a id="name-1"></a> `name?` | `string` |
| <a id="timezone-1"></a> `timezone` | `string` |
| <a id="unique_id-1"></a> `unique_id` | `string` |
| <a id="up_id-1"></a> `up_id` | `string` |
| <a id="work_time-1"></a> `work_time` | `string`[] |
| <a id="work_time_id-1"></a> `work_time_id` | `string` |

***

### AccessControllerConfig

#### Properties

| Property | Modifier | Type |
| ------ | ------ | ------ |
| <a id="adopted_by_uid"></a> `adopted_by_uid` | `readonly` | `boolean` |
| <a id="agent_info"></a> `agent_info` | `readonly` | \{ `admin_portal`: `string` \| `null`; `company_id`: `string`; `company_logo`: `string`; `company_name`: `string`; `configured`: `boolean`; `controller_id`: `string`; `current_admin_portal`: `string` \| `null`; `endpoints`: \{ `admin`: `string`; `api`: `string`; `cell_name`: `string`; `core-login`: `string`; \}; `host_device_id`: `string`; `is_access_kua`: `boolean`; `is_install`: `boolean`; `is_kua`: `boolean`; `is_migrating`: `boolean`; `is_running`: `boolean`; `is_setup`: `boolean`; `is_workspace_consistent`: `boolean`; `mqtt_connected`: `boolean`; `site_info`: `string` \| `null`; `software_version`: `string`; `token_valid`: `boolean`; \} |
| `agent_info.admin_portal` | `public` | `string` \| `null` |
| `agent_info.company_id` | `public` | `string` |
| `agent_info.company_logo` | `public` | `string` |
| `agent_info.company_name` | `public` | `string` |
| `agent_info.configured` | `public` | `boolean` |
| `agent_info.controller_id` | `public` | `string` |
| `agent_info.current_admin_portal` | `public` | `string` \| `null` |
| `agent_info.endpoints` | `public` | \{ `admin`: `string`; `api`: `string`; `cell_name`: `string`; `core-login`: `string`; \} |
| `agent_info.endpoints.admin` | `public` | `string` |
| `agent_info.endpoints.api` | `public` | `string` |
| `agent_info.endpoints.cell_name` | `public` | `string` |
| `agent_info.endpoints.core-login` | `public` | `string` |
| `agent_info.host_device_id` | `public` | `string` |
| `agent_info.is_access_kua` | `public` | `boolean` |
| `agent_info.is_install` | `public` | `boolean` |
| `agent_info.is_kua` | `public` | `boolean` |
| `agent_info.is_migrating` | `public` | `boolean` |
| `agent_info.is_running` | `public` | `boolean` |
| `agent_info.is_setup` | `public` | `boolean` |
| `agent_info.is_workspace_consistent` | `public` | `boolean` |
| `agent_info.mqtt_connected` | `public` | `boolean` |
| `agent_info.site_info` | `public` | `string` \| `null` |
| `agent_info.software_version` | `public` | `string` |
| `agent_info.token_valid` | `public` | `boolean` |
| <a id="bt_config_revision"></a> `bt_config_revision` | `readonly` | `number` |
| <a id="capabilities"></a> `capabilities` | `readonly` | `string`[] |
| <a id="configured"></a> `configured` | `readonly` | `boolean` |
| <a id="disabled_by_uid"></a> `disabled_by_uid` | `readonly` | `boolean` |
| <a id="has_door_group"></a> `has_door_group` | `readonly` | `boolean` |
| <a id="has_top_log"></a> `has_top_log` | `readonly` | `number` |
| <a id="host"></a> `host` | `readonly` | \{ `device_type`: `string`; `firmware_version`: `string`; `gateway_ip`: `string`; `hostname`: `string`; `ip`: `string`; `mac`: `string`; `release_channel`: `string`; `shortname`: `string`; `time_zone`: `string`; `uptime`: `number`; `wan_ip`: `string`; \} |
| `host.device_type` | `public` | `string` |
| `host.firmware_version` | `public` | `string` |
| `host.gateway_ip` | `public` | `string` |
| `host.hostname` | `public` | `string` |
| `host.ip` | `public` | `string` |
| `host.mac` | `public` | `string` |
| `host.release_channel` | `public` | `string` |
| `host.shortname` | `public` | `string` |
| `host.time_zone` | `public` | `string` |
| `host.uptime` | `public` | `number` |
| `host.wan_ip` | `public` | `string` |
| <a id="protect_version"></a> `protect_version` | `readonly` | `string` |
| <a id="root_user_group"></a> `root_user_group` | `readonly` | \{ `create_time`: `string`; `name`: `string`; `system_name`: `string`; `unique_id`: `string`; `up_id`: `string`; `up_ids`: `string`[]; \} |
| `root_user_group.create_time` | `public` | `string` |
| `root_user_group.name` | `public` | `string` |
| `root_user_group.system_name` | `public` | `string` |
| `root_user_group.unique_id` | `public` | `string` |
| `root_user_group.up_id` | `public` | `string` |
| `root_user_group.up_ids` | `public` | `string`[] |
| <a id="support_qr_code"></a> `support_qr_code` | `readonly` | `boolean` |
| <a id="ucore_capabilities"></a> `ucore_capabilities` | `readonly` | `string`[] |
| <a id="ui_cdn"></a> `ui_cdn` | `readonly` | `string` |
| <a id="uid_acess_portal"></a> `uid_acess_portal` | `readonly` | `string` |
| <a id="uid_adopt_info"></a> `uid_adopt_info` | `readonly` | `string` \| `null` |
| <a id="uid_capabilities"></a> `uid_capabilities` | `readonly` | `string`[] |
| <a id="ulp_capabilities"></a> `ulp_capabilities` | `readonly` | `string`[] |
| <a id="ulp_version"></a> `ulp_version` | `readonly` | `string` |
| <a id="user_bt_revision"></a> `user_bt_revision` | `readonly` | `number` |
| <a id="version"></a> `version` | `readonly` | `string` |

***

### AccessControllerConfigInterface

#### Properties

| Property | Type |
| ------ | ------ |
| <a id="adopted_by_uid-1"></a> `adopted_by_uid` | `boolean` |
| <a id="agent_info-1"></a> `agent_info` | \{ `admin_portal`: `string` \| `null`; `company_id`: `string`; `company_logo`: `string`; `company_name`: `string`; `configured`: `boolean`; `controller_id`: `string`; `current_admin_portal`: `string` \| `null`; `endpoints`: \{ `admin`: `string`; `api`: `string`; `cell_name`: `string`; `core-login`: `string`; \}; `host_device_id`: `string`; `is_access_kua`: `boolean`; `is_install`: `boolean`; `is_kua`: `boolean`; `is_migrating`: `boolean`; `is_running`: `boolean`; `is_setup`: `boolean`; `is_workspace_consistent`: `boolean`; `mqtt_connected`: `boolean`; `site_info`: `string` \| `null`; `software_version`: `string`; `token_valid`: `boolean`; \} |
| `agent_info.admin_portal` | `string` \| `null` |
| `agent_info.company_id` | `string` |
| `agent_info.company_logo` | `string` |
| `agent_info.company_name` | `string` |
| `agent_info.configured` | `boolean` |
| `agent_info.controller_id` | `string` |
| `agent_info.current_admin_portal` | `string` \| `null` |
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
| `agent_info.site_info` | `string` \| `null` |
| `agent_info.software_version` | `string` |
| `agent_info.token_valid` | `boolean` |
| <a id="bt_config_revision-1"></a> `bt_config_revision` | `number` |
| <a id="capabilities-1"></a> `capabilities` | `string`[] |
| <a id="configured-1"></a> `configured` | `boolean` |
| <a id="disabled_by_uid-1"></a> `disabled_by_uid` | `boolean` |
| <a id="has_door_group-1"></a> `has_door_group` | `boolean` |
| <a id="has_top_log-1"></a> `has_top_log` | `number` |
| <a id="host-1"></a> `host` | \{ `device_type`: `string`; `firmware_version`: `string`; `gateway_ip`: `string`; `hostname`: `string`; `ip`: `string`; `mac`: `string`; `release_channel`: `string`; `shortname`: `string`; `time_zone`: `string`; `uptime`: `number`; `wan_ip`: `string`; \} |
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
| <a id="protect_version-1"></a> `protect_version` | `string` |
| <a id="root_user_group-1"></a> `root_user_group` | \{ `create_time`: `string`; `name`: `string`; `system_name`: `string`; `unique_id`: `string`; `up_id`: `string`; `up_ids`: `string`[]; \} |
| `root_user_group.create_time` | `string` |
| `root_user_group.name` | `string` |
| `root_user_group.system_name` | `string` |
| `root_user_group.unique_id` | `string` |
| `root_user_group.up_id` | `string` |
| `root_user_group.up_ids` | `string`[] |
| <a id="support_qr_code-1"></a> `support_qr_code` | `boolean` |
| <a id="ucore_capabilities-1"></a> `ucore_capabilities` | `string`[] |
| <a id="ui_cdn-1"></a> `ui_cdn` | `string` |
| <a id="uid_acess_portal-1"></a> `uid_acess_portal` | `string` |
| <a id="uid_adopt_info-1"></a> `uid_adopt_info` | `string` \| `null` |
| <a id="uid_capabilities-1"></a> `uid_capabilities` | `string`[] |
| <a id="ulp_capabilities-1"></a> `ulp_capabilities` | `string`[] |
| <a id="ulp_version-1"></a> `ulp_version` | `string` |
| <a id="user_bt_revision-1"></a> `user_bt_revision` | `number` |
| <a id="version-1"></a> `version` | `string` |

***

### AccessControllerConfigPayload

#### Properties

| Property | Type |
| ------ | ------ |
| <a id="adopted_by_uid-2"></a> `adopted_by_uid?` | `DeepPartial`\<`boolean`\> |
| <a id="agent_info-2"></a> `agent_info?` | `DeepPartial`\<\{ `admin_portal`: `string` \| `null`; `company_id`: `string`; `company_logo`: `string`; `company_name`: `string`; `configured`: `boolean`; `controller_id`: `string`; `current_admin_portal`: `string` \| `null`; `endpoints`: \{ `admin`: `string`; `api`: `string`; `cell_name`: `string`; `core-login`: `string`; \}; `host_device_id`: `string`; `is_access_kua`: `boolean`; `is_install`: `boolean`; `is_kua`: `boolean`; `is_migrating`: `boolean`; `is_running`: `boolean`; `is_setup`: `boolean`; `is_workspace_consistent`: `boolean`; `mqtt_connected`: `boolean`; `site_info`: `string` \| `null`; `software_version`: `string`; `token_valid`: `boolean`; \}\> |
| <a id="bt_config_revision-2"></a> `bt_config_revision?` | `number` |
| <a id="capabilities-2"></a> `capabilities?` | `string`[] |
| <a id="configured-2"></a> `configured?` | `DeepPartial`\<`boolean`\> |
| <a id="disabled_by_uid-2"></a> `disabled_by_uid?` | `DeepPartial`\<`boolean`\> |
| <a id="has_door_group-2"></a> `has_door_group?` | `DeepPartial`\<`boolean`\> |
| <a id="has_top_log-2"></a> `has_top_log?` | `number` |
| <a id="host-2"></a> `host?` | `DeepPartial`\<\{ `device_type`: `string`; `firmware_version`: `string`; `gateway_ip`: `string`; `hostname`: `string`; `ip`: `string`; `mac`: `string`; `release_channel`: `string`; `shortname`: `string`; `time_zone`: `string`; `uptime`: `number`; `wan_ip`: `string`; \}\> |
| <a id="protect_version-2"></a> `protect_version?` | `string` |
| <a id="root_user_group-2"></a> `root_user_group?` | `DeepPartial`\<\{ `create_time`: `string`; `name`: `string`; `system_name`: `string`; `unique_id`: `string`; `up_id`: `string`; `up_ids`: `string`[]; \}\> |
| <a id="support_qr_code-2"></a> `support_qr_code?` | `DeepPartial`\<`boolean`\> |
| <a id="ucore_capabilities-2"></a> `ucore_capabilities?` | `string`[] |
| <a id="ui_cdn-2"></a> `ui_cdn?` | `string` |
| <a id="uid_acess_portal-2"></a> `uid_acess_portal?` | `string` |
| <a id="uid_adopt_info-2"></a> `uid_adopt_info?` | `DeepPartial`\<`string` \| `null`\> |
| <a id="uid_capabilities-2"></a> `uid_capabilities?` | `string`[] |
| <a id="ulp_capabilities-2"></a> `ulp_capabilities?` | `string`[] |
| <a id="ulp_version-2"></a> `ulp_version?` | `string` |
| <a id="user_bt_revision-2"></a> `user_bt_revision?` | `number` |
| <a id="version-2"></a> `version?` | `string` |

***

### AccessDeviceConfig

#### Properties

| Property | Modifier | Type |
| ------ | ------ | ------ |
| <a id="adopt_time"></a> `adopt_time` | `readonly` | `number` |
| <a id="adopting"></a> `adopting` | `readonly` | `boolean` |
| <a id="alias-2"></a> `alias?` | `readonly` | `string` |
| <a id="bom_rev"></a> `bom_rev` | `readonly` | `string` |
| <a id="capabilities-3"></a> `capabilities` | `readonly` | `string`[] |
| <a id="configs"></a> `configs?` | `readonly` | [`AccessDeviceEntryConfigInterface`](#accessdeviceentryconfiginterface)[] |
| <a id="connected_uah_id"></a> `connected_uah_id` | `readonly` | `string` |
| <a id="device_type"></a> `device_type` | `readonly` | `string` |
| <a id="display_model"></a> `display_model?` | `readonly` | `string` |
| <a id="door"></a> `door` | `readonly` | \{ `extra_type`: `string`; `extras`: [`AccessDeviceExtrasConfigInterface`](#accessdeviceextrasconfiginterface); `full_name`: `string`; `level`: `number`; `location_type`: `string`; `name`: `string`; `timezone`: `string`; `unique_id`: `string`; `up_id`: `string`; `work_time`: `string`[]; `work_time_id`: `string`; \} |
| `door.extra_type` | `public` | `string` |
| `door.extras` | `public` | [`AccessDeviceExtrasConfigInterface`](#accessdeviceextrasconfiginterface) |
| `door.full_name` | `public` | `string` |
| `door.level` | `public` | `number` |
| `door.location_type` | `public` | `string` |
| `door.name` | `public` | `string` |
| `door.timezone` | `public` | `string` |
| `door.unique_id` | `public` | `string` |
| `door.up_id` | `public` | `string` |
| `door.work_time` | `public` | `string`[] |
| `door.work_time_id` | `public` | `string` |
| <a id="extensions"></a> `extensions?` | `readonly` | \{ `device_id`: `string`; `extension_name`: `string`; `source_id?`: `string`; `target_config`: \{ `config_key`: `string`; `config_tag`: `string`; `config_value`: `string` \| `number` \| `boolean`; \}[]; `target_name?`: `string`; `target_type?`: `string`; `target_value?`: `string`; `unique_id`: `string`; \}[] |
| <a id="firmware"></a> `firmware` | `readonly` | `string` |
| <a id="firmware_update_time"></a> `firmware_update_time` | `readonly` | `number` |
| <a id="floor"></a> `floor` | `readonly` | \{ `extra_type`: `string`; `extras`: [`AccessDeviceExtrasConfigInterface`](#accessdeviceextrasconfiginterface); `full_name`: `string`; `level`: `number`; `location_type`: `string`; `name`: `string`; `timezone`: `string`; `unique_id`: `string`; `up_id`: `string`; `work_time`: `string`[]; `work_time_id`: `string`; \} |
| `floor.extra_type` | `public` | `string` |
| `floor.extras` | `public` | [`AccessDeviceExtrasConfigInterface`](#accessdeviceextrasconfiginterface) |
| `floor.full_name` | `public` | `string` |
| `floor.level` | `public` | `number` |
| `floor.location_type` | `public` | `string` |
| `floor.name` | `public` | `string` |
| `floor.timezone` | `public` | `string` |
| `floor.unique_id` | `public` | `string` |
| `floor.up_id` | `public` | `string` |
| `floor.work_time` | `public` | `string`[] |
| `floor.work_time_id` | `public` | `string` |
| <a id="guid"></a> `guid` | `readonly` | `string` |
| <a id="hw_type"></a> `hw_type` | `readonly` | `string` |
| <a id="images"></a> `images` | `readonly` | \{ `l`: `string`; `m`: `string`; `s`: `string`; `xl`: `string`; `xs`: `string`; \} |
| `images.l` | `public` | `string` |
| `images.m` | `public` | `string` |
| `images.s` | `public` | `string` |
| `images.xl` | `public` | `string` |
| `images.xs` | `public` | `string` |
| <a id="ip"></a> `ip` | `readonly` | `string` |
| <a id="is_adopted"></a> `is_adopted` | `readonly` | `boolean` |
| <a id="is_connected"></a> `is_connected` | `readonly` | `boolean` |
| <a id="is_managed"></a> `is_managed` | `readonly` | `boolean` |
| <a id="is_online"></a> `is_online?` | `readonly` | `boolean` |
| <a id="is_rebooting"></a> `is_rebooting` | `readonly` | `boolean` |
| <a id="location"></a> `location` | `readonly` | \{ `extra_type`: `string`; `extras`: [`AccessDeviceExtrasConfigInterface`](#accessdeviceextrasconfiginterface); `full_name`: `string`; `level`: `number`; `location_type`: `string`; `name`: `string`; `timezone`: `string`; `unique_id`: `string`; `up_id`: `string`; `work_time`: `string`[]; `work_time_id`: `string`; \} |
| `location.extra_type` | `public` | `string` |
| `location.extras` | `public` | [`AccessDeviceExtrasConfigInterface`](#accessdeviceextrasconfiginterface) |
| `location.full_name` | `public` | `string` |
| `location.level` | `public` | `number` |
| `location.location_type` | `public` | `string` |
| `location.name` | `public` | `string` |
| `location.timezone` | `public` | `string` |
| `location.unique_id` | `public` | `string` |
| `location.up_id` | `public` | `string` |
| `location.work_time` | `public` | `string`[] |
| `location.work_time_id` | `public` | `string` |
| <a id="location_id"></a> `location_id` | `readonly` | `string` |
| <a id="mac"></a> `mac` | `readonly` | `string` |
| <a id="model"></a> `model` | `readonly` | `string` |
| <a id="name-2"></a> `name?` | `readonly` | `string` |
| <a id="need_advisory"></a> `need_advisory` | `readonly` | `boolean` |
| <a id="resource_name"></a> `resource_name` | `readonly` | `string` |
| <a id="revision"></a> `revision` | `readonly` | `number` |
| <a id="revision_update_time"></a> `revision_update_time` | `readonly` | `number` |
| <a id="security_check"></a> `security_check` | `readonly` | `boolean` |
| <a id="source"></a> `source` | `readonly` | `string` |
| <a id="source_id"></a> `source_id` | `readonly` | `string` |
| <a id="start_time"></a> `start_time` | `readonly` | `number` |
| <a id="unique_id-2"></a> `unique_id` | `readonly` | `string` |
| <a id="update"></a> `update` | `readonly` | `string` |
| <a id="update_manual"></a> `update_manual` | `readonly` | \{ `device_version_upgrade_status`: \{ `completed`: `boolean`; `failed`: `boolean`; `failure_reason`: `string`; `is_downloading`: `boolean`; `is_upgrading`: `boolean`; `is_waiting`: `boolean`; `timed_out`: `boolean`; `upgrade_seconds`: `number`; \}; `from_version`: `string`; `last_upgrade_failure_reason`: `string`; `last_upgrade_start_time`: `string`; `last_upgrade_success`: `string`; \} |
| `update_manual.device_version_upgrade_status` | `public` | \{ `completed`: `boolean`; `failed`: `boolean`; `failure_reason`: `string`; `is_downloading`: `boolean`; `is_upgrading`: `boolean`; `is_waiting`: `boolean`; `timed_out`: `boolean`; `upgrade_seconds`: `number`; \} |
| `update_manual.device_version_upgrade_status.completed` | `public` | `boolean` |
| `update_manual.device_version_upgrade_status.failed` | `public` | `boolean` |
| `update_manual.device_version_upgrade_status.failure_reason` | `public` | `string` |
| `update_manual.device_version_upgrade_status.is_downloading` | `public` | `boolean` |
| `update_manual.device_version_upgrade_status.is_upgrading` | `public` | `boolean` |
| `update_manual.device_version_upgrade_status.is_waiting` | `public` | `boolean` |
| `update_manual.device_version_upgrade_status.timed_out` | `public` | `boolean` |
| `update_manual.device_version_upgrade_status.upgrade_seconds` | `public` | `number` |
| `update_manual.from_version` | `public` | `string` |
| `update_manual.last_upgrade_failure_reason` | `public` | `string` |
| `update_manual.last_upgrade_start_time` | `public` | `string` |
| `update_manual.last_upgrade_success` | `public` | `string` |
| <a id="version-3"></a> `version` | `readonly` | `string` |
| <a id="version_update_time"></a> `version_update_time` | `readonly` | `number` |

***

### AccessDeviceConfigInterface

#### Properties

| Property | Type |
| ------ | ------ |
| <a id="adopt_time-1"></a> `adopt_time` | `number` |
| <a id="adopting-1"></a> `adopting` | `boolean` |
| <a id="alias-3"></a> `alias?` | `string` |
| <a id="bom_rev-1"></a> `bom_rev` | `string` |
| <a id="capabilities-4"></a> `capabilities` | `string`[] |
| <a id="configs-1"></a> `configs?` | [`AccessDeviceEntryConfigInterface`](#accessdeviceentryconfiginterface)[] |
| <a id="connected_uah_id-1"></a> `connected_uah_id` | `string` |
| <a id="device_type-1"></a> `device_type` | `string` |
| <a id="display_model-1"></a> `display_model?` | `string` |
| <a id="door-1"></a> `door` | \{ `extra_type`: `string`; `extras`: [`AccessDeviceExtrasConfigInterface`](#accessdeviceextrasconfiginterface); `full_name`: `string`; `level`: `number`; `location_type`: `string`; `name`: `string`; `timezone`: `string`; `unique_id`: `string`; `up_id`: `string`; `work_time`: `string`[]; `work_time_id`: `string`; \} |
| `door.extra_type` | `string` |
| `door.extras` | [`AccessDeviceExtrasConfigInterface`](#accessdeviceextrasconfiginterface) |
| `door.full_name` | `string` |
| `door.level` | `number` |
| `door.location_type` | `string` |
| `door.name` | `string` |
| `door.timezone` | `string` |
| `door.unique_id` | `string` |
| `door.up_id` | `string` |
| `door.work_time` | `string`[] |
| `door.work_time_id` | `string` |
| <a id="extensions-1"></a> `extensions?` | \{ `device_id`: `string`; `extension_name`: `string`; `source_id?`: `string`; `target_config`: \{ `config_key`: `string`; `config_tag`: `string`; `config_value`: `string` \| `number` \| `boolean`; \}[]; `target_name?`: `string`; `target_type?`: `string`; `target_value?`: `string`; `unique_id`: `string`; \}[] |
| <a id="firmware-1"></a> `firmware` | `string` |
| <a id="firmware_update_time-1"></a> `firmware_update_time` | `number` |
| <a id="floor-1"></a> `floor` | \{ `extra_type`: `string`; `extras`: [`AccessDeviceExtrasConfigInterface`](#accessdeviceextrasconfiginterface); `full_name`: `string`; `level`: `number`; `location_type`: `string`; `name`: `string`; `timezone`: `string`; `unique_id`: `string`; `up_id`: `string`; `work_time`: `string`[]; `work_time_id`: `string`; \} |
| `floor.extra_type` | `string` |
| `floor.extras` | [`AccessDeviceExtrasConfigInterface`](#accessdeviceextrasconfiginterface) |
| `floor.full_name` | `string` |
| `floor.level` | `number` |
| `floor.location_type` | `string` |
| `floor.name` | `string` |
| `floor.timezone` | `string` |
| `floor.unique_id` | `string` |
| `floor.up_id` | `string` |
| `floor.work_time` | `string`[] |
| `floor.work_time_id` | `string` |
| <a id="guid-1"></a> `guid` | `string` |
| <a id="hw_type-1"></a> `hw_type` | `string` |
| <a id="images-1"></a> `images` | \{ `l`: `string`; `m`: `string`; `s`: `string`; `xl`: `string`; `xs`: `string`; \} |
| `images.l` | `string` |
| `images.m` | `string` |
| `images.s` | `string` |
| `images.xl` | `string` |
| `images.xs` | `string` |
| <a id="ip-1"></a> `ip` | `string` |
| <a id="is_adopted-1"></a> `is_adopted` | `boolean` |
| <a id="is_connected-1"></a> `is_connected` | `boolean` |
| <a id="is_managed-1"></a> `is_managed` | `boolean` |
| <a id="is_online-1"></a> `is_online?` | `boolean` |
| <a id="is_rebooting-1"></a> `is_rebooting` | `boolean` |
| <a id="location-1"></a> `location` | \{ `extra_type`: `string`; `extras`: [`AccessDeviceExtrasConfigInterface`](#accessdeviceextrasconfiginterface); `full_name`: `string`; `level`: `number`; `location_type`: `string`; `name`: `string`; `timezone`: `string`; `unique_id`: `string`; `up_id`: `string`; `work_time`: `string`[]; `work_time_id`: `string`; \} |
| `location.extra_type` | `string` |
| `location.extras` | [`AccessDeviceExtrasConfigInterface`](#accessdeviceextrasconfiginterface) |
| `location.full_name` | `string` |
| `location.level` | `number` |
| `location.location_type` | `string` |
| `location.name` | `string` |
| `location.timezone` | `string` |
| `location.unique_id` | `string` |
| `location.up_id` | `string` |
| `location.work_time` | `string`[] |
| `location.work_time_id` | `string` |
| <a id="location_id-1"></a> `location_id` | `string` |
| <a id="mac-1"></a> `mac` | `string` |
| <a id="model-1"></a> `model` | `string` |
| <a id="name-3"></a> `name?` | `string` |
| <a id="need_advisory-1"></a> `need_advisory` | `boolean` |
| <a id="resource_name-1"></a> `resource_name` | `string` |
| <a id="revision-1"></a> `revision` | `number` |
| <a id="revision_update_time-1"></a> `revision_update_time` | `number` |
| <a id="security_check-1"></a> `security_check` | `boolean` |
| <a id="source-1"></a> `source` | `string` |
| <a id="source_id-1"></a> `source_id` | `string` |
| <a id="start_time-1"></a> `start_time` | `number` |
| <a id="unique_id-3"></a> `unique_id` | `string` |
| <a id="update-1"></a> `update` | `string` |
| <a id="update_manual-1"></a> `update_manual` | \{ `device_version_upgrade_status`: \{ `completed`: `boolean`; `failed`: `boolean`; `failure_reason`: `string`; `is_downloading`: `boolean`; `is_upgrading`: `boolean`; `is_waiting`: `boolean`; `timed_out`: `boolean`; `upgrade_seconds`: `number`; \}; `from_version`: `string`; `last_upgrade_failure_reason`: `string`; `last_upgrade_start_time`: `string`; `last_upgrade_success`: `string`; \} |
| `update_manual.device_version_upgrade_status` | \{ `completed`: `boolean`; `failed`: `boolean`; `failure_reason`: `string`; `is_downloading`: `boolean`; `is_upgrading`: `boolean`; `is_waiting`: `boolean`; `timed_out`: `boolean`; `upgrade_seconds`: `number`; \} |
| `update_manual.device_version_upgrade_status.completed` | `boolean` |
| `update_manual.device_version_upgrade_status.failed` | `boolean` |
| `update_manual.device_version_upgrade_status.failure_reason` | `string` |
| `update_manual.device_version_upgrade_status.is_downloading` | `boolean` |
| `update_manual.device_version_upgrade_status.is_upgrading` | `boolean` |
| `update_manual.device_version_upgrade_status.is_waiting` | `boolean` |
| `update_manual.device_version_upgrade_status.timed_out` | `boolean` |
| `update_manual.device_version_upgrade_status.upgrade_seconds` | `number` |
| `update_manual.from_version` | `string` |
| `update_manual.last_upgrade_failure_reason` | `string` |
| `update_manual.last_upgrade_start_time` | `string` |
| `update_manual.last_upgrade_success` | `string` |
| <a id="version-4"></a> `version` | `string` |
| <a id="version_update_time-1"></a> `version_update_time` | `number` |

***

### AccessDeviceConfigPayload

#### Properties

| Property | Type |
| ------ | ------ |
| <a id="adopt_time-2"></a> `adopt_time?` | `number` |
| <a id="adopting-2"></a> `adopting?` | `DeepPartial`\<`boolean`\> |
| <a id="alias-4"></a> `alias?` | `DeepPartial`\<`string` \| `undefined`\> |
| <a id="bom_rev-2"></a> `bom_rev?` | `string` |
| <a id="capabilities-5"></a> `capabilities?` | `string`[] |
| <a id="configs-2"></a> `configs?` | `DeepPartial`\< \| [`AccessDeviceEntryConfigInterface`](#accessdeviceentryconfiginterface)[] \| `undefined`\> |
| <a id="connected_uah_id-2"></a> `connected_uah_id?` | `string` |
| <a id="device_type-2"></a> `device_type?` | `string` |
| <a id="display_model-2"></a> `display_model?` | `DeepPartial`\<`string` \| `undefined`\> |
| <a id="door-2"></a> `door?` | `DeepPartial`\<\{ `extra_type`: `string`; `extras`: [`AccessDeviceExtrasConfigInterface`](#accessdeviceextrasconfiginterface); `full_name`: `string`; `level`: `number`; `location_type`: `string`; `name`: `string`; `timezone`: `string`; `unique_id`: `string`; `up_id`: `string`; `work_time`: `string`[]; `work_time_id`: `string`; \}\> |
| <a id="extensions-2"></a> `extensions?` | `DeepPartial`\< \| \{ `device_id`: `string`; `extension_name`: `string`; `source_id?`: `string`; `target_config`: \{ `config_key`: `string`; `config_tag`: `string`; `config_value`: `string` \| `number` \| `boolean`; \}[]; `target_name?`: `string`; `target_type?`: `string`; `target_value?`: `string`; `unique_id`: `string`; \}[] \| `undefined`\> |
| <a id="firmware-2"></a> `firmware?` | `string` |
| <a id="firmware_update_time-2"></a> `firmware_update_time?` | `number` |
| <a id="floor-2"></a> `floor?` | `DeepPartial`\<\{ `extra_type`: `string`; `extras`: [`AccessDeviceExtrasConfigInterface`](#accessdeviceextrasconfiginterface); `full_name`: `string`; `level`: `number`; `location_type`: `string`; `name`: `string`; `timezone`: `string`; `unique_id`: `string`; `up_id`: `string`; `work_time`: `string`[]; `work_time_id`: `string`; \}\> |
| <a id="guid-2"></a> `guid?` | `string` |
| <a id="hw_type-2"></a> `hw_type?` | `string` |
| <a id="images-2"></a> `images?` | `DeepPartial`\<\{ `l`: `string`; `m`: `string`; `s`: `string`; `xl`: `string`; `xs`: `string`; \}\> |
| <a id="ip-2"></a> `ip?` | `string` |
| <a id="is_adopted-2"></a> `is_adopted?` | `DeepPartial`\<`boolean`\> |
| <a id="is_connected-2"></a> `is_connected?` | `DeepPartial`\<`boolean`\> |
| <a id="is_managed-2"></a> `is_managed?` | `DeepPartial`\<`boolean`\> |
| <a id="is_online-2"></a> `is_online?` | `DeepPartial`\<`boolean` \| `undefined`\> |
| <a id="is_rebooting-2"></a> `is_rebooting?` | `DeepPartial`\<`boolean`\> |
| <a id="location-2"></a> `location?` | `DeepPartial`\<\{ `extra_type`: `string`; `extras`: [`AccessDeviceExtrasConfigInterface`](#accessdeviceextrasconfiginterface); `full_name`: `string`; `level`: `number`; `location_type`: `string`; `name`: `string`; `timezone`: `string`; `unique_id`: `string`; `up_id`: `string`; `work_time`: `string`[]; `work_time_id`: `string`; \}\> |
| <a id="location_id-2"></a> `location_id?` | `string` |
| <a id="mac-2"></a> `mac?` | `string` |
| <a id="model-2"></a> `model?` | `string` |
| <a id="name-4"></a> `name?` | `DeepPartial`\<`string` \| `undefined`\> |
| <a id="need_advisory-2"></a> `need_advisory?` | `DeepPartial`\<`boolean`\> |
| <a id="resource_name-2"></a> `resource_name?` | `string` |
| <a id="revision-2"></a> `revision?` | `number` |
| <a id="revision_update_time-2"></a> `revision_update_time?` | `number` |
| <a id="security_check-2"></a> `security_check?` | `DeepPartial`\<`boolean`\> |
| <a id="source-2"></a> `source?` | `string` |
| <a id="source_id-2"></a> `source_id?` | `string` |
| <a id="start_time-2"></a> `start_time?` | `number` |
| <a id="unique_id-4"></a> `unique_id?` | `string` |
| <a id="update-2"></a> `update?` | `string` |
| <a id="update_manual-2"></a> `update_manual?` | `DeepPartial`\<\{ `device_version_upgrade_status`: \{ `completed`: `boolean`; `failed`: `boolean`; `failure_reason`: `string`; `is_downloading`: `boolean`; `is_upgrading`: `boolean`; `is_waiting`: `boolean`; `timed_out`: `boolean`; `upgrade_seconds`: `number`; \}; `from_version`: `string`; `last_upgrade_failure_reason`: `string`; `last_upgrade_start_time`: `string`; `last_upgrade_success`: `string`; \}\> |
| <a id="version-5"></a> `version?` | `string` |
| <a id="version_update_time-2"></a> `version_update_time?` | `number` |

***

### AccessDeviceEntryConfig

#### Properties

| Property | Modifier | Type |
| ------ | ------ | ------ |
| <a id="device_id"></a> `device_id` | `readonly` | `string` |
| <a id="key"></a> `key` | `readonly` | `string` |
| <a id="source-3"></a> `source` | `readonly` | `string` |
| <a id="tag"></a> `tag` | `readonly` | `string` |
| <a id="value"></a> `value` | `readonly` | `string` |

***

### AccessDeviceEntryConfigInterface

#### Properties

| Property | Type |
| ------ | ------ |
| <a id="device_id-1"></a> `device_id` | `string` |
| <a id="key-1"></a> `key` | `string` |
| <a id="source-4"></a> `source` | `string` |
| <a id="tag-1"></a> `tag` | `string` |
| <a id="value-1"></a> `value` | `string` |

***

### AccessDeviceEntryConfigPayload

#### Properties

| Property | Type |
| ------ | ------ |
| <a id="device_id-2"></a> `device_id?` | `string` |
| <a id="key-2"></a> `key?` | `string` |
| <a id="source-5"></a> `source?` | `string` |
| <a id="tag-2"></a> `tag?` | `string` |
| <a id="value-2"></a> `value?` | `string` |

***

### AccessDeviceExtrasConfigInterface

#### Properties

| Property | Type |
| ------ | ------ |
| <a id="door_thumbnail"></a> `door_thumbnail` | `string` |
| <a id="door_thumbnail_last_update"></a> `door_thumbnail_last_update` | `number` |
| <a id="uah-input_state_dps"></a> `uah-input_state_dps` | `boolean` |
| <a id="uah-wiring_state_dps-neg"></a> `uah-wiring_state_dps-neg` | `boolean` |
| <a id="uah-wiring_state_dps-pos"></a> `uah-wiring_state_dps-pos` | `boolean` |

***

### AccessDoorConfig

#### Properties

| Property | Modifier | Type |
| ------ | ------ | ------ |
| <a id="camera_resource_ids"></a> `camera_resource_ids` | `readonly` | `string`[] |
| <a id="device_groups-2"></a> `device_groups?` | `readonly` | [`AccessDeviceConfigInterface`](#accessdeviceconfiginterface)[] |
| <a id="door_guard"></a> `door_guard` | `readonly` | `string`[] |
| <a id="extra_type-2"></a> `extra_type` | `readonly` | `string` |
| <a id="extras-2"></a> `extras` | `readonly` | [`AccessDeviceExtrasConfigInterface`](#accessdeviceextrasconfiginterface) |
| <a id="full_name-2"></a> `full_name` | `readonly` | `string` |
| <a id="hotel_devices"></a> `hotel_devices` | `readonly` | `string`[] |
| <a id="level-2"></a> `level` | `readonly` | `number` |
| <a id="location_type-2"></a> `location_type` | `readonly` | `string` |
| <a id="name-5"></a> `name` | `readonly` | `string` |
| <a id="timezone-2"></a> `timezone` | `readonly` | `string` |
| <a id="unique_id-5"></a> `unique_id` | `readonly` | `string` |
| <a id="up_id-2"></a> `up_id` | `readonly` | `string` |
| <a id="work_time-2"></a> `work_time` | `readonly` | `string`[] |
| <a id="work_time_id-2"></a> `work_time_id` | `readonly` | `string` |

***

### AccessDoorConfigInterface

#### Properties

| Property | Type |
| ------ | ------ |
| <a id="camera_resource_ids-1"></a> `camera_resource_ids` | `string`[] |
| <a id="device_groups-3"></a> `device_groups?` | [`AccessDeviceConfigInterface`](#accessdeviceconfiginterface)[] |
| <a id="door_guard-1"></a> `door_guard` | `string`[] |
| <a id="extra_type-3"></a> `extra_type` | `string` |
| <a id="extras-3"></a> `extras` | [`AccessDeviceExtrasConfigInterface`](#accessdeviceextrasconfiginterface) |
| <a id="full_name-3"></a> `full_name` | `string` |
| <a id="hotel_devices-1"></a> `hotel_devices` | `string`[] |
| <a id="level-3"></a> `level` | `number` |
| <a id="location_type-3"></a> `location_type` | `string` |
| <a id="name-6"></a> `name` | `string` |
| <a id="timezone-3"></a> `timezone` | `string` |
| <a id="unique_id-6"></a> `unique_id` | `string` |
| <a id="up_id-3"></a> `up_id` | `string` |
| <a id="work_time-3"></a> `work_time` | `string`[] |
| <a id="work_time_id-3"></a> `work_time_id` | `string` |

***

### AccessDoorConfigPayload

#### Properties

| Property | Type |
| ------ | ------ |
| <a id="camera_resource_ids-2"></a> `camera_resource_ids?` | `string`[] |
| <a id="device_groups-4"></a> `device_groups?` | `DeepPartial`\< \| [`AccessDeviceConfigInterface`](#accessdeviceconfiginterface)[] \| `undefined`\> |
| <a id="door_guard-2"></a> `door_guard?` | `string`[] |
| <a id="extra_type-4"></a> `extra_type?` | `string` |
| <a id="extras-4"></a> `extras?` | `DeepPartial`\<[`AccessDeviceExtrasConfigInterface`](#accessdeviceextrasconfiginterface)\> |
| <a id="full_name-4"></a> `full_name?` | `string` |
| <a id="hotel_devices-2"></a> `hotel_devices?` | `string`[] |
| <a id="level-4"></a> `level?` | `number` |
| <a id="location_type-4"></a> `location_type?` | `string` |
| <a id="name-7"></a> `name?` | `string` |
| <a id="timezone-4"></a> `timezone?` | `string` |
| <a id="unique_id-7"></a> `unique_id?` | `string` |
| <a id="up_id-4"></a> `up_id?` | `string` |
| <a id="work_time-4"></a> `work_time?` | `string`[] |
| <a id="work_time_id-4"></a> `work_time_id?` | `string` |

***

### AccessFloorConfig

#### Properties

| Property | Modifier | Type |
| ------ | ------ | ------ |
| <a id="doors"></a> `doors` | `readonly` | [`AccessDoorConfigInterface`](#accessdoorconfiginterface)[] |
| <a id="extra_type-5"></a> `extra_type` | `readonly` | `string` |
| <a id="extras-5"></a> `extras` | `readonly` | [`AccessDeviceExtrasConfigInterface`](#accessdeviceextrasconfiginterface) |
| <a id="full_name-5"></a> `full_name` | `readonly` | `string` |
| <a id="level-5"></a> `level` | `readonly` | `number` |
| <a id="location_type-5"></a> `location_type` | `readonly` | `string` |
| <a id="name-8"></a> `name` | `readonly` | `string` |
| <a id="timezone-5"></a> `timezone` | `readonly` | `string` |
| <a id="unique_id-8"></a> `unique_id` | `readonly` | `string` |
| <a id="up_id-5"></a> `up_id` | `readonly` | `string` |
| <a id="work_time-5"></a> `work_time` | `readonly` | `string`[] |
| <a id="work_time_id-5"></a> `work_time_id` | `readonly` | `string` |

***

### AccessFloorConfigInterface

#### Properties

| Property | Type |
| ------ | ------ |
| <a id="doors-1"></a> `doors` | [`AccessDoorConfigInterface`](#accessdoorconfiginterface)[] |
| <a id="extra_type-6"></a> `extra_type` | `string` |
| <a id="extras-6"></a> `extras` | [`AccessDeviceExtrasConfigInterface`](#accessdeviceextrasconfiginterface) |
| <a id="full_name-6"></a> `full_name` | `string` |
| <a id="level-6"></a> `level` | `number` |
| <a id="location_type-6"></a> `location_type` | `string` |
| <a id="name-9"></a> `name` | `string` |
| <a id="timezone-6"></a> `timezone` | `string` |
| <a id="unique_id-9"></a> `unique_id` | `string` |
| <a id="up_id-6"></a> `up_id` | `string` |
| <a id="work_time-6"></a> `work_time` | `string`[] |
| <a id="work_time_id-6"></a> `work_time_id` | `string` |

***

### AccessFloorConfigPayload

#### Properties

| Property | Type |
| ------ | ------ |
| <a id="doors-2"></a> `doors?` | `DeepPartial`\<[`AccessDoorConfigInterface`](#accessdoorconfiginterface)\>[] |
| <a id="extra_type-7"></a> `extra_type?` | `string` |
| <a id="extras-7"></a> `extras?` | `DeepPartial`\<[`AccessDeviceExtrasConfigInterface`](#accessdeviceextrasconfiginterface)\> |
| <a id="full_name-7"></a> `full_name?` | `string` |
| <a id="level-7"></a> `level?` | `number` |
| <a id="location_type-7"></a> `location_type?` | `string` |
| <a id="name-10"></a> `name?` | `string` |
| <a id="timezone-7"></a> `timezone?` | `string` |
| <a id="unique_id-10"></a> `unique_id?` | `string` |
| <a id="up_id-7"></a> `up_id?` | `string` |
| <a id="work_time-7"></a> `work_time?` | `string`[] |
| <a id="work_time_id-7"></a> `work_time_id?` | `string` |

## Type Aliases

### AccessApiResponse

```ts
type AccessApiResponse = {
  code: number;
  codeS: string;
  data:   | Record<string, unknown>
     | Record<string, unknown>[]
     | string;
  error: string;
  msg: string;
};
```

UniFi Access API response JSON.

#### Properties

| Property | Type |
| ------ | ------ |
| <a id="code"></a> `code` | `number` |
| <a id="codes"></a> `codeS` | `string` |
| <a id="data"></a> `data` | \| `Record`\<`string`, `unknown`\> \| `Record`\<`string`, `unknown`\>[] \| `string` |
| <a id="error"></a> `error` | `string` |
| <a id="msg"></a> `msg` | `string` |

***

### AccessEventDoorbellCancel

```ts
type AccessEventDoorbellCancel = {
  reason_code: number;
  remote_call_request_id: string;
};
```

#### Properties

| Property | Type |
| ------ | ------ |
| <a id="reason_code"></a> `reason_code` | `number` |
| <a id="remote_call_request_id"></a> `remote_call_request_id` | `string` |

***

### AccessEventDoorbellRing

```ts
type AccessEventDoorbellRing = {
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
```

#### Properties

| Property | Type |
| ------ | ------ |
| <a id="channel"></a> `channel` | `string` |
| <a id="clear_request_id"></a> `clear_request_id` | `string` |
| <a id="connected_uah_id-3"></a> `connected_uah_id` | `string` |
| <a id="connected_uah_type"></a> `connected_uah_type` | `string` |
| <a id="controller_id"></a> `controller_id` | `string` |
| <a id="create_time"></a> `create_time` | `number` |
| <a id="device_id-3"></a> `device_id` | `string` |
| <a id="device_name"></a> `device_name` | `string` |
| <a id="device_type-3"></a> `device_type` | `string` |
| <a id="door_guard_ids"></a> `door_guard_ids` | `string`[] |
| <a id="door_name"></a> `door_name` | `string` |
| <a id="floor_name"></a> `floor_name` | `string` |
| <a id="host_device_mac"></a> `host_device_mac` | `string` |
| <a id="in_or_out"></a> `in_or_out` | `string` |
| <a id="reason_code-1"></a> `reason_code` | `number` |
| <a id="request_id"></a> `request_id` | `string` |
| <a id="room_id"></a> `room_id` | `string` |
| <a id="support_feature"></a> `support_feature` | `string`[] |
| <a id="token"></a> `token` | `string` |

***

### AccessEventPacket

```ts
type AccessEventPacket = {
  data:   | Record<string, string>
     | Record<string, unknown>
     | AccessControllerConfig
     | AccessDeviceConfig;
  event: string;
  event_object_id: string;
  receiver_id: string;
  save_to_history: boolean;
};
```

UniFi Access event packet.

#### Param

Access event topic.

#### Param

Access event payload.

#### Remarks

A UniFi Access event packet is the representation of a notification event from a UniFi Access controller. The Access `event` property informs us of the
notification type, such as `access.data.device.remote_unlock`, for door unlock events. The details of the event are delivered as a JSON payload in the `data`
property.

#### Properties

| Property | Type |
| ------ | ------ |
| <a id="data-1"></a> `data` | \| `Record`\<`string`, `string`\> \| `Record`\<`string`, `unknown`\> \| [`AccessControllerConfig`](#accesscontrollerconfig) \| [`AccessDeviceConfig`](#accessdeviceconfig) |
| <a id="event"></a> `event` | `string` |
| <a id="event_object_id"></a> `event_object_id` | `string` |
| <a id="receiver_id"></a> `receiver_id` | `string` |
| <a id="save_to_history"></a> `save_to_history` | `boolean` |

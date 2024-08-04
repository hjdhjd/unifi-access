[**unifi-access**](README.md) • **Docs**

***

[Home](README.md) / access-types

# access-types

## Interfaces

### AccessBootstrapConfig

#### Properties

| Property | Modifier | Type |
| ------ | ------ | ------ |
| `extra_type` | `readonly` | `string` |
| `extras` | `readonly` | [`AccessDeviceExtrasConfigInterface`](access-types.md#accessdeviceextrasconfiginterface) |
| `floors` | `readonly` | [`AccessFloorConfigInterface`](access-types.md#accessfloorconfiginterface)[] |
| `full_name` | `readonly` | `string` |
| `level` | `readonly` | `number` |
| `location_type` | `readonly` | `string` |
| `name` | `readonly` | `string` |
| `timezone` | `readonly` | `string` |
| `unique_id` | `readonly` | `string` |
| `up_id` | `readonly` | `string` |
| `work_time` | `readonly` | `string`[] |
| `work_time_id` | `readonly` | `string` |

***

### AccessBootstrapConfigInterface

#### Properties

| Property | Type |
| ------ | ------ |
| `extra_type` | `string` |
| `extras` | [`AccessDeviceExtrasConfigInterface`](access-types.md#accessdeviceextrasconfiginterface) |
| `floors` | [`AccessFloorConfigInterface`](access-types.md#accessfloorconfiginterface)[] |
| `full_name` | `string` |
| `level` | `number` |
| `location_type` | `string` |
| `name` | `string` |
| `timezone` | `string` |
| `unique_id` | `string` |
| `up_id` | `string` |
| `work_time` | `string`[] |
| `work_time_id` | `string` |

***

### AccessControllerConfig

#### Properties

| Property | Modifier | Type |
| ------ | ------ | ------ |
| `adopted_by_uid` | `readonly` | `boolean` |
| `agent_info` | `readonly` | \{ `admin_portal`: `null` \| `string`; `company_id`: `string`; `company_logo`: `string`; `company_name`: `string`; `configured`: `boolean`; `controller_id`: `string`; `current_admin_portal`: `null` \| `string`; `endpoints`: \{ `admin`: `string`; `api`: `string`; `cell_name`: `string`; `core-login`: `string`; \}; `host_device_id`: `string`; `is_access_kua`: `boolean`; `is_install`: `boolean`; `is_kua`: `boolean`; `is_migrating`: `boolean`; `is_running`: `boolean`; `is_setup`: `boolean`; `is_workspace_consistent`: `boolean`; `mqtt_connected`: `boolean`; `site_info`: `null` \| `string`; `software_version`: `string`; `token_valid`: `boolean`; \} |
| `agent_info.admin_portal` | `public` | `null` \| `string` |
| `agent_info.company_id` | `public` | `string` |
| `agent_info.company_logo` | `public` | `string` |
| `agent_info.company_name` | `public` | `string` |
| `agent_info.configured` | `public` | `boolean` |
| `agent_info.controller_id` | `public` | `string` |
| `agent_info.current_admin_portal` | `public` | `null` \| `string` |
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
| `agent_info.site_info` | `public` | `null` \| `string` |
| `agent_info.software_version` | `public` | `string` |
| `agent_info.token_valid` | `public` | `boolean` |
| `bt_config_revision` | `readonly` | `number` |
| `capabilities` | `readonly` | `string`[] |
| `configured` | `readonly` | `boolean` |
| `disabled_by_uid` | `readonly` | `boolean` |
| `has_door_group` | `readonly` | `boolean` |
| `has_top_log` | `readonly` | `number` |
| `host` | `readonly` | \{ `device_type`: `string`; `firmware_version`: `string`; `gateway_ip`: `string`; `hostname`: `string`; `ip`: `string`; `mac`: `string`; `release_channel`: `string`; `shortname`: `string`; `time_zone`: `string`; `uptime`: `number`; `wan_ip`: `string`; \} |
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
| `protect_version` | `readonly` | `string` |
| `root_user_group` | `readonly` | \{ `create_time`: `string`; `name`: `string`; `system_name`: `string`; `unique_id`: `string`; `up_id`: `string`; `up_ids`: `string`[]; \} |
| `root_user_group.create_time` | `public` | `string` |
| `root_user_group.name` | `public` | `string` |
| `root_user_group.system_name` | `public` | `string` |
| `root_user_group.unique_id` | `public` | `string` |
| `root_user_group.up_id` | `public` | `string` |
| `root_user_group.up_ids` | `public` | `string`[] |
| `support_qr_code` | `readonly` | `boolean` |
| `ucore_capabilities` | `readonly` | `string`[] |
| `ui_cdn` | `readonly` | `string` |
| `uid_acess_portal` | `readonly` | `string` |
| `uid_adopt_info` | `readonly` | `null` \| `string` |
| `uid_capabilities` | `readonly` | `string`[] |
| `ulp_capabilities` | `readonly` | `string`[] |
| `ulp_version` | `readonly` | `string` |
| `user_bt_revision` | `readonly` | `number` |
| `version` | `readonly` | `string` |

***

### AccessControllerConfigInterface

#### Properties

| Property | Type |
| ------ | ------ |
| `adopted_by_uid` | `boolean` |
| `agent_info` | \{ `admin_portal`: `null` \| `string`; `company_id`: `string`; `company_logo`: `string`; `company_name`: `string`; `configured`: `boolean`; `controller_id`: `string`; `current_admin_portal`: `null` \| `string`; `endpoints`: \{ `admin`: `string`; `api`: `string`; `cell_name`: `string`; `core-login`: `string`; \}; `host_device_id`: `string`; `is_access_kua`: `boolean`; `is_install`: `boolean`; `is_kua`: `boolean`; `is_migrating`: `boolean`; `is_running`: `boolean`; `is_setup`: `boolean`; `is_workspace_consistent`: `boolean`; `mqtt_connected`: `boolean`; `site_info`: `null` \| `string`; `software_version`: `string`; `token_valid`: `boolean`; \} |
| `agent_info.admin_portal` | `null` \| `string` |
| `agent_info.company_id` | `string` |
| `agent_info.company_logo` | `string` |
| `agent_info.company_name` | `string` |
| `agent_info.configured` | `boolean` |
| `agent_info.controller_id` | `string` |
| `agent_info.current_admin_portal` | `null` \| `string` |
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
| `agent_info.site_info` | `null` \| `string` |
| `agent_info.software_version` | `string` |
| `agent_info.token_valid` | `boolean` |
| `bt_config_revision` | `number` |
| `capabilities` | `string`[] |
| `configured` | `boolean` |
| `disabled_by_uid` | `boolean` |
| `has_door_group` | `boolean` |
| `has_top_log` | `number` |
| `host` | \{ `device_type`: `string`; `firmware_version`: `string`; `gateway_ip`: `string`; `hostname`: `string`; `ip`: `string`; `mac`: `string`; `release_channel`: `string`; `shortname`: `string`; `time_zone`: `string`; `uptime`: `number`; `wan_ip`: `string`; \} |
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
| `protect_version` | `string` |
| `root_user_group` | \{ `create_time`: `string`; `name`: `string`; `system_name`: `string`; `unique_id`: `string`; `up_id`: `string`; `up_ids`: `string`[]; \} |
| `root_user_group.create_time` | `string` |
| `root_user_group.name` | `string` |
| `root_user_group.system_name` | `string` |
| `root_user_group.unique_id` | `string` |
| `root_user_group.up_id` | `string` |
| `root_user_group.up_ids` | `string`[] |
| `support_qr_code` | `boolean` |
| `ucore_capabilities` | `string`[] |
| `ui_cdn` | `string` |
| `uid_acess_portal` | `string` |
| `uid_adopt_info` | `null` \| `string` |
| `uid_capabilities` | `string`[] |
| `ulp_capabilities` | `string`[] |
| `ulp_version` | `string` |
| `user_bt_revision` | `number` |
| `version` | `string` |

***

### AccessControllerConfigPayload

#### Properties

| Property | Type |
| ------ | ------ |
| `adopted_by_uid?` | `DeepPartial`\<`boolean`\> |
| `agent_info?` | `DeepPartial`\<\{ `admin_portal`: `null` \| `string`; `company_id`: `string`; `company_logo`: `string`; `company_name`: `string`; `configured`: `boolean`; `controller_id`: `string`; `current_admin_portal`: `null` \| `string`; `endpoints`: \{ `admin`: `string`; `api`: `string`; `cell_name`: `string`; `core-login`: `string`; \}; `host_device_id`: `string`; `is_access_kua`: `boolean`; `is_install`: `boolean`; `is_kua`: `boolean`; `is_migrating`: `boolean`; `is_running`: `boolean`; `is_setup`: `boolean`; `is_workspace_consistent`: `boolean`; `mqtt_connected`: `boolean`; `site_info`: `null` \| `string`; `software_version`: `string`; `token_valid`: `boolean`; \}\> |
| `bt_config_revision?` | `number` |
| `capabilities?` | `string`[] |
| `configured?` | `DeepPartial`\<`boolean`\> |
| `disabled_by_uid?` | `DeepPartial`\<`boolean`\> |
| `has_door_group?` | `DeepPartial`\<`boolean`\> |
| `has_top_log?` | `number` |
| `host?` | `DeepPartial`\<\{ `device_type`: `string`; `firmware_version`: `string`; `gateway_ip`: `string`; `hostname`: `string`; `ip`: `string`; `mac`: `string`; `release_channel`: `string`; `shortname`: `string`; `time_zone`: `string`; `uptime`: `number`; `wan_ip`: `string`; \}\> |
| `protect_version?` | `string` |
| `root_user_group?` | `DeepPartial`\<\{ `create_time`: `string`; `name`: `string`; `system_name`: `string`; `unique_id`: `string`; `up_id`: `string`; `up_ids`: `string`[]; \}\> |
| `support_qr_code?` | `DeepPartial`\<`boolean`\> |
| `ucore_capabilities?` | `string`[] |
| `ui_cdn?` | `string` |
| `uid_acess_portal?` | `string` |
| `uid_adopt_info?` | `DeepPartial`\<`null` \| `string`\> |
| `uid_capabilities?` | `string`[] |
| `ulp_capabilities?` | `string`[] |
| `ulp_version?` | `string` |
| `user_bt_revision?` | `number` |
| `version?` | `string` |

***

### AccessDeviceConfig

#### Properties

| Property | Modifier | Type |
| ------ | ------ | ------ |
| `adopt_time` | `readonly` | `number` |
| `adopting` | `readonly` | `boolean` |
| `alias` | `readonly` | `string` |
| `bom_rev` | `readonly` | `string` |
| `capabilities` | `readonly` | `string`[] |
| `configs` | `readonly` | [`AccessDeviceEntryConfigInterface`](access-types.md#accessdeviceentryconfiginterface)[] |
| `connected_uah_id` | `readonly` | `string` |
| `device_type` | `readonly` | `string` |
| `display_model` | `readonly` | `string` |
| `door` | `readonly` | \{ `extra_type`: `string`; `extras`: [`AccessDeviceExtrasConfigInterface`](access-types.md#accessdeviceextrasconfiginterface); `full_name`: `string`; `level`: `number`; `location_type`: `string`; `name`: `string`; `timezone`: `string`; `unique_id`: `string`; `up_id`: `string`; `work_time`: `string`[]; `work_time_id`: `string`; \} |
| `door.extra_type` | `public` | `string` |
| `door.extras` | `public` | [`AccessDeviceExtrasConfigInterface`](access-types.md#accessdeviceextrasconfiginterface) |
| `door.full_name` | `public` | `string` |
| `door.level` | `public` | `number` |
| `door.location_type` | `public` | `string` |
| `door.name` | `public` | `string` |
| `door.timezone` | `public` | `string` |
| `door.unique_id` | `public` | `string` |
| `door.up_id` | `public` | `string` |
| `door.work_time` | `public` | `string`[] |
| `door.work_time_id` | `public` | `string` |
| `firmware` | `readonly` | `string` |
| `firmware_update_time` | `readonly` | `number` |
| `floor` | `readonly` | \{ `extra_type`: `string`; `extras`: [`AccessDeviceExtrasConfigInterface`](access-types.md#accessdeviceextrasconfiginterface); `full_name`: `string`; `level`: `number`; `location_type`: `string`; `name`: `string`; `timezone`: `string`; `unique_id`: `string`; `up_id`: `string`; `work_time`: `string`[]; `work_time_id`: `string`; \} |
| `floor.extra_type` | `public` | `string` |
| `floor.extras` | `public` | [`AccessDeviceExtrasConfigInterface`](access-types.md#accessdeviceextrasconfiginterface) |
| `floor.full_name` | `public` | `string` |
| `floor.level` | `public` | `number` |
| `floor.location_type` | `public` | `string` |
| `floor.name` | `public` | `string` |
| `floor.timezone` | `public` | `string` |
| `floor.unique_id` | `public` | `string` |
| `floor.up_id` | `public` | `string` |
| `floor.work_time` | `public` | `string`[] |
| `floor.work_time_id` | `public` | `string` |
| `guid` | `readonly` | `string` |
| `hw_type` | `readonly` | `string` |
| `images` | `readonly` | \{ `l`: `string`; `m`: `string`; `s`: `string`; `xl`: `string`; `xs`: `string`; \} |
| `images.l` | `public` | `string` |
| `images.m` | `public` | `string` |
| `images.s` | `public` | `string` |
| `images.xl` | `public` | `string` |
| `images.xs` | `public` | `string` |
| `ip` | `readonly` | `string` |
| `is_adopted` | `readonly` | `boolean` |
| `is_connected` | `readonly` | `boolean` |
| `is_managed` | `readonly` | `boolean` |
| `is_online` | `readonly` | `boolean` |
| `location` | `readonly` | \{ `extra_type`: `string`; `extras`: [`AccessDeviceExtrasConfigInterface`](access-types.md#accessdeviceextrasconfiginterface); `full_name`: `string`; `level`: `number`; `location_type`: `string`; `name`: `string`; `timezone`: `string`; `unique_id`: `string`; `up_id`: `string`; `work_time`: `string`[]; `work_time_id`: `string`; \} |
| `location.extra_type` | `public` | `string` |
| `location.extras` | `public` | [`AccessDeviceExtrasConfigInterface`](access-types.md#accessdeviceextrasconfiginterface) |
| `location.full_name` | `public` | `string` |
| `location.level` | `public` | `number` |
| `location.location_type` | `public` | `string` |
| `location.name` | `public` | `string` |
| `location.timezone` | `public` | `string` |
| `location.unique_id` | `public` | `string` |
| `location.up_id` | `public` | `string` |
| `location.work_time` | `public` | `string`[] |
| `location.work_time_id` | `public` | `string` |
| `location_id` | `readonly` | `string` |
| `mac` | `readonly` | `string` |
| `model` | `readonly` | `string` |
| `name` | `readonly` | `string` |
| `need_advisory` | `readonly` | `boolean` |
| `resource_name` | `readonly` | `string` |
| `revision` | `readonly` | `number` |
| `revision_update_time` | `readonly` | `number` |
| `security_check` | `readonly` | `boolean` |
| `source` | `readonly` | `string` |
| `start_time` | `readonly` | `number` |
| `unique_id` | `readonly` | `string` |
| `update` | `readonly` | `string` |
| `update_manual` | `readonly` | \{ `device_version_upgrade_status`: \{ `completed`: `boolean`; `failed`: `boolean`; `failure_reason`: `string`; `is_downloading`: `boolean`; `is_upgrading`: `boolean`; `is_waiting`: `boolean`; `timed_out`: `boolean`; `upgrade_seconds`: `number`; \}; `from_version`: `string`; `last_upgrade_failure_reason`: `string`; `last_upgrade_start_time`: `string`; `last_upgrade_success`: `string`; \} |
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
| `version` | `readonly` | `string` |
| `version_update_time` | `readonly` | `number` |

***

### AccessDeviceConfigInterface

#### Properties

| Property | Type |
| ------ | ------ |
| `adopt_time` | `number` |
| `adopting` | `boolean` |
| `alias` | `string` |
| `bom_rev` | `string` |
| `capabilities` | `string`[] |
| `configs` | [`AccessDeviceEntryConfigInterface`](access-types.md#accessdeviceentryconfiginterface)[] |
| `connected_uah_id` | `string` |
| `device_type` | `string` |
| `display_model` | `string` |
| `door` | \{ `extra_type`: `string`; `extras`: [`AccessDeviceExtrasConfigInterface`](access-types.md#accessdeviceextrasconfiginterface); `full_name`: `string`; `level`: `number`; `location_type`: `string`; `name`: `string`; `timezone`: `string`; `unique_id`: `string`; `up_id`: `string`; `work_time`: `string`[]; `work_time_id`: `string`; \} |
| `door.extra_type` | `string` |
| `door.extras` | [`AccessDeviceExtrasConfigInterface`](access-types.md#accessdeviceextrasconfiginterface) |
| `door.full_name` | `string` |
| `door.level` | `number` |
| `door.location_type` | `string` |
| `door.name` | `string` |
| `door.timezone` | `string` |
| `door.unique_id` | `string` |
| `door.up_id` | `string` |
| `door.work_time` | `string`[] |
| `door.work_time_id` | `string` |
| `firmware` | `string` |
| `firmware_update_time` | `number` |
| `floor` | \{ `extra_type`: `string`; `extras`: [`AccessDeviceExtrasConfigInterface`](access-types.md#accessdeviceextrasconfiginterface); `full_name`: `string`; `level`: `number`; `location_type`: `string`; `name`: `string`; `timezone`: `string`; `unique_id`: `string`; `up_id`: `string`; `work_time`: `string`[]; `work_time_id`: `string`; \} |
| `floor.extra_type` | `string` |
| `floor.extras` | [`AccessDeviceExtrasConfigInterface`](access-types.md#accessdeviceextrasconfiginterface) |
| `floor.full_name` | `string` |
| `floor.level` | `number` |
| `floor.location_type` | `string` |
| `floor.name` | `string` |
| `floor.timezone` | `string` |
| `floor.unique_id` | `string` |
| `floor.up_id` | `string` |
| `floor.work_time` | `string`[] |
| `floor.work_time_id` | `string` |
| `guid` | `string` |
| `hw_type` | `string` |
| `images` | \{ `l`: `string`; `m`: `string`; `s`: `string`; `xl`: `string`; `xs`: `string`; \} |
| `images.l` | `string` |
| `images.m` | `string` |
| `images.s` | `string` |
| `images.xl` | `string` |
| `images.xs` | `string` |
| `ip` | `string` |
| `is_adopted` | `boolean` |
| `is_connected` | `boolean` |
| `is_managed` | `boolean` |
| `is_online` | `boolean` |
| `location` | \{ `extra_type`: `string`; `extras`: [`AccessDeviceExtrasConfigInterface`](access-types.md#accessdeviceextrasconfiginterface); `full_name`: `string`; `level`: `number`; `location_type`: `string`; `name`: `string`; `timezone`: `string`; `unique_id`: `string`; `up_id`: `string`; `work_time`: `string`[]; `work_time_id`: `string`; \} |
| `location.extra_type` | `string` |
| `location.extras` | [`AccessDeviceExtrasConfigInterface`](access-types.md#accessdeviceextrasconfiginterface) |
| `location.full_name` | `string` |
| `location.level` | `number` |
| `location.location_type` | `string` |
| `location.name` | `string` |
| `location.timezone` | `string` |
| `location.unique_id` | `string` |
| `location.up_id` | `string` |
| `location.work_time` | `string`[] |
| `location.work_time_id` | `string` |
| `location_id` | `string` |
| `mac` | `string` |
| `model` | `string` |
| `name` | `string` |
| `need_advisory` | `boolean` |
| `resource_name` | `string` |
| `revision` | `number` |
| `revision_update_time` | `number` |
| `security_check` | `boolean` |
| `source` | `string` |
| `start_time` | `number` |
| `unique_id` | `string` |
| `update` | `string` |
| `update_manual` | \{ `device_version_upgrade_status`: \{ `completed`: `boolean`; `failed`: `boolean`; `failure_reason`: `string`; `is_downloading`: `boolean`; `is_upgrading`: `boolean`; `is_waiting`: `boolean`; `timed_out`: `boolean`; `upgrade_seconds`: `number`; \}; `from_version`: `string`; `last_upgrade_failure_reason`: `string`; `last_upgrade_start_time`: `string`; `last_upgrade_success`: `string`; \} |
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
| `version` | `string` |
| `version_update_time` | `number` |

***

### AccessDeviceConfigPayload

#### Properties

| Property | Type |
| ------ | ------ |
| `adopt_time?` | `number` |
| `adopting?` | `DeepPartial`\<`boolean`\> |
| `alias?` | `string` |
| `bom_rev?` | `string` |
| `capabilities?` | `string`[] |
| `configs?` | `DeepPartial`\<[`AccessDeviceEntryConfigInterface`](access-types.md#accessdeviceentryconfiginterface)\>[] |
| `connected_uah_id?` | `string` |
| `device_type?` | `string` |
| `display_model?` | `string` |
| `door?` | `DeepPartial`\<\{ `extra_type`: `string`; `extras`: [`AccessDeviceExtrasConfigInterface`](access-types.md#accessdeviceextrasconfiginterface); `full_name`: `string`; `level`: `number`; `location_type`: `string`; `name`: `string`; `timezone`: `string`; `unique_id`: `string`; `up_id`: `string`; `work_time`: `string`[]; `work_time_id`: `string`; \}\> |
| `firmware?` | `string` |
| `firmware_update_time?` | `number` |
| `floor?` | `DeepPartial`\<\{ `extra_type`: `string`; `extras`: [`AccessDeviceExtrasConfigInterface`](access-types.md#accessdeviceextrasconfiginterface); `full_name`: `string`; `level`: `number`; `location_type`: `string`; `name`: `string`; `timezone`: `string`; `unique_id`: `string`; `up_id`: `string`; `work_time`: `string`[]; `work_time_id`: `string`; \}\> |
| `guid?` | `string` |
| `hw_type?` | `string` |
| `images?` | `DeepPartial`\<\{ `l`: `string`; `m`: `string`; `s`: `string`; `xl`: `string`; `xs`: `string`; \}\> |
| `ip?` | `string` |
| `is_adopted?` | `DeepPartial`\<`boolean`\> |
| `is_connected?` | `DeepPartial`\<`boolean`\> |
| `is_managed?` | `DeepPartial`\<`boolean`\> |
| `is_online?` | `DeepPartial`\<`boolean`\> |
| `location?` | `DeepPartial`\<\{ `extra_type`: `string`; `extras`: [`AccessDeviceExtrasConfigInterface`](access-types.md#accessdeviceextrasconfiginterface); `full_name`: `string`; `level`: `number`; `location_type`: `string`; `name`: `string`; `timezone`: `string`; `unique_id`: `string`; `up_id`: `string`; `work_time`: `string`[]; `work_time_id`: `string`; \}\> |
| `location_id?` | `string` |
| `mac?` | `string` |
| `model?` | `string` |
| `name?` | `string` |
| `need_advisory?` | `DeepPartial`\<`boolean`\> |
| `resource_name?` | `string` |
| `revision?` | `number` |
| `revision_update_time?` | `number` |
| `security_check?` | `DeepPartial`\<`boolean`\> |
| `source?` | `string` |
| `start_time?` | `number` |
| `unique_id?` | `string` |
| `update?` | `string` |
| `update_manual?` | `DeepPartial`\<\{ `device_version_upgrade_status`: \{ `completed`: `boolean`; `failed`: `boolean`; `failure_reason`: `string`; `is_downloading`: `boolean`; `is_upgrading`: `boolean`; `is_waiting`: `boolean`; `timed_out`: `boolean`; `upgrade_seconds`: `number`; \}; `from_version`: `string`; `last_upgrade_failure_reason`: `string`; `last_upgrade_start_time`: `string`; `last_upgrade_success`: `string`; \}\> |
| `version?` | `string` |
| `version_update_time?` | `number` |

***

### AccessDeviceEntryConfig

#### Properties

| Property | Modifier | Type |
| ------ | ------ | ------ |
| `device_id` | `readonly` | `string` |
| `key` | `readonly` | `string` |
| `source` | `readonly` | `string` |
| `tag` | `readonly` | `string` |
| `value` | `readonly` | `string` |

***

### AccessDeviceEntryConfigInterface

#### Properties

| Property | Type |
| ------ | ------ |
| `device_id` | `string` |
| `key` | `string` |
| `source` | `string` |
| `tag` | `string` |
| `value` | `string` |

***

### AccessDeviceEntryConfigPayload

#### Properties

| Property | Type |
| ------ | ------ |
| `device_id?` | `string` |
| `key?` | `string` |
| `source?` | `string` |
| `tag?` | `string` |
| `value?` | `string` |

***

### AccessDeviceExtrasConfigInterface

#### Properties

| Property | Type |
| ------ | ------ |
| `door_thumbnail` | `string` |
| `door_thumbnail_last_update` | `number` |
| `uah-input_state_dps` | `boolean` |
| `uah-wiring_state_dps-neg` | `boolean` |
| `uah-wiring_state_dps-pos` | `boolean` |

***

### AccessDoorConfig

#### Properties

| Property | Modifier | Type |
| ------ | ------ | ------ |
| `camera_resource_ids` | `readonly` | `string`[] |
| `device_groups` | `readonly` | [`AccessDeviceConfigInterface`](access-types.md#accessdeviceconfiginterface)[] |
| `door_guard` | `readonly` | `string`[] |
| `extra_type` | `readonly` | `string` |
| `extras` | `readonly` | [`AccessDeviceExtrasConfigInterface`](access-types.md#accessdeviceextrasconfiginterface) |
| `full_name` | `readonly` | `string` |
| `hotel_devices` | `readonly` | `string`[] |
| `level` | `readonly` | `number` |
| `location_type` | `readonly` | `string` |
| `name` | `readonly` | `string` |
| `timezone` | `readonly` | `string` |
| `unique_id` | `readonly` | `string` |
| `up_id` | `readonly` | `string` |
| `work_time` | `readonly` | `string`[] |
| `work_time_id` | `readonly` | `string` |

***

### AccessDoorConfigInterface

#### Properties

| Property | Type |
| ------ | ------ |
| `camera_resource_ids` | `string`[] |
| `device_groups` | [`AccessDeviceConfigInterface`](access-types.md#accessdeviceconfiginterface)[] |
| `door_guard` | `string`[] |
| `extra_type` | `string` |
| `extras` | [`AccessDeviceExtrasConfigInterface`](access-types.md#accessdeviceextrasconfiginterface) |
| `full_name` | `string` |
| `hotel_devices` | `string`[] |
| `level` | `number` |
| `location_type` | `string` |
| `name` | `string` |
| `timezone` | `string` |
| `unique_id` | `string` |
| `up_id` | `string` |
| `work_time` | `string`[] |
| `work_time_id` | `string` |

***

### AccessDoorConfigPayload

#### Properties

| Property | Type |
| ------ | ------ |
| `camera_resource_ids?` | `string`[] |
| `device_groups?` | `DeepPartial`\<[`AccessDeviceConfigInterface`](access-types.md#accessdeviceconfiginterface)\>[] |
| `door_guard?` | `string`[] |
| `extra_type?` | `string` |
| `extras?` | `DeepPartial`\<[`AccessDeviceExtrasConfigInterface`](access-types.md#accessdeviceextrasconfiginterface)\> |
| `full_name?` | `string` |
| `hotel_devices?` | `string`[] |
| `level?` | `number` |
| `location_type?` | `string` |
| `name?` | `string` |
| `timezone?` | `string` |
| `unique_id?` | `string` |
| `up_id?` | `string` |
| `work_time?` | `string`[] |
| `work_time_id?` | `string` |

***

### AccessFloorConfig

#### Properties

| Property | Modifier | Type |
| ------ | ------ | ------ |
| `doors` | `readonly` | [`AccessDoorConfigInterface`](access-types.md#accessdoorconfiginterface)[] |
| `extra_type` | `readonly` | `string` |
| `extras` | `readonly` | [`AccessDeviceExtrasConfigInterface`](access-types.md#accessdeviceextrasconfiginterface) |
| `full_name` | `readonly` | `string` |
| `level` | `readonly` | `number` |
| `location_type` | `readonly` | `string` |
| `name` | `readonly` | `string` |
| `timezone` | `readonly` | `string` |
| `unique_id` | `readonly` | `string` |
| `up_id` | `readonly` | `string` |
| `work_time` | `readonly` | `string`[] |
| `work_time_id` | `readonly` | `string` |

***

### AccessFloorConfigInterface

#### Properties

| Property | Type |
| ------ | ------ |
| `doors` | [`AccessDoorConfigInterface`](access-types.md#accessdoorconfiginterface)[] |
| `extra_type` | `string` |
| `extras` | [`AccessDeviceExtrasConfigInterface`](access-types.md#accessdeviceextrasconfiginterface) |
| `full_name` | `string` |
| `level` | `number` |
| `location_type` | `string` |
| `name` | `string` |
| `timezone` | `string` |
| `unique_id` | `string` |
| `up_id` | `string` |
| `work_time` | `string`[] |
| `work_time_id` | `string` |

***

### AccessFloorConfigPayload

#### Properties

| Property | Type |
| ------ | ------ |
| `doors?` | `DeepPartial`\<[`AccessDoorConfigInterface`](access-types.md#accessdoorconfiginterface)\>[] |
| `extra_type?` | `string` |
| `extras?` | `DeepPartial`\<[`AccessDeviceExtrasConfigInterface`](access-types.md#accessdeviceextrasconfiginterface)\> |
| `full_name?` | `string` |
| `level?` | `number` |
| `location_type?` | `string` |
| `name?` | `string` |
| `timezone?` | `string` |
| `unique_id?` | `string` |
| `up_id?` | `string` |
| `work_time?` | `string`[] |
| `work_time_id?` | `string` |

## Type Aliases

### AccessApiResponse

```ts
type AccessApiResponse: {
  code: number;
  codeS: string;
  data: Record<string, unknown> | Record<string, unknown>[] | string;
  error: string;
  msg: string;
};
```

UniFi Access API response JSON.

#### Type declaration

| Name | Type |
| ------ | ------ |
| `code` | `number` |
| `codeS` | `string` |
| `data` | `Record`\<`string`, `unknown`\> \| `Record`\<`string`, `unknown`\>[] \| `string` |
| `error` | `string` |
| `msg` | `string` |

***

### AccessEventDoorbellCancel

```ts
type AccessEventDoorbellCancel: {
  reason_code: number;
  remote_call_request_id: string;
};
```

#### Type declaration

| Name | Type |
| ------ | ------ |
| `reason_code` | `number` |
| `remote_call_request_id` | `string` |

***

### AccessEventDoorbellRing

```ts
type AccessEventDoorbellRing: {
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

#### Type declaration

| Name | Type |
| ------ | ------ |
| `channel` | `string` |
| `clear_request_id` | `string` |
| `connected_uah_id` | `string` |
| `connected_uah_type` | `string` |
| `controller_id` | `string` |
| `create_time` | `number` |
| `device_id` | `string` |
| `device_name` | `string` |
| `device_type` | `string` |
| `door_guard_ids` | `string`[] |
| `door_name` | `string` |
| `floor_name` | `string` |
| `host_device_mac` | `string` |
| `in_or_out` | `string` |
| `reason_code` | `number` |
| `request_id` | `string` |
| `room_id` | `string` |
| `support_feature` | `string`[] |
| `token` | `string` |

***

### AccessEventPacket

```ts
type AccessEventPacket: {
  data: Record<string, string> | Record<string, unknown> | AccessControllerConfig | AccessDeviceConfig;
  event: string;
  event_object_id: string;
  receiver_id: string;
  save_to_history: boolean;
};
```

UniFi Access event packet.

#### Type declaration

| Name | Type |
| ------ | ------ |
| `data` | `Record`\<`string`, `string`\> \| `Record`\<`string`, `unknown`\> \| [`AccessControllerConfig`](access-types.md#accesscontrollerconfig) \| [`AccessDeviceConfig`](access-types.md#accessdeviceconfig) |
| `event` | `string` |
| `event_object_id` | `string` |
| `receiver_id` | `string` |
| `save_to_history` | `boolean` |

#### Param

Access event topic.

#### Param

Access event payload.

#### Remarks

A UniFi Access event packet is the representation of a notification event from a UniFi Access controller. The Access `event` property informs us of the
notification type, such as `access.data.device.remote_unlock`, for door unlock events. The details of the event are delivered as a JSON payload in the `data`
property.

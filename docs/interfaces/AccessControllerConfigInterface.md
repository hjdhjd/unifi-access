[unifi-access](../README.md) / [Exports](../modules.md) / AccessControllerConfigInterface

# Interface: AccessControllerConfigInterface

## Table of contents

### Properties

- [adopted\_by\_uid](AccessControllerConfigInterface.md#adopted_by_uid)
- [agent\_info](AccessControllerConfigInterface.md#agent_info)
- [bt\_config\_revision](AccessControllerConfigInterface.md#bt_config_revision)
- [capabilities](AccessControllerConfigInterface.md#capabilities)
- [configured](AccessControllerConfigInterface.md#configured)
- [disabled\_by\_uid](AccessControllerConfigInterface.md#disabled_by_uid)
- [has\_door\_group](AccessControllerConfigInterface.md#has_door_group)
- [has\_top\_log](AccessControllerConfigInterface.md#has_top_log)
- [host](AccessControllerConfigInterface.md#host)
- [protect\_version](AccessControllerConfigInterface.md#protect_version)
- [root\_user\_group](AccessControllerConfigInterface.md#root_user_group)
- [support\_qr\_code](AccessControllerConfigInterface.md#support_qr_code)
- [ucore\_capabilities](AccessControllerConfigInterface.md#ucore_capabilities)
- [ui\_cdn](AccessControllerConfigInterface.md#ui_cdn)
- [uid\_acess\_portal](AccessControllerConfigInterface.md#uid_acess_portal)
- [uid\_adopt\_info](AccessControllerConfigInterface.md#uid_adopt_info)
- [uid\_capabilities](AccessControllerConfigInterface.md#uid_capabilities)
- [ulp\_capabilities](AccessControllerConfigInterface.md#ulp_capabilities)
- [ulp\_version](AccessControllerConfigInterface.md#ulp_version)
- [user\_bt\_revision](AccessControllerConfigInterface.md#user_bt_revision)
- [version](AccessControllerConfigInterface.md#version)

## Properties

### adopted\_by\_uid

• **adopted\_by\_uid**: `boolean`

#### Defined in

[src/access-types.ts:88](https://github.com/hjdhjd/unifi-access/blob/0e21590/src/access-types.ts#L88)

___

### agent\_info

• **agent\_info**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `admin_portal` | ``null`` \| `string` |
| `company_id` | `string` |
| `company_logo` | `string` |
| `company_name` | `string` |
| `configured` | `boolean` |
| `controller_id` | `string` |
| `current_admin_portal` | ``null`` \| `string` |
| `endpoints` | \{ `admin`: `string` ; `api`: `string` ; `cell_name`: `string` ; `core-login`: `string`  } |
| `endpoints.admin` | `string` |
| `endpoints.api` | `string` |
| `endpoints.cell_name` | `string` |
| `endpoints.core-login` | `string` |
| `host_device_id` | `string` |
| `is_access_kua` | `boolean` |
| `is_install` | `boolean` |
| `is_kua` | `boolean` |
| `is_migrating` | `boolean` |
| `is_running` | `boolean` |
| `is_setup` | `boolean` |
| `is_workspace_consistent` | `boolean` |
| `mqtt_connected` | `boolean` |
| `site_info` | ``null`` \| `string` |
| `software_version` | `string` |
| `token_valid` | `boolean` |

#### Defined in

[src/access-types.ts:89](https://github.com/hjdhjd/unifi-access/blob/0e21590/src/access-types.ts#L89)

___

### bt\_config\_revision

• **bt\_config\_revision**: `number`

#### Defined in

[src/access-types.ts:118](https://github.com/hjdhjd/unifi-access/blob/0e21590/src/access-types.ts#L118)

___

### capabilities

• **capabilities**: `string`[]

#### Defined in

[src/access-types.ts:119](https://github.com/hjdhjd/unifi-access/blob/0e21590/src/access-types.ts#L119)

___

### configured

• **configured**: `boolean`

#### Defined in

[src/access-types.ts:120](https://github.com/hjdhjd/unifi-access/blob/0e21590/src/access-types.ts#L120)

___

### disabled\_by\_uid

• **disabled\_by\_uid**: `boolean`

#### Defined in

[src/access-types.ts:121](https://github.com/hjdhjd/unifi-access/blob/0e21590/src/access-types.ts#L121)

___

### has\_door\_group

• **has\_door\_group**: `boolean`

#### Defined in

[src/access-types.ts:122](https://github.com/hjdhjd/unifi-access/blob/0e21590/src/access-types.ts#L122)

___

### has\_top\_log

• **has\_top\_log**: `number`

#### Defined in

[src/access-types.ts:123](https://github.com/hjdhjd/unifi-access/blob/0e21590/src/access-types.ts#L123)

___

### host

• **host**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `device_type` | `string` |
| `firmware_version` | `string` |
| `gateway_ip` | `string` |
| `hostname` | `string` |
| `ip` | `string` |
| `mac` | `string` |
| `release_channel` | `string` |
| `shortname` | `string` |
| `time_zone` | `string` |
| `uptime` | `number` |
| `wan_ip` | `string` |

#### Defined in

[src/access-types.ts:124](https://github.com/hjdhjd/unifi-access/blob/0e21590/src/access-types.ts#L124)

___

### protect\_version

• **protect\_version**: `string`

#### Defined in

[src/access-types.ts:138](https://github.com/hjdhjd/unifi-access/blob/0e21590/src/access-types.ts#L138)

___

### root\_user\_group

• **root\_user\_group**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `create_time` | `string` |
| `name` | `string` |
| `system_name` | `string` |
| `unique_id` | `string` |
| `up_id` | `string` |
| `up_ids` | `string`[] |

#### Defined in

[src/access-types.ts:139](https://github.com/hjdhjd/unifi-access/blob/0e21590/src/access-types.ts#L139)

___

### support\_qr\_code

• **support\_qr\_code**: `boolean`

#### Defined in

[src/access-types.ts:148](https://github.com/hjdhjd/unifi-access/blob/0e21590/src/access-types.ts#L148)

___

### ucore\_capabilities

• **ucore\_capabilities**: `string`[]

#### Defined in

[src/access-types.ts:149](https://github.com/hjdhjd/unifi-access/blob/0e21590/src/access-types.ts#L149)

___

### ui\_cdn

• **ui\_cdn**: `string`

#### Defined in

[src/access-types.ts:150](https://github.com/hjdhjd/unifi-access/blob/0e21590/src/access-types.ts#L150)

___

### uid\_acess\_portal

• **uid\_acess\_portal**: `string`

#### Defined in

[src/access-types.ts:151](https://github.com/hjdhjd/unifi-access/blob/0e21590/src/access-types.ts#L151)

___

### uid\_adopt\_info

• **uid\_adopt\_info**: ``null`` \| `string`

#### Defined in

[src/access-types.ts:152](https://github.com/hjdhjd/unifi-access/blob/0e21590/src/access-types.ts#L152)

___

### uid\_capabilities

• **uid\_capabilities**: `string`[]

#### Defined in

[src/access-types.ts:153](https://github.com/hjdhjd/unifi-access/blob/0e21590/src/access-types.ts#L153)

___

### ulp\_capabilities

• **ulp\_capabilities**: `string`[]

#### Defined in

[src/access-types.ts:154](https://github.com/hjdhjd/unifi-access/blob/0e21590/src/access-types.ts#L154)

___

### ulp\_version

• **ulp\_version**: `string`

#### Defined in

[src/access-types.ts:155](https://github.com/hjdhjd/unifi-access/blob/0e21590/src/access-types.ts#L155)

___

### user\_bt\_revision

• **user\_bt\_revision**: `number`

#### Defined in

[src/access-types.ts:156](https://github.com/hjdhjd/unifi-access/blob/0e21590/src/access-types.ts#L156)

___

### version

• **version**: `string`

#### Defined in

[src/access-types.ts:157](https://github.com/hjdhjd/unifi-access/blob/0e21590/src/access-types.ts#L157)

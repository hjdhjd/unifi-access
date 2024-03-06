[unifi-access](../README.md) / [Exports](../modules.md) / AccessDeviceConfigInterface

# Interface: AccessDeviceConfigInterface

## Table of contents

### Properties

- [adopt\_time](AccessDeviceConfigInterface.md#adopt_time)
- [adopting](AccessDeviceConfigInterface.md#adopting)
- [alias](AccessDeviceConfigInterface.md#alias)
- [bom\_rev](AccessDeviceConfigInterface.md#bom_rev)
- [capabilities](AccessDeviceConfigInterface.md#capabilities)
- [configs](AccessDeviceConfigInterface.md#configs)
- [connected\_uah\_id](AccessDeviceConfigInterface.md#connected_uah_id)
- [device\_type](AccessDeviceConfigInterface.md#device_type)
- [display\_model](AccessDeviceConfigInterface.md#display_model)
- [door](AccessDeviceConfigInterface.md#door)
- [firmware](AccessDeviceConfigInterface.md#firmware)
- [firmware\_update\_time](AccessDeviceConfigInterface.md#firmware_update_time)
- [floor](AccessDeviceConfigInterface.md#floor)
- [guid](AccessDeviceConfigInterface.md#guid)
- [hw\_type](AccessDeviceConfigInterface.md#hw_type)
- [images](AccessDeviceConfigInterface.md#images)
- [ip](AccessDeviceConfigInterface.md#ip)
- [is\_adopted](AccessDeviceConfigInterface.md#is_adopted)
- [is\_connected](AccessDeviceConfigInterface.md#is_connected)
- [is\_managed](AccessDeviceConfigInterface.md#is_managed)
- [is\_online](AccessDeviceConfigInterface.md#is_online)
- [location](AccessDeviceConfigInterface.md#location)
- [location\_id](AccessDeviceConfigInterface.md#location_id)
- [mac](AccessDeviceConfigInterface.md#mac)
- [model](AccessDeviceConfigInterface.md#model)
- [name](AccessDeviceConfigInterface.md#name)
- [need\_advisory](AccessDeviceConfigInterface.md#need_advisory)
- [resource\_name](AccessDeviceConfigInterface.md#resource_name)
- [revision](AccessDeviceConfigInterface.md#revision)
- [revision\_update\_time](AccessDeviceConfigInterface.md#revision_update_time)
- [security\_check](AccessDeviceConfigInterface.md#security_check)
- [source](AccessDeviceConfigInterface.md#source)
- [start\_time](AccessDeviceConfigInterface.md#start_time)
- [unique\_id](AccessDeviceConfigInterface.md#unique_id)
- [update](AccessDeviceConfigInterface.md#update)
- [update\_manual](AccessDeviceConfigInterface.md#update_manual)
- [version](AccessDeviceConfigInterface.md#version)
- [version\_update\_time](AccessDeviceConfigInterface.md#version_update_time)

## Properties

### adopt\_time

• **adopt\_time**: `number`

#### Defined in

[src/access-types.ts:40](https://github.com/hjdhjd/unifi-access/blob/870bfaa/src/access-types.ts#L40)

___

### adopting

• **adopting**: `boolean`

#### Defined in

[src/access-types.ts:41](https://github.com/hjdhjd/unifi-access/blob/870bfaa/src/access-types.ts#L41)

___

### alias

• **alias**: `string`

#### Defined in

[src/access-types.ts:42](https://github.com/hjdhjd/unifi-access/blob/870bfaa/src/access-types.ts#L42)

___

### bom\_rev

• **bom\_rev**: `string`

#### Defined in

[src/access-types.ts:43](https://github.com/hjdhjd/unifi-access/blob/870bfaa/src/access-types.ts#L43)

___

### capabilities

• **capabilities**: `string`[]

#### Defined in

[src/access-types.ts:44](https://github.com/hjdhjd/unifi-access/blob/870bfaa/src/access-types.ts#L44)

___

### configs

• **configs**: [`AccessDeviceEntryConfigInterface`](AccessDeviceEntryConfigInterface.md)[]

#### Defined in

[src/access-types.ts:48](https://github.com/hjdhjd/unifi-access/blob/870bfaa/src/access-types.ts#L48)

___

### connected\_uah\_id

• **connected\_uah\_id**: `string`

#### Defined in

[src/access-types.ts:45](https://github.com/hjdhjd/unifi-access/blob/870bfaa/src/access-types.ts#L45)

___

### device\_type

• **device\_type**: `string`

#### Defined in

[src/access-types.ts:46](https://github.com/hjdhjd/unifi-access/blob/870bfaa/src/access-types.ts#L46)

___

### display\_model

• **display\_model**: `string`

#### Defined in

[src/access-types.ts:47](https://github.com/hjdhjd/unifi-access/blob/870bfaa/src/access-types.ts#L47)

___

### door

• **door**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `extra_type` | `string` |
| `extras` | [`AccessDeviceExtrasConfigInterface`](AccessDeviceExtrasConfigInterface.md) |
| `full_name` | `string` |
| `level` | `number` |
| `location_type` | `string` |
| `name` | `string` |
| `timezone` | `string` |
| `unique_id` | `string` |
| `up_id` | `string` |
| `work_time` | `string`[] |
| `work_time_id` | `string` |

#### Defined in

[src/access-types.ts:49](https://github.com/hjdhjd/unifi-access/blob/870bfaa/src/access-types.ts#L49)

___

### firmware

• **firmware**: `string`

#### Defined in

[src/access-types.ts:64](https://github.com/hjdhjd/unifi-access/blob/870bfaa/src/access-types.ts#L64)

___

### firmware\_update\_time

• **firmware\_update\_time**: `number`

#### Defined in

[src/access-types.ts:63](https://github.com/hjdhjd/unifi-access/blob/870bfaa/src/access-types.ts#L63)

___

### floor

• **floor**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `extra_type` | `string` |
| `extras` | [`AccessDeviceExtrasConfigInterface`](AccessDeviceExtrasConfigInterface.md) |
| `full_name` | `string` |
| `level` | `number` |
| `location_type` | `string` |
| `name` | `string` |
| `timezone` | `string` |
| `unique_id` | `string` |
| `up_id` | `string` |
| `work_time` | `string`[] |
| `work_time_id` | `string` |

#### Defined in

[src/access-types.ts:65](https://github.com/hjdhjd/unifi-access/blob/870bfaa/src/access-types.ts#L65)

___

### guid

• **guid**: `string`

#### Defined in

[src/access-types.ts:79](https://github.com/hjdhjd/unifi-access/blob/870bfaa/src/access-types.ts#L79)

___

### hw\_type

• **hw\_type**: `string`

#### Defined in

[src/access-types.ts:80](https://github.com/hjdhjd/unifi-access/blob/870bfaa/src/access-types.ts#L80)

___

### images

• **images**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `l` | `string` |
| `m` | `string` |
| `s` | `string` |
| `xl` | `string` |
| `xs` | `string` |

#### Defined in

[src/access-types.ts:81](https://github.com/hjdhjd/unifi-access/blob/870bfaa/src/access-types.ts#L81)

___

### ip

• **ip**: `string`

#### Defined in

[src/access-types.ts:89](https://github.com/hjdhjd/unifi-access/blob/870bfaa/src/access-types.ts#L89)

___

### is\_adopted

• **is\_adopted**: `boolean`

#### Defined in

[src/access-types.ts:90](https://github.com/hjdhjd/unifi-access/blob/870bfaa/src/access-types.ts#L90)

___

### is\_connected

• **is\_connected**: `boolean`

#### Defined in

[src/access-types.ts:91](https://github.com/hjdhjd/unifi-access/blob/870bfaa/src/access-types.ts#L91)

___

### is\_managed

• **is\_managed**: `boolean`

#### Defined in

[src/access-types.ts:92](https://github.com/hjdhjd/unifi-access/blob/870bfaa/src/access-types.ts#L92)

___

### is\_online

• **is\_online**: `boolean`

#### Defined in

[src/access-types.ts:93](https://github.com/hjdhjd/unifi-access/blob/870bfaa/src/access-types.ts#L93)

___

### location

• **location**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `extra_type` | `string` |
| `extras` | [`AccessDeviceExtrasConfigInterface`](AccessDeviceExtrasConfigInterface.md) |
| `full_name` | `string` |
| `level` | `number` |
| `location_type` | `string` |
| `name` | `string` |
| `timezone` | `string` |
| `unique_id` | `string` |
| `up_id` | `string` |
| `work_time` | `string`[] |
| `work_time_id` | `string` |

#### Defined in

[src/access-types.ts:94](https://github.com/hjdhjd/unifi-access/blob/870bfaa/src/access-types.ts#L94)

___

### location\_id

• **location\_id**: `string`

#### Defined in

[src/access-types.ts:108](https://github.com/hjdhjd/unifi-access/blob/870bfaa/src/access-types.ts#L108)

___

### mac

• **mac**: `string`

#### Defined in

[src/access-types.ts:109](https://github.com/hjdhjd/unifi-access/blob/870bfaa/src/access-types.ts#L109)

___

### model

• **model**: `string`

#### Defined in

[src/access-types.ts:110](https://github.com/hjdhjd/unifi-access/blob/870bfaa/src/access-types.ts#L110)

___

### name

• **name**: `string`

#### Defined in

[src/access-types.ts:111](https://github.com/hjdhjd/unifi-access/blob/870bfaa/src/access-types.ts#L111)

___

### need\_advisory

• **need\_advisory**: `boolean`

#### Defined in

[src/access-types.ts:112](https://github.com/hjdhjd/unifi-access/blob/870bfaa/src/access-types.ts#L112)

___

### resource\_name

• **resource\_name**: `string`

#### Defined in

[src/access-types.ts:113](https://github.com/hjdhjd/unifi-access/blob/870bfaa/src/access-types.ts#L113)

___

### revision

• **revision**: `number`

#### Defined in

[src/access-types.ts:115](https://github.com/hjdhjd/unifi-access/blob/870bfaa/src/access-types.ts#L115)

___

### revision\_update\_time

• **revision\_update\_time**: `number`

#### Defined in

[src/access-types.ts:114](https://github.com/hjdhjd/unifi-access/blob/870bfaa/src/access-types.ts#L114)

___

### security\_check

• **security\_check**: `boolean`

#### Defined in

[src/access-types.ts:116](https://github.com/hjdhjd/unifi-access/blob/870bfaa/src/access-types.ts#L116)

___

### source

• **source**: `string`

#### Defined in

[src/access-types.ts:117](https://github.com/hjdhjd/unifi-access/blob/870bfaa/src/access-types.ts#L117)

___

### start\_time

• **start\_time**: `number`

#### Defined in

[src/access-types.ts:118](https://github.com/hjdhjd/unifi-access/blob/870bfaa/src/access-types.ts#L118)

___

### unique\_id

• **unique\_id**: `string`

#### Defined in

[src/access-types.ts:119](https://github.com/hjdhjd/unifi-access/blob/870bfaa/src/access-types.ts#L119)

___

### update

• **update**: `string`

#### Defined in

[src/access-types.ts:120](https://github.com/hjdhjd/unifi-access/blob/870bfaa/src/access-types.ts#L120)

___

### update\_manual

• **update\_manual**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `device_version_upgrade_status` | \{ `completed`: `boolean` ; `failed`: `boolean` ; `failure_reason`: `string` ; `is_downloading`: `boolean` ; `is_upgrading`: `boolean` ; `is_waiting`: `boolean` ; `timed_out`: `boolean` ; `upgrade_seconds`: `number`  } |
| `device_version_upgrade_status.completed` | `boolean` |
| `device_version_upgrade_status.failed` | `boolean` |
| `device_version_upgrade_status.failure_reason` | `string` |
| `device_version_upgrade_status.is_downloading` | `boolean` |
| `device_version_upgrade_status.is_upgrading` | `boolean` |
| `device_version_upgrade_status.is_waiting` | `boolean` |
| `device_version_upgrade_status.timed_out` | `boolean` |
| `device_version_upgrade_status.upgrade_seconds` | `number` |
| `from_version` | `string` |
| `last_upgrade_failure_reason` | `string` |
| `last_upgrade_start_time` | `string` |
| `last_upgrade_success` | `string` |

#### Defined in

[src/access-types.ts:121](https://github.com/hjdhjd/unifi-access/blob/870bfaa/src/access-types.ts#L121)

___

### version

• **version**: `string`

#### Defined in

[src/access-types.ts:141](https://github.com/hjdhjd/unifi-access/blob/870bfaa/src/access-types.ts#L141)

___

### version\_update\_time

• **version\_update\_time**: `number`

#### Defined in

[src/access-types.ts:140](https://github.com/hjdhjd/unifi-access/blob/870bfaa/src/access-types.ts#L140)

[unifi-access](../README.md) / [Exports](../modules.md) / AccessDeviceConfig

# Interface: AccessDeviceConfig

## Table of contents

### Properties

- [adopt\_time](AccessDeviceConfig.md#adopt_time)
- [adopting](AccessDeviceConfig.md#adopting)
- [alias](AccessDeviceConfig.md#alias)
- [bom\_rev](AccessDeviceConfig.md#bom_rev)
- [capabilities](AccessDeviceConfig.md#capabilities)
- [configs](AccessDeviceConfig.md#configs)
- [connected\_uah\_id](AccessDeviceConfig.md#connected_uah_id)
- [device\_type](AccessDeviceConfig.md#device_type)
- [display\_model](AccessDeviceConfig.md#display_model)
- [door](AccessDeviceConfig.md#door)
- [firmware](AccessDeviceConfig.md#firmware)
- [firmware\_update\_time](AccessDeviceConfig.md#firmware_update_time)
- [floor](AccessDeviceConfig.md#floor)
- [guid](AccessDeviceConfig.md#guid)
- [hw\_type](AccessDeviceConfig.md#hw_type)
- [images](AccessDeviceConfig.md#images)
- [ip](AccessDeviceConfig.md#ip)
- [is\_adopted](AccessDeviceConfig.md#is_adopted)
- [is\_connected](AccessDeviceConfig.md#is_connected)
- [is\_managed](AccessDeviceConfig.md#is_managed)
- [is\_online](AccessDeviceConfig.md#is_online)
- [location](AccessDeviceConfig.md#location)
- [location\_id](AccessDeviceConfig.md#location_id)
- [mac](AccessDeviceConfig.md#mac)
- [model](AccessDeviceConfig.md#model)
- [name](AccessDeviceConfig.md#name)
- [need\_advisory](AccessDeviceConfig.md#need_advisory)
- [resource\_name](AccessDeviceConfig.md#resource_name)
- [revision](AccessDeviceConfig.md#revision)
- [revision\_update\_time](AccessDeviceConfig.md#revision_update_time)
- [security\_check](AccessDeviceConfig.md#security_check)
- [source](AccessDeviceConfig.md#source)
- [start\_time](AccessDeviceConfig.md#start_time)
- [unique\_id](AccessDeviceConfig.md#unique_id)
- [update](AccessDeviceConfig.md#update)
- [update\_manual](AccessDeviceConfig.md#update_manual)
- [version](AccessDeviceConfig.md#version)
- [version\_update\_time](AccessDeviceConfig.md#version_update_time)

## Properties

### adopt\_time

• `Readonly` **adopt\_time**: `number`

#### Defined in

[src/access-types.ts:40](https://github.com/hjdhjd/unifi-access/blob/870bfaa/src/access-types.ts#L40)

___

### adopting

• `Readonly` **adopting**: `boolean`

#### Defined in

[src/access-types.ts:41](https://github.com/hjdhjd/unifi-access/blob/870bfaa/src/access-types.ts#L41)

___

### alias

• `Readonly` **alias**: `string`

#### Defined in

[src/access-types.ts:42](https://github.com/hjdhjd/unifi-access/blob/870bfaa/src/access-types.ts#L42)

___

### bom\_rev

• `Readonly` **bom\_rev**: `string`

#### Defined in

[src/access-types.ts:43](https://github.com/hjdhjd/unifi-access/blob/870bfaa/src/access-types.ts#L43)

___

### capabilities

• `Readonly` **capabilities**: `string`[]

#### Defined in

[src/access-types.ts:44](https://github.com/hjdhjd/unifi-access/blob/870bfaa/src/access-types.ts#L44)

___

### configs

• `Readonly` **configs**: [`AccessDeviceEntryConfigInterface`](AccessDeviceEntryConfigInterface.md)[]

#### Defined in

[src/access-types.ts:48](https://github.com/hjdhjd/unifi-access/blob/870bfaa/src/access-types.ts#L48)

___

### connected\_uah\_id

• `Readonly` **connected\_uah\_id**: `string`

#### Defined in

[src/access-types.ts:45](https://github.com/hjdhjd/unifi-access/blob/870bfaa/src/access-types.ts#L45)

___

### device\_type

• `Readonly` **device\_type**: `string`

#### Defined in

[src/access-types.ts:46](https://github.com/hjdhjd/unifi-access/blob/870bfaa/src/access-types.ts#L46)

___

### display\_model

• `Readonly` **display\_model**: `string`

#### Defined in

[src/access-types.ts:47](https://github.com/hjdhjd/unifi-access/blob/870bfaa/src/access-types.ts#L47)

___

### door

• `Readonly` **door**: `Object`

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

• `Readonly` **firmware**: `string`

#### Defined in

[src/access-types.ts:64](https://github.com/hjdhjd/unifi-access/blob/870bfaa/src/access-types.ts#L64)

___

### firmware\_update\_time

• `Readonly` **firmware\_update\_time**: `number`

#### Defined in

[src/access-types.ts:63](https://github.com/hjdhjd/unifi-access/blob/870bfaa/src/access-types.ts#L63)

___

### floor

• `Readonly` **floor**: `Object`

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

• `Readonly` **guid**: `string`

#### Defined in

[src/access-types.ts:79](https://github.com/hjdhjd/unifi-access/blob/870bfaa/src/access-types.ts#L79)

___

### hw\_type

• `Readonly` **hw\_type**: `string`

#### Defined in

[src/access-types.ts:80](https://github.com/hjdhjd/unifi-access/blob/870bfaa/src/access-types.ts#L80)

___

### images

• `Readonly` **images**: `Object`

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

• `Readonly` **ip**: `string`

#### Defined in

[src/access-types.ts:89](https://github.com/hjdhjd/unifi-access/blob/870bfaa/src/access-types.ts#L89)

___

### is\_adopted

• `Readonly` **is\_adopted**: `boolean`

#### Defined in

[src/access-types.ts:90](https://github.com/hjdhjd/unifi-access/blob/870bfaa/src/access-types.ts#L90)

___

### is\_connected

• `Readonly` **is\_connected**: `boolean`

#### Defined in

[src/access-types.ts:91](https://github.com/hjdhjd/unifi-access/blob/870bfaa/src/access-types.ts#L91)

___

### is\_managed

• `Readonly` **is\_managed**: `boolean`

#### Defined in

[src/access-types.ts:92](https://github.com/hjdhjd/unifi-access/blob/870bfaa/src/access-types.ts#L92)

___

### is\_online

• `Readonly` **is\_online**: `boolean`

#### Defined in

[src/access-types.ts:93](https://github.com/hjdhjd/unifi-access/blob/870bfaa/src/access-types.ts#L93)

___

### location

• `Readonly` **location**: `Object`

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

• `Readonly` **location\_id**: `string`

#### Defined in

[src/access-types.ts:108](https://github.com/hjdhjd/unifi-access/blob/870bfaa/src/access-types.ts#L108)

___

### mac

• `Readonly` **mac**: `string`

#### Defined in

[src/access-types.ts:109](https://github.com/hjdhjd/unifi-access/blob/870bfaa/src/access-types.ts#L109)

___

### model

• `Readonly` **model**: `string`

#### Defined in

[src/access-types.ts:110](https://github.com/hjdhjd/unifi-access/blob/870bfaa/src/access-types.ts#L110)

___

### name

• `Readonly` **name**: `string`

#### Defined in

[src/access-types.ts:111](https://github.com/hjdhjd/unifi-access/blob/870bfaa/src/access-types.ts#L111)

___

### need\_advisory

• `Readonly` **need\_advisory**: `boolean`

#### Defined in

[src/access-types.ts:112](https://github.com/hjdhjd/unifi-access/blob/870bfaa/src/access-types.ts#L112)

___

### resource\_name

• `Readonly` **resource\_name**: `string`

#### Defined in

[src/access-types.ts:113](https://github.com/hjdhjd/unifi-access/blob/870bfaa/src/access-types.ts#L113)

___

### revision

• `Readonly` **revision**: `number`

#### Defined in

[src/access-types.ts:115](https://github.com/hjdhjd/unifi-access/blob/870bfaa/src/access-types.ts#L115)

___

### revision\_update\_time

• `Readonly` **revision\_update\_time**: `number`

#### Defined in

[src/access-types.ts:114](https://github.com/hjdhjd/unifi-access/blob/870bfaa/src/access-types.ts#L114)

___

### security\_check

• `Readonly` **security\_check**: `boolean`

#### Defined in

[src/access-types.ts:116](https://github.com/hjdhjd/unifi-access/blob/870bfaa/src/access-types.ts#L116)

___

### source

• `Readonly` **source**: `string`

#### Defined in

[src/access-types.ts:117](https://github.com/hjdhjd/unifi-access/blob/870bfaa/src/access-types.ts#L117)

___

### start\_time

• `Readonly` **start\_time**: `number`

#### Defined in

[src/access-types.ts:118](https://github.com/hjdhjd/unifi-access/blob/870bfaa/src/access-types.ts#L118)

___

### unique\_id

• `Readonly` **unique\_id**: `string`

#### Defined in

[src/access-types.ts:119](https://github.com/hjdhjd/unifi-access/blob/870bfaa/src/access-types.ts#L119)

___

### update

• `Readonly` **update**: `string`

#### Defined in

[src/access-types.ts:120](https://github.com/hjdhjd/unifi-access/blob/870bfaa/src/access-types.ts#L120)

___

### update\_manual

• `Readonly` **update\_manual**: `Object`

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

• `Readonly` **version**: `string`

#### Defined in

[src/access-types.ts:141](https://github.com/hjdhjd/unifi-access/blob/870bfaa/src/access-types.ts#L141)

___

### version\_update\_time

• `Readonly` **version\_update\_time**: `number`

#### Defined in

[src/access-types.ts:140](https://github.com/hjdhjd/unifi-access/blob/870bfaa/src/access-types.ts#L140)

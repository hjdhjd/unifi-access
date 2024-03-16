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

[src/access-types.ts:163](https://github.com/hjdhjd/unifi-access/blob/197fbda/src/access-types.ts#L163)

___

### adopting

• `Readonly` **adopting**: `boolean`

#### Defined in

[src/access-types.ts:164](https://github.com/hjdhjd/unifi-access/blob/197fbda/src/access-types.ts#L164)

___

### alias

• `Readonly` **alias**: `string`

#### Defined in

[src/access-types.ts:165](https://github.com/hjdhjd/unifi-access/blob/197fbda/src/access-types.ts#L165)

___

### bom\_rev

• `Readonly` **bom\_rev**: `string`

#### Defined in

[src/access-types.ts:166](https://github.com/hjdhjd/unifi-access/blob/197fbda/src/access-types.ts#L166)

___

### capabilities

• `Readonly` **capabilities**: `string`[]

#### Defined in

[src/access-types.ts:167](https://github.com/hjdhjd/unifi-access/blob/197fbda/src/access-types.ts#L167)

___

### configs

• `Readonly` **configs**: [`AccessDeviceEntryConfigInterface`](AccessDeviceEntryConfigInterface.md)[]

#### Defined in

[src/access-types.ts:171](https://github.com/hjdhjd/unifi-access/blob/197fbda/src/access-types.ts#L171)

___

### connected\_uah\_id

• `Readonly` **connected\_uah\_id**: `string`

#### Defined in

[src/access-types.ts:168](https://github.com/hjdhjd/unifi-access/blob/197fbda/src/access-types.ts#L168)

___

### device\_type

• `Readonly` **device\_type**: `string`

#### Defined in

[src/access-types.ts:169](https://github.com/hjdhjd/unifi-access/blob/197fbda/src/access-types.ts#L169)

___

### display\_model

• `Readonly` **display\_model**: `string`

#### Defined in

[src/access-types.ts:170](https://github.com/hjdhjd/unifi-access/blob/197fbda/src/access-types.ts#L170)

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

[src/access-types.ts:172](https://github.com/hjdhjd/unifi-access/blob/197fbda/src/access-types.ts#L172)

___

### firmware

• `Readonly` **firmware**: `string`

#### Defined in

[src/access-types.ts:187](https://github.com/hjdhjd/unifi-access/blob/197fbda/src/access-types.ts#L187)

___

### firmware\_update\_time

• `Readonly` **firmware\_update\_time**: `number`

#### Defined in

[src/access-types.ts:186](https://github.com/hjdhjd/unifi-access/blob/197fbda/src/access-types.ts#L186)

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

[src/access-types.ts:188](https://github.com/hjdhjd/unifi-access/blob/197fbda/src/access-types.ts#L188)

___

### guid

• `Readonly` **guid**: `string`

#### Defined in

[src/access-types.ts:202](https://github.com/hjdhjd/unifi-access/blob/197fbda/src/access-types.ts#L202)

___

### hw\_type

• `Readonly` **hw\_type**: `string`

#### Defined in

[src/access-types.ts:203](https://github.com/hjdhjd/unifi-access/blob/197fbda/src/access-types.ts#L203)

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

[src/access-types.ts:204](https://github.com/hjdhjd/unifi-access/blob/197fbda/src/access-types.ts#L204)

___

### ip

• `Readonly` **ip**: `string`

#### Defined in

[src/access-types.ts:212](https://github.com/hjdhjd/unifi-access/blob/197fbda/src/access-types.ts#L212)

___

### is\_adopted

• `Readonly` **is\_adopted**: `boolean`

#### Defined in

[src/access-types.ts:213](https://github.com/hjdhjd/unifi-access/blob/197fbda/src/access-types.ts#L213)

___

### is\_connected

• `Readonly` **is\_connected**: `boolean`

#### Defined in

[src/access-types.ts:214](https://github.com/hjdhjd/unifi-access/blob/197fbda/src/access-types.ts#L214)

___

### is\_managed

• `Readonly` **is\_managed**: `boolean`

#### Defined in

[src/access-types.ts:215](https://github.com/hjdhjd/unifi-access/blob/197fbda/src/access-types.ts#L215)

___

### is\_online

• `Readonly` **is\_online**: `boolean`

#### Defined in

[src/access-types.ts:216](https://github.com/hjdhjd/unifi-access/blob/197fbda/src/access-types.ts#L216)

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

[src/access-types.ts:217](https://github.com/hjdhjd/unifi-access/blob/197fbda/src/access-types.ts#L217)

___

### location\_id

• `Readonly` **location\_id**: `string`

#### Defined in

[src/access-types.ts:231](https://github.com/hjdhjd/unifi-access/blob/197fbda/src/access-types.ts#L231)

___

### mac

• `Readonly` **mac**: `string`

#### Defined in

[src/access-types.ts:232](https://github.com/hjdhjd/unifi-access/blob/197fbda/src/access-types.ts#L232)

___

### model

• `Readonly` **model**: `string`

#### Defined in

[src/access-types.ts:233](https://github.com/hjdhjd/unifi-access/blob/197fbda/src/access-types.ts#L233)

___

### name

• `Readonly` **name**: `string`

#### Defined in

[src/access-types.ts:234](https://github.com/hjdhjd/unifi-access/blob/197fbda/src/access-types.ts#L234)

___

### need\_advisory

• `Readonly` **need\_advisory**: `boolean`

#### Defined in

[src/access-types.ts:235](https://github.com/hjdhjd/unifi-access/blob/197fbda/src/access-types.ts#L235)

___

### resource\_name

• `Readonly` **resource\_name**: `string`

#### Defined in

[src/access-types.ts:236](https://github.com/hjdhjd/unifi-access/blob/197fbda/src/access-types.ts#L236)

___

### revision

• `Readonly` **revision**: `number`

#### Defined in

[src/access-types.ts:238](https://github.com/hjdhjd/unifi-access/blob/197fbda/src/access-types.ts#L238)

___

### revision\_update\_time

• `Readonly` **revision\_update\_time**: `number`

#### Defined in

[src/access-types.ts:237](https://github.com/hjdhjd/unifi-access/blob/197fbda/src/access-types.ts#L237)

___

### security\_check

• `Readonly` **security\_check**: `boolean`

#### Defined in

[src/access-types.ts:239](https://github.com/hjdhjd/unifi-access/blob/197fbda/src/access-types.ts#L239)

___

### source

• `Readonly` **source**: `string`

#### Defined in

[src/access-types.ts:240](https://github.com/hjdhjd/unifi-access/blob/197fbda/src/access-types.ts#L240)

___

### start\_time

• `Readonly` **start\_time**: `number`

#### Defined in

[src/access-types.ts:241](https://github.com/hjdhjd/unifi-access/blob/197fbda/src/access-types.ts#L241)

___

### unique\_id

• `Readonly` **unique\_id**: `string`

#### Defined in

[src/access-types.ts:242](https://github.com/hjdhjd/unifi-access/blob/197fbda/src/access-types.ts#L242)

___

### update

• `Readonly` **update**: `string`

#### Defined in

[src/access-types.ts:243](https://github.com/hjdhjd/unifi-access/blob/197fbda/src/access-types.ts#L243)

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

[src/access-types.ts:244](https://github.com/hjdhjd/unifi-access/blob/197fbda/src/access-types.ts#L244)

___

### version

• `Readonly` **version**: `string`

#### Defined in

[src/access-types.ts:264](https://github.com/hjdhjd/unifi-access/blob/197fbda/src/access-types.ts#L264)

___

### version\_update\_time

• `Readonly` **version\_update\_time**: `number`

#### Defined in

[src/access-types.ts:263](https://github.com/hjdhjd/unifi-access/blob/197fbda/src/access-types.ts#L263)

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

[src/access-types.ts:163](https://github.com/hjdhjd/unifi-access/blob/197fbda/src/access-types.ts#L163)

___

### adopting

• **adopting**: `boolean`

#### Defined in

[src/access-types.ts:164](https://github.com/hjdhjd/unifi-access/blob/197fbda/src/access-types.ts#L164)

___

### alias

• **alias**: `string`

#### Defined in

[src/access-types.ts:165](https://github.com/hjdhjd/unifi-access/blob/197fbda/src/access-types.ts#L165)

___

### bom\_rev

• **bom\_rev**: `string`

#### Defined in

[src/access-types.ts:166](https://github.com/hjdhjd/unifi-access/blob/197fbda/src/access-types.ts#L166)

___

### capabilities

• **capabilities**: `string`[]

#### Defined in

[src/access-types.ts:167](https://github.com/hjdhjd/unifi-access/blob/197fbda/src/access-types.ts#L167)

___

### configs

• **configs**: [`AccessDeviceEntryConfigInterface`](AccessDeviceEntryConfigInterface.md)[]

#### Defined in

[src/access-types.ts:171](https://github.com/hjdhjd/unifi-access/blob/197fbda/src/access-types.ts#L171)

___

### connected\_uah\_id

• **connected\_uah\_id**: `string`

#### Defined in

[src/access-types.ts:168](https://github.com/hjdhjd/unifi-access/blob/197fbda/src/access-types.ts#L168)

___

### device\_type

• **device\_type**: `string`

#### Defined in

[src/access-types.ts:169](https://github.com/hjdhjd/unifi-access/blob/197fbda/src/access-types.ts#L169)

___

### display\_model

• **display\_model**: `string`

#### Defined in

[src/access-types.ts:170](https://github.com/hjdhjd/unifi-access/blob/197fbda/src/access-types.ts#L170)

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

[src/access-types.ts:172](https://github.com/hjdhjd/unifi-access/blob/197fbda/src/access-types.ts#L172)

___

### firmware

• **firmware**: `string`

#### Defined in

[src/access-types.ts:187](https://github.com/hjdhjd/unifi-access/blob/197fbda/src/access-types.ts#L187)

___

### firmware\_update\_time

• **firmware\_update\_time**: `number`

#### Defined in

[src/access-types.ts:186](https://github.com/hjdhjd/unifi-access/blob/197fbda/src/access-types.ts#L186)

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

[src/access-types.ts:188](https://github.com/hjdhjd/unifi-access/blob/197fbda/src/access-types.ts#L188)

___

### guid

• **guid**: `string`

#### Defined in

[src/access-types.ts:202](https://github.com/hjdhjd/unifi-access/blob/197fbda/src/access-types.ts#L202)

___

### hw\_type

• **hw\_type**: `string`

#### Defined in

[src/access-types.ts:203](https://github.com/hjdhjd/unifi-access/blob/197fbda/src/access-types.ts#L203)

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

[src/access-types.ts:204](https://github.com/hjdhjd/unifi-access/blob/197fbda/src/access-types.ts#L204)

___

### ip

• **ip**: `string`

#### Defined in

[src/access-types.ts:212](https://github.com/hjdhjd/unifi-access/blob/197fbda/src/access-types.ts#L212)

___

### is\_adopted

• **is\_adopted**: `boolean`

#### Defined in

[src/access-types.ts:213](https://github.com/hjdhjd/unifi-access/blob/197fbda/src/access-types.ts#L213)

___

### is\_connected

• **is\_connected**: `boolean`

#### Defined in

[src/access-types.ts:214](https://github.com/hjdhjd/unifi-access/blob/197fbda/src/access-types.ts#L214)

___

### is\_managed

• **is\_managed**: `boolean`

#### Defined in

[src/access-types.ts:215](https://github.com/hjdhjd/unifi-access/blob/197fbda/src/access-types.ts#L215)

___

### is\_online

• **is\_online**: `boolean`

#### Defined in

[src/access-types.ts:216](https://github.com/hjdhjd/unifi-access/blob/197fbda/src/access-types.ts#L216)

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

[src/access-types.ts:217](https://github.com/hjdhjd/unifi-access/blob/197fbda/src/access-types.ts#L217)

___

### location\_id

• **location\_id**: `string`

#### Defined in

[src/access-types.ts:231](https://github.com/hjdhjd/unifi-access/blob/197fbda/src/access-types.ts#L231)

___

### mac

• **mac**: `string`

#### Defined in

[src/access-types.ts:232](https://github.com/hjdhjd/unifi-access/blob/197fbda/src/access-types.ts#L232)

___

### model

• **model**: `string`

#### Defined in

[src/access-types.ts:233](https://github.com/hjdhjd/unifi-access/blob/197fbda/src/access-types.ts#L233)

___

### name

• **name**: `string`

#### Defined in

[src/access-types.ts:234](https://github.com/hjdhjd/unifi-access/blob/197fbda/src/access-types.ts#L234)

___

### need\_advisory

• **need\_advisory**: `boolean`

#### Defined in

[src/access-types.ts:235](https://github.com/hjdhjd/unifi-access/blob/197fbda/src/access-types.ts#L235)

___

### resource\_name

• **resource\_name**: `string`

#### Defined in

[src/access-types.ts:236](https://github.com/hjdhjd/unifi-access/blob/197fbda/src/access-types.ts#L236)

___

### revision

• **revision**: `number`

#### Defined in

[src/access-types.ts:238](https://github.com/hjdhjd/unifi-access/blob/197fbda/src/access-types.ts#L238)

___

### revision\_update\_time

• **revision\_update\_time**: `number`

#### Defined in

[src/access-types.ts:237](https://github.com/hjdhjd/unifi-access/blob/197fbda/src/access-types.ts#L237)

___

### security\_check

• **security\_check**: `boolean`

#### Defined in

[src/access-types.ts:239](https://github.com/hjdhjd/unifi-access/blob/197fbda/src/access-types.ts#L239)

___

### source

• **source**: `string`

#### Defined in

[src/access-types.ts:240](https://github.com/hjdhjd/unifi-access/blob/197fbda/src/access-types.ts#L240)

___

### start\_time

• **start\_time**: `number`

#### Defined in

[src/access-types.ts:241](https://github.com/hjdhjd/unifi-access/blob/197fbda/src/access-types.ts#L241)

___

### unique\_id

• **unique\_id**: `string`

#### Defined in

[src/access-types.ts:242](https://github.com/hjdhjd/unifi-access/blob/197fbda/src/access-types.ts#L242)

___

### update

• **update**: `string`

#### Defined in

[src/access-types.ts:243](https://github.com/hjdhjd/unifi-access/blob/197fbda/src/access-types.ts#L243)

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

[src/access-types.ts:244](https://github.com/hjdhjd/unifi-access/blob/197fbda/src/access-types.ts#L244)

___

### version

• **version**: `string`

#### Defined in

[src/access-types.ts:264](https://github.com/hjdhjd/unifi-access/blob/197fbda/src/access-types.ts#L264)

___

### version\_update\_time

• **version\_update\_time**: `number`

#### Defined in

[src/access-types.ts:263](https://github.com/hjdhjd/unifi-access/blob/197fbda/src/access-types.ts#L263)

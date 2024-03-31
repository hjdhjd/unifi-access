[unifi-access](../README.md) / [Exports](../modules.md) / AccessDeviceConfigPayload

# Interface: AccessDeviceConfigPayload

## Table of contents

### Properties

- [adopt\_time](AccessDeviceConfigPayload.md#adopt_time)
- [adopting](AccessDeviceConfigPayload.md#adopting)
- [alias](AccessDeviceConfigPayload.md#alias)
- [bom\_rev](AccessDeviceConfigPayload.md#bom_rev)
- [capabilities](AccessDeviceConfigPayload.md#capabilities)
- [configs](AccessDeviceConfigPayload.md#configs)
- [connected\_uah\_id](AccessDeviceConfigPayload.md#connected_uah_id)
- [device\_type](AccessDeviceConfigPayload.md#device_type)
- [display\_model](AccessDeviceConfigPayload.md#display_model)
- [door](AccessDeviceConfigPayload.md#door)
- [firmware](AccessDeviceConfigPayload.md#firmware)
- [firmware\_update\_time](AccessDeviceConfigPayload.md#firmware_update_time)
- [floor](AccessDeviceConfigPayload.md#floor)
- [guid](AccessDeviceConfigPayload.md#guid)
- [hw\_type](AccessDeviceConfigPayload.md#hw_type)
- [images](AccessDeviceConfigPayload.md#images)
- [ip](AccessDeviceConfigPayload.md#ip)
- [is\_adopted](AccessDeviceConfigPayload.md#is_adopted)
- [is\_connected](AccessDeviceConfigPayload.md#is_connected)
- [is\_managed](AccessDeviceConfigPayload.md#is_managed)
- [is\_online](AccessDeviceConfigPayload.md#is_online)
- [location](AccessDeviceConfigPayload.md#location)
- [location\_id](AccessDeviceConfigPayload.md#location_id)
- [mac](AccessDeviceConfigPayload.md#mac)
- [model](AccessDeviceConfigPayload.md#model)
- [name](AccessDeviceConfigPayload.md#name)
- [need\_advisory](AccessDeviceConfigPayload.md#need_advisory)
- [resource\_name](AccessDeviceConfigPayload.md#resource_name)
- [revision](AccessDeviceConfigPayload.md#revision)
- [revision\_update\_time](AccessDeviceConfigPayload.md#revision_update_time)
- [security\_check](AccessDeviceConfigPayload.md#security_check)
- [source](AccessDeviceConfigPayload.md#source)
- [start\_time](AccessDeviceConfigPayload.md#start_time)
- [unique\_id](AccessDeviceConfigPayload.md#unique_id)
- [update](AccessDeviceConfigPayload.md#update)
- [update\_manual](AccessDeviceConfigPayload.md#update_manual)
- [version](AccessDeviceConfigPayload.md#version)
- [version\_update\_time](AccessDeviceConfigPayload.md#version_update_time)

## Properties

### adopt\_time

• `Optional` **adopt\_time**: `number`

#### Defined in

[src/access-types.ts:163](https://github.com/hjdhjd/unifi-access/blob/e0dcb0f/src/access-types.ts#L163)

___

### adopting

• `Optional` **adopting**: `DeepPartial`\<`boolean`\>

#### Defined in

[src/access-types.ts:164](https://github.com/hjdhjd/unifi-access/blob/e0dcb0f/src/access-types.ts#L164)

___

### alias

• `Optional` **alias**: `string`

#### Defined in

[src/access-types.ts:165](https://github.com/hjdhjd/unifi-access/blob/e0dcb0f/src/access-types.ts#L165)

___

### bom\_rev

• `Optional` **bom\_rev**: `string`

#### Defined in

[src/access-types.ts:166](https://github.com/hjdhjd/unifi-access/blob/e0dcb0f/src/access-types.ts#L166)

___

### capabilities

• `Optional` **capabilities**: `string`[]

#### Defined in

[src/access-types.ts:167](https://github.com/hjdhjd/unifi-access/blob/e0dcb0f/src/access-types.ts#L167)

___

### configs

• `Optional` **configs**: `DeepPartial`\<[`AccessDeviceEntryConfigInterface`](AccessDeviceEntryConfigInterface.md)\>[]

#### Defined in

[src/access-types.ts:171](https://github.com/hjdhjd/unifi-access/blob/e0dcb0f/src/access-types.ts#L171)

___

### connected\_uah\_id

• `Optional` **connected\_uah\_id**: `string`

#### Defined in

[src/access-types.ts:168](https://github.com/hjdhjd/unifi-access/blob/e0dcb0f/src/access-types.ts#L168)

___

### device\_type

• `Optional` **device\_type**: `string`

#### Defined in

[src/access-types.ts:169](https://github.com/hjdhjd/unifi-access/blob/e0dcb0f/src/access-types.ts#L169)

___

### display\_model

• `Optional` **display\_model**: `string`

#### Defined in

[src/access-types.ts:170](https://github.com/hjdhjd/unifi-access/blob/e0dcb0f/src/access-types.ts#L170)

___

### door

• `Optional` **door**: `DeepPartial`\<\{ `extra_type`: `string` ; `extras`: [`AccessDeviceExtrasConfigInterface`](AccessDeviceExtrasConfigInterface.md) ; `full_name`: `string` ; `level`: `number` ; `location_type`: `string` ; `name`: `string` ; `timezone`: `string` ; `unique_id`: `string` ; `up_id`: `string` ; `work_time`: `string`[] ; `work_time_id`: `string`  }\>

#### Defined in

[src/access-types.ts:172](https://github.com/hjdhjd/unifi-access/blob/e0dcb0f/src/access-types.ts#L172)

___

### firmware

• `Optional` **firmware**: `string`

#### Defined in

[src/access-types.ts:187](https://github.com/hjdhjd/unifi-access/blob/e0dcb0f/src/access-types.ts#L187)

___

### firmware\_update\_time

• `Optional` **firmware\_update\_time**: `number`

#### Defined in

[src/access-types.ts:186](https://github.com/hjdhjd/unifi-access/blob/e0dcb0f/src/access-types.ts#L186)

___

### floor

• `Optional` **floor**: `DeepPartial`\<\{ `extra_type`: `string` ; `extras`: [`AccessDeviceExtrasConfigInterface`](AccessDeviceExtrasConfigInterface.md) ; `full_name`: `string` ; `level`: `number` ; `location_type`: `string` ; `name`: `string` ; `timezone`: `string` ; `unique_id`: `string` ; `up_id`: `string` ; `work_time`: `string`[] ; `work_time_id`: `string`  }\>

#### Defined in

[src/access-types.ts:188](https://github.com/hjdhjd/unifi-access/blob/e0dcb0f/src/access-types.ts#L188)

___

### guid

• `Optional` **guid**: `string`

#### Defined in

[src/access-types.ts:202](https://github.com/hjdhjd/unifi-access/blob/e0dcb0f/src/access-types.ts#L202)

___

### hw\_type

• `Optional` **hw\_type**: `string`

#### Defined in

[src/access-types.ts:203](https://github.com/hjdhjd/unifi-access/blob/e0dcb0f/src/access-types.ts#L203)

___

### images

• `Optional` **images**: `DeepPartial`\<\{ `l`: `string` ; `m`: `string` ; `s`: `string` ; `xl`: `string` ; `xs`: `string`  }\>

#### Defined in

[src/access-types.ts:204](https://github.com/hjdhjd/unifi-access/blob/e0dcb0f/src/access-types.ts#L204)

___

### ip

• `Optional` **ip**: `string`

#### Defined in

[src/access-types.ts:212](https://github.com/hjdhjd/unifi-access/blob/e0dcb0f/src/access-types.ts#L212)

___

### is\_adopted

• `Optional` **is\_adopted**: `DeepPartial`\<`boolean`\>

#### Defined in

[src/access-types.ts:213](https://github.com/hjdhjd/unifi-access/blob/e0dcb0f/src/access-types.ts#L213)

___

### is\_connected

• `Optional` **is\_connected**: `DeepPartial`\<`boolean`\>

#### Defined in

[src/access-types.ts:214](https://github.com/hjdhjd/unifi-access/blob/e0dcb0f/src/access-types.ts#L214)

___

### is\_managed

• `Optional` **is\_managed**: `DeepPartial`\<`boolean`\>

#### Defined in

[src/access-types.ts:215](https://github.com/hjdhjd/unifi-access/blob/e0dcb0f/src/access-types.ts#L215)

___

### is\_online

• `Optional` **is\_online**: `DeepPartial`\<`boolean`\>

#### Defined in

[src/access-types.ts:216](https://github.com/hjdhjd/unifi-access/blob/e0dcb0f/src/access-types.ts#L216)

___

### location

• `Optional` **location**: `DeepPartial`\<\{ `extra_type`: `string` ; `extras`: [`AccessDeviceExtrasConfigInterface`](AccessDeviceExtrasConfigInterface.md) ; `full_name`: `string` ; `level`: `number` ; `location_type`: `string` ; `name`: `string` ; `timezone`: `string` ; `unique_id`: `string` ; `up_id`: `string` ; `work_time`: `string`[] ; `work_time_id`: `string`  }\>

#### Defined in

[src/access-types.ts:217](https://github.com/hjdhjd/unifi-access/blob/e0dcb0f/src/access-types.ts#L217)

___

### location\_id

• `Optional` **location\_id**: `string`

#### Defined in

[src/access-types.ts:231](https://github.com/hjdhjd/unifi-access/blob/e0dcb0f/src/access-types.ts#L231)

___

### mac

• `Optional` **mac**: `string`

#### Defined in

[src/access-types.ts:232](https://github.com/hjdhjd/unifi-access/blob/e0dcb0f/src/access-types.ts#L232)

___

### model

• `Optional` **model**: `string`

#### Defined in

[src/access-types.ts:233](https://github.com/hjdhjd/unifi-access/blob/e0dcb0f/src/access-types.ts#L233)

___

### name

• `Optional` **name**: `string`

#### Defined in

[src/access-types.ts:234](https://github.com/hjdhjd/unifi-access/blob/e0dcb0f/src/access-types.ts#L234)

___

### need\_advisory

• `Optional` **need\_advisory**: `DeepPartial`\<`boolean`\>

#### Defined in

[src/access-types.ts:235](https://github.com/hjdhjd/unifi-access/blob/e0dcb0f/src/access-types.ts#L235)

___

### resource\_name

• `Optional` **resource\_name**: `string`

#### Defined in

[src/access-types.ts:236](https://github.com/hjdhjd/unifi-access/blob/e0dcb0f/src/access-types.ts#L236)

___

### revision

• `Optional` **revision**: `number`

#### Defined in

[src/access-types.ts:238](https://github.com/hjdhjd/unifi-access/blob/e0dcb0f/src/access-types.ts#L238)

___

### revision\_update\_time

• `Optional` **revision\_update\_time**: `number`

#### Defined in

[src/access-types.ts:237](https://github.com/hjdhjd/unifi-access/blob/e0dcb0f/src/access-types.ts#L237)

___

### security\_check

• `Optional` **security\_check**: `DeepPartial`\<`boolean`\>

#### Defined in

[src/access-types.ts:239](https://github.com/hjdhjd/unifi-access/blob/e0dcb0f/src/access-types.ts#L239)

___

### source

• `Optional` **source**: `string`

#### Defined in

[src/access-types.ts:240](https://github.com/hjdhjd/unifi-access/blob/e0dcb0f/src/access-types.ts#L240)

___

### start\_time

• `Optional` **start\_time**: `number`

#### Defined in

[src/access-types.ts:241](https://github.com/hjdhjd/unifi-access/blob/e0dcb0f/src/access-types.ts#L241)

___

### unique\_id

• `Optional` **unique\_id**: `string`

#### Defined in

[src/access-types.ts:242](https://github.com/hjdhjd/unifi-access/blob/e0dcb0f/src/access-types.ts#L242)

___

### update

• `Optional` **update**: `string`

#### Defined in

[src/access-types.ts:243](https://github.com/hjdhjd/unifi-access/blob/e0dcb0f/src/access-types.ts#L243)

___

### update\_manual

• `Optional` **update\_manual**: `DeepPartial`\<\{ `device_version_upgrade_status`: \{ `completed`: `boolean` ; `failed`: `boolean` ; `failure_reason`: `string` ; `is_downloading`: `boolean` ; `is_upgrading`: `boolean` ; `is_waiting`: `boolean` ; `timed_out`: `boolean` ; `upgrade_seconds`: `number`  } ; `from_version`: `string` ; `last_upgrade_failure_reason`: `string` ; `last_upgrade_start_time`: `string` ; `last_upgrade_success`: `string`  }\>

#### Defined in

[src/access-types.ts:244](https://github.com/hjdhjd/unifi-access/blob/e0dcb0f/src/access-types.ts#L244)

___

### version

• `Optional` **version**: `string`

#### Defined in

[src/access-types.ts:264](https://github.com/hjdhjd/unifi-access/blob/e0dcb0f/src/access-types.ts#L264)

___

### version\_update\_time

• `Optional` **version\_update\_time**: `number`

#### Defined in

[src/access-types.ts:263](https://github.com/hjdhjd/unifi-access/blob/e0dcb0f/src/access-types.ts#L263)

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

[src/access-types.ts:40](https://github.com/hjdhjd/unifi-access/blob/870bfaa/src/access-types.ts#L40)

___

### adopting

• `Optional` **adopting**: `DeepPartial`\<`boolean`\>

#### Defined in

[src/access-types.ts:41](https://github.com/hjdhjd/unifi-access/blob/870bfaa/src/access-types.ts#L41)

___

### alias

• `Optional` **alias**: `string`

#### Defined in

[src/access-types.ts:42](https://github.com/hjdhjd/unifi-access/blob/870bfaa/src/access-types.ts#L42)

___

### bom\_rev

• `Optional` **bom\_rev**: `string`

#### Defined in

[src/access-types.ts:43](https://github.com/hjdhjd/unifi-access/blob/870bfaa/src/access-types.ts#L43)

___

### capabilities

• `Optional` **capabilities**: `string`[]

#### Defined in

[src/access-types.ts:44](https://github.com/hjdhjd/unifi-access/blob/870bfaa/src/access-types.ts#L44)

___

### configs

• `Optional` **configs**: `DeepPartial`\<[`AccessDeviceEntryConfigInterface`](AccessDeviceEntryConfigInterface.md)\>[]

#### Defined in

[src/access-types.ts:48](https://github.com/hjdhjd/unifi-access/blob/870bfaa/src/access-types.ts#L48)

___

### connected\_uah\_id

• `Optional` **connected\_uah\_id**: `string`

#### Defined in

[src/access-types.ts:45](https://github.com/hjdhjd/unifi-access/blob/870bfaa/src/access-types.ts#L45)

___

### device\_type

• `Optional` **device\_type**: `string`

#### Defined in

[src/access-types.ts:46](https://github.com/hjdhjd/unifi-access/blob/870bfaa/src/access-types.ts#L46)

___

### display\_model

• `Optional` **display\_model**: `string`

#### Defined in

[src/access-types.ts:47](https://github.com/hjdhjd/unifi-access/blob/870bfaa/src/access-types.ts#L47)

___

### door

• `Optional` **door**: `DeepPartial`\<\{ `extra_type`: `string` ; `extras`: [`AccessDeviceExtrasConfigInterface`](AccessDeviceExtrasConfigInterface.md) ; `full_name`: `string` ; `level`: `number` ; `location_type`: `string` ; `name`: `string` ; `timezone`: `string` ; `unique_id`: `string` ; `up_id`: `string` ; `work_time`: `string`[] ; `work_time_id`: `string`  }\>

#### Defined in

[src/access-types.ts:49](https://github.com/hjdhjd/unifi-access/blob/870bfaa/src/access-types.ts#L49)

___

### firmware

• `Optional` **firmware**: `string`

#### Defined in

[src/access-types.ts:64](https://github.com/hjdhjd/unifi-access/blob/870bfaa/src/access-types.ts#L64)

___

### firmware\_update\_time

• `Optional` **firmware\_update\_time**: `number`

#### Defined in

[src/access-types.ts:63](https://github.com/hjdhjd/unifi-access/blob/870bfaa/src/access-types.ts#L63)

___

### floor

• `Optional` **floor**: `DeepPartial`\<\{ `extra_type`: `string` ; `extras`: [`AccessDeviceExtrasConfigInterface`](AccessDeviceExtrasConfigInterface.md) ; `full_name`: `string` ; `level`: `number` ; `location_type`: `string` ; `name`: `string` ; `timezone`: `string` ; `unique_id`: `string` ; `up_id`: `string` ; `work_time`: `string`[] ; `work_time_id`: `string`  }\>

#### Defined in

[src/access-types.ts:65](https://github.com/hjdhjd/unifi-access/blob/870bfaa/src/access-types.ts#L65)

___

### guid

• `Optional` **guid**: `string`

#### Defined in

[src/access-types.ts:79](https://github.com/hjdhjd/unifi-access/blob/870bfaa/src/access-types.ts#L79)

___

### hw\_type

• `Optional` **hw\_type**: `string`

#### Defined in

[src/access-types.ts:80](https://github.com/hjdhjd/unifi-access/blob/870bfaa/src/access-types.ts#L80)

___

### images

• `Optional` **images**: `DeepPartial`\<\{ `l`: `string` ; `m`: `string` ; `s`: `string` ; `xl`: `string` ; `xs`: `string`  }\>

#### Defined in

[src/access-types.ts:81](https://github.com/hjdhjd/unifi-access/blob/870bfaa/src/access-types.ts#L81)

___

### ip

• `Optional` **ip**: `string`

#### Defined in

[src/access-types.ts:89](https://github.com/hjdhjd/unifi-access/blob/870bfaa/src/access-types.ts#L89)

___

### is\_adopted

• `Optional` **is\_adopted**: `DeepPartial`\<`boolean`\>

#### Defined in

[src/access-types.ts:90](https://github.com/hjdhjd/unifi-access/blob/870bfaa/src/access-types.ts#L90)

___

### is\_connected

• `Optional` **is\_connected**: `DeepPartial`\<`boolean`\>

#### Defined in

[src/access-types.ts:91](https://github.com/hjdhjd/unifi-access/blob/870bfaa/src/access-types.ts#L91)

___

### is\_managed

• `Optional` **is\_managed**: `DeepPartial`\<`boolean`\>

#### Defined in

[src/access-types.ts:92](https://github.com/hjdhjd/unifi-access/blob/870bfaa/src/access-types.ts#L92)

___

### is\_online

• `Optional` **is\_online**: `DeepPartial`\<`boolean`\>

#### Defined in

[src/access-types.ts:93](https://github.com/hjdhjd/unifi-access/blob/870bfaa/src/access-types.ts#L93)

___

### location

• `Optional` **location**: `DeepPartial`\<\{ `extra_type`: `string` ; `extras`: [`AccessDeviceExtrasConfigInterface`](AccessDeviceExtrasConfigInterface.md) ; `full_name`: `string` ; `level`: `number` ; `location_type`: `string` ; `name`: `string` ; `timezone`: `string` ; `unique_id`: `string` ; `up_id`: `string` ; `work_time`: `string`[] ; `work_time_id`: `string`  }\>

#### Defined in

[src/access-types.ts:94](https://github.com/hjdhjd/unifi-access/blob/870bfaa/src/access-types.ts#L94)

___

### location\_id

• `Optional` **location\_id**: `string`

#### Defined in

[src/access-types.ts:108](https://github.com/hjdhjd/unifi-access/blob/870bfaa/src/access-types.ts#L108)

___

### mac

• `Optional` **mac**: `string`

#### Defined in

[src/access-types.ts:109](https://github.com/hjdhjd/unifi-access/blob/870bfaa/src/access-types.ts#L109)

___

### model

• `Optional` **model**: `string`

#### Defined in

[src/access-types.ts:110](https://github.com/hjdhjd/unifi-access/blob/870bfaa/src/access-types.ts#L110)

___

### name

• `Optional` **name**: `string`

#### Defined in

[src/access-types.ts:111](https://github.com/hjdhjd/unifi-access/blob/870bfaa/src/access-types.ts#L111)

___

### need\_advisory

• `Optional` **need\_advisory**: `DeepPartial`\<`boolean`\>

#### Defined in

[src/access-types.ts:112](https://github.com/hjdhjd/unifi-access/blob/870bfaa/src/access-types.ts#L112)

___

### resource\_name

• `Optional` **resource\_name**: `string`

#### Defined in

[src/access-types.ts:113](https://github.com/hjdhjd/unifi-access/blob/870bfaa/src/access-types.ts#L113)

___

### revision

• `Optional` **revision**: `number`

#### Defined in

[src/access-types.ts:115](https://github.com/hjdhjd/unifi-access/blob/870bfaa/src/access-types.ts#L115)

___

### revision\_update\_time

• `Optional` **revision\_update\_time**: `number`

#### Defined in

[src/access-types.ts:114](https://github.com/hjdhjd/unifi-access/blob/870bfaa/src/access-types.ts#L114)

___

### security\_check

• `Optional` **security\_check**: `DeepPartial`\<`boolean`\>

#### Defined in

[src/access-types.ts:116](https://github.com/hjdhjd/unifi-access/blob/870bfaa/src/access-types.ts#L116)

___

### source

• `Optional` **source**: `string`

#### Defined in

[src/access-types.ts:117](https://github.com/hjdhjd/unifi-access/blob/870bfaa/src/access-types.ts#L117)

___

### start\_time

• `Optional` **start\_time**: `number`

#### Defined in

[src/access-types.ts:118](https://github.com/hjdhjd/unifi-access/blob/870bfaa/src/access-types.ts#L118)

___

### unique\_id

• `Optional` **unique\_id**: `string`

#### Defined in

[src/access-types.ts:119](https://github.com/hjdhjd/unifi-access/blob/870bfaa/src/access-types.ts#L119)

___

### update

• `Optional` **update**: `string`

#### Defined in

[src/access-types.ts:120](https://github.com/hjdhjd/unifi-access/blob/870bfaa/src/access-types.ts#L120)

___

### update\_manual

• `Optional` **update\_manual**: `DeepPartial`\<\{ `device_version_upgrade_status`: \{ `completed`: `boolean` ; `failed`: `boolean` ; `failure_reason`: `string` ; `is_downloading`: `boolean` ; `is_upgrading`: `boolean` ; `is_waiting`: `boolean` ; `timed_out`: `boolean` ; `upgrade_seconds`: `number`  } ; `from_version`: `string` ; `last_upgrade_failure_reason`: `string` ; `last_upgrade_start_time`: `string` ; `last_upgrade_success`: `string`  }\>

#### Defined in

[src/access-types.ts:121](https://github.com/hjdhjd/unifi-access/blob/870bfaa/src/access-types.ts#L121)

___

### version

• `Optional` **version**: `string`

#### Defined in

[src/access-types.ts:141](https://github.com/hjdhjd/unifi-access/blob/870bfaa/src/access-types.ts#L141)

___

### version\_update\_time

• `Optional` **version\_update\_time**: `number`

#### Defined in

[src/access-types.ts:140](https://github.com/hjdhjd/unifi-access/blob/870bfaa/src/access-types.ts#L140)

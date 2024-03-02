[unifi-access](../README.md) / [Exports](../modules.md) / AccessDeviceConfigPayload

# Interface: AccessDeviceConfigPayload

## Table of contents

### Properties

- [adopt\_time](AccessDeviceConfigPayload.md#adopt_time)
- [alias](AccessDeviceConfigPayload.md#alias)
- [bom\_rev](AccessDeviceConfigPayload.md#bom_rev)
- [capabilities](AccessDeviceConfigPayload.md#capabilities)
- [configs](AccessDeviceConfigPayload.md#configs)
- [connected\_uah\_id](AccessDeviceConfigPayload.md#connected_uah_id)
- [device\_type](AccessDeviceConfigPayload.md#device_type)
- [firmware](AccessDeviceConfigPayload.md#firmware)
- [firmware\_update\_time](AccessDeviceConfigPayload.md#firmware_update_time)
- [guid](AccessDeviceConfigPayload.md#guid)
- [hw\_type](AccessDeviceConfigPayload.md#hw_type)
- [ip](AccessDeviceConfigPayload.md#ip)
- [is\_adopted](AccessDeviceConfigPayload.md#is_adopted)
- [is\_connected](AccessDeviceConfigPayload.md#is_connected)
- [is\_managed](AccessDeviceConfigPayload.md#is_managed)
- [is\_online](AccessDeviceConfigPayload.md#is_online)
- [is\_revision\_up\_to\_date](AccessDeviceConfigPayload.md#is_revision_up_to_date)
- [location](AccessDeviceConfigPayload.md#location)
- [location\_id](AccessDeviceConfigPayload.md#location_id)
- [mac](AccessDeviceConfigPayload.md#mac)
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
- [version](AccessDeviceConfigPayload.md#version)
- [version\_update\_time](AccessDeviceConfigPayload.md#version_update_time)

## Properties

### adopt\_time

• `Optional` **adopt\_time**: `number`

#### Defined in

src/access-types.ts:18

___

### alias

• `Optional` **alias**: `string`

#### Defined in

src/access-types.ts:19

___

### bom\_rev

• `Optional` **bom\_rev**: `string`

#### Defined in

src/access-types.ts:20

___

### capabilities

• `Optional` **capabilities**: `string`[]

#### Defined in

src/access-types.ts:21

___

### configs

• `Optional` **configs**: `DeepPartial`\<[`AccessDeviceConfigEntryInterface`](AccessDeviceConfigEntryInterface.md)\>[]

#### Defined in

src/access-types.ts:22

___

### connected\_uah\_id

• `Optional` **connected\_uah\_id**: `string`

#### Defined in

src/access-types.ts:23

___

### device\_type

• `Optional` **device\_type**: `string`

#### Defined in

src/access-types.ts:24

___

### firmware

• `Optional` **firmware**: `string`

#### Defined in

src/access-types.ts:25

___

### firmware\_update\_time

• `Optional` **firmware\_update\_time**: `number`

#### Defined in

src/access-types.ts:26

___

### guid

• `Optional` **guid**: `string`

#### Defined in

src/access-types.ts:27

___

### hw\_type

• `Optional` **hw\_type**: `string`

#### Defined in

src/access-types.ts:28

___

### ip

• `Optional` **ip**: `string`

#### Defined in

src/access-types.ts:29

___

### is\_adopted

• `Optional` **is\_adopted**: `DeepPartial`\<`boolean`\>

#### Defined in

src/access-types.ts:30

___

### is\_connected

• `Optional` **is\_connected**: `DeepPartial`\<`boolean`\>

#### Defined in

src/access-types.ts:31

___

### is\_managed

• `Optional` **is\_managed**: `DeepPartial`\<`boolean`\>

#### Defined in

src/access-types.ts:32

___

### is\_online

• `Optional` **is\_online**: `DeepPartial`\<`boolean`\>

#### Defined in

src/access-types.ts:33

___

### is\_revision\_up\_to\_date

• `Optional` **is\_revision\_up\_to\_date**: `DeepPartial`\<`boolean`\>

#### Defined in

src/access-types.ts:34

___

### location

• `Optional` **location**: `DeepPartial`\<\{ `extra_type`: `string` ; `extras`: \{ `door_thumbnail`: `string` ; `door_thumbnail_last_update`: `number` ; `uah-input_state_dps`: `string` ; `uah-wiring_state_dps-neg`: `string` ; `uah-wiring_state_dps-pos`: `string`  } ; `full_name`: `string` ; `level`: `number` ; `location_type`: `string` ; `name`: `string` ; `timezone`: `string` ; `unique_id`: `string` ; `up_id`: `string` ; `work_time`: `string` ; `work_time_id`: `string`  }\>

#### Defined in

src/access-types.ts:35

___

### location\_id

• `Optional` **location\_id**: `string`

#### Defined in

src/access-types.ts:54

___

### mac

• `Optional` **mac**: `string`

#### Defined in

src/access-types.ts:55

___

### name

• `Optional` **name**: `string`

#### Defined in

src/access-types.ts:56

___

### need\_advisory

• `Optional` **need\_advisory**: `DeepPartial`\<`boolean`\>

#### Defined in

src/access-types.ts:57

___

### resource\_name

• `Optional` **resource\_name**: `string`

#### Defined in

src/access-types.ts:58

___

### revision

• `Optional` **revision**: `string`

#### Defined in

src/access-types.ts:59

___

### revision\_update\_time

• `Optional` **revision\_update\_time**: `number`

#### Defined in

src/access-types.ts:60

___

### security\_check

• `Optional` **security\_check**: `DeepPartial`\<`boolean`\>

#### Defined in

src/access-types.ts:61

___

### source

• `Optional` **source**: `string`

#### Defined in

src/access-types.ts:62

___

### start\_time

• `Optional` **start\_time**: `number`

#### Defined in

src/access-types.ts:63

___

### unique\_id

• `Optional` **unique\_id**: `string`

#### Defined in

src/access-types.ts:64

___

### update

• `Optional` **update**: `string`

#### Defined in

src/access-types.ts:65

___

### version

• `Optional` **version**: `string`

#### Defined in

src/access-types.ts:66

___

### version\_update\_time

• `Optional` **version\_update\_time**: `number`

#### Defined in

src/access-types.ts:67

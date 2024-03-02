[unifi-access](../README.md) / [Exports](../modules.md) / AccessDeviceConfigInterface

# Interface: AccessDeviceConfigInterface

## Table of contents

### Properties

- [adopt\_time](AccessDeviceConfigInterface.md#adopt_time)
- [alias](AccessDeviceConfigInterface.md#alias)
- [bom\_rev](AccessDeviceConfigInterface.md#bom_rev)
- [capabilities](AccessDeviceConfigInterface.md#capabilities)
- [configs](AccessDeviceConfigInterface.md#configs)
- [connected\_uah\_id](AccessDeviceConfigInterface.md#connected_uah_id)
- [device\_type](AccessDeviceConfigInterface.md#device_type)
- [firmware](AccessDeviceConfigInterface.md#firmware)
- [firmware\_update\_time](AccessDeviceConfigInterface.md#firmware_update_time)
- [guid](AccessDeviceConfigInterface.md#guid)
- [hw\_type](AccessDeviceConfigInterface.md#hw_type)
- [ip](AccessDeviceConfigInterface.md#ip)
- [is\_adopted](AccessDeviceConfigInterface.md#is_adopted)
- [is\_connected](AccessDeviceConfigInterface.md#is_connected)
- [is\_managed](AccessDeviceConfigInterface.md#is_managed)
- [is\_online](AccessDeviceConfigInterface.md#is_online)
- [is\_revision\_up\_to\_date](AccessDeviceConfigInterface.md#is_revision_up_to_date)
- [location](AccessDeviceConfigInterface.md#location)
- [location\_id](AccessDeviceConfigInterface.md#location_id)
- [mac](AccessDeviceConfigInterface.md#mac)
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
- [version](AccessDeviceConfigInterface.md#version)
- [version\_update\_time](AccessDeviceConfigInterface.md#version_update_time)

## Properties

### adopt\_time

• **adopt\_time**: `number`

#### Defined in

src/access-types.ts:18

___

### alias

• **alias**: `string`

#### Defined in

src/access-types.ts:19

___

### bom\_rev

• **bom\_rev**: `string`

#### Defined in

src/access-types.ts:20

___

### capabilities

• **capabilities**: `string`[]

#### Defined in

src/access-types.ts:21

___

### configs

• **configs**: [`AccessDeviceConfigEntryInterface`](AccessDeviceConfigEntryInterface.md)[]

#### Defined in

src/access-types.ts:22

___

### connected\_uah\_id

• **connected\_uah\_id**: `string`

#### Defined in

src/access-types.ts:23

___

### device\_type

• **device\_type**: `string`

#### Defined in

src/access-types.ts:24

___

### firmware

• **firmware**: `string`

#### Defined in

src/access-types.ts:25

___

### firmware\_update\_time

• **firmware\_update\_time**: `number`

#### Defined in

src/access-types.ts:26

___

### guid

• **guid**: `string`

#### Defined in

src/access-types.ts:27

___

### hw\_type

• **hw\_type**: `string`

#### Defined in

src/access-types.ts:28

___

### ip

• **ip**: `string`

#### Defined in

src/access-types.ts:29

___

### is\_adopted

• **is\_adopted**: `boolean`

#### Defined in

src/access-types.ts:30

___

### is\_connected

• **is\_connected**: `boolean`

#### Defined in

src/access-types.ts:31

___

### is\_managed

• **is\_managed**: `boolean`

#### Defined in

src/access-types.ts:32

___

### is\_online

• **is\_online**: `boolean`

#### Defined in

src/access-types.ts:33

___

### is\_revision\_up\_to\_date

• **is\_revision\_up\_to\_date**: `boolean`

#### Defined in

src/access-types.ts:34

___

### location

• **location**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `extra_type` | `string` |
| `extras` | \{ `door_thumbnail`: `string` ; `door_thumbnail_last_update`: `number` ; `uah-input_state_dps`: `string` ; `uah-wiring_state_dps-neg`: `string` ; `uah-wiring_state_dps-pos`: `string`  } |
| `extras.door_thumbnail` | `string` |
| `extras.door_thumbnail_last_update` | `number` |
| `extras.uah-input_state_dps` | `string` |
| `extras.uah-wiring_state_dps-neg` | `string` |
| `extras.uah-wiring_state_dps-pos` | `string` |
| `full_name` | `string` |
| `level` | `number` |
| `location_type` | `string` |
| `name` | `string` |
| `timezone` | `string` |
| `unique_id` | `string` |
| `up_id` | `string` |
| `work_time` | `string` |
| `work_time_id` | `string` |

#### Defined in

src/access-types.ts:35

___

### location\_id

• **location\_id**: `string`

#### Defined in

src/access-types.ts:54

___

### mac

• **mac**: `string`

#### Defined in

src/access-types.ts:55

___

### name

• **name**: `string`

#### Defined in

src/access-types.ts:56

___

### need\_advisory

• **need\_advisory**: `boolean`

#### Defined in

src/access-types.ts:57

___

### resource\_name

• **resource\_name**: `string`

#### Defined in

src/access-types.ts:58

___

### revision

• **revision**: `string`

#### Defined in

src/access-types.ts:59

___

### revision\_update\_time

• **revision\_update\_time**: `number`

#### Defined in

src/access-types.ts:60

___

### security\_check

• **security\_check**: `boolean`

#### Defined in

src/access-types.ts:61

___

### source

• **source**: `string`

#### Defined in

src/access-types.ts:62

___

### start\_time

• **start\_time**: `number`

#### Defined in

src/access-types.ts:63

___

### unique\_id

• **unique\_id**: `string`

#### Defined in

src/access-types.ts:64

___

### update

• **update**: `string`

#### Defined in

src/access-types.ts:65

___

### version

• **version**: `string`

#### Defined in

src/access-types.ts:66

___

### version\_update\_time

• **version\_update\_time**: `number`

#### Defined in

src/access-types.ts:67

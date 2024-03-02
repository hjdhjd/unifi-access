[unifi-access](../README.md) / [Exports](../modules.md) / AccessDeviceConfig

# Interface: AccessDeviceConfig

## Table of contents

### Properties

- [adopt\_time](AccessDeviceConfig.md#adopt_time)
- [alias](AccessDeviceConfig.md#alias)
- [bom\_rev](AccessDeviceConfig.md#bom_rev)
- [capabilities](AccessDeviceConfig.md#capabilities)
- [configs](AccessDeviceConfig.md#configs)
- [connected\_uah\_id](AccessDeviceConfig.md#connected_uah_id)
- [device\_type](AccessDeviceConfig.md#device_type)
- [firmware](AccessDeviceConfig.md#firmware)
- [firmware\_update\_time](AccessDeviceConfig.md#firmware_update_time)
- [guid](AccessDeviceConfig.md#guid)
- [hw\_type](AccessDeviceConfig.md#hw_type)
- [ip](AccessDeviceConfig.md#ip)
- [is\_adopted](AccessDeviceConfig.md#is_adopted)
- [is\_connected](AccessDeviceConfig.md#is_connected)
- [is\_managed](AccessDeviceConfig.md#is_managed)
- [is\_online](AccessDeviceConfig.md#is_online)
- [is\_revision\_up\_to\_date](AccessDeviceConfig.md#is_revision_up_to_date)
- [location](AccessDeviceConfig.md#location)
- [location\_id](AccessDeviceConfig.md#location_id)
- [mac](AccessDeviceConfig.md#mac)
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
- [version](AccessDeviceConfig.md#version)
- [version\_update\_time](AccessDeviceConfig.md#version_update_time)

## Properties

### adopt\_time

• `Readonly` **adopt\_time**: `number`

#### Defined in

src/access-types.ts:18

___

### alias

• `Readonly` **alias**: `string`

#### Defined in

src/access-types.ts:19

___

### bom\_rev

• `Readonly` **bom\_rev**: `string`

#### Defined in

src/access-types.ts:20

___

### capabilities

• `Readonly` **capabilities**: `string`[]

#### Defined in

src/access-types.ts:21

___

### configs

• `Readonly` **configs**: [`AccessDeviceConfigEntryInterface`](AccessDeviceConfigEntryInterface.md)[]

#### Defined in

src/access-types.ts:22

___

### connected\_uah\_id

• `Readonly` **connected\_uah\_id**: `string`

#### Defined in

src/access-types.ts:23

___

### device\_type

• `Readonly` **device\_type**: `string`

#### Defined in

src/access-types.ts:24

___

### firmware

• `Readonly` **firmware**: `string`

#### Defined in

src/access-types.ts:25

___

### firmware\_update\_time

• `Readonly` **firmware\_update\_time**: `number`

#### Defined in

src/access-types.ts:26

___

### guid

• `Readonly` **guid**: `string`

#### Defined in

src/access-types.ts:27

___

### hw\_type

• `Readonly` **hw\_type**: `string`

#### Defined in

src/access-types.ts:28

___

### ip

• `Readonly` **ip**: `string`

#### Defined in

src/access-types.ts:29

___

### is\_adopted

• `Readonly` **is\_adopted**: `boolean`

#### Defined in

src/access-types.ts:30

___

### is\_connected

• `Readonly` **is\_connected**: `boolean`

#### Defined in

src/access-types.ts:31

___

### is\_managed

• `Readonly` **is\_managed**: `boolean`

#### Defined in

src/access-types.ts:32

___

### is\_online

• `Readonly` **is\_online**: `boolean`

#### Defined in

src/access-types.ts:33

___

### is\_revision\_up\_to\_date

• `Readonly` **is\_revision\_up\_to\_date**: `boolean`

#### Defined in

src/access-types.ts:34

___

### location

• `Readonly` **location**: `Object`

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

• `Readonly` **location\_id**: `string`

#### Defined in

src/access-types.ts:54

___

### mac

• `Readonly` **mac**: `string`

#### Defined in

src/access-types.ts:55

___

### name

• `Readonly` **name**: `string`

#### Defined in

src/access-types.ts:56

___

### need\_advisory

• `Readonly` **need\_advisory**: `boolean`

#### Defined in

src/access-types.ts:57

___

### resource\_name

• `Readonly` **resource\_name**: `string`

#### Defined in

src/access-types.ts:58

___

### revision

• `Readonly` **revision**: `string`

#### Defined in

src/access-types.ts:59

___

### revision\_update\_time

• `Readonly` **revision\_update\_time**: `number`

#### Defined in

src/access-types.ts:60

___

### security\_check

• `Readonly` **security\_check**: `boolean`

#### Defined in

src/access-types.ts:61

___

### source

• `Readonly` **source**: `string`

#### Defined in

src/access-types.ts:62

___

### start\_time

• `Readonly` **start\_time**: `number`

#### Defined in

src/access-types.ts:63

___

### unique\_id

• `Readonly` **unique\_id**: `string`

#### Defined in

src/access-types.ts:64

___

### update

• `Readonly` **update**: `string`

#### Defined in

src/access-types.ts:65

___

### version

• `Readonly` **version**: `string`

#### Defined in

src/access-types.ts:66

___

### version\_update\_time

• `Readonly` **version\_update\_time**: `number`

#### Defined in

src/access-types.ts:67

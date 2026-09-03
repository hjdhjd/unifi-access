[**unifi-access**](../README.md)

***

[Home](../README.md) / selectDevicesByType

# Function: selectDevicesByType()

```ts
function selectDevicesByType(state): ReadonlyMap<string, readonly AccessStateDevice[]>;
```

Every device grouped by its `device_type`. The type is an open string the controller chooses, so the map holds exactly the types the hardware in front of you
reports, in the order the devices map holds them - a type this library has never heard of gets its own bucket rather than being dropped.

## Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `state` | [`AccessState`](../type-aliases/AccessState.md) | The current state. |

## Returns

`ReadonlyMap`\<`string`, readonly [`AccessStateDevice`](../type-aliases/AccessStateDevice.md)[]\>

A map from device type to the devices reporting it.

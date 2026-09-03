[**unifi-access**](../README.md)

***

[Home](../README.md) / selectHubs

# Function: selectHubs()

```ts
function selectHubs(state): readonly AccessStateDevice[];
```

Every device that acts as a hub, in the order the devices map holds them. A device qualifies by carrying the controller's own `is_hub` capability, so a hub-capable
device type this library has never seen still classifies correctly.

## Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `state` | [`AccessState`](../type-aliases/AccessState.md) | The current state. |

## Returns

readonly [`AccessStateDevice`](../type-aliases/AccessStateDevice.md)[]

The hub devices.

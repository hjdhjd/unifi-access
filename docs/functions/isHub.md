[**unifi-access**](../README.md)

***

[Home](../README.md) / isHub

# Function: isHub()

```ts
function isHub(device): boolean;
```

Whether a device acts as a hub - hardware that drives a door's lock, as opposed to a reader that only presents credentials to one.

The check is the controller's own `is_hub` capability rather than a list of hub model names. The capability travels with the hardware's role, so a device type
this library has never seen still classifies correctly the day it ships, and a model that gains or loses the role is followed rather than second-guessed.

## Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `device` | [`AccessStateDevice`](../type-aliases/AccessStateDevice.md) | Any device configuration record (only its capabilities are read). |

## Returns

`boolean`

`true` when the device carries the hub capability.

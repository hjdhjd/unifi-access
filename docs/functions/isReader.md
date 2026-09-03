[**unifi-access**](../README.md)

***

[Home](../README.md) / isReader

# Function: isReader()

```ts
function isReader(device): boolean;
```

Whether a device acts as a reader - hardware that presents credentials to a door, as opposed to a hub that drives its lock.

The check is the controller's own `is_reader` capability rather than a list of reader model names. The capability travels with the hardware's role, so a device
type this library has never seen still classifies correctly the day it ships, and a model that gains or loses the role is followed rather than second-guessed.
The roles are not exclusive: hardware that drives a door and reads credentials at it answers `true` here and from [isHub](isHub.md) alike.

## Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `device` | [`AccessStateDevice`](../type-aliases/AccessStateDevice.md) | Any device configuration record (only its capabilities are read). |

## Returns

`boolean`

`true` when the device carries the reader capability.

[**unifi-access**](../README.md)

***

[Home](../README.md) / isCamera

# Function: isCamera()

```ts
function isCamera(device): boolean;
```

Whether a device is camera-class hardware - a device built on a camera, whose access methods the controller keeps on its camera configuration endpoint rather
than on the settings collection every other device takes them on.

The check is the controller's own `is_camera` flag on the record rather than a list of camera model names, so camera-class hardware this library has never seen
still classifies correctly the day it ships. It is the same flag that endpoint takes as its query parameter, which is what makes it the marker an access-method
write routes by. The class is independent of the roles: camera-class hardware need not carry the reader or the hub capability.

Unlike [isHub](isHub.md) and [isReader](isReader.md), whose capabilities every census carries, this reads a member the official device inventory a token-only client seeds
from never projects, so a token-only record answers `false` here until a device update of the original dialect delivers the flag. An access-method write loses
nothing to that: the camera flag chooses only the endpoint its direct half writes, which only a client holding credentials reaches, and such a client seeds from
the topology.

## Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `device` | [`AccessStateDevice`](../type-aliases/AccessStateDevice.md) | Any device configuration record (only its `is_camera` flag is read). |

## Returns

`boolean`

`true` when the record carries the camera flag set.

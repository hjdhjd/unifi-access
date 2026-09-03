[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessDeviceRegistry

# Interface: AccessDeviceRegistry

The projection factory the client composes. It turns identities into live handles over the current store snapshot: every modeled device as an
[AccessDevice](AccessDevice.md), the hub-capable ones as command-bearing [AccessHub](AccessHub.md) handles, and each door-serving port of a multi-port Enterprise Access Hub as a
handle of its own.

Three views, and which one to reach for follows from what a consumer wants to do. `device` reaches any record, including the ones the other views deliberately
withhold, and is where configuration reads and writes happen. `hub` reaches the hardware that drives a single door. `accessPoint` reaches one door of a
multi-port hub - the view that exists because a consumer looking for "the hardware serving this door" would otherwise find nothing at seven of the eight doors an
eight-port hub drives.

A building-hosted Enterprise Access Hub is deliberately absent from the hub views. Its record binds a whole hub rather than any one door, so a door command
issued through it would resolve to an arbitrary one of its ports - the exact confusion the per-port view exists to prevent. It stays fully reachable through
`device` for configuration, and its doors through `accessPoints`. The withholding and the expansion read the same predicate, so a record is expanded into
per-port handles exactly where it is withheld from whole-hub ones.

Handles are not cached: each lookup or iteration mints fresh ones. That is deliberate and cheap - a handle is a thin view over the single source of truth, and
identity is meaningless for a value that only reads through.

## Methods

### accessPoint()

```ts
accessPoint(id): AccessHub | undefined;
```

Look up one door-serving port of an Enterprise Access Hub by the port's own identity, or `undefined` when the expansion holds no such port.

The handle is bound to the synthesized port record rather than to the hub's, so its door command resolves to the door that port serves and its device-scoped
commands key on the port's own identity - which is the identity the controller itself addresses a port by.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `id` | `string` | The port's `unique_id`. |

#### Returns

[`AccessHub`](AccessHub.md) \| `undefined`

A live hub handle over that port, or `undefined`.

***

### accessPoints()

```ts
accessPoints(): readonly AccessHub[];
```

Every door-serving port of every Enterprise Access Hub in the current state, as live handles - one per door the hardware drives.

#### Returns

readonly [`AccessHub`](AccessHub.md)[]

The access-point handles.

***

### device()

```ts
device(id): AccessDevice | undefined;
```

Look up any modeled device by identity, or `undefined` when the current state holds no such device.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `id` | `string` | The device's `unique_id`. |

#### Returns

[`AccessDevice`](AccessDevice.md) \| `undefined`

A live device handle, or `undefined`.

***

### devices()

```ts
devices(): readonly AccessDevice[];
```

Every modeled device in the current state, as live handles. Includes the building-hosted Enterprise Access Hub record that the hub views withhold.

#### Returns

readonly [`AccessDevice`](AccessDevice.md)[]

The device handles.

***

### hub()

```ts
hub(id): AccessHub | undefined;
```

Look up a hub by identity, or `undefined` when the current state holds no hub-capable device under it.

A building-hosted Enterprise Access Hub answers `undefined` here even though it is hub-capable, because a door command issued against the whole hub would
resolve to an arbitrary one of its ports. Reach its doors through [AccessDeviceRegistry.accessPoint](#accesspoint) instead, and the record itself through
[AccessDeviceRegistry.device](#device).

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `id` | `string` | The device's `unique_id`. |

#### Returns

[`AccessHub`](AccessHub.md) \| `undefined`

A live hub handle, or `undefined`.

***

### hubs()

```ts
hubs(): readonly AccessHub[];
```

Every hub in the current state, as live handles, excluding the building-hosted Enterprise Access Hub records for the reason [AccessDeviceRegistry.hub](#hub)
gives.

#### Returns

readonly [`AccessHub`](AccessHub.md)[]

The hub handles.

[**unifi-access**](../README.md)

***

[Home](../README.md) / selectDoorDevices

# Function: selectDoorDevices()

```ts
function selectDoorDevices(state): ReadonlyMap<string, readonly AccessStateDevice[]>;
```

The hardware attached to each door, keyed by door identity. Every door in the state is present, so a door with no hardware maps to an empty array rather than
being absent - a consumer iterating doors never has to distinguish "no hardware" from "unknown door".

Hardware the building hosts directly, rather than through one of its doors, belongs to no door and appears in no entry here. It is still reachable through the
device views, and an Enterprise Access Hub hosted that way reaches its doors through [selectAccessPoints](selectAccessPoints.md).

A client with no topology holds the doors its own census named, so this view answers there too - every door the official listing carried, keyed the same way.

## Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `state` | [`AccessState`](../type-aliases/AccessState.md) | The current state. |

## Returns

`ReadonlyMap`\<`string`, readonly [`AccessStateDevice`](../type-aliases/AccessStateDevice.md)[]\>

A map from door identity to the devices serving that door.

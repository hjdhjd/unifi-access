[**unifi-access**](../README.md)

***

[Home](../README.md) / selectAccessPoints

# Function: selectAccessPoints()

```ts
function selectAccessPoints(state): readonly AccessStateDevice[];
```

The logical access points: one entry per door-serving port of every Enterprise Access Hub, presented as a device in its own right so that a consumer sees one
piece of hardware per door rather than one hub standing in for eight of them.

Each synthesized record takes its identity from the port's extension, its `location_id` from the door that port targets, its `alias` from that door's name, and
its `name` from the hub's alias, with every remaining hardware field coming from the hub itself. The controller's own records are left untouched: this is a
derived view, not a rewrite of state.

The result is empty before a topology document has been applied, and empty on a controller with no Enterprise Access Hub.

## Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `state` | [`AccessState`](../type-aliases/AccessState.md) | The current state. |

## Returns

readonly [`AccessStateDevice`](../type-aliases/AccessStateDevice.md)[]

The synthesized access-point devices.

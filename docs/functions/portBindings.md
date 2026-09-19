[**unifi-access**](../README.md)

***

[Home](../README.md) / portBindings

# Function: portBindings()

```ts
function portBindings(device): readonly AccessPortBinding[];
```

The doors a hub's ports are bound to: one binding per port that names a door, in the order the controller delivered them.

A hub records which door each of its ports serves as an extension of its own record, and the protocol tier's `readPortBindings` is where which extensions are port
bindings and what one of them says both live. This is that read over the stored record, so a consumer asking which doors a hub drives, the hub handle's own door
resolution, and the access-point expansion all answer from one rule rather than parsing the list separately in each place.

There are three quite different ways to get an empty list back, and all three are honest. A synthesized per-port access point carries no extensions - the
expansion strips them on the way through - so it answers empty, which is what it should: it already is one port, and its door is that record's own location. A
record a token-only census produced carries no extensions either, so every record answers empty on that client by construction. And single-door hardware that
binds its port through no extension answers empty because there is nothing to answer with, its door likewise being its own location.

It is re-evaluated on every call rather than memoized, joining [tamperState](tamperState.md) and [terminalInput](terminalInput.md) in the per-record group the memo discipline does not
cover: the answer is derived from one record a caller already holds rather than being a collection an observer dedups against.

What a binding means is the consumer's to decide. Which of a multi-door hub's doors is the one it cares about is policy this library holds no opinion about, and
commanding a particular door of such hardware stays the door commands' `doorId` target rather than anything the order of this list implies.

## Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `device` | [`AccessStateDevice`](../type-aliases/AccessStateDevice.md) | Any device configuration record (only its extensions are read). |

## Returns

readonly [`AccessPortBinding`](../interfaces/AccessPortBinding.md)[]

The bindings in delivered order, one per port that names a door.

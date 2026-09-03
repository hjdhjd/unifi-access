[**unifi-access**](../README.md)

***

[Home](../README.md) / selectDoorStates

# Function: selectDoorStates()

```ts
function selectDoorStates(state): ReadonlyMap<string, AccessDoorStateEntryInterface>;
```

The live state of every door the reducer holds one for, keyed by door identity. A door with no derivable state is absent rather than present-and-empty, because
there is no such thing as a default door state: the entry means "this is what the door last said, or what its hardware flags imply", and its absence means
neither source has produced one. The reducer seeds an entry for every door whose topology record carries enough hardware flags to derive one, so a freshly
connected client already sees those doors before any of them reports.

No memo level sits over this one. The map is the reducer's own product rather than something derived from it, so its reference is already stable across every
dispatch that did not change a door's state, which is exactly the property a memo would be added to supply.

## Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `state` | [`AccessState`](../type-aliases/AccessState.md) | The current state. |

## Returns

`ReadonlyMap`\<`string`, [`AccessDoorStateEntryInterface`](../interfaces/AccessDoorStateEntryInterface.md)\>

A map from door identity to that door's last reported state.

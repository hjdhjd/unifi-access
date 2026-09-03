[**unifi-access**](../README.md)

***

[Home](../README.md) / createStateStore

# Function: createStateStore()

```ts
function createStateStore(options): StateStore;
```

Construct a [StateStore](../interfaces/StateStore.md) directly - the single documented exception to the package's export law, which otherwise keeps the store off the public surface so a
consumer has exactly one composition path. This factory exists for the test harnesses that need the real reducer and observer engine standalone: a consumer
driving the genuine store never has to hand-mirror its dispatch, dedup, and refresh semantics in a double.

## Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `options` | [`StateStoreOptions`](../interfaces/StateStoreOptions.md) | The store options, every one of them optional: the refresh callback, the clock, the initial state, the logger, the dispatch observer, and the refresh interval. |

## Returns

[`StateStore`](../interfaces/StateStore.md)

A new state store.

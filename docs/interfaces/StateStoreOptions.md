[**unifi-access**](../README.md)

***

[Home](../README.md) / StateStoreOptions

# Interface: StateStoreOptions

Construction options for [StateStore](StateStore.md).

- `refresh` is the callback the failsafe invokes to re-seed the store from whatever the composition root seeded it from. It reads what its mode can reach and
  applies it through the store's own methods, exactly as the composition root's recovery closure does, so the order a document pair is applied in stays owned by
  the store's own `applyRefreshDocuments` and the loop assumes nothing about what a refresh is. A composition root wires it to a transport request and a test
  wires a fake. Injecting a function rather than a transport is what keeps the store at the data layer and deterministically testable. Omitting it says there is
  no source to re-seed from: the failsafe then does not exist rather than existing with nothing to call. It receives the loop's own lifetime signal, so a read
  still in flight when the store is disposed is released rather than running on past the store that asked for it.
- `refreshIntervalMs` defaults to [ACCESS\_BOOTSTRAP\_REFRESH\_INTERVAL](../variables/ACCESS_BOOTSTRAP_REFRESH_INTERVAL.md). Passing `false` or a non-positive interval disables the failsafe outright, leaving
  the consumer to rely on the realtime notification channel alone.
- `onDispatch` observes each event that actually advanced the state. It is composition wiring rather than a consumer-facing surface: the store is deliberately
  host-agnostic, so it cannot itself publish the host-attributed diagnostic a consumer subscribes to, and the composition root that does know the host wires this
  to that publisher. It follows the same injected-function shape the transport's own auth hooks use.

## Properties

| Property | Type |
| ------ | ------ |
| <a id="clock"></a> `clock?` | [`Clock`](Clock.md) |
| <a id="initialstate"></a> `initialState?` | `Readonly`\<\{ `controller`: `Nullable`\<[`AccessControllerConfigInterface`](AccessControllerConfigInterface.md)\>; `devices`: `ReadonlyMap`\<`string`, [`AccessStateDevice`](../type-aliases/AccessStateDevice.md)\>; `doors`: `ReadonlyMap`\<`string`, [`AccessStateDoor`](../type-aliases/AccessStateDoor.md)\>; `doorStates`: `ReadonlyMap`\<`string`, [`AccessDoorStateEntryInterface`](AccessDoorStateEntryInterface.md)\>; `floors`: `ReadonlyMap`\<`string`, `OmitMembers`\<[`AccessFloorConfigInterface`](AccessFloorConfigInterface.md), `"doors"`\>\>; `root`: `Nullable`\<`OmitMembers`\<[`AccessBootstrapConfigInterface`](AccessBootstrapConfigInterface.md), `"device_groups"` \| `"floors"`\>\>; \}\> |
| <a id="log"></a> `log?` | [`AccessLogging`](AccessLogging.md) |
| <a id="ondispatch"></a> `onDispatch?` | (`event`) => `void` |
| <a id="refresh"></a> `refresh?` | (`signal?`) => `Promise`\<`void`\> |
| <a id="refreshintervalms"></a> `refreshIntervalMs?` | `number` \| `false` |

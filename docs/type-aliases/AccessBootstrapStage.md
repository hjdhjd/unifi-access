[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessBootstrapStage

# Type Alias: AccessBootstrapStage

```ts
type AccessBootstrapStage = "fetch" | "parse";
```

The stages of the `connect()` sequence that carry a [AccessBootstrapError](../classes/AccessBootstrapError.md) tag. The sequence authenticates, fetches the bootstrap document, parses it, then
subscribes to the realtime stream; only the fetch and parse stages are wrapped as a bootstrap error, because a login or reachability failure already propagates as
its own typed fatal (`AccessAuthError` / `AccessNetworkError`), and a subscribe failure surfaces as the fault the realtime channel itself raised.

[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessBootstrapStage

# Type Alias: AccessBootstrapStage

```ts
type AccessBootstrapStage = "apply" | "fetch" | "parse";
```

The stages of the `connect()` sequence that carry a [AccessBootstrapError](../classes/AccessBootstrapError.md) tag. The sequence authenticates, fetches the bootstrap documents, parses them,
applies them to the state model, then subscribes to the realtime stream; only the fetch, parse, and apply stages are wrapped as a bootstrap error, because a login
or reachability failure already propagates as its own typed fatal (`AccessAuthError` / `AccessNetworkError`), and a subscribe failure surfaces as the fault the
realtime channel itself raised. The apply stage is distinct from parse because it points at a different fix: a body that will not decode is a controller or
transport fault, while a decoded document the state model cannot fold is a wire shape the library does not model or a fault in the reducer itself.

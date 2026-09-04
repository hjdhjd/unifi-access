[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessApiOverride

# Type Alias: AccessApiOverride

```ts
type AccessApiOverride = "auto" | "direct-only" | "official-only";
```

Which API a routed command should prefer.

`auto` is the default and the ordinary case: the official path where it is available and capable, the direct path otherwise. The two overrides exist for a consumer
that needs to know exactly which channel its commands take - to hold attribution to one identity, or to stay off a channel entirely - and they hold the client to a
channel rather than merely preferring one, so an operation that channel cannot express fails rather than quietly taking the other one.

[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessOfficialIdentityResourceMap

# Type Alias: AccessOfficialIdentityResourceMap

```ts
type AccessOfficialIdentityResourceMap = Readonly<Record<string, readonly AccessOfficialIdentityResource[]>>;
```

Identity resources grouped by resource type.

The observed keys are `camera`, `ev_station`, `vpn`, and `wifi` - one more than the query parameter's own documented vocabulary, which omits `camera` - so this
is keyed by string rather than closed over the query's set.

Documentation-derived.

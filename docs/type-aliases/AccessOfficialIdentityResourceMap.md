[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessOfficialIdentityResourceMap

# Type Alias: AccessOfficialIdentityResourceMap

```ts
type AccessOfficialIdentityResourceMap = Readonly<Record<string, readonly AccessOfficialIdentityResource[]>>;
```

Identity resources grouped by resource type.

The response can carry keys the query parameter's vocabulary does not name, such as `camera`, so this is keyed by string rather than closed over the query's set.

Documentation-derived.

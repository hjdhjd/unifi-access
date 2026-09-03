[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessOfficialQuery

# Type Alias: AccessOfficialQuery

```ts
type AccessOfficialQuery = Readonly<Record<string, boolean | number | string | readonly (number | string)[] | undefined>>;
```

The query members an official endpoint accepts, as the caller spells them. A member's value is dropped when it is `undefined`, so a caller composes one record
with every parameter the endpoint documents and lets the absent ones fall away rather than assembling a different record per combination.

An array value is the reference's repeated-key idiom: each element is appended under the same key, which is how a parameter like `expand[]` carries more than one
value. The bracket is part of the documented parameter name, so the caller spells it.

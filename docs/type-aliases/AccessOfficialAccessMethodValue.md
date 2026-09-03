[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessOfficialAccessMethodValue

# Type Alias: AccessOfficialAccessMethodValue

```ts
type AccessOfficialAccessMethodValue = "no" | "yes";
```

Whether an access method is switched on. The wire spells these `"yes"` and `"no"` rather than as booleans, in both directions - the write takes the same pair
the read returns - and this is the one vocabulary here carried closed: both values have been observed live, and the reference's own field table claiming
`"true"`/`"false"` is contradicted by its own sample on the same page and by the wire.

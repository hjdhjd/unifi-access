[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessOfficialUserExpand

# Type Alias: AccessOfficialUserExpand

```ts
type AccessOfficialUserExpand = "access_policy";
```

The expansions a user read accepts. The reference's field table labels this a boolean flag, but its own sample sends `expand[]=access_policy` and the visitor
sibling documents the same parameter as a string vocabulary - a boolean would serialize as `expand[]=true` and silently return an unexpanded record.

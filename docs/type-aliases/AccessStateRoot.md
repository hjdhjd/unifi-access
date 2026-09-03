[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessStateRoot

# Type Alias: AccessStateRoot

```ts
type AccessStateRoot = OmitMembers<AccessBootstrapConfig, "device_groups" | "floors">;
```

The topology root as stored: the wire's root record without the floors and the root-level device group that the other maps own.

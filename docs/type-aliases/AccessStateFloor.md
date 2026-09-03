[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessStateFloor

# Type Alias: AccessStateFloor

```ts
type AccessStateFloor = OmitMembers<AccessFloorConfig, "doors">;
```

A floor as stored: the wire's floor record without the doors the doors map owns. The topology document is the only census that lists floors.

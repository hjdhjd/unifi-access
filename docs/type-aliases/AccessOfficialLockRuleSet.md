[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessOfficialLockRuleSet

# Type Alias: AccessOfficialLockRuleSet

```ts
type AccessOfficialLockRuleSet = 
  | {
  interval: number;
  type: "custom";
}
  | {
  type: "keep_lock" | "keep_unlock" | "lock_early" | "lock_now" | "reset";
};
```

The temporary locking rule to put on a door.

`interval` belongs to the `custom` rule alone, which is why this is a union rather than one shape with an optional member: a duration on any other rule would be
silently ignored, and here it cannot be written at all.

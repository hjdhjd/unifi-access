[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessLockRule

# Type Alias: AccessLockRule

```ts
type AccessLockRule = AccessOfficialLockRuleSet;
```

The rule that governs how a door's lock behaves until something changes it.

There is one lock-rule vocabulary on this controller and both of the library's channels speak it, so this names the official surface's own union rather than
restating it - two hand-maintained spellings of one wire vocabulary would drift the first time the controller gained a verb. Which verbs each path can carry
differs even though the vocabulary does not: `reset`, `keep_unlock`, and `custom` are expressible on the direct path, while `keep_lock`, `lock_early`, and
`lock_now` are reachable only through the official API.

A `custom` rule's interval is in whole MINUTES, which is what both the wire and the reference speak - a value of 2 holds the door unlocked for two minutes. As a
union rather than one shape with a nullable duration, the combinations that have no meaning cannot be written at all: there is no way to ask for a `reset` with
an interval, and no way to reach the custom rule without supplying one.

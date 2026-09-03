[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessOfficialLockRule

# Interface: AccessOfficialLockRule

The temporary locking rule in force on a door, and when it ends.

An idle door answers with an empty `type` and an `ended_time` of zero. That state names no rule and appears in no documented vocabulary, so it is carried
explicitly: a caller testing for it reads the empty string rather than inferring it from a value the reference never described.

Live-verified.

## Properties

| Property | Modifier | Type |
| ------ | ------ | ------ |
| <a id="ended_time"></a> `ended_time` | `readonly` | `number` |
| <a id="type"></a> `type` | `readonly` | \| `""` \| `string` & \{ \} \| `"custom"` \| `"keep_lock"` \| `"keep_unlock"` \| `"lock_early"` \| `"schedule"` |

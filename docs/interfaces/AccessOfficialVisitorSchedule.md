[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessOfficialVisitorSchedule

# Interface: AccessOfficialVisitorSchedule

The recurring visit schedule attached to a visitor.

`weekly` is null on a one-time visit, which is the wire's way of saying the visit has no recurring pattern rather than that it has an empty one. The member is
spelled `weekly` on every response sample, where the request that sets it is spelled `week_schedule` - the two spellings are the reference's own, transcribed
rather than reconciled.

Documentation-derived.

## Properties

| Property | Modifier | Type |
| ------ | ------ | ------ |
| <a id="id"></a> `id?` | `readonly` | `string` |
| <a id="is_default"></a> `is_default?` | `readonly` | `boolean` |
| <a id="name"></a> `name` | `readonly` | `string` |
| <a id="type"></a> `type` | `readonly` | \| `string` & \{ \} \| `"access"` |
| <a id="weekly"></a> `weekly` | `readonly` | `Nullable`\<[`AccessOfficialWeekSchedule`](AccessOfficialWeekSchedule.md)\> |

[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessOfficialSystemLogEvent

# Interface: AccessOfficialSystemLogEvent

What happened, as a log entry describes it.

`log_key` is the finest-grained name for the event - `access.door.unlock.success.remote.user` where `type` says only `access.door.unlock` - so it is what to
branch on when the outcome matters. Both it and `log_category` are on the wire and in no documented schema.

`published` is epoch milliseconds, unlike the epoch-seconds convention `since`, `until`, and the resource's `created_at`/`updated_at` use elsewhere in this domain.

Live-verified.

## Properties

| Property | Modifier | Type |
| ------ | ------ | ------ |
| <a id="display_message"></a> `display_message` | `readonly` | `string` |
| <a id="event"></a> `event` | `readonly` | `string` |
| <a id="level"></a> `level` | `readonly` | `number` |
| <a id="log_category"></a> `log_category` | `readonly` | `string` |
| <a id="log_key"></a> `log_key` | `readonly` | `string` |
| <a id="published"></a> `published` | `readonly` | `number` |
| <a id="reason"></a> `reason` | `readonly` | `string` |
| <a id="result"></a> `result` | `readonly` | `string` |
| <a id="type"></a> `type` | `readonly` | `string` |

[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessEventPacketInterface

# Interface: AccessEventPacketInterface

A complete description of the UniFi Access notification events API packet format.

A UniFi Access event packet is the representation of a notification event from a UniFi Access controller. The `event` property informs us of the notification type,
such as `access.data.device.remote_unlock` for door unlock events, and the details arrive as a JSON payload in the `data` property.

`data` is deliberately unknown here rather than narrowed by event name. Recognizing an event and giving its payload a specific type is the protocol
layer's job, and doing it here would put a second, competing view of the same packet in the type tier.

## Properties

| Property | Type |
| ------ | ------ |
| <a id="data"></a> `data` | `unknown` |
| <a id="event"></a> `event` | `string` |
| <a id="event_object_id"></a> `event_object_id` | `string` |
| <a id="meta"></a> `meta?` | \{ `all_field`: `boolean`; `id`: `string`; `object_type`: `string`; `source`: `string`; `target_field`: `Nullable`\<`string`[]\>; \} |
| `meta.all_field` | `boolean` |
| `meta.id` | `string` |
| `meta.object_type` | `string` |
| `meta.source` | `string` |
| `meta.target_field` | `Nullable`\<`string`[]\> |
| <a id="receiver_id"></a> `receiver_id` | `string` |
| <a id="save_to_history"></a> `save_to_history` | `boolean` |

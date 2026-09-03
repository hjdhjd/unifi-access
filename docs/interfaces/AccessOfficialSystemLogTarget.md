[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessOfficialSystemLogTarget

# Interface: AccessOfficialSystemLogTarget

One thing a log entry concerns - a device, a door, a floor, a building, or a piece of the request's own context.

The `type` vocabulary is wider than the reference's examples: the wire also sends entries typed `reason_code`, `three_button_method`, `user_status`, and
`device_config`, which are request context rather than physical things, so a consumer selects the entry it wants by `type` rather than by position.

Live-verified.

## Properties

| Property | Modifier | Type |
| ------ | ------ | ------ |
| <a id="alternate_id"></a> `alternate_id` | `readonly` | `string` |
| <a id="alternate_name"></a> `alternate_name` | `readonly` | `string` |
| <a id="display_name"></a> `display_name` | `readonly` | `string` |
| <a id="id"></a> `id` | `readonly` | `string` |
| <a id="type"></a> `type` | `readonly` | `string` |

[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessWebhookLocation

# Interface: AccessWebhookLocation

The door, floor, or building a delivery concerns, as the webhook channel describes it.

`extras` is where a UA Hub reports its door's position, under the `uah-input_state_dps` and `uah-wiring_state_dps` members; a UA Hub Door Mini reports the same
condition on its device record instead and sends an empty object here, so an empty `extras` says nothing about whether the door has a position sensor.

## Properties

| Property | Modifier | Type |
| ------ | ------ | ------ |
| <a id="device_ids"></a> `device_ids` | `readonly` | `Nullable`\<`string`[]\> |
| <a id="extras"></a> `extras` | `readonly` | `Readonly`\<`Record`\<`string`, `AccessKnownJsonValue`\>\> |
| <a id="id"></a> `id` | `readonly` | `string` |
| <a id="location_type"></a> `location_type` | `readonly` | `string` |
| <a id="name"></a> `name` | `readonly` | `string` |
| <a id="up_id"></a> `up_id` | `readonly` | `string` |

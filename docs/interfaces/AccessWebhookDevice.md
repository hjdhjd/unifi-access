[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessWebhookDevice

# Interface: AccessWebhookDevice

The device a delivery concerns, as the webhook channel describes it.

The member names are the newer notification dialect's rather than the topology document's - `id` and `online` where the topology document says `unique_id` and
`is_online` - so this is its own record rather than a projection of one the library already models.

## Properties

| Property | Modifier | Type |
| ------ | ------ | ------ |
| <a id="adopting"></a> `adopting` | `readonly` | `boolean` |
| <a id="alias"></a> `alias` | `readonly` | `string` |
| <a id="cap"></a> `cap` | `readonly` | `AccessKnownJsonValue` |
| <a id="category"></a> `category` | `readonly` | `AccessKnownJsonValue` |
| <a id="connected_hub_id"></a> `connected_hub_id` | `readonly` | `string` |
| <a id="device_type"></a> `device_type` | `readonly` | `string` |
| <a id="firmware"></a> `firmware` | `readonly` | `string` |
| <a id="guid"></a> `guid` | `readonly` | `string` |
| <a id="hw_type"></a> `hw_type` | `readonly` | `string` |
| <a id="id"></a> `id` | `readonly` | `string` |
| <a id="ip"></a> `ip` | `readonly` | `string` |
| <a id="location_id"></a> `location_id` | `readonly` | `string` |
| <a id="mac"></a> `mac` | `readonly` | `string` |
| <a id="name"></a> `name` | `readonly` | `string` |
| <a id="online"></a> `online` | `readonly` | `boolean` |
| <a id="revision"></a> `revision` | `readonly` | `string` |
| <a id="start_time"></a> `start_time` | `readonly` | `number` |
| <a id="version"></a> `version` | `readonly` | `string` |

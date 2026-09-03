[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessOfficialDevice

# Interface: AccessOfficialDevice

An adopted device.

`capabilities` is the controller's own feature-flag vocabulary for the hardware - strings such as `is_hub`, `pin_code`, and `two_factor_auth` - and is the
dependable way to ask what a device can do, rather than matching on `type`.

Live-verified. Every member beyond `alias`, `id`, `name`, and `type` is on the wire and in no documented schema for this endpoint.

## Properties

| Property | Modifier | Type |
| ------ | ------ | ------ |
| <a id="alias"></a> `alias` | `readonly` | `string` |
| <a id="capabilities"></a> `capabilities` | `readonly` | readonly `string`[] |
| <a id="connected_uah_id"></a> `connected_uah_id` | `readonly` | `string` |
| <a id="id"></a> `id` | `readonly` | `string` |
| <a id="is_adopted"></a> `is_adopted` | `readonly` | `boolean` |
| <a id="is_connected"></a> `is_connected` | `readonly` | `boolean` |
| <a id="is_managed"></a> `is_managed` | `readonly` | `boolean` |
| <a id="is_online"></a> `is_online` | `readonly` | `boolean` |
| <a id="location_id"></a> `location_id` | `readonly` | `string` |
| <a id="name"></a> `name` | `readonly` | `string` |
| <a id="type"></a> `type` | `readonly` | `string` |

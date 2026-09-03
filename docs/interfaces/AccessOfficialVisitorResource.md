[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessOfficialVisitorResource

# Interface: AccessOfficialVisitorResource

A door or door group a visitor may enter, as their record names it.

The response carries the resource's name alongside its identifier, which the request form does not - so a caller reading a visitor back learns where they may go
without a second lookup.

Documentation-derived.

## Properties

| Property | Modifier | Type |
| ------ | ------ | ------ |
| <a id="id"></a> `id` | `readonly` | `string` |
| <a id="name"></a> `name` | `readonly` | `string` |
| <a id="type"></a> `type` | `readonly` | \| `"door"` \| `string` & \{ \} \| `"door_group"` |

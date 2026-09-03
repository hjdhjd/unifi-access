[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessOfficialDoorGroupResource

# Interface: AccessOfficialDoorGroupResource

A door within a door group. The group's detail read names each door; its list and write reads report only the identifier and kind.

Documentation-derived.

## Properties

| Property | Modifier | Type |
| ------ | ------ | ------ |
| <a id="id"></a> `id` | `readonly` | `string` |
| <a id="name"></a> `name?` | `readonly` | `string` |
| <a id="type"></a> `type` | `readonly` | \| `"door"` \| `string` & \{ \} \| `"door_group"` |

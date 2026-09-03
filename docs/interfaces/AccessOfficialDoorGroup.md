[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessOfficialDoorGroup

# Interface: AccessOfficialDoorGroup

A door group: a named set of doors an access policy can grant against as a unit.

`type` is reported by the read endpoints and omitted by the write ones, which echo only what they changed.

Live-verified.

## Properties

| Property | Modifier | Type |
| ------ | ------ | ------ |
| <a id="id"></a> `id` | `readonly` | `string` |
| <a id="name"></a> `name` | `readonly` | `string` |
| <a id="resources"></a> `resources` | `readonly` | readonly [`AccessOfficialDoorGroupResource`](AccessOfficialDoorGroupResource.md)[] |
| <a id="type"></a> `type?` | `readonly` | \| `string` & \{ \} \| `"access"` \| `"building"` |

[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessOfficialDoorGroupTopology

# Interface: AccessOfficialDoorGroupTopology

A door group as the topology describes it, with the floors and doors beneath it.

The `building` group is the controller's own all-doors group; an `access` group is one somebody created.

Live-verified.

## Properties

| Property | Modifier | Type |
| ------ | ------ | ------ |
| <a id="id"></a> `id?` | `readonly` | `string` |
| <a id="name"></a> `name` | `readonly` | `string` |
| <a id="resource_topologies"></a> `resource_topologies` | `readonly` | readonly [`AccessOfficialResourceTopology`](AccessOfficialResourceTopology.md)[] |
| <a id="type"></a> `type` | `readonly` | \| `string` & \{ \} \| `"access"` \| `"building"` |

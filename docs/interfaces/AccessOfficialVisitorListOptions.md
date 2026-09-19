[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessOfficialVisitorListOptions

# Interface: AccessOfficialVisitorListOptions

List visitors. A `keyword` prefix-matches the first and last name, and disables the status filter while it is present.

## Extends

- [`AccessOfficialPageOptions`](AccessOfficialPageOptions.md)

## Properties

| Property | Type | Inherited from |
| ------ | ------ | ------ |
| <a id="expand"></a> `expand?` | readonly [`AccessOfficialVisitorExpand`](../type-aliases/AccessOfficialVisitorExpand.md)[] | - |
| <a id="keyword"></a> `keyword?` | `string` | - |
| <a id="pagenum"></a> `pageNum?` | `number` | [`AccessOfficialPageOptions`](AccessOfficialPageOptions.md).[`pageNum`](AccessOfficialPageOptions.md#pagenum) |
| <a id="pagesize"></a> `pageSize?` | `number` | [`AccessOfficialPageOptions`](AccessOfficialPageOptions.md).[`pageSize`](AccessOfficialPageOptions.md#pagesize) |
| <a id="status"></a> `status?` | `5` \| `2` \| `1` \| `3` \| `4` \| `6` | - |

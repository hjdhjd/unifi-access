[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessOfficialUserSearchOptions

# Interface: AccessOfficialUserSearchOptions

Search users. `status` and `userId` are repeatable - each entry is sent under its own key, which is how the endpoint takes more than one.

## Extends

- [`AccessOfficialPageOptions`](AccessOfficialPageOptions.md)

## Properties

| Property | Type | Inherited from |
| ------ | ------ | ------ |
| <a id="keyword"></a> `keyword?` | `string` | - |
| <a id="onlyadmin"></a> `onlyAdmin?` | `boolean` | - |
| <a id="pagenum"></a> `pageNum?` | `number` | [`AccessOfficialPageOptions`](AccessOfficialPageOptions.md).[`pageNum`](AccessOfficialPageOptions.md#pagenum) |
| <a id="pagesize"></a> `pageSize?` | `number` | [`AccessOfficialPageOptions`](AccessOfficialPageOptions.md).[`pageSize`](AccessOfficialPageOptions.md#pagesize) |
| <a id="status"></a> `status?` | readonly (`"ACTIVE"` \| `"PENDING"` \| `"DEACTIVATED"`)[] | - |
| <a id="userid"></a> `userId?` | readonly `string`[] | - |

[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessOfficialPageOptions

# Interface: AccessOfficialPageOptions

The pagination members every paginated official endpoint accepts, in the library's own camelCase. They are renamed to the wire's own `page_num` and `page_size`
spelling on the way out, in one place rather than at each of the paginated call sites.

## Extended by

- [`AccessOfficialTouchPassListOptions`](AccessOfficialTouchPassListOptions.md)
- [`AccessOfficialUserListOptions`](AccessOfficialUserListOptions.md)
- [`AccessOfficialUserSearchOptions`](AccessOfficialUserSearchOptions.md)
- [`AccessOfficialVisitorListOptions`](AccessOfficialVisitorListOptions.md)
- [`AccessOfficialSystemLogFetchOptions`](AccessOfficialSystemLogFetchOptions.md)

## Properties

| Property | Type |
| ------ | ------ |
| <a id="pagenum"></a> `pageNum?` | `number` |
| <a id="pagesize"></a> `pageSize?` | `number` |

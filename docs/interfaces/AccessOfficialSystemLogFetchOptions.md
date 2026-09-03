[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessOfficialSystemLogFetchOptions

# Interface: AccessOfficialSystemLogFetchOptions

Query the system log. `since` and `until` are unix epoch seconds.

## Extends

- [`AccessOfficialPageOptions`](AccessOfficialPageOptions.md)

## Properties

| Property | Type | Inherited from |
| ------ | ------ | ------ |
| <a id="actor_id"></a> `actor_id?` | `string` | - |
| <a id="pagenum"></a> `pageNum?` | `number` | [`AccessOfficialPageOptions`](AccessOfficialPageOptions.md).[`pageNum`](AccessOfficialPageOptions.md#pagenum) |
| <a id="pagesize"></a> `pageSize?` | `number` | [`AccessOfficialPageOptions`](AccessOfficialPageOptions.md).[`pageSize`](AccessOfficialPageOptions.md#pagesize) |
| <a id="since"></a> `since?` | `number` | - |
| <a id="topic"></a> `topic` | [`AccessOfficialSystemLogTopic`](../type-aliases/AccessOfficialSystemLogTopic.md) | - |
| <a id="until"></a> `until?` | `number` | - |

[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessOfficialResult

# Interface: AccessOfficialResult\<T\>

The result of one official request: the payload the endpoint returned, and the pagination beside it when the endpoint paginates.

`pagination` is present exactly when the response carried it and structurally absent otherwise, rather than present-and-undefined. A caller can therefore tell a
paginated endpoint from an unpaginated one by what it received, and nothing here invents a page count for an endpoint that reported none.

## Type Parameters

| Type Parameter | Description |
| ------ | ------ |
| `T` | The payload shape the calling endpoint documents. |

## Properties

| Property | Modifier | Type |
| ------ | ------ | ------ |
| <a id="data"></a> `data` | `readonly` | `T` |
| <a id="pagination"></a> `pagination?` | `readonly` | [`AccessOfficialPagination`](AccessOfficialPagination.md) |

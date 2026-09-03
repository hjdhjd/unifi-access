[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessOfficialPagination

# Interface: AccessOfficialPagination

The pagination a list endpoint reports beside its results. It rides at the top level of the envelope rather than inside the results, on every paginated endpoint
the wire has been observed to answer - including the one the reference documents as nesting it, which it does not.

## Properties

| Property | Modifier | Type |
| ------ | ------ | ------ |
| <a id="page_num"></a> `page_num` | `readonly` | `number` |
| <a id="page_size"></a> `page_size` | `readonly` | `number` |
| <a id="total"></a> `total` | `readonly` | `number` |

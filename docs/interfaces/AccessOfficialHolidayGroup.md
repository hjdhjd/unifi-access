[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessOfficialHolidayGroup

# Interface: AccessOfficialHolidayGroup

A holiday group in full, as the detail and write endpoints return it.

The list endpoint answers a different, narrower shape - see [AccessOfficialHolidayGroupSummary](AccessOfficialHolidayGroupSummary.md) - so the two are distinct types rather than one type with
everything optional, which would let a caller read a member the endpoint it called never sends.

Documentation-derived.

## Properties

| Property | Modifier | Type |
| ------ | ------ | ------ |
| <a id="description"></a> `description` | `readonly` | `string` |
| <a id="holidays"></a> `holidays` | `readonly` | readonly [`AccessOfficialHoliday`](AccessOfficialHoliday.md)[] |
| <a id="id"></a> `id` | `readonly` | `string` |
| <a id="is_default"></a> `is_default` | `readonly` | `boolean` |
| <a id="name"></a> `name` | `readonly` | `string` |
| <a id="template_name"></a> `template_name?` | `readonly` | `string` |

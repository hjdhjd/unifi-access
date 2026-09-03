[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessOfficialHoliday

# Interface: AccessOfficialHoliday

One holiday within a holiday group.

The timestamps are RFC3339 in requests and render without the `T` separator in responses (`2023-08-26 00:00:00Z`), so they are carried as plain strings rather
than as a format this library would have to normalize in one direction and un-normalize in the other.

Documentation-derived.

## Properties

| Property | Modifier | Type |
| ------ | ------ | ------ |
| <a id="description"></a> `description` | `readonly` | `string` |
| <a id="end_time"></a> `end_time` | `readonly` | `string` |
| <a id="id"></a> `id` | `readonly` | `string` |
| <a id="is_template"></a> `is_template?` | `readonly` | `boolean` |
| <a id="name"></a> `name` | `readonly` | `string` |
| <a id="repeat"></a> `repeat` | `readonly` | `boolean` |
| <a id="start_time"></a> `start_time` | `readonly` | `string` |

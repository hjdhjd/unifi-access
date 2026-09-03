[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessLocationConfigInterface

# Interface: AccessLocationConfigInterface

A description of the UniFi Access location JSON.

The controller uses this one record shape everywhere it names a place: for a standalone location, and for the `door`, `floor`, and `location` members embedded in a
device record. Defining it once and referencing it from each of those positions keeps the shape in a single place rather than restating it per position.

## Indexable

```ts
[key: string]: AccessKnownJsonValue
```

## Properties

| Property | Type |
| ------ | ------ |
| <a id="extra_type"></a> `extra_type` | `string` |
| <a id="extras"></a> `extras` | [`AccessLocationExtrasConfig`](../type-aliases/AccessLocationExtrasConfig.md) |
| <a id="full_name"></a> `full_name` | `string` |
| <a id="level"></a> `level` | `number` |
| <a id="location_type"></a> `location_type` | `string` |
| <a id="name"></a> `name` | `string` |
| <a id="previous_name"></a> `previous_name?` | `AccessKnownJsonValue`[] |
| <a id="timezone"></a> `timezone` | `string` |
| <a id="unique_id"></a> `unique_id` | `string` |
| <a id="up_id"></a> `up_id` | `string` |
| <a id="work_time"></a> `work_time` | `string` |
| <a id="work_time_id"></a> `work_time_id` | `string` |

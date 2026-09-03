[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessBootstrapConfigInterface

# Interface: AccessBootstrapConfigInterface

A semi-complete description of the UniFi Access topology JSON, which we use to bootstrap. This is the root of the location hierarchy: a `building` location holding
the floors, and optionally holding hardware directly when a device is attached to the building rather than to one of its doors.

## Indexable

```ts
[key: string]: AccessKnownJsonValue
```

## Properties

| Property | Type |
| ------ | ------ |
| <a id="alias"></a> `alias?` | `string` |
| <a id="device_groups"></a> `device_groups?` | [`AccessDeviceConfigInterface`](AccessDeviceConfigInterface.md)[][] |
| <a id="extra_type"></a> `extra_type` | `string` |
| <a id="extras"></a> `extras` | [`AccessLocationExtrasConfig`](../type-aliases/AccessLocationExtrasConfig.md) |
| <a id="floors"></a> `floors?` | [`AccessFloorConfigInterface`](AccessFloorConfigInterface.md)[] |
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

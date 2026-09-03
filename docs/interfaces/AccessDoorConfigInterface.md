[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessDoorConfigInterface

# Interface: AccessDoorConfigInterface

A description of the UniFi Access door JSON: a location that hardware is attached to, carrying the readers assigned to it and the door-specific guard, hotel, and
camera associations.

## Indexable

```ts
[key: string]: AccessKnownJsonValue
```

## Properties

| Property | Type |
| ------ | ------ |
| <a id="camera_resource_ids"></a> `camera_resource_ids` | `string`[] |
| <a id="device_groups"></a> `device_groups` | [`AccessDeviceConfigInterface`](AccessDeviceConfigInterface.md)[][] |
| <a id="door_guard"></a> `door_guard` | `string`[] |
| <a id="extra_type"></a> `extra_type` | `string` |
| <a id="extras"></a> `extras` | [`AccessLocationExtrasConfig`](../type-aliases/AccessLocationExtrasConfig.md) |
| <a id="full_name"></a> `full_name` | `string` |
| <a id="hotel_devices"></a> `hotel_devices` | `string`[] |
| <a id="level"></a> `level` | `number` |
| <a id="location_type"></a> `location_type` | `string` |
| <a id="name"></a> `name` | `string` |
| <a id="previous_name"></a> `previous_name?` | `AccessKnownJsonValue`[] |
| <a id="timezone"></a> `timezone` | `string` |
| <a id="unique_id"></a> `unique_id` | `string` |
| <a id="up_id"></a> `up_id` | `string` |
| <a id="work_time"></a> `work_time` | `string` |
| <a id="work_time_id"></a> `work_time_id` | `string` |

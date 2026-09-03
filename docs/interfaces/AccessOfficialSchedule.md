[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessOfficialSchedule

# Interface: AccessOfficialSchedule

A schedule: the weekly access pattern a policy grants on, plus the holiday handling that overrides it.

Only the six members the live list endpoint returns are unconditional. `weekly`, `holiday_group`, and `holiday_schedule` are optional because the list view is a
summary projection that omits all three - a caller reading them off a list entry gets `undefined` rather than a value the endpoint never sent.

Live-verified. `status` is on the wire and in no documented schema.

## Properties

| Property | Modifier | Type |
| ------ | ------ | ------ |
| <a id="holiday_group"></a> `holiday_group?` | `readonly` | [`AccessOfficialHolidayGroup`](AccessOfficialHolidayGroup.md) |
| <a id="holiday_group_id"></a> `holiday_group_id` | `readonly` | `string` |
| <a id="holiday_schedule"></a> `holiday_schedule?` | `readonly` | readonly [`AccessOfficialScheduleWindow`](AccessOfficialScheduleWindow.md)[] |
| <a id="id"></a> `id` | `readonly` | `string` |
| <a id="is_default"></a> `is_default` | `readonly` | `boolean` |
| <a id="name"></a> `name` | `readonly` | `string` |
| <a id="status"></a> `status` | `readonly` | `number` |
| <a id="type"></a> `type` | `readonly` | \| `string` & \{ \} \| `"access"` |
| <a id="weekly"></a> `weekly?` | `readonly` | [`AccessOfficialWeekSchedule`](AccessOfficialWeekSchedule.md) |

[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessOfficialScheduleUpdate

# Interface: AccessOfficialScheduleUpdate

Update a schedule. Every member is optional - the endpoint is a partial update.

## Properties

| Property | Type |
| ------ | ------ |
| <a id="holiday_group_id"></a> `holiday_group_id?` | `string` |
| <a id="holiday_schedule"></a> `holiday_schedule?` | readonly [`AccessOfficialScheduleWindow`](AccessOfficialScheduleWindow.md)[] |
| <a id="name"></a> `name?` | `string` |
| <a id="week_schedule"></a> `week_schedule?` | [`AccessOfficialWeekSchedule`](AccessOfficialWeekSchedule.md) |

[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessOfficialScheduleCreate

# Interface: AccessOfficialScheduleCreate

Create a schedule. The name must be unique across the controller.

## Properties

| Property | Type |
| ------ | ------ |
| <a id="holiday_group_id"></a> `holiday_group_id?` | `string` |
| <a id="holiday_schedule"></a> `holiday_schedule?` | readonly [`AccessOfficialScheduleWindow`](AccessOfficialScheduleWindow.md)[] |
| <a id="name"></a> `name` | `string` |
| <a id="week_schedule"></a> `week_schedule` | [`AccessOfficialWeekSchedule`](AccessOfficialWeekSchedule.md) |

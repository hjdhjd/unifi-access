[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessOfficialVisitorCreate

# Interface: AccessOfficialVisitorCreate

Invite a visitor. `week_schedule` makes the visit recurring; omitting it makes it a one-time visit between the start and end times.

## Properties

| Property | Type |
| ------ | ------ |
| <a id="email"></a> `email?` | `string` |
| <a id="end_time"></a> `end_time` | `number` |
| <a id="first_name"></a> `first_name` | `string` |
| <a id="last_name"></a> `last_name` | `string` |
| <a id="mobile_phone"></a> `mobile_phone?` | `string` |
| <a id="remarks"></a> `remarks?` | `string` |
| <a id="resources"></a> `resources?` | readonly [`AccessOfficialVisitorResourceRef`](AccessOfficialVisitorResourceRef.md)[] |
| <a id="start_time"></a> `start_time` | `number` |
| <a id="visit_reason"></a> `visit_reason` | `"Business"` \| `"Cooperation"` \| `"Interview"` \| `"Others"` |
| <a id="visitor_company"></a> `visitor_company?` | `string` |
| <a id="week_schedule"></a> `week_schedule?` | [`AccessOfficialWeekSchedule`](AccessOfficialWeekSchedule.md) |

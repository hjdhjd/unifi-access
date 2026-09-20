[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessOfficialVisitor

# Interface: AccessOfficialVisitor

A visitor: a guest granted access between a start and an end time.

`status` is the wire's integer code - 1 upcoming, 2 visited, 3 visiting, 4 cancelled, 5 no-visit, 6 active - widened with the open arm, because the reference's
published vocabularies have repeatedly understated the wire.

`schedule` is present when the visit recurs and absent when it is a one-time visit, which is the distinction the reference draws.

`avatar`, `create_time`, `has_qr_code`, `location_id`, and `timezone` are live-verified members present on every capture in hand, and the reference documents
none of them. They are optional rather than required because this API varies what a record carries by which endpoint returned it - the schedule list drops three
members the detail read sends - so a member observed on one view is not yet a member every view carries.

Live-verified.

## Properties

| Property | Modifier | Type |
| ------ | ------ | ------ |
| <a id="avatar"></a> `avatar?` | `readonly` | `string` |
| <a id="create_time"></a> `create_time?` | `readonly` | `number` |
| <a id="email"></a> `email` | `readonly` | `string` |
| <a id="end_time"></a> `end_time` | `readonly` | `number` |
| <a id="first_name"></a> `first_name` | `readonly` | `string` |
| <a id="has_qr_code"></a> `has_qr_code?` | `readonly` | `boolean` |
| <a id="id"></a> `id` | `readonly` | `string` |
| <a id="inviter_id"></a> `inviter_id` | `readonly` | `string` |
| <a id="inviter_name"></a> `inviter_name` | `readonly` | `string` |
| <a id="last_name"></a> `last_name` | `readonly` | `string` |
| <a id="license_plates"></a> `license_plates?` | `readonly` | readonly [`AccessOfficialLicensePlate`](AccessOfficialLicensePlate.md)[] |
| <a id="location_id"></a> `location_id?` | `readonly` | `string` |
| <a id="mobile_phone"></a> `mobile_phone` | `readonly` | `string` |
| <a id="nfc_cards"></a> `nfc_cards` | `readonly` | readonly [`AccessOfficialNfcCardRef`](AccessOfficialNfcCardRef.md)[] |
| <a id="pin_code"></a> `pin_code` | `readonly` | `Nullable`\<[`AccessOfficialPinCodeRef`](AccessOfficialPinCodeRef.md)\> |
| <a id="remarks"></a> `remarks` | `readonly` | `string` |
| <a id="resources"></a> `resources?` | `readonly` | readonly [`AccessOfficialVisitorResource`](AccessOfficialVisitorResource.md)[] |
| <a id="schedule"></a> `schedule?` | `readonly` | [`AccessOfficialVisitorSchedule`](AccessOfficialVisitorSchedule.md) |
| <a id="schedule_id"></a> `schedule_id` | `readonly` | `string` |
| <a id="start_time"></a> `start_time` | `readonly` | `number` |
| <a id="status"></a> `status` | `readonly` | \| `2` \| `1` \| `5` \| `number` & \{ \} \| `3` \| `4` \| `6` |
| <a id="timezone"></a> `timezone?` | `readonly` | `string` |
| <a id="visit_reason"></a> `visit_reason` | `readonly` | \| `string` & \{ \} \| `"Business"` \| `"Cooperation"` \| `"Interview"` \| `"Others"` |
| <a id="visitor_company"></a> `visitor_company` | `readonly` | `string` |

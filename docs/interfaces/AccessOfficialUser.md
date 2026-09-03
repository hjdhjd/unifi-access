[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessOfficialUser

# Interface: AccessOfficialUser

A user account on the controller.

`access_policies`, `access_policy_ids`, and `license_plates` are optional because the plain list and fetch responses omit them - they arrive when the request
expands them, and a caller reading them off an unexpanded record gets `undefined` rather than an empty set it might mistake for "none assigned".

`touch_pass` is documented as an array in the schema table and spelled with object members in the reference's own detail sample; the wire returns `null` for an
unassigned user. The sample is transcribed here, because on this reference the sample has repeatedly proved to be the accurate half.

Live-verified.

## Properties

| Property | Modifier | Type |
| ------ | ------ | ------ |
| <a id="access_policies"></a> `access_policies?` | `readonly` | readonly [`AccessOfficialAccessPolicy`](AccessOfficialAccessPolicy.md)[] |
| <a id="access_policy_ids"></a> `access_policy_ids?` | `readonly` | readonly `string`[] |
| <a id="alias"></a> `alias` | `readonly` | `string` |
| <a id="avatar_relative_path"></a> `avatar_relative_path` | `readonly` | `string` |
| <a id="email"></a> `email` | `readonly` | `string` |
| <a id="email_status"></a> `email_status` | `readonly` | `string` |
| <a id="employee_number"></a> `employee_number` | `readonly` | `string` |
| <a id="first_name"></a> `first_name` | `readonly` | `string` |
| <a id="full_name"></a> `full_name` | `readonly` | `string` |
| <a id="id"></a> `id` | `readonly` | `string` |
| <a id="last_name"></a> `last_name` | `readonly` | `string` |
| <a id="license_plates"></a> `license_plates?` | `readonly` | readonly [`AccessOfficialLicensePlate`](AccessOfficialLicensePlate.md)[] |
| <a id="nfc_cards"></a> `nfc_cards` | `readonly` | readonly [`AccessOfficialNfcCardRef`](AccessOfficialNfcCardRef.md)[] |
| <a id="onboard_time"></a> `onboard_time` | `readonly` | `number` |
| <a id="phone"></a> `phone` | `readonly` | `string` |
| <a id="pin_code"></a> `pin_code` | `readonly` | `Nullable`\<[`AccessOfficialPinCodeRef`](AccessOfficialPinCodeRef.md)\> |
| <a id="status"></a> `status` | `readonly` | \| `string` & \{ \} \| `"ACTIVE"` \| `"PENDING"` \| `"DEACTIVATED"` |
| <a id="touch_pass"></a> `touch_pass` | `readonly` | `Nullable`\<[`AccessOfficialTouchPass`](AccessOfficialTouchPass.md)\> |
| <a id="user_email"></a> `user_email` | `readonly` | `string` |
| <a id="username"></a> `username` | `readonly` | `string` |

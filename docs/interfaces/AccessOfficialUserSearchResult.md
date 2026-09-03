[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessOfficialUserSearchResult

# Interface: AccessOfficialUserSearchResult

A user as the search endpoint returns them: the group-member fields plus the two credential members search adds.

Documentation-derived.

## Extends

- [`AccessOfficialUserGroupMember`](AccessOfficialUserGroupMember.md)

## Properties

| Property | Modifier | Type | Inherited from |
| ------ | ------ | ------ | ------ |
| <a id="alias"></a> `alias` | `readonly` | `string` | [`AccessOfficialUserGroupMember`](AccessOfficialUserGroupMember.md).[`alias`](AccessOfficialUserGroupMember.md#alias) |
| <a id="avatar_relative_path"></a> `avatar_relative_path` | `readonly` | `string` | [`AccessOfficialUserGroupMember`](AccessOfficialUserGroupMember.md).[`avatar_relative_path`](AccessOfficialUserGroupMember.md#avatar_relative_path) |
| <a id="email"></a> `email` | `readonly` | `string` | [`AccessOfficialUserGroupMember`](AccessOfficialUserGroupMember.md).[`email`](AccessOfficialUserGroupMember.md#email) |
| <a id="email_status"></a> `email_status` | `readonly` | `string` | [`AccessOfficialUserGroupMember`](AccessOfficialUserGroupMember.md).[`email_status`](AccessOfficialUserGroupMember.md#email_status) |
| <a id="employee_number"></a> `employee_number` | `readonly` | `string` | [`AccessOfficialUserGroupMember`](AccessOfficialUserGroupMember.md).[`employee_number`](AccessOfficialUserGroupMember.md#employee_number) |
| <a id="first_name"></a> `first_name` | `readonly` | `string` | [`AccessOfficialUserGroupMember`](AccessOfficialUserGroupMember.md).[`first_name`](AccessOfficialUserGroupMember.md#first_name) |
| <a id="full_name"></a> `full_name` | `readonly` | `string` | [`AccessOfficialUserGroupMember`](AccessOfficialUserGroupMember.md).[`full_name`](AccessOfficialUserGroupMember.md#full_name) |
| <a id="id"></a> `id` | `readonly` | `string` | [`AccessOfficialUserGroupMember`](AccessOfficialUserGroupMember.md).[`id`](AccessOfficialUserGroupMember.md#id) |
| <a id="last_name"></a> `last_name` | `readonly` | `string` | [`AccessOfficialUserGroupMember`](AccessOfficialUserGroupMember.md).[`last_name`](AccessOfficialUserGroupMember.md#last_name) |
| <a id="nfc_cards"></a> `nfc_cards` | `readonly` | readonly [`AccessOfficialNfcCardRef`](AccessOfficialNfcCardRef.md)[] | - |
| <a id="onboard_time"></a> `onboard_time` | `readonly` | `number` | [`AccessOfficialUserGroupMember`](AccessOfficialUserGroupMember.md).[`onboard_time`](AccessOfficialUserGroupMember.md#onboard_time) |
| <a id="phone"></a> `phone` | `readonly` | `string` | [`AccessOfficialUserGroupMember`](AccessOfficialUserGroupMember.md).[`phone`](AccessOfficialUserGroupMember.md#phone) |
| <a id="pin_code"></a> `pin_code` | `readonly` | `Nullable`\<[`AccessOfficialPinCodeRef`](AccessOfficialPinCodeRef.md)\> | - |
| <a id="status"></a> `status` | `readonly` | \| `string` & \{ \} \| `"ACTIVE"` \| `"PENDING"` \| `"DEACTIVATED"` | [`AccessOfficialUserGroupMember`](AccessOfficialUserGroupMember.md).[`status`](AccessOfficialUserGroupMember.md#status) |
| <a id="user_email"></a> `user_email` | `readonly` | `string` | [`AccessOfficialUserGroupMember`](AccessOfficialUserGroupMember.md).[`user_email`](AccessOfficialUserGroupMember.md#user_email) |
| <a id="username"></a> `username` | `readonly` | `string` | [`AccessOfficialUserGroupMember`](AccessOfficialUserGroupMember.md).[`username`](AccessOfficialUserGroupMember.md#username) |

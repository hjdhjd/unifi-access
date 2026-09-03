[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessUserConfigInterface

# Interface: AccessUserConfigInterface

A semi-complete description of the UniFi Access user JSON, as returned for the authenticated user.

This document arrives unwrapped: the profile object is the entire response body, with none of the code and data envelope every other endpoint uses, so it is never
read through [AccessApiResponseInterface](AccessApiResponseInterface.md).

The trailing camelCase members are the odd ones out in an otherwise snake_case document. They arrive from the UniFi OS identity layer rather than from Access itself,
and they are preserved exactly as the wire spells them rather than normalized into the surrounding convention.

## Indexable

```ts
[key: string]: AccessKnownJsonValue
```

## Properties

| Property | Type |
| ------ | ------ |
| <a id="accessmask"></a> `accessMask` | `number` |
| <a id="alias"></a> `alias` | `string` |
| <a id="avatar"></a> `avatar` | `Nullable`\<`AccessKnownJsonValue`\> |
| <a id="avatar_relative_path"></a> `avatar_relative_path` | `string` |
| <a id="avatar_rpath2"></a> `avatar_rpath2` | `string` |
| <a id="cloud_access_granted"></a> `cloud_access_granted` | `boolean` |
| <a id="create_time"></a> `create_time` | `number` |
| <a id="email"></a> `email` | `string` |
| <a id="email_is_null"></a> `email_is_null` | `boolean` |
| <a id="email_status"></a> `email_status` | `string` |
| <a id="employee_number"></a> `employee_number` | `string` |
| <a id="extras"></a> `extras` | `Record`\<`string`, `string`\> |
| <a id="first_name"></a> `first_name` | `string` |
| <a id="full_name"></a> `full_name` | `string` |
| <a id="groups"></a> `groups` | [`AccessUserGroupConfigInterface`](AccessUserGroupConfigInterface.md)[] |
| <a id="id"></a> `id` | `string` |
| <a id="ismember"></a> `isMember` | `boolean` |
| <a id="isowner"></a> `isOwner` | `boolean` |
| <a id="issuperadmin"></a> `isSuperAdmin` | `boolean` |
| <a id="last_name"></a> `last_name` | `string` |
| <a id="local_account_exist"></a> `local_account_exist` | `boolean` |
| <a id="login_time"></a> `login_time` | `number` |
| <a id="maskedemail"></a> `maskedEmail` | `string` |
| <a id="nfc_card_status"></a> `nfc_card_status` | `string` |
| <a id="nfc_card_type"></a> `nfc_card_type` | `string` |
| <a id="nfc_display_id"></a> `nfc_display_id` | `string` |
| <a id="nfc_token"></a> `nfc_token` | `string` |
| <a id="only_local_account"></a> `only_local_account` | `boolean` |
| <a id="org_role"></a> `org_role` | `string` |
| <a id="org_user_id"></a> `org_user_id` | `string` |
| <a id="password_revision"></a> `password_revision` | `number` |
| <a id="permissionmask"></a> `permissionMask` | `number` |
| <a id="permissions"></a> `permissions` | `Record`\<`string`, `string`[]\> |
| <a id="phone"></a> `phone` | `string` |
| <a id="role"></a> `role` | `string` |
| <a id="roleid"></a> `roleId` | `string` |
| <a id="roles"></a> `roles` | [`AccessUserRoleConfigInterface`](AccessUserRoleConfigInterface.md)[] |
| <a id="scopes"></a> `scopes` | `string`[] |
| <a id="sso_account"></a> `sso_account` | `string` |
| <a id="sso_picture"></a> `sso_picture` | `string` |
| <a id="sso_username"></a> `sso_username` | `string` |
| <a id="sso_uuid"></a> `sso_uuid` | `string` |
| <a id="status"></a> `status` | `string` |
| <a id="ucorepermission"></a> `ucorePermission` | \{ `hasUpdateAndInstallPermission`: `boolean`; \} |
| `ucorePermission.hasUpdateAndInstallPermission` | `boolean` |
| <a id="uid_account_status"></a> `uid_account_status` | `string` |
| <a id="uid_sso_account"></a> `uid_sso_account` | `string` |
| <a id="uid_sso_id"></a> `uid_sso_id` | `string` |
| <a id="unique_id"></a> `unique_id` | `string` |
| <a id="update_time"></a> `update_time` | `number` |
| <a id="user_email"></a> `user_email` | `string` |
| <a id="username"></a> `username` | `string` |

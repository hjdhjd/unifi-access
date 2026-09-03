[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessOfficialUserUpdate

# Interface: AccessOfficialUserUpdate

Update a user. Every member is optional - the endpoint is a partial update, and an omitted member is left as it stands.

## Properties

| Property | Type |
| ------ | ------ |
| <a id="employee_number"></a> `employee_number?` | `string` |
| <a id="first_name"></a> `first_name?` | `string` |
| <a id="last_name"></a> `last_name?` | `string` |
| <a id="onboard_time"></a> `onboard_time?` | `number` |
| <a id="status"></a> `status?` | `"ACTIVE"` \| `"DEACTIVATED"` |
| <a id="user_email"></a> `user_email?` | `string` |

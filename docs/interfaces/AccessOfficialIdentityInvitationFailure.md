[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessOfficialIdentityInvitationFailure

# Interface: AccessOfficialIdentityInvitationFailure

One invitation that could not be sent. The controller reports the request as a success even when individual invitations fail, so this array is where a partial
failure is visible - an empty one means every invitation went out.

Documentation-derived.

## Properties

| Property | Modifier | Type |
| ------ | ------ | ------ |
| <a id="error_code"></a> `error_code` | `readonly` | `string` |
| <a id="error_msg"></a> `error_msg` | `readonly` | `string` |
| <a id="user_email"></a> `user_email` | `readonly` | `string` |
| <a id="user_id"></a> `user_id` | `readonly` | `string` |

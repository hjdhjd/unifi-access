[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessWebhookDoorUnlockObject

# Interface: AccessWebhookDoorUnlockObject

What an unlock delivery reports: how the door was opened, whether it opened, and on whose behalf.

`actor_id`, `actor_name`, and `extra` are present only on an unlock the official API performed with attribution supplied - they are exactly what the unlock
endpoint accepts and echoes back here, which is what makes an automated unlock legible in the controller's own records as the automation rather than as the
account it signed in with. An unlock from any other source carries none of them.

`authentication_type` reads through [ACCESS\_AUTHENTICATION\_TYPES](../variables/ACCESS_AUTHENTICATION_TYPES.md) when the value is being shown to a person, and a token that table does not name is
shown as the wire delivered it.

Live-verified.

## Properties

| Property | Modifier | Type |
| ------ | ------ | ------ |
| <a id="actor_id"></a> `actor_id?` | `readonly` | `string` |
| <a id="actor_name"></a> `actor_name?` | `readonly` | `string` |
| <a id="authentication_type"></a> `authentication_type` | `readonly` | `string` |
| <a id="authentication_value"></a> `authentication_value` | `readonly` | `string` |
| <a id="extra"></a> `extra?` | `readonly` | `Readonly`\<`Record`\<`string`, `AccessKnownJsonValue`\>\> |
| <a id="policy_id"></a> `policy_id` | `readonly` | `string` |
| <a id="policy_name"></a> `policy_name` | `readonly` | `string` |
| <a id="reader_id"></a> `reader_id` | `readonly` | `string` |
| <a id="result"></a> `result` | `readonly` | `string` |
| <a id="time"></a> `time` | `readonly` | `string` |

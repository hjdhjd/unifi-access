[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessOfficialWebhookEndpointWrite

# Interface: AccessOfficialWebhookEndpointWrite

Register or replace a webhook endpoint. The update endpoint takes the same full record rather than a partial one, so this shape serves both.

`headers` are sent with every delivery to this endpoint, which is how a receiver behind its own authentication is reached.

## Properties

| Property | Type |
| ------ | ------ |
| <a id="endpoint"></a> `endpoint` | `string` |
| <a id="events"></a> `events` | readonly ( \| `"access.door.unlock"` \| `"access.device.dps_status"` \| `"access.device.emergency_status"` \| `"access.doorbell.completed"` \| `"access.doorbell.incoming"` \| `"access.doorbell.incoming.REN"` \| `"access.temporary_unlock.end"` \| `"access.temporary_unlock.start"` \| `"access.unlock_schedule.activate"` \| `"access.unlock_schedule.deactivate"` \| `"access.visitor.status.changed"`)[] |
| <a id="headers"></a> `headers?` | `Readonly`\<`Record`\<`string`, `string`\>\> |
| <a id="name"></a> `name` | `string` |

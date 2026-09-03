[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessOfficialWebhookEndpoint

# Interface: AccessOfficialWebhookEndpoint

A registered webhook endpoint.

`secret` is what [verifyWebhookSignature](../functions/verifyWebhookSignature.md) takes to establish that a delivery really came from this controller. It is returned on every read and write, so
it can be re-read rather than having to be captured at registration.

The field description calls `endpoint` an HTTPS URL, but the controller accepts and delivers to a plain `http://` endpoint without complaint - transport security
here is the receiver's responsibility rather than something the controller enforces.

Live-verified.

## Properties

| Property | Modifier | Type |
| ------ | ------ | ------ |
| <a id="endpoint"></a> `endpoint` | `readonly` | `string` |
| <a id="events"></a> `events` | `readonly` | readonly ( \| `"access.door.unlock"` \| `"access.device.dps_status"` \| `"access.device.emergency_status"` \| `"access.doorbell.completed"` \| `"access.doorbell.incoming"` \| `"access.doorbell.incoming.REN"` \| `"access.temporary_unlock.end"` \| `"access.temporary_unlock.start"` \| `"access.unlock_schedule.activate"` \| `"access.unlock_schedule.deactivate"` \| `"access.visitor.status.changed"`)[] |
| <a id="headers"></a> `headers?` | `readonly` | `Readonly`\<`Record`\<`string`, `string`\>\> |
| <a id="id"></a> `id` | `readonly` | `string` |
| <a id="name"></a> `name` | `readonly` | `string` |
| <a id="secret"></a> `secret` | `readonly` | `string` |

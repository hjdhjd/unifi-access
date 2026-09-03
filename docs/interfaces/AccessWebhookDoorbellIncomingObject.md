[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessWebhookDoorbellIncomingObject

# Interface: AccessWebhookDoorbellIncomingObject

What a doorbell-ring delivery reports: the identifier of the call that is beginning.

That identifier is the join key across channels - the notification socket names the same call as `remote_call_request_id` when it ends - so a consumer reading
both channels can correlate them on it.

Live-verified.

## Properties

| Property | Modifier | Type |
| ------ | ------ | ------ |
| <a id="request_id"></a> `request_id` | `readonly` | `string` |

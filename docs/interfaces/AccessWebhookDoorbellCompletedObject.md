[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessWebhookDoorbellCompletedObject

# Interface: AccessWebhookDoorbellCompletedObject

What a doorbell-completed delivery reports: which call ended, and why.

`reason_code` reads through [ACCESS\_DOORBELL\_REASON\_CODES](../variables/ACCESS_DOORBELL_REASON_CODES.md), which carries the corrected meaning of the one code whose documented gloss the wire
contradicts.

Live-verified.

## Properties

| Property | Modifier | Type |
| ------ | ------ | ------ |
| <a id="host_device_mac"></a> `host_device_mac` | `readonly` | `string` |
| <a id="reason_code"></a> `reason_code` | `readonly` | `number` |
| <a id="request_id"></a> `request_id` | `readonly` | `string` |

[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessHttpThrottleEnteredPayload

# Interface: AccessHttpThrottleEnteredPayload

Payload published on [channels.httpThrottleEntered](../variables/channels.md#property-httpthrottleentered). `consecutiveFailures` is the count that crossed the limit and `cooldownMs` is how long the transport
will refuse requests before it allows a recovery probe through.

## Properties

| Property | Type |
| ------ | ------ |
| <a id="consecutivefailures"></a> `consecutiveFailures` | `number` |
| <a id="cooldownms"></a> `cooldownMs` | `number` |
| <a id="host"></a> `host` | `string` |

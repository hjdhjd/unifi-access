[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessWebhookSignature

# Interface: AccessWebhookSignature

What a verified signature established: the moment the controller signed the delivery, as the unix timestamp in seconds the header's `t` member carried and the
MAC covered. A receiver compares it against its own clock to apply whatever freshness window its policy calls for.

## Properties

| Property | Modifier | Type |
| ------ | ------ | ------ |
| <a id="timestamp"></a> `timestamp` | `readonly` | `number` |

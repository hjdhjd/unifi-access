[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessWebhookActor

# Interface: AccessWebhookActor

Who an action is attributed to, when the controller attributes it to anyone.

`type` is the raw wire value, and the webhook channel spells the API-caller actor with a hyphen where the notification socket spells it with an underscore. Pass
it through [normalizeActorType](../functions/normalizeActorType.md) to read one spelling for the one concept rather than branching on which channel delivered the record.

## Properties

| Property | Modifier | Type |
| ------ | ------ | ------ |
| <a id="id"></a> `id` | `readonly` | `string` |
| <a id="name"></a> `name` | `readonly` | `string` |
| <a id="type"></a> `type` | `readonly` | `string` |

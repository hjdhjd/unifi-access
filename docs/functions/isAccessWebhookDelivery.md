[**unifi-access**](../README.md)

***

[Home](../README.md) / isAccessWebhookDelivery

# Function: isAccessWebhookDelivery()

```ts
function isAccessWebhookDelivery(value): value is AccessWebhookEvent;
```

Whether a decoded value is shaped like an [AccessWebhookEvent](../type-aliases/AccessWebhookEvent.md). This is the decode boundary a receiver needs: a delivery arrives as untrusted JSON on the
receiver's own HTTP surface, and asserting the parsed value into the delivery union would let any valid-JSON body through to a `switch` on `event`.

The checked members are the envelope every delivery shares: `event` must be a name the union carries, `event_object_id` a string, and `data` a record whose
`location` and `object` are records and whose `device` and `actor` are present as either a record or `null`. The event-specific shape under `object` is
deliberately not checked, on the same terms as the notification packet guard: the envelope is what a receiver switches on, the union's arms describe what each
event's object carries, and the open records carry whatever the controller sends.

## Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `value` | `unknown` | A decoded value of unknown shape, typically the parsed body of a delivery whose signature [verifyWebhookSignature](verifyWebhookSignature.md) has established. |

## Returns

`value is AccessWebhookEvent`

`true` when the value carries the envelope a delivery carries.

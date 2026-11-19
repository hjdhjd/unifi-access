[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessWebhookDelivery

# Interface: AccessWebhookDelivery\<TEvent, TObject\>

The body of a webhook delivery: the event's name, the identifier the controller minted for this delivery, and the payload.

Every delivery carries the same payload members - the location, the device, the actor, and an `object` whose shape is the event's own - and carries each of those
keys every time. The device is null on an event raised by something other than a device, and the actor is null where the controller attributes the action to no
one, as for a doorbell press or a sensor transition.

## Type Parameters

| Type Parameter | Description |
| ------ | ------ |
| <a id="type-parameter-tevent"></a> `TEvent` *extends* `string` | The event name, which is what tells the members of [AccessWebhookEvent](../type-aliases/AccessWebhookEvent.md) apart. |
| <a id="type-parameter-tobject"></a> `TObject` | The event-specific payload. |

## Properties

| Property | Modifier | Type |
| ------ | ------ | ------ |
| <a id="data"></a> `data` | `readonly` | \{ `actor`: `Nullable`\<[`AccessWebhookActor`](AccessWebhookActor.md)\>; `device`: `Nullable`\<[`AccessWebhookDevice`](AccessWebhookDevice.md)\>; `location`: [`AccessWebhookLocation`](AccessWebhookLocation.md); `object`: `TObject`; \} |
| `data.actor` | `readonly` | `Nullable`\<[`AccessWebhookActor`](AccessWebhookActor.md)\> |
| `data.device` | `readonly` | `Nullable`\<[`AccessWebhookDevice`](AccessWebhookDevice.md)\> |
| `data.location` | `readonly` | [`AccessWebhookLocation`](AccessWebhookLocation.md) |
| `data.object` | `readonly` | `TObject` |
| <a id="event"></a> `event` | `readonly` | `TEvent` |
| <a id="event_object_id"></a> `event_object_id` | `readonly` | `string` |

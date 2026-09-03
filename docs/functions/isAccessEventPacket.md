[**unifi-access**](../README.md)

***

[Home](../README.md) / isAccessEventPacket

# Function: isAccessEventPacket()

```ts
function isAccessEventPacket(value): value is AccessEventPacketInterface;
```

Whether a decoded value is shaped like an [AccessEventPacket](../type-aliases/AccessEventPacket.md). This is the decode boundary the notification stream needs: `JSON.parse` hands back an
unchecked value, and asserting that value into the packet type would let any valid-JSON frame through, so a frame carrying no `event_object_id` would reach
consumers with an undefined identifier typed as a string and be published under it.

The checked fields are the ones the classifier actually reads from the envelope: `event` and `event_object_id` must be strings, and `data` must be present and
either null or a record, because a deletion notification legitimately carries `data: null`. `meta` is deliberately not required - it is optional on the packet
and the classifier reaches it through optional chaining.

## Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `value` | `unknown` | A decoded value of unknown shape, typically the result of parsing a notification frame. |

## Returns

`value is AccessEventPacketInterface`

`true` when the value carries the envelope the classifier reads.

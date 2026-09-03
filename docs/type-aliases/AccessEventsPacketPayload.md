[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessEventsPacketPayload

# Type Alias: AccessEventsPacketPayload

```ts
type AccessEventsPacketPayload = {
  eventName: string;
  host: string;
} & 
  | {
  id: string;
  kind: AccessEventsPacketIdKind;
}
  | {
  kind: AccessEventsPacketNoIdKind;
};
```

Payload published on [channels.eventsPacket](../variables/channels.md#property-eventspacket). `eventName` is the notification name exactly as the controller sent it, which is what a consumer needs to
tell the controller's two notification dialects apart after the classifier has normalized them into one kind.

The shape splits on whether the event identifies an entity. Most kinds name the device or location they concern; the rest identify something that is not a single
modeled record - a ring cancellation names the call it ends, a door-state report names each of the doors it carries - so they carry no entity identifier and the
type does not invent one for them.

## Type Declaration

| Name | Type |
| ------ | ------ |
| `eventName` | `string` |
| `host` | `string` |

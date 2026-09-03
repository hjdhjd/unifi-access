[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessEventsPacketNoIdKind

# Type Alias: AccessEventsPacketNoIdKind

```ts
type AccessEventsPacketNoIdKind = Exclude<AccessWireEvent, {
  id: string;
}>["kind"];
```

The event kinds that carry no entity identifier, derived as the exact complement of [AccessEventsPacketIdKind](AccessEventsPacketIdKind.md) so the two vocabularies partition the wire
union between them and neither can drift from the classifier that produces it.

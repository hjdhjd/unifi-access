[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessEventsPacketIdKind

# Type Alias: AccessEventsPacketIdKind

```ts
type AccessEventsPacketIdKind = Extract<AccessWireEvent, {
  id: string;
}>["kind"];
```

The event kinds that carry an entity identifier, derived from the wire-event union itself rather than restated, so this vocabulary cannot drift from the
classifier that produces it. Deriving from [AccessWireEvent](AccessWireEvent.md) also excludes the synthetic bootstrap member by construction, because that member never
rides the notification stream.

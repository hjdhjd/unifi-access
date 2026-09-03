[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessWireEvent

# Type Alias: AccessWireEvent

```ts
type AccessWireEvent = Exclude<AccessTypedEvent, 
  | {
  kind: "bootstrapLoaded";
}
  | {
  kind: "censusApplied";
}
  | {
  kind: "controllerChanged";
}
  | {
  kind: "doorStateFactsApplied";
}>;
```

The members of [AccessTypedEvent](AccessTypedEvent.md) that a notification packet can actually produce - the rule being that a wire event is whatever the classifier can return.
The classifier lifts wire packets and nothing else, while the synthetic members are the ones the client dispatches directly from a fetched document, so a
consumer reading the notification stream can hold this narrower type honestly rather than carrying arms the wire will never hand it. Every member here is an
[AccessTypedEvent](AccessTypedEvent.md), so anything that accepts the wider union accepts these unchanged.

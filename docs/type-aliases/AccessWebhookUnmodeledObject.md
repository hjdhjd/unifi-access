[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessWebhookUnmodeledObject

# Type Alias: AccessWebhookUnmodeledObject

```ts
type AccessWebhookUnmodeledObject = Readonly<Record<string, AccessKnownJsonValue>>;
```

The payload of an event the reference names in its webhook vocabulary without publishing a sample of it, and which no capture in hand has exercised.

These deliveries carry the same location, device, and actor members as every other, so only the event-specific member is unknown - and it is left as the open
record it genuinely is, rather than being invented from the event's name. A consumer reading one of these narrows it itself; when a capture settles a shape, it
replaces this with the same evidence discipline every other type here follows.

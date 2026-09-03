[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessOfficialWebhookEventName

# Type Alias: AccessOfficialWebhookEventName

```ts
type AccessOfficialWebhookEventName = AccessWebhookEvent["event"];
```

The name of an event an endpoint can be registered for.

This is derived by indexing the delivery union rather than by respelling its names, so the set a caller may register for and the set they may receive stay one
vocabulary: adding a delivery type extends the registration surface with it, and a name that is not a delivery cannot be registered at all.

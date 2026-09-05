[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessStoreDispatchPayload

# Interface: AccessStoreDispatchPayload

Payload published on the `unifi-access:store:dispatch` channel. `kind` is the event's own tag, taken from the typed union the reducer folds, so the vocabulary
here is the reducer's rather than a second list that could fall behind it.

That vocabulary includes the synthetic kinds, which are the ones a subscriber watching for state flow should expect to see without a packet having arrived:
`bootstrapLoaded` and `controllerChanged` for the documents a fetch supplies, and `doorStateFactsApplied` for the door facts an official read supplies. They are
dispatched by the composition root rather than lifted from the wire, and they are reported here exactly as a wire-borne event is.

## Properties

| Property | Type |
| ------ | ------ |
| <a id="host"></a> `host` | `string` |
| <a id="kind"></a> `kind` | \| `"unlock"` \| `"bootstrapLoaded"` \| `"controllerChanged"` \| `"doorStateFactsApplied"` \| `"censusApplied"` \| `"deviceChanged"` \| `"deviceRemoved"` \| `"locationChanged"` \| `"doorbellRing"` \| `"doorbellCancel"` \| `"tamperAlert"` \| `"doorStateChanged"` |

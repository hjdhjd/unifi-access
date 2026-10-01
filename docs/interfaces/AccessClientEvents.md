[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessClientEvents

# Interface: AccessClientEvents

The events [AccessClient](../classes/AccessClient.md) publishes.

`packet` is the realtime firehose: the same typed event that feeds the reducer, fanned out to consumers. The notification stream decodes and classifies each
frame once, and the composition root's single bridge dispatches that event into the store and then emits it here - so there is one decode path serving both the
state model and the firehose, and a consumer reading `client.state` inside a handler already sees the post-event state.

`rawPacket` is the raw observability firehose: every well-formed frame the controller sent, emitted before classification, so it carries both the notifications
the library does not model and the payload fields the translation drops. It is never dispatched into state.
`packetRejected` reports invalid JSON or notification envelopes without treating an independently rejected message as a connection failure.

## Properties

| Property | Type |
| ------ | ------ |
| <a id="packet"></a> `packet` | \[[`AccessWireEvent`](../type-aliases/AccessWireEvent.md)\] |
| <a id="packetrejected"></a> `packetRejected` | \[\{ `reason`: `"invalidEnvelope"` \| `"invalidJson"`; \}\] |
| <a id="rawpacket"></a> `rawPacket` | \[[`AccessEventPacketInterface`](AccessEventPacketInterface.md)\] |

[**unifi-access**](../README.md)

***

[Home](../README.md) / channels

# Variable: channels

```ts
const channels: {
  authRelogin: Channel<AccessAuthReloginPayload, AccessAuthReloginPayload>;
  connectionTransition: Channel<AccessConnectionTransitionPayload, AccessConnectionTransitionPayload>;
  eventsClosed: Channel<AccessEventsClosedPayload, AccessEventsClosedPayload>;
  eventsPacket: Channel<AccessEventsPacketPayload, AccessEventsPacketPayload>;
  httpRequestEnd: Channel<AccessHttpRequestEndPayload, AccessHttpRequestEndPayload>;
  httpRequestStart: Channel<AccessHttpRequestStartPayload, AccessHttpRequestStartPayload>;
  httpThrottleEntered: Channel<AccessHttpThrottleEnteredPayload, AccessHttpThrottleEnteredPayload>;
  httpThrottleExited: Channel<AccessHttpThrottleExitedPayload, AccessHttpThrottleExitedPayload>;
  storeDispatch: Channel<AccessStoreDispatchPayload, AccessStoreDispatchPayload>;
};
```

The library's observability surface, expressed as `node:diagnostics_channel` publishers.

Diagnostics channels are part of the public contract - they are named, documented, and versioned alongside the API. A consumer subscribes to any channel to
observe the library's internal lifecycle (HTTP requests, throttle transitions, session recovery, realtime event flow) without the library having to grow bespoke
logging hooks or callback parameters for each. This is the modern Node observability primitive: zero overhead when nobody is listening, because every publisher
gates on `channel.hasSubscribers` before it builds a payload, and adaptable to any backend - a consumer can bridge any channel to OpenTelemetry, Pino, or a
metrics counter.

Channel names follow a stable `unifi-access:<subsystem>:<event>:<phase>` taxonomy. This module declares every channel exactly once and each subsystem imports the
publisher it needs from here rather than re-deriving the name string, so a rename is a single edit and a typo at a call site is impossible.

This module is the single source of truth for the channel set. Each channel is declared with its payload type, so a consumer's `subscribe` handler is typed and
the generated reference documentation links each channel to its payload. Adding a channel touches both: the typed, doc-commented entry here and its payload type
below.

Every payload carries the controller `host` this client was built against. The channels are process-global, so a consumer running more than one client needs that
attribution to tell one controller's traffic from another's.

The module sits at the source root rather than inside a tier because every tier publishes on it. Homing it here means a lower tier reaches its own publisher
through a downward import like any other, and this module's own references upward are type-only and therefore erased.

## Type Declaration

| Name | Type | Description |
| ------ | ------ | ------ |
| <a id="property-authrelogin"></a> `authRelogin` | `Channel`\<[`AccessAuthReloginPayload`](../type-aliases/AccessAuthReloginPayload.md), [`AccessAuthReloginPayload`](../type-aliases/AccessAuthReloginPayload.md)\> | The 401-triggered relogin ran. Published by the `AuthSession` at the end of every `reauthenticate`, whichever way it settled: the handshake succeeded, the handshake was refused, the handshake threw, or there were no retained credentials to attempt one with. This is the only visibility a consumer gets into mid-session recovery, which is otherwise entirely silent - the transport invokes the relogin hook on a 401 and the consumer sees neither the call nor its result. Connect-time login is deliberately not published here, because the `login` call's own outcome and the `http:request:*` channels already report it. |
| <a id="property-connectiontransition"></a> `connectionTransition` | `Channel`\<[`AccessConnectionTransitionPayload`](../type-aliases/AccessConnectionTransitionPayload.md), [`AccessConnectionTransitionPayload`](../type-aliases/AccessConnectionTransitionPayload.md)\> | The connection state machine moved. Published by the `AccessClient` from the one bridge it subscribes to the connection monitor's own rail, so every edge the monitor reports reaches a consumer here with the controller it belongs to stamped on. The monitor itself publishes nothing: it is built to be host-agnostic, and the client is the layer that knows which controller it addresses. The reconnecting announcement rides this channel too rather than having one of its own, because it is one of the edges rather than a separate kind of event. |
| <a id="property-eventsclosed"></a> `eventsClosed` | `Channel`\<[`AccessEventsClosedPayload`](../interfaces/AccessEventsClosedPayload.md), [`AccessEventsClosedPayload`](../interfaces/AccessEventsClosedPayload.md)\> | The realtime notification WebSocket closed. Published by the `EventStream` from its single teardown path, so it fires exactly once per stream and for every cause alike - a peer close, a socket error, a watchdog stall, or a deliberate `close()`. The payload mirrors the close frame, which is what tells a consumer whether the controller ended the connection cleanly or it dropped. |
| <a id="property-eventspacket"></a> `eventsPacket` | `Channel`\<[`AccessEventsPacketPayload`](../type-aliases/AccessEventsPacketPayload.md), [`AccessEventsPacketPayload`](../type-aliases/AccessEventsPacketPayload.md)\> | A notification packet was classified. Published by the `EventStream` once per frame that the classifier lifted into a typed event, immediately before that event reaches the packet rail. Frames the classifier declines publish nothing here, so the channel measures modeled activity rather than raw wire volume; a consumer wanting every frame subscribes to the stream's own raw rail instead. |
| <a id="property-httprequestend"></a> `httpRequestEnd` | `Channel`\<[`AccessHttpRequestEndPayload`](../type-aliases/AccessHttpRequestEndPayload.md), [`AccessHttpRequestEndPayload`](../type-aliases/AccessHttpRequestEndPayload.md)\> | An HTTP request completed. Published by the `Transport` on both outcomes - a response of any status, or a transport-level failure that produced none - so a consumer can measure latency and failure rate from one channel. `requestId` correlates it with the matching start. |
| <a id="property-httprequeststart"></a> `httpRequestStart` | `Channel`\<[`AccessHttpRequestStartPayload`](../type-aliases/AccessHttpRequestStartPayload.md), [`AccessHttpRequestStartPayload`](../type-aliases/AccessHttpRequestStartPayload.md)\> | An HTTP request was dispatched. Published by the `Transport` as it hands the request to the connection pool, after the throttle gate has allowed it through. Pairs with the matching end through `requestId`. |
| <a id="property-httpthrottleentered"></a> `httpThrottleEntered` | `Channel`\<[`AccessHttpThrottleEnteredPayload`](../interfaces/AccessHttpThrottleEnteredPayload.md), [`AccessHttpThrottleEnteredPayload`](../interfaces/AccessHttpThrottleEnteredPayload.md)\> | The transport entered its throttle cooldown. Published by the `Transport` on the trip edge only, when consecutive failures cross the error limit, so it reports the transition rather than each refused request. The payload carries the cooldown so a consumer can show how long the controller will be left alone. |
| <a id="property-httpthrottleexited"></a> `httpThrottleExited` | `Channel`\<[`AccessHttpThrottleExitedPayload`](../interfaces/AccessHttpThrottleExitedPayload.md), [`AccessHttpThrottleExitedPayload`](../interfaces/AccessHttpThrottleExitedPayload.md)\> | The transport left its throttle cooldown. Published by the `Transport` on the closing edge only - the recovery probe that succeeded - so entered and exited pair one-to-one and a consumer never sees the signal flap while a failing probe re-arms the cooldown underneath it. |
| <a id="property-storedispatch"></a> `storeDispatch` | `Channel`\<[`AccessStoreDispatchPayload`](../interfaces/AccessStoreDispatchPayload.md), [`AccessStoreDispatchPayload`](../interfaces/AccessStoreDispatchPayload.md)\> | An event was committed to the state store. Published by the `AccessClient` from the store's dispatch hook, once per event that actually advanced the state - so this measures the flow of change rather than the volume of traffic, and an event the reducer absorbed reaches it not at all. The payload carries the event's kind and not its payload. Dispatch is the hottest path in the library, and a channel that copied each event's data would make observing it cost more than the work being observed; a consumer that wants the data itself has the client's own realtime firehose, which carries every event whole. The trade is deliberate: this channel answers "what is flowing, and how fast", not "what exactly changed". |

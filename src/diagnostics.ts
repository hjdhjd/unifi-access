/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * diagnostics.ts: Named node:diagnostics_channel publishers for the UniFi Access library.
 */
import type { AccessTypedEvent, AccessWireEvent } from "./protocol/events.ts";
import type { ConnectionTransition } from "./client/connection.ts";
import diagnosticsChannel from "node:diagnostics_channel";

/**
 * The library's observability surface, expressed as `node:diagnostics_channel` publishers.
 *
 * Diagnostics channels are part of the public contract - they are named, documented, and versioned alongside the API. A consumer subscribes to any channel to
 * observe the library's internal lifecycle (HTTP requests, throttle transitions, session recovery, realtime event flow) without the library having to grow bespoke
 * logging hooks or callback parameters for each. This is the modern Node observability primitive: zero overhead when nobody is listening, because every publisher
 * gates on `channel.hasSubscribers` before it builds a payload, and adaptable to any backend - a consumer can bridge any channel to OpenTelemetry, Pino, or a
 * metrics counter.
 *
 * Channel names follow a stable `unifi-access:<subsystem>:<event>:<phase>` taxonomy. This module declares every channel exactly once and each subsystem imports the
 * publisher it needs from here rather than re-deriving the name string, so a rename is a single edit and a typo at a call site is impossible.
 *
 * This module is the single source of truth for the channel set. Each channel is declared with its payload type, so a consumer's `subscribe` handler is typed and
 * the generated reference documentation links each channel to its payload. Adding a channel touches both: the typed, doc-commented entry here and its payload type
 * below.
 *
 * Every payload carries the controller `host` this client was built against. The channels are process-global, so a consumer running more than one client needs that
 * attribution to tell one controller's traffic from another's.
 *
 * The module sits at the source root rather than inside a tier because every tier publishes on it. Homing it here means a lower tier reaches its own publisher
 * through a downward import like any other, and this module's own references upward are type-only and therefore erased.
 *
 * @category Diagnostics
 */
export const channels = {

  /** The 401-triggered relogin ran. Published by the `AuthSession` at the end of every `reauthenticate`, whichever way it settled: the handshake succeeded, the
   * handshake was refused, the handshake threw, or there were no retained credentials to attempt one with. This is the only visibility a consumer gets into
   * mid-session recovery, which is otherwise entirely silent - the transport invokes the relogin hook on a 401 and the consumer sees neither the call nor its
   * result. Connect-time login is deliberately not published here, because the `login` call's own outcome and the `http:request:*` channels already report it.
   */
  authRelogin: diagnosticsChannel.channel<AccessAuthReloginPayload>("unifi-access:auth:relogin"),

  /** The connection state machine moved. Published by the `AccessClient` from the one bridge it subscribes to the connection monitor's own rail, so every edge the
   * monitor reports reaches a consumer here with the controller it belongs to stamped on. The monitor itself publishes nothing: it is built to be host-agnostic,
   * and the client is the layer that knows which controller it addresses. The reconnecting announcement goes through this channel too rather than having one of its
   * own, because it is one of the edges rather than a separate kind of event.
   */
  connectionTransition: diagnosticsChannel.channel<AccessConnectionTransitionPayload>("unifi-access:connection:transition"),

  /** The realtime notification WebSocket closed. Published by the `EventStream` from its single teardown path, so it fires exactly once per stream and for every
   * cause alike - a peer close, a socket error, a watchdog stall, or a deliberate `close()`. The payload mirrors the close frame, which is what tells a consumer
   * whether the controller ended the connection cleanly or it dropped.
   */
  eventsClosed: diagnosticsChannel.channel<AccessEventsClosedPayload>("unifi-access:events:closed"),

  /** A notification packet was classified. Published by the `EventStream` once per frame that the classifier lifted into a typed event, immediately before that
   * event reaches the packet rail. Frames the classifier declines publish nothing here, so the channel measures modeled activity rather than raw wire volume; a
   * consumer wanting every frame subscribes to the stream's own raw rail instead.
   */
  eventsPacket: diagnosticsChannel.channel<AccessEventsPacketPayload>("unifi-access:events:packet"),

  /** An HTTP request completed. Published by the `Transport` on both outcomes - a response of any status, or a transport-level failure that produced none - so a
   * consumer can measure latency and failure rate from one channel. `requestId` correlates it with the matching start.
   */
  httpRequestEnd: diagnosticsChannel.channel<AccessHttpRequestEndPayload>("unifi-access:http:request:end"),

  /** An HTTP request was dispatched. Published by the `Transport` as it hands the request to the connection pool, after the throttle gate has allowed it through.
   * Pairs with the matching end through `requestId`.
   */
  httpRequestStart: diagnosticsChannel.channel<AccessHttpRequestStartPayload>("unifi-access:http:request:start"),

  /** The transport entered its throttle cooldown. Published by the `Transport` on the trip edge only, when consecutive failures cross the error limit, so it
   * reports the transition rather than each refused request. The payload carries the cooldown so a consumer can show how long the controller will be left alone.
   */
  httpThrottleEntered: diagnosticsChannel.channel<AccessHttpThrottleEnteredPayload>("unifi-access:http:throttle:entered"),

  /** The transport left its throttle cooldown. Published by the `Transport` on the closing edge only - the recovery probe that succeeded - so entered and exited
   * pair one-to-one and a consumer never sees the signal flap while a failing probe re-arms the cooldown underneath it.
   */
  httpThrottleExited: diagnosticsChannel.channel<AccessHttpThrottleExitedPayload>("unifi-access:http:throttle:exited"),

  /** An event was committed to the state store. Published by the `AccessClient` from the store's dispatch hook, once per event that actually advanced the state -
   * so this measures the flow of change rather than the volume of traffic, and an event the reducer absorbed reaches it not at all.
   *
   * The payload carries the event's kind and not its payload. Dispatch is the hottest path in the library, and a channel that copied each event's data would make
   * observing it cost more than the work being observed; a consumer that wants the data itself has the client's own realtime firehose, which carries every event
   * whole. The trade is deliberate: this channel answers "what is flowing, and how fast", not "what exactly changed".
   */
  storeDispatch: diagnosticsChannel.channel<AccessStoreDispatchPayload>("unifi-access:store:dispatch")
} as const;

/**
 * Payload published on {@link channels.authRelogin}. The two arms encode which recoveries are possible. With credentials retained, the relogin ran against the
 * controller and `success` reports whether it re-established the session. With none - the state an explicit logout leaves behind - there was nothing to attempt, so
 * `host` is null and the attempt cannot have succeeded. Splitting the arms rather than making `host` nullable on one shape means the combination that would claim a
 * recovery nobody attempted cannot be constructed at all.
 *
 * @category Diagnostics
 */
export type AccessAuthReloginPayload = { host: string; success: boolean } | { host: null; success: false };

/**
 * Payload published on the `unifi-access:connection:transition` channel. Composed from the monitor's own transition type plus the controller this client
 * addresses, so a change to what a connection state can be cannot drift this payload away from it - the same reason the request payloads compose from their shared
 * fields rather than restating them.
 *
 * @category Diagnostics
 */
export type AccessConnectionTransitionPayload = ConnectionTransition & { host: string };

/**
 * Payload published on the `unifi-access:store:dispatch` channel. `kind` is the event's own tag, taken from the typed union the reducer folds, so the vocabulary
 * here is the reducer's rather than a second list that could fall behind it.
 *
 * That vocabulary includes the synthetic kinds, which are the ones a subscriber watching for state flow should expect to see without a packet having arrived:
 * `bootstrapLoaded` and `controllerChanged` for the documents a fetch supplies, and `doorStateFactsApplied` for the door facts an official read supplies. They are
 * dispatched by the composition root rather than lifted from the wire, and they are reported here exactly as a wire-borne event is.
 *
 * @category Diagnostics
 */
export interface AccessStoreDispatchPayload {

  host: string;
  kind: AccessTypedEvent["kind"];
}

/**
 * Payload published on {@link channels.eventsClosed}. `code` and `reason` mirror the WebSocket close frame.
 *
 * @category Diagnostics
 */
export interface AccessEventsClosedPayload {

  code: number;
  host: string;
  reason: string;
}

/**
 * The event kinds that carry an entity identifier, derived from the wire-event union itself rather than restated, so this vocabulary cannot drift from the
 * classifier that produces it. Deriving from {@link AccessWireEvent} also excludes the synthetic bootstrap member by construction, because that member is never
 * carried by the notification stream.
 *
 * @category Diagnostics
 */
export type AccessEventsPacketIdKind = Extract<AccessWireEvent, { id: string }>["kind"];

/**
 * The event kinds that carry no entity identifier, derived as the exact complement of {@link AccessEventsPacketIdKind} so the two vocabularies partition the wire
 * union between them and neither can drift from the classifier that produces it.
 *
 * @category Diagnostics
 */
export type AccessEventsPacketNoIdKind = Exclude<AccessWireEvent, { id: string }>["kind"];

/**
 * Payload published on {@link channels.eventsPacket}. `eventName` is the notification name exactly as the controller sent it, which is what a consumer needs to
 * tell the controller's two notification dialects apart after the classifier has normalized them into one kind.
 *
 * The shape splits on whether the event identifies an entity. Most kinds name the device or location they concern; the rest identify something that is not a single
 * modeled record - a ring cancellation names the call it ends, a door-state report names each of the doors it carries - so they carry no entity identifier and the
 * type does not invent one for them.
 *
 * @category Diagnostics
 */
export type AccessEventsPacketPayload = { eventName: string; host: string } &
  ({ id: string; kind: AccessEventsPacketIdKind } | { kind: AccessEventsPacketNoIdKind });

/**
 * The fields every request payload carries, named once here so the start payload and the end payload cannot drift apart on the identity of the request they
 * describe. `requestId` is what correlates the two.
 *
 * @category Diagnostics
 */
export interface AccessHttpRequestCommon {

  method: string;
  requestId: string;
  url: string;
}

/**
 * How a request finished, as the two outcomes a dispatch can actually have. A response arrived and carries its status, or the request failed at the transport level
 * and carries the classified error's message with no status at all, because none was ever received. As a union rather than a pair of optional fields, reading a
 * status code requires narrowing to the arm that has one, so a consumer cannot read a status from a failure that never had one.
 *
 * @category Diagnostics
 */
export type AccessHttpRequestEndOutcome = { error: string; outcome: "failure" } | { outcome: "response"; statusCode: number };

/**
 * Payload published on {@link channels.httpRequestEnd}. Composed from the shared request fields, the measured duration and host, and the outcome union, so each
 * piece is defined once. `durationMs` spans dispatch to settle and is measured on the transport's own injected clock.
 *
 * @category Diagnostics
 */
export type AccessHttpRequestEndPayload = AccessHttpRequestCommon & { durationMs: number; host: string } & AccessHttpRequestEndOutcome;

/**
 * Payload published on {@link channels.httpRequestStart}. The shared request fields plus the controller this client addresses.
 *
 * @category Diagnostics
 */
export type AccessHttpRequestStartPayload = AccessHttpRequestCommon & { host: string };

/**
 * Payload published on {@link channels.httpThrottleEntered}. `consecutiveFailures` is the count that crossed the limit and `cooldownMs` is how long the transport
 * will refuse requests before it allows a recovery probe through.
 *
 * @category Diagnostics
 */
export interface AccessHttpThrottleEnteredPayload {

  consecutiveFailures: number;
  cooldownMs: number;
  host: string;
}

/**
 * Payload published on {@link channels.httpThrottleExited}. The recovery carries no detail of its own beyond which controller recovered - the cooldown that just
 * ended was already reported on the entered channel.
 *
 * @category Diagnostics
 */
export interface AccessHttpThrottleExitedPayload {

  host: string;
}

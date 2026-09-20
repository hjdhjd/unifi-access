/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * events-stream.ts: The realtime notification WebSocket - decode, classify, and fan one typed event out through a three-rail EventBus, with a silence watchdog.
 */

/**
 * {@link EventStream} owns the controller's realtime notification WebSocket and is the single decode site for that stream: every frame is normalized to text,
 * parsed, checked against the notification envelope, and classified ({@link classifyPacket}) here, and the one resulting {@link AccessWireEvent} is emitted on the
 * `packet` rail. The composition root wires exactly one bridge subscription that fans that event into both the state store and the client firehose - there is never
 * a second decode path.
 *
 * The surface is the three-rail model (see {@link EventBus}): an internal `EventBus<EventStreamEvents>` backs `on` / `once` / `stream`. The library composes
 * `node:events.EventEmitter`; it does not extend it.
 *
 * **The WebSocket is an injected dependency**, exactly like the {@link Transport}'s dispatcher and the state store's refresh callback. `EventStream` depends on the
 * minimal {@link AccessWebSocket} interface - only the surface it uses - never undici's full type. The default factory builds undici's `WebSocket` over an owned
 * HTTP/1.1 agent that accepts the controller's self-signed certificate, because a WebSocket upgrade cannot go through the HTTP/2 request pool. Tests inject a fake
 * socket and drive `open` / `message` / `close` / `error` deterministically, which is the only way to exercise this at all: undici's `MockAgent` does not mock
 * WebSockets.
 *
 * **The watchdog detects here; the coordinator responds.** This is the same division as the throttle breaker: the subsystem that owns a resource detects its health
 * condition and emits a typed signal, and the one coordinator responds. `EventStream` stamps `lastMessageAt` on every frame and runs a silence watchdog on the
 * injected `Clock`; a wake that finds the channel silent past {@link ACCESS_EVENTS_HEARTBEAT_TIMEOUT} concludes it is dead-but-not-closed and tears the socket
 * down, reporting the {@link AccessStallError} on the `error` rail when the stream had opened and on the {@link EventStream.opened} handshake rejection when it
 * had not - always a `RecoverableError`, so the error type itself is the signal to recover. `EventStream` does not reconnect; the layer that owns connection
 * policy does, and the periodic bootstrap refresh covers the gap in the meantime.
 *
 * @module AccessEventStream
 */
import { ACCESS_API_PATH_PREFIX, ACCESS_EVENTS_HEARTBEAT_TIMEOUT } from "../settings.ts";
import { AccessAbortedError, AccessCertificateError, AccessNetworkError, AccessProtocolError, AccessStallError, assertNever,
  isCertificateVerificationFailure, isExpectedWsDisconnect } from "../errors.ts";
import type { AccessError, AccessIdentityLeg } from "../errors.ts";
import type { AccessEventPacket, Nullable } from "../types/index.ts";
import type { AccessEventsClosedPayload, AccessEventsPacketPayload } from "../diagnostics.ts";
import type { AccessWebSocket, AccessWebSocketCloseEvent, AccessWebSocketErrorEvent, AccessWebSocketMessageEvent } from "./ws.ts";
import { Agent, WebSocket } from "undici";
import { classifyPacket, isAccessEventPacket } from "../protocol/events.ts";
import type { AccessLogging } from "../logging.ts";
import type { AccessWireEvent } from "../protocol/events.ts";
import type { Clock } from "../clock.ts";
import { EventBus } from "../event-bus.ts";
import type { OwnedConnector } from "./connector.ts";
import type { StreamOptions } from "../event-bus.ts";
import { channels } from "../diagnostics.ts";
import { createOwnedConnector } from "./connector.ts";
import { noopLog } from "../logging.ts";
import { toText } from "./ws.ts";
import { wallClock } from "../clock.ts";

/**
 * The controller's heartbeat frame, verbatim: the JSON encoding of the string `Hello` followed by a newline. The controller sends it on roughly a five-second
 * cadence to prove the channel is alive, and it is the one frame that is consumed rather than delivered - it is not a notification, and parsing it would yield the
 * string `Hello` rather than a packet.
 *
 * Exported so that a test asserts the guard against this exact literal rather than restating it, which would let the two drift apart and quietly turn the heartbeat
 * into a stream of protocol errors.
 *
 * @category Transport
 */
export const HEARTBEAT_FRAME = "\"Hello\"\n";

/**
 * Construction options for {@link EventStream}.
 *
 * - `host` is the controller address. It is this stream's identity in its logs and on its diagnostics channels, and the notification URL is derived from it unless
 *   `endpoint` supplies one. It is required in either case, because an endpoint override addresses the same controller on a different port - the stream still has
 *   one controller to name.
 * - `endpoint` is a complete `wss://` URL that replaces the derived one. It pairs with `getAuthHeaders`: a stream against the controller's official notification
 *   socket supplies both, the endpoint naming that socket and the headers stamping the bearer token it authenticates with, and the composition root is the one
 *   caller that supplies either.
 * - `identity` names which identity the upgrade authenticates with, and therefore which listener this stream dials: `"credentials"` the UniFi console,
 *   `"token"` the Access developer API on its own port. It defaults to `"credentials"` exactly as the {@link Transport}'s does, and it is what a certificate the
 *   listener presents that does not verify is reported through - the failure names the listener rather than the address alone.
 * - `getAuthHeaders` supplies the headers the upgrade request carries, wired to a session at the composition root - the same dependency inversion the
 *   {@link Transport} uses, and the same closure shape, so one session type serves the request path and the socket alike. Omitting it stamps an empty session
 *   cookie, which is what an upgrade with no credentials in hand carries.
 * - `webSocket` is the injected I/O boundary; omit it to use the default undici-backed factory, inject it in tests. It receives the headers alongside the URL, so a
 *   test observes exactly what the real socket would send.
 * - `signal` cancels the connection attempt - if it aborts before the socket opens, {@link EventStream.opened} rejects and the stream tears down.
 * - `verifyTls` opts the upgrade into strict TLS certificate verification. It defaults to `false`, because a controller presents a self-signed certificate that no
 *   verification chain accepts; a deployment that has installed a trusted certificate on its controller turns it on. It applies to the socket this stream builds
 *   for itself, an injected `webSocket` factory owning the TLS settings of whatever it builds.
 *
 * @category Transport
 */
export interface EventStreamOptions {

  clock?: Clock;
  endpoint?: string;
  getAuthHeaders?: () => Record<string, string>;
  host: string;
  identity?: AccessIdentityLeg;
  log?: AccessLogging;
  signal?: AbortSignal;
  verifyTls?: boolean;
  webSocket?: (url: string, headers: Record<string, string>) => AccessWebSocket;
}

/**
 * The events {@link EventStream} publishes on its three-rail surface.
 *
 * - `packet` is the realtime firehose: one classified {@link AccessWireEvent} per modeled frame. The composition root bridges it into the state store and the
 *   client firehose.
 * - `rawPacket` is the raw observability firehose: the parsed {@link AccessEventPacket} of *every* well-formed frame, emitted one step before `packet` and before
 *   classification - so it carries both the notifications the library does not model and the payload fields the classifier's translation allowlist drops, neither
 *   of which `packet` ever sees. Pure observability for protocol exploration and capture; never dispatched into state.
 * - `closed` fires once when the WebSocket closes (naturally, on error, or on a watchdog stall), carrying the close frame's code and reason.
 * - `error` carries a typed {@link AccessError} - a frame that could not be parsed or was not a notification, a socket error, an {@link AccessStallError} from the
 *   silence watchdog, or an {@link AccessNetworkError} when the peer closes a live socket unsolicited (a controller reboot drops the socket exactly this way: a
 *   `close` event with no preceding socket `error`). It carries the faults of a stream that opened and nothing else: a close this stream ran for itself stays
 *   informational on `closed`, and a failure that ends a stream before it opened reports through the {@link EventStream.opened} handshake rejection alone - a
 *   caller-signal abort as {@link AccessAbortedError}, a socket error or a stall as the fault itself, a peer close as a generic {@link AccessNetworkError}. The
 *   error *type* is what the coordinator acts on.
 *
 * @category Transport
 */
export interface EventStreamEvents {

  closed: [info: { code: number; reason: string }];
  error: [err: AccessError];
  packet: [event: AccessWireEvent];
  rawPacket: [packet: AccessEventPacket];
}

/* The socket listeners this stream registered, held on the instance so the teardown can take them off by the identity of what it registered. The platform's
 * `signal` registration option is deliberately not what detaches them: it removes a listener through a callback the runtime holds weakly, so a garbage
 * collection landing before the abort leaves the listener attached, and a teardown that must detach before it asks the socket to close cannot rest on that. A
 * reference the object owns cannot be collected out from under it, which makes the detach a property of the stream rather than of the collector.
 */
interface SocketListeners {

  readonly close: (event: AccessWebSocketCloseEvent) => void;
  readonly error: (event: AccessWebSocketErrorEvent) => void;
  readonly message: (event: AccessWebSocketMessageEvent) => void;
  readonly open: () => void;
}

/* The stream's lifecycle as one value, so a combination the lifecycle does not allow cannot be written at all: the release of the connection this stream owns is a
 * member of the closed phase, so a closed stream with nothing to await cannot be expressed.
 */
type StreamPhase = { readonly kind: "closed"; readonly released: Promise<void> } | { readonly kind: "connecting" } | { readonly kind: "open" };

/* Why a teardown is running, carried to it as an argument rather than kept in a field: every caller already knows which it is, and nothing reads it once the
 * teardown has returned. The socket's own close listener names the peer; an explicit close() names itself; the caller-abort path names the caller's signal,
 * which is what settles a still-pending handshake as the typed abort rather than a network failure; and a socket error and the watchdog each name a fault,
 * carrying the typed error the teardown reports - on the rail when the stream had opened, and on the handshake rejection when it had not.
 */
type TeardownCause = { readonly kind: "callerSignal" } | { readonly kind: "close" } | { readonly error: AccessError; readonly kind: "fault" } |
  { readonly kind: "peer" };

/* The close frame in the words an error message carries it in: always the code, and what the peer said when the frame said anything at all. The frame travels in
 * the message rather than on the cause chain because the chain renderer skips a cause that is not an Error, so a reason hung off one is invisible in every
 * rendered failure a consumer logs...and the frame is the whole account a controller that went away leaves behind.
 */
function closeFrameText(code: number, reason: string): string {

  const frame = "close code " + code.toString();

  if(reason.length === 0) {

    return frame;
  }

  return frame + ": " + reason;
}

/**
 * The realtime notification stream. Constructed directly (the constructor begins connecting and wires the WebSocket listeners) so the composition root can attach
 * its bridge subscription *before* awaiting {@link EventStream.opened} - a socket delivers no `message` before `open`, so a pre-`open` subscription loses nothing
 * and no buffering is required. {@link EventStream.connect} is atomic sugar (construct, await open, return) for direct consumers that subscribe via
 * {@link EventStream.packets}.
 *
 * @category Transport
 */
export class EventStream implements AsyncDisposable {

  /* The address this stream dials, which is what a certificate failure reports the peer as. It is read from the URL rather than from `host`, because an endpoint
   * override names its own port and the address a user is told about has to be the one that was actually dialed.
   */
  readonly #address: string;
  readonly #bus = new EventBus<EventStreamEvents>();
  readonly #clock: Clock;
  // One AbortController governs the watchdog loop and the binding to the caller's signal, so a single abort() ends them together. The socket's own listeners are
  // not among what it governs: the stream holds them and takes them off itself.
  readonly #controller = new AbortController();
  readonly #host: string;
  // Which identity the upgrade authenticates with, and so which of the controller's two listeners this stream reaches - the one fact that names the listener a
  // certificate came from.
  readonly #identity: AccessIdentityLeg;
  readonly #log: AccessLogging;
  /* What we own when we built the default WebSocket ourselves, and null when a factory was injected - its owner manages the transport underneath it, and we never
   * destroy what we did not create, exactly as Transport treats its dispatcher. The agent and the connector travel as one value so the two cannot disagree about
   * whether there is anything to release.
   *
   * The connector is where every socket is seen from the moment it is vended, which is what puts the whole connection within reach: destroying the agent releases
   * only what the agent still holds, a completed upgrade hands its socket to the WebSocket machinery - from that moment the connection is ours to sever or
   * nobody's - and a socket still in its handshake belongs to nothing else at all.
   */
  readonly #owned: { readonly agent: Agent; readonly connector: OwnedConnector } | null;
  readonly #socketListeners: SocketListeners;
  readonly #ws: AccessWebSocket;

  /* The open handshake, settled exactly once: resolved on the WebSocket `open` event, rejected if the socket closes (or the caller's signal aborts) before
   * opening. Every transition that settles it is reached from the connecting phase alone, which is what makes settling exactly once a property of the lifecycle
   * rather than a check of its own.
   */
  readonly #opened: Promise<void>;
  readonly #rejectOpen: (reason: AccessError) => void;
  readonly #resolveOpen: (value: undefined) => void;

  // The watchdog's only liveness source - clock-stamped on every frame, seeded to construction time so a fresh stream is not instantly considered stale.
  #lastMessageAt: number;
  /* Where the stream is in its lifecycle. It starts connecting, moves to open when the WebSocket reports its `open` event, and moves to closed when the single
   * teardown runs - from a peer close, a socket error, a watchdog stall, the caller's signal, or an explicit close(). It is initialized here rather than in the
   * constructor body because an already-aborted caller signal runs the whole teardown from inside the constructor, which reads this phase before the body has
   * finished. A stream object is one-shot: the layer that owns connection policy builds a fresh one per attempt rather than reopening this one, and every
   * transition reads the phase it is leaving, so no phase is ever left backwards whatever the socket does afterwards.
   */
  #phase: StreamPhase = { kind: "connecting" };

  constructor(options: EventStreamOptions) {

    this.#clock = options.clock ?? wallClock;
    this.#host = options.host;
    this.#identity = options.identity ?? "credentials";
    this.#log = options.log ?? noopLog;
    this.#lastMessageAt = this.#clock.now();

    // The notification endpoint takes no parameters. The controller has no replay mechanism to ask for, so there is nothing to carry in a query string. An endpoint
    // override names a whole URL rather than adjusting this one, because the socket it addresses differs in port and path alike.
    const url = options.endpoint ?? ("wss://" + options.host + ACCESS_API_PATH_PREFIX + "/ws/notification");

    // Read from the URL the socket opens, so the address reported and the address dialed are one value. `#host` stays the stream's identity in its logs and on
    // its diagnostics channels; this carries the port as well whenever the endpoint names one.
    this.#address = new URL(url).host;

    /* The headers the upgrade carries, built once here and handed to whichever branch below builds the socket - so a test that injects a factory receives exactly
     * what undici would have been given. Without a session wired in, the upgrade carries an empty session cookie: the header is what the Access application's
     * socket expects to see, and a request that omitted it entirely would differ on the wire from one that has no credentials to put in it.
     */
    const headers = options.getAuthHeaders?.() ?? { Cookie: "" };

    /* Build the socket: an injected factory in tests, otherwise undici's WebSocket over an owned HTTP/1.1 agent. The connection's settings are each required by
     * what a WebSocket upgrade is: HTTP/2 is off and pipelining disabled because an upgrade can use neither, keepalive is on so TLS sessions are reused across
     * reconnections and a dead connection is detected by TCP keepalive probes, and certificate verification follows `verifyTls`, which is off unless the caller
     * asks for it because controllers ship self-signed certificates. undici's WebSocket structurally satisfies the minimal surface we model, so it assigns
     * directly - no cast.
     */
    if(options.webSocket !== undefined) {

      this.#owned = null;
      this.#ws = options.webSocket(url, headers);
    } else {

      // `allowH2` reaches the connector and the agent alike, because the two read it for different things: the connector's copy decides the ALPN offer, and the
      // agent's decides how it handles the connection once the connect has completed. One binding is what keeps the two from disagreeing.
      const allowH2 = false;
      const connector = createOwnedConnector({ allowH2, verifyTls: options.verifyTls ?? false });
      const agent = new Agent({ allowH2, connect: connector.connect, pipelining: 0 });

      this.#owned = { agent, connector };
      this.#ws = new WebSocket(url, { dispatcher: agent, headers });
    }

    // Binary framing is requested so that a frame arriving as bytes rather than text is still readable. The protocol itself is text; this covers the other case.
    this.#ws.binaryType = "arraybuffer";

    const { promise, resolve, reject } = Promise.withResolvers<undefined>();

    this.#opened = promise;
    this.#rejectOpen = reject;
    this.#resolveOpen = resolve;

    // Attaching a no-op rejection handler marks the handshake promise as handled, so a consumer that only subscribes via `on("packet")` and never awaits `opened`
    // does not trigger an unhandled-rejection warning when the socket fails to open. Real awaiters still receive the rejection - both handlers run.
    void this.#opened.catch(() => undefined);

    /* The socket's handlers are built once and kept, because the teardown detaches them by handing each one back. The close and error handlers are `once` - a
     * socket reports each terminal condition a single time - while message stays live for the connection's lifetime.
     */
    this.#socketListeners = {

      close: (event): void => this.#onClose({ kind: "peer" }, event.code, event.reason),
      error: (event): void => this.#onError(event),
      message: (event): void => this.#onMessage(event.data),
      open: (): void => this.#onOpen()
    };

    const signal = this.#controller.signal;

    this.#ws.addEventListener("open", this.#socketListeners.open, { once: true });
    this.#ws.addEventListener("message", this.#socketListeners.message);
    this.#ws.addEventListener("close", this.#socketListeners.close, { once: true });
    this.#ws.addEventListener("error", this.#socketListeners.error, { once: true });

    // The caller's signal cancels the connection attempt. Bound to our own signal too, so it detaches with everything else once we tear down.
    if(options.signal !== undefined) {

      if(options.signal.aborted) {

        this.#abortByCaller();
      } else {

        options.signal.addEventListener("abort", () => this.#abortByCaller(), { once: true, signal });
      }
    }

    // The silence watchdog runs detached for the stream's lifetime; the controller's abort ends it.
    void this.#runWatchdog();
  }

  /**
   * Open a notification stream and wait for it to connect. Atomic sugar over the constructor for direct consumers: it returns a live stream or throws. Consumers
   * that must not miss a frame should instead construct the stream, attach their `packet` subscription, and then `await stream.opened` - a pre-`open` subscription
   * is race-free because a socket delivers no message before it opens.
   *
   * @param options - The stream options.
   *
   * @returns A connected {@link EventStream}.
   *
   * @throws The failure that ended the connect: the fault the stream detected before it opened (a socket error's {@link AccessNetworkError} or the watchdog's
   *   {@link AccessStallError}), a generic {@link AccessNetworkError} when the peer closes before opening, or {@link AccessAbortedError} when the caller's signal
   *   aborts the connect.
   */
  static async connect(options: EventStreamOptions): Promise<EventStream> {

    const stream = new EventStream(options);

    await stream.opened;

    return stream;
  }

  /**
   * The open handshake. Resolves when the WebSocket opens, and rejects with whatever ended the connect: the fault the stream detected before it opened (a socket
   * error's {@link AccessNetworkError} or the watchdog's {@link AccessStallError}), a generic {@link AccessNetworkError} when the peer closes before opening, or
   * an {@link AccessAbortedError} when the caller's signal aborts first. The composition root awaits this *after* attaching its bridge subscription, so no frame
   * is lost between open and subscription.
   */
  get opened(): Promise<void> {

    return this.#opened;
  }

  /**
   * The `clock.now()` timestamp of the most recent frame received (seeded to construction time). The watchdog's only liveness source; also readable for
   * diagnostics.
   */
  get lastMessageAt(): number {

    return this.#lastMessageAt;
  }

  /**
   * Subscribe to a stream event. Returns a `Disposable`; prefer `using sub = stream.on(...)` so the listener detaches at scope exit.
   *
   * @param event   - The event to listen for.
   * @param handler - Invoked on each emission.
   *
   * @returns A `Disposable` that removes the listener when disposed.
   */
  on<K extends keyof EventStreamEvents>(event: K, handler: (...args: EventStreamEvents[K]) => void): Disposable {

    return this.#bus.on(event, handler);
  }

  /**
   * Wait for the next emission of a stream event.
   *
   * @param event - The event to await.
   * @param opts  - Optional abort signal.
   *
   * @returns A promise resolving to the event's argument tuple.
   */
  async once<K extends keyof EventStreamEvents>(event: K, opts: { signal?: AbortSignal } = {}): Promise<EventStreamEvents[K]> {

    return this.#bus.once(event, opts);
  }

  /**
   * Stream every subsequent emission of a stream event until the signal aborts.
   *
   * @param event - The event to stream.
   * @param opts  - Stream options, including the abort signal.
   *
   * @returns An async iterable of the event's argument tuples.
   */
  stream<K extends keyof EventStreamEvents>(event: K, opts: StreamOptions = {}): AsyncIterable<EventStreamEvents[K]> {

    return this.#bus.stream(event, opts);
  }

  /**
   * The realtime notification firehose: every classified {@link AccessWireEvent}, until the signal aborts. Sugar over `stream("packet")` that unwraps the
   * single-element argument tuple to the event itself.
   *
   * @param opts - Optional abort signal that terminates the iteration.
   *
   * @returns An async iterable of typed events.
   */
  async *packets(opts: { signal?: AbortSignal } = {}): AsyncGenerator<AccessWireEvent> {

    // The underlying `stream` rail rejects with the abort reason when its signal fires (node:events' `on` contract). For the firehose sugar we smooth that into a
    // clean return on the caller's own abort - a `for await` over the firehose ends quietly on Ctrl-C rather than forcing every consumer to wrap it in try/catch.
    // Any other error still propagates.
    try {

      for await (const [event] of this.#bus.stream("packet", opts)) {

        yield event;
      }
    } catch(error) {

      if(opts.signal?.aborted === true) {

        return;
      }

      throw error;
    }
  }

  /**
   * Close the stream: request the WebSocket close, detach every listener, end the watchdog, and release the connection we own. Safe to call more than once, and
   * awaitable. The connection we own is released before the `closed` event is delivered, so a listener never observes a closed stream still holding its socket.
   */
  async close(): Promise<void> {

    this.#shutdown({ kind: "close" }, 1000, "the notification stream was closed by the client");

    // Every path out of #shutdown leaves the phase closed, so this test of the tag is for the compiler rather than for the lifecycle.
    if(this.#phase.kind === "closed") {

      await this.#phase.released;
    }
  }

  /**
   * Dispose the stream. Delegates to {@link EventStream.close} so `await using stream = ...` tears the socket down cleanly.
   */
  async [Symbol.asyncDispose](): Promise<void> {

    await this.close();
  }

  /* The WebSocket opened. Acting from the connecting phase alone is the rule here: a consumer-supplied socket that ignores `signal`, against the contract
   * AccessWebSocket states, can deliver an `open` after the teardown has run, and a closed stream moved back to open would run the whole teardown a second time.
   */
  #onOpen(): void {

    if(this.#phase.kind !== "connecting") {

      return;
    }

    this.#phase = { kind: "open" };
    this.#log.debug("Connected to the UniFi Access realtime notification API.");
    this.#resolveOpen(undefined);
  }

  /* A frame arrived. Liveness is stamped first, from any frame at all: anything the controller sends proves the channel is carrying traffic, whether or not we can
   * make a notification of it. The guards below then run in an order the protocol dictates rather than an arbitrary one - the heartbeat is checked before parsing
   * because it is valid JSON and would otherwise decode to the string `Hello`, and the empty frame is checked before parsing because parsing it would raise a
   * protocol error for something the controller legitimately sends. A frame that fails to parse, or parses to something that is not a notification, surfaces on the
   * error rail but does not tear the channel down: WebSocket frames are independently delimited, so one bad frame does not desync the next.
   */
  #onMessage(data: unknown): void {

    this.#lastMessageAt = this.#clock.now();

    const text = toText(data);

    if(text === null) {

      this.#log.debug("Skipping a realtime notification frame that could not be read as text.", { type: typeof data });

      return;
    }

    // The heartbeat is consumed here and goes no further. It proves liveness, which it has already done above, and it is not a notification, so it reaches neither
    // a rail nor a consumer.
    if(text === HEARTBEAT_FRAME) {

      return;
    }

    // An empty frame carries nothing and is absorbed in silence, which is what the controller's sending one means.
    if(text === "") {

      return;
    }

    let parsed: unknown;

    try {

      parsed = JSON.parse(text) as unknown;
    } catch(error) {

      this.#bus.emit("error", new AccessProtocolError("A realtime notification frame could not be parsed as JSON.", { cause: error }));

      return;
    }

    /* Check the envelope before anything downstream sees the value. `JSON.parse` returns whatever the frame contained, and asserting that into the packet type
     * would let a well-formed but unrelated document through - a frame carrying no identifier would then be published under one that is undefined while typed as a
     * string. Checking is what keeps the typed rails honest about what they carry.
     */
    if(!isAccessEventPacket(parsed)) {

      this.#bus.emit("error", new AccessProtocolError("A realtime notification frame did not carry the fields a notification packet is defined by."));

      return;
    }

    // The raw rail fires here, one step before classification, so it carries every well-formed frame - including the notifications the classifier does not model
    // and the payload fields its translation drops. This is a second fan-out of the single decode, not a second decode, and it is never dispatched into state.
    this.#bus.emit("rawPacket", parsed);

    const event = classifyPacket(parsed);

    // A notification the library does not model is the ordinary case rather than a fault - the controller emits far more names than the library lifts - so it
    // stays at debug and reaches consumers on the raw rail alone.
    if(event === null) {

      this.#log.debug("Received a realtime notification the library does not model.", { event: parsed.event });

      return;
    }

    if(channels.eventsPacket.hasSubscribers) {

      channels.eventsPacket.publish(this.#packetPayload(event));
    }

    this.#bus.emit("packet", event);
  }

  /* The socket reported an error. The cause is taken from the connector ahead of the event, because a WebSocket upgrade that fails reports a content-free
   * `TypeError` on this event while the connector that vended the socket still holds the dial's own error - so reading the event alone would throw away every
   * errno the platform gave, the certificate verdict among them. An injected socket has no connector of ours, and there its event error is the whole account.
   *
   * The error-level line belongs to a stream that had opened. A failure before the open reaches its caller through the handshake rejection, and the coordinator
   * reports it from there, so a line here as well would put one failure in the log twice.
   *
   * Either way the typed failure is carried into the teardown as the cause of it: the teardown decides where it is reported, on the rail when the stream had
   * opened and on the handshake rejection when it had not, and it has run to completion before any listener hears of it...so a listener that refuses the fault
   * cannot cancel a close that has already finished.
   */
  #onError(event: AccessWebSocketErrorEvent): void {

    const cause = this.#owned?.connector.lastDialFailure ?? event.error;

    if((this.#phase.kind === "open") && !isExpectedWsDisconnect(cause)) {

      this.#log.error("The UniFi Access realtime notification API reported an error.", cause ?? event.message);
    }

    const fault = isCertificateVerificationFailure(cause) ? new AccessCertificateError({ cause, host: this.#address, identity: this.#identity }) :
      new AccessNetworkError("The UniFi Access realtime notification API connection failed.", { cause });

    this.#shutdown({ error: fault, kind: "fault" }, 1006, "the notification stream connection errored");
  }

  // The single teardown. Guarded so it runs once whether triggered by the socket's close event, an error, the watchdog, or an explicit close. Detaches the socket's
  // listeners, ends the watchdog, releases the connection we own, settles a still-pending open handshake as a failure, and announces the close. The detach and the
  // abort stay here as well as in #shutdown because the peer's own close listener reaches this teardown without passing through it, and repeating either does
  // nothing.
  #onClose(cause: TeardownCause, code: number, reason: string): void {

    if(this.#phase.kind === "closed") {

      return;
    }

    // Which phase is being left decides what the rest of the teardown owes: a connecting stream has a handshake to settle, and an open one is the only stream a
    // peer can drop unsolicited.
    const wasOpen = this.#phase.kind === "open";

    /* The detach, the abort and the release share one synchronous block, ahead of every emit. Taking the socket's listeners off and ending the watchdog is what
     * stops the watchdog and the caller's signal from firing once the connection has been let go, and leaves the severed socket's own `error` and `close`
     * arriving on later ticks with nothing to hear them. The release is written inline in the closed phase because its severance runs synchronously to its first
     * await...from this assignment on, nothing a listener does, a throw included, can leave the connection held.
     */
    this.#detachSocketListeners();
    this.#controller.abort();
    this.#phase = { kind: "closed", released: this.#releaseOwnedConnection() };

    // Settle a still-pending open handshake as a failure - which is owed by the connecting phase alone, the only phase left here that has not settled it.
    if(!wasOpen) {

      this.#rejectOpen(this.#preOpenFailure(cause, code, reason));
    }

    /* The error rail carries what a stream that had opened did not ask for: a fault it detected, or the peer dropping a live socket without our asking, which is
     * how a controller reboot arrives (a `close` event with no preceding socket `error`). A close this stream ran for itself, and one the caller's signal asked
     * for, are a clean lifecycle end and stay informational on `closed`. The test of the phase is what keeps every failure that lands before the open - a peer
     * close, a socket error, and a stall alike - on the handshake rejection alone, which is the whole of what the coordinator needs to know about a stream that
     * never opened: nothing is acting on it yet except the caller waiting out the connect.
     */
    if(wasOpen) {

      const fault = this.#railFault(cause, code, reason);

      if(fault !== null) {

        this.#bus.emit("error", fault);
      }
    }

    this.#log.debug("The UniFi Access realtime notification API connection closed.", { code, reason });
    this.#bus.emit("closed", { code, reason });

    if(channels.eventsClosed.hasSubscribers) {

      channels.eventsClosed.publish({ code, host: this.#host, reason } satisfies AccessEventsClosedPayload);
    }
  }

  /* What a handshake that never completed rejects with. A fault is handed over as itself, so the rejection's type says exactly what went wrong and nothing the
   * wire reported is lost on the way to the caller; the caller's own signal gets the typed abort, a cancellation rather than a failure; and a close settles as
   * the generic pre-open failure, carrying the frame it arrived on when that frame came from the peer.
   */
  #preOpenFailure(cause: TeardownCause, code: number, reason: string): AccessError {

    switch(cause.kind) {

      case "callerSignal":

        return new AccessAbortedError("The UniFi Access realtime notification API connection was aborted by the caller's signal.");

      case "close":

        return new AccessNetworkError("The UniFi Access realtime notification API closed before it finished connecting.");

      case "fault":

        return cause.error;

      case "peer":

        return new AccessNetworkError("The UniFi Access realtime notification API closed before it finished connecting (" + closeFrameText(code, reason) + ").");

      default:

        // Exhaustiveness guard. A new cause joining the union without a case above stops `cause` being `never` here, and this fails to compile.
        return assertNever(cause);
    }
  }

  /* What an open stream's teardown announces on the error rail, or nothing at all when the teardown is one that was asked for. A fault goes out as itself, so a
   * consumer branches on the type the detector chose rather than on a wrapper's; and the peer's unsolicited close goes out as a network failure carrying the
   * frame it arrived on, which is what tells a controller that rebooted apart from one that simply stopped answering.
   */
  #railFault(cause: TeardownCause, code: number, reason: string): Nullable<AccessError> {

    switch(cause.kind) {

      case "callerSignal":
      case "close":

        return null;

      case "fault":

        return cause.error;

      case "peer":

        return new AccessNetworkError("The UniFi Access realtime notification API connection closed unexpectedly (" + closeFrameText(code, reason) + ").");

      default:

        // Exhaustiveness guard. A new cause joining the union without a case above stops `cause` being `never` here, and this fails to compile.
        return assertNever(cause);
    }
  }

  /* Take the socket's listeners off, each handed back by the identity it was registered under. Removing one that a `once` dispatch has already taken off is
   * quiet, so the teardown asks for every listener it registered whatever the socket has already reported.
   */
  #detachSocketListeners(): void {

    this.#ws.removeEventListener("close", this.#socketListeners.close);
    this.#ws.removeEventListener("error", this.#socketListeners.error);
    this.#ws.removeEventListener("message", this.#socketListeners.message);
    this.#ws.removeEventListener("open", this.#socketListeners.open);
  }

  /* Release the connection this stream owns, and nothing at all when a factory was injected.
   *
   * The severance happens first and synchronously, before anything is awaited, so that letting the connection go depends on nothing that can stall or reject - the
   * agent's own teardown then follows for its bookkeeping. That order is what the guarantee rests on: a peer under no obligation to answer a close frame can hold
   * a socket open indefinitely, and a socket the agent has handed to a completed upgrade is not among what the agent releases. A socket still in its handshake is
   * severed by the same call, carrying the error undici needs on the destroy to fail the dial rather than leave it pending, and nothing can dial again behind it:
   * undici's WebSocket establishes its connection exactly once (node_modules/undici/lib/web/websocket/websocket.js:179), and this call destroys the agent in the
   * same breath. Destroying an already-destroyed socket does nothing, so a set the close handlers have already drained costs a walk and no more.
   */
  async #releaseOwnedConnection(): Promise<void> {

    if(this.#owned === null) {

      return;
    }

    this.#owned.connector.release();

    await this.#owned.agent.destroy();
  }

  // The caller's own signal fired. The cause travels with the teardown, and naming the caller's signal is what settles a still-pending open handshake as the
  // typed AccessAbortedError rather than as a failure the stream detected.
  #abortByCaller(): void {

    this.#shutdown({ kind: "callerSignal" }, 1000, "connection aborted by the caller's signal");
  }

  // Request a graceful WebSocket close, then run teardown. Asking the socket to close is best-effort, because the peer is what decides whether the close frame is
  // ever answered - releasing the owned connection (in #onClose) is the guarantee, and it holds whether or not the handshake completes.
  #shutdown(cause: TeardownCause, code: number, reason: string): void {

    // A stream whose teardown has already run has nothing left to ask of its socket.
    if(this.#phase.kind === "closed") {

      return;
    }

    /* The socket's listeners come off before it is asked to close, and the stream takes them off itself rather than leaving that to the abort. Closing a socket
     * that is still connecting makes undici fail the connection and fire `error` and `close` synchronously, before close() returns, and a listener still
     * attached would carry that into the teardown as a fault or as a peer's close, reporting a failure for a close this stream itself asked for. It is also what
     * the peer cause's truth rests on: the socket's own `close` listener comes off here, ahead of ws.close(), so the only close that can still reach the
     * teardown naming the peer is one this stream did not ask for. The abort that follows ends the watchdog and the caller-signal binding.
     */
    this.#detachSocketListeners();
    this.#controller.abort();

    try {

      this.#ws.close();
    } catch {

      // A socket that never opened (or a fake that rejects a premature close) must not block teardown; #onClose below releases everything regardless.
    }

    this.#onClose(cause, code, reason);
  }

  // Build the events:packet diagnostic payload. The kinds that name the entity they concern carry its identifier; the ones that do not - a ring cancellation
  // identifies a call rather than a device, and a door-state report names several doors rather than one subject - carry none, so the payload is built per branch
  // rather than assembled from a shared partial that would have to pretend the identifier is optional.
  #packetPayload(event: AccessWireEvent): AccessEventsPacketPayload {

    switch(event.kind) {

      case "deviceChanged":
      case "deviceRemoved":
      case "doorbellRing":
      case "locationChanged":
      case "tamperAlert":
      case "unlock":

        return { eventName: event.eventName, host: this.#host, id: event.id, kind: event.kind };

      case "doorStateChanged":
      case "doorbellCancel":

        return { eventName: event.eventName, host: this.#host, kind: event.kind };

      default:

        // Exhaustiveness guard. If a new kind joins the wire-event union without a case above, `event` stops being `never` here and this fails to compile.
        return assertNever(event);
    }
  }

  /* The silence watchdog. Each wake checks how long the channel has been quiet; once it crosses the threshold the channel is presumed dead-but-not-closed, so a
   * typed stall travels into the teardown, which reports it on the rail when the stream had opened and on the handshake rejection when it had not. The loop ends
   * when teardown aborts the controller, which the delay reports as an abort - the normal shutdown path, swallowed here.
   *
   * The watchdog arms at construction rather than at open, so the same threshold also bounds a connect that never completes. That doubling is deliberate: a socket
   * that never opens and one that opens and goes quiet are the same condition from a consumer's point of view, and both want the same answer.
   *
   * Detection latency is bounded in [threshold, 2 * threshold) by the wake cadence - a ten-to-twenty-second window against the roughly five-second heartbeat
   * cadence, so several beats must be missed before it trips. That is the deliberate trade: polling on a fixed cadence rather than rescheduling a timer on every
   * frame received.
   */
  async #runWatchdog(): Promise<void> {

    try {

      for(;;) {

        // eslint-disable-next-line no-await-in-loop
        await this.#clock.delay(ACCESS_EVENTS_HEARTBEAT_TIMEOUT, { signal: this.#controller.signal });

        const silentForMs = this.#clock.now() - this.#lastMessageAt;

        if(silentForMs >= ACCESS_EVENTS_HEARTBEAT_TIMEOUT) {

          this.#log.error("The UniFi Access realtime notification API went silent beyond the watchdog window; tearing down the stalled connection.",
            { silentForMs });

          const stall = new AccessStallError("The UniFi Access realtime notification API produced no data within the watchdog window.", { silentForMs });

          this.#shutdown({ error: stall, kind: "fault" }, 1006, "the notification stream stalled past the watchdog window");

          return;
        }
      }
    } catch {

      /* The delay rejects on abort when the stream is torn down. That is the expected end of the loop, not an error. A consumer's own `error` listener throwing
       * as the stall fans out arrives here too, after the teardown has run to completion, so what is hidden is the listener's own exception - swallowed the way
       * the recovery loop that consumes this rail swallows a consumer's synchronous throw, and for the same reason: a detached loop has nobody to report to.
       */
    }
  }
}

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
 * injected `Clock`; a tick that finds the channel silent past {@link ACCESS_EVENTS_HEARTBEAT_TIMEOUT} concludes it is dead-but-not-closed, emits
 * `error({@link AccessStallError})` - a `RecoverableError`, so the error type itself is the signal to recover - and tears the socket down. `EventStream` does not
 * reconnect; the layer that owns connection policy does, and the periodic bootstrap refresh covers the gap in the meantime.
 *
 * @module AccessEventStream
 */
import { ACCESS_API_PATH_PREFIX, ACCESS_EVENTS_HEARTBEAT_TIMEOUT } from "../settings.ts";
import { AccessAbortedError, AccessNetworkError, AccessProtocolError, AccessStallError, assertNever, isExpectedWsDisconnect } from "../errors.ts";
import type { AccessEventsClosedPayload, AccessEventsPacketPayload } from "../diagnostics.ts";
import type { AccessWebSocket, AccessWebSocketErrorEvent } from "./ws.ts";
import { Agent, WebSocket, buildConnector } from "undici";
import { classifyPacket, isAccessEventPacket } from "../protocol/events.ts";
import type { AccessError } from "../errors.ts";
import type { AccessEventPacket } from "../types/index.ts";
import type { AccessLogging } from "../logging.ts";
import type { AccessWireEvent } from "../protocol/events.ts";
import type { Clock } from "../clock.ts";
import { EventBus } from "../event-bus.ts";
import type { Socket } from "node:net";
import type { StreamOptions } from "../event-bus.ts";
import { channels } from "../diagnostics.ts";
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
 *   `close` event with no preceding socket `error`). Every termination we did not initiate reaches this rail; a self-initiated close stays informational on
 *   `closed`, and a caller-signal abort before open surfaces on the {@link EventStream.opened} handshake rejection as {@link AccessAbortedError} rather than here.
 *   The error *type* is what the coordinator acts on.
 *
 * @category Transport
 */
export interface EventStreamEvents {

  closed: [info: { code: number; reason: string }];
  error: [err: AccessError];
  packet: [event: AccessWireEvent];
  rawPacket: [packet: AccessEventPacket];
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

  readonly #bus = new EventBus<EventStreamEvents>();
  readonly #clock: Clock;
  // One AbortController governs every WebSocket listener and the watchdog loop. A single abort() detaches them all at once.
  readonly #controller = new AbortController();
  readonly #host: string;
  readonly #log: AccessLogging;
  /* What we own when we built the default WebSocket ourselves, and null when a factory was injected - its owner manages the transport underneath it, and we never
   * destroy what we did not create, exactly as Transport treats its dispatcher. The agent and the socket set travel as one value so the two cannot disagree about
   * whether there is anything to release.
   *
   * The sockets are tracked because destroying the agent releases only what the agent still holds, and a completed upgrade hands its socket to the WebSocket
   * machinery: from that moment the connection is ours to sever or nobody's. Our connector is where we see each one vended.
   */
  readonly #owned: { readonly agent: Agent; readonly sockets: Set<Socket> } | null;
  readonly #ws: AccessWebSocket;

  // The open handshake, settled exactly once: resolved on the WebSocket `open` event, rejected if the socket closes (or the caller's signal aborts) before opening.
  readonly #opened: Promise<void>;
  readonly #settleOpen: (error?: AccessError) => void;

  // The single teardown gate and the agent-destruction promise close()/dispose await. lastMessageAt is the watchdog's only liveness source - clock-stamped on every
  // frame, seeded to construction time so a fresh stream is not instantly considered stale.
  #closePromise: Promise<void> | null = null;
  #closed = false;
  // Set by every self-initiated teardown (close(), caller abort, watchdog stall, socket error), so #onClose can tell a deliberate close from a peer-initiated one
  // and route only the latter onto the error rail.
  #closeInitiated = false;
  // Set ONLY by the caller-abort teardown path, a narrowing of the broader #closeInitiated, so #onClose settles a still-pending open handshake as the typed
  // AccessAbortedError for a caller abort while every other pre-open teardown (socket close, error, watchdog, explicit close()) keeps the generic network error.
  #callerAborted = false;
  #lastMessageAt: number;
  // True once the socket has opened. Gates the unsolicited-close error so a pre-open connect failure flows through the opened-handshake rejection alone.
  #live = false;
  #openSettled = false;

  constructor(options: EventStreamOptions) {

    this.#clock = options.clock ?? wallClock;
    this.#host = options.host;
    this.#log = options.log ?? noopLog;
    this.#lastMessageAt = this.#clock.now();

    // The notification endpoint takes no parameters. The controller has no replay mechanism to ask for, so there is nothing to carry in a query string. An endpoint
    // override names a whole URL rather than adjusting this one, because the socket it addresses differs in port and path alike.
    const url = options.endpoint ?? ("wss://" + options.host + ACCESS_API_PATH_PREFIX + "/ws/notification");

    /* The headers the upgrade carries, built once here and handed to whichever branch below builds the socket - so a test that injects a factory receives exactly
     * what undici would have been given. Without a session wired in, the upgrade carries an empty session cookie: the header is what the Access application's
     * socket expects to see, and a request that omitted it entirely would differ on the wire from one that has no credentials to put in it.
     */
    const headers = options.getAuthHeaders?.() ?? { Cookie: "" };

    /* Build the socket: an injected factory in tests, otherwise undici's WebSocket over an owned HTTP/1.1 agent. The agent's settings are each required by what a
     * WebSocket upgrade is: HTTP/2 is off and pipelining disabled because an upgrade can use neither, keepalive is on so TLS sessions are reused across reconnections
     * and a dead connection is detected by TCP keepalive probes, and certificate verification follows `verifyTls`, which is off unless the caller asks for it because
     * controllers ship self-signed certificates. undici's WebSocket structurally satisfies the minimal surface we model, so it assigns directly - no cast.
     */
    if(options.webSocket !== undefined) {

      this.#owned = null;
      this.#ws = options.webSocket(url, headers);
    } else {

      const sockets = new Set<Socket>();

      /* The connector undici would build for us from these same options, wrapped so that every socket it vends is one we can find again. `allowH2` has to be
       * stated here as well as on the agent because the two are reached by different routes: the agent forwards its own setting into the builder only when
       * `connect` is an options object, and the builder's own default is true - so a connector that stayed silent would quietly widen the ALPN offer.
       */
      const connect = buildConnector({ allowH2: false, keepAlive: true, rejectUnauthorized: options.verifyTls ?? false });
      const trackedConnect: typeof connect = (connectOptions, callback) => connect(connectOptions, (...vended) => {

        const [ error, socket ] = vended;

        // A connect that failed vends its error and nothing else - the socket argument is absent rather than null, so the success arm is what the tracking hangs
        // off. Reaching for a socket on the failure arm would fault inside undici's own error path, where nothing is left to catch it.
        if(error === null) {

          // A connect that lands after teardown has nobody left to release it, so it is severed on arrival rather than tracked. Everything else joins the set
          // until its own close takes it out again, which keeps the set the live picture of what we are still holding.
          if(this.#closed) {

            socket.destroy();
          } else {

            sockets.add(socket);
            socket.once("close", () => sockets.delete(socket));
          }
        }

        callback(...vended);
      });
      const agent = new Agent({ allowH2: false, connect: trackedConnect, pipelining: 0 });

      this.#owned = { agent, sockets };
      this.#ws = new WebSocket(url, { dispatcher: agent, headers });
    }

    // Binary framing is requested so that a frame arriving as bytes rather than text is still readable. The protocol itself is text; this covers the other case.
    this.#ws.binaryType = "arraybuffer";

    const { promise, resolve, reject } = Promise.withResolvers<undefined>();

    this.#opened = promise;

    // Attaching a no-op rejection handler marks the handshake promise as handled, so a consumer that only subscribes via `on("packet")` and never awaits `opened`
    // does not trigger an unhandled-rejection warning when the socket fails to open. Real awaiters still receive the rejection - both handlers run.
    void this.#opened.catch(() => undefined);

    this.#settleOpen = (error?: AccessError): void => {

      if(this.#openSettled) {

        return;
      }

      this.#openSettled = true;

      if(error !== undefined) {

        reject(error);

        return;
      }

      resolve(undefined);
    };

    // All listeners bind to the controller's signal, so one abort() detaches them together. The close and error handlers are `once` - a socket reports each
    // terminal condition a single time - while message stays live for the connection's lifetime.
    const signal = this.#controller.signal;

    this.#ws.addEventListener("open", () => this.#onOpen(), { once: true, signal });
    this.#ws.addEventListener("message", (event) => this.#onMessage(event.data), { signal });
    this.#ws.addEventListener("close", (event) => this.#onClose(event.code, event.reason), { once: true, signal });
    this.#ws.addEventListener("error", (event) => this.#onError(event), { once: true, signal });

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
   * @throws {@link AccessNetworkError} if the socket closes before it opens, or {@link AccessAbortedError} if the caller's signal aborts the connect.
   */
  static async connect(options: EventStreamOptions): Promise<EventStream> {

    const stream = new EventStream(options);

    await stream.opened;

    return stream;
  }

  /**
   * The open handshake. Resolves when the WebSocket opens; rejects with an {@link AccessNetworkError} if it closes before opening, or an
   * {@link AccessAbortedError} if the caller's signal aborts first. The composition root awaits this *after* attaching its bridge subscription, so no frame is lost
   * between open and subscription.
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
   * The realtime notification firehose: every classified {@link AccessWireEvent}, until the signal aborts or the stream closes. Sugar over `stream("packet")` that
   * unwraps the single-element argument tuple to the event itself.
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
   * awaitable.
   */
  async close(): Promise<void> {

    this.#shutdown(1000, "the notification stream was closed by the client");

    await (this.#closePromise ?? Promise.resolve());
  }

  /**
   * Dispose the stream. Delegates to {@link EventStream.close} so `await using stream = ...` tears the socket down cleanly.
   */
  async [Symbol.asyncDispose](): Promise<void> {

    await this.close();
  }

  // The WebSocket opened. Record the lifecycle event and settle the open handshake.
  #onOpen(): void {

    this.#live = true;
    this.#log.debug("Connected to the UniFi Access realtime notification API.");
    this.#settleOpen();
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

  // The socket reported an error. Suppress the expected-disconnect noise, surface a typed error, and request a close so teardown flows through the single close
  // path.
  #onError(event: AccessWebSocketErrorEvent): void {

    if(!isExpectedWsDisconnect(event.error)) {

      this.#log.error("The UniFi Access realtime notification API reported an error.", event.error ?? event.message);
    }

    this.#bus.emit("error", new AccessNetworkError("The UniFi Access realtime notification API connection failed.", { cause: event.error }));
    this.#shutdown(1006, "the notification stream connection errored");
  }

  // The single teardown. Guarded so it runs once whether triggered by the socket's close event, an error, the watchdog, or an explicit close. Aborts the controller
  // (detaching every listener and ending the watchdog), settles a still-pending open handshake as a failure, announces the close, and releases the connection we
  // own.
  #onClose(code: number, reason: string): void {

    if(this.#closed) {

      return;
    }

    this.#closed = true;
    this.#controller.abort();

    // Settle a still-pending open handshake as a failure. A caller-signal abort surfaces as the typed AccessAbortedError (its own event, its own type); every
    // other pre-open teardown - an unsolicited peer close, a socket error, a watchdog stall, an explicit close() - stays the generic pre-open network error.
    this.#settleOpen(this.#callerAborted ? new AccessAbortedError("The UniFi Access realtime notification API connection was aborted by the caller's signal.") :
      new AccessNetworkError("The UniFi Access realtime notification API closed before it finished connecting.", { cause: reason }));

    /* An unsolicited close - the peer dropped a live socket without our asking - is termination we did not initiate, the same category as a socket error, and a
     * controller reboot arrives exactly this way (a `close` event with no preceding socket `error`). Route it onto the error rail so the coordinator recovers; a
     * self-initiated close, or one that follows an already-emitted error (socket error or watchdog stall, both of which mark the teardown as ours), stays
     * informational. The live gate keeps a pre-open connect failure on the opened-handshake rejection rather than starting a doomed recovery.
     */
    if(!this.#closeInitiated && this.#live) {

      this.#bus.emit("error", new AccessNetworkError("The UniFi Access realtime notification API connection closed unexpectedly.", { cause: reason }));
    }

    this.#log.debug("The UniFi Access realtime notification API connection closed.", { code, reason });
    this.#bus.emit("closed", { code, reason });

    if(channels.eventsClosed.hasSubscribers) {

      channels.eventsClosed.publish({ code, host: this.#host, reason } satisfies AccessEventsClosedPayload);
    }

    this.#closePromise = this.#releaseOwnedConnection();
  }

  /* Release the connection this stream owns, and nothing at all when a factory was injected.
   *
   * The severance happens first and synchronously, before anything is awaited, so that letting the connection go depends on nothing that can stall or reject - the
   * agent's own teardown then follows for its bookkeeping. That order is what the guarantee rests on: a peer under no obligation to answer a close frame can hold
   * a socket open indefinitely, and a socket the agent has handed to a completed upgrade is not among what the agent releases. Destroying an already-destroyed socket
   * does nothing, so a set the close handlers have already drained costs a walk and no more.
   */
  async #releaseOwnedConnection(): Promise<void> {

    if(this.#owned === null) {

      return;
    }

    for(const socket of this.#owned.sockets) {

      socket.destroy();
    }

    await this.#owned.agent.destroy();
  }

  // The caller's own signal fired. Mark this teardown as a caller abort BEFORE it runs, so #onClose settles a still-pending open handshake as the typed
  // AccessAbortedError; only this path sets the mark, so a socket close, an error, the watchdog, or an explicit close() keep the generic pre-open network error.
  #abortByCaller(): void {

    this.#callerAborted = true;
    this.#shutdown(1000, "connection aborted by the caller's signal");
  }

  // Request a graceful WebSocket close, then run teardown. Asking the socket to close is best-effort, because the peer is what decides whether the close frame is
  // ever answered - releasing the owned connection (in #onClose) is the guarantee, and it holds whether or not the handshake completes.
  #shutdown(code: number, reason: string): void {

    // Mark this as a self-initiated teardown so #onClose does not misclassify the resulting close event as an unsolicited (recoverable) one.
    this.#closeInitiated = true;

    try {

      this.#ws.close();
    } catch {

      // A socket that never opened (or a fake that rejects a premature close) must not block teardown; #onClose below releases everything regardless.
    }

    this.#onClose(code, reason);
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

  /* The silence watchdog. Each tick checks how long the channel has been quiet; once it crosses the threshold the channel is presumed dead-but-not-closed, so we
   * surface a typed stall (the coordinator's cue to recover) and tear the socket down. The loop ends when teardown aborts the controller, which the interval
   * iterator reports as an abort - the normal shutdown path, swallowed here.
   *
   * The watchdog arms at construction rather than at open, so the same threshold also bounds a connect that never completes. That doubling is deliberate: a socket
   * that never opens and one that opens and goes quiet are the same condition from a consumer's point of view, and both want the same answer.
   *
   * Detection latency is bounded in [threshold, 2 * threshold) by the tick granularity - a ten-to-twenty-second window against the roughly five-second heartbeat
   * cadence, so several beats must be missed before it trips. That is the deliberate trade: polling on a fixed cadence rather than rescheduling a timer on every
   * frame received.
   */
  async #runWatchdog(): Promise<void> {

    try {

      for await (const _tick of this.#clock.setInterval(ACCESS_EVENTS_HEARTBEAT_TIMEOUT, { signal: this.#controller.signal })) {

        const silentForMs = this.#clock.now() - this.#lastMessageAt;

        if(silentForMs >= ACCESS_EVENTS_HEARTBEAT_TIMEOUT) {

          this.#log.error("The UniFi Access realtime notification API went silent beyond the watchdog window; tearing down the stalled connection.",
            { silentForMs });
          this.#bus.emit("error", new AccessStallError("The UniFi Access realtime notification API produced no data within the watchdog window.", { silentForMs }));
          this.#shutdown(1006, "the notification stream stalled past the watchdog window");

          return;
        }
      }
    } catch {

      // The interval iterator throws on abort when the stream is torn down. That is the expected end of the loop, not an error.
    }
  }
}

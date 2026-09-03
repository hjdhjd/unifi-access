/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * http.ts: The HTTP transport for the UniFi Access library - undici pooling, signal composition, typed-error classification, and the throttle circuit breaker.
 */
import { ACCESS_API_ERROR_LIMIT, ACCESS_API_RETRY_INTERVAL, ACCESS_API_TIMEOUT } from "../settings.ts";
import { AccessAbortedError, AccessAuthError, AccessAuthorizationError, AccessNetworkError, AccessProtocolError, AccessRequestError, AccessThrottledError,
  AccessTimeoutError } from "../errors.ts";
import type { AccessHttpRequestCommon, AccessHttpRequestEndOutcome, AccessHttpRequestEndPayload, AccessHttpRequestStartPayload } from "../diagnostics.ts";
import { Pool, errors, interceptors, request } from "undici";
import type { AccessIdentityLeg } from "../errors.ts";
import type { AccessLogging } from "../logging.ts";
import type { Clock } from "../clock.ts";
import type { Dispatcher } from "undici";
import { EventBus } from "../event-bus.ts";
import type { FatalError } from "../errors.ts";
import type { IncomingHttpHeaders } from "node:http";
import type { StreamOptions } from "../event-bus.ts";
import { channels } from "../diagnostics.ts";
import { noopLog } from "../logging.ts";
import { randomUUID } from "node:crypto";
import { wallClock } from "../clock.ts";

// The transient-failure status codes the undici retry interceptor retries before `send` ever observes a response. Each one is a condition in which a UniFi OS
// controller was not in a state to answer rather than a considered refusal: 429 and the 5xx family are the controller shedding load or proxying to a service that
// has not come up, and 400 and 404 are what its API gateway returns for a route that exists but whose backing service is still starting - the shape a controller
// presents for a window after a reboot. They must not be trimmed on the reasoning that a 4xx is a client error. This is the HTTP-layer retry surface and is
// distinct from the throttle circuit breaker below, which counts the failures that survive these retries.
const RETRY_STATUS_CODES = [ 400, 404, 429, 500, 502, 503, 504 ] as const;

// The throttle cooldown in milliseconds, derived once from the seconds-valued constant so the breaker math reads in the same unit it compares against.
const COOLDOWN_MS = ACCESS_API_RETRY_INTERVAL * 1000;

/**
 * The events the {@link Transport} publishes on its three-rail surface. Both are parameterless: a consumer that needs the cooldown duration reads it from the
 * {@link AccessThrottledError} thrown by `send`, and a consumer that needs richer detail subscribes to the `unifi-access:http:throttle:*` diagnostics channels.
 *
 * @category Transport
 */
export interface TransportEvents {

  throttleEntered: [];
  throttleExited: [];
}

/**
 * The HTTP methods the transport dispatches. One vocabulary for a request's verb, shared by every caller, so the set is defined once rather than re-spelled.
 *
 * @category Transport
 */
export type HttpMethod = "DELETE" | "GET" | "HEAD" | "PATCH" | "POST" | "PUT";

/**
 * Per-request options accepted by {@link Transport.request} and {@link Transport.send}. The library composes the caller's `signal` with its own timeout deadline,
 * so a caller can cancel independently of the timeout. `headers` here override the base headers the transport stamps on automatically.
 *
 * `retry` controls whether this one request may be transparently re-sent. The pool re-sends on the transient statuses a controller presents while it is not in a
 * state to answer, which is what absorbs a reboot window or a momentary blip before a caller ever sees it. A caller whose request must not be applied twice - one
 * that mints a record, spends money, or actuates a relay - passes `false`, because a transient status can arrive after the backend already committed. The trade is
 * explicit in both directions: `false` buys at-most-once sending at the price of that absorption, so the caller sees the transient error rather than a silent
 * recovery.
 *
 * @category Transport
 */
export interface RequestOptions {

  body?: string | Uint8Array;
  headers?: Record<string, string>;
  method?: HttpMethod;
  retry?: boolean;
  signal?: AbortSignal;
  timeout?: number;
}

/**
 * The lower-level {@link Transport.send} options. Both flags follow the same pattern: a special caller opting out of one default send behavior.
 *
 * - `authRetry` controls the injected 401-relogin hook: the authenticated request path leaves it at its default of `true`, while the {@link AuthSession} login
 *   handshake passes `false` so its own 401 cannot recurse back into relogin.
 * - `probe` marks a request as the connection-recovery reachability trial. It skips the open breaker's cooldown gate so the trial can dispatch at the recovering
 *   coordinator's cadence rather than waiting out the full cooldown, while still booking its outcome through the normal path - so a successful probe closes the
 *   breaker exactly as the autonomous half-open trial would. Only recovery passes `true`; ordinary requests leave it `false` and stay gated, so the breaker still
 *   guards against operational hammering.
 *
 * @category Transport
 */
export interface SendOptions extends RequestOptions {

  authRetry?: boolean;
  probe?: boolean;
}

/**
 * Construction options for {@link Transport}. `host` is the controller address; everything else is injected.
 *
 * - `dispatcher` substitutes the undici dispatcher (an `undici.MockAgent` in tests, or a consumer-supplied pool). When injected, the transport never destroys or
 *   rebuilds it - lifecycle stays with the injector, so `reset()` and disposal are no-ops on the dispatcher.
 * - `getAuthHeaders` supplies the cookie and CSRF headers stamped onto every request. `onUnauthorized` is the relogin hook invoked on a 401 before a single retry.
 *   Both point upward at {@link AuthSession}, so they are passed as plain functions (dependency inversion) rather than as an `AuthSession` import.
 * - `identity` names which identity leg authenticates these requests, and is what words a 401 refusal - the credential session's sentence or the API token's. It
 *   defaults to `"credentials"`. The composition root builds one transport per identity it holds, so which one a transport carries is a fact settled where it is
 *   constructed rather than one re-derived from each URL at the moment a request is refused.
 * - `verifyTls` opts the owned pool into strict TLS certificate verification. It defaults to `false`, because a controller presents a self-signed certificate that
 *   no verification chain accepts; a deployment that has installed a trusted certificate on its controller turns it on. An injected dispatcher brings its own TLS
 *   settings, so the option reaches only the pool this transport builds for itself.
 *
 * @category Transport
 */
export interface TransportOptions {

  clock?: Clock;
  dispatcher?: Dispatcher;
  getAuthHeaders?: () => Record<string, string>;
  host: string;
  identity?: AccessIdentityLeg;
  log?: AccessLogging;
  onUnauthorized?: () => Promise<boolean>;
  verifyTls?: boolean;
}

/**
 * Determine whether an HTTP status code is a 2xx success. `undefined` (no response received) and any non-2xx code are failures.
 *
 * @param statusCode - The status code to test.
 *
 * @returns `true` for 200-299, `false` otherwise.
 */
export function responseOk(statusCode: number | undefined): boolean {

  return (statusCode !== undefined) && (statusCode >= 200) && (statusCode <= 299);
}

/**
 * Determine whether a response proves the controller reachable, which is the only question the throttle breaker asks. A transport-level fault or a 5xx means the
 * controller could not serve the request; any other answer came from a controller that was there to send it, so it counts as reachable whatever it said. That is
 * what keeps session validity and permission scope out of the breaker: a run of refusals aimed at one bad credential says nothing about whether the controller is
 * up.
 *
 * @param statusCode - The status code to test, or `undefined` when no response was received.
 *
 * @returns `true` for any defined status below 500, `false` for `undefined` and for 5xx.
 */
export function controllerReachable(statusCode: number | undefined): boolean {

  return (statusCode !== undefined) && (statusCode < 500);
}

/**
 * Flatten undici's `IncomingHttpHeaders` (whose values are `string | string[] | undefined`) to a plain `Record<string, string>` for {@link AccessRequestError}. A
 * multi-value header is joined with ", " and an absent value is dropped.
 *
 * @param headers - The response headers as undici delivers them.
 *
 * @returns A flat header record with no undefined values.
 */
function flattenHeaders(headers: IncomingHttpHeaders): Record<string, string> {

  const result: Record<string, string> = {};

  for(const [ key, value ] of Object.entries(headers)) {

    if(value === undefined) {

      continue;
    }

    result[key] = Array.isArray(value) ? value.join(", ") : value;
  }

  return result;
}

/**
 * Map a non-2xx status to the single typed `FatalError` it represents. This is the one place in the library that turns an HTTP status into an error class, so the
 * mapping cannot drift between callers: 401 is an authentication failure, 403 an authorization failure, and everything else carries the controller's own status,
 * body, and headers for the caller to inspect.
 *
 * @param statusCode - The non-2xx status code.
 * @param headers    - The response headers, preserved on {@link AccessRequestError}.
 * @param body       - The response body bytes, surfaced as text on {@link AccessRequestError}.
 * @param identity   - The identity leg that authenticated the refused request, which words both the 401 and the 403 and is carried on the error each raises.
 *
 * @returns The classified `FatalError`.
 */
function classifyStatus(statusCode: number, headers: IncomingHttpHeaders, body: Buffer, identity: AccessIdentityLeg): FatalError {

  switch(statusCode) {

    case 401:

      /* Each identity leg gets its own sentence because each has its own remedy, and a consumer that renders the message verbatim is the reason the distinction has
       * to live in the words rather than only in the field: a user holding good credentials and a revoked token must be sent to the token, not to their password.
       */
      return new AccessAuthError((identity === "token") ?
        "The UniFi Access controller rejected the configured API token. Please check that the token is valid and has not been revoked." :
        "Authentication with the UniFi Access controller failed.", { identity, statusCode });

    case 403:

      /* The remedy differs by leg - an account needs its role raised, a token needs reissuing with the permission it was not granted - so each leg says which,
       * rather than leaving a reader holding both identities to guess which of the two is the one falling short.
       */
      return new AccessAuthorizationError((identity === "token") ?
        "The configured API token lacks the permissions this operation requires on the UniFi Access controller." :
        "The account lacks the privileges this operation requires on the UniFi Access controller.", { identity, statusCode });

    default:

      return new AccessRequestError("The UniFi Access controller returned an error response.",
        { body: body.length ? body.toString("utf8") : undefined, headers: flattenHeaders(headers), statusCode });
  }
}

/**
 * An HTTP response from the Access controller, returned by {@link Transport.send}. The body is eagerly buffered (so no undrained stream can hold a slot in the
 * connection pool), and decoding is synchronous and lazy on top of that buffer. `send` returns this for *any* status; call {@link AccessResponse.ensureOk} to turn
 * a non-2xx into its typed `FatalError`.
 *
 * @category Transport
 */
export class AccessResponse {

  /** The HTTP status code. */
  readonly statusCode: number;

  /** The response headers as undici delivered them. */
  readonly headers: IncomingHttpHeaders;

  /** The fully buffered response body. Consumers needing raw bytes read this directly. */
  readonly body: Buffer;

  /** The identity leg of the transport that produced this response, read by the 401 classification in {@link AccessResponse.ensureOk}. */
  readonly identity: AccessIdentityLeg;

  constructor(statusCode: number, headers: IncomingHttpHeaders, body: Buffer, identity: AccessIdentityLeg) {

    this.body = body;
    this.headers = headers;
    this.identity = identity;
    this.statusCode = statusCode;
  }

  /**
   * Read a single header value, normalizing undici's `string | string[] | undefined` shape to a string or `null`. The name is matched case-insensitively, and a
   * header the controller delivered more than once arrives as an array and folds to its first value - every caller here asks a header for one value rather than
   * for the list of times it was sent.
   *
   * @param name - The header name.
   *
   * @returns The header's first value, or `null` when absent or empty.
   */
  header(name: string): string | null {

    const raw = this.headers[name.toLowerCase()];

    if(!raw) {

      return null;
    }

    return Array.isArray(raw) ? (raw[0] ?? null) : raw;
  }

  /**
   * Parse the body as JSON. Synchronous - the bytes are already in hand.
   *
   * @typeParam T - The expected shape of the parsed document.
   *
   * @returns The parsed body.
   *
   * @throws {@link AccessProtocolError} if the body is not valid JSON.
   */
  // This is the deliberate decode point where the caller asserts the document's shape - the type parameter exists to carry that assertion to the call site, so its
  // appearing only in the return position is the intent, not an oversight (the same idiom the platform's own `Response.json()` uses).
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  json<T>(): T {

    try {

      return JSON.parse(this.body.toString("utf8")) as T;
    } catch(error) {

      throw new AccessProtocolError("The UniFi Access controller returned a response that could not be parsed as JSON.", { cause: error });
    }
  }

  /**
   * Decode the body as a UTF-8 string.
   *
   * @returns The body text.
   */
  text(): string {

    return this.body.toString("utf8");
  }

  /**
   * Assert a successful response. Returns `this` unchanged on a 2xx so the call chains (`(await send(...)).ensureOk().json<T>()`); throws the classified
   * `FatalError` on any non-2xx.
   *
   * @returns `this`, for chaining.
   *
   * @throws {@link AccessAuthError} on 401, {@link AccessAuthorizationError} on 403, {@link AccessRequestError} on any other non-2xx.
   */
  ensureOk(): this {

    if(responseOk(this.statusCode)) {

      return this;
    }

    throw classifyStatus(this.statusCode, this.headers, this.body, this.identity);
  }
}

/**
 * The HTTP transport. Owns the undici connection pool, composes each request's deadline with the caller's cancellation, classifies every failure into the typed
 * `AccessError` hierarchy, and runs the throttle circuit breaker that keeps a degraded controller from being hammered.
 *
 * The breaker is the canonical three-state model - `closed -> open -> half-open -> closed`:
 *
 * - **closed:** normal operation. Each completed request books an outcome, and {@link controllerReachable} is the whole test: any answer the controller sent
 *   resets the consecutive-failure count, while a transport exception or a 5xx increments it - a controller that refuses a request is still a controller that
 *   answered. Crossing {@link ACCESS_API_ERROR_LIMIT} consecutive failures trips the breaker open.
 * - **open:** for {@link ACCESS_API_RETRY_INTERVAL} seconds, `send` throws {@link AccessThrottledError} before dispatching - no traffic reaches the controller.
 * - **half-open:** once the cooldown elapses, requests are allowed through again as recovery probes. The first success closes the breaker (and emits
 *   `throttleExited` only then, so the public signal never flaps); a failure re-arms the cooldown from that moment and stays open silently.
 *
 * Reachability lives here; session validity lives in {@link AuthSession}. The breaker never calls login to probe recovery - the next real request is the probe, and
 * the independent 401-relogin concern is the injected `onUnauthorized` hook. The clock is injected so every transition is deterministically testable.
 *
 * @category Transport
 */
export class Transport implements AsyncDisposable {

  readonly #bus = new EventBus<TransportEvents>();
  readonly #clock: Clock;
  readonly #getAuthHeaders: (() => Record<string, string>) | undefined;
  readonly #host: string;
  readonly #identity: AccessIdentityLeg;
  readonly #log: AccessLogging;
  readonly #onUnauthorized: (() => Promise<boolean>) | undefined;
  readonly #ownsDispatcher: boolean;
  readonly #verifyTls: boolean;

  // The breaker's only mutable state: the consecutive-failure count and the timestamp the cooldown last (re-)armed. `null` means the breaker is closed. The
  // dispatcher is reassignable because reset() rebuilds the owned pool.
  #consecutiveFailures = 0;
  #dispatcher: Dispatcher;
  #throttledSince: number | null = null;

  constructor(options: TransportOptions) {

    this.#clock = options.clock ?? wallClock;
    this.#getAuthHeaders = options.getAuthHeaders;
    this.#host = options.host;
    this.#identity = options.identity ?? "credentials";
    this.#log = options.log ?? noopLog;
    this.#onUnauthorized = options.onUnauthorized;

    // Settled before the pool below is built, because #buildPool reads it: a pool built while the field was still unset would ask undici for its own default rather
    // than for ours, which is the opposite of what an omitted option means.
    this.#verifyTls = options.verifyTls ?? false;

    // When a dispatcher is injected we adopt it and never touch its lifecycle - the injector owns construction and teardown. Otherwise we build (and own) the pool.
    this.#ownsDispatcher = options.dispatcher === undefined;
    this.#dispatcher = options.dispatcher ?? this.#buildPool();
  }

  /**
   * Whether the throttle breaker is currently open (refusing or probing). Reads the breaker state synchronously - safe to call on a hot path. The coordinator that
   * owns connection policy reads this to fold transport health into its own view.
   */
  get isThrottled(): boolean {

    return this.#throttledSince !== null;
  }

  /**
   * Send a request and return the {@link AccessResponse} for any HTTP status. Throttle-gates before dispatching, composes the caller's signal with the timeout
   * deadline, classifies transport failures into typed errors, books the breaker outcome, and runs the 401-relogin retry (once) when a hook is wired.
   *
   * This is the transport primitive. Callers that want the ergonomic "throw on non-2xx and parse JSON" path use {@link Transport.request}; callers that need raw
   * status, headers, or bytes (the auth handshake among them) use `send` directly.
   *
   * @param url  - The fully-qualified request URL.
   * @param opts - Per-request options.
   *
   * @returns The response.
   *
   * @throws {@link AccessThrottledError} while the breaker is open and cooling; {@link AccessTimeoutError}, {@link AccessAbortedError}, or
   *   {@link AccessNetworkError} on transport-level failures.
   */
  async send(url: string, opts: SendOptions = {}): Promise<AccessResponse> {

    // Gate first: if the breaker is open and still inside its cooldown window, refuse locally without touching the network. Once the cooldown has elapsed we fall
    // through and let this request act as the half-open recovery probe; `book` will close or re-arm the breaker based on its outcome. A `probe` request - the
    // recovery trial - skips this gate entirely: the coordinator's backoff curve is the rate limiter while it is recovering, so its probe dispatches at that
    // cadence and its booked outcome (success closes the breaker, failure re-arms the cooldown) is what keeps re-probe and breaker on one cadence.
    if((opts.probe !== true) && (this.#throttledSince !== null)) {

      const remaining = COOLDOWN_MS - (this.#clock.now() - this.#throttledSince);

      if(remaining > 0) {

        throw new AccessThrottledError("Requests to the UniFi Access controller are throttled after repeated failures.", { cooldownMs: remaining });
      }
    }

    // Relogin retry loop. The body of the loop runs at most twice: the original attempt, and - if it returns 401 and a relogin hook is wired and succeeds - one
    // retry with relogin disabled so a persistent 401 cannot spin. Booking happens exactly once, on the attempt whose outcome we return.
    let allowAuthRetry = opts.authRetry ?? true;

    for(;;) {

      let result: { body: Buffer; headers: IncomingHttpHeaders; statusCode: number };

      try {

        // The loop runs at most twice and each iteration must complete before the next can begin, so sequential awaits are the correct shape here.
        // eslint-disable-next-line no-await-in-loop
        result = await this.#dispatch(url, opts);
      } catch(error) {

        // A transport-level exception is a reachability failure - book it before propagating the already-classified error.
        this.#book(false);

        throw error;
      }

      // eslint-disable-next-line no-await-in-loop
      if((result.statusCode === 401) && allowAuthRetry && (this.#onUnauthorized !== undefined) && (await this.#onUnauthorized())) {

        allowAuthRetry = false;

        continue;
      }

      this.#book(controllerReachable(result.statusCode));

      return new AccessResponse(result.statusCode, result.headers, result.body, this.#identity);
    }
  }

  /**
   * Send a request, assert a 2xx, and parse the body as JSON. The ergonomic path over {@link Transport.send} for the common JSON case.
   *
   * @typeParam T - The expected shape of the parsed body.
   *
   * @param url  - The fully-qualified request URL.
   * @param opts - Per-request options.
   *
   * @returns The parsed body.
   *
   * @throws The classified `FatalError` on a non-2xx, or a transport-level `AccessError` on failure.
   */
  async request<T>(url: string, opts: RequestOptions = {}): Promise<T> {

    return (await this.send(url, opts)).ensureOk().json<T>();
  }

  /**
   * Rebuild the owned connection pool, dropping every keepalive connection to the controller. Called when the breaker trips so the next attempt starts from a clean
   * pool rather than reusing sockets to a degraded controller. A no-op when the dispatcher was injected - that lifecycle belongs to the injector.
   */
  reset(): void {

    if(!this.#ownsDispatcher) {

      return;
    }

    void this.#dispatcher.destroy();
    this.#dispatcher = this.#buildPool();
  }

  /**
   * Subscribe to a transport event. Returns a `Disposable`; prefer `using sub = transport.on(...)` so the listener detaches at scope exit.
   *
   * @param event   - The event to listen for.
   * @param handler - Invoked on each emission.
   *
   * @returns A `Disposable` that removes the listener when disposed.
   */
  on<K extends keyof TransportEvents>(event: K, handler: (...args: TransportEvents[K]) => void): Disposable {

    return this.#bus.on(event, handler);
  }

  /**
   * Wait for the next emission of a transport event.
   *
   * @param event - The event to await.
   * @param opts  - Optional abort signal.
   *
   * @returns A promise resolving to the event's argument tuple.
   */
  async once<K extends keyof TransportEvents>(event: K, opts: { signal?: AbortSignal } = {}): Promise<TransportEvents[K]> {

    return this.#bus.once(event, opts);
  }

  /**
   * Stream every subsequent emission of a transport event until the signal aborts.
   *
   * @param event - The event to stream.
   * @param opts  - Stream options, including the abort signal.
   *
   * @returns An async iterable of the event's argument tuples.
   */
  stream<K extends keyof TransportEvents>(event: K, opts: StreamOptions = {}): AsyncIterable<TransportEvents[K]> {

    return this.#bus.stream(event, opts);
  }

  /**
   * Dispose the transport, destroying the owned pool. A no-op on an injected dispatcher.
   */
  async [Symbol.asyncDispose](): Promise<void> {

    if(this.#ownsDispatcher) {

      await this.#dispatcher.destroy();
    }
  }

  // Perform a single HTTP exchange: compose the deadline with the caller's signal, stamp the base and per-call headers, publish the request diagnostics, buffer the
  // body, and on failure classify the exception into the typed hierarchy. Returns the bare response parts; the breaker and relogin policy live in `send`.
  async #dispatch(url: string, opts: SendOptions): Promise<{ body: Buffer; headers: IncomingHttpHeaders; statusCode: number }> {

    const method = opts.method ?? "GET";
    const requestId = randomUUID();
    const timeout = opts.timeout ?? ACCESS_API_TIMEOUT;

    // Compose our timeout deadline with the caller's optional cancellation. #classifyTransportError later tells the two apart by testing whether the caller's own
    // signal aborted; if it did not, the abort must be our timeout's, since those are the only two signals composed here.
    const timeoutSignal = AbortSignal.timeout(timeout);
    const signal = (opts.signal !== undefined) ? AbortSignal.any([ opts.signal, timeoutSignal ]) : timeoutSignal;

    /* The base headers, in precedence order. The Access API answers JSON on every endpoint and expects the content type declared on every request, including the
     * ones carrying no body, so this is the single site that stamps it rather than a duty each call site has to remember. The auth headers (cookie and CSRF) layer
     * over it, and a per-call header overrides either, which is how a caller sending something other than JSON says so.
     */
    const headers: Record<string, string> = { "content-type": "application/json", ...this.#getAuthHeaders?.(), ...opts.headers };

    if(channels.httpRequestStart.hasSubscribers) {

      channels.httpRequestStart.publish({ host: this.#host, method, requestId, url } satisfies AccessHttpRequestStartPayload);
    }

    const startedAt = this.#clock.now();

    try {

      /* Opting a request out of retries is expressed as a per-dispatch retry profile rather than by removing the interceptor: the composed interceptor merges the
       * pool's options with whatever the dispatch carries, so a zero retry ceiling here overrides the pool's profile for this one request and leaves every other
       * request on the pool's own terms.
       */
      const response = await request(url, { dispatcher: this.#dispatcher, headers, method, signal, ...((opts.body !== undefined) && { body: opts.body }),
        ...((opts.retry === false) && { retryOptions: { maxRetries: 0 } }) });
      const body = Buffer.from(await response.body.arrayBuffer());

      this.#publishEnd({ durationMs: this.#clock.now() - startedAt, method, outcome: "response", requestId, statusCode: response.statusCode, url });

      return { body, headers: response.headers, statusCode: response.statusCode };
    } catch(error) {

      const classified = this.#classifyTransportError(error, opts.signal, this.#clock.now() - startedAt);

      this.#publishEnd({ durationMs: this.#clock.now() - startedAt, error: classified.message, method, outcome: "failure", requestId, url });

      throw classified;
    }
  }

  // Book one breaker outcome. Success closes the breaker (and announces recovery only on the closing edge, so `throttleExited` never flaps); failure either trips
  // the breaker once the threshold is crossed, or re-arms the cooldown if a half-open probe just failed.
  #book(ok: boolean): void {

    if(ok) {

      this.#consecutiveFailures = 0;

      if(this.#throttledSince !== null) {

        this.#throttledSince = null;

        this.#log.info("Resumed communication with the UniFi Access controller after the throttle cooldown elapsed.");

        this.#bus.emit("throttleExited");

        if(channels.httpThrottleExited.hasSubscribers) {

          channels.httpThrottleExited.publish({ host: this.#host });
        }
      }

      return;
    }

    this.#consecutiveFailures++;

    // A failure while the breaker is already open means a half-open probe just failed: re-arm the cooldown from now and stay open silently (we never emitted
    // `throttleExited`, so we do not emit `throttleEntered` again - the consumer's view is that we have been throttled the whole time).
    if(this.#throttledSince !== null) {

      this.#throttledSince = this.#clock.now();

      return;
    }

    if(this.#consecutiveFailures >= ACCESS_API_ERROR_LIMIT) {

      this.#throttledSince = this.#clock.now();

      this.#log.error("Throttling requests to the UniFi Access controller after repeated failures.",
        { consecutiveFailures: this.#consecutiveFailures, cooldownMs: COOLDOWN_MS, errorLimit: ACCESS_API_ERROR_LIMIT });

      this.#bus.emit("throttleEntered");

      if(channels.httpThrottleEntered.hasSubscribers) {

        channels.httpThrottleEntered.publish({ consecutiveFailures: this.#consecutiveFailures, cooldownMs: COOLDOWN_MS, host: this.#host });
      }

      // Drop every keepalive connection to the controller so the next probe starts clean.
      this.reset();
    }
  }

  // Classify an undici exception into the typed hierarchy. The abort branch distinguishes our deadline from the caller's cancellation by asking which signal fired:
  // if the caller's signal is aborted it was an explicit cancel, otherwise our timeout won the race.
  #classifyTransportError(error: unknown, callerSignal: AbortSignal | undefined, elapsedMs: number): AccessAbortedError | AccessNetworkError | AccessTimeoutError {

    const isAbort = ((error instanceof DOMException) && ((error.name === "AbortError") || (error.name === "TimeoutError"))) ||
      (error instanceof errors.RequestAbortedError);

    if(isAbort) {

      if(callerSignal?.aborted) {

        return new AccessAbortedError("The request was aborted by the caller's signal.", { cause: error });
      }

      return new AccessTimeoutError("The UniFi Access controller did not respond before the request deadline elapsed.", { cause: error, elapsedMs });
    }

    // Our own pool reset destroyed an in-flight connection. Recoverable: the caller may retry against the freshly rebuilt pool.
    if(error instanceof errors.ClientDestroyedError) {

      return new AccessNetworkError("The request was interrupted because the connection pool was reset.", { cause: error });
    }

    // The retry interceptor exhausted its attempts without a usable response.
    if(error instanceof errors.RequestRetryError) {

      return new AccessNetworkError("The UniFi Access controller could not be reached after exhausting retries.", { cause: error });
    }

    // A connect-phase timeout (distinct from our request deadline) - surface it as a timeout, carrying the elapsed time.
    if(error instanceof errors.ConnectTimeoutError) {

      return new AccessTimeoutError("The connection to the UniFi Access controller timed out.", { cause: error, elapsedMs });
    }

    // Everything else is a connect/DNS/TLS/socket failure; AccessNetworkError lifts the errno from the cause chain.
    return new AccessNetworkError("A network error occurred communicating with the UniFi Access controller.", { cause: error });
  }

  /* Publish the request:end diagnostic when anyone is listening. Centralized so the success and failure paths emit the same shape, and the controller host is
   * stamped once here from this client's own address rather than repeated at each call site. The parameter is composed from the same named pieces the payload is,
   * so the two cannot drift; taking the assembled payload and subtracting the host would instead collapse the outcome union and lose both arms' own fields.
   */
  #publishEnd(payload: AccessHttpRequestCommon & { durationMs: number } & AccessHttpRequestEndOutcome): void {

    if(channels.httpRequestEnd.hasSubscribers) {

      channels.httpRequestEnd.publish({ ...payload, host: this.#host } satisfies AccessHttpRequestEndPayload);
    }
  }

  /* Build the owned connection pool: certificate verification set by `verifyTls` - off by default, which accepts the self-signed certificate a controller ships,
   * and on for a deployment that has put a verifiable one in front of it - HTTP/2 enabled, five concurrent connections, a 60-second client TTL so each pooled
   * connection is recycled roughly once a minute rather than kept alive indefinitely (bounding how long a keepalive socket to a controller that has since rebooted
   * or silently dropped the link can linger before it is retired), a fixed user-agent, and the exponential-backoff retry interceptor. The retried set is the
   * conventionally retry-safe verbs plus POST: the interceptor only fires on the transient controller-readiness codes in RETRY_STATUS_CODES and on the transient
   * connection faults undici treats as retryable - conditions in which the controller was not in a state to accept and act on the request - so re-sending a POST
   * does not risk double-applying one that already took effect. PATCH is held out of the set even so, because the config writes it carries are the one place a
   * double-apply would be consequential and the API offers no guarantee that repeating one is safe.
   */
  #buildPool(): Dispatcher {

    const userAgent: Dispatcher.DispatcherComposeInterceptor = (dispatch) => (dispatchOptions, handler) => {

      dispatchOptions.headers ??= {};

      // This cast is safe only because this composed pool's one caller, Transport.#dispatch, always passes headers as a plain object - never the string[] or
      // iterable-of-tuples forms undici's UndiciHeaders union otherwise permits, on which a bracket assignment would silently fail to add a usable header rather
      // than throw. A future caller of this interceptor, or a refactor of #dispatch, must keep passing headers as a plain object.
      (dispatchOptions.headers as Record<string, string | string[]>)["user-agent"] = "unifi-access";

      return dispatch(dispatchOptions, handler);
    };

    return new Pool("https://" + this.#host, { allowH2: true, clientTtl: 60000, connect: { rejectUnauthorized: this.#verifyTls }, connections: 5 })
      .compose(userAgent, interceptors.retry({ maxRetries: 5, maxTimeout: 1500, methods: [ "DELETE", "GET", "HEAD", "OPTIONS", "POST", "PUT" ], minTimeout: 100,
        statusCodes: [...RETRY_STATUS_CODES], timeoutFactor: 2 }));
  }
}

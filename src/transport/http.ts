/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * http.ts: The HTTP transport for the UniFi Access library - undici pooling, signal composition, typed-error classification, and the throttle circuit breaker.
 */
import { ACCESS_API_ERROR_LIMIT, ACCESS_API_RETRY_INTERVAL, ACCESS_API_RETRY_PROFILE, ACCESS_API_TIMEOUT } from "../settings.ts";
import { AccessAbortedError, AccessAuthError, AccessAuthorizationError, AccessCertificateError, AccessNetworkError, AccessProtocolError, AccessRequestError,
  AccessThrottledError, AccessTimeoutError, assertNever, readinessOfStatus } from "../errors.ts";
import type { AccessHttpRequestCommon, AccessHttpRequestEndOutcome, AccessHttpRequestEndPayload, AccessHttpRequestStartPayload } from "../diagnostics.ts";
import type { AccessIdentityLeg, FatalError } from "../errors.ts";
import type { Dispatcher, RetryHandler } from "undici";
import { Pool, errors, interceptors, request } from "undici";
import { armDeadline, wallClock } from "../clock.ts";
import { createOwnedConnector, releaseOwned } from "./connector.ts";
import type { AccessLogging } from "../logging.ts";
import type { Clock } from "../clock.ts";
import { EventBus } from "../event-bus.ts";
import type { IncomingHttpHeaders } from "node:http";
import type { OwnedDispatcher } from "./connector.ts";
import type { StreamOptions } from "../event-bus.ts";
import { channels } from "../diagnostics.ts";
import { classifyTransportError } from "./failure.ts";
import { noopLog } from "../logging.ts";
import { randomUUID } from "node:crypto";

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
 * `retry` controls whether this one request may be transparently re-sent on the terms {@link ACCESS_API_RETRY_PROFILE} sets, which is what absorbs a reboot window
 * or a momentary blip before a caller ever sees it. A caller whose request must not be applied twice - one that mints a record, spends money, or actuates a relay -
 * passes `false`, because a transient failure can arrive after the backend already committed. The trade is explicit in both directions: `false` buys at-most-once
 * sending at the price of that absorption, so the caller sees the transient error rather than a silent recovery.
 *
 * `timeout` bounds the whole request, the connection attempt included. A value above undici's own ten-second connect timer leaves that timer bounding the connect
 * phase, so the deadline governs the request end to end only at or below it. `signal` cancels the request whatever stage it has reached, and the signal's reason
 * is carried through to the thrown error's `cause` as it stands, whether it is an `Error` or anything else.
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
 *   breaker exactly as the autonomous half-open trial would, and a probe its caller cancels books nothing, like any cancelled request. A 401 the trial meets hands
 *   the mark to the relogin it triggers, so that relogin reaches the controller as the trial did. Only recovery passes `true`; ordinary requests leave it `false`
 *   and stay gated, so the breaker still guards against operational hammering.
 *
 * @category Transport
 */
export interface SendOptions extends RequestOptions {

  authRetry?: boolean;
  probe?: boolean;
}

/**
 * Construction options for {@link Transport}. `host` is the controller address exactly as configured, which every request and throttle diagnostics payload carries
 * verbatim, and `origin` is the URL origin the owned pool connects to: the scheme and the URL authority of the listener this transport reaches, an IPv6 literal
 * bracketed (`https://[fe80::1]`). Everything else is injected.
 *
 * - `dispatcher` substitutes the undici dispatcher (an `undici.MockAgent` in tests, or a consumer-supplied pool). When injected, the transport never destroys or
 *   rebuilds it - lifecycle stays with the injector, so `reset()` and disposal are no-ops on the dispatcher. It also brings its own connector and its own retry
 *   policy, so a connection attempt a settled request leaves behind runs on that dispatcher's terms rather than the owned pool's; the request itself settles at
 *   once either way.
 * - `getAuthHeaders` supplies the cookie and CSRF headers stamped onto every request. `onUnauthorized` is the relogin hook invoked on a 401, told whether the
 *   request that met it was a recovery probe so the relogin can carry the probe's mark: it resolves `true` to have the request retried once, resolves `false` to
 *   have the 401 handed back, and rejects with the relogin's own failure, which the request then throws. Both point upward at {@link AuthSession}, so they are
 *   passed as plain functions (dependency inversion) rather than as an `AuthSession` import.
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
  onUnauthorized?: (opts: { probe: boolean }) => Promise<boolean>;
  origin: string;
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
 * Determine whether a request's outcome shows the controller serving, which is the only question the throttle breaker asks. No answer, a 5xx and a 429 are
 * failures: the controller could not be reached, could not serve the request, or is limiting requests and asked to be asked less often. Any other answer came from
 * a controller that was there and served it, a 401, a 403 or a 404 among them, so it counts as serving whatever it said. That is what keeps session validity,
 * permission scope and a missing resource out of the breaker: a run of refusals aimed at one bad credential or one wrong path says nothing about whether the
 * controller is up.
 *
 * @param statusCode - The status code to test, or `undefined` when no response was received.
 *
 * @returns `true` for any defined status below 500 that is not a controller limiting requests, `false` for `undefined`, for 429 and for 5xx.
 */
export function controllerServing(statusCode: number | undefined): boolean {

  return (statusCode !== undefined) && (statusCode < 500) && (readinessOfStatus(statusCode) !== "limiting");
}

/**
 * The owned pool's retry policy: undici's own decision, except that an answer whose headers carry a Retry-After key is never retried. A key that is present is
 * the controller's hint whatever its value, an empty one included, so the policy calls back at once and the answer returns to its caller with the hint among its
 * headers: a hinted wait of a second or more cannot fit inside the request deadline, and a caller on a reconnect schedule is the one placed to wait it out.
 *
 * Every other failure takes undici's default decision, made from the options the handler hands the policy: a code undici does not retry, a method or a status
 * outside the retried sets, or an attempt past `maxRetries` gives up, and anything else waits `minTimeout` grown by `timeoutFactor` per attempt, up to
 * `maxTimeout`. The decision is restated here because undici publishes no handle on its own, and the suite holds the two equal over the answers that carry no hint.
 *
 * The wait is armed on the platform's `setTimeout` rather than on the injected clock, the one timer the library arms outside it. Undici's own default waits on the
 * platform timer, and the owned-pool suites drive a transport on a test clock while its retries run in real time, so a wait on the injected clock would run those
 * rows on virtual time instead. The handle is returned because it is what lets undici release the wait when the request is aborted during it.
 *
 * @param error    - The failure the handler asks about: an answer it read as a failure, or a connection fault.
 * @param context  - The handler's attempt counter and the request's options, the merged retry options among them.
 * @param callback - The handler's continuation, which retries on `null` and gives up, returning the answer, on the failure itself.
 *
 * @returns The timer the wait is armed on, or `undefined` when the policy decided at once.
 */
export function retryUnlessHinted(error: Error, context: RetryHandler.RetryContext, callback: RetryHandler.OnRetryCallback): NodeJS.Timeout | undefined {

  if((error instanceof errors.RequestRetryError) && Object.hasOwn(error.headers, "retry-after")) {

    callback(error);

    return undefined;
  }

  const { opts, state } = context;
  const { errorCodes, maxRetries, maxTimeout, methods, minTimeout, statusCodes, timeoutFactor } = opts.retryOptions ?? {};

  // Undici's handler fills every one of these before it asks a policy, so a decision missing one is reached by no runtime, and it gives the request up rather than
  // restating a default of undici's own.
  if((errorCodes === undefined) || (maxRetries === undefined) || (maxTimeout === undefined) || (minTimeout === undefined) || (timeoutFactor === undefined)) {

    callback(error);

    return undefined;
  }

  // The default's own tests, in its own order: a code undici does not retry, a method or a status outside the retried sets, and an attempt past the ceiling each
  // give up. Either member is read off the failure as whatever it carries, because a connection fault carries a code and no status.
  const code: unknown = ("code" in error) ? error.code : undefined;
  const statusCode: unknown = ("statusCode" in error) ? error.statusCode : undefined;

  if((Boolean(code) && (code !== "UND_ERR_REQ_RETRY") && !errorCodes.some((retried) => (retried === code))) ||
    (Array.isArray(methods) && !methods.includes(opts.method)) ||
    ((statusCode !== undefined) && (statusCode !== null) && Array.isArray(statusCodes) && !statusCodes.some((retried) => (retried === statusCode))) ||
    (state.counter > maxRetries)) {

    callback(error);

    return undefined;
  }

  return setTimeout(() => callback(null), Math.min(minTimeout * (timeoutFactor ** (state.counter - 1)), maxTimeout));
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
       * rather than leaving a reader holding another identity to guess which leg is falling short.
       */
      return new AccessAuthorizationError((identity === "token") ?
        "The configured API token lacks the permissions this operation requires on the UniFi Access controller." :
        "The account lacks the privileges this operation requires on the UniFi Access controller.", { identity, statusCode });

    default:

      return new AccessRequestError("The UniFi Access controller answered the request with HTTP status " + String(statusCode) + ".",
        { body: body.length ? body.toString("utf8") : undefined, headers: flattenHeaders(headers), statusCode });
  }
}

// Whether a failed request was a cancellation its caller chose, the one failure that says nothing about the controller. The caller's own abort is the
// AccessAbortedError class; a deadline the caller supplied as its signal carries that class too, and is told apart by the platform's own deadline reason, the
// TimeoutError that AbortSignal.timeout() fires with - a controller that lets a deadline lapse did not answer in time, whoever set the deadline.
function callerCancelled(error: unknown, signal: AbortSignal | undefined): boolean {

  return (error instanceof AccessAbortedError) && !((signal?.reason instanceof Error) && (signal.reason.name === "TimeoutError"));
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
   * @throws {@link AccessAuthError} on 401, {@link AccessAuthorizationError} on 403, {@link AccessRequestError} on any other non-2xx, carrying the status, body
   *   and headers the controller answered with: a retried status's last answer, a 429 and an answer carrying a Retry-After hint among them.
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
 * `AccessError` hierarchy, and runs the throttle circuit breaker that keeps a degraded controller from being hammered. A cancellation or the deadline settles its
 * own request the instant it fires, whatever stage that request has reached, and touches no other; the owned pool's connector holds every socket from the moment
 * it is vended, so a reset or a disposal releases a connection attempt still in flight rather than leaving it to run out undici's own connect timer.
 *
 * The breaker is the canonical three-state model - `closed -> open -> half-open -> closed`:
 *
 * - **closed:** normal operation. Each completed request books an outcome, and {@link controllerServing} is the whole test: an answer from a controller that
 *   served it, a 4xx other than a 429 among them, resets the consecutive-failure count, while a transport exception, a 5xx or a 429 increments it - a controller
 *   that refuses a request is still a controller that answered, while one limiting requests has asked to be asked less often. A request its caller cancels, or one
 *   never sent because its caller had already aborted, books nothing, since neither says anything about the controller. Crossing {@link ACCESS_API_ERROR_LIMIT}
 *   consecutive failures trips the breaker open.
 * - **open:** for {@link ACCESS_API_RETRY_INTERVAL} seconds, `send` throws {@link AccessThrottledError} before dispatching - no traffic reaches the controller.
 * - **half-open:** once the cooldown elapses, requests are allowed through again as recovery probes. The first success closes the breaker (and emits
 *   `throttleExited` only then, so the public signal never flaps); a failure re-arms the cooldown from that moment and stays open silently.
 *
 * Whether the controller is serving lives here; session validity lives in {@link AuthSession} and a missing resource with its caller. The breaker never calls login
 * to probe recovery - the next real request is the probe, and the independent 401-relogin concern is the injected `onUnauthorized` hook. The clock is injected so
 * every transition is deterministically testable.
 *
 * @category Transport
 */
export class Transport implements AsyncDisposable {

  /* The address this transport dials, which is what a certificate failure reports the peer as. It is read from the origin rather than from `host`, because the
   * origin is what the pool connects to, and the address a user is told about has to be the one that was actually dialed - the official API's own port included.
   */
  readonly #address: string;
  readonly #bus: EventBus<TransportEvents>;
  readonly #clock: Clock;
  readonly #getAuthHeaders: (() => Record<string, string>) | undefined;
  readonly #host: string;
  readonly #identity: AccessIdentityLeg;
  readonly #log: AccessLogging;
  readonly #onUnauthorized: ((opts: { probe: boolean }) => Promise<boolean>) | undefined;
  readonly #origin: string;
  readonly #verifyTls: boolean;

  /* The breaker's only mutable state: the consecutive-failure count and the monotonic reading the cooldown last (re-)armed at, so the cooldown measures the time
   * that passed however the time of day is set meanwhile. `null` means the breaker is closed.
   *
   * The pool is the dispatcher every request goes to and the connector built beside it, travelling as one value so the two can never disagree about which pool a
   * dial belongs to, and reassigned whole because reset() rebuilds both together. An injected dispatcher is carried with a connector of `null`: its lifecycle
   * belongs to the injector, so a reset or a disposal here has nothing of its own to release.
   */
  #consecutiveFailures = 0;
  #pool: OwnedDispatcher | { readonly connector: null; readonly dispatcher: Dispatcher };
  #throttledSince: number | null = null;

  constructor(options: TransportOptions) {

    this.#address = new URL(options.origin).host;
    this.#clock = options.clock ?? wallClock;
    this.#getAuthHeaders = options.getAuthHeaders;
    this.#host = options.host;
    this.#identity = options.identity ?? "credentials";
    this.#log = options.log ?? noopLog;
    this.#bus = new EventBus<TransportEvents>(this.#log);
    this.#onUnauthorized = options.onUnauthorized;

    /* The origin and the certificate posture are settled before the pool below is built, because #buildPool reads them. reset() rebuilds the pool from these same
     * fields, so a rebuilt pool reaches the listener the transport was constructed for, with the posture it was constructed with. A pool built while the posture was
     * still unset would ask undici for its own default rather than for ours, which is the opposite of what an omitted option means.
     */
    this.#origin = options.origin;
    this.#verifyTls = options.verifyTls ?? false;

    // When a dispatcher is injected we adopt it and never touch its lifecycle - the injector owns construction and teardown, and it brings a connector of its own
    // that we have no handle on. Otherwise we build (and own) the pool and the connector beside it.
    this.#pool = (options.dispatcher === undefined) ? this.#buildPool() : { connector: null, dispatcher: options.dispatcher };
  }

  /**
   * Whether the throttle breaker is currently open (refusing or probing). Reads the breaker state synchronously - safe to call on a hot path. The coordinator that
   * owns connection policy reads this to fold transport health into its own view.
   */
  get isThrottled(): boolean {

    return this.#throttledSince !== null;
  }

  /**
   * The URL origin this transport's requests reach: the scheme and the URL authority of the listener it was built for. The authentication session composes its
   * handshake URLs from it, so the URLs it sends and the origin the pool dials are one value by construction.
   */
  get origin(): string {

    return this.#origin;
  }

  /**
   * Send a request and return the {@link AccessResponse} for any HTTP status. Throttle-gates before dispatching, answers a caller that has already aborted without
   * sending a request, composes the caller's signal with the timeout deadline, classifies transport failures into typed errors, books the breaker outcome unless the
   * caller cancelled the request, and runs the 401-relogin retry (once) when a hook is wired.
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
   *   {@link AccessNetworkError} on transport-level failures; and whatever the relogin hook rejects with, when a 401's relogin fails on anything but a refused
   *   sign-in, the status error its handshake was answered with among them. A status the controller answered this request with is never thrown here: on the owned
   *   pool it returns as the response, a retried status after its last attempt and a 429 or an answer carrying a Retry-After hint at once, for
   *   {@link AccessResponse.ensureOk} to classify.
   */
  async send(url: string, opts: SendOptions = {}): Promise<AccessResponse> {

    // Gate first: if the breaker is open and still inside its cooldown window, refuse locally without touching the network. Once the cooldown has elapsed we fall
    // through and let this request act as the half-open recovery probe; `book` will close or re-arm the breaker based on its outcome, and a probe its caller cancels
    // books nothing and leaves the breaker half-open. A `probe` request - the recovery trial - skips this gate entirely: the coordinator's backoff curve is the rate
    // limiter while it is recovering, so its probe dispatches at that cadence and the outcome it books (success closes the breaker, failure re-arms the cooldown, a
    // cancel books nothing) is what keeps re-probe and breaker on one cadence.
    if((opts.probe !== true) && (this.#throttledSince !== null)) {

      const remaining = COOLDOWN_MS - (this.#clock.monotonic() - this.#throttledSince);

      if(remaining > 0) {

        throw new AccessThrottledError("Requests to the UniFi Access controller are throttled after repeated failures.", { cooldownMs: remaining });
      }
    }

    /* Relogin retry loop. The body of the loop runs at most twice: the original attempt, and - if it returns 401 and a relogin hook is wired and succeeds - one
     * retry with relogin disabled so a persistent 401 cannot spin. Only the attempt whose outcome we return can book, and it books nothing when its caller cancelled
     * it or had already aborted before it was sent. An attempt whose relogin throws books nothing either: the handshake's own sends booked what the controller
     * answered them, so booking the 401 beside them would count a controller that failed its relogin as one that served. The hook is told whether this request is
     * the recovery probe, so a relogin the probe triggers carries its mark.
     */
    let allowAuthRetry = opts.authRetry ?? true;

    for(;;) {

      // A caller that has already aborted is answered before anything is dispatched. No request is issued, so none is published and none is booked: the
      // controller was never asked, and an abort or a deadline that fired before the request began says nothing about it.
      if(opts.signal?.aborted === true) {

        throw new AccessAbortedError("The request was aborted by the caller's signal.", { cause: opts.signal.reason });
      }

      let result: { body: Buffer; headers: IncomingHttpHeaders; statusCode: number };

      try {

        // The loop runs at most twice and each iteration must complete before the next can begin, so sequential awaits are the correct shape here.
        // eslint-disable-next-line no-await-in-loop
        result = await this.#dispatch(url, opts);
      } catch(error) {

        /* A transport-level exception is evidence the controller could not be reached or did not answer in time, so it books a failure before the
         * already-classified error propagates. A cancellation the caller chose is the exception: it says nothing about the controller, so it books no outcome and
         * leaves the breaker exactly as it found it. A pool reset's interruption books a failure too, though it says nothing new about the controller: the pool
         * resets only as the breaker trips, so such a failure lands on an already-open breaker and re-arms the cooldown within moments of the trip, which moves it
         * negligibly.
         */
        if(!callerCancelled(error, opts.signal)) {

          this.#book(false);
        }

        throw error;
      }

      // eslint-disable-next-line no-await-in-loop
      if((result.statusCode === 401) && allowAuthRetry && (this.#onUnauthorized !== undefined) && (await this.#onUnauthorized({ probe: opts.probe === true }))) {

        allowAuthRetry = false;

        continue;
      }

      this.#book(controllerServing(result.statusCode));

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
   * @throws The classified `FatalError` on a non-2xx, a transport-level `AccessError` on failure, or {@link AccessProtocolError} if the 2xx body is not valid JSON.
   */
  async request<T>(url: string, opts: RequestOptions = {}): Promise<T> {

    return (await this.send(url, opts)).ensureOk().json<T>();
  }

  /**
   * Rebuild the owned connection pool, dropping every keepalive connection to the controller. Called when the breaker trips so the next attempt starts from a clean
   * pool rather than reusing sockets to a degraded controller. A connection attempt still in flight is released along with the keepalive connections, so a request
   * waiting on one fails at once as the pool-reset interruption rather than running on to undici's own connect timer. A no-op when the dispatcher was injected -
   * that lifecycle belongs to the injector.
   */
  reset(): void {

    const pool = this.#pool;

    if(pool.connector === null) {

      return;
    }

    void releaseOwned(pool);
    this.#pool = this.#buildPool();
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
   * Dispose the transport, destroying the owned pool. A connection attempt still in flight is severed before the pool's own teardown is awaited. A no-op on an
   * injected dispatcher.
   */
  async [Symbol.asyncDispose](): Promise<void> {

    const pool = this.#pool;

    if(pool.connector !== null) {

      await releaseOwned(pool);
    }
  }

  // Perform a single HTTP exchange: compose the deadline with the caller's signal, stamp the base and per-call headers, publish the request diagnostics, buffer the
  // body, and on failure classify the exception into the typed hierarchy. Returns the bare response parts; the breaker and relogin policy live in `send`.
  async #dispatch(url: string, opts: SendOptions): Promise<{ body: Buffer; headers: IncomingHttpHeaders; statusCode: number }> {

    const method = opts.method ?? "GET";
    const requestId = randomUUID();
    const timeout = opts.timeout ?? ACCESS_API_TIMEOUT;

    /* Compose our own deadline with the caller's optional cancellation. The deadline is drawn from the injected clock rather than from the platform, so a suite
     * fires it on virtual time instead of waiting it out. It is held for exactly this exchange: `using` releases it when the method returns, on every path, so a
     * settled request leaves no timer behind. #toAccessError later tells the deadline from the caller's cancellation by identity, comparing the failure against
     * each signal's own reason.
     */
    using deadline = armDeadline(timeout, { clock: this.#clock });
    const signal = (opts.signal !== undefined) ? AbortSignal.any([ opts.signal, deadline.signal ]) : deadline.signal;

    /* The base headers, in precedence order. The Access API answers JSON on every endpoint and expects the content type declared on every request, including the
     * ones carrying no body, so this is the single site that stamps it rather than a duty each call site has to remember. The auth headers (cookie and CSRF) layer
     * over it, and a per-call header overrides either, which is how a caller sending something other than JSON says so.
     */
    const headers: Record<string, string> = { "content-type": "application/json", ...this.#getAuthHeaders?.(), ...opts.headers };

    if(channels.httpRequestStart.hasSubscribers) {

      channels.httpRequestStart.publish({ host: this.#host, method, requestId, url } satisfies AccessHttpRequestStartPayload);
    }

    // The exchange's elapsed time is measured on the monotonic reading, so the duration it publishes and the elapsed time a failure reports are the time that
    // passed however the time of day is set meanwhile.
    const startedAt = this.#clock.monotonic();

    try {

      /* A signal that has already fired when the request reaches here never runs a listener attached to it, so the settlement below would never settle, and undici
       * applies a signal only at request start, after the connect has completed. The check ahead of the dispatch is what keeps such a request from opening a
       * connection at all, on any dispatcher, and throwing the reason inside the try sends it through the same catch as every other failure, so it classifies by
       * identity and publishes the same end diagnostic. `send` answers a caller that had aborted before the request began, so what reaches this check is an abort
       * landing in between, such as a start-channel subscriber aborting the caller's signal while the request start is published.
       */
      if(signal.aborted) {

        throw signal.reason;
      }

      /* undici applies a signal's abort at request start and on a live socket, never to a connection attempt still in flight, so the transport settles the caller
       * itself the moment the signal fires: the exchange races a settlement that rejects with the signal's own reason, which is also what lets the classification
       * below name the cause by identity. A connection attempt the settled request leaves behind runs to the pool's own connect timer, or completes and meets
       * undici's request start, where the deferred abort destroys it before a byte is written. Observed on 2026-09-25: the just-connected socket closes with the
       * abort about a millisecond after the handshake, and the pool holds nothing afterward.
       *
       * The listener is registered after the check above, so a signal that has already fired constructs nothing it would then discard, and it lives for exactly
       * this request, because a caller's signal may outlive it: `once` takes it off when it fires, and the race's `finally` takes it off when the exchange ends
       * first. The race observes the losing exchange's own later rejection as well, so a settled request leaves nothing unhandled behind it.
       */
      const settlement = Promise.withResolvers<never>();
      const settle = (): void => settlement.reject(signal.reason);

      signal.addEventListener("abort", settle, { once: true });

      // The exchange is an async function so that a synchronous throw from undici's own argument checks still arrives as a rejection the race observes, which is
      // what takes the listener off on every path rather than leaving it to fire into a settlement nobody is waiting on.
      const exchange = async (): Promise<{ body: Buffer; headers: IncomingHttpHeaders; statusCode: number }> => {

        /* Opting a request out of retries is expressed as a per-dispatch retry profile rather than by removing the interceptor: the composed interceptor merges
         * the pool's options with whatever the dispatch carries, so a zero retry ceiling here overrides the pool's profile for this one request and leaves every
         * other request on the pool's own terms.
         */
        const response = await request(url, { dispatcher: this.#pool.dispatcher, headers, method, signal, ...((opts.body !== undefined) && { body: opts.body }),
          ...((opts.retry === false) && { retryOptions: { maxRetries: 0 } }) });

        return { body: Buffer.from(await response.body.arrayBuffer()), headers: response.headers, statusCode: response.statusCode };
      };

      const result = await Promise.race([ exchange(), settlement.promise ]).finally(() => signal.removeEventListener("abort", settle));

      this.#publishEnd({ durationMs: this.#clock.monotonic() - startedAt, method, outcome: "response", requestId, statusCode: result.statusCode, url });

      return result;
    } catch(error) {

      const classified = this.#toAccessError(error, opts.signal, deadline.signal, this.#clock.monotonic() - startedAt);

      this.#publishEnd({ ...(callerCancelled(classified, opts.signal) && { cancelled: true }), durationMs: this.#clock.monotonic() - startedAt,
        error: classified.message, method, outcome: "failure", requestId, url });

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

      this.#throttledSince = this.#clock.monotonic();

      return;
    }

    if(this.#consecutiveFailures >= ACCESS_API_ERROR_LIMIT) {

      this.#throttledSince = this.#clock.monotonic();

      this.#log.warn("Throttling requests to the UniFi Access controller after repeated failures.",
        { consecutiveFailures: this.#consecutiveFailures, cooldownMs: COOLDOWN_MS, errorLimit: ACCESS_API_ERROR_LIMIT });

      this.#bus.emit("throttleEntered");

      if(channels.httpThrottleEntered.hasSubscribers) {

        channels.httpThrottleEntered.publish({ consecutiveFailures: this.#consecutiveFailures, cooldownMs: COOLDOWN_MS, host: this.#host });
      }

      // Drop every keepalive connection to the controller so the next probe starts clean.
      this.reset();
    }
  }

  /* Translate a failed exchange into the typed hierarchy. A cancellation is read by identity first: the error a cancelled or expired request rejects with IS the
   * reason of the signal that fired, so comparing against each signal's own reason names which of them caused the failure exactly - where asking whether the
   * caller's signal is aborted at classification time would misname a deadline that fired first on a request its caller went on to cancel a moment later.
   *
   * Every other failure is sorted by the transport failure classifier, the local mirror of homebridge-plugin-utils' taxonomy that the notification socket sorts its
   * failures by as well, and each kind maps to the typed error it reports as. The classifier is handed no signal, because the signals this transport composed are
   * exactly what the identity checks above have already answered. A generic network failure carries the code the classifier read off the chain, so the error's
   * public `code` and its kind are one reading of the same chain.
   */
  #toAccessError(error: unknown, callerSignal: AbortSignal | undefined, deadline: AbortSignal,
    elapsedMs: number): AccessAbortedError | AccessNetworkError | AccessTimeoutError {

    // Our own deadline caused this failure, and settled the request at whatever stage it had reached.
    if(error === deadline.reason) {

      return new AccessTimeoutError("The UniFi Access controller did not respond before the request deadline elapsed.", { cause: error, elapsedMs });
    }

    // The caller's own signal caused it. Identity is the exact test whatever the reason is - an `Error`, `null`, or a string - because a cancelled request rejects
    // with the reason itself, from the settlement or from the check ahead of the dispatch, rather than with anything undici builds from it.
    if((callerSignal?.aborted === true) && (error === callerSignal.reason)) {

      return new AccessAbortedError("The request was aborted by the caller's signal.", { cause: error });
    }

    const failure = classifyTransportError(error);

    switch(failure.kind) {

      /* A connect-phase timeout (distinct from our request deadline) - surface it as a timeout, carrying the elapsed time. The arm is reached when a caller's
       * `timeout` option exceeds undici's own ten-second connect timer, which then bounds the connect phase and wins. It is also reached by a request queued behind a
       * connection attempt a settled request left running, when that attempt's ten-second timer fires before the queued request's own deadline: a failed connect
       * fails every request queued on that client, and undici's retry interceptor does not retry UND_ERR_CONNECT_TIMEOUT, so the connect timer's error reaches the
       * queued request.
       */
      case "connect-timeout":

        return new AccessTimeoutError("The connection to the UniFi Access controller timed out.", { cause: error, elapsedMs });

      /* The controller accepted the request and then stopped answering before its reply was complete, which undici's own response timers report. They are reached
       * when a request's deadline exceeds those timers, or through an injected dispatcher that brings timers of its own. A cancellation that is not one of this
       * transport's own signals classifies as a timeout too, the reading homebridge-plugin-utils gives it, and reports the same way.
       */
      case "timeout":

        return new AccessTimeoutError("The UniFi Access controller stopped responding before its reply was complete.", { cause: error, elapsedMs });

      // Our own pool reset destroyed an in-flight connection, live socket or connection attempt alike. Recoverable: the caller may retry against the rebuilt pool.
      case "destroyed":

        return new AccessNetworkError("The request was interrupted because the connection pool was reset.", { cause: error, code: failure.code });

      /* The retry interceptor raises RequestRetryError for a response it could not hand over whole. On the owned pool, which runs it with `throwOnError` off, that
       * is a response whose bytes it cannot reconcile with the request: a resumed retry the controller answered without the matching range, or a body whose length
       * disagrees with the length its headers declared. On an injected dispatcher whose own retry interceptor keeps undici's default, it is also a status that
       * interceptor retries, once it makes no further attempt. Either way no usable response arrived, so the failure is classified with the connection faults a
       * later attempt can clear, in a sentence that holds for both.
       */
      case "retries-exhausted":

        return new AccessNetworkError("The request to the UniFi Access controller ended in its retry handling without a usable response.",
          { cause: error, code: failure.code });

      /* The peer's certificate failed the platform's verification, so the failure names the listener it came from and the address that was dialed rather than
       * reporting an unreachable host. Which listener that is comes from the identity this transport was built with, because each identity addresses exactly one of
       * them.
       */
      case "certificate":

        return new AccessCertificateError({ cause: error, host: this.#address, identity: this.#identity });

      // Everything else is a connect, DNS, or socket failure. The aborted kind answers only a signal handed to the classifier, and this translation hands it none, so
      // it is listed here for the union to stay exhaustive rather than because a request can reach it.
      case "aborted":
      case "dns":
      case "refused":
      case "reset":
      case "transport":
      case "unreachable":

        return new AccessNetworkError("A network error occurred communicating with the UniFi Access controller.", { cause: error, code: failure.code });

      default:

        // Exhaustiveness guard. A new kind joining the union without a case above stops `failure` being `never` here, and this fails to compile.
        return assertNever(failure);
    }
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

  /* Build the owned connection pool and the connector beside it: the pool's connector is the owned helper, so a reset or a disposal can release a connection
   * attempt still in flight, and `allowH2` is stated at the helper because a function connector bypasses the forwarding a pool does of its own builder options.
   * Certificate verification is set by `verifyTls` - off by default, which accepts the self-signed certificate a controller ships, and on for a deployment that has
   * put a verifiable one in front of it - HTTP/2 enabled, five concurrent connections, a 60-second client TTL so each pooled connection is recycled roughly once a
   * minute rather than kept alive indefinitely (bounding how long a keepalive socket to a controller that has since rebooted or silently dropped the link can
   * linger before it is retired), a fixed user-agent, the signal gate, and the exponential-backoff retry interceptor composed from ACCESS_API_RETRY_PROFILE, where
   * the retried verbs and statuses are documented beside their values. The profile's lists are copied into the interceptor's options because undici types them as
   * mutable arrays and the profile holds them readonly.
   *
   * The interceptor runs with `throwOnError` off and with retryUnlessHinted as its policy, both set here rather than in the profile because they say how the pool
   * delivers an answer rather than which answers it retries. Off, the interceptor never discards an answer: once the retries run out, and at once for a status
   * outside the set, a method outside the retried verbs or an answer carrying a Retry-After hint, the controller's last response returns to `send` with its body
   * and headers, and `ensureOk` is where it becomes the classified error. Every attempt and its backoff run inside the one request deadline `#dispatch` arms, so a
   * controller too slow to answer every attempt inside it ends the request as a timeout rather than as a response.
   *
   * The trade is a held connection. While a retry waits out its backoff, the interceptor keeps the answer's connection paused until the policy decides, so on
   * HTTP/1.1 a retrying request holds one of the pool's connections through every wait and a burst of retrying requests can leave a later request queued past its
   * deadline, while on HTTP/2 a paused stream leaves the session's other streams free. Whether a controller's listener negotiates HTTP/2 is measured against a live
   * controller rather than here.
   */
  #buildPool(): OwnedDispatcher {

    const userAgent: Dispatcher.DispatcherComposeInterceptor = (dispatch) => (dispatchOptions, handler) => {

      dispatchOptions.headers ??= {};

      // This cast is safe only because this composed pool's one caller, Transport.#dispatch, always passes headers as a plain object - never the string[] or
      // iterable-of-tuples forms undici's UndiciHeaders union otherwise permits, on which a bracket assignment would silently fail to add a usable header rather
      // than throw. A future caller of this interceptor, or a refactor of #dispatch, must keep passing headers as a plain object.
      (dispatchOptions.headers as Record<string, string | string[]>)["user-agent"] = "unifi-access";

      return dispatch(dispatchOptions, handler);
    };

    /* The retry interceptor's handler learns of a request's signal only once that request has started on a connection, so without this gate a connection attempt
     * that fails with a retryable fault is dispatched again for a request the transport has already settled, and so is a request cancelled while it waits out a
     * retry backoff. Listed ahead of the retry interceptor, which undici's composition wraps around it, the gate sees every attempt and refuses one whose signal has
     * already fired with undici's own class for an aborted request. A refusal thrown from a retry's dispatch goes straight to the request's own handler, so the
     * request ends there without another connection attempt. The signal travels on the dispatch options without appearing in their type, so the gate narrows to it
     * rather than casting, and it reads that signal and nothing else - it holds no state, and its only lifecycle is the pool's own.
     */
    const signalGate: Dispatcher.DispatcherComposeInterceptor = (dispatch) => (dispatchOptions, handler) => {

      if(("signal" in dispatchOptions) && (dispatchOptions.signal instanceof AbortSignal) && dispatchOptions.signal.aborted) {

        throw new errors.RequestAbortedError();
      }

      return dispatch(dispatchOptions, handler);
    };

    // `allowH2` reaches the connector and the pool alike, because the two read it for different things: the connector's copy decides the ALPN offer, and the
    // pool's decides how it handles the connection once the connect has completed. One binding is what keeps the two from disagreeing.
    const allowH2 = true;
    const connector = createOwnedConnector({ allowH2, verifyTls: this.#verifyTls });
    const dispatcher = new Pool(this.#origin, { allowH2, clientTtl: 60000, connect: connector.connect, connections: 5 })
      .compose(userAgent, signalGate, interceptors.retry({ ...ACCESS_API_RETRY_PROFILE, methods: [...ACCESS_API_RETRY_PROFILE.methods], retry: retryUnlessHinted,
        statusCodes: [...ACCESS_API_RETRY_PROFILE.statusCodes], throwOnError: false }));

    return { connector, dispatcher };
  }
}

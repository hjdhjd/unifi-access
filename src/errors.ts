/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * errors.ts: The typed error hierarchy for the UniFi Access library.
 */

/**
 * The error model in one sentence: every failure the library raises is a subclass of {@link AccessError}, and the *first* level of the hierarchy answers the only
 * question a caller universally needs answered - should I retry, or should I propagate?
 *
 * - {@link RecoverableError} means the operation could plausibly succeed if retried or deferred (a throttle window, a timeout, a transient network blip, a caller
 *   abort, a stalled realtime channel). The caller decides the retry policy; the library does not retry user operations on the caller's behalf.
 * - {@link FatalError} means retrying the same call will fail the same way (bad credentials, insufficient privileges, a 4xx/5xx the controller will keep returning,
 *   a protocol violation, a structural bootstrap failure). The caller should surface or propagate it.
 *
 * Consumers branch on the abstract base for policy (`if(err instanceof RecoverableError) { defer(); }`) and on the concrete class for specific handling
 * (`if(err instanceof AccessThrottledError) { waitFor(err.cooldownMs); }`). This is the Node idiom - a class hierarchy with `instanceof` - chosen deliberately over
 * a Result/Either return type, because it composes naturally with `try`/`catch`, `await`, and the platform's own error-cause chaining.
 *
 * Every error chains its underlying `cause` so `resolveErrnoCause` keeps working one hop down the chain (the shape undici raises for connection failures).
 *
 * @category Errors
 */
export abstract class AccessError extends Error {

  // The constructor is protected: AccessError, RecoverableError, and FatalError are abstract classification layers that are never instantiated directly. Only the
  // concrete leaf classes below are constructed. We derive `name` from `new.target` so each thrown error reports its precise class name in stack traces and logs
  // without every subclass having to restate it.
  protected constructor(message: string, options?: { cause?: unknown }) {

    super(message, { cause: options?.cause });

    this.name = new.target.name;
  }
}

/**
 * Abstract base for failures the caller may retry or defer. The library never retries the caller's operation itself - it classifies the failure as recoverable and
 * returns control so the caller can apply its own backoff, escalation, or alternative-path policy.
 *
 * @category Errors
 */
export abstract class RecoverableError extends AccessError {}

/**
 * Abstract base for failures the caller should propagate. Retrying the identical call will reproduce the identical failure, so the correct response is to surface it.
 *
 * @category Errors
 */
export abstract class FatalError extends AccessError {}

/**
 * We are inside the throttle cooldown window. The library has seen enough consecutive failures to back off from the controller, and this request was rejected
 * locally rather than sent. Retry once the cooldown elapses.
 *
 * @category Errors
 */
export class AccessThrottledError extends RecoverableError {

  /** Milliseconds remaining (at throw time) before the cooldown window is expected to clear. */
  readonly cooldownMs: number;

  constructor(message: string, options: { cause?: unknown; cooldownMs: number }) {

    super(message, { cause: options.cause });

    this.cooldownMs = options.cooldownMs;
  }
}

/**
 * Our own request deadline elapsed before the controller responded. Distinct from {@link AccessAbortedError}: this fires when the library's internal
 * `AbortSignal.timeout()` wins the race, whereas an aborted error fires when the caller's signal wins. The transport tells the two apart by checking whether the
 * caller's own `AbortSignal` is already aborted: if it is, the cancellation came from the caller; if not, the library's timeout won.
 *
 * @category Errors
 */
export class AccessTimeoutError extends RecoverableError {

  /** Milliseconds elapsed between dispatch and the deadline firing. */
  readonly elapsedMs: number;

  constructor(message: string, options: { cause?: unknown; elapsedMs: number }) {

    super(message, { cause: options.cause });

    this.elapsedMs = options.elapsedMs;
  }
}

/**
 * A connect, DNS, TLS, or socket-level failure reaching the controller. The originating Node `ErrnoException` is preserved on the `cause` chain (the shape undici
 * raises as `TypeError("fetch failed", { cause: errnoError })`); `code` lifts the errno string out for convenient branching.
 *
 * @category Errors
 */
export class AccessNetworkError extends RecoverableError {

  /** The Node errno string (e.g., `"ECONNREFUSED"`, `"ETIMEDOUT"`), when one could be resolved from the cause chain. */
  readonly code: string | undefined;

  constructor(message: string, options?: { cause?: unknown; code?: string }) {

    super(message, { cause: options?.cause });

    this.code = options?.code ?? resolveErrnoCause(options?.cause)?.code;
  }
}

/**
 * The caller's `AbortSignal` fired. The operation was cancelled by the consumer, not by the library's own deadline. Recoverable in the sense that the caller chose
 * to stop - re-issuing the operation with a fresh signal is valid.
 *
 * @category Errors
 */
export class AccessAbortedError extends RecoverableError {

  constructor(message: string, options?: { cause?: unknown }) {

    super(message, { cause: options?.cause });
  }
}

/**
 * The realtime events channel produced no data for longer than its heartbeat watchdog window - silence beyond `ACCESS_EVENTS_HEARTBEAT_TIMEOUT`, which the
 * controller's own heartbeat cadence should have filled several times over. The underlying channel is presumed dead. As a `RecoverableError`, the error type itself
 * is the signal to recover: the events stream's subscriber (the `ConnectionMonitor`) re-bootstraps and relaunches rather than leaving a consumer reading state that
 * silently stopped updating.
 *
 * @category Errors
 */
export class AccessStallError extends RecoverableError {

  /** Milliseconds of silence observed before the watchdog tripped. */
  readonly silentForMs: number;

  constructor(message: string, options: { cause?: unknown; silentForMs: number }) {

    super(message, { cause: options.cause });

    this.silentForMs = options.silentForMs;
  }
}

/**
 * Authentication failed: invalid credentials, an expired session that could not be renewed, a CSRF-token rotation that did not complete, or an API token the
 * controller refused. Fatal because retrying with the same identity reproduces the failure. {@link AccessAuthError.identity} names which identity was the refused
 * one, so a caller reporting the failure can point at the right one.
 *
 * @category Errors
 */
export class AccessAuthError extends FatalError {

  /**
   * Which identity leg the controller refused - `"credentials"` for the direct login session, `"token"` for the official API's bearer token - or `undefined` when
   * the constructing caller attributed none.
   *
   * `AccessClient.connect()` logs in with credentials before the official read that verifies the token, so a token-tagged failure from a connect holding both
   * identities carries a second fact by implication: the credentials themselves authenticated, because the login they authenticated is what the refused read ran
   * after.
   */
  readonly identity: AccessIdentityLeg | undefined;

  /** The HTTP status that triggered the classification, when the failure originated from a response (typically `401`). */
  readonly statusCode: number | undefined;

  constructor(message: string, options?: { cause?: unknown; identity?: AccessIdentityLeg; statusCode?: number }) {

    super(message, { cause: options?.cause });

    this.identity = options?.identity;
    this.statusCode = options?.statusCode;
  }
}

/**
 * The two identities a client can authenticate with, and which an {@link AccessAuthError} or an {@link AccessAuthorizationError} names as the refused one:
 * `"credentials"` is the account login session that authenticates the direct API, `"token"` the bearer token that authenticates the official API. A client holds
 * either or both - the `ConnectIdentity` union is how a caller supplies them - and each is refused independently, so the leg is what tells a user which of the two
 * to go fix.
 *
 * @category Errors
 */
export type AccessIdentityLeg = "credentials" | "token";

/**
 * The identity authenticated but lacks the privilege the operation requires (typically a `403`; Access reserves many operations for administrator accounts).
 * Fatal because the same identity will keep being refused. {@link AccessAuthorizationError.identity} names which one fell short, so a caller reporting the failure
 * can point at the remedy that applies.
 *
 * @category Errors
 */
export class AccessAuthorizationError extends FatalError {

  /**
   * Which identity leg the controller refused - `"credentials"` when the signed-in account lacks the privilege, typically a role short of administrator, `"token"`
   * when the official API's bearer token was not issued the permission the endpoint requires - or `undefined` when the constructing caller attributed none.
   *
   * The leg is what splits the remedy: grant the account the role, versus reissue the token with the permission. And a `403` implies something a `401` does not,
   * whichever leg it names - that identity authenticated, because a controller refusing an operation on privilege grounds has already accepted who is asking.
   */
  readonly identity: AccessIdentityLeg | undefined;

  /** The HTTP status that triggered the classification, when the failure originated from a response (typically `403`). */
  readonly statusCode: number | undefined;

  constructor(message: string, options?: { cause?: unknown; identity?: AccessIdentityLeg; statusCode?: number }) {

    super(message, { cause: options?.cause });

    this.identity = options?.identity;
    this.statusCode = options?.statusCode;
  }
}

/**
 * The controller returned an error status the library does not classify more specifically (a 4xx other than 401/403, or any 5xx). The status, body, and headers are
 * preserved so the caller can inspect the controller's own explanation.
 *
 * @category Errors
 */
export class AccessRequestError extends FatalError {

  /** The response body, when one was read. Left as `unknown` because it may be parsed JSON, raw text, or absent. */
  readonly body: unknown;

  /** The response headers, when captured. */
  readonly headers: Readonly<Record<string, string>> | undefined;

  /** The HTTP status code the controller returned. */
  readonly statusCode: number;

  constructor(message: string, options: { body?: unknown; cause?: unknown; headers?: Record<string, string>; statusCode: number }) {

    super(message, { cause: options.cause });

    this.body = options.body;
    this.headers = options.headers;
    this.statusCode = options.statusCode;
  }
}

/**
 * A requested operation has no path this client can carry it on. Fatal because it describes what this client is rather than what the controller did: the same call
 * will fail the same way for as long as the client lives, and a fresh connect with different options is what changes the answer.
 *
 * Three things put an operation out of reach. The client may lack the channel the operation needs at all - an attributed unlock has no direct-path expression, so a
 * credential-only client cannot issue one. The routing override may have pinned the client away from the only channel that could carry it. Or the addressed device
 * may sit below the endpoint's firmware floor, leaving an operation that had exactly one capable path with none.
 *
 * The error carries a message and nothing else, deliberately. What a caller needs in order to act is which capabilities this client has, and that is a question
 * about the client rather than about one failed call - so it is answered by the capability map the client publishes, in one place, rather than by fields duplicated
 * onto every refusal. The message names the operation, the capability it wanted, and the mode that could not supply it.
 *
 * @category Errors
 */
export class AccessCapabilityError extends FatalError {

  constructor(message: string, options?: { cause?: unknown }) {

    super(message, { cause: options?.cause });
  }
}

/**
 * A wire- or response-level violation the library cannot make sense of: an event packet that does not match the documented frame structure, a WebSocket message that
 * breaks the spec the library decodes against, an HTTP response body that fails to parse, or a response missing data the operation requires. Fatal because the same
 * bytes will not decode or validate differently on retry - the defect is in the payload, not in reaching it.
 *
 * @category Errors
 */
export class AccessProtocolError extends FatalError {

  constructor(message: string, options?: { cause?: unknown }) {

    super(message, { cause: options?.cause });
  }
}

/**
 * The bootstrap sequence failed while fetching or parsing the controller bootstrap document. `stage` marks which - `"fetch"` when the bootstrap endpoint returns
 * a non-2xx status or the transport fails reaching it, `"parse"` when the body cannot be decoded - so the caller can report the precise point of failure rather than
 * a generic "connect failed." A login or reachability failure is not wrapped here; it propagates as its own typed fatal.
 *
 * @category Errors
 */
export class AccessBootstrapError extends FatalError {

  /** The stage of the connect sequence at which the failure occurred. */
  readonly stage: AccessBootstrapStage;

  constructor(message: string, options: { cause?: unknown; stage: AccessBootstrapStage }) {

    super(message, { cause: options.cause });

    this.stage = options.stage;
  }
}

/**
 * The stages of the `connect()` sequence that carry a {@link AccessBootstrapError} tag. The sequence authenticates, fetches the bootstrap document, parses it, then
 * subscribes to the realtime stream; only the fetch and parse stages are wrapped as a bootstrap error, because a login or reachability failure already propagates as
 * its own typed fatal (`AccessAuthError` / `AccessNetworkError`), and a subscribe failure surfaces as the fault the realtime channel itself raised.
 *
 * @category Errors
 */
export type AccessBootstrapStage = "fetch" | "parse";

/**
 * The official API refused a request. Its result envelope carries a `code` on every response, and a code other than success is the controller declining in its own
 * vocabulary rather than through an HTTP status - the status on such a response is a 2xx, so nothing below this layer can classify it. Fatal because the refusal
 * describes the request rather than the moment: the same call will be refused the same way.
 *
 * The controller's own `msg` is the error's message, carried through the message channel rather than duplicated into a second field, and `code` is the typed
 * vocabulary a caller branches on. Two of those codes are capability signals rather than faults, and are worth naming here because a consumer will want to route
 * them rather than report them:
 *
 * - `CODE_OTHERS_UID_ADOPTED_NOT_SUPPORTED` - the official API does not exist on this controller at all, which is what an Identity Enterprise controller answers.
 * - `CODE_DEVICE_API_NOT_SUPPORTED` - the addressed device sits below the endpoint's firmware floor.
 *
 * Both still throw from the request path, because a request that did not happen is a failure from the caller's point of view whatever the reason. What the typed
 * code buys is that a layer deciding which capabilities a controller has can branch on them with compile-time narrowing rather than by matching strings.
 *
 * @category Errors
 */
export class AccessOfficialApiError extends FatalError {

  /** The official API's own result code, as the controller spelled it. */
  readonly code: AccessOfficialApiCode;

  constructor(message: string, options: { cause?: unknown; code: AccessOfficialApiCode }) {

    super(message, { cause: options.cause });

    this.code = options.code;
  }
}

/**
 * The official API's result-code vocabulary: every code the reference documents, plus any code the controller sends that the documentation does not list.
 *
 * The open-string arm is what keeps the type honest in both directions. A closed union would be a claim that the documented set is the complete set, which no
 * capture in hand establishes - the reference has been caught understating the wire repeatedly - and an undocumented code would then be unrepresentable rather than
 * merely unfamiliar. Widening to `string` alone would give up the other half: the documented members stay listed, so they autocomplete, a `switch` over them
 * narrows, and a typo in one is a compile error rather than a comparison that silently never matches.
 *
 * The success code is deliberately absent. It is the envelope's marker for "this is not an error at all", so it never reaches an error, and listing it here would
 * offer a value that cannot occur.
 *
 * @category Errors
 */
export type AccessOfficialApiCode =
  "CODE_ACCESS_POLICY_HOLIDAY_GROUP_CAN_NOT_DELETE" |
  "CODE_ACCESS_POLICY_HOLIDAY_GROUP_NAME_EXIST" |
  "CODE_ACCESS_POLICY_HOLIDAY_GROUP_NOT_FOUND" |
  "CODE_ACCESS_POLICY_HOLIDAY_NAME_EXIST" |
  "CODE_ACCESS_POLICY_HOLIDAY_NOT_FOUND" |
  "CODE_ACCESS_POLICY_HOLIDAY_TIMEZONE_NOT_FOUND" |
  "CODE_ACCESS_POLICY_SCHEDULE_CAN_NOT_DELETE" |
  "CODE_ACCESS_POLICY_SCHEDULE_NAME_EXIST" |
  "CODE_ACCESS_POLICY_SCHEDULE_NOT_FOUND" |
  "CODE_ACCESS_POLICY_USER_TIMEZONE_NOT_FOUND" |
  "CODE_ACCESS_TOKEN_INVALID" |
  "CODE_AUTH_FAILED" |
  "CODE_CREDS_DISABLE_TRANSFER_UID_USER_NFC" |
  "CODE_CREDS_NFC_CARD_CANNOT_BE_DELETE" |
  "CODE_CREDS_NFC_CARD_INVALID" |
  "CODE_CREDS_NFC_CARD_IS_PROVISION" |
  "CODE_CREDS_NFC_CARD_PROVISION_FAILED" |
  "CODE_CREDS_NFC_HAS_BIND_USER" |
  "CODE_CREDS_NFC_READ_POLL_TOKEN_EMPTY" |
  "CODE_CREDS_NFC_READ_SESSION_NOT_FOUND" |
  "CODE_CREDS_PIN_CODE_CREDS_ALREADY_EXIST" |
  "CODE_CREDS_PIN_CODE_CREDS_LENGTH_INVALID" |
  "CODE_DEVICE_API_NOT_SUPPORTED" |
  "CODE_DEVICE_DEVICE_BUSY" |
  "CODE_DEVICE_DEVICE_NOT_FOUND" |
  "CODE_DEVICE_DEVICE_OFFLINE" |
  "CODE_DEVICE_DEVICE_VERSION_NOT_FOUND" |
  "CODE_DEVICE_DEVICE_VERSION_TOO_OLD" |
  "CODE_DEVICE_WEBHOOK_ENDPOINT_DUPLICATED" |
  "CODE_HOLIDAY_GROUP_CAN_NOT_DELETE" |
  "CODE_HOLIDAY_GROUP_CAN_NOT_EDIT" |
  "CODE_NOT_EXISTS" |
  "CODE_OPERATION_FORBIDDEN" |
  "CODE_OTHERS_UID_ADOPTED_NOT_SUPPORTED" |
  "CODE_PARAMS_INVALID" |
  "CODE_RESOURCE_NOT_FOUND" |
  "CODE_SPACE_DEVICE_BOUND_LOCATION_NOT_FOUND" |
  "CODE_SYSTEM_ERROR" |
  "CODE_UNAUTHORIZED" |
  "CODE_USER_ACCOUNT_NOT_EXIST" |
  "CODE_USER_CSV_IMPORT_INCOMPLETE_PROP" |
  "CODE_USER_EMAIL_ERROR" |
  "CODE_USER_NAME_DUPLICATED" |
  "CODE_USER_WORKER_NOT_EXISTS" |

  // The open arm. Intersecting with the empty object type is what preserves the literals above: a bare `| string` would absorb them and collapse both the
  // autocomplete and the narrowing, where this keeps them as distinct members of the union while still admitting any other string.
  (string & {});

/**
 * Compile-time exhaustiveness assertion for a closed discriminated union. Pass the value from a `default` branch - any point the type system has narrowed to `never` -
 * and adding an unhandled variant to the union becomes a *compile* error at this call site. At runtime, reachable only when untyped code smuggles in an unmodeled
 * variant, it throws an {@link AccessProtocolError} rather than silently absorbing the value, surfacing the defect loudly. This is the single exhaustiveness primitive
 * the library shares, so there is one guard rather than one re-implemented per module.
 *
 * @param value - The value the compiler has narrowed to `never`.
 *
 * @returns Never returns - always throws.
 *
 * @throws {@link AccessProtocolError} always, naming the unhandled variant's tag.
 *
 * @category Errors
 */
export function assertNever(value: never): never {

  // `value` is statically `never`, so we read its runtime shape defensively: an object variant surfaces its `kind` tag, anything else surfaces its string form.
  const variant = value as unknown;
  const detail = ((typeof variant === "object") && (variant !== null) && ("kind" in variant)) ? String(variant.kind) : String(variant);

  throw new AccessProtocolError("Encountered an unhandled variant in an exhaustive switch: " + detail + ".");
}

/**
 * Whether a WebSocket error is one of the expected-disconnect shapes, so its handler can suppress error-level logging for it rather than reporting a fault the
 * consumer can do nothing about. Two shapes qualify:
 *
 * 1. A `TypeError`, which is what undici raises from its own internal WebSocket teardown when the socket closes mid-frame during a disconnection.
 * 2. An `ETIMEDOUT` errno on the cause chain - the slow-controller path. The realtime events stream runs its own silence watchdog against
 *    {@link AccessStallError}, which reports prolonged silence as its own typed signal, so logging this socket-level errno at error level as well would be
 *    duplicate noise for one condition.
 *
 * Screening in one predicate rather than at the handler means a future addition (`EPIPE`, `ECONNRESET`, and the like) lands in a single place.
 *
 * @param error - The error value to classify. Typed `unknown` because a WebSocket `ErrorEvent.error` is untyped at the contract level.
 *
 * @returns `true` when the error matches an expected-disconnect shape and the call site should suppress its log; `false` to log normally.
 *
 * @category Utilities
 */
export function isExpectedWsDisconnect(error: unknown): boolean {

  return (error instanceof TypeError) || (resolveErrnoCause(error)?.code === "ETIMEDOUT");
}

/**
 * Safely resolve an unknown error to a Node `ErrnoException` shape.
 *
 * Two error shapes are recognized:
 *
 * 1. An `Error` whose `cause` chain wraps a Node `ErrnoException`. Undici raises this shape from upstream connection errors (DNS, TCP, TLS), where the surface
 *    error is the generic `TypeError("fetch failed")` and the actual errno data lives one hop down the cause chain.
 * 2. A bare `ErrnoException`. Filesystem reads, stream errors, and direct socket events surface this way - the error object itself carries `.code` and `.message`.
 *
 * Both shapes are validated to require `code` as a string before returning, guarding against the (rare but legal) case where an Error has a `code` property of a
 * non-string type. A non-string `code` would otherwise satisfy a downstream `code === "ECONNREFUSED"` comparison only by accident of `===` semantics.
 *
 * Anything outside these two shapes (locally thrown TypeErrors with no cause, custom errors without `code`, non-Error throws) returns `undefined`, which a caller
 * reads as "this error carries no errno to branch on" rather than as a failure to inspect it.
 *
 * @param error - The error value to inspect. Typed `unknown` because catch bindings and event handlers receive untyped values.
 *
 * @returns The narrowed `NodeJS.ErrnoException` if the error matches either recognized shape, or `undefined` for unknown shapes.
 *
 * @category Utilities
 */
export function resolveErrnoCause(error: unknown): NodeJS.ErrnoException | undefined {

  // Shape 1: an Error wrapping a Node ErrnoException through the standard `cause` chain. Matches Undici's TypeError("fetch failed", { cause: errnoError }) idiom.
  if((error instanceof Error) && (error.cause instanceof Error) && ("code" in error.cause) && (typeof (error.cause as NodeJS.ErrnoException).code === "string")) {

    return error.cause as NodeJS.ErrnoException;
  }

  // Shape 2: a bare ErrnoException, as Node delivers from filesystem, stream, and socket APIs.
  if((error instanceof Error) && ("code" in error) && (typeof (error as NodeJS.ErrnoException).code === "string")) {

    return error as NodeJS.ErrnoException;
  }

  return undefined;
}

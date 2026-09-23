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
 * Our own request deadline elapsed before the controller responded. Distinct from {@link AccessAbortedError}: this fires when the library's own request deadline wins the
 * race, whereas an aborted error fires when the caller's signal wins. The transport tells the two apart by the identity of the reason the failure carries - the reason of
 * its own deadline signal names a timeout, and the reason of the caller's signal names a cancellation - so the class states which signal fired first rather than which
 * one happens to be aborted by the time the failure is classified.
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
 * A connect, DNS, TLS, or socket-level failure reaching the controller. The originating Node `ErrnoException` is preserved on the `cause` chain (the shape undici raises
 * as `TypeError("fetch failed", { cause: errnoError })`); `code` lifts the errno string out for convenient branching. The transport reports two interruptions through
 * this class as well: a pool reset under the request, and a connection attempt cut for another request's cancellation or deadline.
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

/* The sentence an {@link AccessCertificateError} carries, composed here from the leg, the address, and what the platform said about the certificate. Every site
 * that raises the class wants the same words, so the composition lives in one place rather than at any of them, and a reader who wants to know exactly what a
 * user is told reads this function.
 *
 * The reason clause is the platform's own message verbatim, because the platform owns that text: a hand-kept map from code to prose would be a second source of
 * truth, and it would drift from Node's the moment the verifier's wording moved. A cause the errno resolution cannot read carries neither a reason nor a code,
 * and the sentence simply states the refusal - which is what a caller constructing this class outside the transport sites still gets.
 */
function certificateFailureText(options: { cause: unknown; host: string; identity: AccessIdentityLeg }): string {

  const errno = resolveErrnoCause(options.cause);
  const code = errno?.code ?? "";
  const listener = (options.identity === "token") ? "The UniFi Access developer API at " : "The UniFi console at ";
  const reason = errno?.message.trim() ?? "";
  const remedy = (options.identity === "token") ? " The developer API presents its own certificate, separate from the console's." : "";

  return listener + options.host + " presented a certificate that could not be verified" + ((reason.length > 0) ? (": " + reason) : "") +
    ((code.length > 0) ? (" (" + code + ")") : "") + "." + remedy;
}

/**
 * A listener presented a certificate the platform's verification refused. The request path and the notification socket both raise it, so a caller reads one class
 * whichever channel met the refusal, and the sentence names the listener that presented the certificate, the address it was dialed at, and the verifier's own
 * reason.
 *
 * Recoverable, and deliberately so: an operator who installs a certificate the verifier accepts fixes this while the process runs, so the connection monitor
 * keeps trying on its own cadence and finds the listener answering rather than stopping on a fault it would never retry. Subclassing {@link AccessNetworkError}
 * is what keeps that true without any policy being restated - every reading that treats a reachability failure as recoverable treats this one the same way, and
 * a caller that wants the certificate case in particular branches on this class.
 *
 * @category Errors
 */
export class AccessCertificateError extends AccessNetworkError {

  /**
   * The address the listener was dialed at, exactly as the transport or the stream dialed it: the bare host for the console, and `host:port` for the developer
   * API, which answers on a port of its own.
   */
  readonly host: string;

  /**
   * Which listener presented the certificate, named by the identity that reaches it - `"credentials"` is the UniFi console, `"token"` is the Access developer
   * API. The leg names the listener here because each identity reaches exactly one of them, so nothing further has to be threaded through the transports to say
   * which certificate a user is being told about.
   *
   * The remedy follows from the leg. A certificate installed on the console never reaches the developer API, which presents one of its own, so a token identity
   * is fixed by a certificate installed on the developer API itself - {@link OfficialApiServer.uploadCertificate} is the surface that installs one.
   */
  readonly identity: AccessIdentityLeg;

  constructor(options: { cause: unknown; host: string; identity: AccessIdentityLeg }) {

    super(certificateFailureText(options), { cause: options.cause });

    this.host = options.host;
    this.identity = options.identity;
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
 * The identities a client can authenticate with, and which an {@link AccessAuthError} or an {@link AccessAuthorizationError}
 * names as the refused one: `"credentials"` is the account login session that authenticates the direct API, `"token"` the
 * bearer token that authenticates the official API. A client holds either or both - the `ConnectIdentity` union is how a
 * caller supplies them - and each is refused independently, so the leg is what tells a user which one to go fix.
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
 * What can put an operation out of reach: The client may lack the channel the operation needs at all - an attributed unlock has no direct-path
 * expression, so a credential-only client cannot issue one. The routing override may have held the client away from the only channel that could carry
 * it. Or the addressed device may sit below the endpoint's firmware floor, leaving an operation that had exactly one capable path with none.
 *
 * The error carries a message and nothing else, deliberately. What a caller needs in order to act is which capabilities this client has, and that is a question
 * about the client rather than about one failed call - so it is answered by the capability map the client publishes, in one place, rather than by fields duplicated
 * onto every refusal. The message names the operation, the door or device it addressed, the capability it wanted, and the mode that could not supply it.
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
 * The bootstrap sequence failed while fetching, parsing, or applying the controller bootstrap documents. `stage` marks which - `"fetch"` when the bootstrap endpoint
 * returns a non-2xx status or the transport fails reaching it, `"parse"` when the body cannot be decoded, `"apply"` when a decoded document cannot be folded into the
 * state model - so the caller can report the precise point of failure rather than a generic "connect failed." A login or reachability failure is not wrapped here; it
 * propagates as its own typed fatal.
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
 * The stages of the `connect()` sequence that carry a {@link AccessBootstrapError} tag. The sequence authenticates, fetches the bootstrap documents, parses them,
 * applies them to the state model, then subscribes to the realtime stream; only the fetch, parse, and apply stages are wrapped as a bootstrap error, because a login
 * or reachability failure already propagates as its own typed fatal (`AccessAuthError` / `AccessNetworkError`), and a subscribe failure surfaces as the fault the
 * realtime channel itself raised. The apply stage is distinct from parse because it points at a different fix: a body that will not decode is a controller or
 * transport fault, while a decoded document the state model cannot fold is a wire shape the library does not model or a fault in the reducer itself.
 *
 * @category Errors
 */
export type AccessBootstrapStage = "apply" | "fetch" | "parse";

/**
 * The controller refused a request inside its result envelope - on the official developer API and on the Access application's own endpoints alike, which write one
 * envelope between them. The envelope carries a `code` on every response, and a code other than success is the controller declining in its own vocabulary rather
 * than through an HTTP status: the status on such a response is a 2xx, so nothing below this layer can classify it. Fatal because the refusal describes the request
 * rather than the moment: the same call will be refused the same way.
 *
 * The controller's own `msg` is the error's message, carried through the message channel rather than duplicated into a second field, and `code` is the typed vocabulary a
 * caller branches on. Some of those codes are capability signals rather than faults, worth naming here because a consumer will want to route them rather than report
 * them, and the official API answers each of them:
 *
 * - `CODE_OTHERS_UID_ADOPTED_NOT_SUPPORTED` - the official API does not exist on this controller at all, which is what an Identity Enterprise controller answers.
 * - `CODE_DEVICE_API_NOT_SUPPORTED` - the addressed device sits below the endpoint's firmware floor.
 *
 * Each still throws from the request path, because a request that did not happen is a failure from the caller's point of view whatever the reason. What the typed code
 * buys is that a layer deciding which capabilities a controller has can branch on them with compile-time narrowing rather than by matching strings.
 *
 * @category Errors
 */
export class AccessApiError extends FatalError {

  /** The official API's own result code, as the controller spelled it. */
  readonly code: AccessApiCode;

  /** The controller's own diagnostic text, trimmed of the whitespace the wire pads it with and otherwise unparsed, when the refusal sent one beside its message.
   * Undefined when it sent none, or sent nothing but whitespace.
   */
  readonly detail: string | undefined;

  constructor(message: string, options: { cause?: unknown; code: AccessApiCode; detail?: string }) {

    super(message, { cause: options.cause });

    this.code = options.code;
    this.detail = options.detail;
  }
}

/**
 * The controller's result-code vocabulary, spoken on both of its surfaces: every code the vendor's official reference documents, plus any code the controller sends
 * that the documentation does not list. The reference is where the vocabulary is written down, and the Access application's own endpoints answer out of it too -
 * the direct door-command refusal captured on 2026-09-16 came back as `CODE_SYSTEM_ERROR`, a listed member.
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
export type AccessApiCode =
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

/* How far below the value that was caught the rendering descends. Real chains are short - a client wraps a transport failure, the transport wraps a socket
 * failure - and the bound is what makes the descent terminate at all: a chain that refers back to itself simply exhausts it, so no cycle bookkeeping has to
 * exist. Counted in descents, so the value handed in is depth zero and this many links below it are still read.
 */
const CAUSE_CHAIN_DEPTH = 8;

/**
 * Render an arbitrary thrown value as clean text, carrying every further diagnosis its `cause` chain holds. An `Error` surfaces its `message`; anything else is
 * coerced through `String(...)`.
 *
 * A wrapped failure presents its diagnosis below the sentence that was caught: an {@link AccessBootstrapError} wraps the {@link AccessApiError} carrying the
 * controller's own words, so a reader that takes the top message alone drops exactly the part an operator needs. This follows the `cause` chain down and appends
 * each further message after a colon. The following rules decide what it appends:
 *
 * 1. Only an `Error` link contributes text. A cause that is a plain object is structured context for code to read - a code, a status, a response body - so
 *    rendering it would print `[object Object]` at best and a secret at worst. Such a link contributes nothing and the descent continues below it, which is what
 *    lets an error sitting under one still be rendered.
 * 2. A link whose words the text so far already carries contributes nothing. A wrapper that builds its own message around its cause therefore names that cause
 *    once rather than twice, and a rendering nested inside another stays stable.
 * 3. One terminal period is removed from every message taken, the top one included, so the text carries none of its own and the sentence that embeds it supplies
 *    the period.
 * 4. The descent is bounded, which is also what ends a chain that refers back to itself: such a chain repeats messages the text already holds, so rule 2 appends
 *    nothing and the bound stops the walk.
 *
 * The library takes no runtime dependency on the shared plugin utilities, so the rule their formatter states is implemented here as well. A differential test in
 * this package's suite feeds a table of error shapes through both and asserts equal output, which is what keeps the two of them one rule.
 *
 * @param error - The thrown value. Typed `unknown` because catch bindings, event handlers, and rejected promises all deliver untyped values.
 *
 * @returns The rendered text, carrying each further diagnosis the cause chain held and no terminal period of its own.
 *
 * @category Utilities
 */
export function formatErrorChain(error: unknown): string {

  let rendered = ((error instanceof Error) ? error.message : String(error)).replace(/\.$/, "");
  let link: unknown = error;

  /* Each link below the one that was caught may hold the diagnosis the wrapper's own sentence lacks. An empty message is contained in every string, so it falls
   * out of the containment rule with no case of its own.
   */
  for(let depth = 0; depth < CAUSE_CHAIN_DEPTH; depth++) {

    // A value that is not an object holds nothing beneath it, and neither does one carrying no `cause` key at all, so either ends the descent. A key present
    // with the value `undefined` is a link like any other: the descent takes it, finds no error to render, and ends on the following pass.
    if((typeof link !== "object") || (link === null) || !("cause" in link)) {

      break;
    }

    link = link.cause;

    if(!(link instanceof Error)) {

      continue;
    }

    const text = link.message.replace(/\.$/, "");

    // The containment check reads everything rendered so far rather than the top message alone, so a link whose words an earlier link already appended is not
    // repeated either.
    if(!rendered.includes(text)) {

      rendered += ": " + text;
    }
  }

  return rendered;
}

/* The verdicts the platform's certificate verification can return, each spelled as Node spells it on the error's `code`: the OpenSSL X509 verification family Node
 * maps by name, together with the hostname check Node runs itself.
 *
 * Neighbors from that same table are left out on purpose. `OUT_OF_MEM` is the verifier running out of room rather than a verdict about the certificate, so a
 * failure carrying it tells a user nothing that installing a certificate would fix. `CERT_DIR`, `CERT_FILE`, `CERT_STORE`, `CERT_ALTNAME_FORMAT`,
 * `UNABLE_TO_CHECK_GENERATOR`, and `UNABLE_TO_PIPE` are not verification verdicts at all - they are store locations and unrelated failures that share the
 * library's naming.
 */
const CERTIFICATE_VERIFICATION_CODES: ReadonlySet<string> = new Set([ "CERT_CHAIN_TOO_LONG", "CERT_HAS_EXPIRED", "CERT_NOT_YET_VALID", "CERT_REJECTED",
  "CERT_REVOKED", "CERT_SIGNATURE_FAILURE", "CERT_UNTRUSTED", "CRL_HAS_EXPIRED", "CRL_NOT_YET_VALID", "CRL_SIGNATURE_FAILURE", "DEPTH_ZERO_SELF_SIGNED_CERT",
  "ERR_TLS_CERT_ALTNAME_INVALID", "ERROR_IN_CERT_NOT_AFTER_FIELD", "ERROR_IN_CERT_NOT_BEFORE_FIELD", "ERROR_IN_CRL_LAST_UPDATE_FIELD",
  "ERROR_IN_CRL_NEXT_UPDATE_FIELD", "HOSTNAME_MISMATCH", "INVALID_CA", "INVALID_PURPOSE", "PATH_LENGTH_EXCEEDED", "SELF_SIGNED_CERT_IN_CHAIN",
  "UNABLE_TO_DECODE_ISSUER_PUBLIC_KEY", "UNABLE_TO_DECRYPT_CERT_SIGNATURE", "UNABLE_TO_DECRYPT_CRL_SIGNATURE", "UNABLE_TO_GET_CRL",
  "UNABLE_TO_GET_ISSUER_CERT", "UNABLE_TO_GET_ISSUER_CERT_LOCALLY", "UNABLE_TO_VERIFY_LEAF_SIGNATURE" ]);

/**
 * Whether a failure is the platform's certificate verification refusing the peer. The verdict is read from the errno the cause chain carries, which is where both
 * channels put it: the request path wraps the platform's error as undici hands it over, and the notification socket reads the dial's own error from the connector
 * that vended the socket.
 *
 * What this answers is a verdict about a certificate and nothing else. A connection that never reached a handshake carries a different errno and answers false,
 * which is what keeps the generic network sentence serving every failure that is not about a certificate.
 *
 * It is deliberately not published from the library's public surface. Its consumers are the transport sites that raise {@link AccessCertificateError} from it,
 * and a consumer branches on that class - which carries the listener and the address the bare question could not.
 *
 * @param error - The error value to classify. Typed `unknown` because catch bindings, socket callbacks, and rejected promises all deliver untyped values.
 *
 * @returns `true` when the platform's certificate verification refused the peer; `false` for every other failure, and for an error carrying no errno at all.
 *
 * @category Utilities
 */
export function isCertificateVerificationFailure(error: unknown): boolean {

  const code = resolveErrnoCause(error)?.code;

  return (code !== undefined) && CERTIFICATE_VERIFICATION_CODES.has(code);
}

/**
 * Whether a WebSocket error is one of the expected-disconnect shapes, so its handler can suppress error-level logging for it rather than reporting a fault the
 * consumer can do nothing about. The following shapes qualify:
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
 * Whether a failure is the controller refusing an operation on privilege grounds - the identity authenticated, and was told it may not do this. A refusal is spelled
 * differently depending on which of the controller's surfaces answered it, and this reads every spelling the library produces for one.
 *
 * The following spellings qualify:
 *
 * 1. An {@link AccessAuthorizationError}, the transport's classification of a refused status.
 * 2. An {@link AccessApiError} whose `code` is `CODE_OPERATION_FORBIDDEN`, the controller's own refusal answered inside a successful response.
 *
 * What is read is the error handed in, never its `cause` chain, so a wrapper around a refusal answers false. The library's own case is a refused bootstrap document,
 * which arrives as an {@link AccessBootstrapError}, so a caller holding one hands that wrapper's `cause` to this rather than the wrapper itself. A failed authentication
 * is a different fault with a different remedy and answers false...a privilege refusal is the controller having already accepted who is asking.
 *
 * Saying this once is what keeps a consumer's reading from drifting from the library's, and it is the one place a further spelling lands if the controller grows
 * one. The predicate type names the code deliberately rather than answering with the bare class: a type guard narrows the false branch as well, and an
 * `AccessApiError` carrying any other code answers false, so the bare class there would tell the compiler that such an error cannot exist where it plainly can.
 * Naming the code keeps the class in the false branch for the caller to read, and hands the true branch the narrowed members it reports the refusal from.
 *
 * @param error - The error value to classify. Typed `unknown` because catch bindings, event handlers, and rejected promises all deliver untyped values.
 *
 * @returns `true` when the failure is a privilege refusal, narrowed to the arm that carries the caller's diagnosis; `false` for anything else.
 *
 * @category Utilities
 */
export function isPrivilegeRefusal(error: unknown): error is AccessAuthorizationError | (AccessApiError & { readonly code: "CODE_OPERATION_FORBIDDEN" }) {

  return (error instanceof AccessAuthorizationError) || ((error instanceof AccessApiError) && (error.code === "CODE_OPERATION_FORBIDDEN"));
}

/**
 * Safely resolve an unknown error to a Node `ErrnoException` shape.
 *
 * The following error shapes are recognized:
 *
 * 1. An `Error` whose `cause` chain wraps a Node `ErrnoException`. Undici raises this shape from upstream connection errors (DNS, TCP, TLS), where the surface
 *    error is the generic `TypeError("fetch failed")` and the actual errno data lives one hop down the cause chain.
 * 2. A bare `ErrnoException`. Filesystem reads, stream errors, and direct socket events surface this way - the error object itself carries `.code` and `.message`.
 *
 * Both shapes are validated to require `code` as a string before returning, guarding against the (rare but legal) case where an Error has a `code` property of a
 * non-string type. A non-string `code` would otherwise satisfy a downstream `code === "ECONNREFUSED"` comparison only by accident of `===` semantics.
 *
 * Anything outside these shapes (locally thrown TypeErrors with no cause, custom errors without `code`, non-Error throws) returns `undefined`, which a caller
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

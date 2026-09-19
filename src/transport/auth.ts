/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * auth.ts: The authentication session for the UniFi Access library - the UniFi OS credential handshake, CSRF rotation, the 401-triggered relogin, and the
 * administrative-privilege check.
 */
import { AccessAbortedError, AccessAuthError } from "../errors.ts";
import type { AccessResponse, Transport } from "./http.ts";
import type { AccessAuthReloginPayload } from "../diagnostics.ts";
import type { AccessLogging } from "../logging.ts";
import type { Nullable } from "../types/index.ts";
import { channels } from "../diagnostics.ts";
import { noopLog } from "../logging.ts";
import { responseOk } from "./http.ts";
import { singleFlight } from "../single-flight.ts";

// The grant string that marks an account as able to manage Access devices. The identity layer issues fine-grained, colon-delimited grants rather than a role flag,
// so the ability to edit device settings is what stands in for administrative privilege.
const ADMIN_SCOPE = "edit:access.device";

/**
 * The credentials for an Access controller. `host` is the controller address without a scheme (for example `"192.168.1.1"`); the session derives the UniFi OS login
 * URL from it. Every member is readonly because the session retains this shape for the life of the session and relogin re-reads it.
 *
 * @category Transport
 */
export interface AccessCredentials {

  readonly host: string;
  readonly password: string;
  readonly username: string;
}

/**
 * Construction options for {@link AuthSession}. The session performs its handshake through the supplied {@link Transport}, which is the only dependency it holds -
 * the import points downward (`AuthSession` -> `Transport`), never the reverse.
 *
 * @category Transport
 */
export interface AuthSessionOptions {

  log?: AccessLogging;
  transport: Transport;
}

/**
 * Owns the authenticated session against an Access controller: the UniFi OS credential handshake, the session cookie, the CSRF token and its rotation, the relogin
 * used when a request comes back 401, and whether the account holds administrative privilege.
 *
 * The session composes {@link Transport} - it sends its handshake requests through the transport (so login traffic is pooled, timed, throttle-aware, and observable
 * like any other request) using `authRetry: false` so a handshake 401 cannot recurse back into relogin. It exposes two functions the transport wires in at the
 * composition root: {@link AuthSession.authHeaders} (the cookie and CSRF headers stamped onto every authenticated request) and {@link AuthSession.reauthenticate}
 * (the `onUnauthorized` hook). Because the transport invokes those through injected function references, `Transport` never imports `AuthSession`: the dependency
 * flows in one direction only.
 *
 * State is invalid-by-default: {@link AuthSession.isAuthenticated} is true only once both a cookie and a CSRF token are in hand. There is no `Nullable` return on
 * the login path - {@link AuthSession.login} resolves on success and throws {@link AccessAuthError} on credential failure.
 *
 * Two session-identity rules run throughout, because both relogin and the privilege check span awaits during which the caller may log out or log in afresh. The
 * session's identity is the retained credentials object, and every write of session state that lands after an await first confirms that object is still the one
 * it started from - so a handshake that completes after a logout cannot resurrect the session, and a privilege check that resolves after one cannot describe a
 * session that is gone. The CSRF token is transport-level rather than session state, so the login path's fallback fetch stores one without that confirmation.
 *
 * @category Transport
 */
export class AuthSession {

  readonly #log: AccessLogging;
  readonly #transport: Transport;

  // The session is defined entirely by these three: the bare cookie token, the current CSRF token, and the credentials we logged in with (retained so the relogin
  // hook can re-run the handshake without the caller re-supplying them). All three are null until a successful login.
  #cookie: string | null = null;
  #credentials: AccessCredentials | null = null;
  #csrfToken: string | null = null;

  /* Whether the account holds administrative privilege, as three states rather than two. `null` means never determined - either no check has run yet, or one ran
   * and the answer was invalidated - which is a different thing from having checked and found the account unprivileged. A consumer that needs to know whether it
   * may attempt a privileged operation can tell "no" from "do not know yet" and decide accordingly.
   */
  #isAdmin: Nullable<boolean> = null;

  /* The coalescing gates, each built once over the single run it guards. Every overlapping caller shares that run and the gate retains nothing between runs, which
   * is what keeps two handshakes from writing credentials against each other and two privilege checks from settling out of order.
   */
  readonly #reauthenticateGate = singleFlight((): Promise<boolean> => this.#reauthenticateOnce());
  readonly #refreshAdminStatusGate = singleFlight((opts: { signal?: AbortSignal }): Promise<Nullable<boolean>> => this.#refreshAdminStatusOnce(opts));

  constructor(options: AuthSessionOptions) {

    this.#log = options.log ?? noopLog;
    this.#transport = options.transport;
  }

  /**
   * Whether the session currently holds a complete set of credentials (both a session cookie and a CSRF token). Synchronous - safe on a hot path.
   */
  get isAuthenticated(): boolean {

    return (this.#cookie !== null) && (this.#csrfToken !== null);
  }

  /**
   * Whether the authenticated account holds administrative privilege, or `null` when that has never been determined. Written only by
   * {@link AuthSession.refreshAdminStatus}, and returned to `null` by {@link AuthSession.logout} and by a 401 the relogin could not recover, so a privilege the
   * session no longer demonstrably holds is never reported as still held.
   */
  get isAdmin(): Nullable<boolean> {

    return this.#isAdmin;
  }

  /**
   * The bare session cookie token, or `null` before login completes. The realtime notification stream reads this for its upgrade request, which carries the cookie
   * and nothing else.
   */
  get sessionCookie(): Nullable<string> {

    return this.#cookie;
  }

  /**
   * The headers to stamp on every authenticated request: the session cookie and the CSRF token, each included only when held. Wired into the transport as its
   * `getAuthHeaders` hook.
   *
   * @returns The auth headers, possibly empty before login completes.
   */
  authHeaders(): Record<string, string> {

    const headers: Record<string, string> = {};

    if(this.#cookie !== null) {

      headers["cookie"] = this.#cookie;
    }

    if(this.#csrfToken !== null) {

      headers["x-csrf-token"] = this.#csrfToken;
    }

    return headers;
  }

  /**
   * Authenticate with the controller. Retains the credentials for later relogin, performs the handshake, and on failure throws.
   *
   * @param credentials - The controller address and account credentials.
   * @param opts        - Optional abort signal threaded through the handshake requests.
   *
   * @throws {@link AccessAuthError} if the handshake does not yield a cookie and CSRF token.
   */
  async login(credentials: AccessCredentials, opts: { signal?: AbortSignal } = {}): Promise<void> {

    /* Retain a copy rather than the caller's own object. The relogin hook re-reads these long after login returns, and a caller that clears its password string
     * once it believes login is done - a reasonable thing to do with a secret - would otherwise hollow out the state relogin depends on.
     *
     * The handshake is handed that same copy rather than reaching back for the field, so the identity comparison it makes on the way back compares against the
     * object this session stored.
     */
    const session = { ...credentials };

    this.#credentials = session;

    if(!(await this.#handshake(session, opts.signal))) {

      throw new AccessAuthError("Unable to authenticate with the UniFi Access controller. Please check the configured address, username, and password.",
        { identity: "credentials" });
    }

    this.#log.info("Authenticated with the UniFi Access controller.", { host: credentials.host, username: credentials.username });
  }

  /**
   * End the session and forget the credentials. After logout a fresh {@link AuthSession.login} is required; the relogin hook will not re-authenticate (there are no
   * credentials to use), which is the correct response to an explicit logout. The privilege verdict returns to undetermined along with the session that earned it.
   */
  logout(): void {

    this.#cookie = null;
    this.#credentials = null;
    this.#csrfToken = null;
    this.#isAdmin = null;
  }

  /**
   * Re-run the handshake with the retained credentials. Wired into the transport as its `onUnauthorized` hook: the transport invokes it when a request returns 401,
   * then retries the original request once if this resolves `true`.
   *
   * Concurrent calls coalesce into one handshake through the gate this delegates to. Two requests in flight through one transport can both come back 401 and both
   * invoke this hook, and running two handshakes against each other would leave the cookie and CSRF token written by whichever finished last, which need not be the
   * one whose token the controller considers current.
   *
   * @returns `true` if re-authentication succeeded, `false` if there are no retained credentials, the handshake failed, or it could not be attempted.
   */
  async reauthenticate(): Promise<boolean> {

    return this.#reauthenticateGate();
  }

  /**
   * Ask the controller whether this account holds administrative privilege, and record the answer.
   *
   * Concurrent calls coalesce into one request through the gate this delegates to. The layer that owns connection policy re-checks on each reconnect cycle, and a
   * controller that is flapping produces overlapping cycles; coalescing means the checks cannot resolve out of order and overwrite each other with staler answers.
   *
   * The check never disrupts its caller. A transport failure leaves the previous verdict in place and reports at debug, because a privilege check that could not
   * reach the controller has learned nothing - it has not learned that the account is unprivileged. The one exception is the caller's own cancellation, which is
   * returned to it as the abort it asked for.
   *
   * @param opts - Optional abort signal for the request.
   *
   * @returns The privilege verdict after the check, which is the previous value whenever the check could not establish a new one.
   *
   * @throws {@link AccessAbortedError} if the caller's signal aborts the request.
   */
  async refreshAdminStatus(opts: { signal?: AbortSignal } = {}): Promise<Nullable<boolean>> {

    return this.#refreshAdminStatusGate(opts);
  }

  // One relogin run, shared by every caller that arrived while it was in flight. It resolves rather than rejects on every path: the transport's hook contract is a
  // boolean, and the request that tripped the 401 belongs to some unrelated caller which must receive its own 401-derived result rather than an error raised by a
  // recovery it never asked for. A handshake can genuinely throw here - the breaker may be open, or the network may be failing, which is often exactly the weather
  // that produced the 401 - so that throw settles this false and is reported on the channel like any other unsuccessful relogin.
  async #reauthenticateOnce(): Promise<boolean> {

    // Read the credentials once, before any await, so the outcome is attributed to the session that was live when the relogin began rather than to whatever a
    // concurrent logout or fresh login has left behind by the time it finishes.
    const credentials = this.#credentials;
    let success = false;

    // Re-run the handshake only when we still hold credentials - an explicit logout clears them, and there is then nothing to recover. Drop the stale session
    // cookie first so the handshake re-establishes it from scratch; the retained CSRF token is reused as the starting point, since the controller rotates it on a
    // successful login.
    if(credentials !== null) {

      this.#cookie = null;

      try {

        success = await this.#handshake(credentials);
      } catch(error) {

        this.#log.debug("The attempt to re-authenticate with the UniFi Access controller could not be completed.", error);
      }
    }

    /* Publish the relogin outcome. This is the only signal a consumer gets for mid-session recovery, which is otherwise silent - the transport calls this hook on a
     * 401 and the consumer never sees a return value. Gated on subscribers so we build no payload when nobody is listening.
     */
    if(channels.authRelogin.hasSubscribers) {

      const payload: AccessAuthReloginPayload = (credentials !== null) ? { host: credentials.host, success } : { host: null, success: false };

      channels.authRelogin.publish(payload);
    }

    return success;
  }

  // One privilege-check run, shared by every caller that arrived while it was in flight.
  async #refreshAdminStatusOnce(opts: { signal?: AbortSignal }): Promise<Nullable<boolean>> {

    // The session's identity at entry. Every write below is conditioned on it still being current, and without credentials there is no session to describe at all.
    const credentials = this.#credentials;

    if(credentials === null) {

      return this.#isAdmin;
    }

    let response: AccessResponse;

    /* The request goes out under the session's own configured address. A transport is origin-bound - undici retargets any URL dispatched through it to the pool's
     * own origin, so only the path and query here actually reach the wire - and in every supported composition the two addresses are the same value, because the
     * composition root wires one host into both the transport and these credentials.
     */
    try {

      response = await this.#transport.send("https://" + credentials.host + "/api/users/self",
        { method: "GET", ...((opts.signal !== undefined) && { signal: opts.signal }) });
    } catch(error) {

      // A cancellation is the caller's own decision and belongs back with the caller. Every other failure means we did not learn anything, which is not the same as
      // learning the account is unprivileged, so the previous verdict stands.
      if(error instanceof AccessAbortedError) {

        throw error;
      }

      this.#log.debug("Unable to reach the UniFi Access controller to determine administrative privilege.", error);

      return this.#isAdmin;
    }

    /* A 401 that survived the transport's own relogin retry means the session is no longer accepted, so any privilege it previously demonstrated is no longer
     * demonstrated. Clearing to undetermined rather than to false is the honest reading: we did not learn that the account lacks privilege, we lost the ability to
     * ask.
     */
    if(response.statusCode === 401) {

      return this.#commitAdmin(null, credentials);
    }

    // Any other refusal is the controller declining to answer this one request. It says nothing about the account, so the previous verdict stands.
    if(!responseOk(response.statusCode)) {

      return this.#isAdmin;
    }

    let body: unknown;

    // This endpoint answers with the account record itself rather than wrapping it in the envelope the rest of the API uses, so the body is read directly.
    try {

      body = response.json<unknown>();
    } catch(error) {

      this.#log.debug("The UniFi Access controller's account record could not be parsed.", error);

      return this.#isAdmin;
    }

    /* Read the grant list through runtime guards rather than by asserting the account type onto the body. The account type declares the grant list as always
     * present, but no capture in hand confirms that for this endpoint, and a cast would turn an assumption into a claim the compiler then trusts everywhere
     * downstream. Guarding costs two checks and keeps the uncertainty where it belongs.
     */
    if((typeof body !== "object") || (body === null) || Array.isArray(body)) {

      this.#log.debug("The UniFi Access controller's account record was not the object shape the privilege check reads.");

      return this.#isAdmin;
    }

    const scopes = (body as Record<string, unknown>)["scopes"];

    // No grant list at all is the controller reporting an account that holds none, which is a real answer: the account is not an administrator.
    if(scopes === undefined) {

      return this.#commitAdmin(false, credentials);
    }

    // A grant list of some other shape is not an answer we can read. Treating it as an absent list would report a privileged account as unprivileged on the
    // strength of a payload we did not understand, so the previous verdict stands instead.
    if(!Array.isArray(scopes)) {

      this.#log.debug("The UniFi Access controller reported a grant list in a shape the privilege check does not read.");

      return this.#isAdmin;
    }

    return this.#commitAdmin(scopes.includes(ADMIN_SCOPE), credentials);
  }

  // The single site that writes the privilege verdict, so the staleness check cannot be forgotten at one of them. A verdict is committed only while the session it
  // describes is still the current one: a logout or a fresh login landing under the awaits above makes the answer describe a session that no longer exists, and
  // writing it would attribute one session's privileges to another.
  #commitAdmin(value: Nullable<boolean>, credentials: AccessCredentials): Nullable<boolean> {

    if(this.#credentials !== credentials) {

      return this.#isAdmin;
    }

    this.#isAdmin = value;

    return value;
  }

  /* Drop the session cookie after a handshake that did not complete, so a later relogin restarts from a clean slate rather than reusing half-formed state. The
   * credentials are deliberately kept, because a failed handshake is not a reason to forget who we are.
   *
   * The write is conditioned on the session still being the one the handshake started from, for the same reason the success write is: a handshake can settle long
   * after the session it belongs to has been replaced. A fresh login does not wait behind an in-flight relogin, so a relogin that fails afterward would otherwise
   * clear a cookie that belongs to the login that replaced it - wiping a live session on the strength of a failure that was never about it.
   */
  #clearFailedSession(credentials: AccessCredentials): void {

    if(this.#credentials !== credentials) {

      return;
    }

    this.#cookie = null;
  }

  // Run the UniFi OS handshake. Attempt a direct login first; if it fails and we hold no CSRF token, fetch one from the controller root and retry the login once.
  // On success, capture the rotated CSRF token (the controller returns it as X-Updated-CSRF-Token, falling back to X-CSRF-Token) and the bare session cookie.
  // Returns whether a complete session was established. Self-sufficient in its auth headers - it stamps the CSRF token explicitly rather than relying on the
  // transport's getAuthHeaders hook being wired back to this same session.
  async #handshake(credentials: AccessCredentials, signal?: AbortSignal): Promise<boolean> {

    const loginUrl = "https://" + credentials.host + "/api/auth/login";
    const loginBody = JSON.stringify({ password: credentials.password, rememberMe: true, token: "", username: credentials.username });

    let response = await this.#postLogin(loginUrl, loginBody, signal);

    // The controller rejected the login and we have no CSRF token to offer. UniFi OS gates login behind a CSRF check, so fetch a token from the root document
    // and retry the login once with it in hand.
    if(!responseOk(response.statusCode) && (this.#csrfToken === null)) {

      const csrfResponse = await this.#transport.send("https://" + credentials.host, { authRetry: false, method: "GET", ...((signal !== undefined) && { signal }) });

      if(responseOk(csrfResponse.statusCode)) {

        const token = csrfResponse.header("x-csrf-token");

        if(token !== null) {

          this.#csrfToken = token;
          response = await this.#postLogin(loginUrl, loginBody, signal);
        }
      }
    }

    if(!responseOk(response.statusCode)) {

      this.#clearFailedSession(credentials);

      return false;
    }

    const csrfToken = response.header("x-updated-csrf-token") ?? response.header("x-csrf-token");
    const cookie = response.header("set-cookie");

    if((csrfToken !== null) && (cookie !== null)) {

      /* The controller accepted this login, but the session it belongs to may already be gone: a logout while the request was in flight ends the session
       * client-side without the controller ever hearing about it, and the login then succeeds regardless. Writing this session would silently re-arm a session the
       * caller explicitly ended, so a handshake whose credentials are no longer the current ones discards its result instead.
       */
      if(this.#credentials !== credentials) {

        return false;
      }

      // Keep only the token=value pair, stripping the cookie's attributes (Path, Expires, HttpOnly, and the rest) so subsequent requests send the bare value.
      // indexOf plus substring keeps the result unambiguously a string, where split(";")[0] would type as string | undefined under noUncheckedIndexedAccess.
      const semicolonIndex = cookie.indexOf(";");

      this.#cookie = (semicolonIndex === -1) ? cookie : cookie.substring(0, semicolonIndex);
      this.#csrfToken = csrfToken;

      return true;
    }

    // The controller answered but without both halves of a session, which is a failed handshake however successful the status was.
    this.#clearFailedSession(credentials);

    return false;
  }

  // Post the login request, stamping the CSRF token when we hold one. The content type is not set here: the transport stamps it on every request it sends, so
  // repeating it would be a second place that decides what this request declares. authRetry is false so a login 401 surfaces as the response rather than recursing
  // into relogin.
  async #postLogin(loginUrl: string, loginBody: string, signal?: AbortSignal): ReturnType<Transport["send"]> {

    // The CSRF header is spread in only when we hold a token, so an absent token leaves the header structurally absent rather than present-and-undefined. That
    // keeps the header record honest for anything that enumerates or tests membership on it.
    const headers: Record<string, string> = { ...((this.#csrfToken !== null) && { "x-csrf-token": this.#csrfToken }) };

    return this.#transport.send(loginUrl, { authRetry: false, body: loginBody, headers, method: "POST", ...((signal !== undefined) && { signal }) });
  }
}

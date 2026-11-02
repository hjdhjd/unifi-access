/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * auth.ts: The authentication session for the UniFi Access library - the UniFi OS credential handshake, CSRF rotation, the 401-triggered relogin, and the
 * administrative-privilege check.
 */
import { AccessAbortedError, AccessAuthError, readinessOfStatus } from "../errors.ts";
import type { AccessResponse, SendOptions, Transport } from "./http.ts";
import type { AccessAuthReloginPayload } from "../diagnostics.ts";
import type { AccessLogging } from "../logging.ts";
import type { Nullable } from "../types/index.ts";
import { channels } from "../diagnostics.ts";
import { isRecord } from "../json.ts";
import { noopLog } from "../logging.ts";
import { responseOk } from "./http.ts";
import { singleFlight } from "../single-flight.ts";

// The grant string that marks an account as able to manage Access devices. The identity layer issues fine-grained, colon-delimited grants rather than a role flag,
// so the ability to edit device settings is what stands in for administrative privilege.
const ADMIN_SCOPE = "edit:access.device";

/* Read a sign-in answer as a verdict on the credentials. A 4xx is the controller judging the request it was sent, except a status that names the controller's
 * readiness instead - a 429 limiting requests, or a status the transport retries as the answer a controller rebooting or starting a service gives - which judged
 * nothing. A 3xx or a 5xx says nothing about the credentials at all.
 */
function refusedSignIn(statusCode: number): boolean {

  return (statusCode >= 400) && (statusCode <= 499) && (readinessOfStatus(statusCode) === null);
}

/**
 * The credentials for an Access controller. `host` is the controller address exactly as configured, without a scheme (for example `"192.168.1.1"`), and it is what
 * the session names the controller by in the sign-in log and on the relogin channel. The handshake URLs are composed from the transport's own origin instead, so
 * they address the listener the transport dials whatever form the address was configured in. Every member is readonly because the session retains this shape for
 * the life of the session and relogin re-reads it.
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
 * A session-identity rule runs throughout, because both relogin and the privilege check span awaits during which the caller may log out or log in afresh. The
 * session's identity is the retained credentials object, and every write of session state that lands after an await first confirms that object is still the one
 * it started from - so a handshake that completes after a logout cannot resurrect the session, and a privilege check that resolves after one cannot describe a
 * session that is gone. The handshake confirms it once more after reading the controller root, so a session that ended or was replaced while the root was read
 * posts no login at all.
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
  readonly #reauthenticateGate = singleFlight((opts: { probe: boolean }): Promise<boolean> => this.#reauthenticateOnce(opts));
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
   * Whether the authenticated account holds administrative privilege, or `null` when that is undetermined or no session is held. The verdict is the credentials'
   * own: {@link AuthSession.refreshAdminStatus} records it, {@link AuthSession.logout} and a privilege check whose own 401 survived its relogin return it to
   * undetermined, and a failed relogin on any other request keeps it. It is reported only while {@link AuthSession.isAuthenticated} holds, so a session that lost
   * its cookie never reports a privilege it no longer demonstrates, a verdict recorded after that loss included, and the recorded verdict reads again once a relogin
   * re-establishes the session. A relogin drops the cookie before its handshake, so this reads `null` while any relogin is in flight.
   */
  get isAdmin(): Nullable<boolean> {

    return this.isAuthenticated ? this.#isAdmin : null;
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
   * Authenticate with the controller. Retains the credentials for later relogin, performs the handshake - a fresh CSRF token read from the controller root, then one
   * login - and on failure throws.
   *
   * @param credentials - The controller address and account credentials.
   * @param opts        - Optional abort signal threaded through the handshake requests.
   *
   * @throws {@link AccessAuthError} if the controller refuses the sign-in or the handshake does not yield a cookie and CSRF token.
   * @throws {@link AccessRequestError} if the controller root gives a readiness answer, a controller limiting requests or one not ready yet, before any login is
   *   sent, or if the login is answered with a status that is no verdict on the credentials - a controller limiting requests, one not ready yet, a 3xx or a 5xx -
   *   which a reconnecting caller retries again later.
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

    if(!(await this.#handshake(session, opts))) {

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
   * then retries the original request once if this resolves `true`, hands the 401 back if it resolves `false`, and throws whatever this rejects with.
   *
   * Concurrent calls coalesce into one handshake through the gate this delegates to. Two requests in flight through one transport can both come back 401 and both
   * invoke this hook, and running two handshakes against each other would leave the cookie and CSRF token written by whichever finished last, which need not be the
   * one whose token the controller considers current. A call that joins a handshake already in flight shares its fate and its mark.
   *
   * @param opts - Whether the request that met the 401 was the connection-recovery probe. A probe's relogin sends its handshake with the probe's mark, so the
   *   handshake reaches the controller through an open breaker as the probe itself did, and books what the controller answered.
   *
   * @returns `true` if re-authentication succeeded, `false` if there are no retained credentials, the controller refused the sign-in or answered the login with a
   *   2xx that carried no complete session, or the session it belonged to ended or was replaced first.
   *
   * @throws The handshake's own failure, once the relogin's outcome is published: an `AccessRequestError` for an answer that is no verdict on the credentials, a
   *   transport-level `AccessError`, or {@link AccessThrottledError} for a relogin the open breaker refused.
   */
  async reauthenticate(opts: { probe?: boolean } = {}): Promise<boolean> {

    return this.#reauthenticateGate({ probe: opts.probe === true });
  }

  /**
   * Ask the controller whether this account holds administrative privilege, and record the answer.
   *
   * Concurrent calls coalesce into one request through the gate this delegates to. The layer that owns connection policy re-checks on each reconnect cycle, and a
   * controller that is flapping produces overlapping cycles; coalescing means the checks cannot resolve out of order and overwrite each other with staler answers.
   *
   * The check never disrupts its caller. A transport failure keeps the recorded verdict and reports at debug, because a privilege check that could not reach the
   * controller has learned nothing - it has not learned that the account is unprivileged. The one exception is the caller's own cancellation, which is returned to
   * it as the abort it asked for. The verdict is the credentials' own and is reported only while a session is held, so a check whose session was lost under it -
   * its own relogin failing, or another request's relogin failing before its answer landed - returns `null`, and what it recorded reads again once a relogin
   * re-establishes the session.
   *
   * @param opts - Optional abort signal for the request.
   *
   * @returns The privilege verdict as {@link AuthSession.isAdmin} reports it once the check settles: the recorded verdict while a session is held, whether or not
   *   the check established a new one, and `null` while none is.
   *
   * @throws {@link AccessAbortedError} if the caller's signal aborts the request.
   */
  async refreshAdminStatus(opts: { signal?: AbortSignal } = {}): Promise<Nullable<boolean>> {

    return this.#refreshAdminStatusGate(opts);
  }

  /* One relogin run, shared by every caller that arrived while it was in flight, on the terms of the caller that started it: a request that joins a relogin already
   * in flight shares its fate and its mark, the trade a recovery trial joining a document fetch already in flight accepts as well, and one the next attempt corrects.
   *
   * It resolves true when the handshake established a session and false when the controller refused the sign-in or answered the login with a 2xx that carried no
   * complete session, the session it belonged to ended or was replaced first, or no credentials are held, and the request that met the 401 then receives its own
   * 401-derived result. A handshake that throws instead met something other than a verdict on the credentials - the breaker may be open, a network failure surfaces
   * as AccessNetworkError and an answer that is no verdict on the credentials as AccessRequestError, and a failing or rebooting controller is often exactly the
   * weather that produced the 401 - so that throw is reported on the channel like any other unsuccessful relogin and then rethrown, and the request that met the
   * 401 throws the failure that ended its relogin rather than a refused sign-in it never met. A relogin a recovery probe triggered sends its handshake with the
   * probe's mark, so it reaches the controller through an open breaker as the probe itself did.
   */
  async #reauthenticateOnce(opts: { probe: boolean }): Promise<boolean> {

    // Read the credentials once, before any await, so the outcome is attributed to the session that was live when the relogin began rather than to whatever a
    // concurrent logout or fresh login has left behind by the time it finishes.
    const credentials = this.#credentials;
    let failure: Nullable<{ readonly error: unknown }> = null;
    let success = false;

    // Re-run the handshake only when we still hold credentials - an explicit logout clears them, and there is then nothing to recover. Drop the session cookie and
    // the CSRF token first, so the relogin starts from no session: the transport stamps the session's headers beneath every request's own, so a retained token would
    // otherwise go out on a login the root gave none for.
    if(credentials !== null) {

      this.#cookie = null;
      this.#csrfToken = null;

      try {

        success = await this.#handshake(credentials, opts);
      } catch(error) {

        failure = { error };
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

    // The failure is held in a record rather than in a bare binding, so a handshake that threw a falsy value is still told apart from one that threw nothing.
    if(failure !== null) {

      throw failure.error;
    }

    return success;
  }

  // One privilege-check run, shared by every caller that arrived while it was in flight.
  async #refreshAdminStatusOnce(opts: { signal?: AbortSignal }): Promise<Nullable<boolean>> {

    // The session's identity at entry. Every write below is conditioned on it still being current, and without credentials there is no session to describe at all.
    const credentials = this.#credentials;

    if(credentials === null) {

      return this.isAdmin;
    }

    let response: AccessResponse;

    /* The request goes out under the transport's own origin. A transport is origin-bound - undici retargets any URL dispatched through it to the pool's own origin,
     * so only the path and query here actually reach the wire - and composing from that same origin is what keeps the URL and the pool one value by construction,
     * whatever form the configured address took.
     */
    try {

      response = await this.#transport.send(this.#transport.origin + "/api/users/self",
        { method: "GET", ...((opts.signal !== undefined) && { signal: opts.signal }) });
    } catch(error) {

      // A cancellation is the caller's own decision and belongs back with the caller. Every other failure means we did not learn anything, which is not the same as
      // learning the account is unprivileged, so the recorded verdict stands. It is returned as the session reports it, which is `null` when the failure was this
      // request's own relogin, because that relogin dropped the session's cookie.
      if(error instanceof AccessAbortedError) {

        throw error;
      }

      this.#log.debug("Unable to reach the UniFi Access controller to determine administrative privilege.", error);

      return this.isAdmin;
    }

    /* A 401 that survived the transport's own relogin retry means the session is no longer accepted, so any privilege it previously demonstrated is no longer
     * demonstrated. Clearing to undetermined rather than to false is the honest reading: we did not learn that the account lacks privilege, we lost the ability to
     * ask.
     */
    if(response.statusCode === 401) {

      return this.#commitAdmin(null, credentials);
    }

    // Any other status is not a verdict on the account: a refusal of this one request, or a controller limiting requests or not ready yet, whose answer the
    // transport hands back as the response it was. Neither says anything about the account's privilege, so the recorded verdict stands as the session reports it.
    if(!responseOk(response.statusCode)) {

      return this.isAdmin;
    }

    let body: unknown;

    // This endpoint answers with the account record itself rather than wrapping it in the envelope the rest of the API uses, so the body is read directly.
    try {

      body = response.json<unknown>();
    } catch(error) {

      this.#log.debug("The UniFi Access controller's account record could not be parsed.", error);

      return this.isAdmin;
    }

    /* Read the grant list through runtime guards rather than by asserting the account type onto the body. The account type declares the grant list as always
     * present, but no capture in hand confirms that for this endpoint, and a cast would turn an assumption into a claim the compiler then trusts everywhere
     * downstream. Guarding costs two checks and keeps the uncertainty where it belongs.
     */
    if(!isRecord(body)) {

      this.#log.debug("The UniFi Access controller's account record was not the object shape the privilege check reads.");

      return this.isAdmin;
    }

    const scopes = body["scopes"];

    // No grant list at all is the controller reporting an account that holds none, which is a real answer: the account is not an administrator.
    if(scopes === undefined) {

      return this.#commitAdmin(false, credentials);
    }

    // A grant list of some other shape is not an answer we can read. Treating it as an absent list would report a privileged account as unprivileged on the
    // strength of a payload we did not understand, so the recorded verdict stands instead, as the session reports it.
    if(!Array.isArray(scopes)) {

      this.#log.debug("The UniFi Access controller reported a grant list in a shape the privilege check does not read.");

      return this.isAdmin;
    }

    return this.#commitAdmin(scopes.includes(ADMIN_SCOPE), credentials);
  }

  // The single site that writes the privilege verdict, so the staleness check cannot be forgotten at one of them. A verdict is committed only while the session it
  // describes is still the current one: a logout or a fresh login landing under the awaits above makes the answer describe a session that no longer exists, and
  // writing it would attribute one session's privileges to another. The return reads through the getter rather than echoing the value, because the credentials can
  // still be current while no cookie is held - another request's relogin failed while this check's answer was in flight - and the verdict then stays recorded,
  // unreported, until a relogin re-establishes the session.
  #commitAdmin(value: Nullable<boolean>, credentials: AccessCredentials): Nullable<boolean> {

    if(this.#credentials !== credentials) {

      return this.isAdmin;
    }

    this.#isAdmin = value;

    return this.isAdmin;
  }

  /* Drop the session cookie after a handshake that did not complete, so the session holds no half-formed state between that handshake and the next. The
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

  /* Run the UniFi OS handshake: read a fresh CSRF token from the controller root, then post the login exactly once, carrying the root's token when it answered with
   * one and none otherwise, because the controller accepts a correct login sent without one. A wrong password therefore costs one attempt against a sign-in
   * threshold UniFi OS does not publish. On success, capture the rotated CSRF token (the controller returns it as X-Updated-CSRF-Token, falling back to
   * X-CSRF-Token) and the bare session cookie. Returns whether a complete session was established. Self-sufficient in its auth headers - it stamps the fetched token
   * explicitly rather than relying on the transport's getAuthHeaders hook being wired back to this same session. The fetched token is the handshake's own until the
   * login succeeds: the session writes only the token the login's answer carries.
   *
   * A false return is a refused sign-in, which login() reports as bad credentials and which a reconnecting consumer reads as a wrong password, so only an answer
   * that judges the credentials earns it: a 4xx that names no readiness of the controller's. A controller limiting requests or not ready yet, a 3xx, or any other
   * 5xx says nothing about the credentials, so each throws the error the transport classifies it as, and a controller answering mid-reboot is never reported as a
   * wrong password. The controller root's status is read ahead of the login for its readiness alone: a readiness answer there, a 429 among them, throws before any
   * password is sent, because a controller that gives one is not placed to judge a sign-in, and any other answer that is not a 2xx yields no token.
   *
   * Every request the handshake sends carries the marks it was handed: the caller's signal, and the probe's mark for a relogin a recovery probe triggered, which is
   * what lets that relogin through an open breaker as the probe was let through.
   */
  async #handshake(credentials: AccessCredentials, opts: { probe?: boolean; signal?: AbortSignal } = {}): Promise<boolean> {

    const marks: Pick<SendOptions, "probe" | "signal"> = { ...((opts.probe === true) && { probe: true }), ...((opts.signal !== undefined) && { signal: opts.signal }) };
    const root = await this.#transport.send(this.#transport.origin, { authRetry: false, method: "GET", ...marks });

    // A root answering with a status that names the controller's readiness, a 429 limiting requests among them, means the controller is not placed to judge a
    // sign-in, so its classified error surfaces before any password is sent. Any other root answer that is not a 2xx yields no token, and the login goes without one.
    if(readinessOfStatus(root.statusCode) !== null) {

      root.ensureOk();
    }

    const fetchedToken = responseOk(root.statusCode) ? root.header("x-csrf-token") : null;

    // A logout, or a fresh login that does not wait behind a handshake in flight, may have ended or replaced the session while the root was read. The password then
    // belongs to a session that is over, so the handshake posts nothing, as the success write below discards a login that settles after the session changed.
    if(this.#credentials !== credentials) {

      return false;
    }

    // The transport stamps the content type on every request, so it is not repeated here, and the fetched token is spread in only when the root gave one, so an
    // absent token leaves the header structurally absent. authRetry is false so a login 401 surfaces as the response rather than recursing into relogin.
    const response = await this.#transport.send(this.#transport.origin + "/api/auth/login", {

      authRetry: false,
      body: JSON.stringify({ password: credentials.password, rememberMe: true, token: "", username: credentials.username }),
      headers: { ...((fetchedToken !== null) && { "x-csrf-token": fetchedToken }) },
      method: "POST",
      ...marks
    });

    // A login answered with anything but a 2xx ends the handshake, so the session is cleared first and a session that held a cookie never keeps it past a login the
    // controller did not accept. A refused sign-in then returns false; every other answer throws its classified error from ensureOk, which throws for every non-2xx.
    if(!responseOk(response.statusCode)) {

      this.#clearFailedSession(credentials);

      if(refusedSignIn(response.statusCode)) {

        return false;
      }

      response.ensureOk();
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
}

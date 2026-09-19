/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * auth.test.ts: Unit tests for the authentication session - the UniFi OS credential handshake, the CSRF pre-fetch retry, the cookie and CSRF capture and
 * stripping, the throw-on-failure contract, the logout and reauthenticate paths, the administrative-privilege check, and the two session-identity guards that
 * keep a result which arrives after the session changed from being written to the session that replaced it. Driven against an undici MockAgent so the handshake
 * exercises the real transport path.
 */
import { AccessAbortedError, AccessAuthError, AccessThrottledError } from "../errors.ts";
import type { Interceptable, MockAgent } from "undici";
import { assertRejectsWith, errnoError, settleUntil, subscribeTo } from "../testing.helpers.ts";
import { describe, test } from "node:test";
import { heldReply, makeMockTransport, url } from "./mock-controller.helpers.ts";
import { ACCESS_API_ERROR_LIMIT } from "../settings.ts";
import type { AccessAuthReloginPayload } from "../diagnostics.ts";
import { AuthSession } from "./auth.ts";
import type { AuthSessionOptions } from "./auth.ts";
import type { TestClock } from "homebridge-plugin-utils/testing";
import type { Transport } from "./http.ts";
import assert from "node:assert/strict";
import { channels } from "../diagnostics.ts";

// The endpoints the session drives, relative to the mock controller origin.
const LOGIN_PATH = "/api/auth/login";
const ROOT_PATH = "/";
const SELF_PATH = "/api/users/self";

// The grant string the privilege check looks for, restated here as wire vocabulary rather than imported - the session keeps it private, and a test that shared the
// constant would pass even if the production value changed to something the controller never issues.
const ADMIN_SCOPE = "edit:access.device";

// The credentials every test logs in with. The host is filled in per test from the mock controller's own address.
const CREDENTIALS = { password: "p", username: "u" };

// The bundle an auth test drives.
interface AuthFixture {

  agent: MockAgent;
  auth: AuthSession;
  clock: TestClock;
  host: string;
  pool: Interceptable;
  transport: Transport;
}

// A session over a transport with no relogin hook wired, so a 401 stays a 401 rather than triggering recovery. This is the shape most cases want: it keeps the
// behavior under test to the session's own.
function makeAuth(options: Omit<AuthSessionOptions, "transport"> = {}): AuthFixture {

  const mock = makeMockTransport();

  return { ...mock, auth: new AuthSession({ ...options, transport: mock.transport }) };
}

// A session wired to its transport exactly as the composition root wires them - the transport stamps the session's headers and calls back into it on a 401. The
// closures capture the binding before it is assigned, which is safe because they run only when a request is dispatched, strictly after the assignment below.
function makeWiredAuth(): AuthFixture {

  // eslint-disable-next-line prefer-const
  let session: AuthSession;
  const mock = makeMockTransport({ getAuthHeaders: () => session.authHeaders(), onUnauthorized: () => session.reauthenticate() });

  session = new AuthSession({ transport: mock.transport });

  return { ...mock, auth: session };
}

// Reply to one login POST with a complete session: a cookie carrying attributes to be stripped, and a CSRF token.
function replyLogin(pool: Interceptable, cookie: string, csrfToken: string): void {

  pool.intercept({ method: "POST", path: LOGIN_PATH }).reply(200, "", { headers: { "set-cookie": cookie, "x-csrf-token": csrfToken } });
}

// Log a session in against a freshly-stubbed login endpoint, so a test that is about what happens *after* login does not restate the handshake.
async function login(fixture: AuthFixture): Promise<void> {

  replyLogin(fixture.pool, "TOKEN=first; Path=/; HttpOnly", "csrf1");

  await fixture.auth.login({ ...CREDENTIALS, host: fixture.host });
}

// Drive the privilege verdict to true, so a case whose expected outcome is false or null is distinguishable from an untouched construction default.
async function driveAdminTrue(fixture: AuthFixture): Promise<void> {

  fixture.pool.intercept({ method: "GET", path: SELF_PATH }).reply(200, { scopes: [ ADMIN_SCOPE, "view:space" ] });

  assert.equal(await fixture.auth.refreshAdminStatus(), true, "the privilege check should report true before the case under test runs");
}

// Collect every authRelogin payload published while `run` executes.
async function captureRelogin(run: () => Promise<void>): Promise<AccessAuthReloginPayload[]> {

  const payloads: AccessAuthReloginPayload[] = [];

  using reloginSub = subscribeTo(channels.authRelogin, (message) => void payloads.push(message));

  await run();

  return payloads;
}

describe("AuthSession", () => {

  describe("initial state", () => {

    test("is unauthenticated with empty auth headers before login", () => {

      const { auth } = makeAuth();

      assert.equal(auth.isAuthenticated, false);
      assert.deepEqual(auth.authHeaders(), {});
      assert.equal(auth.sessionCookie, null);
      assert.equal(auth.isAdmin, null, "privilege is undetermined until a check runs, which is not the same as being unprivileged");
    });

    test("reauthenticate fails when no credentials have been supplied", async () => {

      const { auth } = makeAuth();

      assert.equal(await auth.reauthenticate(), false);
    });

    test("refreshAdminStatus leaves the verdict undetermined when no credentials have been supplied", async () => {

      const { auth } = makeAuth();

      assert.equal(await auth.refreshAdminStatus(), null);
    });
  });

  describe("login", () => {

    test("captures the stripped cookie and CSRF token on a direct success", async () => {

      const { auth, host, pool } = makeAuth();

      replyLogin(pool, "TOKEN=abc; Path=/; HttpOnly", "csrf1");

      await auth.login({ ...CREDENTIALS, host });

      assert.equal(auth.isAuthenticated, true);
      assert.deepEqual(auth.authHeaders(), { cookie: "TOKEN=abc", "x-csrf-token": "csrf1" }, "the cookie attributes must be stripped to the bare token=value pair");
      assert.equal(auth.sessionCookie, "TOKEN=abc", "the stream reads the bare cookie for its upgrade request");
    });

    test("keeps a cookie that carries no attributes intact", async () => {

      const { auth, host, pool } = makeAuth();

      replyLogin(pool, "TOKEN=bare", "csrf1");

      await auth.login({ ...CREDENTIALS, host });

      assert.equal(auth.sessionCookie, "TOKEN=bare");
    });

    test("sends the credential body the controller expects", async () => {

      const { auth, host, pool } = makeAuth();

      // The interceptor matches on the exact body, so a successful login proves every member the controller reads was sent with the value it expects - including
      // the two constants that are not the caller's to supply.
      pool.intercept({ body: JSON.stringify({ password: "p", rememberMe: true, token: "", username: "u" }), method: "POST", path: LOGIN_PATH })
        .reply(200, "", { headers: { "set-cookie": "TOKEN=abc", "x-csrf-token": "csrf1" } });

      await auth.login({ ...CREDENTIALS, host });

      assert.equal(auth.isAuthenticated, true);
    });

    test("prefers the rotated X-Updated-CSRF-Token over X-CSRF-Token", async () => {

      const { auth, host, pool } = makeAuth();

      pool.intercept({ method: "POST", path: LOGIN_PATH })
        .reply(200, "", { headers: { "set-cookie": "TOKEN=abc", "x-csrf-token": "stale", "x-updated-csrf-token": "rotated" } });

      await auth.login({ ...CREDENTIALS, host });

      assert.equal(auth.authHeaders()["x-csrf-token"], "rotated", "the rotated token must win when the controller sends both");
    });

    test("fetches a CSRF token from the controller root and retries the login when the first attempt is rejected", async () => {

      const { auth, host, pool } = makeAuth();

      pool.intercept({ method: "POST", path: LOGIN_PATH }).reply(403, "need csrf");
      pool.intercept({ method: "GET", path: ROOT_PATH }).reply(200, "", { headers: { "x-csrf-token": "fetched" } });
      pool.intercept({ headers: { "x-csrf-token": "fetched" }, method: "POST", path: LOGIN_PATH })
        .reply(200, "", { headers: { "set-cookie": "TOKEN=z; Path=/", "x-csrf-token": "final" } });

      await auth.login({ ...CREDENTIALS, host });

      assert.equal(auth.isAuthenticated, true);
      assert.deepEqual(auth.authHeaders(), { cookie: "TOKEN=z", "x-csrf-token": "final" });
    });

    test("does not re-fetch a CSRF token when one is already held", async () => {

      const { auth, host, pool } = makeAuth();

      // A first login banks a token. The second login fails outright, and because a token is already in hand there is no root fetch to fall back on - so no
      // interceptor for the root is registered, and registering none is what proves the request is not made.
      replyLogin(pool, "TOKEN=abc", "csrf1");
      await auth.login({ ...CREDENTIALS, host });

      pool.intercept({ method: "POST", path: LOGIN_PATH }).reply(401, "bad creds");

      await assert.rejects(auth.login({ ...CREDENTIALS, host }), AccessAuthError);
    });

    test("throws AccessAuthError and stays unauthenticated when the handshake cannot complete", async () => {

      const { auth, host, pool } = makeAuth();

      pool.intercept({ method: "POST", path: LOGIN_PATH }).reply(401, "bad creds");
      pool.intercept({ method: "GET", path: ROOT_PATH }).reply(500, "unavailable");

      await assertRejectsWith(auth.login({ ...CREDENTIALS, host }), AccessAuthError, { check: (error) => {

        assert.equal(error.identity, "credentials", "the login handshake is the credential leg, so it attributes its own refusal to that leg");

        // Consumer-facing copy a caller may render verbatim, so the sentence is asserted exactly rather than matched loosely.
        assert.equal(error.message, "Unable to authenticate with the UniFi Access controller. Please check the configured address, username, and password.");
      } });

      assert.equal(auth.isAuthenticated, false);
    });

    test("treats a 2xx login that omits the cookie or CSRF token as a failure", async () => {

      const { auth, host, pool } = makeAuth();

      // The controller answered 200 but without a Set-Cookie - the session is incomplete, so the handshake must fail closed rather than report success.
      pool.intercept({ method: "POST", path: LOGIN_PATH }).reply(200, "", { headers: { "x-csrf-token": "csrf1" } });

      await assert.rejects(auth.login({ ...CREDENTIALS, host }), AccessAuthError);
      assert.equal(auth.isAuthenticated, false);
    });

    test("retains its own copy of the credentials, so a caller clearing them cannot hollow out relogin", async () => {

      const { auth, host, pool } = makeAuth();

      // A caller that scrubs its secret after login is a reasonable thing to do with a password. The session must have taken a copy, or relogin would later send
      // an emptied credential.
      const mutable = { host, password: "p", username: "u" };

      replyLogin(pool, "TOKEN=abc", "csrf1");
      await auth.login(mutable);

      mutable.password = "";

      pool.intercept({ body: JSON.stringify({ password: "p", rememberMe: true, token: "", username: "u" }), method: "POST", path: LOGIN_PATH })
        .reply(200, "", { headers: { "set-cookie": "TOKEN=new", "x-csrf-token": "csrf2" } });

      assert.equal(await auth.reauthenticate(), true, "the relogin must send the password the session was given, not the caller's scrubbed copy");
    });
  });

  describe("logout and reauthenticate", () => {

    test("logout clears the session, the credentials, and the privilege verdict", async () => {

      const fixture = makeAuth();
      const { auth } = fixture;

      await login(fixture);
      await driveAdminTrue(fixture);

      auth.logout();

      assert.equal(auth.isAuthenticated, false);
      assert.deepEqual(auth.authHeaders(), {});
      assert.equal(auth.sessionCookie, null);
      assert.equal(auth.isAdmin, null, "a privilege the session no longer demonstrably holds must not survive its session");
      assert.equal(await auth.reauthenticate(), false, "after an explicit logout there are no credentials to re-authenticate with");
    });

    test("reauthenticate re-runs the handshake with the retained credentials and refreshes the session", async () => {

      const fixture = makeAuth();
      const { auth, host, pool } = fixture;

      await login(fixture);

      pool.intercept({ method: "POST", path: LOGIN_PATH }).reply(200, "", { headers: { "set-cookie": "TOKEN=new", "x-csrf-token": "csrf2" } });

      assert.equal(await auth.reauthenticate(), true);
      assert.deepEqual(auth.authHeaders(), { cookie: "TOKEN=new", "x-csrf-token": "csrf2" }, "reauthenticate must replace the session with the freshly issued one");

      // The interception above already proved the handshake targeted the login endpoint - had the URL been wrong, that interceptor would not have matched. This
      // instead checks the url() helper composes the origin the way the rest of the suite assumes.
      assert.equal(url(host, LOGIN_PATH), "https://" + host + LOGIN_PATH);
    });

    test("a failed relogin leaves the session unauthenticated but keeps the credentials for a later attempt", async () => {

      const fixture = makeAuth();
      const { auth, pool } = fixture;

      await login(fixture);

      pool.intercept({ method: "POST", path: LOGIN_PATH }).reply(401, "rejected");

      assert.equal(await auth.reauthenticate(), false);
      assert.equal(auth.isAuthenticated, false, "the stale cookie is dropped so a later relogin starts clean");

      // The credentials survived, so a subsequent attempt can still recover.
      pool.intercept({ method: "POST", path: LOGIN_PATH }).reply(200, "", { headers: { "set-cookie": "TOKEN=later", "x-csrf-token": "csrf3" } });

      assert.equal(await auth.reauthenticate(), true);
    });

    test("publishes the relogin outcome on the auth:relogin channel in all three legal states", async () => {

      const fixture = makeAuth();
      const { auth, host, pool } = fixture;

      await login(fixture);

      const payloads = await captureRelogin(async () => {

        // Credentials held and the handshake succeeded.
        pool.intercept({ method: "POST", path: LOGIN_PATH }).reply(200, "", { headers: { "set-cookie": "TOKEN=new", "x-csrf-token": "csrf2" } });
        assert.equal(await auth.reauthenticate(), true);

        // Credentials held and the handshake was refused - the session is attributable even though it could not be recovered.
        pool.intercept({ method: "POST", path: LOGIN_PATH }).reply(401, "rejected");
        assert.equal(await auth.reauthenticate(), false);

        // No credentials at all, so there is no host to attribute the attempt to and it cannot have succeeded.
        auth.logout();
        assert.equal(await auth.reauthenticate(), false);
      });

      assert.deepEqual(payloads, [ { host, success: true }, { host, success: false }, { host: null, success: false } ]);
    });

    test("coalesces concurrent relogins into a single handshake", async () => {

      const fixture = makeWiredAuth();
      const { host, pool } = fixture;

      await login(fixture);

      let loginPosts = 0;
      let secondRefusalSeen = false;

      /* Two independent requests each come back 401 and each invoke the relogin hook. The handshake is held until the test releases it, and the release waits
       * on the second refusal, so the second 401 arrives while the first handshake is still in flight - the window the coalescing exists for. Two interceptors
       * are registered so that a second handshake would find one waiting - the count, not a missing interceptor, is what fails this test if the guard is gone.
       */
      const handshake = heldReply(200, "", { headers: { "set-cookie": "TOKEN=new", "x-csrf-token": "csrf2" } });

      pool.intercept({ method: "GET", path: "/one" }).reply(401, "stale");
      pool.intercept({ method: "GET", path: "/one" }).reply(200, { ok: 1 });
      pool.intercept({ method: "GET", path: "/two" }).reply(401, () => {

        secondRefusalSeen = true;

        return "stale";
      });
      pool.intercept({ method: "GET", path: "/two" }).reply(200, { ok: 2 });
      pool.intercept({ method: "POST", path: LOGIN_PATH }).reply((opts) => {

        loginPosts++;

        return handshake.reply(opts);
      }).times(2);

      const pair = Promise.all([ fixture.transport.send(url(host, "/one")), fixture.transport.send(url(host, "/two")) ]);

      await settleUntil(() => secondRefusalSeen, { message: "expected the second request to be refused while the handshake was still in flight" });
      handshake.release();

      const [ first, second ] = await pair;

      assert.equal(first.statusCode, 200, "the first request retried successfully after the shared relogin");
      assert.equal(second.statusCode, 200, "the second request retried successfully off the same relogin");
      assert.equal(loginPosts, 1, "two concurrent 401s must produce exactly one handshake rather than two racing each other");
    });

    test("a relogin whose handshake throws resolves false, still publishes, and leaves the caller with its own 401", async () => {

      const fixture = makeWiredAuth();
      const { auth, host, pool, transport } = fixture;

      await login(fixture);

      // Trip the breaker so the relogin's own login POST is refused locally before it can dispatch. The request that triggers the relogin uses the recovery probe
      // to bypass the same gate, which is what lets a 401 be observed while the breaker is open.
      pool.intercept({ method: "GET", path: "/f" }).reply(500, "x").times(ACCESS_API_ERROR_LIMIT);

      for(let index = 0; index < ACCESS_API_ERROR_LIMIT; index++) {

        // eslint-disable-next-line no-await-in-loop
        await transport.send(url(host, "/f"));
      }

      assert.equal(transport.isThrottled, true);

      pool.intercept({ method: "GET", path: "/guarded" }).reply(401, "stale");

      const payloads = await captureRelogin(async () => {

        const response = await transport.send(url(host, "/guarded"), { probe: true });

        // The caller asked for a resource and got the controller's own answer. A throttle error raised by a recovery it never requested would be the wrong error
        // entirely.
        assert.equal(response.statusCode, 401);
      });

      assert.deepEqual(payloads, [{ host, success: false }], "a handshake that could not run is still a relogin outcome a consumer should see");
      assert.equal(auth.isAuthenticated, false);
    });

    test("the handshake does not recurse into relogin on its own 401", async () => {

      const fixture = makeWiredAuth();
      const { auth, host, pool } = fixture;

      // The login POST itself is refused. Were the handshake to travel the ordinary authenticated path, that 401 would invoke the relogin hook, which would post
      // another login, and so on. Exactly one login POST is registered, so a recursion would fail to find an interceptor.
      pool.intercept({ method: "POST", path: LOGIN_PATH }).reply(401, "bad creds");
      pool.intercept({ method: "GET", path: ROOT_PATH }).reply(500, "unavailable");

      const payloads = await captureRelogin(async () => {

        await assert.rejects(auth.login({ ...CREDENTIALS, host }), AccessAuthError);
      });

      assert.deepEqual(payloads, [], "a login handshake must not publish a relogin outcome, because it never entered relogin");
    });

    test("a logout during an in-flight relogin does not resurrect the session", async () => {

      const fixture = makeAuth();
      const { auth, pool } = fixture;

      await login(fixture);

      /* The controller never hears about a logout - it is client-side state - so a login already in flight succeeds regardless. Writing that session would
       * silently re-arm a session the caller explicitly ended, which is what the identity check at the write site prevents. The handshake is held until the
       * test releases it, so the logout provably lands inside it.
       */
      const handshake = heldReply(200, "", { headers: { "set-cookie": "TOKEN=resurrected", "x-csrf-token": "csrf9" } });

      pool.intercept({ method: "POST", path: LOGIN_PATH }).reply(handshake.reply);

      const pending = auth.reauthenticate();

      auth.logout();
      handshake.release();

      assert.equal(await pending, false, "a handshake that outlived its session reports failure rather than success");
      assert.equal(auth.isAuthenticated, false);
      assert.deepEqual(auth.authHeaders(), {});
      assert.equal(auth.sessionCookie, null);
    });

    test("a stale failed handshake does not clear the session that replaced it", async () => {

      const fixture = makeAuth();
      const { auth, host, pool } = fixture;

      await login(fixture);

      /* The relogin's login POST is held until the test releases it and will be refused. While it is in flight the caller logs out and logs in afresh, so by
       * the time that failure lands it describes a session that no longer exists. A fresh login does not queue behind an in-flight relogin, which is what makes
       * the overlap reachable.
       */
      const refusal = heldReply(401, "rejected");

      pool.intercept({ method: "POST", path: LOGIN_PATH }).reply(refusal.reply);

      const stale = auth.reauthenticate();

      auth.logout();
      replyLogin(pool, "TOKEN=second; Path=/", "csrf2");

      await auth.login({ ...CREDENTIALS, host });

      refusal.release();

      assert.equal(await stale, false, "the stale handshake still reports its own failure");
      assert.equal(auth.isAuthenticated, true, "the replacement session survives a failure that was never about it");
      assert.deepEqual(auth.authHeaders(), { cookie: "TOKEN=second", "x-csrf-token": "csrf2" });
    });
  });

  describe("administrative privilege", () => {

    test("reads the grant list from the bare account record the endpoint returns", async () => {

      const fixture = makeAuth();
      const { auth, pool } = fixture;

      await login(fixture);

      // This endpoint answers with the account record itself rather than the envelope the rest of the API wraps results in.
      pool.intercept({ method: "GET", path: SELF_PATH }).reply(200, { "first_name": "Ada", "scopes": [ "view:space", ADMIN_SCOPE ] });

      assert.equal(await auth.refreshAdminStatus(), true);
      assert.equal(auth.isAdmin, true);
    });

    test("reports false for an account whose grant list lacks the device-management grant", async () => {

      const fixture = makeAuth();
      const { auth, pool } = fixture;

      await login(fixture);
      pool.intercept({ method: "GET", path: SELF_PATH }).reply(200, { scopes: [ "view:space", "view:access.device" ] });

      assert.equal(await auth.refreshAdminStatus(), false);
    });

    test("reports false when the account record carries no grant list at all", async () => {

      const fixture = makeAuth();
      const { auth, pool } = fixture;

      await login(fixture);
      await driveAdminTrue(fixture);

      // Driven from true first, so reporting false here is an answer the check produced rather than the value it started at.
      pool.intercept({ method: "GET", path: SELF_PATH }).reply(200, { "first_name": "Ada" });

      assert.equal(await auth.refreshAdminStatus(), false);
      assert.equal(auth.isAdmin, false);
    });

    test("keeps the previous verdict when the grant list arrives in an unreadable shape", async () => {

      const fixture = makeAuth();
      const { auth, pool } = fixture;

      await login(fixture);
      await driveAdminTrue(fixture);

      // A grant list that is not a list is not an answer. Treating it as an absent list would report a privileged account as unprivileged on the strength of a
      // payload we did not understand.
      pool.intercept({ method: "GET", path: SELF_PATH }).reply(200, { scopes: 42 });

      assert.equal(await auth.refreshAdminStatus(), true, "an unreadable grant list must leave the previous verdict standing");
      assert.equal(auth.isAdmin, true);
    });

    test("does not match a string-valued grant list by substring", async () => {

      const fixture = makeAuth();
      const { auth, pool } = fixture;

      await login(fixture);

      // Drive to false first, because this is the case where a substring match against a string would wrongly report true - so starting from false is what makes
      // the result distinguishable.
      pool.intercept({ method: "GET", path: SELF_PATH }).reply(200, { scopes: [] });
      assert.equal(await auth.refreshAdminStatus(), false);

      pool.intercept({ method: "GET", path: SELF_PATH }).reply(200, { scopes: ADMIN_SCOPE });

      assert.equal(await auth.refreshAdminStatus(), false, "a string that merely contains the grant is not a grant list");
    });

    test("keeps the previous verdict when the account record is not an object", async () => {

      const fixture = makeAuth();
      const { auth, pool } = fixture;

      await login(fixture);
      await driveAdminTrue(fixture);

      pool.intercept({ method: "GET", path: SELF_PATH }).reply(200, [ "not", "a", "record" ]);

      assert.equal(await auth.refreshAdminStatus(), true);
    });

    test("keeps the previous verdict when the controller refuses the request", async () => {

      const fixture = makeAuth();
      const { auth, pool } = fixture;

      await login(fixture);
      await driveAdminTrue(fixture);

      pool.intercept({ method: "GET", path: SELF_PATH }).reply(500, "unavailable");

      assert.equal(await auth.refreshAdminStatus(), true, "a controller declining one request says nothing about the account");
    });

    test("keeps the previous verdict when the account record cannot be parsed", async () => {

      const fixture = makeAuth();
      const { auth, pool } = fixture;

      await login(fixture);
      await driveAdminTrue(fixture);

      pool.intercept({ method: "GET", path: SELF_PATH }).reply(200, "not-json{", { headers: { "content-type": "application/json" } });

      assert.equal(await auth.refreshAdminStatus(), true);
    });

    test("returns the verdict to undetermined on a 401 the session could not recover", async () => {

      const fixture = makeAuth();
      const { auth, pool } = fixture;

      await login(fixture);
      await driveAdminTrue(fixture);

      // Driven from true, so clearing to undetermined is an active write rather than an untouched default. There is no relogin hook on this transport, so the 401
      // stands.
      pool.intercept({ method: "GET", path: SELF_PATH }).reply(401, "stale");

      assert.equal(await auth.refreshAdminStatus(), null);
      assert.equal(auth.isAdmin, null, "a privilege that can no longer be demonstrated must not be reported as still held");
    });

    test("keeps the previous verdict when the transport is throttled", async () => {

      const fixture = makeAuth();
      const { auth, host, pool, transport } = fixture;

      await login(fixture);
      await driveAdminTrue(fixture);

      pool.intercept({ method: "GET", path: "/f" }).reply(500, "x").times(ACCESS_API_ERROR_LIMIT);

      for(let index = 0; index < ACCESS_API_ERROR_LIMIT; index++) {

        // eslint-disable-next-line no-await-in-loop
        await transport.send(url(host, "/f"));
      }

      // The check now cannot reach the controller at all. It has not learned that the account is unprivileged, so it reports what it last knew.
      await assert.rejects(transport.send(url(host, SELF_PATH)), AccessThrottledError);
      assert.equal(await auth.refreshAdminStatus(), true);
    });

    test("keeps the previous verdict when the request fails at the network level", async () => {

      const fixture = makeAuth();
      const { auth, pool } = fixture;

      await login(fixture);
      await driveAdminTrue(fixture);

      pool.intercept({ method: "GET", path: SELF_PATH }).replyWithError(errnoError("connect ECONNREFUSED", "ECONNREFUSED"));

      assert.equal(await auth.refreshAdminStatus(), true);
    });

    test("rejects with the caller's own cancellation rather than absorbing it", async () => {

      const fixture = makeAuth();
      const { auth, pool } = fixture;

      await login(fixture);

      // The reply stays open far longer than the cancellation needs, so the delay is the margin the abort lands inside rather than a wait this test performs.
      pool.intercept({ method: "GET", path: SELF_PATH }).reply(200, { scopes: [] }).delay(2000);

      const controller = new AbortController();
      const pending = auth.refreshAdminStatus({ signal: controller.signal });

      controller.abort();

      // Every other failure keeps the previous verdict and returns; a cancellation is the caller's own decision and belongs back with the caller.
      await assert.rejects(pending, AccessAbortedError);
    });

    test("issues no request at all once the session has been ended", async () => {

      const fixture = makeAuth();
      const { auth, pool } = fixture;

      await login(fixture);
      await driveAdminTrue(fixture);

      auth.logout();

      // The interceptor would grant privilege if it were consumed, so a check that wrongly dispatched would report true rather than the undetermined value a
      // logged-out session must report. Driving the verdict to true first keeps that distinction alive even if logout and this path ever stop both landing on null.
      pool.intercept({ method: "GET", path: SELF_PATH }).reply(200, { scopes: [ADMIN_SCOPE] });

      assert.equal(await auth.refreshAdminStatus(), null);
      assert.equal(auth.isAdmin, null);
    });

    test("discards a verdict that resolves after the session was ended", async () => {

      const fixture = makeAuth();
      const { auth, pool } = fixture;

      await login(fixture);

      /* The response grants privilege, but it lands after the session it describes is gone. Writing it would attribute one session's privileges to whatever
       * replaced it. The reply is held until the test releases it, which is what puts the logout inside the check rather than before or after one.
       */
      const verdict = heldReply(200, { scopes: [ADMIN_SCOPE] });

      pool.intercept({ method: "GET", path: SELF_PATH }).reply(verdict.reply);

      const pending = auth.refreshAdminStatus();

      auth.logout();
      verdict.release();

      assert.equal(await pending, null);
      assert.equal(auth.isAdmin, null, "a verdict that outlived its session must not be written to the session that replaced it");
    });

    test("coalesces concurrent checks into a single request", async () => {

      const fixture = makeAuth();
      const { auth, pool } = fixture;

      await login(fixture);

      let selfGets = 0;

      // Two interceptors are registered, so a second request would find one waiting - the count is what fails this test if the coalescing is gone, rather than a
      // missing interceptor.
      pool.intercept({ method: "GET", path: SELF_PATH }).reply(200, () => {

        selfGets++;

        return { scopes: [ADMIN_SCOPE] };
      }).times(2);

      const [ first, second ] = await Promise.all([ auth.refreshAdminStatus(), auth.refreshAdminStatus() ]);

      assert.equal(first, true);
      assert.equal(second, true, "the overlapping caller receives the shared result rather than issuing its own");
      assert.equal(selfGets, 1, "overlapping checks must produce exactly one request");
    });

    test("checks again on a later call once the previous one has settled", async () => {

      const fixture = makeAuth();
      const { auth, pool } = fixture;

      await login(fixture);

      pool.intercept({ method: "GET", path: SELF_PATH }).reply(200, { scopes: [ADMIN_SCOPE] });
      assert.equal(await auth.refreshAdminStatus(), true);

      // The coalescing gate must clear when its run settles, or the session would report the first answer forever.
      pool.intercept({ method: "GET", path: SELF_PATH }).reply(200, { scopes: [] });
      assert.equal(await auth.refreshAdminStatus(), false);
    });
  });
});

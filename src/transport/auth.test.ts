/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * auth.test.ts: Unit tests for the authentication session - the UniFi OS credential handshake, its CSRF token read from the controller root ahead of its one
 * login, the cookie and CSRF capture and stripping, the throw-on-failure contract, the logout and reauthenticate paths, the administrative-privilege check, and
 * the stale-session guards that keep a handshake or a check which outlives the session it began under from posting a login for it or writing to the session that
 * replaced it. Driven against an undici MockAgent so the handshake exercises the real transport path, and over a loopback peer where a row reads what the owned
 * pool's retry decision hands the handshake, which a MockAgent never reaches.
 */
import { ACCESS_API_ERROR_LIMIT, ACCESS_API_RETRY_PROFILE } from "../settings.ts";
import { AccessAbortedError, AccessAuthError, AccessThrottledError } from "../errors.ts";
import type { Interceptable, MockAgent } from "undici";
import { describe, test } from "node:test";
import { errnoError, settleUntil } from "homebridge-plugin-utils/testing";
import { heldReply, makeMockTransport, url } from "./mock-controller.helpers.ts";
import type { AccessAuthReloginPayload } from "../diagnostics.ts";
import { AuthSession } from "./auth.ts";
import type { AuthSessionOptions } from "./auth.ts";
import type { TestClock } from "homebridge-plugin-utils/testing";
import { Transport } from "./http.ts";
import assert from "node:assert/strict";
import { channels } from "../diagnostics.ts";
import { createHttpsLoopback } from "./loopback.helpers.ts";
import { subscribeTo } from "../testing.helpers.ts";

// The endpoints the session drives, relative to the mock controller origin.
const LOGIN_PATH = "/api/auth/login";
const ROOT_PATH = "/";
const SELF_PATH = "/api/users/self";

// The grant string the privilege check looks for, restated here as wire vocabulary rather than imported - the session keeps it private, and a test that shared the
// constant would pass even if the production value changed to something the controller never issues.
const ADMIN_SCOPE = "edit:access.device";

// The credentials every test logs in with. The host is filled in per test from the mock controller's own address.
const CREDENTIALS = { password: "p", username: "u" };

// The login body those credentials go out as, restated as the bytes the controller reads rather than composed from the credentials, so a row matching on it checks
// the handshake's own composition rather than repeating it.
const LOGIN_BODY = JSON.stringify({ password: "p", rememberMe: true, token: "", username: "u" });

// The sentence a refused sign-in throws. It is consumer-facing copy a caller may render verbatim, so a row asserts it exactly rather than matching it loosely.
const REFUSED_SIGN_IN_MESSAGE = "Unable to authenticate with the UniFi Access controller. Please check the configured address, username, and password.";

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
  const mock = makeMockTransport({ getAuthHeaders: () => session.authHeaders(), onUnauthorized: (relogin) => session.reauthenticate(relogin) });

  session = new AuthSession({ transport: mock.transport });

  return { ...mock, auth: session };
}

// Answer the controller root, the first request of every handshake, with a 200 carrying the given CSRF token, or none when the row names none.
function interceptRoot(pool: Interceptable, token?: string): void {

  pool.intercept({ method: "GET", path: ROOT_PATH }).reply(200, "", { headers: (token !== undefined) ? { "x-csrf-token": token } : {} });
}

// Reply to one login POST with a complete session: a cookie carrying attributes to be stripped, and a CSRF token.
function replyLogin(pool: Interceptable, cookie: string, csrfToken: string): void {

  pool.intercept({ method: "POST", path: LOGIN_PATH }).reply(200, "", { headers: { "set-cookie": cookie, "x-csrf-token": csrfToken } });
}

// Log a session in against a freshly-stubbed controller root and login endpoint, so a test that is about what happens *after* login does not restate the handshake.
async function login(fixture: AuthFixture): Promise<void> {

  interceptRoot(fixture.pool);
  replyLogin(fixture.pool, "TOKEN=first; Path=/; HttpOnly", "csrf1");

  await fixture.auth.login({ ...CREDENTIALS, host: fixture.host });
}

// Drive the privilege verdict to true, so a case whose expected outcome is false or null is distinguishable from an untouched construction default.
async function driveAdminTrue(fixture: AuthFixture): Promise<void> {

  fixture.pool.intercept({ method: "GET", path: SELF_PATH }).reply(200, { scopes: [ ADMIN_SCOPE, "view:space" ] });

  assert.equal(await fixture.auth.refreshAdminStatus(), true, "the privilege check should report true before the case under test runs");
}

// Send an ordinary request whose 401 sends a wired session into relogin, the relogin's root answered as a working controller answers it and its login answered with
// the status a case names. A controller not ready yet throws its status to the request and a refused sign-in hands the request its 401 back, and either way the
// handshake that failed has dropped the session's cookie.
async function failRelogin(fixture: AuthFixture, loginStatus: 401 | 503): Promise<void> {

  const { host, pool, transport } = fixture;

  pool.intercept({ method: "GET", path: "/r" }).reply(401, "stale");
  interceptRoot(pool);
  pool.intercept({ method: "POST", path: LOGIN_PATH }).reply(loginStatus, "refused");

  if(loginStatus === 503) {

    await assert.rejects(transport.send(url(host, "/r")), { name: "AccessRequestError", statusCode: 503 });

    return;
  }

  assert.equal((await transport.send(url(host, "/r"))).statusCode, 401, "a refused sign-in hands the request its 401 back");
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

    test("captures the stripped cookie and CSRF token from an accepted login", async () => {

      const { agent, auth, host, pool } = makeAuth();

      interceptRoot(pool);
      replyLogin(pool, "TOKEN=abc; Path=/; HttpOnly", "csrf1");

      await auth.login({ ...CREDENTIALS, host });

      assert.equal(auth.isAuthenticated, true);
      assert.deepEqual(auth.authHeaders(), { cookie: "TOKEN=abc", "x-csrf-token": "csrf1" }, "the cookie attributes must be stripped to the bare token=value pair");
      assert.equal(auth.sessionCookie, "TOKEN=abc", "the stream reads the bare cookie for its upgrade request");
      agent.assertNoPendingInterceptors();
    });

    test("keeps a cookie that carries no attributes intact", async () => {

      const { agent, auth, host, pool } = makeAuth();

      interceptRoot(pool);
      replyLogin(pool, "TOKEN=bare", "csrf1");

      await auth.login({ ...CREDENTIALS, host });

      assert.equal(auth.sessionCookie, "TOKEN=bare");
      agent.assertNoPendingInterceptors();
    });

    test("sends the credential body the controller expects", async () => {

      const { agent, auth, host, pool } = makeAuth();

      // The interceptor matches on the exact body, so a successful login proves every member the controller reads was sent with the value it expects - including
      // the two constants that are not the caller's to supply.
      interceptRoot(pool);
      pool.intercept({ body: LOGIN_BODY, method: "POST", path: LOGIN_PATH }).reply(200, "", { headers: { "set-cookie": "TOKEN=abc", "x-csrf-token": "csrf1" } });

      await auth.login({ ...CREDENTIALS, host });

      assert.equal(auth.isAuthenticated, true);
      agent.assertNoPendingInterceptors();
    });

    test("prefers the rotated X-Updated-CSRF-Token over X-CSRF-Token", async () => {

      const { agent, auth, host, pool } = makeAuth();

      interceptRoot(pool);
      pool.intercept({ method: "POST", path: LOGIN_PATH })
        .reply(200, "", { headers: { "set-cookie": "TOKEN=abc", "x-csrf-token": "stale", "x-updated-csrf-token": "rotated" } });

      await auth.login({ ...CREDENTIALS, host });

      assert.equal(auth.authHeaders()["x-csrf-token"], "rotated", "the rotated token must win when the controller sends both");
      agent.assertNoPendingInterceptors();
    });

    test("stamps the CSRF token the controller root answers with on the one login it posts", async () => {

      const { agent, auth, host, pool } = makeAuth();

      // The login intercept answers only a login carrying the root's token, so the token the root handed back must reach the login.
      interceptRoot(pool, "fetched");
      pool.intercept({ headers: { "x-csrf-token": "fetched" }, method: "POST", path: LOGIN_PATH })
        .reply(200, "", { headers: { "set-cookie": "TOKEN=z; Path=/", "x-csrf-token": "final" } });

      await auth.login({ ...CREDENTIALS, host });

      assert.equal(auth.isAuthenticated, true);
      assert.deepEqual(auth.authHeaders(), { cookie: "TOKEN=z", "x-csrf-token": "final" }, "the session keeps the token the login answers with, never the root's");
      agent.assertNoPendingInterceptors();
    });

    test("throws AccessAuthError and stays unauthenticated when the handshake cannot complete", async () => {

      const { agent, auth, host, pool } = makeAuth();

      // The controller root answers without a CSRF token, so the one login goes without one, and its refusal is the verdict on the credentials.
      interceptRoot(pool);
      pool.intercept({ method: "POST", path: LOGIN_PATH }).reply(401, "bad creds");

      // The login handshake is the credential leg, so it attributes its own refusal to that leg.
      await assert.rejects(auth.login({ ...CREDENTIALS, host }), { identity: "credentials", message: REFUSED_SIGN_IN_MESSAGE, name: "AccessAuthError" });
      assert.equal(auth.isAuthenticated, false);
      agent.assertNoPendingInterceptors();
    });

    /* A status that is no verdict on the credentials - a controller not ready yet, one limiting requests, a 3xx, or a 5xx the transport does not retry - surfaces as
     * the classified request error rather than as a refused sign-in, and the handshake leaves no session behind, not even the token the root handed it.
     */
    for(const status of [ 503, 404, 400, 429, 501, 302, 505 ]) {

      test("a login answered " + String(status) + " throws AccessRequestError with that status and stays unauthenticated", async () => {

        const { agent, auth, host, pool } = makeAuth();

        interceptRoot(pool, "fetched");
        pool.intercept({ method: "POST", path: LOGIN_PATH }).reply(status, "not ready");

        await assert.rejects(auth.login({ ...CREDENTIALS, host }), { name: "AccessRequestError", statusCode: status });
        assert.equal(auth.isAuthenticated, false);
        assert.deepEqual(auth.authHeaders(), {}, "the root's token is the handshake's own, never the session's");
        agent.assertNoPendingInterceptors();
      });
    }

    test("a login answered 503 with a Retry-After over the owned pool throws AccessRequestError, the login sent once", async () => {

      /* The root answers 200 and the login a hinted readiness answer. The owned pool's retry decision returns the hinted answer unretried, and the handshake still
       * reads it as no verdict on the credentials, so the peer answers the root and the one login, which the bodies it received show in order.
       */
      await using loopback = await createHttpsLoopback((hit) => ((hit === 1) ? { body: "{}", contentType: "application/json", status: 200 } :
        { body: "{\"error\":\"starting\"}", contentType: "application/json", headers: { "retry-after": "2" }, status: 503 }));
      await using transport = new Transport({ host: loopback.host, origin: loopback.origin });

      const auth = new AuthSession({ transport });

      await assert.rejects(auth.login({ ...CREDENTIALS, host: loopback.host }), { name: "AccessRequestError", statusCode: 503 });
      assert.equal(loopback.hits.length, 2);
      assert.deepEqual(loopback.hits.map((hit) => hit.body.toString("utf8")), [ "", LOGIN_BODY ], "an empty root read, then the credential login");
      assert.equal(auth.isAuthenticated, false);
    });

    test("a controller root answered 503 with a Retry-After over the owned pool throws AccessRequestError after one request, posting no login", async () => {

      // The owned pool's retry decision returns the hinted readiness answer at the root unretried, and the handshake throws it before any password is sent.
      await using loopback = await createHttpsLoopback(() => ({ body: "{\"error\":\"starting\"}", contentType: "application/json", headers: { "retry-after": "2" },
        status: 503 }));
      await using transport = new Transport({ host: loopback.host, origin: loopback.origin });

      const auth = new AuthSession({ transport });

      await assert.rejects(auth.login({ ...CREDENTIALS, host: loopback.host }), { name: "AccessRequestError", statusCode: 503 });
      assert.equal(loopback.hits.length, 1);
      assert.deepEqual(loopback.hits.map((hit) => hit.body.toString("utf8")), [""], "the empty root read alone, and no credential body");
      assert.equal(auth.isAuthenticated, false);
    });

    test("a refused sign-in over the owned pool posts its login once", async () => {

      // The root answers 200 with no CSRF token and every later request is refused, so a handshake that read the root again after the refusal, or posted a second
      // login, would reach a third request.
      await using loopback = await createHttpsLoopback((hit) => ((hit === 1) ? { body: "{}", contentType: "application/json", status: 200 } :
        { body: "{}", contentType: "application/json", status: 401 }));
      await using transport = new Transport({ host: loopback.host, origin: loopback.origin });

      const auth = new AuthSession({ transport });

      await assert.rejects(auth.login({ ...CREDENTIALS, host: loopback.host }), { identity: "credentials", message: REFUSED_SIGN_IN_MESSAGE, name: "AccessAuthError" });
      assert.equal(loopback.hits.length, 2);
      assert.deepEqual(loopback.hits.map((hit) => hit.body.toString("utf8")), [ "", LOGIN_BODY ], "an empty root read, then the credential login");
      assert.equal(auth.isAuthenticated, false);
    });

    test("a login answered 503 over an authenticated session throws AccessRequestError and drops the session cookie", async () => {

      const fixture = makeAuth();
      const { agent, auth, host, pool } = fixture;

      await login(fixture);

      // A login that ends on any non-2xx did not complete, so the cookie of the session before it is cleared although the answer throws rather than reads as a
      // refused sign-in.
      interceptRoot(pool);
      pool.intercept({ method: "POST", path: LOGIN_PATH }).reply(503, "rebooting");

      await assert.rejects(auth.login({ ...CREDENTIALS, host }), { name: "AccessRequestError", statusCode: 503 });
      assert.equal(auth.isAuthenticated, false);
      assert.equal(auth.authHeaders()["cookie"], undefined);
      agent.assertNoPendingInterceptors();
    });

    /* A status that names the controller's readiness at the root - a 429 limiting requests, or a status the transport retries as the answer a controller rebooting
     * or starting a service gives - means the controller is not placed to judge a sign-in, so the root's classified error surfaces and no password is sent. No
     * login is answered, so a login posted after the root would fail as a network error instead.
     */
    for(const status of [ 429, ...ACCESS_API_RETRY_PROFILE.statusCodes ]) {

      test("a controller root answered " + String(status) + " throws AccessRequestError before any login is posted", async () => {

        const { agent, auth, host, pool } = makeAuth();

        pool.intercept({ method: "GET", path: ROOT_PATH }).reply(status, "not ready");

        await assert.rejects(auth.login({ ...CREDENTIALS, host }), { name: "AccessRequestError", statusCode: status });
        assert.equal(auth.isAuthenticated, false);
        agent.assertNoPendingInterceptors();
      });
    }

    /* A root answer that is neither a 2xx nor a readiness answer - a 3xx, a 401, or a 5xx the transport does not retry - stamps no token, even one it carries, so
     * the one login goes without one and its 401 is read as the refused sign-in it is. The login intercept answers only a login carrying no token, and the
     * refusal is read by the login's own sentence, which a root that threw for itself would not carry.
     */
    for(const status of [ 302, 401, 501 ]) {

      test("a controller root answered " + String(status) + " posts one login without a token, whose 401 throws AccessAuthError", async () => {

        const { agent, auth, host, pool } = makeAuth();

        pool.intercept({ method: "GET", path: ROOT_PATH }).reply(status, "unread", { headers: { "x-csrf-token": "unread" } });
        pool.intercept({ headers: (headers) => !("x-csrf-token" in headers), method: "POST", path: LOGIN_PATH }).reply(401, "bad creds");

        await assert.rejects(auth.login({ ...CREDENTIALS, host }), { identity: "credentials", message: REFUSED_SIGN_IN_MESSAGE, name: "AccessAuthError" });
        assert.equal(auth.isAuthenticated, false);
        agent.assertNoPendingInterceptors();
      });
    }

    test("treats a 2xx login that omits the cookie or CSRF token as a failure", async () => {

      const { agent, auth, host, pool } = makeAuth();

      // The controller answered 200 but without a Set-Cookie - the session is incomplete, so the handshake must fail closed rather than report success.
      interceptRoot(pool);
      pool.intercept({ method: "POST", path: LOGIN_PATH }).reply(200, "", { headers: { "x-csrf-token": "csrf1" } });

      await assert.rejects(auth.login({ ...CREDENTIALS, host }), AccessAuthError);
      assert.equal(auth.isAuthenticated, false);

      // The other half: a 200 that carries the Set-Cookie but no CSRF token is just as incomplete.
      interceptRoot(pool);
      pool.intercept({ method: "POST", path: LOGIN_PATH }).reply(200, "", { headers: { "set-cookie": "TOKEN=abc" } });

      await assert.rejects(auth.login({ ...CREDENTIALS, host }), AccessAuthError);
      assert.equal(auth.isAuthenticated, false);
      agent.assertNoPendingInterceptors();
    });

    test("retains its own copy of the credentials, so a caller clearing them cannot hollow out relogin", async () => {

      const { agent, auth, host, pool } = makeAuth();

      // A caller that scrubs its secret after login is a reasonable thing to do with a password. The session must have taken a copy, or relogin would later send
      // an emptied credential.
      const mutable = { host, password: "p", username: "u" };

      interceptRoot(pool);
      replyLogin(pool, "TOKEN=abc", "csrf1");
      await auth.login(mutable);

      mutable.password = "";

      interceptRoot(pool);
      pool.intercept({ body: LOGIN_BODY, method: "POST", path: LOGIN_PATH }).reply(200, "", { headers: { "set-cookie": "TOKEN=new", "x-csrf-token": "csrf2" } });

      assert.equal(await auth.reauthenticate(), true, "the relogin must send the password the session was given, not the caller's scrubbed copy");
      agent.assertNoPendingInterceptors();
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
      const { agent, auth, host, pool } = fixture;

      await login(fixture);

      // The relogin reads a fresh token rather than offering the one the session holds: its root answers with a token unlike the session's, and the login intercept
      // answers only a login carrying that fresh token.
      interceptRoot(pool, "root2");
      pool.intercept({ headers: { "x-csrf-token": "root2" }, method: "POST", path: LOGIN_PATH })
        .reply(200, "", { headers: { "set-cookie": "TOKEN=new", "x-csrf-token": "csrf2" } });

      assert.equal(await auth.reauthenticate(), true);
      assert.deepEqual(auth.authHeaders(), { cookie: "TOKEN=new", "x-csrf-token": "csrf2" }, "reauthenticate must replace the session with the freshly issued one");

      // The interception above already proved the handshake targeted the login endpoint - had the URL been wrong, that interceptor would not have matched. This
      // instead checks the url() helper composes the origin the way the rest of the suite assumes.
      assert.equal(url(host, LOGIN_PATH), "https://" + host + LOGIN_PATH);
      agent.assertNoPendingInterceptors();
    });

    test("a relogin whose controller root gives no token posts a login carrying none, though the transport stamps the session's headers", async () => {

      const fixture = makeWiredAuth();
      const { agent, auth, pool } = fixture;

      await login(fixture);

      // The relogin's root answers with no token, and the login intercept answers only a login carrying none. The wired transport stamps the session's headers
      // beneath each request's own, so a token the session kept from its last login would miss it.
      interceptRoot(pool);
      pool.intercept({ headers: (headers) => !("x-csrf-token" in headers), method: "POST", path: LOGIN_PATH })
        .reply(200, "", { headers: { "set-cookie": "TOKEN=new", "x-csrf-token": "csrf2" } });

      assert.equal(await auth.reauthenticate(), true);
      assert.deepEqual(auth.authHeaders(), { cookie: "TOKEN=new", "x-csrf-token": "csrf2" });
      agent.assertNoPendingInterceptors();
    });

    test("a failed relogin leaves the session unauthenticated but keeps the credentials for a later attempt", async () => {

      const fixture = makeAuth();
      const { agent, auth, pool } = fixture;

      await login(fixture);

      interceptRoot(pool);
      pool.intercept({ method: "POST", path: LOGIN_PATH }).reply(401, "rejected");

      assert.equal(await auth.reauthenticate(), false);
      assert.equal(auth.isAuthenticated, false, "the stale cookie is dropped so a later relogin starts clean");

      // The credentials survived, so a subsequent attempt can still recover.
      interceptRoot(pool);
      pool.intercept({ method: "POST", path: LOGIN_PATH }).reply(200, "", { headers: { "set-cookie": "TOKEN=later", "x-csrf-token": "csrf3" } });

      assert.equal(await auth.reauthenticate(), true);
      agent.assertNoPendingInterceptors();
    });

    test("publishes the relogin outcome on the auth:relogin channel in all three legal states", async () => {

      const fixture = makeAuth();
      const { agent, auth, host, pool } = fixture;

      await login(fixture);

      const payloads = await captureRelogin(async () => {

        // Credentials held and the handshake succeeded.
        interceptRoot(pool);
        pool.intercept({ method: "POST", path: LOGIN_PATH }).reply(200, "", { headers: { "set-cookie": "TOKEN=new", "x-csrf-token": "csrf2" } });
        assert.equal(await auth.reauthenticate(), true);

        // Credentials held and the handshake was refused - the session is attributable even though it could not be recovered.
        interceptRoot(pool);
        pool.intercept({ method: "POST", path: LOGIN_PATH }).reply(401, "rejected");
        assert.equal(await auth.reauthenticate(), false);

        // No credentials at all, so there is no host to attribute the attempt to and it cannot have succeeded.
        auth.logout();
        assert.equal(await auth.reauthenticate(), false);
      });

      assert.deepEqual(payloads, [ { host, success: true }, { host, success: false }, { host: null, success: false } ]);
      agent.assertNoPendingInterceptors();
    });

    test("coalesces concurrent relogins into a single handshake", async () => {

      const fixture = makeWiredAuth();
      const { agent, host, pool } = fixture;

      await login(fixture);

      let loginPosts = 0;
      let rootReads = 0;
      let secondRefusalSeen = false;

      /* Two independent requests each come back 401 and each invoke the relogin hook. The handshake is held until the test releases it, and the release waits
       * on the second refusal, so the second 401 arrives while the first handshake is still in flight - the window the coalescing exists for. The root and the
       * login are each registered twice so that a second handshake would find a root answer and a login answer waiting - the counts, not a missing interceptor, are
       * what fail this test if the guard is gone, and the spare of each is what is left pending once the shared handshake is done.
       */
      const handshake = heldReply(200, "", { headers: { "set-cookie": "TOKEN=new", "x-csrf-token": "csrf2" } });

      pool.intercept({ method: "GET", path: "/one" }).reply(401, "stale");
      pool.intercept({ method: "GET", path: "/one" }).reply(200, { ok: 1 });
      pool.intercept({ method: "GET", path: "/two" }).reply(401, () => {

        secondRefusalSeen = true;

        return "stale";
      });
      pool.intercept({ method: "GET", path: "/two" }).reply(200, { ok: 2 });
      pool.intercept({ method: "GET", path: ROOT_PATH }).reply(200, () => {

        rootReads++;

        return "";
      }).times(2);
      pool.intercept({ method: "POST", path: LOGIN_PATH }).reply((opts) => {

        loginPosts++;

        return handshake.reply(opts);
      }).times(2);

      const pair = Promise.all([ fixture.transport.send(url(host, "/one")), fixture.transport.send(url(host, "/two")) ]);

      await settleUntil(() => secondRefusalSeen, { description: "the second request to be refused while the handshake was still in flight" });
      handshake.release();

      const [ first, second ] = await pair;

      assert.equal(first.statusCode, 200, "the first request retried successfully after the shared relogin");
      assert.equal(second.statusCode, 200, "the second request retried successfully off the same relogin");
      assert.equal(rootReads, 1, "two concurrent 401s must read the controller root once rather than once per relogin");
      assert.equal(loginPosts, 1, "two concurrent 401s must produce exactly one handshake rather than two racing each other");
      assert.equal(agent.pendingInterceptors().length, 2, "the spare root answer and the spare login answer are the only interceptors left unused");
    });

    test("a relogin whose handshake throws publishes its outcome and surfaces its own failure, a probe's relogin reaching the controller past the open breaker",
      async () => {

        const fixture = makeWiredAuth();
        const { agent, auth, host, pool, transport } = fixture;

        await login(fixture);

        // Trip the breaker. The request that triggers the relogin is the recovery probe, which bypasses the gate, and the relogin it triggers carries its mark, so
        // the relogin's read of the controller root reaches the controller rather than being refused locally.
        pool.intercept({ method: "GET", path: "/f" }).reply(500, "x").times(ACCESS_API_ERROR_LIMIT);

        for(let index = 0; index < ACCESS_API_ERROR_LIMIT; index++) {

          // eslint-disable-next-line no-await-in-loop
          await transport.send(url(host, "/f"));
        }

        assert.equal(transport.isThrottled, true);

        // The root's readiness answer throws before any login is posted, so no login is answered.
        pool.intercept({ method: "GET", path: "/guarded" }).reply(401, "stale");
        pool.intercept({ method: "GET", path: ROOT_PATH }).reply(503, "rebooting");

        const payloads = await captureRelogin(async () => {

          // The probe's outcome is its relogin's: the controller root answered the handshake that the controller is not ready yet, which is what the probe reports,
          // rather than the 401 it began with or a throttle refusal of a relogin it was entitled to send.
          await assert.rejects(transport.send(url(host, "/guarded"), { probe: true }), { name: "AccessRequestError", statusCode: 503 });
        });

        assert.deepEqual(payloads, [{ host, success: false }], "a handshake that threw is still a relogin outcome a consumer should see");
        assert.equal(auth.isAuthenticated, false);
        assert.equal(transport.isThrottled, true, "the root's 503 booked a failure, so the breaker stays open");
        agent.assertNoPendingInterceptors();
      });

    test("a recovery probe answered 401 while the breaker is open relogs in through it, and the relogin's first serving answer closes the breaker", async () => {

      const fixture = makeWiredAuth();
      const { agent, auth, host, pool, transport } = fixture;

      await login(fixture);

      pool.intercept({ method: "GET", path: "/f" }).reply(500, "x").times(ACCESS_API_ERROR_LIMIT);

      for(let index = 0; index < ACCESS_API_ERROR_LIMIT; index++) {

        // eslint-disable-next-line no-await-in-loop
        await transport.send(url(host, "/f"));
      }

      assert.equal(transport.isThrottled, true);

      // A session that expired during the outage: the probe meets a 401, its relogin reaches the controller and signs in afresh, and the probe is retried once. The
      // relogin's root read is the first answer the controller serves, so it is what closes the breaker.
      pool.intercept({ method: "GET", path: "/guarded" }).reply(401, "stale");
      interceptRoot(pool);
      replyLogin(pool, "TOKEN=second; Path=/", "csrf2");
      pool.intercept({ method: "GET", path: "/guarded" }).reply(200, { ok: 1 });

      const response = await transport.send(url(host, "/guarded"), { probe: true });

      assert.equal(response.statusCode, 200, "the retried probe carries the controller's answer");
      assert.equal(auth.isAuthenticated, true, "the relogin re-established the session");
      assert.equal(transport.isThrottled, false, "a controller that served the relogin and the probe is no longer paused");
      agent.assertNoPendingInterceptors();
    });

    test("a probe's relogin under the open breaker reads a controller root answered 501, and still posts its probe-marked login through the breaker", async () => {

      const fixture = makeWiredAuth();
      const { agent, auth, host, pool, transport } = fixture;

      await login(fixture);

      pool.intercept({ method: "GET", path: "/f" }).reply(500, "x").times(ACCESS_API_ERROR_LIMIT);

      for(let index = 0; index < ACCESS_API_ERROR_LIMIT; index++) {

        // eslint-disable-next-line no-await-in-loop
        await transport.send(url(host, "/f"));
      }

      assert.equal(transport.isThrottled, true);

      /* The probe meets a 401, and its relogin's root answers 501: no readiness answer, so nothing throws, and no 2xx, so no token is read and no success is booked,
       * the 5xx re-arming the cooldown instead. The breaker is still open when the login is sent, so the login reaches the controller only because it carries the
       * probe's mark, and its 200 is what closes the breaker. The login intercept answers only a login carrying no token.
       */
      pool.intercept({ method: "GET", path: "/guarded" }).reply(401, "stale");
      pool.intercept({ method: "GET", path: ROOT_PATH }).reply(501, "not implemented");
      pool.intercept({ headers: (headers) => !("x-csrf-token" in headers), method: "POST", path: LOGIN_PATH })
        .reply(200, "", { headers: { "set-cookie": "TOKEN=second; Path=/", "x-csrf-token": "csrf2" } });
      pool.intercept({ method: "GET", path: "/guarded" }).reply(200, { ok: 1 });

      const response = await transport.send(url(host, "/guarded"), { probe: true });

      assert.equal(response.statusCode, 200, "the retried probe carries the controller's answer");
      assert.equal(auth.isAuthenticated, true, "the probe-marked login re-established the session");
      assert.equal(transport.isThrottled, false, "the login's 200 is the relogin's first serving answer, and it closes the breaker");
      agent.assertNoPendingInterceptors();
    });

    for(const status of [ 503, 429 ]) {

      test("a 401 whose relogin is answered " + String(status) + " throws that status rather than the refused sign-in it never met", async () => {

        const fixture = makeWiredAuth();
        const { agent, host, pool, transport } = fixture;

        await login(fixture);

        pool.intercept({ method: "GET", path: "/r" }).reply(401, "stale");
        interceptRoot(pool);
        pool.intercept({ method: "POST", path: LOGIN_PATH }).reply(status, "not ready");

        await assert.rejects(transport.send(url(host, "/r")), { name: "AccessRequestError", statusCode: status });
        agent.assertNoPendingInterceptors();
      });
    }

    test("relogins whose root answers 503 in a row trip the breaker, each booking the root's answer and nothing for the 401 that triggered it", async () => {

      const fixture = makeWiredAuth();
      const { agent, host, pool, transport } = fixture;

      await login(fixture);

      // Each round's controller root is answered by a controller not ready yet, which books a failure and throws before any login is posted. The 401 that triggered
      // it books nothing, so the count climbs one per round rather than resetting on an answer that only seemed to come from a controller that served it.
      for(let index = 0; index < ACCESS_API_ERROR_LIMIT; index++) {

        pool.intercept({ method: "GET", path: "/r" }).reply(401, "stale");
        pool.intercept({ method: "GET", path: ROOT_PATH }).reply(503, "not ready");

        // eslint-disable-next-line no-await-in-loop
        await assert.rejects(transport.send(url(host, "/r")), { name: "AccessRequestError", statusCode: 503 });
      }

      assert.equal(transport.isThrottled, true, "a run of failed relogins is a controller not serving, and trips the breaker");
      agent.assertNoPendingInterceptors();
    });

    test("the handshake does not recurse into relogin on its own 401", async () => {

      const fixture = makeWiredAuth();
      const { agent, auth, host, pool } = fixture;

      // The login POST itself is refused. Were the handshake to travel the ordinary authenticated path, that 401 would invoke the relogin hook, which would read the
      // root and post another login, and so on. Exactly one root answer and one login answer are registered, so a recursion would fail to find an interceptor.
      interceptRoot(pool);
      pool.intercept({ method: "POST", path: LOGIN_PATH }).reply(401, "bad creds");

      const payloads = await captureRelogin(async () => {

        await assert.rejects(auth.login({ ...CREDENTIALS, host }), AccessAuthError);
      });

      assert.deepEqual(payloads, [], "a login handshake must not publish a relogin outcome, because it never entered relogin");
      agent.assertNoPendingInterceptors();
    });

    test("a relogin whose controller root answers 401 posts its login without re-entering relogin", async () => {

      const fixture = makeWiredAuth();
      const { agent, auth, host, pool, transport } = fixture;

      await login(fixture);

      /* The request's 401 sends the wired session into relogin, and the relogin's root read is answered 401 as well. The handshake sends that read without relogin
       * allowed, because a root 401 would otherwise call back into the relogin it belongs to, whose coalescing gate answers that call with the relogin's own
       * promise, so the read would wait on itself. The root's 401 yields no token, and the login intercept answers only a login carrying none.
       */
      pool.intercept({ method: "GET", path: "/r" }).reply(401, "stale");
      pool.intercept({ method: "GET", path: ROOT_PATH }).reply(401, "unauthorized");
      pool.intercept({ headers: (headers) => !("x-csrf-token" in headers), method: "POST", path: LOGIN_PATH })
        .reply(200, "", { headers: { "set-cookie": "TOKEN=second; Path=/", "x-csrf-token": "csrf2" } });
      pool.intercept({ method: "GET", path: "/r" }).reply(200, { ok: 1 });

      const response = await transport.send(url(host, "/r"));

      assert.equal(response.statusCode, 200, "the retried request carries the controller's answer");
      assert.deepEqual(auth.authHeaders(), { cookie: "TOKEN=second", "x-csrf-token": "csrf2" }, "the relogin's login established the new session");
      agent.assertNoPendingInterceptors();
    });

    test("a logout while a relogin reads the controller root posts no login and leaves the session ended", async () => {

      const fixture = makeAuth();
      const { agent, auth, pool } = fixture;
      const methods: string[] = [];

      await login(fixture);

      /* The relogin's root answers with a token, but the logout below ends the session client-side while the root is read: the relogin must send no password and
       * write nothing, so the session the caller ended stays ended. The root's answer is held until the test releases it, so the logout provably lands inside the
       * root read.
       */
      const root = heldReply(200, "", { headers: { "x-csrf-token": "stale" } });

      pool.intercept({ method: "GET", path: ROOT_PATH }).reply(root.reply);

      using startSubscription = subscribeTo(channels.httpRequestStart, (payload) => void methods.push(payload.method));

      const pending = auth.reauthenticate();

      auth.logout();
      root.release();

      assert.equal(await pending, false, "a relogin whose session ended while it read the root reports failure");
      assert.deepEqual(methods, ["GET"], "the relogin reads the root and posts no login");
      assert.equal(auth.isAuthenticated, false);
      assert.deepEqual(auth.authHeaders(), {});
      assert.equal(auth.sessionCookie, null);
      agent.assertNoPendingInterceptors();
    });

    test("a relogin whose login succeeds after a logout does not resurrect the session", async () => {

      const fixture = makeAuth();
      const { agent, auth, pool } = fixture;

      await login(fixture);

      let loginSent = false;

      /* The controller never hears about a logout - it is client-side state - so a login already in flight succeeds regardless. Writing that session would
       * silently re-arm a session the caller explicitly ended, which is what the identity check at the write site prevents. The login is held until the test
       * releases it, and the logout lands once the login is sent, so it provably lands inside the login rather than while the root is read.
       */
      const handshake = heldReply(200, "", { headers: { "set-cookie": "TOKEN=resurrected", "x-csrf-token": "csrf9" } });

      interceptRoot(pool, "fetched");
      pool.intercept({ method: "POST", path: LOGIN_PATH }).reply(handshake.reply);

      using startSubscription = subscribeTo(channels.httpRequestStart, (payload) => {

        if(payload.method === "POST") {

          loginSent = true;
        }
      });

      const pending = auth.reauthenticate();

      await settleUntil(() => loginSent, { description: "the relogin's login to be sent before the logout lands" });
      auth.logout();
      handshake.release();

      assert.equal(await pending, false, "a handshake that outlived its session reports failure rather than success");
      assert.equal(auth.isAuthenticated, false);
      assert.deepEqual(auth.authHeaders(), {});
      assert.equal(auth.sessionCookie, null);
      agent.assertNoPendingInterceptors();
    });

    test("a relogin whose root read outlasts a fresh login posts nothing and leaves the fresh session intact", async () => {

      const fixture = makeAuth();
      const { agent, auth, host, pool } = fixture;
      const methods: string[] = [];

      await login(fixture);

      /* The relogin's root answers with a token, held until the test releases it after the fresh login below. The session changed while the relogin read its root,
       * so the relogin posts nothing and fails, and neither the token its root handed it nor its failure may touch the session the fresh login owns. The fresh
       * login reads the second root answer and posts the one login answered.
       */
      const staleRoot = heldReply(200, "", { headers: { "x-csrf-token": "stale" } });

      pool.intercept({ method: "GET", path: ROOT_PATH }).reply(staleRoot.reply);
      interceptRoot(pool);
      replyLogin(pool, "TOKEN=fresh", "csrf2");

      using startSubscription = subscribeTo(channels.httpRequestStart, (payload) => void methods.push(payload.method));

      const relogin = auth.reauthenticate();

      await auth.login({ ...CREDENTIALS, host });
      staleRoot.release();

      assert.equal(await relogin, false, "a relogin whose session was replaced while it read the root reports failure");
      assert.deepEqual(methods, [ "GET", "GET", "POST" ], "the relogin reads its root and posts nothing, and the fresh login reads its own and posts its login");
      assert.equal(auth.isAuthenticated, true);
      assert.deepEqual(auth.authHeaders(), { cookie: "TOKEN=fresh", "x-csrf-token": "csrf2" }, "the failed relogin must not touch the session that replaced it");
      agent.assertNoPendingInterceptors();
    });

    test("a relogin whose login is refused after a fresh login leaves the fresh session intact", async () => {

      const fixture = makeAuth();
      const { agent, auth, host, pool } = fixture;

      await login(fixture);

      let reloginSent = false;

      /* The relogin's login POST is held until the test releases it and will be refused. Once it is sent the caller logs out and logs in afresh, so by the time
       * that failure lands it describes a session that no longer exists. A fresh login does not queue behind an in-flight relogin, which is what makes the overlap
       * reachable, and it begins only once the relogin's login is sent, because a session replaced while the relogin still reads its root posts nothing.
       */
      const refusal = heldReply(401, "rejected");

      interceptRoot(pool);
      pool.intercept({ method: "POST", path: LOGIN_PATH }).reply(refusal.reply);

      using startSubscription = subscribeTo(channels.httpRequestStart, (payload) => {

        if(payload.method === "POST") {

          reloginSent = true;
        }
      });

      const stale = auth.reauthenticate();

      await settleUntil(() => reloginSent, { description: "the relogin's login to be sent before the fresh login begins" });
      auth.logout();
      interceptRoot(pool);
      replyLogin(pool, "TOKEN=second; Path=/", "csrf2");

      await auth.login({ ...CREDENTIALS, host });

      // The replacement session earns its own verdict before the stale failure lands, so a failure that reached it would show as that verdict going unreported.
      await driveAdminTrue(fixture);

      refusal.release();

      assert.equal(await stale, false, "the stale handshake still reports its own failure");
      assert.equal(auth.isAuthenticated, true, "the replacement session survives a failure that was never about it");
      assert.deepEqual(auth.authHeaders(), { cookie: "TOKEN=second", "x-csrf-token": "csrf2" });
      assert.equal(auth.isAdmin, true, "and so does the privilege verdict it earned");
      agent.assertNoPendingInterceptors();
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

    // A controller not ready yet or limiting requests hands its answer back as the status it was, and neither is a verdict on the account's privilege.
    for(const status of [ 503, 429, 404 ]) {

      test("keeps the previous verdict when the controller answers the check " + String(status), async () => {

        const fixture = makeAuth();
        const { auth, pool } = fixture;

        await login(fixture);
        await driveAdminTrue(fixture);

        pool.intercept({ method: "GET", path: SELF_PATH }).reply(status, "not ready");

        assert.equal(await auth.refreshAdminStatus(), true, "a " + String(status) + " says nothing about the account");
        assert.equal(auth.isAdmin, true);
      });
    }

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

    test("reports undetermined when the check's own relogin fails, because no session is held to report for", async () => {

      const fixture = makeWiredAuth();
      const { agent, auth, pool } = fixture;

      await login(fixture);
      await driveAdminTrue(fixture);

      // The check's 401 sends the transport into relogin, and the relogin's login is answered by a controller not ready yet, so the check learns nothing and the
      // handshake that failed has dropped the session's cookie.
      pool.intercept({ method: "GET", path: SELF_PATH }).reply(401, "stale");
      interceptRoot(pool);
      pool.intercept({ method: "POST", path: LOGIN_PATH }).reply(503, "not ready");

      assert.equal(await auth.refreshAdminStatus(), null, "a check whose own relogin failed reports no verdict for a session that is gone");
      assert.equal(auth.isAuthenticated, false);
      assert.equal(auth.isAdmin, null, "the verdict is reported only while a session is held");
      agent.assertNoPendingInterceptors();
    });

    for(const { loginStatus, name } of [ { loginStatus: 503, name: "answered by a controller not ready yet" }, { loginStatus: 401, name: "refused" } ] as const) {

      test("reports undetermined once an ordinary request's relogin is " + name, async () => {

        const fixture = makeWiredAuth();
        const { auth } = fixture;

        await login(fixture);
        await driveAdminTrue(fixture);
        await failRelogin(fixture, loginStatus);

        assert.equal(auth.isAuthenticated, false, "the failed relogin dropped the session's cookie");
        assert.equal(auth.isAdmin, null, "a session that lost its cookie reports no privilege it no longer demonstrates");
      });
    }

    test("reports the recorded verdict again once a later request's relogin re-establishes the session", async () => {

      const fixture = makeWiredAuth();
      const { agent, auth, host, pool, transport } = fixture;

      await login(fixture);
      await driveAdminTrue(fixture);
      await failRelogin(fixture, 503);

      assert.equal(auth.isAdmin, null, "no verdict is reported while no session is held");

      // The next request goes out without a cookie and meets a 401, its relogin signs in afresh, and the request is retried once. Nothing re-runs the privilege
      // check, so the verdict that reads again is the one recorded for these credentials before the session was lost.
      pool.intercept({ method: "GET", path: "/r2" }).reply(401, "no session");
      interceptRoot(pool);
      replyLogin(pool, "TOKEN=second; Path=/", "csrf2");
      pool.intercept({ method: "GET", path: "/r2" }).reply(200, { ok: 1 });

      assert.equal((await transport.send(url(host, "/r2"))).statusCode, 200, "the retried request carries the controller's answer");
      assert.equal(auth.isAuthenticated, true, "the relogin re-established the session");
      assert.equal(auth.isAdmin, true, "the credentials' recorded verdict reads again once a session is held");
      agent.assertNoPendingInterceptors();
    });

    test("reports undetermined when the check's answer lands after another request's relogin failed", async () => {

      const fixture = makeWiredAuth();
      const { auth, pool } = fixture;

      await login(fixture);
      await driveAdminTrue(fixture);

      let checkSent = false;

      /* The check reaches the controller under the session's cookie and its answer is held. Another request then meets a 401 whose relogin fails, which drops the
       * cookie while the credentials stay current, so the held answer granting privilege lands on a session that no longer holds one. The reply is held until the
       * test releases it, which is what puts the failed relogin inside the check.
       */
      const verdict = heldReply(200, { scopes: [ADMIN_SCOPE] });

      pool.intercept({ method: "GET", path: SELF_PATH }).reply((opts) => {

        checkSent = true;

        return verdict.reply(opts);
      });

      const pending = auth.refreshAdminStatus();

      await settleUntil(() => checkSent, { description: "the privilege check to reach the controller before the other request's relogin fails" });
      await failRelogin(fixture, 503);
      verdict.release();

      assert.equal(await pending, null, "a verdict that lands after the session lost its cookie is not reported");
      assert.equal(auth.isAuthenticated, false);
      assert.equal(auth.isAdmin, null, "the late verdict is not reported while no session is held");
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

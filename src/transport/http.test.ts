/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * http.test.ts: Unit tests for the HTTP transport - the send/request surface, AccessResponse decoding and ensureOk classification, transport-error classification
 * (timeout vs caller-abort vs network), the base and auth headers, the 401-relogin retry, and the full throttle circuit-breaker state machine
 * (closed -> open -> half-open -> closed).
 *
 * Every path is driven deterministically: an undici MockAgent injects responses and failures without a live controller, and a fake Clock advances breaker time
 * without real-time waits. The injected dispatcher and clock let these tests assert the controller's throttle and retry behavior - the established behavioral
 * contract - exactly and without flakiness.
 */
import { ACCESS_API_ERROR_LIMIT, ACCESS_API_RETRY_INTERVAL, ACCESS_API_TIMEOUT } from "../settings.ts";
import { AccessAbortedError, AccessAuthError, AccessAuthorizationError, AccessCertificateError, AccessNetworkError, AccessProtocolError, AccessRequestError,
  AccessThrottledError, AccessTimeoutError } from "../errors.ts";
import type { AccessHttpRequestEndPayload, AccessHttpRequestStartPayload, AccessHttpThrottleEnteredPayload,
  AccessHttpThrottleExitedPayload } from "../diagnostics.ts";
import { DIAL_CUT_BOUND_MS, createHttpsLoopback, createSilentLoopback, elapsedSince } from "./loopback.helpers.ts";
import { TestClock, capturingLog, settle, silentLog } from "homebridge-plugin-utils/testing";
import { Transport, controllerReachable, responseOk } from "./http.ts";
import { assertRejectsWith, errnoError, present, subscribeTo } from "../testing.helpers.ts";
import { describe, test } from "node:test";
import { makeMockTransport, url } from "./mock-controller.helpers.ts";
import assert from "node:assert/strict";
import { channels } from "../diagnostics.ts";
import { errors } from "undici";

// The breaker cooldown in milliseconds, mirroring the transport's own derivation, so the fake-clock advances line up with the gate math.
const COOLDOWN_MS = ACCESS_API_RETRY_INTERVAL * 1000;

// Drive `count` sequential failing requests through the transport against a path the caller has set up to fail. Sequential awaits are intentional - the breaker
// counts consecutive failures in order.
async function sendFailures(transport: Transport, target: string, count: number): Promise<void> {

  for(let index = 0; index < count; index++) {

    // eslint-disable-next-line no-await-in-loop
    await transport.send(target);
  }
}

describe("Transport", () => {

  describe("send and AccessResponse", () => {

    test("returns an AccessResponse on 2xx with the parsed JSON body available", async () => {

      const { host, pool, transport } = makeMockTransport();

      pool.intercept({ method: "GET", path: "/ok" }).reply(200, { hello: "world" });

      const response = await transport.send(url(host, "/ok"));

      assert.equal(response.statusCode, 200);
      assert.deepEqual(response.json<{ hello: string }>(), { hello: "world" });
    });

    test("exposes the raw body bytes for binary payloads", async () => {

      const { host, pool, transport } = makeMockTransport();
      const bytes = Buffer.from([ 0, 1, 2, 255 ]);

      pool.intercept({ method: "GET", path: "/bin" }).reply(200, bytes, { headers: { "content-type": "application/octet-stream" } });

      const response = await transport.send(url(host, "/bin"));

      assert.deepEqual([...response.body], [ 0, 1, 2, 255 ], "the body must be the raw bytes, untouched by JSON decoding");
    });

    test("does not throw on a non-2xx status - the status is surfaced on the response", async () => {

      const { host, pool, transport } = makeMockTransport();

      pool.intercept({ method: "GET", path: "/missing" }).reply(404, "nope");

      const response = await transport.send(url(host, "/missing"));

      assert.equal(response.statusCode, 404, "send returns the response for any status rather than throwing");
    });

    test("json throws AccessProtocolError on a malformed body", async () => {

      const { host, pool, transport } = makeMockTransport();

      pool.intercept({ method: "GET", path: "/bad" }).reply(200, "not-json{", { headers: { "content-type": "application/json" } });

      const response = await transport.send(url(host, "/bad"));

      assert.throws(() => response.json(), AccessProtocolError);
    });

    test("text decodes the body as a UTF-8 string", async () => {

      const { host, pool, transport } = makeMockTransport();

      pool.intercept({ method: "GET", path: "/t" }).reply(200, "plain text");

      const response = await transport.send(url(host, "/t"));

      assert.equal(response.text(), "plain text");
    });
  });

  describe("base headers", () => {

    test("stamps content-type application/json on every request, including a GET carrying no body", async () => {

      const { host, pool, transport } = makeMockTransport();

      // The interceptor matches only when the header is present, so a successful parse proves the transport stamped it without the caller asking. The controller
      // expects the declaration on every request rather than only on the ones with a body.
      pool.intercept({ headers: { "content-type": "application/json" }, method: "GET", path: "/plain" }).reply(200, { ok: 1 });

      assert.deepEqual(await transport.request<{ ok: number }>(url(host, "/plain")), { ok: 1 });
    });

    test("a per-call content-type overrides the transport's own", async () => {

      const { host, pool, transport } = makeMockTransport();

      pool.intercept({ headers: { "content-type": "text/plain" }, method: "POST", path: "/raw" }).reply(200, { ok: 1 });

      assert.deepEqual(await transport.request<{ ok: number }>(url(host, "/raw"), { body: "hi", headers: { "content-type": "text/plain" }, method: "POST" }),
        { ok: 1 });
    });
  });

  describe("ensureOk status classification", () => {

    test("401 classifies as AccessAuthError carrying the status and the credential leg", async () => {

      const { host, pool, transport } = makeMockTransport();

      pool.intercept({ method: "GET", path: "/a" }).reply(401, "denied");

      const response = await transport.send(url(host, "/a"));

      let thrown: unknown;

      try {

        response.ensureOk();
      } catch(error) {

        thrown = error;
      }

      assert.ok(thrown instanceof AccessAuthError, "a 401 surfaces as an authentication error");
      assert.equal(thrown.statusCode, 401);
      assert.equal(thrown.identity, "credentials", "a transport constructed without an identity authenticates with credentials");

      // The message is consumer-facing copy that a caller may render verbatim, so it is asserted exactly rather than matched loosely.
      assert.equal(thrown.message, "Authentication with the UniFi Access controller failed.");
    });

    test("401 on a token transport names the API token rather than the credentials", async () => {

      const { host, pool, transport } = makeMockTransport({ identity: "token" });

      pool.intercept({ method: "GET", path: "/token-401" }).reply(401, "denied");

      const response = await transport.send(url(host, "/token-401"));

      let thrown: unknown;

      try {

        response.ensureOk();
      } catch(error) {

        thrown = error;
      }

      assert.ok(thrown instanceof AccessAuthError, "a 401 surfaces as an authentication error");
      assert.equal(thrown.statusCode, 401);
      assert.equal(thrown.identity, "token");

      // Each leg has its own remedy, so each gets its own sentence: this one sends the reader to the issued token rather than to an account password.
      assert.equal(thrown.message, "The UniFi Access controller rejected the configured API token. Please check that the token is valid and has not been revoked.");
    });

    test("403 classifies as AccessAuthorizationError carrying the status and the credential leg", async () => {

      const { host, pool, transport } = makeMockTransport();

      pool.intercept({ method: "GET", path: "/b" }).reply(403, "forbidden");

      const response = await transport.send(url(host, "/b"));

      let thrown: unknown;

      try {

        response.ensureOk();
      } catch(error) {

        thrown = error;
      }

      assert.ok(thrown instanceof AccessAuthorizationError, "a 403 surfaces as an authorization error");
      assert.equal(thrown.statusCode, 403);
      assert.equal(thrown.identity, "credentials", "a transport constructed without an identity authenticates with credentials");

      // The message is consumer-facing copy that a caller may render verbatim, so it is asserted exactly rather than matched loosely.
      assert.equal(thrown.message, "The account lacks the privileges this operation requires on the UniFi Access controller.");
    });

    test("403 on a token transport names the API token's permissions rather than the account's role", async () => {

      const { host, pool, transport } = makeMockTransport({ identity: "token" });

      pool.intercept({ method: "GET", path: "/token-403" }).reply(403, "forbidden");

      const response = await transport.send(url(host, "/token-403"));

      let thrown: unknown;

      try {

        response.ensureOk();
      } catch(error) {

        thrown = error;
      }

      assert.ok(thrown instanceof AccessAuthorizationError, "a 403 surfaces as an authorization error");
      assert.equal(thrown.statusCode, 403);
      assert.equal(thrown.identity, "token");

      // Each leg has its own remedy, so each gets its own sentence: this one sends the reader to the token's issued permissions rather than to an account role.
      assert.equal(thrown.message, "The configured API token lacks the permissions this operation requires on the UniFi Access controller.");
    });

    test("other non-2xx classify as AccessRequestError carrying status, body, and headers", async () => {

      const { host, pool, transport } = makeMockTransport();

      pool.intercept({ method: "GET", path: "/c" }).reply(500, "boom", { headers: { "x-trace": "abc" } });

      const response = await transport.send(url(host, "/c"));

      let thrown: unknown;

      try {

        response.ensureOk();
      } catch(error) {

        thrown = error;
      }

      assert.ok(thrown instanceof AccessRequestError, "a 500 surfaces as a request error");
      assert.equal(thrown.statusCode, 500);
      assert.equal(thrown.body, "boom");
      assert.equal(thrown.headers?.["x-trace"], "abc");
    });

    test("ensureOk returns the response unchanged on 2xx", async () => {

      const { host, pool, transport } = makeMockTransport();

      pool.intercept({ method: "GET", path: "/ok" }).reply(200, {});

      const response = await transport.send(url(host, "/ok"));

      assert.equal(response.ensureOk(), response, "ensureOk must return the same instance so calls can chain");
    });
  });

  /* The two free predicates the module publishes, asserted across their boundaries rather than through a caller. One deepEqual of a mapped array per predicate is
   * what makes a boundary that moves name the input it moved on, where an equality assertion per code would report only that one of them changed.
   */
  describe("the status predicates", () => {

    test("responseOk answers true for 2xx alone", () => {

      assert.deepEqual([ undefined, 199, 200, 299, 300 ].map(responseOk), [ false, false, true, true, false ]);
    });

    test("controllerReachable answers true for any defined status below 500", () => {

      // A refusal came from a controller that was there to refuse, so the breaker counts it as reachable; only a 5xx or no answer at all says the controller
      // could not serve the request.
      assert.deepEqual([ undefined, 499, 500, 501, 200 ].map(controllerReachable), [ false, true, false, false, true ]);
    });
  });

  describe("request - the JSON sugar over send", () => {

    test("parses the JSON body on 2xx", async () => {

      const { host, pool, transport } = makeMockTransport();

      pool.intercept({ method: "GET", path: "/j" }).reply(200, { value: 5 });

      assert.deepEqual(await transport.request<{ value: number }>(url(host, "/j")), { value: 5 });
    });

    test("throws the classified error on a non-2xx", async () => {

      const { host, pool, transport } = makeMockTransport();

      pool.intercept({ method: "GET", path: "/j" }).reply(404, "missing");

      await assert.rejects(transport.request(url(host, "/j")), AccessRequestError);
    });
  });

  describe("auth headers and 401 relogin", () => {

    test("stamps the auth headers from getAuthHeaders onto every request", async () => {

      const { host, pool, transport } = makeMockTransport({ getAuthHeaders: () => ({ cookie: "session=x", "x-csrf-token": "tok" }) });

      // The interceptor only matches when both auth headers are present, so a successful parse proves they were stamped.
      pool.intercept({ headers: { cookie: "session=x", "x-csrf-token": "tok" }, method: "GET", path: "/secure" }).reply(200, { ok: 1 });

      assert.deepEqual(await transport.request<{ ok: number }>(url(host, "/secure")), { ok: 1 });
    });

    test("a 401 invokes onUnauthorized and retries once when relogin succeeds", async () => {

      let calls = 0;
      const { host, pool, transport } = makeMockTransport({ onUnauthorized: async () => {

        calls++;

        return true;
      } });

      pool.intercept({ method: "GET", path: "/x" }).reply(401, "stale");
      pool.intercept({ method: "GET", path: "/x" }).reply(200, { ok: 1 });

      assert.deepEqual(await transport.request<{ ok: number }>(url(host, "/x")), { ok: 1 });
      assert.equal(calls, 1, "relogin should be attempted exactly once");
    });

    test("a 401 with failed relogin surfaces the 401 response", async () => {

      let calls = 0;
      const { host, pool, transport } = makeMockTransport({ onUnauthorized: async () => {

        calls++;

        return false;
      } });

      pool.intercept({ method: "GET", path: "/x" }).reply(401, "stale");

      const response = await transport.send(url(host, "/x"));

      assert.equal(response.statusCode, 401);
      assert.equal(calls, 1);
      assert.throws(() => response.ensureOk(), AccessAuthError);
    });

    test("authRetry false bypasses relogin entirely", async () => {

      let calls = 0;
      const { host, pool, transport } = makeMockTransport({ onUnauthorized: async () => {

        calls++;

        return true;
      } });

      pool.intercept({ method: "GET", path: "/x" }).reply(401, "stale");

      const response = await transport.send(url(host, "/x"), { authRetry: false });

      assert.equal(response.statusCode, 401);
      assert.equal(calls, 0, "the handshake escape hatch must not recurse into relogin");
    });

    test("a persistent 401 retries only once even when relogin keeps succeeding", async () => {

      let calls = 0;
      const { host, pool, transport } = makeMockTransport({ onUnauthorized: async () => {

        calls++;

        return true;
      } });

      pool.intercept({ method: "GET", path: "/x" }).reply(401, "stale").times(2);

      const response = await transport.send(url(host, "/x"));

      assert.equal(response.statusCode, 401, "the second 401 is returned rather than triggering another relogin");
      assert.equal(calls, 1, "relogin must not spin on a 401 the controller keeps returning");
    });
  });

  describe("transport-error classification", () => {

    test("a caller abort surfaces as AccessAbortedError", async () => {

      const { host, pool, transport } = makeMockTransport();
      const controller = new AbortController();

      // Hold the response open, then abort the in-flight request via the caller's signal - the abort must classify as a caller cancel, not our timeout.
      pool.intercept({ method: "GET", path: "/x" }).reply(200, {}).delay(2000);

      const pending = transport.send(url(host, "/x"), { signal: controller.signal });

      controller.abort();

      await assert.rejects(pending, AccessAbortedError);
    });

    test("our timeout deadline surfaces as AccessTimeoutError", async () => {

      const { clock, host, pool, transport } = makeMockTransport();

      /* undici installs a request's abort hook at dispatch, so a reply the mock holds open by its own delay is what stays in flight long enough for the deadline
       * to end it; a reply the test releases by hand would sit ahead of that hook and never be reached by an abort at all. The deadline is the injected clock's,
       * so firing it is an advance rather than a real wait.
       */
      pool.intercept({ method: "GET", path: "/slow" }).reply(200, {}).delay(2000);

      const pending = transport.send(url(host, "/slow"));

      await settle();
      clock.advance(ACCESS_API_TIMEOUT);

      await assert.rejects(pending, AccessTimeoutError);
    });

    test("a caller's timeout option sets the deadline", async () => {

      const { clock, host, pool, transport } = makeMockTransport();

      pool.intercept({ method: "GET", path: "/slow" }).reply(200, {}).delay(2000);

      const pending = transport.send(url(host, "/slow"), { timeout: 50 });

      // The rejection is observed here as well as by the assertion below, so reading the flag never leaves the request's failure unhandled in the meantime.
      let settled = false;
      const observed = pending.then((): void => undefined, (): void => undefined).then((): void => {

        settled = true;
      });

      await settle();
      clock.advance(49);
      await settle();

      assert.equal(settled, false, "a deadline one millisecond short of the caller's value must leave the request in flight");

      clock.advance(1);

      // The elapsed time the error carries is the injected clock's own measurement, which is what makes the caller's value and the reported one the same number.
      await assert.rejects(pending, (error: unknown) => (error instanceof AccessTimeoutError) && (error.elapsedMs === 50));
      await observed;
    });

    test("a socket-level failure surfaces as AccessNetworkError with the errno code", async () => {

      const { host, pool, transport } = makeMockTransport();
      const errno = errnoError("connect ECONNREFUSED", "ECONNREFUSED");

      pool.intercept({ method: "GET", path: "/x" }).replyWithError(errno);

      await assert.rejects(transport.send(url(host, "/x")), (error: unknown) => (error instanceof AccessNetworkError) && (error.code === "ECONNREFUSED"));
    });

    test("a pool destroyed under an in-flight request surfaces as AccessNetworkError", async () => {

      const { host, pool, transport } = makeMockTransport();
      const destroyed = new errors.ClientDestroyedError();

      // This is what our own reset() does to requests already in flight when the breaker trips. It is recoverable: the caller may retry against the rebuilt pool.
      pool.intercept({ method: "GET", path: "/x" }).replyWithError(destroyed);

      await assert.rejects(transport.send(url(host, "/x")),
        (error: unknown) => (error instanceof AccessNetworkError) && (error.cause === destroyed) && error.message.includes("connection pool was reset"));
    });

    test("exhausted retries surface as AccessNetworkError", async () => {

      const { host, pool, transport } = makeMockTransport();
      const exhausted = new errors.RequestRetryError("retry limit reached", 503, {});

      // The retry interceptor gave up without ever producing a usable response, so the controller was unreachable for the whole attempt window rather than for one
      // request.
      pool.intercept({ method: "GET", path: "/x" }).replyWithError(exhausted);

      await assert.rejects(transport.send(url(host, "/x")),
        (error: unknown) => (error instanceof AccessNetworkError) && (error.cause === exhausted) && error.message.includes("exhausting retries"));
    });

    test("a connect-phase timeout surfaces as AccessTimeoutError carrying the elapsed time", async () => {

      const { host, pool, transport } = makeMockTransport();
      const connectTimeout = new errors.ConnectTimeoutError();

      // Distinct from our own request deadline: the connection itself never came up. It is still a timeout from the caller's point of view, so it classifies as
      // one rather than as a generic network fault.
      pool.intercept({ method: "GET", path: "/x" }).replyWithError(connectTimeout);

      await assert.rejects(transport.send(url(host, "/x")),
        (error: unknown) => (error instanceof AccessTimeoutError) && (error.cause === connectTimeout) && (error.elapsedMs >= 0));
    });
  });

  /* What a connection attempt still in flight does when something ends it.
   *
   * Every test here builds its transport WITHOUT an injected dispatcher, exactly as the certificate-verification tests below do, because the owned pool and the
   * connector beside it are the whole subject: a MockAgent replaces undici's dispatch wholesale, and everything beneath it - the connect phase included - is
   * permanently out of a mocked test's reach. The peer is a silent one, which accepts a connection and then answers nothing, so the TLS handshake stays in flight
   * for as long as a test needs it.
   *
   * Each settlement is bounded on REAL wall-clock even where the deadline itself runs on virtual time, because a virtual clock cannot tell a cut from undici's own
   * ten-second connect timer: both end the request as the same class, and a `TestClock` reports whatever elapsed time its advance says. A cut that quietly did
   * nothing therefore fails these tests by blowing the bound rather than by changing a class.
   */
  describe("the connection dial", () => {

    test("a caller abort during the dial rejects at once with AccessAbortedError and releases the socket", async () => {

      await using peer = await createSilentLoopback();
      await using transport = new Transport({ clock: new TestClock(), host: peer.host, log: silentLog() });

      const controller = new AbortController();
      const arriving = peer.connection(0);
      const pending = transport.send(url(peer.host, "/x"), { signal: controller.signal });
      const connection = await arriving;
      const startedAt = process.hrtime.bigint();

      controller.abort();

      await assert.rejects(pending, AccessAbortedError);
      await connection.closed;

      assert.ok(elapsedSince(startedAt) < DIAL_CUT_BOUND_MS, "a cancelled connection attempt ends at once rather than running on to undici's own connect timer");

      // The retry interceptor must not put the cut request back on the wire, and the count of connections the peer accepted is what says it did not.
      await settle();

      assert.equal(peer.accepted, 1, "a request whose connection attempt was cut must not be re-dialed");
    });

    test("the deadline during the dial rejects with AccessTimeoutError on virtual time and releases the socket", async () => {

      await using peer = await createSilentLoopback();

      const clock = new TestClock();

      await using transport = new Transport({ clock, host: peer.host, log: silentLog() });

      const arriving = peer.connection(0);
      const pending = transport.send(url(peer.host, "/x"));
      const connection = await arriving;
      const startedAt = process.hrtime.bigint();

      clock.advance(ACCESS_API_TIMEOUT);

      await assert.rejects(pending, (error: unknown) => (error instanceof AccessTimeoutError) && (error.elapsedMs === ACCESS_API_TIMEOUT));
      await connection.closed;

      assert.ok(elapsedSince(startedAt) < DIAL_CUT_BOUND_MS, "an expired connection attempt ends at once rather than running on to undici's own connect timer");
    });

    test("a signal already aborted when the request is dispatched rejects at once and opens no connection", async () => {

      await using peer = await createSilentLoopback();
      await using transport = new Transport({ clock: new TestClock(), host: peer.host, log: silentLog() });

      const controller = new AbortController();

      controller.abort();

      const startedAt = process.hrtime.bigint();

      // A listener attached to a signal that has already fired never runs, and undici acts on one only after the connect, so the check that catches this has to sit
      // ahead of the dispatch itself. What proves the check is there is that the peer never sees a connection at all.
      await assert.rejects(transport.send(url(peer.host, "/x"), { signal: controller.signal }), AccessAbortedError);

      assert.ok(elapsedSince(startedAt) < DIAL_CUT_BOUND_MS, "a request whose signal had already fired ends at once");

      await settle();

      assert.equal(peer.accepted, 0, "a request whose signal had already fired must never open a connection");
    });

    test("a concurrent dial for another caller is cut as a recoverable network interruption", async () => {

      await using peer = await createSilentLoopback();
      await using transport = new Transport({ clock: new TestClock(), host: peer.host, log: silentLog() });

      const cancelled = new AbortController();
      const bystander = new AbortController();
      const arriving = Promise.all([ peer.connection(0), peer.connection(1) ]);
      const pendingCancelled = transport.send(url(peer.host, "/one"), { signal: cancelled.signal });
      const pendingBystander = transport.send(url(peer.host, "/two"), { signal: bystander.signal });
      const connections = await arriving;

      /* A pool's connection attempts are shared while a signal is per request, so one caller's cancel reaches a connection attempt another caller was waiting on.
       * That is the accepted collateral, and what matters is that the bystander is told the truth about it rather than told it was cancelled.
       */
      cancelled.abort();

      await assert.rejects(pendingCancelled, AccessAbortedError);
      await assert.rejects(pendingBystander, (error: unknown) => (error instanceof AccessNetworkError) && error.message.includes("cut for another request"));
      await Promise.all(connections.map(async (connection) => connection.closed));
    });

    test("two requests sharing one caller signal both report the cancel", async () => {

      await using peer = await createSilentLoopback();
      await using transport = new Transport({ clock: new TestClock(), host: peer.host, log: silentLog() });

      const controller = new AbortController();
      const arriving = Promise.all([ peer.connection(0), peer.connection(1) ]);
      const first = transport.send(url(peer.host, "/one"), { signal: controller.signal });
      const second = transport.send(url(peer.host, "/two"), { signal: controller.signal });
      const connections = await arriving;

      controller.abort();

      // Both requests carry the signal that fired, so identity names the caller's cancel for each of them rather than making one of them a bystander.
      await assert.rejects(first, AccessAbortedError);
      await assert.rejects(second, AccessAbortedError);
      await Promise.all(connections.map(async (connection) => connection.closed));
    });

    test("a cut names the request whose signal fired, whichever was dialed first", async () => {

      await using peer = await createSilentLoopback();
      await using transport = new Transport({ clock: new TestClock(), host: peer.host, log: silentLog() });

      const bystander = new AbortController();
      const cancelled = new AbortController();
      const arriving = Promise.all([ peer.connection(0), peer.connection(1) ]);
      const pendingBystander = transport.send(url(peer.host, "/one"), { signal: bystander.signal });
      const pendingCancelled = transport.send(url(peer.host, "/two"), { signal: cancelled.signal });
      const connections = await arriving;

      // The same collateral in the other order, which is what says the naming follows the signal that fired rather than the order the connections were opened in.
      cancelled.abort();

      await assert.rejects(pendingCancelled, AccessAbortedError);
      await assert.rejects(pendingBystander, (error: unknown) => (error instanceof AccessNetworkError) && error.message.includes("cut for another request"));
      await Promise.all(connections.map(async (connection) => connection.closed));
    });

    test("reset() during a dial fails the request as the pool-reset interruption and releases the socket", async () => {

      await using peer = await createSilentLoopback();
      await using transport = new Transport({ clock: new TestClock(), host: peer.host, log: silentLog() });

      const arriving = peer.connection(0);
      const pending = transport.send(url(peer.host, "/x"));
      const connection = await arriving;
      const startedAt = process.hrtime.bigint();

      transport.reset();

      // undici's own destroy fails the request at once whether or not the connection attempt was cut, so the peer's close is the assertion that carries this row.
      await assert.rejects(pending, (error: unknown) => (error instanceof AccessNetworkError) && error.message.includes("connection pool was reset"));
      await connection.closed;

      assert.ok(elapsedSince(startedAt) < DIAL_CUT_BOUND_MS, "a reset releases a connection attempt rather than leaving it to undici's own connect timer");
    });

    test("disposal during a dial releases the socket and does not wait on it", async () => {

      await using peer = await createSilentLoopback();

      const transport = new Transport({ clock: new TestClock(), host: peer.host, log: silentLog() });
      const arriving = peer.connection(0);
      const pending = transport.send(url(peer.host, "/x"));
      const connection = await arriving;

      // The rejection is claimed before the disposal that causes it, so it is never a rejection nobody is waiting on.
      const failing = assert.rejects(pending, (error: unknown) => (error instanceof AccessNetworkError) && error.message.includes("connection pool was reset"));
      const startedAt = process.hrtime.bigint();

      await transport[Symbol.asyncDispose]();

      assert.ok(elapsedSince(startedAt) < DIAL_CUT_BOUND_MS, "disposal must not wait out the connection attempt it severed");

      await failing;
      await connection.closed;

      assert.ok(elapsedSince(startedAt) < DIAL_CUT_BOUND_MS, "the severed connection attempt ends within the same bound");
    });
  });

  describe("throttle circuit breaker", () => {

    test("trips after the consecutive-failure threshold, then refuses without dispatching", async () => {

      let entered = 0;
      const { host, pool, transport } = makeMockTransport();

      using enteredSub = transport.on("throttleEntered", () => entered++);

      pool.intercept({ method: "GET", path: "/f" }).reply(500, "x").times(ACCESS_API_ERROR_LIMIT);

      await sendFailures(transport, url(host, "/f"), ACCESS_API_ERROR_LIMIT);

      assert.equal(transport.isThrottled, true, "the breaker should be open after the threshold is crossed");
      assert.equal(entered, 1, "throttleEntered should fire exactly once on the trip");

      // The next request is refused locally - no interceptor is consumed because no request reaches the network.
      await assert.rejects(transport.send(url(host, "/f")), AccessThrottledError);
    });

    test("stays closed while failures fall short of the threshold", async () => {

      const { host, pool, transport } = makeMockTransport();

      pool.intercept({ method: "GET", path: "/f" }).reply(500, "x").times(ACCESS_API_ERROR_LIMIT - 1);

      await sendFailures(transport, url(host, "/f"), ACCESS_API_ERROR_LIMIT - 1);

      assert.equal(transport.isThrottled, false, "one failure short of the limit must leave the breaker closed");
    });

    test("a refused status never opens the breaker, however many arrive in a row", async () => {

      const { host, pool, transport } = makeMockTransport();

      /* The breaker measures reachability, so an identity the controller keeps rejecting must not read as a controller that is down. This drives the trip threshold
       * twice over on the two statuses a wrong credential or an under-scoped token produces, and the consecutive count never accumulates because every one of those
       * answers came from a controller that was there to answer.
       */
      pool.intercept({ method: "GET", path: "/no" }).reply(401, "denied").times(ACCESS_API_ERROR_LIMIT);
      pool.intercept({ method: "GET", path: "/no" }).reply(403, "forbidden").times(ACCESS_API_ERROR_LIMIT);

      await sendFailures(transport, url(host, "/no"), ACCESS_API_ERROR_LIMIT);

      assert.equal(transport.isThrottled, false, "consecutive 401s are a session verdict, not an unreachable controller");

      await sendFailures(transport, url(host, "/no"), ACCESS_API_ERROR_LIMIT);

      assert.equal(transport.isThrottled, false, "consecutive 403s are a permission verdict, not an unreachable controller");
    });

    test("consecutive server errors do open the breaker, which is the other half of the same rule", async () => {

      let entered = 0;
      const { host, pool, transport } = makeMockTransport();

      using enteredSub = transport.on("throttleEntered", () => entered++);

      // A 503 is the controller saying it could not serve the request, which is the shape the cooldown exists for. Paired with the refusal test above, this is what
      // distinguishes "the breaker ignores 4xx" from "the breaker stopped counting".
      pool.intercept({ method: "GET", path: "/down" }).reply(503, "unavailable").times(ACCESS_API_ERROR_LIMIT);

      await sendFailures(transport, url(host, "/down"), ACCESS_API_ERROR_LIMIT);

      assert.equal(transport.isThrottled, true, "consecutive 503s are unreachability and must trip the breaker");
      assert.equal(entered, 1, "throttleEntered fires exactly once, on the trip");
    });

    test("a success resets the consecutive-failure count", async () => {

      const { host, pool, transport } = makeMockTransport();

      // Failures short of the limit, then a success, then the same number of failures again. The count is consecutive, so the success clears it and the breaker
      // never trips - which is what distinguishes a consecutive count from a cumulative one.
      pool.intercept({ method: "GET", path: "/f" }).reply(500, "x").times(ACCESS_API_ERROR_LIMIT - 1);
      pool.intercept({ method: "GET", path: "/f" }).reply(200, {});
      pool.intercept({ method: "GET", path: "/f" }).reply(500, "x").times(ACCESS_API_ERROR_LIMIT - 1);

      await sendFailures(transport, url(host, "/f"), ACCESS_API_ERROR_LIMIT - 1);
      await transport.send(url(host, "/f"));
      await sendFailures(transport, url(host, "/f"), ACCESS_API_ERROR_LIMIT - 1);

      assert.equal(transport.isThrottled, false);
    });

    test("the thrown AccessThrottledError carries the remaining cooldown", async () => {

      const { clock, host, pool, transport } = makeMockTransport();

      pool.intercept({ method: "GET", path: "/f" }).reply(500, "x").times(ACCESS_API_ERROR_LIMIT);

      await sendFailures(transport, url(host, "/f"), ACCESS_API_ERROR_LIMIT);
      clock.advance(1000);

      await assert.rejects(transport.send(url(host, "/f")), (error: unknown) => (error instanceof AccessThrottledError) && (error.cooldownMs === COOLDOWN_MS - 1000));
    });

    test("a successful half-open probe after cooldown closes the breaker and emits throttleExited", async () => {

      let exited = 0;
      const { clock, host, pool, transport } = makeMockTransport();

      using exitedSub = transport.on("throttleExited", () => exited++);

      pool.intercept({ method: "GET", path: "/f" }).reply(500, "x").times(ACCESS_API_ERROR_LIMIT);
      pool.intercept({ method: "GET", path: "/f" }).reply(200, { recovered: true });

      await sendFailures(transport, url(host, "/f"), ACCESS_API_ERROR_LIMIT);
      clock.advance(COOLDOWN_MS);

      const response = await transport.send(url(host, "/f"));

      assert.equal(response.statusCode, 200);
      assert.equal(transport.isThrottled, false, "a successful probe must close the breaker");
      assert.equal(exited, 1, "throttleExited fires once, on the closing edge");
    });

    test("a refused status on the half-open trial closes the breaker and emits throttleExited once", async () => {

      let exited = 0;
      const { clock, host, pool, transport } = makeMockTransport();

      using exitedSub = transport.on("throttleExited", () => exited++);

      pool.intercept({ method: "GET", path: "/f" }).reply(503, "unavailable").times(ACCESS_API_ERROR_LIMIT);
      pool.intercept({ method: "GET", path: "/f" }).reply(403, "forbidden");
      pool.intercept({ method: "GET", path: "/f" }).reply(200, {});

      await sendFailures(transport, url(host, "/f"), ACCESS_API_ERROR_LIMIT);

      assert.equal(transport.isThrottled, true);

      /* The trial comes back refused. That is the controller answering on the merits of one request, which settles the only question the breaker asked - so the
       * episode ends here rather than re-arming the cooldown on the strength of an answer that proves the controller is up.
       */
      clock.advance(COOLDOWN_MS);

      const trial = await transport.send(url(host, "/f"));

      assert.equal(trial.statusCode, 403);
      assert.equal(transport.isThrottled, false, "an answered request closes the breaker whatever the answer said");
      assert.equal(exited, 1, "throttleExited fires exactly once, on the closing edge");

      // Closed for real, not just by the flag: the next ordinary request dispatches instead of being refused locally.
      assert.equal((await transport.send(url(host, "/f"))).statusCode, 200);
    });

    test("a failed half-open probe re-arms the cooldown without re-emitting throttleEntered", async () => {

      let entered = 0;
      let exited = 0;
      const { clock, host, pool, transport } = makeMockTransport();

      using enteredSub = transport.on("throttleEntered", () => entered++);
      using exitedSub = transport.on("throttleExited", () => exited++);

      pool.intercept({ method: "GET", path: "/f" }).reply(500, "x").times(ACCESS_API_ERROR_LIMIT + 1);

      await sendFailures(transport, url(host, "/f"), ACCESS_API_ERROR_LIMIT);
      clock.advance(COOLDOWN_MS);

      // The probe fails - the breaker stays open, re-armed from now.
      const probe = await transport.send(url(host, "/f"));

      assert.equal(probe.statusCode, 500);
      assert.equal(transport.isThrottled, true, "a failed probe leaves the breaker open");
      assert.equal(entered, 1, "throttleEntered must not fire again - the consumer's view is that we were throttled throughout");
      assert.equal(exited, 0, "throttleExited must not fire on a failed probe");

      // The cooldown re-armed from the probe, so the very next request is refused again.
      await assert.rejects(transport.send(url(host, "/f")), AccessThrottledError);
    });

    test("a failure then a success across one open episode emits throttleExited exactly once", async () => {

      let entered = 0;
      let exited = 0;
      const { clock, host, pool, transport } = makeMockTransport();

      using enteredSub = transport.on("throttleEntered", () => entered++);
      using exitedSub = transport.on("throttleExited", () => exited++);

      pool.intercept({ method: "GET", path: "/f" }).reply(500, "x").times(ACCESS_API_ERROR_LIMIT + 1);
      pool.intercept({ method: "GET", path: "/f" }).reply(200, {});

      await sendFailures(transport, url(host, "/f"), ACCESS_API_ERROR_LIMIT);

      // A failing probe, then a succeeding one. This is the sequence that distinguishes an exactly-once signal from a per-success one: an implementation that
      // emitted on every successful booking, or that re-emitted entered on the failed probe, produces different counts here and identical counts on a simple
      // trip-then-recover sequence.
      clock.advance(COOLDOWN_MS);
      await transport.send(url(host, "/f"));
      clock.advance(COOLDOWN_MS);
      await transport.send(url(host, "/f"));

      assert.equal(entered, 1);
      assert.equal(exited, 1);
      assert.equal(transport.isThrottled, false);
    });

    test("a probe send bypasses the open cooldown gate, and a successful probe closes the breaker", async () => {

      let exited = 0;
      const { clock, host, pool, transport } = makeMockTransport();

      using exitedSub = transport.on("throttleExited", () => exited++);

      pool.intercept({ method: "GET", path: "/f" }).reply(500, "x").times(ACCESS_API_ERROR_LIMIT);
      pool.intercept({ method: "GET", path: "/f" }).reply(200, { recovered: true });

      await sendFailures(transport, url(host, "/f"), ACCESS_API_ERROR_LIMIT);
      assert.equal(transport.isThrottled, true);

      // Still deep inside the cooldown: a normal send is refused locally, but a probe - the recovery trial - dispatches anyway, so the coordinator's backoff curve
      // rather than the breaker's cooldown paces re-probing. The probe takes the same booking the autonomous half-open trial would, reached early.
      clock.advance(1000);

      await assert.rejects(transport.send(url(host, "/f")), AccessThrottledError);

      const probe = await transport.send(url(host, "/f"), { probe: true });

      assert.equal(probe.statusCode, 200);
      assert.equal(transport.isThrottled, false, "a successful probe closes the breaker even mid-cooldown");
      assert.equal(exited, 1, "throttleExited fires once, on the probe's closing edge");
    });

    test("a failed probe mid-cooldown re-arms the breaker without flapping the rails", async () => {

      let entered = 0;
      let exited = 0;
      const { clock, host, pool, transport } = makeMockTransport();

      using enteredSub = transport.on("throttleEntered", () => entered++);
      using exitedSub = transport.on("throttleExited", () => exited++);

      pool.intercept({ method: "GET", path: "/f" }).reply(500, "x").times(ACCESS_API_ERROR_LIMIT + 1);

      await sendFailures(transport, url(host, "/f"), ACCESS_API_ERROR_LIMIT);
      clock.advance(1000);

      // A failed probe takes exactly the failed-half-open booking: the breaker stays open, re-armed from now, with no rail churn - so the consumer's "throttled
      // throughout" view holds. This is why the probe needs no rail logic of its own.
      const probe = await transport.send(url(host, "/f"), { probe: true });

      assert.equal(probe.statusCode, 500);
      assert.equal(transport.isThrottled, true, "a failed probe leaves the breaker open");
      assert.equal(entered, 1, "throttleEntered does not fire again on a failed probe");
      assert.equal(exited, 0, "throttleExited does not fire on a failed probe");
    });

    test("a transport-level exception books a failure and trips the breaker", async () => {

      const { host, pool, transport } = makeMockTransport();
      const errno = errnoError("connect ECONNREFUSED", "ECONNREFUSED");

      pool.intercept({ method: "GET", path: "/f" }).replyWithError(errno).times(ACCESS_API_ERROR_LIMIT);

      // A failure that never produced a response is a reachability failure and books like any other, which is what keeps an unreachable controller from being
      // hammered as hard as a merely failing one.
      for(let index = 0; index < ACCESS_API_ERROR_LIMIT; index++) {

        // eslint-disable-next-line no-await-in-loop
        await assert.rejects(transport.send(url(host, "/f")), AccessNetworkError);
      }

      assert.equal(transport.isThrottled, true);
    });

    test("logs the trip at error level and the recovery at info level", async () => {

      const log = capturingLog();
      const { clock, host, pool, transport } = makeMockTransport({ log });

      pool.intercept({ method: "GET", path: "/f" }).reply(500, "x").times(ACCESS_API_ERROR_LIMIT);
      pool.intercept({ method: "GET", path: "/f" }).reply(200, {});

      await sendFailures(transport, url(host, "/f"), ACCESS_API_ERROR_LIMIT);

      assert.ok(log.entries.some((entry) => (entry.level === "error") && entry.message.includes("Throttling")), "the trip should log at error level");

      clock.advance(COOLDOWN_MS);
      await transport.send(url(host, "/f"));

      assert.ok(log.entries.some((entry) => (entry.level === "info") && entry.message.includes("Resumed")), "the recovery should log at info level");
    });
  });

  describe("diagnostics channels", () => {

    test("publishes request start and end with a correlating requestId and the controller host", async () => {

      const starts: AccessHttpRequestStartPayload[] = [];
      const ends: AccessHttpRequestEndPayload[] = [];

      using startSub = subscribeTo(channels.httpRequestStart, (message) => void starts.push(message));
      using endSub = subscribeTo(channels.httpRequestEnd, (message) => void ends.push(message));

      const { host: configuredHost, pool, transport } = makeMockTransport();

      pool.intercept({ method: "GET", path: "/d" }).reply(200, {});

      await transport.send(url(configuredHost, "/d"));

      assert.equal(starts.length, 1);
      assert.equal(starts[0]?.method, "GET");
      assert.equal(starts[0]?.host, configuredHost, "the start payload carries the configured controller host verbatim");
      assert.equal(ends.length, 1);

      const end = present(ends[0], "the request's end payload");

      assert.equal(end.outcome, "response", "a request that received a response reports the response outcome");
      assert.equal((end.outcome === "response") ? end.statusCode : undefined, 200);
      assert.equal(end.host, configuredHost, "the end payload carries the configured controller host verbatim");
      assert.equal(starts[0]?.requestId, end.requestId, "start and end must share the requestId");
    });

    test("reports the failure outcome on the end channel when the request fails at the transport level", async () => {

      const ends: AccessHttpRequestEndPayload[] = [];

      using endSub = subscribeTo(channels.httpRequestEnd, (message) => void ends.push(message));

      const { host: configuredHost, pool, transport } = makeMockTransport();

      pool.intercept({ method: "GET", path: "/x" }).replyWithError(errnoError("connect ECONNREFUSED", "ECONNREFUSED"));

      await assert.rejects(transport.send(url(configuredHost, "/x")), AccessNetworkError);

      assert.equal(ends.length, 1);

      const end = present(ends[0], "the request's end payload");

      assert.equal(end.host, configuredHost, "the failure-path end payload still carries the configured controller host");
      assert.equal(end.outcome, "failure", "a request that never received a response reports the failure outcome");
      assert.ok(((end.outcome === "failure") ? end.error : "").length > 0, "a transport-level failure carries the classified error's message");
    });

    test("publishes the full throttle entered and exited payloads around the breaker lifecycle", async () => {

      const entered: AccessHttpThrottleEnteredPayload[] = [];
      const exited: AccessHttpThrottleExitedPayload[] = [];

      using enteredSub = subscribeTo(channels.httpThrottleEntered, (message) => void entered.push(message));
      using exitedSub = subscribeTo(channels.httpThrottleExited, (message) => void exited.push(message));

      const { clock, host: configuredHost, pool, transport } = makeMockTransport();

      pool.intercept({ method: "GET", path: "/f" }).reply(500, "x").times(ACCESS_API_ERROR_LIMIT);
      pool.intercept({ method: "GET", path: "/f" }).reply(200, {});

      await sendFailures(transport, url(configuredHost, "/f"), ACCESS_API_ERROR_LIMIT);
      clock.advance(COOLDOWN_MS);
      await transport.send(url(configuredHost, "/f"));

      assert.deepEqual(entered, [{ consecutiveFailures: ACCESS_API_ERROR_LIMIT, cooldownMs: COOLDOWN_MS, host: configuredHost }]);

      // The exited payload's host is its entire content, so asserting the whole payload rather than counting emissions is what verifies it at all.
      assert.deepEqual(exited, [{ host: configuredHost }]);
    });
  });

  describe("dispatcher ownership", () => {

    test("reset is a no-op on an injected dispatcher - the dispatcher keeps working", async () => {

      const { host, pool, transport } = makeMockTransport();

      transport.reset();

      pool.intercept({ method: "GET", path: "/x" }).reply(200, { ok: 1 });

      assert.deepEqual(await transport.request<{ ok: number }>(url(host, "/x")), { ok: 1 }, "an injected dispatcher must survive reset()");
    });

    test("asyncDispose resolves without destroying an injected dispatcher", async () => {

      const { transport } = makeMockTransport();

      await assert.doesNotReject(transport[Symbol.asyncDispose]());
    });

    test("owns and rebuilds its pool when no dispatcher is injected", async () => {

      // No dispatcher injected, so the transport builds (and owns) a real undici pool - exercising the pool and retry-interceptor construction. The pool is lazy,
      // so no connection opens without a request; reset() rebuilds it and asyncDispose tears it down.
      const transport = new Transport({ host: "127.0.0.1" });

      assert.equal(transport.isThrottled, false);
      assert.doesNotThrow(() => transport.reset(), "reset must rebuild the owned pool without throwing");

      await assert.doesNotReject(transport[Symbol.asyncDispose]());
    });
  });

  describe("certificate verification", () => {

    test("accepts the certificate a controller presents when strict verification is not asked for", async () => {

      // The peer is disposed after the transport, so the pool has released its keepalive connection by the time the server stops listening.
      await using peer = await createHttpsLoopback(() => ({ body: "{\"ok\":true}", contentType: "application/json", status: 200 }));
      await using transport = new Transport({ host: peer.host });

      const response = await transport.send(url(peer.host, "/ok"));

      assert.equal(response.statusCode, 200, "the default reaches a controller presenting its own self-signed certificate");
    });

    test("refuses a certificate that does not verify when strict verification is asked for", async () => {

      await using peer = await createHttpsLoopback(() => ({ body: "{\"ok\":true}", contentType: "application/json", status: 200 }));
      await using transport = new Transport({ host: peer.host, verifyTls: true });

      /* The same peer and the same request as above, one option apart. A handshake the client will not complete is a connect-phase failure, and the transport
       * reports it as the certificate refusal it is: the sentence names the listener that presented the certificate, the address that was dialed, and the
       * verifier's own words and code, so a user reads which of the controller's two listeners to go fix rather than that the host was unreachable.
       */
      await assertRejectsWith(async () => transport.send(url(peer.host, "/ok")), AccessCertificateError, { check: (error) => {

        assert.equal(error.code, "DEPTH_ZERO_SELF_SIGNED_CERT");
        assert.equal(error.host, peer.host, "the address reported is the one this transport dials");
        assert.equal(error.identity, "credentials");
        assert.ok(error.message.startsWith("The UniFi console at " + peer.host + " presented a certificate that could not be verified: "),
          "the sentence opens by naming the console and the address");
        assert.ok(error.message.endsWith("(DEPTH_ZERO_SELF_SIGNED_CERT)."), "and closes with the verifier's own code");
      } });
    });

    test("names the developer API when the transport that met the certificate carries the token identity", async () => {

      await using peer = await createHttpsLoopback(() => ({ body: "{\"ok\":true}", contentType: "application/json", status: 200 }));
      await using transport = new Transport({ host: peer.host, identity: "token", verifyTls: true });

      // The identity leg is what fixes the listener: a token transport is built against the developer API's own address, so its refusal says so and tells the
      // user that installing a certificate on the console would not have reached this one.
      await assertRejectsWith(async () => transport.send(url(peer.host, "/ok")), AccessCertificateError, { check: (error) => {

        assert.equal(error.identity, "token");
        assert.ok(error.message.startsWith("The UniFi Access developer API at " + peer.host + " presented a certificate that could not be verified: "),
          "the sentence opens by naming the developer API");
        assert.ok(error.message.endsWith(" The developer API presents its own certificate, separate from the console's."),
          "and the token leg is told where the certificate it needs actually goes");
      } });
    });
  });

  describe("event rails", () => {

    test("once resolves when the matching event is emitted", async () => {

      const { host, pool, transport } = makeMockTransport();
      const pending = transport.once("throttleEntered");

      pool.intercept({ method: "GET", path: "/f" }).reply(500, "x").times(ACCESS_API_ERROR_LIMIT);

      await sendFailures(transport, url(host, "/f"), ACCESS_API_ERROR_LIMIT);

      await assert.doesNotReject(pending, "the throttle trip should resolve the pending once()");
    });

    test("stream yields the emitted events until aborted", async () => {

      const { host, pool, transport } = makeMockTransport();
      const controller = new AbortController();
      let received = 0;

      const collector = (async (): Promise<void> => {

        try {

          for await (const _entered of transport.stream("throttleEntered", { signal: controller.signal })) {

            received++;
            controller.abort();
          }
        } catch(error) {

          if((error as Error).name !== "AbortError") {

            throw error;
          }
        }
      })();

      pool.intercept({ method: "GET", path: "/f" }).reply(500, "x").times(ACCESS_API_ERROR_LIMIT);

      await sendFailures(transport, url(host, "/f"), ACCESS_API_ERROR_LIMIT);
      await collector;

      assert.equal(received, 1, "the stream should surface the throttle trip");
    });
  });
});

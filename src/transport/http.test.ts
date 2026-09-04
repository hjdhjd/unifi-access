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
import { ACCESS_API_ERROR_LIMIT, ACCESS_API_RETRY_INTERVAL } from "../settings.ts";
import { AccessAbortedError, AccessAuthError, AccessAuthorizationError, AccessNetworkError, AccessProtocolError, AccessRequestError, AccessThrottledError,
  AccessTimeoutError } from "../errors.ts";
import type { AccessHttpRequestEndPayload, AccessHttpRequestStartPayload, AccessHttpThrottleEnteredPayload,
  AccessHttpThrottleExitedPayload } from "../diagnostics.ts";
import { describe, test } from "node:test";
import { makeMockTransport, url } from "./mock-controller.helpers.ts";
import { Transport } from "./http.ts";
import assert from "node:assert/strict";
import { capturingLog } from "../testing.helpers.ts";
import { createHttpsLoopback } from "./loopback.helpers.ts";
import diagnosticsChannel from "node:diagnostics_channel";
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

      assert.ok(thrown instanceof AccessAuthError);
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

      assert.ok(thrown instanceof AccessAuthError);
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

      assert.ok(thrown instanceof AccessAuthorizationError);
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

      assert.ok(thrown instanceof AccessAuthorizationError);
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

      assert.ok(thrown instanceof AccessRequestError);
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

      const { host, pool, transport } = makeMockTransport();

      pool.intercept({ method: "GET", path: "/slow" }).reply(200, {}).delay(2000);

      await assert.rejects(transport.send(url(host, "/slow"), { timeout: 20 }), AccessTimeoutError);
    });

    test("a socket-level failure surfaces as AccessNetworkError with the errno code", async () => {

      const { host, pool, transport } = makeMockTransport();
      const errno = Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" });

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

  describe("throttle circuit breaker", () => {

    test("trips after the consecutive-failure threshold, then refuses without dispatching", async () => {

      let entered = 0;
      const { host, pool, transport } = makeMockTransport();

      using _enteredSub = transport.on("throttleEntered", () => entered++);

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

      using _enteredSub = transport.on("throttleEntered", () => entered++);

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

      using _exitedSub = transport.on("throttleExited", () => exited++);

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

      using _exitedSub = transport.on("throttleExited", () => exited++);

      pool.intercept({ method: "GET", path: "/f" }).reply(503, "unavailable").times(ACCESS_API_ERROR_LIMIT);
      pool.intercept({ method: "GET", path: "/f" }).reply(403, "forbidden");
      pool.intercept({ method: "GET", path: "/f" }).reply(200, {});

      await sendFailures(transport, url(host, "/f"), ACCESS_API_ERROR_LIMIT);

      assert.equal(transport.isThrottled, true);

      /* The trial comes back refused. That is the controller answering on the merits of one request, which settles the only question the breaker asked - so the
       * episode ends here rather than re-arming for another five minutes on the strength of an answer that proves the controller is up.
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

      using _enteredSub = transport.on("throttleEntered", () => entered++);
      using _exitedSub = transport.on("throttleExited", () => exited++);

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

      using _enteredSub = transport.on("throttleEntered", () => entered++);
      using _exitedSub = transport.on("throttleExited", () => exited++);

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

      using _exitedSub = transport.on("throttleExited", () => exited++);

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

      using _enteredSub = transport.on("throttleEntered", () => entered++);
      using _exitedSub = transport.on("throttleExited", () => exited++);

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
      const errno = Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" });

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
      const onStart = (message: unknown): void => void starts.push(message as AccessHttpRequestStartPayload);
      const onEnd = (message: unknown): void => void ends.push(message as AccessHttpRequestEndPayload);

      diagnosticsChannel.subscribe("unifi-access:http:request:start", onStart);
      diagnosticsChannel.subscribe("unifi-access:http:request:end", onEnd);

      let configuredHost = "";

      try {

        const { host, pool, transport } = makeMockTransport();

        configuredHost = host;
        pool.intercept({ method: "GET", path: "/d" }).reply(200, {});

        await transport.send(url(host, "/d"));
      } finally {

        diagnosticsChannel.unsubscribe("unifi-access:http:request:start", onStart);
        diagnosticsChannel.unsubscribe("unifi-access:http:request:end", onEnd);
      }

      assert.equal(starts.length, 1);
      assert.equal(starts[0]?.method, "GET");
      assert.equal(starts[0]?.host, configuredHost, "the start payload carries the configured controller host verbatim");
      assert.equal(ends.length, 1);

      const end = ends[0];

      assert.ok(end);
      assert.equal(end.outcome, "response", "a request that received a response reports the response outcome");
      assert.equal((end.outcome === "response") ? end.statusCode : undefined, 200);
      assert.equal(end.host, configuredHost, "the end payload carries the configured controller host verbatim");
      assert.equal(starts[0]?.requestId, end.requestId, "start and end must share the requestId");
    });

    test("reports the failure outcome on the end channel when the request fails at the transport level", async () => {

      const ends: AccessHttpRequestEndPayload[] = [];
      const onEnd = (message: unknown): void => void ends.push(message as AccessHttpRequestEndPayload);

      diagnosticsChannel.subscribe("unifi-access:http:request:end", onEnd);

      let configuredHost = "";

      try {

        const { host, pool, transport } = makeMockTransport();
        const errno = Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" });

        configuredHost = host;
        pool.intercept({ method: "GET", path: "/x" }).replyWithError(errno);

        await assert.rejects(transport.send(url(host, "/x")), AccessNetworkError);
      } finally {

        diagnosticsChannel.unsubscribe("unifi-access:http:request:end", onEnd);
      }

      assert.equal(ends.length, 1);

      const end = ends[0];

      assert.ok(end);
      assert.equal(end.host, configuredHost, "the failure-path end payload still carries the configured controller host");
      assert.equal(end.outcome, "failure", "a request that never received a response reports the failure outcome");
      assert.ok(((end.outcome === "failure") ? end.error : "").length > 0, "a transport-level failure carries the classified error's message");
    });

    test("publishes the full throttle entered and exited payloads around the breaker lifecycle", async () => {

      const entered: AccessHttpThrottleEnteredPayload[] = [];
      const exited: AccessHttpThrottleExitedPayload[] = [];
      const onEntered = (message: unknown): void => void entered.push(message as AccessHttpThrottleEnteredPayload);
      const onExited = (message: unknown): void => void exited.push(message as AccessHttpThrottleExitedPayload);

      diagnosticsChannel.subscribe("unifi-access:http:throttle:entered", onEntered);
      diagnosticsChannel.subscribe("unifi-access:http:throttle:exited", onExited);

      let configuredHost = "";

      try {

        const { clock, host, pool, transport } = makeMockTransport();

        configuredHost = host;
        pool.intercept({ method: "GET", path: "/f" }).reply(500, "x").times(ACCESS_API_ERROR_LIMIT);
        pool.intercept({ method: "GET", path: "/f" }).reply(200, {});

        await sendFailures(transport, url(host, "/f"), ACCESS_API_ERROR_LIMIT);
        clock.advance(COOLDOWN_MS);
        await transport.send(url(host, "/f"));
      } finally {

        diagnosticsChannel.unsubscribe("unifi-access:http:throttle:entered", onEntered);
        diagnosticsChannel.unsubscribe("unifi-access:http:throttle:exited", onExited);
      }

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

      /* The same peer and the same request as above, one option apart. A handshake the client will not complete is a connect-phase failure, which the transport
       * classifies as the reachability fault it is, and the errno lifted from the cause chain is what says the refusal was about the certificate rather than about
       * reaching the host at all.
       */
      await assert.rejects(async () => transport.send(url(peer.host, "/ok")), (error: unknown) => {

        assert.ok(error instanceof AccessNetworkError);
        assert.equal(error.code, "DEPTH_ZERO_SELF_SIGNED_CERT");

        return true;
      });
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

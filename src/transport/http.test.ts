/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * http.test.ts: Unit tests for the HTTP transport - the send/request surface, AccessResponse decoding and ensureOk classification, the status predicates, the base
 * and auth headers, the 401-relogin retry, transport-error classification (timeout vs caller-abort vs network), the connection dial, a request in flight at a
 * teardown, the full throttle circuit-breaker state machine (closed -> open -> half-open -> closed), the diagnostics channels, dispatcher ownership, certificate
 * verification, the owned pool's retry policy and its handling of the statuses it retries, and the event rails.
 *
 * Most groups are driven deterministically: an undici MockAgent injects responses and failures without a live controller, and a fake Clock advances breaker time
 * without real-time waits. The injected dispatcher and clock let these tests assert the controller's throttle and retry behavior - the established behavioral
 * contract - exactly and without flakiness. What a MockAgent cannot reach runs over real sockets instead, against loopback peers and through a transport that
 * builds its own pool: the connection dial, a request in flight on an established connection at a reset or a disposal, certificate verification, and what the
 * retry interceptor does with a status the peer answers.
 */
import { ACCESS_API_ERROR_LIMIT, ACCESS_API_RETRY_INTERVAL, ACCESS_API_RETRY_PROFILE, ACCESS_API_TIMEOUT } from "../settings.ts";
import { AccessAbortedError, AccessAuthError, AccessCertificateError, AccessNetworkError, AccessProtocolError, AccessRequestError, AccessThrottledError,
  AccessTimeoutError } from "../errors.ts";
import type { AccessHttpRequestEndPayload, AccessHttpRequestStartPayload, AccessHttpThrottleEnteredPayload,
  AccessHttpThrottleExitedPayload } from "../diagnostics.ts";
import { DIAL_SETTLE_BOUND_MS, createHttpsLoopback, createResettingLoopback, createSilentLoopback, createUnansweringHttpsLoopback, elapsedSince,
  pendingThroughRedialWait } from "./loopback.helpers.ts";
import { RetryHandler, errors } from "undici";
import { TestClock, capturingLog, errnoError, expectAt, loggedAt, settle, silentLog, waitUntil } from "homebridge-plugin-utils/testing";
import { Transport, controllerServing, responseOk, retryUnlessHinted } from "./http.ts";
import { describe, test } from "node:test";
import { makeMockTransport, url } from "./mock-controller.helpers.ts";
import type { Dispatcher } from "undici";
import type { IncomingHttpHeaders } from "node:http";
import type { MockTimers } from "node:test";
import assert from "node:assert/strict";
import { channels } from "../diagnostics.ts";
import { setTimeout as setTimeoutAsync } from "node:timers/promises";
import { subscribeTo } from "../testing.helpers.ts";
import { wallClock } from "../clock.ts";

// The breaker cooldown in milliseconds, mirroring the transport's own derivation, so the fake-clock advances line up with the gate math.
const COOLDOWN_MS = ACCESS_API_RETRY_INTERVAL * 1000;

// The wall-clock time a row seeds mocked `Date` with before stepping it.
const MOCKED_WALL_CLOCK_MS = 1000000;

// Drive `count` sequential failing requests through the transport against a path the caller has set up to fail. Sequential awaits are intentional - the breaker
// counts consecutive failures in order.
async function sendFailures(transport: Transport, target: string, count: number): Promise<void> {

  for(let index = 0; index < count; index++) {

    // eslint-disable-next-line no-await-in-loop
    await transport.send(target);
  }
}

/* The deadline an owned-pool row gives a request whose attempts and backoff run in real time. Every retry the profile allows comes to most of the default deadline,
 * which leaves little margin on a loaded machine, so such a row measures the count of attempts on a deadline of its own, and the fit inside the default deadline is
 * the live controller's to show.
 */
const RAISED_DEADLINE_MS = 10000;

// The retry options a policy is handed: the pool's own profile with the members undici's handler fills before it asks, so either decision a row compares reads
// every one of them.
const RETRY_OPTIONS: RetryHandler.RetryOptions = { ...ACCESS_API_RETRY_PROFILE, errorCodes: [ "ECONNRESET", "UND_ERR_SOCKET" ],
  methods: [...ACCESS_API_RETRY_PROFILE.methods], retryAfter: true, statusCodes: [...ACCESS_API_RETRY_PROFILE.statusCodes] };

// The context a policy is asked in: the attempt it is deciding and the request's options, the merged retry options among them.
function retryContext(counter: number, options: { method?: Dispatcher.HttpMethod; retryOptions?: RetryHandler.RetryOptions } = {}): RetryHandler.RetryContext {

  return { opts: { method: options.method ?? "GET", path: "/x", retryOptions: options.retryOptions ?? RETRY_OPTIONS }, state: { counter } };
}

/* A RequestRetryError as the retry handler builds one for an answer it read as a failure. At runtime the constructor's third argument is a record of the answer's
 * headers and the attempt count, which undici's declarations type as the headers alone, so the record is handed through the one widening that names the mismatch.
 */
function retryError(statusCode: number, headers: Record<string, string> = {}): errors.RequestRetryError {

  return new errors.RequestRetryError("Request failed", statusCode, { data: { count: 1 }, headers } as unknown as IncomingHttpHeaders);
}

/* One retry decision under mocked timers, read as what it did: gave up or retried at once, or armed a retry that ran once the delay this measures had elapsed. The
 * delay is measured by stepping the timers a millisecond at a time, bounded by the profile's longest wait, past which a decision that never settled reads as one.
 */
function decide(timers: MockTimers, policy: RetryHandler.RetryCallback, error: Error,
  context: RetryHandler.RetryContext): { delayMs: number; outcome: "gave up" | "retried" | "unsettled" } {

  const outcomes: (Error | null | undefined)[] = [];

  policy(error, context, (result) => void outcomes.push(result));

  let delayMs = 0;

  while((outcomes.length === 0) && (delayMs <= ACCESS_API_RETRY_PROFILE.maxTimeout)) {

    timers.tick(1);
    delayMs++;
  }

  if(outcomes.length === 0) {

    return { delayMs, outcome: "unsettled" };
  }

  return { delayMs, outcome: ((outcomes[0] === null) || (outcomes[0] === undefined)) ? "retried" : "gave up" };
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

      assert.throws(() => response.ensureOk(), {

        // A transport constructed without an identity authenticates with credentials.
        identity: "credentials",

        // The message is consumer-facing copy that a caller may render verbatim, so it is asserted exactly rather than matched loosely.
        message: "Authentication with the UniFi Access controller failed.",
        name: "AccessAuthError",
        statusCode: 401
      });
    });

    test("401 on a token transport names the API token rather than the credentials", async () => {

      const { host, pool, transport } = makeMockTransport({ identity: "token" });

      pool.intercept({ method: "GET", path: "/token-401" }).reply(401, "denied");

      const response = await transport.send(url(host, "/token-401"));

      assert.throws(() => response.ensureOk(), {

        identity: "token",

        // Each leg has its own remedy, so each gets its own sentence: this one sends the reader to the issued token rather than to an account password.
        message: "The UniFi Access controller rejected the configured API token. Please check that the token is valid and has not been revoked.",
        name: "AccessAuthError",
        statusCode: 401
      });
    });

    test("403 classifies as AccessAuthorizationError carrying the status and the credential leg", async () => {

      const { host, pool, transport } = makeMockTransport();

      pool.intercept({ method: "GET", path: "/b" }).reply(403, "forbidden");

      const response = await transport.send(url(host, "/b"));

      assert.throws(() => response.ensureOk(), {

        // A transport constructed without an identity authenticates with credentials.
        identity: "credentials",

        // The message is consumer-facing copy that a caller may render verbatim, so it is asserted exactly rather than matched loosely.
        message: "The account lacks the privileges this operation requires on the UniFi Access controller.",
        name: "AccessAuthorizationError",
        statusCode: 403
      });
    });

    test("403 on a token transport names the API token's permissions rather than the account's role", async () => {

      const { host, pool, transport } = makeMockTransport({ identity: "token" });

      pool.intercept({ method: "GET", path: "/token-403" }).reply(403, "forbidden");

      const response = await transport.send(url(host, "/token-403"));

      assert.throws(() => response.ensureOk(), {

        identity: "token",

        // Each leg has its own remedy, so each gets its own sentence: this one sends the reader to the token's issued permissions rather than to an account role.
        message: "The configured API token lacks the permissions this operation requires on the UniFi Access controller.",
        name: "AccessAuthorizationError",
        statusCode: 403
      });
    });

    test("other non-2xx classify as AccessRequestError carrying status, body, and headers", async () => {

      const { host, pool, transport } = makeMockTransport();

      pool.intercept({ method: "GET", path: "/c" }).reply(500, "boom", { headers: { "x-trace": "abc" } });

      const response = await transport.send(url(host, "/c"));

      assert.throws(() => response.ensureOk(), (error: unknown) => {

        assert.ok(error instanceof AccessRequestError, "a 500 surfaces as a request error");
        assert.equal(error.statusCode, 500);
        assert.equal(error.body, "boom");
        assert.equal(error.headers?.["x-trace"], "abc");

        return true;
      });
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

    test("controllerServing answers true for any defined status below 500 but a 429", () => {

      // A refusal came from a controller that was there to refuse, so the breaker counts it as serving; a 5xx or no answer at all says the controller could not
      // serve the request, and a 429 says it is limiting requests. The rate limit's neighbors are listed beside it, so a boundary that widens past it shows.
      assert.deepEqual([ undefined, 200, 401, 404, 428, 429, 430, 499, 500, 501 ].map(controllerServing),
        [ false, true, true, true, true, false, true, true, false, false ]);
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

    test("tells the relogin hook whether the request that met the 401 was the recovery probe", async () => {

      const asked: { probe: boolean }[] = [];
      const { host, pool, transport } = makeMockTransport({ onUnauthorized: async (relogin) => {

        asked.push(relogin);

        return false;
      } });

      pool.intercept({ method: "GET", path: "/x" }).reply(401, "stale").times(2);

      await transport.send(url(host, "/x"));
      await transport.send(url(host, "/x"), { probe: true });

      assert.deepEqual(asked, [ { probe: false }, { probe: true } ], "a probe's relogin is told it may carry the probe's mark");
    });

    test("a 401 whose relogin hook rejects throws the hook's failure and books nothing for the attempt", async () => {

      const failure = new AccessRequestError("The UniFi Access controller answered the request with HTTP status 503.", { statusCode: 503 });
      const { host, pool, transport } = makeMockTransport({ onUnauthorized: async () => Promise.reject(failure) });

      /* One failure short of the trip threshold, then a 401 whose relogin rejects, then one more failure. The 401 books nothing, because the relogin's own sends
       * booked what the controller answered them, so the failure after it is the one that trips the breaker. A 401 booked as served would reset the count instead.
       */
      pool.intercept({ method: "GET", path: "/f" }).reply(500, "x").times(ACCESS_API_ERROR_LIMIT);
      pool.intercept({ method: "GET", path: "/x" }).reply(401, "stale");

      await sendFailures(transport, url(host, "/f"), ACCESS_API_ERROR_LIMIT - 1);
      await assert.rejects(transport.send(url(host, "/x")), (error: unknown) => error === failure);

      assert.equal(transport.isThrottled, false, "the rejected relogin left the count where it stood");

      await transport.send(url(host, "/f"));

      assert.equal(transport.isThrottled, true, "so the next failure is the one that crosses the threshold");
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

      /* The mock holds its reply open by its own delay, so the exchange is still in flight when the deadline fires rather than answered ahead of it. The transport
       * settles the request itself the moment the deadline fires, and undici's own abort hook - what ends a request on a live socket, in place here from the mock's
       * request start - ends the held reply on undici's side and clears the mock's timer with it. The deadline is the injected clock's, so firing it is an advance
       * rather than a real wait.
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
      await assert.rejects(pending, { elapsedMs: 50, name: "AccessTimeoutError" });
      await observed;
    });

    test("a settled request leaves no deadline on the clock, whether a reply or the deadline settled it", async () => {

      const { clock, host, pool, transport } = makeMockTransport();

      pool.intercept({ method: "GET", path: "/ok" }).reply(200, {});
      pool.intercept({ method: "GET", path: "/slow" }).reply(200, {}).delay(2000);

      await transport.send(url(host, "/ok"));

      assert.equal(clock.pending, 0, "a request answered ahead of its deadline releases the deadline's timer");

      const pending = transport.send(url(host, "/slow"));

      await settle();
      clock.advance(ACCESS_API_TIMEOUT);

      await assert.rejects(pending, { message: "The UniFi Access controller did not respond before the request deadline elapsed.", name: "AccessTimeoutError" });
      assert.equal(clock.pending, 0, "a request the deadline settled leaves no timer behind either");
    });

    test("a socket-level failure surfaces as AccessNetworkError with the errno code", async () => {

      const { host, pool, transport } = makeMockTransport();
      const errno = errnoError("connect ECONNREFUSED", "ECONNREFUSED");

      pool.intercept({ method: "GET", path: "/x" }).replyWithError(errno);

      await assert.rejects(transport.send(url(host, "/x")), { code: "ECONNREFUSED", name: "AccessNetworkError" });
    });

    test("a pool destroyed under an in-flight request surfaces as AccessNetworkError", async () => {

      const { host, pool, transport } = makeMockTransport();
      const destroyed = new errors.ClientDestroyedError();

      // This is what our own reset() does to requests already in flight when the breaker trips. It is recoverable: the caller may retry against the rebuilt pool.
      pool.intercept({ method: "GET", path: "/x" }).replyWithError(destroyed);

      await assert.rejects(transport.send(url(host, "/x")), (error: unknown) => {

        assert.ok(error instanceof AccessNetworkError);
        assert.equal(error.cause, destroyed);
        assert.match(error.message, /connection pool was reset/);

        return true;
      });
    });

    test("exhausted retries surface as AccessNetworkError", async () => {

      const { host, pool, transport } = makeMockTransport();
      const exhausted = new errors.RequestRetryError("retry limit reached", 503, {});

      // An injected dispatcher whose own retry interceptor keeps undici's default gave up without handing over a usable response, which is the shape the arm is
      // worded for beside the owned pool's range and length mismatches.
      pool.intercept({ method: "GET", path: "/x" }).replyWithError(exhausted);

      await assert.rejects(transport.send(url(host, "/x")), (error: unknown) => {

        assert.ok(error instanceof AccessNetworkError);
        assert.equal(error.cause, exhausted);
        assert.match(error.message, /ended in its retry handling without a usable response/);

        return true;
      });
    });

    test("a connect-phase timeout surfaces as AccessTimeoutError carrying the elapsed time", async () => {

      const { host, pool, transport } = makeMockTransport();
      const connectTimeout = new errors.ConnectTimeoutError();

      // Distinct from our own request deadline: the connection itself never came up. It is still a timeout from the caller's point of view, so it classifies as
      // one rather than as a generic network fault.
      pool.intercept({ method: "GET", path: "/x" }).replyWithError(connectTimeout);

      await assert.rejects(transport.send(url(host, "/x")), (error: unknown) => {

        assert.ok(error instanceof AccessTimeoutError);
        assert.equal(error.cause, connectTimeout);
        assert.ok(error.elapsedMs >= 0);

        return true;
      });
    });

    test("a deadline that fires ahead of a caller's cancel surfaces as AccessTimeoutError", async () => {

      const { clock, host, pool, transport } = makeMockTransport();
      const controller = new AbortController();

      pool.intercept({ method: "GET", path: "/slow" }).reply(200, {}).delay(2000);

      const pending = transport.send(url(host, "/slow"), { signal: controller.signal });

      await settle();

      /* The deadline fires first and settles the request with its own reason, and the caller cancels in the same turn, before that rejection has been translated -
       * so the caller's signal is already aborted by the time the translation runs. Identity names the deadline, the signal that actually fired first, where a
       * test of which signal is aborted would name the caller.
       */
      clock.advance(ACCESS_API_TIMEOUT);
      controller.abort();

      await assert.rejects(pending, { elapsedMs: ACCESS_API_TIMEOUT, name: "AccessTimeoutError" });
    });

    test("a response whose headers stop arriving surfaces as AccessTimeoutError", async () => {

      const { host, pool, transport } = makeMockTransport();
      const stalled = new errors.HeadersTimeoutError();

      // undici's own response timer, which a request meets when its deadline runs past that timer or when an injected dispatcher brings timers of its own.
      pool.intercept({ method: "GET", path: "/x" }).replyWithError(stalled);

      await assert.rejects(transport.send(url(host, "/x")), (error: unknown) => {

        assert.ok(error instanceof AccessTimeoutError);
        assert.equal(error.cause, stalled);
        assert.match(error.message, /stopped responding/);

        return true;
      });
    });

    test("a response whose body stops arriving surfaces as AccessTimeoutError", async () => {

      const { host, pool, transport } = makeMockTransport();
      const stalled = new errors.BodyTimeoutError();

      pool.intercept({ method: "GET", path: "/x" }).replyWithError(stalled);

      await assert.rejects(transport.send(url(host, "/x")), (error: unknown) => {

        assert.ok(error instanceof AccessTimeoutError);
        assert.equal(error.cause, stalled);
        assert.match(error.message, /stopped responding/);

        return true;
      });
    });
  });

  /* What a request settles as, and what happens to its connection attempt, when something ends it while that attempt is still in flight.
   *
   * Every test here builds its transport WITHOUT an injected dispatcher, exactly as the certificate-verification tests below do, because the owned pool and the
   * connector beside it are the whole subject: a MockAgent replaces undici's dispatch wholesale, and everything beneath it - the connect phase included - is
   * permanently out of a mocked test's reach. The peer is a silent one, which accepts a connection and then answers nothing, so the TLS handshake stays in flight
   * for as long as a test needs it; the test about a connection attempt that fails uses a silent peer that resets the handshake instead.
   *
   * Each settlement is bounded on REAL wall-clock even where the deadline itself runs on virtual time, because a virtual clock cannot tell a prompt settlement from
   * undici's own ten-second connect timer: both end the request as the same class, and a `TestClock` reports whatever elapsed time its advance says. A settlement
   * that quietly did nothing therefore fails these tests by blowing the bound rather than by changing a class. What a cancel leaves alone - the connection attempt,
   * a request still waiting on it, and the peer's count of connections - is read after the re-dial wait, on real time as well.
   */
  describe("the connection dial", () => {

    test("a caller abort during the dial rejects at once with AccessAbortedError and leaves the connection attempt to the pool", async () => {

      await using peer = await createSilentLoopback();
      await using transport = new Transport({ clock: new TestClock(), host: peer.host, log: silentLog(), origin: "https://" + peer.host });

      const controller = new AbortController();
      const arriving = peer.connection(0);
      const pending = transport.send(url(peer.host, "/x"), { signal: controller.signal });
      const connection = await arriving;
      const startedAt = process.hrtime.bigint();

      controller.abort();

      await assert.rejects(pending, AccessAbortedError);

      assert.ok(elapsedSince(startedAt) < DIAL_SETTLE_BOUND_MS, "a cancel settles its request at once rather than waiting on undici's own connect timer");

      // The silent peer never completes the handshake, so the attempt the cancel left behind stays open until the transport is disposed, and the count of
      // connections the peer accepted is what says nothing was dialed again on the settled request's behalf.
      assert.ok(await pendingThroughRedialWait(connection.closed), "a cancel leaves the connection attempt to the pool rather than cutting it");
      assert.equal(peer.accepted, 1, "a settled request must not be dialed again");
    });

    test("the deadline during the dial rejects with AccessTimeoutError on virtual time and leaves the connection attempt to the pool", async () => {

      await using peer = await createSilentLoopback();

      const clock = new TestClock();

      await using transport = new Transport({ clock, host: peer.host, log: silentLog(), origin: "https://" + peer.host });

      const arriving = peer.connection(0);
      const pending = transport.send(url(peer.host, "/x"));
      const connection = await arriving;
      const startedAt = process.hrtime.bigint();

      clock.advance(ACCESS_API_TIMEOUT);

      await assert.rejects(pending, { elapsedMs: ACCESS_API_TIMEOUT, name: "AccessTimeoutError" });

      assert.ok(elapsedSince(startedAt) < DIAL_SETTLE_BOUND_MS, "an expired request settles at once rather than waiting on undici's own connect timer");
      assert.ok(await pendingThroughRedialWait(connection.closed), "a deadline leaves the connection attempt to the pool rather than cutting it");
      assert.equal(peer.accepted, 1, "an expired request must not be dialed again");
    });

    test("a signal already aborted when the request is dispatched rejects at once and opens no connection", async () => {

      await using peer = await createSilentLoopback();
      await using transport = new Transport({ clock: new TestClock(), host: peer.host, log: silentLog(), origin: "https://" + peer.host });

      const controller = new AbortController();

      controller.abort();

      const startedAt = process.hrtime.bigint();

      /* A listener attached to a signal that has already fired never runs, and undici acts on one only after the connect, so the check that catches this has to sit
       * ahead of the dispatch itself. The class is what proves the check is there: without it the pool's signal gate still refuses the attempt, but as a network
       * failure rather than as the caller's abort. The peer never seeing a connection at all is what proves nothing was dialed on the way.
       */
      await assert.rejects(transport.send(url(peer.host, "/x"), { signal: controller.signal }), AccessAbortedError);

      assert.ok(elapsedSince(startedAt) < DIAL_SETTLE_BOUND_MS, "a request whose signal had already fired ends at once");

      await settle();

      assert.equal(peer.accepted, 0, "a request whose signal had already fired must never open a connection");
    });

    test("a cancel while a request waits behind the first connection attempt rejects it at once and leaves that attempt to the request waiting on it", async () => {

      await using peer = await createSilentLoopback();

      const transport = new Transport({ clock: new TestClock(), host: peer.host, log: silentLog(), origin: "https://" + peer.host });
      const first = new AbortController();
      const second = new AbortController();
      const arriving = peer.connection(0);
      const pendingFirst = transport.send(url(peer.host, "/one"), { signal: first.signal });
      const pendingSecond = transport.send(url(peer.host, "/two"), { signal: second.signal });
      const connection = await arriving;
      const startedAt = process.hrtime.bigint();

      /* The pool opens a single connection attempt while it learns whether the controller speaks HTTP/2 and queues every later request behind it, so the second
       * request has no connection attempt of its own. Its cancel is a fact about it alone: it settles at once, and the attempt the first request is waiting on goes
       * on untouched.
       */
      second.abort();

      await assert.rejects(pendingSecond, AccessAbortedError);

      assert.ok(elapsedSince(startedAt) < DIAL_SETTLE_BOUND_MS, "a queued request's cancel settles it at once rather than waiting on the connection attempt ahead of it");
      assert.ok(await pendingThroughRedialWait(pendingFirst, connection.closed), "the request waiting on the connection attempt keeps it, untouched by another's cancel");
      assert.equal(peer.accepted, 1, "a cancel opens no connection of its own");

      // The rejection is claimed before the disposal that causes it, so it is never a rejection nobody is waiting on.
      const failing = assert.rejects(pendingFirst, { message: /connection pool was reset/, name: "AccessNetworkError" });

      await transport[Symbol.asyncDispose]();
      await failing;
    });

    test("a cancel of the request that owns the connection attempt rejects it at once and the request waiting behind it keeps the attempt", async () => {

      await using peer = await createSilentLoopback();

      const transport = new Transport({ clock: new TestClock(), host: peer.host, log: silentLog(), origin: "https://" + peer.host });
      const first = new AbortController();
      const second = new AbortController();
      const arriving = peer.connection(0);
      const pendingFirst = transport.send(url(peer.host, "/one"), { signal: first.signal });
      const pendingSecond = transport.send(url(peer.host, "/two"), { signal: second.signal });
      const connection = await arriving;
      const startedAt = process.hrtime.bigint();

      // The same pool in the other order: the request whose dispatch opened the connection attempt is the one cancelled, and the attempt belongs to the pool
      // rather than to it, so the request queued behind it still has an attempt to wait on.
      first.abort();

      await assert.rejects(pendingFirst, AccessAbortedError);

      assert.ok(elapsedSince(startedAt) < DIAL_SETTLE_BOUND_MS, "the cancelled owner settles at once rather than waiting on undici's own connect timer");
      assert.ok(await pendingThroughRedialWait(pendingSecond, connection.closed), "the request queued behind the cancelled one keeps the connection attempt");
      assert.equal(peer.accepted, 1, "a cancel opens no connection of its own");

      // The rejection is claimed before the disposal that causes it, so it is never a rejection nobody is waiting on.
      const failing = assert.rejects(pendingSecond, { message: /connection pool was reset/, name: "AccessNetworkError" });

      await transport[Symbol.asyncDispose]();
      await failing;
    });

    test("two requests sharing one caller signal both report the cancel at once", async () => {

      await using peer = await createSilentLoopback();
      await using transport = new Transport({ clock: new TestClock(), host: peer.host, log: silentLog(), origin: "https://" + peer.host });

      const controller = new AbortController();
      const arriving = peer.connection(0);
      const first = transport.send(url(peer.host, "/one"), { signal: controller.signal });
      const second = transport.send(url(peer.host, "/two"), { signal: controller.signal });
      const connection = await arriving;
      const startedAt = process.hrtime.bigint();

      controller.abort();

      // Both requests carry the signal that fired, so identity names the caller's cancel for each of them, the one whose dispatch opened the connection attempt
      // and the one queued behind it alike.
      await assert.rejects(first, AccessAbortedError);
      await assert.rejects(second, AccessAbortedError);

      assert.ok(elapsedSince(startedAt) < DIAL_SETTLE_BOUND_MS, "both requests settle at once rather than waiting on undici's own connect timer");
      assert.ok(await pendingThroughRedialWait(connection.closed), "a cancel leaves the connection attempt to the pool rather than cutting it");
      assert.equal(peer.accepted, 1, "a cancel opens no connection of its own");
    });

    test("a cancelled request whose connection attempt then fails with a retryable fault is not dialed again", async () => {

      await using peer = await createResettingLoopback();
      await using transport = new Transport({ clock: new TestClock(), host: peer.host, log: silentLog(), origin: "https://" + peer.host });

      const controller = new AbortController();
      const arriving = peer.connection(0);
      const pending = transport.send(url(peer.host, "/x"), { signal: controller.signal });
      const connection = await arriving;
      const startedAt = process.hrtime.bigint();

      controller.abort();

      await assert.rejects(pending, AccessAbortedError);

      assert.ok(elapsedSince(startedAt) < DIAL_SETTLE_BOUND_MS, "a cancel settles its request at once, ahead of the fault");

      /* The peer then resets the handshake the cancel left in flight, a fault the retry interceptor retries after its backoff. Its handler cannot see a signal
       * until a request has started on a connection, so what keeps the settled request off the wire is the pool's signal gate, and the peer's count of
       * connections once the first retry would have dialed is what says the gate held. The wait is that first backoff read from the pool's own retry profile rather
       * than a copy of it, so the test and the pool agree on when a retry would dial, and a change to the profile carries the test with it.
       */
      await connection.closed;
      await setTimeoutAsync(ACCESS_API_RETRY_PROFILE.minTimeout);

      assert.ok(await pendingThroughRedialWait(peer.connection(1)), "no retry dials again for a request the transport has already settled");
      assert.equal(peer.accepted, 1, "a settled request must not be dialed again after a retryable fault");
    });

    test("reset() during a dial fails the request as the pool-reset interruption and releases the socket", async () => {

      await using peer = await createSilentLoopback();
      await using transport = new Transport({ clock: new TestClock(), host: peer.host, log: silentLog(), origin: "https://" + peer.host });

      const arriving = peer.connection(0);
      const pending = transport.send(url(peer.host, "/x"));
      const connection = await arriving;
      const startedAt = process.hrtime.bigint();

      transport.reset();

      // undici's own destroy fails the request at once whether or not the connection attempt was cut, so the peer's close is the assertion that carries this row.
      await assert.rejects(pending, { message: /connection pool was reset/, name: "AccessNetworkError" });
      await connection.closed;

      assert.ok(elapsedSince(startedAt) < DIAL_SETTLE_BOUND_MS, "a reset releases a connection attempt rather than leaving it to undici's own connect timer");
    });

    test("disposal during a dial releases the socket and does not wait on it", async () => {

      await using peer = await createSilentLoopback();

      const transport = new Transport({ clock: new TestClock(), host: peer.host, log: silentLog(), origin: "https://" + peer.host });
      const arriving = peer.connection(0);
      const pending = transport.send(url(peer.host, "/x"));
      const connection = await arriving;

      // The rejection is claimed before the disposal that causes it, so it is never a rejection nobody is waiting on.
      const failing = assert.rejects(pending, { message: /connection pool was reset/, name: "AccessNetworkError" });
      const startedAt = process.hrtime.bigint();

      await transport[Symbol.asyncDispose]();

      assert.ok(elapsedSince(startedAt) < DIAL_SETTLE_BOUND_MS, "disposal must not wait out the connection attempt it severed");

      await failing;
      await connection.closed;

      assert.ok(elapsedSince(startedAt) < DIAL_SETTLE_BOUND_MS, "the severed connection attempt ends within the same bound");
    });
  });

  /* What a request settles as when a reset or a disposal lands while it is in flight on an established connection, which is what a teardown meets once the dial is
   * over.
   *
   * The owned pool is the subject here exactly as it is in the dial tests above, so no dispatcher is injected. The peer takes each request and answers none, and
   * each test awaits the peer's receipt of its request before the teardown, so the request is in flight on the connection when the teardown lands. Each test
   * asserts the protocol its connection negotiated ahead of the teardown, because a teardown that lets the pool go in the wrong order fails differently on each -
   * an uncaught exception over HTTP/2 and a misreported socket failure over HTTP/1.1 - and a test meant for one protocol that ran over the other would pass for the
   * wrong reason. The request is a PATCH, a verb the pool's retry profile leaves out, so what reaches the caller is the failure the teardown made rather than a
   * retry's.
   */
  describe("a request in flight on an established connection", () => {

    // What each request here settles as: the pool-reset interruption, carrying undici's own destroyed-client error as its cause and that error's code as its own.
    const isPoolReset = (error: unknown): boolean => {

      assert.ok(error instanceof AccessNetworkError);
      assert.match(error.message, /connection pool was reset/);
      assert.equal(error.code, "UND_ERR_DESTROYED");
      assert.ok(error.cause instanceof errors.ClientDestroyedError);

      return true;
    };

    test("reset() fails a request in flight on an HTTP/2 connection as the pool-reset interruption", async () => {

      await using peer = await createUnansweringHttpsLoopback();
      await using transport = new Transport({ clock: new TestClock(), host: peer.host, log: silentLog(), origin: "https://" + peer.host });

      const arriving = peer.connection(0);
      const pending = transport.send(url(peer.host, "/x"), { method: "PATCH" });

      await peer.request(0);

      assert.equal((await arriving).alpnProtocol, "h2", "the request is in flight on an HTTP/2 connection");

      transport.reset();

      await assert.rejects(pending, isPoolReset);
    });

    test("disposal fails a request in flight on an HTTP/2 connection as the pool-reset interruption and settles at once", async () => {

      await using peer = await createUnansweringHttpsLoopback();

      const transport = new Transport({ clock: new TestClock(), host: peer.host, log: silentLog(), origin: "https://" + peer.host });
      const arriving = peer.connection(0);
      const pending = transport.send(url(peer.host, "/x"), { method: "PATCH" });

      await peer.request(0);

      assert.equal((await arriving).alpnProtocol, "h2", "the request is in flight on an HTTP/2 connection");

      // The rejection is claimed before the disposal that causes it, so it is never a rejection nobody is waiting on.
      const failing = assert.rejects(pending, isPoolReset);
      let disposed = false;

      /* The disposal is claimed and bounded on real time rather than awaited bare, because a disposal that never settles would otherwise hold this file open past
       * the test's own failure instead of failing it within the bound.
       */
      void transport[Symbol.asyncDispose]().then(() => {

        disposed = true;
      });

      await waitUntil(() => disposed, { description: "the disposal to settle", timeoutMs: DIAL_SETTLE_BOUND_MS });
      await failing;
    });

    test("reset() fails a request in flight on an HTTP/1.1 connection as the pool-reset interruption", async () => {

      await using peer = await createUnansweringHttpsLoopback({ offerH2: false });
      await using transport = new Transport({ clock: new TestClock(), host: peer.host, log: silentLog(), origin: "https://" + peer.host });

      const arriving = peer.connection(0);
      const pending = transport.send(url(peer.host, "/x"), { method: "PATCH" });

      await peer.request(0);

      assert.equal((await arriving).alpnProtocol, "http/1.1", "the request is in flight on an HTTP/1.1 connection");

      transport.reset();

      await assert.rejects(pending, isPoolReset);
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

      /* The breaker measures whether the controller is serving, so an identity the controller keeps rejecting must not read as a controller that is down. This
       * drives the trip threshold twice over on the two statuses a wrong credential or an under-scoped token produces, and the consecutive count never accumulates
       * because every one of those answers came from a controller that was there to answer.
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

    test("consecutive 429s open the breaker, a controller limiting requests counting as one not serving", async () => {

      const { host, pool, transport } = makeMockTransport();

      // A rate limit is the controller asking to be asked less often, which is the shape the cooldown exists for, so a run of them backs the client off as a run
      // of server errors does rather than resetting the count on each answer.
      pool.intercept({ method: "GET", path: "/limited" }).reply(429, "slow down").times(ACCESS_API_ERROR_LIMIT);

      await sendFailures(transport, url(host, "/limited"), ACCESS_API_ERROR_LIMIT);

      assert.equal(transport.isThrottled, true, "consecutive 429s are a controller limiting requests and must trip the breaker");
    });

    test("consecutive 404s leave the breaker closed, a missing resource being an answer from a controller that served it", async () => {

      const { host, pool, transport } = makeMockTransport();

      // A 404 the controller kept returning reaches the breaker as the answer it was, and a run of them aimed at one wrong path says nothing about the controller.
      pool.intercept({ method: "GET", path: "/missing" }).reply(404, "not found").times(ACCESS_API_ERROR_LIMIT);

      await sendFailures(transport, url(host, "/missing"), ACCESS_API_ERROR_LIMIT);

      assert.equal(transport.isThrottled, false, "consecutive 404s are answers from a controller that served them");
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

      await assert.rejects(transport.send(url(host, "/f")), { cooldownMs: COOLDOWN_MS - 1000, name: "AccessThrottledError" });
    });

    test("a wall clock stepped forward past the cooldown does not end it early", async (t) => {

      const { agent, host, pool } = makeMockTransport();

      /* The production clock over a mocked `Date` alone, so the time of day is the row's to set while the monotonic reading stays the platform's own. A test clock
       * cannot stand in here, because its time of day never runs ahead of its monotonic reading.
       */
      t.mock.timers.enable({ apis: ["Date"], now: MOCKED_WALL_CLOCK_MS });

      const transport = new Transport({ clock: wallClock, dispatcher: agent, host, log: silentLog(), origin: "https://" + host });

      pool.intercept({ method: "GET", path: "/f" }).reply(500, "x").times(ACCESS_API_ERROR_LIMIT);
      pool.intercept({ method: "GET", path: "/f" }).reply(200, {});

      await sendFailures(transport, url(host, "/f"), ACCESS_API_ERROR_LIMIT);

      assert.equal(transport.isThrottled, true);

      // The time of day jumps past the whole cooldown while next to no time passes. Measured on the wall clock the cooldown would read as spent and admit the next
      // request as its half-open trial; measured on the monotonic reading it has barely begun, so the request is refused locally.
      t.mock.timers.setTime(MOCKED_WALL_CLOCK_MS + COOLDOWN_MS + 1);

      await assert.rejects(transport.send(url(host, "/f")), AccessThrottledError);
      assert.equal(transport.isThrottled, true, "the breaker stays open through the wall clock's step");
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
      assert.equal(transport.isThrottled, false, "a request the controller served closes the breaker, whatever the refusal said");
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

    test("logs the trip at warning level and the recovery at info level", async () => {

      const log = capturingLog();
      const { clock, host, pool, transport } = makeMockTransport({ log });

      pool.intercept({ method: "GET", path: "/f" }).reply(500, "x").times(ACCESS_API_ERROR_LIMIT);
      pool.intercept({ method: "GET", path: "/f" }).reply(200, {});

      await sendFailures(transport, url(host, "/f"), ACCESS_API_ERROR_LIMIT);

      // The breaker heals itself once the cooldown elapses, so its trip is a warning rather than an error that asks someone to act.
      assert.ok(loggedAt(log.entries, "warn", "Throttling"), "the trip should log at warning level");

      clock.advance(COOLDOWN_MS);
      await transport.send(url(host, "/f"));

      assert.ok(loggedAt(log.entries, "info", "Resumed"), "the recovery should log at info level");
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
      assert.equal(starts[0].host, configuredHost, "the start payload carries the configured controller host verbatim");
      assert.equal(ends.length, 1);

      const end = expectAt(ends, 0, "the request's end payload");

      assert.equal(end.outcome, "response", "a request that received a response reports the response outcome");
      assert.equal(end.statusCode, 200);
      assert.equal(end.host, configuredHost, "the end payload carries the configured controller host verbatim");
      assert.equal(starts[0].requestId, end.requestId, "start and end must share the requestId");
    });

    test("reports the failure outcome on the end channel when the request fails at the transport level", async () => {

      const ends: AccessHttpRequestEndPayload[] = [];

      using endSub = subscribeTo(channels.httpRequestEnd, (message) => void ends.push(message));

      const { host: configuredHost, pool, transport } = makeMockTransport();

      pool.intercept({ method: "GET", path: "/x" }).replyWithError(errnoError("connect ECONNREFUSED", "ECONNREFUSED"));

      await assert.rejects(transport.send(url(configuredHost, "/x")), AccessNetworkError);

      assert.equal(ends.length, 1);

      const end = expectAt(ends, 0, "the request's end payload");

      assert.equal(end.host, configuredHost, "the failure-path end payload still carries the configured controller host");
      assert.equal(end.outcome, "failure", "a request that never received a response reports the failure outcome");
      assert.ok(end.error.length > 0, "a transport-level failure carries the classified error's message");
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
      const transport = new Transport({ host: "127.0.0.1", origin: "https://127.0.0.1" });

      assert.equal(transport.isThrottled, false);
      assert.doesNotThrow(() => transport.reset(), "reset must rebuild the owned pool without throwing");

      await assert.doesNotReject(transport[Symbol.asyncDispose]());
    });

    test("dials its origin rather than the configured address, from the pool it built and from the one a reset rebuilds", async () => {

      /* The configured address is a name reserved never to resolve, so a request answered at all is one the owned pool sent to the origin. The request diagnostics
       * carry the address as configured all the same, because that is the name the consumer gave the controller.
       */
      await using peer = await createHttpsLoopback(() => ({ body: "{\"ok\":true}", contentType: "application/json", status: 200 }));
      await using transport = new Transport({ host: "controller.invalid", origin: peer.origin });
      const starts: AccessHttpRequestStartPayload[] = [];

      using startSub = subscribeTo(channels.httpRequestStart, (message) => void starts.push(message));

      assert.equal((await transport.send(url(peer.host, "/built"))).statusCode, 200, "the pool the transport built dials the origin");

      transport.reset();

      assert.equal((await transport.send(url(peer.host, "/rebuilt"))).statusCode, 200, "and so does the pool a reset rebuilds");
      assert.equal(transport.origin, peer.origin);
      assert.deepEqual(starts.map((start) => start.host), [ "controller.invalid", "controller.invalid" ], "the diagnostics name the address as configured");
    });
  });

  describe("certificate verification", () => {

    test("accepts the certificate a controller presents when strict verification is not asked for", async () => {

      // The peer is disposed after the transport, so the pool has released its keepalive connection by the time the server stops listening.
      await using peer = await createHttpsLoopback(() => ({ body: "{\"ok\":true}", contentType: "application/json", status: 200 }));
      await using transport = new Transport({ host: peer.host, origin: peer.origin });

      const response = await transport.send(url(peer.host, "/ok"));

      assert.equal(response.statusCode, 200, "the default reaches a controller presenting its own self-signed certificate");
    });

    test("refuses a certificate that does not verify when strict verification is asked for", async () => {

      await using peer = await createHttpsLoopback(() => ({ body: "{\"ok\":true}", contentType: "application/json", status: 200 }));
      await using transport = new Transport({ host: peer.host, origin: peer.origin, verifyTls: true });

      /* The same peer and the same request as above, one option apart. A handshake the client will not complete is a connect-phase failure, and the transport
       * reports it as the certificate refusal it is: the sentence names the listener that presented the certificate, the address that was dialed, and the
       * verifier's own words and code, so a user reads which of the controller's two listeners to go fix rather than that the host was unreachable.
       */
      await assert.rejects(async () => transport.send(url(peer.host, "/ok")), (error: unknown) => {

        assert.ok(error instanceof AccessCertificateError);
        assert.equal(error.code, "DEPTH_ZERO_SELF_SIGNED_CERT");
        assert.equal(error.host, peer.host, "the address reported is the one this transport dials");
        assert.equal(error.identity, "credentials");
        assert.ok(error.message.startsWith("The UniFi console at " + peer.host + " presented a certificate that could not be verified: "),
          "the sentence opens by naming the console and the address");
        assert.ok(error.message.endsWith("(DEPTH_ZERO_SELF_SIGNED_CERT)."), "and closes with the verifier's own code");

        return true;
      });
    });

    test("names the developer API when the transport that met the certificate carries the token identity", async () => {

      await using peer = await createHttpsLoopback(() => ({ body: "{\"ok\":true}", contentType: "application/json", status: 200 }));
      await using transport = new Transport({ host: peer.host, identity: "token", origin: peer.origin, verifyTls: true });

      // The identity leg is what fixes the listener: a token transport is built against the developer API's own address, so its refusal says so and tells the
      // user that installing a certificate on the console would not have reached this one.
      await assert.rejects(async () => transport.send(url(peer.host, "/ok")), (error: unknown) => {

        assert.ok(error instanceof AccessCertificateError);
        assert.equal(error.identity, "token");
        assert.ok(error.message.startsWith("The UniFi Access developer API at " + peer.host + " presented a certificate that could not be verified: "),
          "the sentence opens by naming the developer API");
        assert.ok(error.message.endsWith(" The developer API presents its own certificate, separate from the console's."),
          "and the token leg is told where the certificate it needs actually goes");

        return true;
      });
    });

    test("names the address its origin dials rather than the configured address, which names no listener", async () => {

      await using peer = await createHttpsLoopback(() => ({ body: "{\"ok\":true}", contentType: "application/json", status: 200 }));
      await using transport = new Transport({ host: "controller.invalid", identity: "token", origin: peer.origin, verifyTls: true });

      /* The token transport the client builds carries the address as configured for its diagnostics and dials the developer API's own origin, port included, so
       * the address a refusal names is read from that origin: the configured address would send a user to a listener nothing dialed.
       */
      await assert.rejects(async () => transport.send(url(peer.host, "/ok")), (error: unknown) => {

        assert.ok(error instanceof AccessCertificateError);
        assert.equal(error.host, peer.host, "the address reported is the origin's host and port");
        assert.equal(error.identity, "token");
        assert.ok(error.message.startsWith("The UniFi Access developer API at " + peer.host + " presented a certificate that could not be verified: "),
          "the sentence names the developer API at the address its origin dials");

        return true;
      });
    });
  });

  describe("the owned pool and the statuses it retries", () => {

    test("a GET answered 503 on every attempt returns the last 503 with its body after every attempt the profile allows", async () => {

      // The interceptor retries the profile's ceiling of times after the first attempt and then hands the controller's last answer back, for ensureOk to classify.
      await using peer = await createHttpsLoopback(() => ({ body: "{\"error\":\"starting\"}", contentType: "application/json", status: 503 }));
      await using transport = new Transport({ host: peer.host, origin: peer.origin });

      const response = await transport.send(url(peer.host, "/busy"), { timeout: RAISED_DEADLINE_MS });

      assert.equal(response.statusCode, 503);
      assert.equal(response.text(), "{\"error\":\"starting\"}");
      assert.equal(peer.hits.length, ACCESS_API_RETRY_PROFILE.maxRetries + 1, "the first attempt and every retry the profile allows");
      assert.throws(() => response.ensureOk(), { body: "{\"error\":\"starting\"}", name: "AccessRequestError", statusCode: 503 });
    });

    test("a GET answered 503 twice and then 200 returns the 200 after three requests", async () => {

      await using peer = await createHttpsLoopback((hit) => ((hit <= 2) ? { body: "{}", contentType: "application/json", status: 503 } :
        { body: "{\"ok\":true}", contentType: "application/json", status: 200 }));
      await using transport = new Transport({ host: peer.host, origin: peer.origin });

      const response = await transport.send(url(peer.host, "/recovering"));

      assert.equal(response.statusCode, 200);
      assert.deepEqual(response.json<{ ok: boolean }>(), { ok: true });
      assert.equal(peer.hits.length, 3);
    });

    // A rate limit is not retried, hinted or not, so the interceptor hands the first answer straight back with its headers, and the caller reads any hint off them.
    for(const hint of [ undefined, "30" ]) {

      test("a GET answered 429 " + ((hint === undefined) ? "with no hint" : "hinting " + hint + " seconds") + " returns its AccessRequestError after one request",
        async () => {

          await using peer = await createHttpsLoopback(() => ({ body: "{\"error\":\"slow down\"}", contentType: "application/json",
            ...((hint !== undefined) && { headers: { "retry-after": hint } }), status: 429 }));
          await using transport = new Transport({ host: peer.host, origin: peer.origin });

          await assert.rejects(transport.request(url(peer.host, "/limited"), { timeout: RAISED_DEADLINE_MS }), (error: unknown) => {

            assert.ok(error instanceof AccessRequestError);
            assert.equal(error.statusCode, 429);
            assert.equal(error.headers?.["retry-after"], hint, "the controller's hint, or its absence, reaches the caller as it was sent");

            return true;
          });

          assert.equal(peer.hits.length, 1);
        });
    }

    // A status the set retries comes back at once when its answer carries a Retry-After key, because the key's presence is the hint whatever its value says.
    for(const hint of [ "0", "" ]) {

      test("a GET answered 503 with a Retry-After of " + JSON.stringify(hint) + " returns the 503 after one request", async () => {

        await using peer = await createHttpsLoopback(() => ({ body: "{}", contentType: "application/json", headers: { "retry-after": hint }, status: 503 }));
        await using transport = new Transport({ host: peer.host, origin: peer.origin });

        const response = await transport.send(url(peer.host, "/hinted"), { timeout: RAISED_DEADLINE_MS });

        assert.equal(response.statusCode, 503);
        assert.equal(response.header("retry-after") ?? "", hint);
        assert.equal(peer.hits.length, 1, "a hinted answer is never retried");
      });
    }

    test("a PATCH answered 404 returns the 404 with its body after one request", async () => {

      // PATCH is held out of the retried verbs, so the interceptor hands the first answer straight back and send returns it for ensureOk to classify.
      await using peer = await createHttpsLoopback(() => ({ body: "{\"error\":\"missing\"}", contentType: "application/json", status: 404 }));
      await using transport = new Transport({ host: peer.host, origin: peer.origin });

      const response = await transport.send(url(peer.host, "/missing"), { method: "PATCH" });

      assert.equal(response.statusCode, 404);
      assert.equal(response.text(), "{\"error\":\"missing\"}");
      assert.equal(peer.hits.length, 1);
    });
  });

  describe("the owned pool's retry policy", () => {

    test("waits the profile's curve before each retry, and gives up with no timer once the attempts run out", (t) => {

      t.mock.timers.enable({ apis: ["setTimeout"] });

      const error = retryError(503);

      for(const [ index, delayMs ] of [ 100, 200, 400, 800, 1500 ].entries()) {

        const outcomes: (Error | null | undefined)[] = [];
        const timer = retryUnlessHinted(error, retryContext(index + 1), (result) => void outcomes.push(result));

        assert.notEqual(timer, undefined, "attempt " + String(index + 1) + " arms its wait on a timer");

        t.mock.timers.tick(delayMs - 1);

        assert.deepEqual(outcomes, [], "attempt " + String(index + 1) + " does not retry before its wait of " + String(delayMs) + " ms has elapsed");

        t.mock.timers.tick(1);

        assert.deepEqual(outcomes, [null], "attempt " + String(index + 1) + " retries once its wait of " + String(delayMs) + " ms has elapsed");
      }

      const pastCeiling: (Error | null | undefined)[] = [];

      assert.equal(retryUnlessHinted(error, retryContext(6), (result) => void pastCeiling.push(result)), undefined, "the attempt past the ceiling arms no timer");
      assert.deepEqual(pastCeiling, [error], "and gives up at once with the failure, which returns the answer");
    });

    test("gives up at once on an answer carrying a Retry-After key, whatever its value", (t) => {

      t.mock.timers.enable({ apis: ["setTimeout"] });

      for(const hint of [ "30", "0", "", "soon" ]) {

        const error = retryError(503, { "retry-after": hint });
        const outcomes: (Error | null | undefined)[] = [];

        assert.equal(retryUnlessHinted(error, retryContext(1), (result) => void outcomes.push(result)), undefined, JSON.stringify(hint) + " arms no timer");
        assert.deepEqual(outcomes, [error], "a Retry-After of " + JSON.stringify(hint) + " gives the answer up at once");
      }
    });

    test("decides every answer that carries no hint exactly as undici's own default decision does", (t) => {

      t.mock.timers.enable({ apis: ["setTimeout"] });

      // Undici publishes no handle on its default decision, so it is reached by the description of the symbol it is keyed by on the handler class.
      const symbol = Object.getOwnPropertySymbols(RetryHandler).find((candidate) => (candidate.description === "retry agent default retry"));

      assert.ok(symbol !== undefined, "undici keys its default decision on the handler class by a symbol of this description");

      const undiciDefault = Reflect.get(RetryHandler, symbol) as RetryHandler.RetryCallback;

      assert.equal(typeof undiciDefault, "function");

      const cases: { context: RetryHandler.RetryContext; error: Error; name: string }[] = [

        ...[ 1, 2, 3, 4, 5, 6, 7 ].map((counter) => ({ context: retryContext(counter), error: retryError(503), name: "a 503 at attempt " + String(counter) })),
        { context: retryContext(1), error: retryError(404), name: "a 404" },
        { context: retryContext(1), error: retryError(429), name: "a 429, which the set leaves out" },
        { context: retryContext(1), error: retryError(501), name: "a 501, which the set leaves out" },
        { context: retryContext(1, { method: "PATCH" }), error: retryError(503), name: "a 503 to a PATCH, which the verbs leave out" },
        { context: retryContext(1, { retryOptions: { ...RETRY_OPTIONS, maxRetries: 0 } }), error: retryError(503), name: "a 503 to a request opted out of retries" },
        { context: retryContext(1), error: errnoError("read ECONNRESET", "ECONNRESET"), name: "a connection reset" },
        { context: retryContext(3), error: errnoError("read ECONNRESET", "ECONNRESET"), name: "a connection reset at the third attempt" },
        { context: retryContext(1), error: errnoError("connect timeout", "UND_ERR_CONNECT_TIMEOUT"), name: "a connect timeout, which the codes leave out" },
        { context: retryContext(1), error: new errors.RequestAbortedError(), name: "an aborted request" },
        { context: retryContext(1), error: new Error("no code"), name: "a failure carrying no code" }
      ];

      const verdicts = new Set<string>();

      for(const { context, error, name } of cases) {

        const expected = decide(t.mock.timers, undiciDefault, error, context);

        verdicts.add(expected.outcome);
        assert.deepEqual(decide(t.mock.timers, retryUnlessHinted, error, context), expected, name);
      }

      assert.deepEqual([...verdicts].sort(), [ "gave up", "retried" ], "the cases reach both of the default's verdicts, and every one of them settles");
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

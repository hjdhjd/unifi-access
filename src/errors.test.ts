/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * errors.test.ts: Unit tests for the typed error hierarchy. The hierarchy's whole purpose is that a consumer can branch on the abstract base (RecoverableError vs.
 * FatalError) for policy and on the concrete class for handling, so these tests assert the instanceof relationships exhaustively, that each error reports its own
 * class name and chains its cause, that the typed fields are carried, and that the errno resolution behaves across the shapes undici and Node produce.
 */
import { AccessAbortedError, AccessAuthError, AccessAuthorizationError, AccessBootstrapError, AccessError, AccessNetworkError, AccessOfficialApiError,
  AccessProtocolError, AccessRequestError, AccessStallError, AccessThrottledError, AccessTimeoutError, FatalError, RecoverableError, isExpectedWsDisconnect,
  resolveErrnoCause } from "./errors.ts";
import { describe, test } from "node:test";
import assert from "node:assert/strict";

describe("AccessError hierarchy", () => {

  const recoverable = [

    new AccessAbortedError("aborted"),
    new AccessNetworkError("net", { code: "ECONNREFUSED" }),
    new AccessStallError("stall", { silentForMs: 10000 }),
    new AccessThrottledError("throttle", { cooldownMs: 300000 }),
    new AccessTimeoutError("timeout", { elapsedMs: 3500 })
  ];

  const fatal = [

    new AccessAuthError("auth", { statusCode: 401 }),
    new AccessAuthorizationError("authz", { statusCode: 403 }),
    new AccessBootstrapError("bootstrap", { stage: "fetch" }),
    new AccessOfficialApiError("official", { code: "CODE_PARAMS_INVALID" }),
    new AccessProtocolError("protocol"),
    new AccessRequestError("request", { statusCode: 500 })
  ];

  for(const error of recoverable) {

    test(error.name + " is a RecoverableError and an AccessError, not a FatalError", () => {

      assert.ok(error instanceof RecoverableError);
      assert.ok(error instanceof AccessError);
      assert.ok(error instanceof Error);
      assert.ok(!(error instanceof FatalError));
      assert.equal(error.name, error.constructor.name, "name should reflect the concrete class");
    });
  }

  for(const error of fatal) {

    test(error.name + " is a FatalError and an AccessError, not a RecoverableError", () => {

      assert.ok(error instanceof FatalError);
      assert.ok(error instanceof AccessError);
      assert.ok(error instanceof Error);
      assert.ok(!(error instanceof RecoverableError));
      assert.equal(error.name, error.constructor.name);
    });
  }
});

describe("typed error fields and cause chaining", () => {

  test("each error chains its cause", () => {

    const root = new Error("root cause");

    assert.ok(Object.is(new AccessTimeoutError("m", { cause: root, elapsedMs: 1 }).cause, root));
    assert.ok(Object.is(new AccessProtocolError("m", { cause: root }).cause, root));
    assert.ok(Object.is(new AccessAbortedError("m", { cause: root }).cause, root));
    assert.ok(Object.is(new AccessAuthError("m", { cause: root }).cause, root));
    assert.ok(Object.is(new AccessAuthorizationError("m", { cause: root }).cause, root));
    assert.ok(Object.is(new AccessBootstrapError("m", { cause: root, stage: "parse" }).cause, root));
    assert.ok(Object.is(new AccessOfficialApiError("m", { cause: root, code: "CODE_SYSTEM_ERROR" }).cause, root));
    assert.ok(Object.is(new AccessRequestError("m", { cause: root, statusCode: 500 }).cause, root));
    assert.ok(Object.is(new AccessStallError("m", { cause: root, silentForMs: 1 }).cause, root));
    assert.ok(Object.is(new AccessThrottledError("m", { cause: root, cooldownMs: 1 }).cause, root));
  });

  test("AccessThrottledError carries cooldownMs", () => {

    assert.equal(new AccessThrottledError("m", { cooldownMs: 300000 }).cooldownMs, 300000);
  });

  test("AccessTimeoutError carries elapsedMs", () => {

    assert.equal(new AccessTimeoutError("m", { elapsedMs: 3500 }).elapsedMs, 3500);
  });

  test("AccessStallError carries silentForMs", () => {

    assert.equal(new AccessStallError("m", { silentForMs: 10000 }).silentForMs, 10000);
  });

  test("AccessRequestError carries statusCode, body, and headers", () => {

    const error = new AccessRequestError("m", { body: { error: "nope" }, headers: { "content-type": "application/json" }, statusCode: 503 });

    assert.equal(error.statusCode, 503);
    assert.deepEqual(error.body, { error: "nope" });
    assert.deepEqual(error.headers, { "content-type": "application/json" });

    const bare = new AccessRequestError("m", { statusCode: 404 });

    assert.equal(bare.body, undefined, "a response read without a body leaves body undefined rather than fabricating one");
    assert.equal(bare.headers, undefined, "headers stay undefined when the call site captured none");
  });

  test("AccessBootstrapError carries its stage tag", () => {

    assert.equal(new AccessBootstrapError("m", { stage: "fetch" }).stage, "fetch");
    assert.equal(new AccessBootstrapError("m", { stage: "parse" }).stage, "parse");
  });

  test("AccessOfficialApiError carries the controller's result code, with its message as the message", () => {

    const error = new AccessOfficialApiError("The requested resource was not found.", { code: "CODE_RESOURCE_NOT_FOUND" });

    assert.equal(error.code, "CODE_RESOURCE_NOT_FOUND");
    assert.equal(error.message, "The requested resource was not found.", "the controller's own words are the error's message rather than a second field");

    // The code vocabulary admits values the reference does not list, because what the reference publishes is what it documents rather than a guarantee about what
    // the controller can send.
    assert.equal(new AccessOfficialApiError("m", { code: "CODE_SOMETHING_UNDOCUMENTED" }).code, "CODE_SOMETHING_UNDOCUMENTED");
  });

  test("AccessAuthError and AccessAuthorizationError carry their status codes", () => {

    assert.equal(new AccessAuthError("m", { statusCode: 401 }).statusCode, 401);
    assert.equal(new AccessAuthorizationError("m", { statusCode: 403 }).statusCode, 403);
    assert.equal(new AccessAuthError("m").statusCode, undefined, "a failure that did not originate from a response carries no status");
    assert.equal(new AccessAuthorizationError("m").statusCode, undefined, "a failure that did not originate from a response carries no status");
  });

  test("AccessAuthError carries the identity leg the controller refused", () => {

    assert.equal(new AccessAuthError("m", { identity: "credentials" }).identity, "credentials");
    assert.equal(new AccessAuthError("m", { identity: "token" }).identity, "token");

    // Attributing a leg is optional, so a construction that names none is valid and reads as unattributed - which is what keeps every shorter construction working.
    assert.equal(new AccessAuthError("m").identity, undefined, "a failure the caller attributed to neither identity carries no leg");
    assert.equal(new AccessAuthError("m", { statusCode: 401 }).identity, undefined, "and a status-only construction attributes none either");
  });

  test("AccessAuthorizationError carries the identity leg whose privileges fell short", () => {

    assert.equal(new AccessAuthorizationError("m", { identity: "credentials" }).identity, "credentials");
    assert.equal(new AccessAuthorizationError("m", { identity: "token" }).identity, "token");

    // The leg is optional here for the same reason it is on the authentication error: a refusal the caller could not attribute is still a valid construction.
    assert.equal(new AccessAuthorizationError("m").identity, undefined, "a refusal the caller attributed to neither identity carries no leg");
    assert.equal(new AccessAuthorizationError("m", { statusCode: 403 }).identity, undefined, "and a status-only construction attributes none either");
  });

  test("AccessNetworkError resolves its code from the cause chain when not given explicitly", () => {

    const errno = Object.assign(new Error("getaddrinfo ENOTFOUND"), { code: "ENOTFOUND" });

    assert.equal(new AccessNetworkError("m", { cause: errno }).code, "ENOTFOUND");
    assert.equal(new AccessNetworkError("m", { code: "ECONNREFUSED" }).code, "ECONNREFUSED", "an explicit code wins over the cause chain");
    assert.equal(new AccessNetworkError("m").code, undefined, "no code and no resolvable cause yields undefined");
  });
});

describe("resolveErrnoCause", () => {

  test("resolves a Node ErrnoException wrapped on the cause chain (undici shape)", () => {

    const inner = Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" });
    const outer = new TypeError("fetch failed", { cause: inner });

    assert.ok(Object.is(resolveErrnoCause(outer), inner));
    assert.equal(resolveErrnoCause(outer)?.code, "ECONNREFUSED");
  });

  test("resolves a bare ErrnoException", () => {

    const errno = Object.assign(new Error("read ETIMEDOUT"), { code: "ETIMEDOUT" });

    assert.ok(Object.is(resolveErrnoCause(errno), errno));
  });

  test("returns undefined for an error whose code is not a string", () => {

    assert.equal(resolveErrnoCause(Object.assign(new Error("x"), { code: 42 })), undefined);
  });

  test("returns undefined for non-error and code-less inputs", () => {

    assert.equal(resolveErrnoCause("a string"), undefined);
    assert.equal(resolveErrnoCause(undefined), undefined);
    assert.equal(resolveErrnoCause(new Error("plain")), undefined);
  });
});

describe("isExpectedWsDisconnect", () => {

  test("screens the TypeError undici raises from its own WebSocket teardown", () => {

    assert.equal(isExpectedWsDisconnect(new TypeError("terminated")), true);
  });

  test("screens an ETIMEDOUT errno on the cause chain", () => {

    // The slow-controller path. The stream's own silence watchdog reports prolonged silence as its own typed signal, so logging this socket-level errno as an
    // error too would be duplicate noise for a single condition.
    const errno = Object.assign(new Error("read ETIMEDOUT"), { code: "ETIMEDOUT" });

    assert.equal(isExpectedWsDisconnect(errno), true);
    assert.equal(isExpectedWsDisconnect(new Error("wrapped", { cause: errno })), true, "the errno is screened one hop down the cause chain as well");
  });

  test("does not screen an ordinary error", () => {

    assert.equal(isExpectedWsDisconnect(new Error("socket reset")), false);
    assert.equal(isExpectedWsDisconnect(Object.assign(new Error("refused"), { code: "ECONNREFUSED" })), false, "a different errno is a fault worth reporting");
  });

  test("does not screen a non-error value", () => {

    assert.equal(isExpectedWsDisconnect(undefined), false);
    assert.equal(isExpectedWsDisconnect("terminated"), false);
    assert.equal(isExpectedWsDisconnect(null), false);
  });
});

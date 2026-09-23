/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * errors.test.ts: Unit tests for the typed error hierarchy. The hierarchy's whole purpose is that a consumer can branch on the abstract base (RecoverableError vs.
 * FatalError) for policy and on the concrete class for handling, so these tests assert the instanceof relationships for the classes listed below, that each one reports
 * its own class name and chains its cause, that the typed fields are carried, and that the errno resolution behaves across the shapes undici and Node produce.
 */
import { AccessAbortedError, AccessApiError, AccessAuthError, AccessAuthorizationError, AccessBootstrapError, AccessCapabilityError,
  AccessCertificateError, AccessError, AccessNetworkError, AccessProtocolError, AccessRequestError, AccessStallError, AccessThrottledError,
  AccessTimeoutError, FatalError, RecoverableError, assertNever, formatErrorChain, isCertificateVerificationFailure, isExpectedWsDisconnect,
  isPrivilegeRefusal, resolveErrnoCause } from "./errors.ts";
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { errnoError } from "./testing.helpers.ts";

describe("AccessError hierarchy", () => {

  const recoverable = [

    new AccessAbortedError("aborted"),
    new AccessCertificateError({ cause: errnoError("self-signed certificate", "DEPTH_ZERO_SELF_SIGNED_CERT"), host: "hub.example", identity: "credentials" }),
    new AccessNetworkError("net", { code: "ECONNREFUSED" }),
    new AccessStallError("stall", { silentForMs: 10000 }),
    new AccessThrottledError("throttle", { cooldownMs: 300000 }),
    new AccessTimeoutError("timeout", { elapsedMs: 3500 })
  ];

  const fatal = [

    new AccessAuthError("auth", { statusCode: 401 }),
    new AccessAuthorizationError("authz", { statusCode: 403 }),
    new AccessBootstrapError("bootstrap", { stage: "fetch" }),
    new AccessCapabilityError("capability"),
    new AccessApiError("api", { code: "CODE_PARAMS_INVALID" }),
    new AccessProtocolError("protocol"),
    new AccessRequestError("request", { statusCode: 500 })
  ];

  for(const error of recoverable) {

    test(error.name + " is a RecoverableError and an AccessError, not a FatalError", () => {

      assert.ok(error instanceof RecoverableError, "the error is a RecoverableError");
      assert.ok(error instanceof AccessError, "the error is an AccessError");
      assert.ok(error instanceof Error, "the error is an Error");
      assert.ok(!(error instanceof FatalError), "a recoverable error is never a FatalError");
      assert.equal(error.name, error.constructor.name, "name should reflect the concrete class");
    });
  }

  for(const error of fatal) {

    test(error.name + " is a FatalError and an AccessError, not a RecoverableError", () => {

      assert.ok(error instanceof FatalError, "the error is a FatalError");
      assert.ok(error instanceof AccessError, "the error is an AccessError");
      assert.ok(error instanceof Error, "the error is an Error");
      assert.ok(!(error instanceof RecoverableError), "a fatal error is never a RecoverableError");
      assert.equal(error.name, error.constructor.name);
    });
  }
});

describe("typed error fields and cause chaining", () => {

  test("each error chains its cause", () => {

    const root = new Error("root cause");

    assert.ok(Object.is(new AccessTimeoutError("m", { cause: root, elapsedMs: 1 }).cause, root), "the timeout error chains its cause");
    assert.ok(Object.is(new AccessProtocolError("m", { cause: root }).cause, root), "the protocol error chains its cause");
    assert.ok(Object.is(new AccessAbortedError("m", { cause: root }).cause, root), "the aborted error chains its cause");
    assert.ok(Object.is(new AccessAuthError("m", { cause: root }).cause, root), "the authentication error chains its cause");
    assert.ok(Object.is(new AccessAuthorizationError("m", { cause: root }).cause, root), "the authorization error chains its cause");
    assert.ok(Object.is(new AccessBootstrapError("m", { cause: root, stage: "parse" }).cause, root), "the bootstrap error chains its cause");
    assert.ok(Object.is(new AccessCapabilityError("m", { cause: root }).cause, root), "the capability error chains its cause");
    assert.ok(Object.is(new AccessApiError("m", { cause: root, code: "CODE_SYSTEM_ERROR" }).cause, root), "the result-envelope refusal chains its cause");
    assert.ok(Object.is(new AccessRequestError("m", { cause: root, statusCode: 500 }).cause, root), "the request error chains its cause");
    assert.ok(Object.is(new AccessStallError("m", { cause: root, silentForMs: 1 }).cause, root), "the stall error chains its cause");
    assert.ok(Object.is(new AccessThrottledError("m", { cause: root, cooldownMs: 1 }).cause, root), "the throttled error chains its cause");
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

    assert.equal(new AccessBootstrapError("m", { stage: "apply" }).stage, "apply");
    assert.equal(new AccessBootstrapError("m", { stage: "fetch" }).stage, "fetch");
    assert.equal(new AccessBootstrapError("m", { stage: "parse" }).stage, "parse");
  });

  test("AccessApiError carries the controller's result code, with its message as the message", () => {

    const error = new AccessApiError("The requested resource was not found.", { code: "CODE_RESOURCE_NOT_FOUND" });

    assert.equal(error.code, "CODE_RESOURCE_NOT_FOUND");
    assert.equal(error.message, "The requested resource was not found.", "the controller's own words are the error's message rather than a second field");

    // The controller's own diagnostic reaches the caller as a field of its own, beside the message rather than folded into it.
    assert.equal(new AccessApiError("m", { code: "CODE_SYSTEM_ERROR", detail: "d" }).detail, "d");

    // The code vocabulary admits values the reference does not list, because what the reference publishes is what it documents rather than a guarantee about what
    // the controller can send.
    assert.equal(new AccessApiError("m", { code: "CODE_SOMETHING_UNDOCUMENTED" }).code, "CODE_SOMETHING_UNDOCUMENTED");
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

    const errno = errnoError("getaddrinfo ENOTFOUND", "ENOTFOUND");

    assert.equal(new AccessNetworkError("m", { cause: errno }).code, "ENOTFOUND");
    assert.equal(new AccessNetworkError("m", { code: "ECONNREFUSED" }).code, "ECONNREFUSED", "an explicit code wins over the cause chain");
    assert.equal(new AccessNetworkError("m").code, undefined, "no code and no resolvable cause yields undefined");
  });
});

describe("AccessCertificateError", () => {

  const selfSigned = errnoError("self-signed certificate", "DEPTH_ZERO_SELF_SIGNED_CERT");

  test("is an AccessNetworkError, so every reading that already treats a reachability failure as recoverable covers it", () => {

    const error = new AccessCertificateError({ cause: selfSigned, host: "hub.example", identity: "credentials" });

    assert.ok(error instanceof AccessNetworkError, "a certificate refusal is a network failure with a name");
    assert.ok(error instanceof RecoverableError, "an operator installing a certificate fixes it while the process runs");
    assert.ok(!(error instanceof FatalError), "a fatal classification would stop the connection monitor trying again");
  });

  test("names the console, the address dialed, the reason, and the code on the credentials leg", () => {

    const error = new AccessCertificateError({ cause: selfSigned, host: "hub.example", identity: "credentials" });

    assert.equal(error.message, "The UniFi console at hub.example presented a certificate that could not be verified: self-signed certificate " +
      "(DEPTH_ZERO_SELF_SIGNED_CERT).");
    assert.equal(error.code, "DEPTH_ZERO_SELF_SIGNED_CERT", "the code lifts from the very cause the sentence was composed from");
    assert.equal(error.host, "hub.example");
    assert.equal(error.identity, "credentials");
  });

  test("names the developer API and its separate certificate on the token leg", () => {

    const error = new AccessCertificateError({ cause: selfSigned, host: "hub.example:12445", identity: "token" });

    // The closing sentence is the whole remedy a token identity needs: the certificate that fixes the console is not the one this listener presents.
    assert.equal(error.message, "The UniFi Access developer API at hub.example:12445 presented a certificate that could not be verified: self-signed " +
      "certificate (DEPTH_ZERO_SELF_SIGNED_CERT). The developer API presents its own certificate, separate from the console's.");
    assert.equal(error.host, "hub.example:12445");
    assert.equal(error.identity, "token");
  });

  test("drops the reason clause when the platform supplied no words", () => {

    const error = new AccessCertificateError({ cause: errnoError("", "DEPTH_ZERO_SELF_SIGNED_CERT"), host: "hub.example", identity: "credentials" });

    assert.equal(error.message, "The UniFi console at hub.example presented a certificate that could not be verified (DEPTH_ZERO_SELF_SIGNED_CERT).",
      "a sentence with nothing to introduce carries no colon to introduce it with");
  });

  test("states the refusal alone when the cause carries no errno to read", () => {

    // The class is public, so a caller can construct it around a cause the errno resolution cannot read. There is then neither a reason nor a code to report,
    // and the sentence says the one thing still known.
    const error = new AccessCertificateError({ cause: new TypeError("terminated"), host: "hub.example", identity: "credentials" });

    assert.equal(error.message, "The UniFi console at hub.example presented a certificate that could not be verified.");
    assert.equal(error.code, undefined, "there was no errno to lift one from");
  });

  test("trims the platform's own padding out of the reason clause", () => {

    const error = new AccessCertificateError({ cause: errnoError("  self-signed certificate \n", "DEPTH_ZERO_SELF_SIGNED_CERT"), host: "hub.example",
      identity: "credentials" });

    assert.ok(error.message.includes(": self-signed certificate ("), "the reason reads as one clause rather than carrying the platform's whitespace");
  });
});

describe("isCertificateVerificationFailure", () => {

  test("reads the verifier's verdict off the errno, bare or one hop down the cause chain", () => {

    assert.equal(isCertificateVerificationFailure(errnoError("unable to verify the first certificate", "UNABLE_TO_VERIFY_LEAF_SIGNATURE")), true);
    assert.equal(isCertificateVerificationFailure(errnoError("hostname mismatch", "ERR_TLS_CERT_ALTNAME_INVALID")), true,
      "the hostname check Node runs itself is a verdict about the certificate too");

    const expired = errnoError("certificate has expired", "CERT_HAS_EXPIRED");

    assert.equal(isCertificateVerificationFailure(new Error("fetch failed", { cause: expired })), true, "the wrapped shape undici raises resolves as well");
  });

  test("answers false for every failure that is not a verdict about a certificate", () => {

    assert.equal(isCertificateVerificationFailure(errnoError("connect ECONNREFUSED", "ECONNREFUSED")), false, "a host that refused presented nothing");
    assert.equal(isCertificateVerificationFailure(errnoError("out of memory", "OUT_OF_MEM")), false, "the verifier running out of room is not a verdict");
    assert.equal(isCertificateVerificationFailure(new TypeError("terminated")), false, "a content-free socket failure carries no errno at all");
    assert.equal(isCertificateVerificationFailure(undefined), false);
  });
});

describe("resolveErrnoCause", () => {

  test("resolves a Node ErrnoException wrapped on the cause chain (undici shape)", () => {

    const inner = errnoError("connect ECONNREFUSED", "ECONNREFUSED");
    const outer = new TypeError("fetch failed", { cause: inner });

    assert.ok(Object.is(resolveErrnoCause(outer), inner), "the errno exception is found where it sits on the cause chain");
    assert.equal(resolveErrnoCause(outer)?.code, "ECONNREFUSED");
  });

  test("resolves a bare ErrnoException", () => {

    const errno = errnoError("read ETIMEDOUT", "ETIMEDOUT");

    assert.ok(Object.is(resolveErrnoCause(errno), errno), "a bare errno exception resolves to itself");
  });

  test("returns undefined for an error whose code is not a string", () => {

    // Built by hand rather than through the shared factory, whose code is a string: a code of the wrong type is the whole of what this row drives.
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
    const errno = errnoError("read ETIMEDOUT", "ETIMEDOUT");

    assert.equal(isExpectedWsDisconnect(errno), true);
    assert.equal(isExpectedWsDisconnect(new Error("wrapped", { cause: errno })), true, "the errno is screened one hop down the cause chain as well");
  });

  test("does not screen an ordinary error", () => {

    assert.equal(isExpectedWsDisconnect(new Error("socket reset")), false);
    assert.equal(isExpectedWsDisconnect(errnoError("refused", "ECONNREFUSED")), false, "a different errno is a fault worth reporting");
  });

  test("does not screen a non-error value", () => {

    assert.equal(isExpectedWsDisconnect(undefined), false);
    assert.equal(isExpectedWsDisconnect("terminated"), false);
    assert.equal(isExpectedWsDisconnect(null), false);
  });
});

describe("isPrivilegeRefusal", () => {

  test("recognizes the transport's classification of a refused status", () => {

    assert.equal(isPrivilegeRefusal(new AccessAuthorizationError("authz", { identity: "token", statusCode: 403 })), true);
    assert.equal(isPrivilegeRefusal(new AccessAuthorizationError("authz")), true, "a refusal the caller attributed to neither identity is still a refusal");
  });

  test("recognizes the controller's own refusal code answered inside a successful response", () => {

    assert.equal(isPrivilegeRefusal(new AccessApiError("api", { code: "CODE_OPERATION_FORBIDDEN" })), true);
  });

  test("does not recognize an API error carrying any other code", () => {

    assert.equal(isPrivilegeRefusal(new AccessApiError("api", { code: "CODE_UNAUTHORIZED" })), false, "a refused identity is a different fault");
    assert.equal(isPrivilegeRefusal(new AccessApiError("api", { code: "CODE_SOMETHING_THE_REFERENCE_OMITS" })), false,
      "and a code the documentation does not list is not one either");
  });

  test("does not recognize a failed authentication", () => {

    assert.equal(isPrivilegeRefusal(new AccessAuthError("auth", { statusCode: 401 })), false);
  });

  test("reads the error it was handed rather than the chain below it", () => {

    // The library wraps a refused bootstrap document, so this is the shape a caller holding that wrapper has to reach one hop into.
    const refusal = new AccessAuthorizationError("authz", { identity: "credentials", statusCode: 403 });
    const wrapper = new AccessBootstrapError("Unable to fetch the controller configuration.", { cause: refusal, stage: "fetch" });

    assert.equal(isPrivilegeRefusal(wrapper), false, "a wrapper around a refusal is not itself one");
    assert.equal(isPrivilegeRefusal(wrapper.cause), true, "while the cause it carries is");
  });

  test("does not recognize a value that is not one of the classified errors", () => {

    assert.equal(isPrivilegeRefusal(undefined), false);
    assert.equal(isPrivilegeRefusal("CODE_OPERATION_FORBIDDEN"), false, "the code as bare text is not the error the library raises");
    assert.equal(isPrivilegeRefusal({ code: "CODE_OPERATION_FORBIDDEN" }), false, "and neither is a plain object wearing it");
  });

  test("leaves an API error carrying another code in the caller's type, and narrows the code inside a refusal", () => {

    /* The compile-time half of the reading, checked by the typecheck gate. A type guard narrows the false branch as well as the true one, so answering with the
     * bare class would subtract `AccessApiError` from the false branch entirely and leave the reads below with nothing to reach for.
     */
    const other: AccessApiError = new AccessApiError("api", { code: "CODE_NOT_EXISTS", detail: "no such door" });

    if(isPrivilegeRefusal(other)) {

      assert.fail("an API error carrying another code is not a privilege refusal");
    }

    assert.equal(other.code, "CODE_NOT_EXISTS", "the false branch still holds an API error whose code can be read");
    assert.equal(other.detail, "no such door", "and whose diagnostic can be read there too");

    const thrown: unknown = new AccessApiError("api", { code: "CODE_OPERATION_FORBIDDEN", detail: "insufficient permission" });

    assert.ok(isPrivilegeRefusal(thrown) && (thrown instanceof AccessApiError), "the refusal narrows to the arm that carries the code");

    const refused: "CODE_OPERATION_FORBIDDEN" = thrown.code;

    // @ts-expect-error - the true branch narrows the code to the one literal, so no other member of the controller's vocabulary is assignable from it.
    const mismatched: "CODE_NOT_EXISTS" = thrown.code;

    assert.deepEqual([ refused, mismatched ], Array(2).fill("CODE_OPERATION_FORBIDDEN"));
  });
});

describe("assertNever", () => {

  test("names a value that carries no kind tag by its string form", () => {

    // The other arm - an object variant whose `kind` the guard reports - is proven by the reducer suite's rogue-kind test. This one has no tag to read at all, so
    // the value's string form is the whole of what the refusal can name, and naming it is what makes the failure traceable to the variant that caused it.
    assert.throws(() => assertNever("bogus" as never), (error: unknown) => {

      assert.ok(error instanceof AccessProtocolError, "the refusal is a protocol error");
      assert.ok(error.message.includes("bogus"), "the refusal names the value it could not handle");

      return true;
    });
  });
});

describe("formatErrorChain", () => {

  test("renders a lone error as its message less one terminal period", () => {

    assert.equal(formatErrorChain(new Error("Unable to fetch the bootstrap.")), "Unable to fetch the bootstrap");
    assert.equal(formatErrorChain(new Error("Unable to fetch the bootstrap")), "Unable to fetch the bootstrap", "a message carrying no period of its own is left alone");
  });

  test("renders a value that is not an error through its string form", () => {

    assert.equal(formatErrorChain("the controller refused."), "the controller refused");
    assert.equal(formatErrorChain(42), "42", "a number renders as its digits");
    assert.equal(formatErrorChain(undefined), "undefined", "a thrown undefined still renders as text rather than throwing");
  });

  test("joins the messages of a two-link and a three-link chain with a colon", () => {

    const twoLink = new Error("Unable to fetch the bootstrap.", { cause: new Error("the controller refused the request.") });
    const threeLink = new Error("Unable to fetch the bootstrap.",
      { cause: new Error("the controller refused the request.", { cause: new Error("connect ECONNREFUSED.") }) });

    assert.equal(formatErrorChain(twoLink), "Unable to fetch the bootstrap: the controller refused the request");
    assert.equal(formatErrorChain(threeLink), "Unable to fetch the bootstrap: the controller refused the request: connect ECONNREFUSED");
  });

  test("does not repeat a cause whose words the sentence that was caught already carries", () => {

    const wrapped = new Error("Unable to fetch the bootstrap: the controller refused the request.", { cause: new Error("the controller refused the request.") });

    assert.equal(formatErrorChain(wrapped), "Unable to fetch the bootstrap: the controller refused the request");
  });

  test("does not repeat a cause whose words an earlier link already appended", () => {

    // What tells a containment check reading everything rendered so far from one reading the top message alone: the third link's words sit inside the second
    // link's appended text and nowhere in the top sentence, so only a built-so-far check leaves them out.
    const middle = new Error("the controller refused the request.", { cause: new Error("the controller refused.") });

    assert.equal(formatErrorChain(new Error("Unable to unlock the door.", { cause: middle })), "Unable to unlock the door: the controller refused the request");
  });

  test("appends nothing for a cause whose message is empty", () => {

    assert.equal(formatErrorChain(new Error("Unable to fetch the bootstrap.", { cause: new Error("") })), "Unable to fetch the bootstrap");
  });

  test("skips a link that is not an error and keeps descending below it", () => {

    // Structured context attached as a cause is for code to read, so it contributes no text...but the error sitting beneath it still does.
    const context = { cause: new Error("connect ECONNREFUSED."), code: "CODE_SYSTEM_ERROR" };

    assert.equal(formatErrorChain(new Error("Unable to fetch the bootstrap.", { cause: context })), "Unable to fetch the bootstrap: connect ECONNREFUSED");
  });

  test("ends the descent at a cause that is not an object", () => {

    assert.equal(formatErrorChain(new Error("Unable to fetch the bootstrap.", { cause: "the controller refused." })), "Unable to fetch the bootstrap");
  });

  test("renders a top value that is not an error and still appends the chain below it", () => {

    const thrown = { cause: new Error("the controller refused the request."), code: "CODE_SYSTEM_ERROR" };

    assert.equal(formatErrorChain(thrown), "[object Object]: the controller refused the request");
  });

  test("stops the descent at the depth bound", () => {

    let chain = new Error("level 11.");

    for(let level = 10; level >= 0; level--) {

      chain = new Error("level " + level.toString() + ".", { cause: chain });
    }

    assert.equal(formatErrorChain(chain), "level 0: level 1: level 2: level 3: level 4: level 5: level 6: level 7: level 8",
      "the rendering carries the bound's worth of links below the one that was caught and stops there");
  });

  test("terminates on a chain that refers back to itself", () => {

    const outer = new Error("Unable to fetch the bootstrap.");

    outer.cause = new Error("the controller refused the request.", { cause: outer });

    assert.equal(formatErrorChain(outer), "Unable to fetch the bootstrap: the controller refused the request");
  });

  test("descends once into a cause key carrying undefined and renders the chain above it", () => {

    const middle = new Error("the controller refused the request.", { cause: undefined });

    assert.ok("cause" in middle, "the key is present even though the value it carries is undefined");
    assert.equal(formatErrorChain(middle), "the controller refused the request");
    assert.equal(formatErrorChain(new Error("Unable to fetch the bootstrap.", { cause: middle })),
      "Unable to fetch the bootstrap: the controller refused the request");
  });
});

/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * ws.test.ts: Tests for the socket teardown vocabulary - the close code each teardown reason carries, the close frame in the words an error message quotes it in,
 * and the line a socket error is logged with, read at the level the connection-fault table answers and only for a stream that had opened.
 */
import { closeFrameText, socketFault, teardownCode } from "./ws.ts";
import { describe, test } from "node:test";
import { AccessNetworkError } from "../errors.ts";
import assert from "node:assert/strict";
import { classifyTransportError } from "./failure.ts";
import { errnoError } from "homebridge-plugin-utils/testing";

// The sentence the stream reports a socket error's line in, and the reason its close is announced with, as the stream hands them to the fault builder.
const REPORTED = "The UniFi Access realtime notification API reported an error.";
const ERRORED = "the notification stream connection errored";

describe("teardownCode", () => {

  test("a close the stream chose is 1000, a fault is 1006, and a peer's close carries its own frame's code", () => {

    const error = new AccessNetworkError("The UniFi Access realtime notification API connection failed.");

    assert.equal(teardownCode({ kind: "close", reason: "the notification stream was closed by the client" }), 1000, "an explicit close is a normal closure");
    assert.equal(teardownCode({ kind: "callerSignal", reason: "connection aborted by the caller's signal" }), 1000, "and so is the caller's cancel");
    assert.equal(teardownCode({ error, kind: "fault", line: null, reason: ERRORED }), 1006, "a fault is an abnormal closure");
    assert.equal(teardownCode({ error, kind: "fault", line: { context: {}, level: "warn", message: REPORTED }, reason: ERRORED }), 1006,
      "whether or not it logs");

    // A peer's code passes through as the frame carried it, whatever the code is, so each peer row here uses a code no other arm answers.
    assert.equal(teardownCode({ code: 1001, kind: "peer", reason: "going away" }), 1001);
    assert.equal(teardownCode({ code: 4000, kind: "peer", reason: "" }), 4000);
  });
});

describe("closeFrameText", () => {

  test("names the code alone when the frame said nothing, and the code and what the peer said when it did", () => {

    assert.equal(closeFrameText(1006, ""), "close code 1006", "a frame with nothing to quote leaves no empty separator behind the code");
    assert.equal(closeFrameText(1001, "controller rebooting"), "close code 1001: controller rebooting");
  });
});

describe("socketFault", () => {

  const error = new AccessNetworkError("The UniFi Access realtime notification API connection failed.");

  const rows: readonly { cause: unknown; level: "error" | "warn" | null; name: string; open: boolean }[] = [

    { cause: errnoError("getaddrinfo ENOTFOUND controller", "ENOTFOUND"), level: "error", name: "a host name that does not resolve on an open stream", open: true },
    { cause: errnoError("read ECONNRESET", "ECONNRESET"), level: "warn", name: "a peer's reset on an open stream", open: true },
    { cause: new TypeError("terminated"), level: null, name: "a hang-up's codeless failure on an open stream", open: true },
    { cause: new DOMException("The operation was aborted due to timeout", "TimeoutError"), level: null, name: "a timeout on an open stream", open: true },
    { cause: errnoError("getaddrinfo ENOTFOUND controller", "ENOTFOUND"), level: null, name: "a host name that does not resolve before the open", open: false },
    { cause: errnoError("read ECONNRESET", "ECONNRESET"), level: null, name: "a peer's reset before the open", open: false }
  ];

  for(const { cause, level, name, open } of rows) {

    test(name + " builds a fault arm whose line " + ((level === null) ? "is none" : ("logs at " + level)), () => {

      const arm = socketFault({ cause, error, failure: classifyTransportError(cause), open, reason: ERRORED, reported: REPORTED });

      /* The line is compared whole, so its context is exactly the cause and nothing beside it: a consumer bridging these lines into its own log can lift a string
       * `reason` member into the sentence its user reads, and the fault's account belongs in the error it carries rather than in a phrase lifted beside it.
       */
      assert.deepEqual(arm.line, (level === null) ? null : { context: { error: cause }, level, message: REPORTED },
        "the line logs at the level the connection-fault table answers for an open stream, and is none before the open");
      assert.equal(arm.error, error, "the arm carries the typed error the stream built");
      assert.equal(arm.reason, ERRORED, "and the reason the close is announced with");
      assert.equal(teardownCode(arm), 1006, "and closes as a fault, whether or not it logs");
    });
  }
});

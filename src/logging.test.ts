/* Copyright(C) 2017-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * logging.test.ts: Unit tests for the library's default logger. Silence by default is a contract a consumer embeds against, so the assertion here is the absence of
 * output rather than the absence of a throw - a logger that threw nothing but printed a line would still break every consumer that expects an inert library.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { noopLog } from "./logging.ts";

describe("noopLog", () => {

  test("emits nothing to stdout or stderr at any level", () => {

    // A no-op logger is proven by what never reaches the process streams, so we intercept both writers for the duration of the calls and count the bytes they are
    // handed. Counting bytes rather than merely flagging that a write happened means a single stray newline fails this as loudly as a full message would. The
    // interception window covers only the four synchronous calls below, so the test runner's own reporter output is never caught in it.
    const originalStdoutWrite = process.stdout.write.bind(process.stdout);
    const originalStderrWrite = process.stderr.write.bind(process.stderr);
    let capturedBytes = 0;

    const capture = (chunk: unknown): boolean => {

      capturedBytes += (typeof chunk === "string") ? Buffer.byteLength(chunk) : (chunk as Uint8Array).byteLength;

      return true;
    };

    process.stdout.write = capture;
    process.stderr.write = capture;

    // The restore runs from a finally block so a throw from any level still hands the streams back before the assertion below reports through them.
    try {

      noopLog.debug("A debug message.", { detail: 1 });
      noopLog.error("An error message.", new Error("Something failed."));
      noopLog.info("An informational message.", "context");
      noopLog.warn("A warning message.", 1, 2, 3);
    } finally {

      process.stdout.write = originalStdoutWrite;
      process.stderr.write = originalStderrWrite;
    }

    assert.equal(capturedBytes, 0, "the default logger must emit zero bytes to the process streams at every level");
  });
});

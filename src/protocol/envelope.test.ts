/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * envelope.test.ts: Unit tests for the result-envelope reader. The two refusals driven here are live captures - one from each of the controller's surfaces - carried
 * member for member under the wire's own key names, so what the reader is checked against is what a controller actually sent rather than a shape imagined for it;
 * and every body the guard is asked to reject is one no capture shows, which is what makes rejecting it the answer rather than a guess.
 */
import { AccessApiError, AccessProtocolError } from "../errors.ts";
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readResultEnvelope } from "./envelope.ts";

// The official API's refusal of an avatar upload, captured on 2026-09-15: the native dialect, with the controller's own diagnostic in `error` and a `source` member
// nothing reads.
const OFFICIAL_REFUSAL = { "code": 180005, "codeS": "CODE_USER_IMAGE_INVALID", "error": "CODE[180005];Mesg:Invalid img file format;CauseBy:image: unknown format",
  "msg": "Invalid image.", "source": "" };

// A door hub's refusal of a close command, captured on 2026-09-16 against the Access application's own endpoints: the same dialect, a `cloud_code` member beside it,
// no `data` at all, and a message the controller padded with a trailing space.
const DIRECT_REFUSAL = { "cloud_code": "", "code": -3, "codeS": "CODE_SYSTEM_ERROR", "error": "CODE[-3];Mesg:;CauseBy:", "msg": "Server system error. " };

// The sentence a caller supplies for a refusal that arrives without a message of its own.
const REFUSAL = "The UniFi Access controller refused the operation.";

// The refusal one read raised, typed, so that a test can assert each field by value rather than through a callback.
function refusalOf(body: unknown, refusal: string = REFUSAL): AccessApiError {

  try {

    readResultEnvelope(body, refusal);
  } catch(error) {

    assert.ok(error instanceof AccessApiError, "the reader reports a refusal through the typed API error");

    return error;
  }

  return assert.fail("the reader should have refused " + JSON.stringify(body));
}

describe("the result envelope's guard", () => {

  test("a body that is not a record at all is not an envelope", () => {

    // The sentence is asserted here and nowhere else in this block: every shape below reaches the caller through this same refusal, and the message names what went
    // wrong without naming an operation, because a body that is not an envelope is the wire being violated rather than an operation being refused.
    assert.throws(() => readResultEnvelope("<html>a proxy got in the way</html>", REFUSAL), (error: unknown) => {

      assert.ok(error instanceof AccessProtocolError, "a non-record is refused as a protocol violation");
      assert.equal(error.message, "The UniFi Access controller answered with a document that is not a result envelope.");

      return true;
    });
  });

  test("a record carrying no result code at all is not an envelope", () => {

    assert.throws(() => readResultEnvelope({}, REFUSAL), AccessProtocolError);
  });

  test("a numeric code with no vocabulary string beside it is not an envelope", () => {

    // A number alone carries no vocabulary to classify by and nothing to hand the typed error.
    assert.throws(() => readResultEnvelope({ "code": -3 }, REFUSAL), AccessProtocolError);
  });

  test("a string code beside a vocabulary member that is not a string is not an envelope", () => {

    // Admitting this would send it through the documented arm, which would then read a non-string as the code.
    assert.throws(() => readResultEnvelope({ "code": "CODE_SYSTEM_ERROR", "codeS": 1 }, REFUSAL), AccessProtocolError);
  });

  test("a vocabulary string with no code beside it is not an envelope", () => {

    // The native dialect's identity is both members together, and no capture shows a body carrying one without the other.
    assert.throws(() => readResultEnvelope({ "codeS": "SUCCESS" }, REFUSAL), AccessProtocolError);
  });

  test("a vocabulary string beside a code that is itself a string is not an envelope", () => {

    assert.throws(() => readResultEnvelope({ "code": "1", "codeS": "SUCCESS" }, REFUSAL), AccessProtocolError);
  });

  test("a numeric code beside a vocabulary member that is not a string is not an envelope", () => {

    /* The numeric code says the native dialect answered, and the member that dialect spells its vocabulary in then says nothing a reader could classify by.
     * Admitting it would hand the typed error a non-string where its code belongs, which is the one thing the code's type exists to prevent.
     */
    assert.throws(() => readResultEnvelope({ "code": -3, "codeS": 1 }, REFUSAL), AccessProtocolError);
  });
});

describe("the result envelope's successes", () => {

  test("a native-dialect success is handed back as the object it arrived as", () => {

    const body = { "code": 1, "codeS": "SUCCESS", "data": { "configured": true }, "error": "", "msg": "success" };

    // The reader takes no copy and builds no wrapper: what a consumer reads its payload out of is the decoded body itself.
    assert.ok(Object.is(readResultEnvelope(body, REFUSAL), body), "a native success returns the very object it was handed");
  });

  test("a documented-dialect success is handed back as the object it arrived as", () => {

    const body = { "code": "SUCCESS", "data": [] };

    assert.ok(Object.is(readResultEnvelope(body, REFUSAL), body), "a documented success returns the very object it was handed");
  });

  test("a native success is a success even when its text members say otherwise", () => {

    // The result code is the whole of the verdict. A controller that reported success and left stale text beside it has still reported success.
    const body = { "code": 1, "codeS": "SUCCESS", "error": "x", "msg": "y" };

    assert.ok(Object.is(readResultEnvelope(body, REFUSAL), body), "the text members do not enter the verdict");
  });

  test("a documented success is a success even when its message says otherwise", () => {

    const body = { "code": "SUCCESS", "msg": "y" };

    assert.ok(Object.is(readResultEnvelope(body, REFUSAL), body), "the text members do not enter the verdict");
  });
});

describe("the result envelope's refusals", () => {

  test("reads the official capture, carrying the controller's code, its message and its diagnostic", () => {

    const error = refusalOf(OFFICIAL_REFUSAL);

    assert.equal(error.code, "CODE_USER_IMAGE_INVALID");
    assert.equal(error.message, "Invalid image.");

    // The diagnostic's own internal spacing is the controller's text and survives untouched; only the ends of a member are ever trimmed.
    assert.equal(error.detail, "CODE[180005];Mesg:Invalid img file format;CauseBy:image: unknown format");

    // The diagnostic is a fact the controller reported rather than an exception this library caught, so the chain stays empty.
    assert.equal(error.cause, undefined);
  });

  test("reads the direct capture the same way, taking the vocabulary string rather than the number beside it", () => {

    const error = refusalOf(DIRECT_REFUSAL);

    // The native dialect spells the vocabulary in `codeS`, so a reader that took `code` would hand the caller -3 and nothing to branch on.
    assert.equal(error.code, "CODE_SYSTEM_ERROR");
    assert.equal(error.message, "Server system error.");
    assert.equal(error.detail, "CODE[-3];Mesg:;CauseBy:");
    assert.equal(error.cause, undefined);
  });

  test("carries a vocabulary string the documentation does not list, rather than rejecting it", () => {

    const error = refusalOf({ ...DIRECT_REFUSAL, "codeS": "CODE_SOMETHING_UNDOCUMENTED" });

    assert.equal(error.code, "CODE_SOMETHING_UNDOCUMENTED");
  });

  test("falls back to the caller's sentence when the refusal carries no message member", () => {

    // Each of the four shapes below is a member that says nothing a reader could use, and each falls back to a different sentence so that what is asserted is the
    // caller's own words rather than a sentence this module composed.
    const error = refusalOf({ "cloud_code": "", "code": -3, "codeS": "CODE_SYSTEM_ERROR", "error": "CODE[-3];Mesg:;CauseBy:" },
      "The UniFi Access controller refused the door command.");

    assert.equal(error.message, "The UniFi Access controller refused the door command.");
  });

  test("falls back to the caller's sentence when the message member is not a string", () => {

    const error = refusalOf({ ...DIRECT_REFUSAL, "msg": {} }, "The UniFi Access controller refused the device restart.");

    assert.equal(error.message, "The UniFi Access controller refused the device restart.");
  });

  test("falls back to the caller's sentence when the message member is empty", () => {

    const error = refusalOf({ ...DIRECT_REFUSAL, "msg": "" }, "The UniFi Access controller refused the topology read.");

    assert.equal(error.message, "The UniFi Access controller refused the topology read.");
  });

  test("falls back to the caller's sentence when the message member is nothing but whitespace", () => {

    const error = refusalOf({ ...DIRECT_REFUSAL, "msg": "   " }, "The UniFi Access controller refused the controller information read.");

    assert.equal(error.message, "The UniFi Access controller refused the controller information read.");
  });

  test("reports no diagnostic when the refusal carries no error member", () => {

    // The four shapes here mirror the message's, and each asserts that losing the diagnostic costs the caller nothing else: the code and the message still read.
    const error = refusalOf({ "cloud_code": "", "code": -3, "codeS": "CODE_SYSTEM_ERROR", "msg": "Server system error. " });

    assert.equal(error.detail, undefined);
    assert.equal(error.code, "CODE_SYSTEM_ERROR");
    assert.equal(error.message, "Server system error.");
  });

  test("reports no diagnostic when the error member is not a string", () => {

    const error = refusalOf({ ...DIRECT_REFUSAL, "error": {} });

    assert.equal(error.detail, undefined);
    assert.equal(error.code, "CODE_SYSTEM_ERROR");
    assert.equal(error.message, "Server system error.");
  });

  test("reports no diagnostic when the error member is empty", () => {

    const error = refusalOf({ ...DIRECT_REFUSAL, "error": "" });

    assert.equal(error.detail, undefined);
    assert.equal(error.code, "CODE_SYSTEM_ERROR");
    assert.equal(error.message, "Server system error.");
  });

  test("reports no diagnostic when the error member is nothing but whitespace", () => {

    const error = refusalOf({ ...DIRECT_REFUSAL, "error": "   " });

    assert.equal(error.detail, undefined);
    assert.equal(error.code, "CODE_SYSTEM_ERROR");
    assert.equal(error.message, "Server system error.");
  });

  test("reads a padded message and a padded diagnostic as their trimmed text", () => {

    /* Whitespace at the ends of a member is the wire's padding rather than the controller's words: a consumer appending its own punctuation to a message that ends
     * in a space prints the gap. Everything inside the member - its punctuation, its casing, its own spelling - is the controller's text and is left alone.
     */
    const error = refusalOf({ ...DIRECT_REFUSAL, "error": " CODE[1];Mesg:x;CauseBy:y ", "msg": "  Padded.  " });

    assert.equal(error.message, "Padded.");
    assert.equal(error.detail, "CODE[1];Mesg:x;CauseBy:y");
  });

  test("a documented-dialect refusal reads its code out of the member that dialect spells it in", () => {

    const error = refusalOf({ "code": "CODE_RESOURCE_NOT_FOUND", "msg": "The requested resource was not found." });

    assert.equal(error.code, "CODE_RESOURCE_NOT_FOUND");
    assert.equal(error.message, "The requested resource was not found.");

    // The documented dialect carries no diagnostic member, so there is nothing to report as a detail.
    assert.equal(error.detail, undefined);
    assert.equal(error.cause, undefined);
  });
});

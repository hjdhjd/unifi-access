/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * vocabulary.test.ts: Unit tests for the cross-channel translations. Each of these exists because the controller describes one reality in more than one way, so
 * these tests assert the folds that hide that from consumers, and assert the one reason code whose meaning this library states differently from the reference. The
 * unlock authentication glosses are held to their exact wording and to the fragment voice a consumer's own sentence needs.
 */
import { ACCESS_AUTHENTICATION_TYPES, ACCESS_DOORBELL_REASON_CODES, isMacAddress, normalizeActorType, normalizeMacAddress } from "./vocabulary.ts";
import { describe, test } from "node:test";
import assert from "node:assert/strict";

/* The address pair's contract as a table of exact pairs rather than as a description of a pattern: every shape a hardware address is written in, and what the
 * library spells each one as. The colon-bearing rows are the case flip the controller performs on one device's address between reads; the colon-free rows are the
 * shape the official API's device identifier and the camera-class records carry, and the uppercase one is already the library's own spelling; the mixed-case row
 * is the fold being indifferent to where the case varies; and the hyphen and dot rows are the spellings other tools write, which fold onto the same value the
 * wire's own spellings do.
 */
const ADDRESS_ROWS: [string, string][] = [
  [ "02:FF:EE:00:00:01", "02FFEE000001" ],
  [ "02:ff:ee:00:00:01", "02FFEE000001" ],
  [ "02FFEE000002", "02FFEE000002" ],
  [ "02ffee000002", "02FFEE000002" ],
  [ "02:Ff:Ee:00:00:02", "02FFEE000002" ],
  [ "AA-BB-CC-DD-EE-FF", "AABBCCDDEEFF" ],
  [ "aa-bb-cc-dd-ee-ff", "AABBCCDDEEFF" ],
  [ "AABB.CCDD.EEFF", "AABBCCDDEEFF" ],
  [ "aabb.ccdd.eeff", "AABBCCDDEEFF" ]
];

// Values that are not an address in any accepted shape: the controller's camera-class identifier, a location identifier, nothing at all, misplaced separators, a
// digit short and a digit over in each shape, a character outside the hexadecimal alphabet, a pair short of six, separators mixed within one value, and a word
// with a hyphen in it.
const NOT_ADDRESSES = [ "ffffffffffffffff00000000", "0ace0000-0000-4000-8000-000000000007", "", "02:ff:ee00:00:aa", "02:ff:ee:00:00:a", "02:ff:ee:00:00:aaa",
  "02FFEE0000A", "02FFEE0000AAA", "zz:ff:ee:00:00:aa", "aa:bb:cc:dd:ee", "aa-bb:cc-dd:ee-ff", "aabb.ccdd.eef", "not-an-address" ];

describe("normalizeActorType", () => {

  test("folds both spellings of the API-caller actor onto one value", () => {

    // The notification socket spells it with an underscore and the webhook with a hyphen, for the same actor performing the same action. A consumer must never
    // have to know which channel delivered a record in order to read who acted.
    assert.equal(normalizeActorType("open_api"), "open_api");
    assert.equal(normalizeActorType("open-api"), "open_api");
    assert.equal(normalizeActorType("open-api"), normalizeActorType("open_api"));
  });

  test("leaves a human actor untouched", () => {

    assert.equal(normalizeActorType("user"), "user");
  });

  test("passes an actor type it does not know through unchanged", () => {

    // The fold exists to close one known split, not to police a vocabulary this library does not own. An unfamiliar actor type reaches the consumer as the
    // controller spelled it rather than being dropped or coerced onto one of the named values.
    for(const actorType of [ "visitor", "device", "", "OPEN-API" ]) {

      assert.equal(normalizeActorType(actorType), actorType);
    }
  });

  test("is stable under repetition, so a record folded twice reads the same as one folded once", () => {

    assert.equal(normalizeActorType(normalizeActorType("open-api")), "open_api");
  });
});

describe("normalizeMacAddress", () => {

  test("spells every accepted shape one way", () => {

    for(const [ wire, spelled ] of ADDRESS_ROWS) {

      assert.equal(normalizeMacAddress(wire), spelled, wire);
    }
  });

  test("is stable under repetition, so an address folded twice reads the same as one folded once", () => {

    for(const [wire] of ADDRESS_ROWS) {

      assert.equal(normalizeMacAddress(normalizeMacAddress(wire)), normalizeMacAddress(wire), wire);
    }
  });

  test("passes a value that is not an address through unchanged", () => {

    // The fold exists to close one known split, not to police values this library does not own. An identifier that is not an address reaches the consumer as the
    // controller spelled it, and so does anything malformed, rather than being mangled into something address-shaped.
    for(const value of NOT_ADDRESSES) {

      assert.equal(normalizeMacAddress(value), value);
    }
  });
});

describe("isMacAddress", () => {

  test("recognizes every accepted spelling, in either case", () => {

    for(const [wire] of ADDRESS_ROWS) {

      assert.equal(isMacAddress(wire), true, wire);
    }
  });

  test("rejects everything else", () => {

    for(const value of NOT_ADDRESSES) {

      assert.equal(isMacAddress(value), false, value);
    }
  });
});

describe("ACCESS_DOORBELL_REASON_CODES", () => {

  test("carries the documented meaning of each code the reference gets right", () => {

    assert.equal(ACCESS_DOORBELL_REASON_CODES[105], "The call timed out.");
    assert.equal(ACCESS_DOORBELL_REASON_CODES[106], "An administrator declined the unlock.");
    assert.equal(ACCESS_DOORBELL_REASON_CODES[107], "An administrator unlocked the door.");
    assert.equal(ACCESS_DOORBELL_REASON_CODES[108], "The visitor canceled the call.");
  });

  test("states the corrected meaning of the code whose documented gloss the wire contradicts", () => {

    /* The reference reads this code as the call having been answered by another administrator. A live call answered by the very person subscribed to the
     * notification carried it anyway, so read the documented way it would state a falsehood about who acted. What it actually reports is that the call was
     * answered somewhere other than here - which may well be somewhere else the same person is signed in.
     */
    assert.equal(ACCESS_DOORBELL_REASON_CODES[400], "The call was answered somewhere other than here.");
    assert.equal(ACCESS_DOORBELL_REASON_CODES[400]?.includes("another admin"), false, "the reference's wording must not reach a consumer");
  });

  test("names every code the reference documents, and no others", () => {

    assert.deepEqual(Object.keys(ACCESS_DOORBELL_REASON_CODES).sort(), [ "105", "106", "107", "108", "400" ]);
  });

  test("reads a code outside the documented set as having no meaning to state", () => {

    // The controller sends zero on a call that is merely beginning, and absence is the honest answer for it: inventing a meaning would put words in the
    // controller's mouth. A number-keyed table is what lets a reason code read off a payload be looked up at all.
    assert.equal(ACCESS_DOORBELL_REASON_CODES[0], undefined);
    assert.equal(ACCESS_DOORBELL_REASON_CODES[999], undefined);
  });

  test("states each meaning as a complete sentence fit to show a person", () => {

    for(const [ code, meaning ] of Object.entries(ACCESS_DOORBELL_REASON_CODES)) {

      assert.ok(meaning.endsWith("."), "the meaning of " + code + " should read as a sentence");
      assert.ok((/^[A-Z]/).test(meaning), "the meaning of " + code + " should begin as a sentence");
    }
  });
});

describe("ACCESS_AUTHENTICATION_TYPES", () => {

  test("reads each authentication type the wire reports in words fit to show a person", () => {

    assert.equal(ACCESS_AUTHENTICATION_TYPES["CALL"], "answered doorbell call");
    assert.equal(ACCESS_AUTHENTICATION_TYPES["NFC"], "NFC credential");
    assert.equal(ACCESS_AUTHENTICATION_TYPES["REMOTE_THROUGH_UAH"], "remote command through the hub");
    assert.equal(ACCESS_AUTHENTICATION_TYPES["WAVE"], "hand wave at the reader");
  });

  test("names every spelling the captures have shown, and no others", () => {

    assert.deepEqual(Object.keys(ACCESS_AUTHENTICATION_TYPES).sort(), [ "CALL", "NFC", "REMOTE_THROUGH_UAH", "WAVE" ]);
  });

  test("reads a token outside the observed set as having no meaning to state", () => {

    // The reference enumerates none of this vocabulary, so the set is bounded by what captures have shown and a spelling none of them carries is deliberately
    // absent. A consumer meeting one shows the token the wire sent rather than a meaning this library invented for it.
    assert.equal(ACCESS_AUTHENTICATION_TYPES["FINGERPRINT"], undefined);
    assert.equal(ACCESS_AUTHENTICATION_TYPES[""], undefined);
  });

  test("keys the uppercase spelling every directly-read channel delivers", () => {

    // The webhook, the socket's access.logs.add frames, and the official system-logs endpoint all deliver these tokens uppercase. Only the socket's
    // access.logs.insights.add frames spell the same vocabulary lowercase, and a reader of that one channel folds case before looking a token up.
    for(const token of Object.keys(ACCESS_AUTHENTICATION_TYPES)) {

      assert.equal(token, token.toUpperCase(), token);
    }
  });

  test("states each meaning as a fragment fit to sit inside a consumer's own sentence", () => {

    /* These render inside a parenthetical a consumer composes rather than alone, which is the inverse of the reason-code table above: no terminal period, and
     * no sentence casing. The sentence-case test reads the second letter as well as the first, so an acronym-led meaning such as "NFC credential" passes as the
     * fragment it is.
     */
    for(const [ token, meaning ] of Object.entries(ACCESS_AUTHENTICATION_TYPES)) {

      assert.ok(meaning.length > 0, "the meaning of " + token + " should say something");
      assert.equal((/^[A-Z][a-z]/).test(meaning), false, "the meaning of " + token + " should not begin as a sentence");
      assert.equal(meaning.endsWith("."), false, "the meaning of " + token + " should not end as a sentence");
    }
  });
});

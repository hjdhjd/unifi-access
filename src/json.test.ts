/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * json.test.ts: Unit tests for the decode-boundary record predicate. Every caller reads a member off whatever this admits, so the two shapes that would pass a
 * bare `typeof value === "object"` check - `null` and an array - are what these rows are really about.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { isRecord } from "./json.ts";

describe("isRecord", () => {

  test("admits a plain object", () => {

    assert.equal(isRecord({}), true, "an empty object is still a record");
    assert.equal(isRecord({ "event": "access.door.unlock" }), true);
    assert.equal(isRecord(Object.create(null) as object), true, "a null-prototype object is what JSON.parse can hand back with a reviver");
  });

  test("rejects null, which is an object by the language's own reckoning", () => {

    assert.equal(isRecord(null), false);
  });

  test("rejects an array, whose members are read by index rather than by name", () => {

    assert.equal(isRecord([]), false);
    assert.equal(isRecord([{ "id": "02ffee000000" }]), false);
  });

  test("rejects every primitive a decoded document can hold", () => {

    for(const value of [ undefined, true, false, 0, 1786827828, "", "a string", Symbol("s"), 0n ]) {

      assert.equal(isRecord(value), false, (typeof value) + " is not a record");
    }
  });

  test("narrows the value so a member can be read without a cast", () => {

    const decoded: unknown = { "code": "SUCCESS" };

    assert.ok(isRecord(decoded));

    // Reading through the narrowed type is the whole point of the predicate: this line does not compile against `unknown`.
    assert.equal(decoded["code"], "SUCCESS");
  });
});

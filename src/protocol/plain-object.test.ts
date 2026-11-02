/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * plain-object.test.ts: Unit tests for the plain-object predicate - the two shapes a record can take, and each object-typed value that carries fields of its own or
 * none and still answers false, a `Buffer` above all.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { isPlainObject } from "./plain-object.ts";

describe("isPlainObject", () => {

  test("an object literal is a plain object", () => {

    assert.equal(isPlainObject({ id: "camera-1" }), true);
  });

  test("an object with a null prototype is a plain object", () => {

    assert.equal(isPlainObject(Object.create(null)), true);
  });

  test("an array is not a plain object", () => {

    assert.equal(isPlainObject([ "camera-1", "camera-2" ]), false);
  });

  test("a Buffer is not a plain object, though typeof reads it as an object with index keys", () => {

    assert.equal(isPlainObject(Buffer.from("{\"id\":\"camera-1\"}")), false);
  });

  test("a Uint8Array is not a plain object", () => {

    assert.equal(isPlainObject(new Uint8Array([ 1, 2, 3 ])), false);
  });

  test("null is not a plain object", () => {

    assert.equal(isPlainObject(null), false);
  });

  test("a class instance is not a plain object", () => {

    class CameraRecord {

      readonly id = "camera-1";
    }

    assert.equal(isPlainObject(new CameraRecord()), false);
  });

  test("a function is not a plain object", () => {

    assert.equal(isPlainObject(() => "camera-1"), false);
  });

  test("an empty object is a plain object", () => {

    assert.equal(isPlainObject({}), true);
  });

  test("an empty array and an array of records are not plain objects", () => {

    assert.equal(isPlainObject([]), false);
    assert.equal(isPlainObject([{ id: "02ffee000000" }]), false);
  });

  test("every primitive a decoded document can hold is not a plain object", () => {

    for(const value of [ undefined, true, false, 0, 1786827828, "", "a string", Symbol("s"), 0n ]) {

      assert.equal(isPlainObject(value), false, (typeof value) + " is not a plain object");
    }
  });

  test("a plain object narrows so a member reads without a cast", () => {

    const decoded: unknown = { code: "SUCCESS" };

    assert.ok(isPlainObject(decoded), "a plain object is a record");

    // Reading through the narrowed type is the whole point of the predicate: this line does not compile against `unknown`.
    assert.equal(decoded["code"], "SUCCESS");
  });
});

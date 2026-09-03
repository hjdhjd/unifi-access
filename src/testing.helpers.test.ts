/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * testing.helpers.test.ts: Unit tests for the shared test helpers whose own correctness the other suites depend on. A helper that silently does nothing passes
 * every test that merely calls it, so the cases here drive each helper in both directions - the condition it is meant to catch, and the clean case it must let
 * through.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { assertNoUnhandledRejections } from "./testing.helpers.ts";
import { setTimeout as delay } from "node:timers/promises";

describe("assertNoUnhandledRejections", () => {

  test("passes a wrapped function that leaks nothing", async () => {

    await assert.doesNotReject(assertNoUnhandledRejections(async () => {

      await delay(0);
    }));
  });

  test("reports a rejection the runtime hands its listener", async () => {

    /* The direction that gives the helper its value: a helper whose body did nothing at all would pass the clean case above identically to a real one, so the
     * detection path needs its own case.
     *
     * The rejection is delivered to the helper's listener directly rather than by leaking a real floating promise, because the test runner listens for unhandled
     * rejections too and attributes any it sees to the running test - so a genuine leak here fails this test before the helper can report it, and emitting one on
     * the process does the same. Handing the listener the arguments the runtime would hand it exercises everything the helper actually owns: that it registered a
     * listener at all, that the listener records what it receives, and that the recorded rejection fails the check.
     */
    await assert.rejects(assertNoUnhandledRejections(async () => {

      const listeners = process.listeners("unhandledRejection");
      const attached = listeners.at(-1);

      assert.ok(attached, "the helper must have registered a listener before running the wrapped function");
      attached(new Error("a promise nobody awaited"), Promise.resolve());

      await delay(0);
    }), /expected no unhandled rejections/);
  });

  test("listens only for the duration of the check", async () => {

    const before = process.listenerCount("unhandledRejection");

    await assertNoUnhandledRejections(async () => {

      assert.equal(process.listenerCount("unhandledRejection"), before + 1, "the helper listens while the wrapped function runs");

      await delay(0);
    });

    assert.equal(process.listenerCount("unhandledRejection"), before, "the listener is removed once the check completes");
  });

  test("removes its listener even when the check fails", async () => {

    const before = process.listenerCount("unhandledRejection");

    await assert.rejects(assertNoUnhandledRejections(async () => {

      process.listeners("unhandledRejection").at(-1)?.(new Error("leaked"), Promise.resolve());

      await delay(0);
    }));

    // The removal runs in a finally, so a failing check must not leave a listener behind to accumulate across the suite.
    assert.equal(process.listenerCount("unhandledRejection"), before);
  });
});

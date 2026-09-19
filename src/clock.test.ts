/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * clock.test.ts: Unit tests for the production wall clock. The interface itself is the contract that lets every other module take time as an injected dependency;
 * here we verify the production implementation reads real time, that its delay resolves once its duration elapses and rejects cleanly when its signal aborts, and
 * that its deadline signal aborts with the platform's own timeout reason.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { wallClock } from "./clock.ts";

describe("wallClock", () => {

  test("now() returns the current wall-clock time", () => {

    const before = Date.now();
    const observed = wallClock.now();

    assert.ok((observed >= before) && (observed <= Date.now()), "now() should fall within the surrounding Date.now() readings");
  });

  test("delay resolves once its duration elapses", async () => {

    const controller = new AbortController();
    const before = Date.now();

    await wallClock.delay(5, { signal: controller.signal });

    assert.ok((Date.now() - before) >= 4, "delay should resolve no sooner than its duration (allowing for timer granularity)");
  });

  test("delay rejects with an AbortError when its signal aborts before its duration elapses", async () => {

    const controller = new AbortController();
    const pending = wallClock.delay(10000, { signal: controller.signal });

    controller.abort();

    await assert.rejects(pending, (error: unknown) => (error as Error).name === "AbortError", "aborting the signal rejects the delay with an AbortError");
  });

  test("timeout aborts with a TimeoutError once its duration elapses", async () => {

    const before = Date.now();
    const signal = wallClock.timeout(5);
    const aborted = Promise.withResolvers<undefined>();

    signal.addEventListener("abort", () => aborted.resolve(undefined), { once: true });

    await aborted.promise;

    // The one thing this library adds is the bridge to the platform's primitive, so the assertions are the bridge's: the reason the deadline carries, and that it
    // was a real wait rather than an immediate abort. The platform's own contract is not re-verified here.
    assert.equal((signal.reason as Error).name, "TimeoutError", "the deadline aborts with the platform's timeout reason");
    assert.ok((Date.now() - before) >= 4, "timeout should fire no sooner than its duration (allowing for timer granularity)");
  });
});

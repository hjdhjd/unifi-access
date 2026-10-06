/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * clock.test.ts: Unit tests for the production wall clock and the deadline armed on it. The interface itself is the contract that lets every other module take time
 * as an injected dependency; here we verify the production implementation reads real time, that its delay resolves once its duration elapses and rejects cleanly
 * when its signal aborts, that its callback timer runs once after its duration and never once disposed, and that a deadline armed on it aborts with the platform's
 * own timeout reason.
 */
import { armDeadline, wallClock } from "./clock.ts";
import { describe, test } from "node:test";
import assert from "node:assert/strict";

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

    await assert.rejects(pending, { code: "ABORT_ERR", name: "AbortError" });
  });

  test("schedule runs its callback once, after its duration elapses", async () => {

    const controller = new AbortController();
    const before = Date.now();
    const fired = Promise.withResolvers<number>();

    let calls = 0;

    using timer = wallClock.schedule((): void => {

      calls++;
      fired.resolve(Date.now());
    }, 5);

    const firedAt = await fired.promise;

    await wallClock.delay(20, { signal: controller.signal });

    assert.ok((firedAt - before) >= 4, "schedule should run its callback no sooner than its duration (allowing for timer granularity)");
    assert.equal(calls, 1, "a scheduled callback runs once, and not again across a further span of several times its duration");
  });

  test("disposing a scheduled timer before it fires cancels it", async () => {

    const controller = new AbortController();

    let calls = 0;

    const timer = wallClock.schedule((): void => {

      calls++;
    }, 5);

    timer[Symbol.dispose]();

    await wallClock.delay(20, { signal: controller.signal });

    assert.equal(calls, 0, "a timer disposed before its duration elapses never runs its callback");
  });

  test("armDeadline with no clock named arms on the wall clock and aborts with a TimeoutError once its duration elapses", async () => {

    const before = Date.now();
    const aborted = Promise.withResolvers<undefined>();

    using deadline = armDeadline(5);

    deadline.signal.addEventListener("abort", () => aborted.resolve(undefined), { once: true });

    await aborted.promise;

    // The one thing this library adds is the bridge to the platform's primitive, so the assertions are the bridge's: the reason the deadline carries, and that it
    // was a real wait rather than an immediate abort. The platform's own contract is not re-verified here.
    assert.equal((deadline.signal.reason as Error).name, "TimeoutError", "the deadline aborts with the platform's timeout reason");
    assert.ok((Date.now() - before) >= 4, "the deadline should fire no sooner than its duration (allowing for timer granularity)");
  });
});

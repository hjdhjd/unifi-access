/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * clock.test.ts: Unit tests for the production wall clock and the deadline armed on it. The interface itself is the contract that lets every other module take time
 * as an injected dependency; here we verify the production implementation reads real time, that its monotonic reading is the platform's own in whole microseconds,
 * never decreasing and rising across a real wait while the wall clock is stepped back, that its delay resolves once its duration elapses and rejects cleanly when
 * its signal aborts, that its callback timer runs once after its duration, never once disposed, and holds the process open only when asked to, that a delay or a
 * timer past the platform timer's ceiling is carried in full rather than fired at once, each of a delay's hops under the caller's signal and each of a timer's under
 * its process-hold policy, that an infinite span arms nothing and never elapses - its delay settling only when its signal aborts - while `NaN` and negative infinity
 * keep the platform's handling, and that a deadline armed on it aborts with the platform's own timeout reason and never holds the process open while pending.
 */
import { TIMER_DELAY_MAX_MS, armDeadline, wallClock } from "./clock.ts";
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { getEventListeners } from "node:events";
import { settle } from "homebridge-plugin-utils/testing";
import timersPromises from "node:timers/promises";

// How many successive monotonic reads a row compares, enough that a reading which ran backward even rarely would show.
const MONOTONIC_READS = 10000;

// The wall-clock time a row seeds mocked `Date` with before stepping it back to half of it.
const MOCKED_WALL_CLOCK_MS = 1000000;

// How long a row waits in real time to tell a span that never comes due from one the platform fires after a millisecond. The platform fires timers in expiry
// order, so a wait well past that millisecond tells the two apart without leaning on the host's speed.
const REAL_WAIT_MS = 100;

// The platform's active timers, read as a count. The runner holds timers of its own, so every reading is a delta against a synchronous sample, and nothing awaits
// between an arm and the read that follows it, so no other timer can enter or leave the list in between.
function activeTimers(): number {

  return process.getActiveResourcesInfo().filter((resource) => resource === "Timeout").length;
}

// Race `pending` against a real wait on the global callback timer, answering "settled" when `pending` resolves or rejects first and "silent" when the wait ends
// first. The wait never touches the promise primitive, so a row spying on that primitive counts only its subject's calls, and it is cleared once the race is decided.
async function raceRealWait(pending: Promise<unknown>): Promise<"settled" | "silent"> {

  const { promise: silent, resolve }: PromiseWithResolvers<"silent"> = Promise.withResolvers();

  using wait = setTimeout((): void => resolve("silent"), REAL_WAIT_MS);

  return await Promise.race([ pending.then((): "settled" => "settled", (): "settled" => "settled"), silent ]);
}

// Assert that `thrown` is the shape `node:timers/promises` setTimeout rejects with on abort: a name of "AbortError" and a code of the string "ABORT_ERR". The name and
// code are asserted rather than a class, because the primitive's rejection is an internal class with no constructable global, and the code is what tells it apart
// from a `DOMException` named "AbortError", whose code is the number 20, so a wait that rejected with its signal's reason fails here.
function assertAbortError(thrown: unknown, message: string): void {

  assert.ok(thrown instanceof Error, message + " - the rejection must be an Error");
  assert.equal(thrown.name, "AbortError", message + " - name must be AbortError");
  assert.equal((thrown as Error & { code?: unknown }).code, "ABORT_ERR", message + " - code must be the string ABORT_ERR");
}

describe("wallClock", () => {

  test("now() returns the current wall-clock time", () => {

    const before = Date.now();
    const observed = wallClock.now();

    assert.ok((observed >= before) && (observed <= Date.now()), "now() should fall within the surrounding Date.now() readings");
  });

  test("monotonic() reads the platform's monotonic clock, between bracketing reads taken in its own truncated microseconds", () => {

    // The bracket reads the clock the way the member is documented to, truncated to whole microseconds and then put in milliseconds, so a read landing on the same
    // microsecond as a bound compares equal to it rather than falling outside a finer one.
    const bracket = (): number => Number(process.hrtime.bigint() / 1000n) / 1000;
    const before = bracket();
    const observed = wallClock.monotonic();
    const after = bracket();

    assert.ok((observed >= before) && (observed <= after), "wallClock.monotonic() must fall within the surrounding reads: " + [ before, observed, after ].join(" "));
    assert.equal(Math.round(observed * 1000) / 1000, observed, "the reading must be a whole count of microseconds, in milliseconds");
  });

  test("monotonic() never decreases across successive reads", () => {

    let decreases = 0;
    let previous = wallClock.monotonic();

    for(let read = 0; read < MONOTONIC_READS; read++) {

      const current = wallClock.monotonic();

      if(current < previous) {

        decreases++;
      }

      previous = current;
    }

    assert.equal(decreases, 0, "no reading may fall below the one before it");
  });

  test("monotonic() rises across a real wait while mock timers step the wall clock back", async (t) => {

    // Only `Date` is mocked, so the wait below runs on the real timers while the wall clock is set back underneath it.
    t.mock.timers.enable({ apis: ["Date"], now: MOCKED_WALL_CLOCK_MS });

    const before = wallClock.monotonic();

    t.mock.timers.setTime(MOCKED_WALL_CLOCK_MS / 2);

    await timersPromises.setTimeout(5);

    assert.ok(Date.now() < MOCKED_WALL_CLOCK_MS, "the wall clock must have been stepped back");
    assert.ok(wallClock.monotonic() > before, "the monotonic reading must rise across the real wait whatever the wall clock did");
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

    await assert.rejects(pending, (error: unknown) => {

      assertAbortError(error, "a delay aborted before its duration elapses");

      return true;
    });
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

  test("a timer armed with unref is absent from the process's active timers, while one armed without it counts", () => {

    const sample = activeTimers();
    const referenced = wallClock.schedule((): void => undefined, 60000);

    assert.equal(activeTimers(), sample + 1, "a referenced timer holds the process open");

    referenced[Symbol.dispose]();

    assert.equal(activeTimers(), sample, "and disposing it releases the process again");

    using unreferenced = wallClock.schedule((): void => undefined, 60000, { unref: true });

    assert.equal(activeTimers(), sample, "an unreferenced timer stands pending without counting against the process");
  });

  test("the timer ceiling is the platform's 32-bit signed millisecond maximum", () => {

    // The rows past the ceiling state their windows through the constant, so they move with it rather than checking it. This row is the one place the number is
    // stated independently of the constant.
    assert.equal(TIMER_DELAY_MAX_MS, (2 ** 31) - 1, "the ceiling is the platform's own number, fixed outside this code");
  });

  test("a timer past the ceiling is carried as a chain of arms and fires at the requested moment", (t) => {

    t.mock.timers.enable({ apis: ["setTimeout"] });

    // One past the ceiling is the smallest window the platform would set to one millisecond.
    const fired: number[] = [];

    using timer = wallClock.schedule((): number => fired.push(1), TIMER_DELAY_MAX_MS + 1);

    t.mock.timers.tick(TIMER_DELAY_MAX_MS);

    assert.deepEqual(fired, [], "a ceiling's worth of time fires nothing, because the first hop re-arms for the remainder instead of running the callback");

    t.mock.timers.tick(1);

    assert.deepEqual(fired, [1], "the remainder elapsing runs the callback, at exactly the moment asked for");

    t.mock.timers.tick(TIMER_DELAY_MAX_MS + 1);

    assert.deepEqual(fired, [1], "and a chained timer fires once");
  });

  test("disposing a chained timer mid-chain cancels the hop that is live, so nothing fires later", (t) => {

    t.mock.timers.enable({ apis: ["setTimeout"] });

    // Two ceilings and a little more, so the chain has three hops; the disposal lands while the second is armed. A disposer that still held the first hop's handle
    // would clear a timer that has already fired and leave the live one to run the chain to its end.
    const fired: number[] = [];
    const timer = wallClock.schedule((): number => fired.push(1), (2 * TIMER_DELAY_MAX_MS) + 5);

    t.mock.timers.tick(TIMER_DELAY_MAX_MS + 2);
    timer[Symbol.dispose]();

    // The mock times a hop armed inside a callback from the end of the tick that ran the callback, so the chain's last hop needs a tick of its own to be reachable at
    // all; a disposer that still held the first hop's handle would let the chain run on and fire here.
    t.mock.timers.tick((2 * TIMER_DELAY_MAX_MS) + 5);
    t.mock.timers.tick(10);

    assert.deepEqual(fired, [], "the chain is cancelled at whichever hop is live, and no later hop fires");
  });

  test("a delay past the ceiling awaits the promise primitive once per hop and resolves at the requested moment", async (t) => {

    // The promise primitive is read off the module object at call time, which is what lets the mock reach it here; a wait bound by a named import would run on the
    // real timers regardless of the mock.
    t.mock.timers.enable({ apis: ["setTimeout"] });

    const controller = new AbortController();
    let resolved = false;

    const waited = wallClock.delay(TIMER_DELAY_MAX_MS + 1, { signal: controller.signal }).then((): void => {

      resolved = true;
    });

    t.mock.timers.tick(TIMER_DELAY_MAX_MS);
    await settle();

    assert.equal(resolved, false, "a ceiling's worth of time resolves nothing: the first hop's continuation awaits the remainder");

    t.mock.timers.tick(1);
    await waited;

    assert.equal(resolved, true, "the remainder elapsing resolves the delay, at exactly the moment asked for");
  });

  test("an abort while a chained delay's first hop is live, or its second, rejects the delay with the primitive's AbortError", async (t) => {

    t.mock.timers.enable({ apis: ["setTimeout"] });

    // Two ceilings and one more, so each delay has three hops. The early abort lands while the first hop waits, and the late one once a ceiling's worth of time has
    // passed and the first hop's continuation has armed the second, so between them the caller's signal is shown on a hop after the first as well as on the first.
    const early = new AbortController();
    const late = new AbortController();
    const abortedEarly = wallClock.delay((2 * TIMER_DELAY_MAX_MS) + 1, { signal: early.signal });
    const abortedLate = wallClock.delay((2 * TIMER_DELAY_MAX_MS) + 1, { signal: late.signal });

    early.abort();

    await assert.rejects(abortedEarly, (error: unknown) => {

      assertAbortError(error, "a chained delay aborted while its first hop is live");

      return true;
    });

    t.mock.timers.tick(TIMER_DELAY_MAX_MS);
    await settle();
    late.abort();

    await assert.rejects(abortedLate, (error: unknown) => {

      assertAbortError(error, "a chained delay aborted while its second hop is live");

      return true;
    });
  });

  test("a chained timer armed with unref is absent from the process's active timers, while a referenced twin counts", () => {

    // Only the first hop can be read here, because a later one arms a ceiling's worth of real time from now. The referenced chain is held in a `using` declaration
    // as well as disposed by hand, so an assertion that fails cannot strand a hop of nearly 25 days in the runner's loop.
    const sample = activeTimers();

    using referenced = wallClock.schedule((): void => undefined, TIMER_DELAY_MAX_MS + 1);

    assert.equal(activeTimers(), sample + 1, "a referenced chain's live hop holds the process open");

    referenced[Symbol.dispose]();

    assert.equal(activeTimers(), sample, "and disposing it releases the process again");

    using unreferenced = wallClock.schedule((): void => undefined, TIMER_DELAY_MAX_MS + 1, { unref: true });

    assert.equal(activeTimers(), sample, "an unreferenced chain's live hop stands pending without counting against the process");
  });

  test("every hop of a chained timer armed with unref unreferences its handle, while a referenced twin's hops never do", (t) => {

    t.mock.timers.enable({ apis: ["setTimeout"] });

    // A mock handle holds no process open, so each hop's policy is read off the handle's own `unref` instead: a spy on the prototype every mock handle shares counts
    // the calls, and calls through. The probe handle exists only to reach that prototype.
    const probe = setTimeout((): void => undefined, 1);

    clearTimeout(probe);

    const unref = t.mock.method(Object.getPrototypeOf(probe) as NodeJS.Timeout, "unref");

    // Two ceilings and one more, so each chain has three hops, and each tick of a ceiling fires one hop of each and arms the next.
    using referenced = wallClock.schedule((): void => undefined, (2 * TIMER_DELAY_MAX_MS) + 1);
    using unreferenced = wallClock.schedule((): void => undefined, (2 * TIMER_DELAY_MAX_MS) + 1, { unref: true });

    assert.equal(unref.mock.callCount(), 1, "the unreferenced chain's first hop is unreferenced, and the referenced twin's is not");

    t.mock.timers.tick(TIMER_DELAY_MAX_MS);

    assert.equal(unref.mock.callCount(), 2, "the unreferenced chain's second hop carries the policy too");

    t.mock.timers.tick(TIMER_DELAY_MAX_MS);

    assert.equal(unref.mock.callCount(), 3, "and so does its last, one call per hop of the unreferenced chain and none for the referenced one");
  });

  test("no shape the clock carries draws the platform's overflow warning: past the ceiling, at exactly the ceiling, or at an infinite span", async () => {

    // The platform announces a delay it has set to one millisecond through a process warning, emitted on a later turn, so the read below yields a macrotask first.
    // Each delay's outcome is captured as it is armed, so the abort that ends them leaves no rejection unhandled, whichever assertion fails.
    const warnings: string[] = [];
    const observe = (warning: Error): number => warnings.push(warning.name);
    const controller = new AbortController();

    process.on("warning", observe);

    try {

      using chained = wallClock.schedule((): void => undefined, TIMER_DELAY_MAX_MS + 1, { unref: true });
      using atCeiling = wallClock.schedule((): void => undefined, TIMER_DELAY_MAX_MS, { unref: true });
      using infinite = wallClock.schedule((): void => undefined, Infinity, { unref: true });

      const outcomes = [ TIMER_DELAY_MAX_MS + 1, TIMER_DELAY_MAX_MS, Infinity ].map(async (ms): Promise<unknown> => {

        return await wallClock.delay(ms, { signal: controller.signal }).then((): string => "resolved", (error: unknown): unknown => error);
      });

      await settle();

      assert.deepEqual(warnings, [], "no timer or delay the clock carries draws the warning, because each armed at most the ceiling or nothing at all");

      controller.abort();

      for(const outcome of await Promise.all(outcomes)) {

        assertAbortError(outcome, "each delay rejects on its abort, the chained one while its first hop is live");
      }
    } finally {

      controller.abort();
      process.off("warning", observe);
    }
  });

  test("an infinite timer arms no global timer and never fires, and its disposer clears nothing", async (t) => {

    // The spies call through, so any timer the arm reached would still run. The real wait is the promise primitive, which never reads the global timers, so every
    // count below is the arm's own.
    const globalSetTimeout = t.mock.method(globalThis, "setTimeout");
    const globalClearTimeout = t.mock.method(globalThis, "clearTimeout");
    const fired: number[] = [];
    const timer = wallClock.schedule((): number => fired.push(1), Infinity);

    await timersPromises.setTimeout(REAL_WAIT_MS);

    assert.equal(globalSetTimeout.mock.callCount(), 0, "an infinite timer arms no global setTimeout, at the call or across the wait after it");
    assert.deepEqual(fired, [], "and never fires within a real wait, where the platform's own arm would have fired it after a millisecond");

    timer[Symbol.dispose]();
    timer[Symbol.dispose]();

    assert.equal(globalClearTimeout.mock.callCount(), 0, "disposing it twice clears nothing, because nothing was armed");
  });

  test("an infinite delay reaches the promise primitive only on abort, holds one listener until then, and rejects with its AbortError", async (t) => {

    // The spy sits on the module object the delay reads the promise primitive from at call time, and calls through. The race partner is a global timer, which never
    // reaches the primitive, so every count below is the delay's own.
    const primitive = t.mock.method(timersPromises, "setTimeout");
    const controller = new AbortController();
    const waited = wallClock.delay(Infinity, { signal: controller.signal });

    assert.equal(await raceRealWait(waited), "silent", "an infinite delay stays pending across a real wait");
    assert.equal(primitive.mock.callCount(), 0, "arming no timer while it waits");
    assert.equal(getEventListeners(controller.signal, "abort").length, 1, "and holding one abort listener on its signal");

    controller.abort();

    await assert.rejects(waited, (error: unknown) => {

      assertAbortError(error, "an infinite delay aborted mid-wait");

      return true;
    });

    assert.equal(primitive.mock.callCount(), 1, "the abort hands the signal to the promise primitive once");
    assert.equal(primitive.mock.calls[0]?.arguments[2]?.signal, controller.signal, "the signal it hands over is the aborted one, so the primitive rejects at once");
    assert.equal(getEventListeners(controller.signal, "abort").length, 0, "and the listener leaves with the abort that fired it");

    // A signal already aborted when the delay is asked for rejects the same way, with no listener at all.
    const preAborted = new AbortController();

    preAborted.abort();

    await assert.rejects(wallClock.delay(Infinity, { signal: preAborted.signal }), (error: unknown) => {

      assertAbortError(error, "an infinite delay with a pre-aborted signal");

      return true;
    });

    assert.equal(primitive.mock.callCount(), 2, "a signal already aborted goes straight to the promise primitive");
    assert.equal(primitive.mock.calls[1]?.arguments[2]?.signal, preAborted.signal, "handing it that signal");
    assert.equal(getEventListeners(preAborted.signal, "abort").length, 0, "with no listener registered");
  });

  test("a NaN timer keeps the platform's handling, firing after a millisecond", async () => {

    // A runtime may warn that it set a NaN window to one millisecond, and an older one does not, so this shape stays out of the no-warning row and the row reads
    // only that the timer fires, never whether a warning came.
    const fired = Promise.withResolvers<undefined>();

    using timer = wallClock.schedule((): void => fired.resolve(undefined), NaN);

    assert.equal(await raceRealWait(fired.promise), "settled", "the platform sets a NaN window to one millisecond, so the timer fires well inside a real wait");
  });

  test("a NaN delay keeps the platform's handling, resolving after a millisecond", async () => {

    // As with the NaN timer, a runtime may warn that it set the delay to one millisecond and an older one does not, so the row reads only that the delay resolves.
    const controller = new AbortController();

    assert.equal(await raceRealWait(wallClock.delay(NaN, { signal: controller.signal })), "settled",
      "the platform sets a NaN delay to one millisecond, so it resolves well inside a real wait");
  });

  test("a negative-infinity timer and delay keep the platform's handling of a negative span, each coming due after a millisecond", async () => {

    // As with NaN, a runtime may warn about a negative span and an older one does not, so this shape stays out of the no-warning row and the row reads only when
    // each comes due.
    const controller = new AbortController();
    const fired = Promise.withResolvers<undefined>();

    using timer = wallClock.schedule((): void => fired.resolve(undefined), -Infinity);

    assert.equal(await raceRealWait(fired.promise), "settled", "the platform sets a negative window to one millisecond, so the timer fires well inside a real wait");
    assert.equal(await raceRealWait(wallClock.delay(-Infinity, { signal: controller.signal })), "settled",
      "and the delay resolves well inside one, as every negative delay does");
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

  test("a deadline pending on the wall clock leaves the process free to exit, and its disposal leaves its signal live", () => {

    const sample = activeTimers();
    const deadline = armDeadline(60000);

    assert.equal(activeTimers(), sample, "the deadline's timer stands pending without holding the process open");

    deadline[Symbol.dispose]();

    assert.equal(deadline.signal.aborted, false, "a deadline released before its span elapses never aborts");
  });
});

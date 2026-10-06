/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * clock.ts: Time abstraction for the UniFi Access API.
 */
import { setTimeout as setTimeoutAsync } from "node:timers/promises";

/**
 * Source of time for any code that needs to know "what time is it now?", "wake me up after a delay," or "call me back once the time is up." Production code reads
 * time exclusively through this interface, never through `Date.now()`, `node:timers/promises`, or the global `setTimeout` directly. Tests substitute a fake clock
 * to drive time deterministically without real-time waits or module-level mocking.
 *
 * The interface is shaped by what consumers actually need - a clock, a one-shot delay, and a one-shot callback timer (`now` / `delay` / `schedule`), no more. Adding
 * methods speculatively (setImmediate, a repeating timer, etc.) would be YAGNI; adding them when a consumer first needs one is principled, and each member here
 * answers a consumer. `now` serves the throttle breaker's cooldown and the elapsed time a failed request reports, readings a suite steps rather than waits for.
 * `delay` serves the connection-recovery backoff curve, which needs a one-shot wait of varying duration. `schedule` serves the transport's request deadline, which
 * `armDeadline` arms on it, so a suite fires the deadline rather than waiting it out and a request releases its timer the moment it settles. A repeating consumer -
 * the heartbeat watchdog, the refresh failsafe - is itself a loop that awaits one `delay` per pass, so that single primitive covers a varying sequence and a fixed
 * cadence alike. The consumers are every subsystem that needs wall-clock time, a delay, or a deadline - the transport throttle breaker and the request deadline
 * beside it, the events heartbeat watchdog, the store refresh loop, and the connection recovery loop among them.
 *
 * Why dependency injection here rather than module mocking: time is a real dependency the code reads from, not an incidental detail of the runtime. Naming
 * it as a parameter at the function (or constructor) signature makes the dependency visible at the call site - a reader sees `clock: Clock` and immediately
 * knows the function reads time. With ambient `Date.now()`, the same reader has to scan the function body to discover the dependency. Surfacing implicit
 * dependencies is the architectural property that makes the rest of the testing story trivial.
 *
 * @category Utilities
 */
export interface Clock {

  /**
   * Resolves once, after `ms` milliseconds, unless the abort signal fires first. Mirrors `setTimeout` from `node:timers/promises` but takes only the parameters
   * we actually use - the value parameter and the optional `ref` flag are omitted because no consumer needs them.
   *
   * The signal is required rather than optional because every consumer here waits inside a lifecycle that disposal has to be able to end: a loop that forgot
   * cancellation would hold its subsystem open past teardown, and requiring the signal makes that shape unwritable. The returned promise rejects with an
   * `AbortError` if the signal aborts before the delay elapses, matching `setTimeout` from `node:timers/promises`, so a consumer's loop ends cleanly on disposal.
   *
   * @param ms   - Delay before the promise resolves, in milliseconds.
   * @param init - Includes the abort signal that cancels the delay.
   *
   * @returns A promise that resolves after the delay, or rejects with `AbortError` on abort.
   */
  delay(ms: number, init: { signal: AbortSignal }): Promise<void>;

  /**
   * Returns the current wall-clock time in milliseconds since the Unix epoch. The semantic matches `Date.now()`.
   */
  now(): number;

  /**
   * Runs `callback` once, after `ms` milliseconds. The production clock arms it on the global `setTimeout`, read at call time rather than bound when the module
   * loads, so a harness that replaces the global observes the timer.
   *
   * With `init.unref` set the timer never holds the process open, so a process whose only pending work is a timer armed this way exits without waiting for it.
   * Omitted, the platform's default holds: the timer keeps the process alive until it fires or is disposed. Set or omitted, the timer comes due at the same moment,
   * so the flag decides only whether the process waits for it.
   *
   * The timer is one-shot only. Every repeating consumer here is a loop that awaits one `delay` per pass, and what needs a callback timer is the deadline
   * `armDeadline` arms, which fires once, so a repeating arm would add surface no consumer calls.
   *
   * @param callback - The function to run when the timer fires.
   * @param ms       - The timer's window, in milliseconds.
   * @param init     - Optional init options. `unref` arms a timer that does not hold the process open.
   *
   * @returns A handle whose `[Symbol.dispose]` cancels the timer. Disposing it before it fires means the callback never runs; disposing it after it fired, or a
   * second time, does nothing.
   */
  schedule(callback: () => void, ms: number, init?: { unref?: boolean }): Disposable;
}

/**
 * The production clock. Reads wall-clock time via `Date.now()`, delays via `node:timers/promises`, and arms callback timers on the global `setTimeout`. This shim
 * is the single bridge between the `Clock` interface and Node's runtime; consumers always go through `Clock`, never directly to the Node primitives, so an
 * unmocked call site behaves exactly like a direct `Date.now()`, `node:timers/promises`, or `setTimeout` call would.
 *
 * Consumer tests (the `ConnectionMonitor`, `EventStream`, `StateStore`, and the like) construct homebridge-plugin-utils' `TestClock` instead of importing this; this
 * module's own test exercises `wallClock` directly to confirm it reads real time and drives real timers. Production code receives this as the default in every
 * constructor that takes a `Clock`.
 *
 * @category Utilities
 */
export const wallClock: Clock = {

  delay: (ms: number, init: { signal: AbortSignal }): Promise<void> => setTimeoutAsync(ms, undefined, init),

  now: (): number => Date.now(),

  schedule: (callback: () => void, ms: number, init?: { unref?: boolean }): Disposable => {

    const handle = setTimeout(callback, ms);

    if(init?.unref ?? false) {

      handle.unref();
    }

    return { [Symbol.dispose]: (): void => clearTimeout(handle) };
  }
};

/**
 * A deadline armed by `armDeadline`: the signal that aborts when the span elapses, and the disposer that releases the timer behind it. Its holder hands `signal` to
 * the work it bounds and disposes the deadline when that work settles, with `using` where the work is a scope. A deadline disposed before its span elapses leaves its
 * signal unaborted for good.
 */
export interface Deadline extends Disposable {

  readonly signal: AbortSignal;
}

/**
 * Arms a deadline of `ms` milliseconds on a clock, answering a `Deadline` whose signal aborts when the span elapses and whose disposal releases the timer.
 *
 * The signal aborts with the platform's deadline reason: a `DOMException` whose `name` is `"TimeoutError"`, the reason `AbortSignal.timeout` aborts with, so the
 * cause an `AccessTimeoutError` carries keeps the platform's shape. The abort is one of the clock's own timers, armed through `schedule` with `unref` set, so a
 * pending deadline never holds the process open, and a suite holding a `TestClock` fires it with an advance rather than a real wait.
 *
 * Its holder releases the deadline when the work it bounds settles - with `using` where that work is a scope - so no timer outlives the work. Disposing after the
 * deadline fired, and disposing a second time, do nothing. Composing the deadline's signal with a caller's own stays the holder's job, through `AbortSignal.any`,
 * so the deadline hands back one primitive rather than an assembled lifetime.
 *
 * This is a local copy of homebridge-plugin-utils' `armDeadline`. The library takes no runtime dependency on homebridge-plugin-utils, so a differential test in this
 * package's suite runs both deadlines over one `TestClock` and asserts the same observations come back, which is what keeps the two of them one behavior.
 *
 * @param ms            - The deadline, in milliseconds.
 * @param options       - Optional deadline options.
 * @param options.clock - The time source the deadline is armed on. Defaults to `wallClock`.
 *
 * @returns A `Deadline` carrying the signal, for its holder to dispose when the work it bounds settles.
 */
export function armDeadline(ms: number, { clock = wallClock }: { clock?: Clock } = {}): Deadline {

  const controller = new AbortController();
  const timer = clock.schedule((): void => controller.abort(new DOMException("The operation was aborted due to timeout", "TimeoutError")), ms, { unref: true });

  return { [Symbol.dispose]: (): void => timer[Symbol.dispose](), signal: controller.signal };
}

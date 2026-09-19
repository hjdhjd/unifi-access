/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * clock.ts: Time abstraction for the UniFi Access API.
 */
import { setTimeout as setTimeoutAsync } from "node:timers/promises";

/**
 * Source of time for any code that needs to know "what time is it now?" or "wake me up after a delay." Production code reads time exclusively through this
 * interface, never through `Date.now()` or `node:timers/promises` directly. Tests substitute a fake clock to drive time deterministically without real-time
 * waits or module-level mocking.
 *
 * The interface is shaped by what consumers actually need - a clock, a one-shot delay, and a deadline signal (`now` / `delay` / `timeout`), no more. Adding methods
 * speculatively (setImmediate, etc.) would be YAGNI; adding them when a consumer first needs one is principled - `delay` earned its place when the
 * connection-recovery backoff curve needed a one-shot wait of varying duration, and `timeout` earned its own when the transport's request deadline needed to be a
 * signal a suite could fire rather than wait out. A repeating consumer - the heartbeat watchdog, the refresh failsafe - is itself a loop that awaits one `delay`
 * per pass, so that single primitive covers a varying sequence and a fixed cadence alike. The consumers are every subsystem that needs wall-clock time, a delay,
 * or a deadline - the transport throttle breaker and the request deadline beside it, the events heartbeat watchdog, the store refresh loop, and the connection
 * recovery loop among them.
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
   * Returns a signal that aborts after `ms` milliseconds with the platform's deadline reason: a `DOMException` whose `name` is `"TimeoutError"`. The production
   * clock implements it as `AbortSignal.timeout`, whose timer is unreferenced and so never holds the process open.
   *
   * Composing the deadline with a caller's own cancellation stays the consumer's job - `AbortSignal.any` over the two is what a call site that needs both reaches
   * for - so the clock hands back one primitive rather than an assembled lifetime. The shared library's `TestClock` carries the same member, which is what lets a
   * single double drive a subsystem's delays and its deadlines together.
   *
   * @param ms - The deadline, in milliseconds.
   *
   * @returns A signal that aborts with the platform's `TimeoutError` once the deadline elapses.
   */
  timeout(ms: number): AbortSignal;
}

/**
 * The production clock. Reads wall-clock time via `Date.now()`, delays via `node:timers/promises`, and deadlines via `AbortSignal.timeout`. This shim is the single
 * bridge between the `Clock` interface and Node's runtime; consumers always go through `Clock`, never directly to the Node primitives, so an unmocked call site
 * behaves exactly like a direct `Date.now()`, `node:timers/promises`, or `AbortSignal.timeout` call would.
 *
 * Consumer tests (the `ConnectionMonitor`, `EventStream`, `StateStore`, and the like) construct the shared library's `TestClock` instead of importing this; this
 * module's own test exercises `wallClock` directly to confirm it reads real time and drives real timers. Production code receives this as the default in every
 * constructor that takes a `Clock`.
 *
 * @category Utilities
 */
export const wallClock: Clock = {

  delay: (ms: number, init: { signal: AbortSignal }): Promise<void> => setTimeoutAsync(ms, undefined, init),

  now: (): number => Date.now(),

  timeout: (ms: number): AbortSignal => AbortSignal.timeout(ms)
};

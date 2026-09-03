/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * testing.helpers.ts: Cross-cutting helpers shared across the unit tests in this codebase.
 *
 * These helpers exist as code rather than data because they encapsulate behavior the test runtime needs: a silent logger, log capture, eventual-consistency
 * assertions, deterministic time control, and the walk that flattens a topology document's hardware out of its nesting. They live in src/ so they sit beside the
 * production code they support, and the helpers exclude pattern in
 * tsconfig.build.json and the coverage flags keep them out of the published build and out of the coverage denominators.
 *
 * A helper earns its place here when more than one test module needs it. A helper specific to a single source module belongs beside that module as a sibling
 * helpers file instead, and the codebase's fixture convention is verbatim captured literals rather than factories, so no fixture builders live here.
 */
import type { AccessBootstrapConfig, AccessDeviceConfig } from "./types/index.ts";
import type { AccessLogging } from "./logging.ts";
import type { Clock } from "./clock.ts";
import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import { mock } from "node:test";

// One captured log call. The full argument list is stored rather than just the message, so a test can assert on the structured context object the production code
// passed alongside it - the shape the library logs in practice.
export interface CapturedLogEntry {

  args: unknown[];
  level: "debug" | "error" | "info" | "warn";
  message: string;
}

// A logger that records every call for later assertion, for verifying that production code logs the right message at the right level when a recovery, throttling,
// or error path fires.
export interface CapturingLogger extends AccessLogging {

  entries: CapturedLogEntry[];
  reset(): void;
}

/**
 * Build a silent logger. Used by tests that exercise code requiring an `AccessLogging` shape where the test does not assert on log output.
 *
 * @returns A logger whose methods are mock functions, so an unexpected call is still inspectable through its call count.
 */
export function silentLog(): AccessLogging {

  return {

    debug: mock.fn(),
    error: mock.fn(),
    info: mock.fn(),
    warn: mock.fn()
  };
}

/**
 * Build a capturing logger. Each call appends a {@link CapturedLogEntry} to `entries`.
 *
 * @returns A logger plus an `entries` buffer and a `reset()` that clears the buffer between assertions within one test.
 */
export function capturingLog(): CapturingLogger {

  const entries: CapturedLogEntry[] = [];

  const record = (level: CapturedLogEntry["level"]) => (message: string, ...args: unknown[]): void => {

    entries.push({ args, level, message });
  };

  return {

    debug: record("debug"),
    entries,
    error: record("error"),
    info: record("info"),
    reset: (): void => {

      entries.length = 0;
    },
    warn: record("warn")
  };
}

/**
 * Detect unhandled promise rejections that occur during the wrapped function's lifetime. Attaches an `unhandledRejection` listener, runs the function, yields one
 * scheduler tick so pending microtasks can surface their rejections, then asserts none fired and detaches the listener.
 *
 * Use it to verify that a fire-and-forget promise (a `void this.something()` the production code launches and never awaits) actually settles, rather than only
 * that it ran. A promise nobody awaits is exactly the shape that turns a handled failure into a process-level warning.
 *
 * @param fn - Async function whose promise hygiene is being verified.
 */
export async function assertNoUnhandledRejections(fn: () => Promise<void>): Promise<void> {

  const captured: unknown[] = [];

  const listener = (reason: unknown): void => {

    captured.push(reason);
  };

  process.on("unhandledRejection", listener);

  try {

    await fn();

    // Yield once so any pending microtasks - await chains scheduled but not yet run - have a chance to surface their rejections before we assert.
    await delay(0);

    assert.equal(captured.length, 0, "expected no unhandled rejections, captured: " + captured.map((reason) => String(reason)).join(", "));
  } finally {

    process.off("unhandledRejection", listener);
  }
}

/**
 * Poll a predicate until it returns true or a deadline passes, for testing eventually-consistent behavior without real-time delays.
 *
 * Pair it with a {@link FakeClock}'s `advance()` or `tick()` to drive time-dependent production code forward inside the polling loop. The default `intervalMs` of 0
 * yields the event loop without sleeping, so the predicate is re-checked after each microtask drain.
 *
 * @param predicate - Returns a boolean or a promise of one. Called repeatedly until it returns truthy.
 * @param options   - The polling cadence and deadline.
 * @param options.intervalMs - Milliseconds between poll attempts. Defaults to 0.
 * @param options.message    - Message to report if the deadline passes first.
 * @param options.timeoutMs  - Real-time deadline in milliseconds. Defaults to 1000.
 */
export async function expectAt(predicate: () => boolean | Promise<boolean>,
  options: { intervalMs?: number; message?: string; timeoutMs?: number } = {}): Promise<void> {

  const intervalMs = options.intervalMs ?? 0;
  const message = options.message ?? "predicate did not become true within deadline";
  const timeoutMs = options.timeoutMs ?? 1000;
  const deadline = Date.now() + timeoutMs;

  // The deadline is real time because the polling loop runs against the real scheduler, independent of any fake clock a test injects into the production code, which
  // is what lets a mocked-time test still bound its wait. The sequential awaits are the point...the predicate is the gate and the delay is the cadence, so running
  // them concurrently would defeat the polling semantic.
  while(Date.now() < deadline) {

    // eslint-disable-next-line no-await-in-loop
    if(await predicate()) {

      return;
    }

    // eslint-disable-next-line no-await-in-loop
    await delay(intervalMs);
  }

  assert.fail(message);
}

/**
 * Every device record a topology document holds, walked out of its nesting in document order: the hardware the building hosts directly, then the hardware
 * attached to each door of each floor. The records are the document's own objects rather than copies, which is what lets a test read the document's own spelling
 * of a record beside what the state stored for it, and re-spell a record in place on a clone.
 *
 * @param bootstrap - The topology document to walk.
 *
 * @returns The document's device records, in document order.
 */
export function topologyDevices(bootstrap: AccessBootstrapConfig): AccessDeviceConfig[] {

  return [ ...(bootstrap.device_groups ?? []).flat(), ...(bootstrap.floors ?? []).flatMap((floor) => floor.doors.flatMap((door) => door.device_groups.flat())) ];
}

/**
 * A test-controllable {@link Clock}. It extends the production interface with two knobs. `advance(ms)` is the clock hand: it moves `now()` forward and resolves any
 * `wait` whose deadline it crosses. `tick()` is the interval pulse: it releases exactly one pending `setInterval` iteration, the next one queued.
 *
 * The two release mechanisms stay distinct because the production primitives they stand in for differ in kind. A `wait` is a time-based one-shot, faithfully fired
 * by advancing the clock past its deadline, while `setInterval` is a tick-based repeater fired by an explicit pulse independent of exact time. Separating them lets
 * a test express "the wall clock moved forward by N seconds, but the interval has not yet woken up", which is what any staleness threshold evaluated on a loop tick
 * needs in order to be tested at all.
 */
export interface FakeClock extends Clock {

  /**
   * Advance `now()` by `ms` milliseconds, then resolve every pending `wait` whose deadline the new time has reached, in deadline order. Fires no `setInterval`
   * iteration...call `tick()` for that.
   *
   * @param ms - Milliseconds to add to the current time.
   */
  advance(ms: number): void;

  /**
   * Release exactly one pending `setInterval` iteration, the next one queued rather than every active one. After releasing it, yields once to the event loop so the
   * consumer's `for await` body runs before the call returns.
   */
  tick(): Promise<void>;
}

/**
 * Build a deterministic test clock. Tests inject this in place of `wallClock` to drive time-dependent code without real waits or module mocking.
 *
 * - `now()` returns the accumulated value of the `advance(ms)` calls, starting at 0.
 * - `wait()` resolves once `advance()` moves `now()` to or past the deadline recorded at registration, and rejects with an `AbortError` if the signal aborts first,
 *   matching `setTimeout` from `node:timers/promises`.
 * - `setInterval()` returns an async iterable whose iterations are gated on `tick()`, each `tick()` releasing one waiter across all active intervals. The iterable
 *   terminates with an `AbortError` when the supplied signal aborts, matching `setInterval` from `node:timers/promises`.
 *
 * @returns A {@link FakeClock} wired into the same `Clock` shape production code expects.
 */
export function fakeClock(): FakeClock {

  let currentTime = 0;

  // The pending tick resolvers of the active setInterval consumers. Each entry releases one consumer's await so its next iteration body runs. Entries are pushed on
  // `next()` and shifted on `tick()`, so the consumer that began waiting first is released first and test ordering stays deterministic.
  const pendingTicks: (() => void)[] = [];

  /* One outstanding wait. The deadline is what `now()` must reach for it to fire, and the detacher keeps a cancelled wait from either firing or leaking its abort
   * listener.
   */
  interface PendingWait {

    deadline: number;
    detach: () => void;
    resolve: () => void;
  }

  let pendingWaitList: PendingWait[] = [];

  return {

    advance: (ms: number): void => {

      currentTime += ms;

      // Fire every wait the new time has reached, in deadline order, so a test that advances past several deadlines at once sees them resolve in schedule order.
      // Partitioning rather than mutating while iterating keeps the survivors intact and detaches each due entry from its abort listener before resolving it.
      const due = pendingWaitList.filter((entry) => entry.deadline <= currentTime).sort((a, b) => a.deadline - b.deadline);

      pendingWaitList = pendingWaitList.filter((entry) => entry.deadline > currentTime);

      for(const entry of due) {

        entry.detach();
        entry.resolve();
      }
    },

    now: (): number => currentTime,

    setInterval: (_delayMs: number, options: { signal: AbortSignal }): AsyncIterable<void> => {

      const iterator: AsyncIterableIterator<void> = {

        [Symbol.asyncIterator](): AsyncIterableIterator<void> {

          return this;
        },

        next: async (): Promise<IteratorResult<void>> => {

          if(options.signal.aborted) {

            return Promise.resolve({ done: true, value: undefined });
          }

          // Wait for either a tick or an abort, whichever comes first, detaching the other once one fires so the same resolver cannot fire twice.
          return new Promise<IteratorResult<void>>((resolve, reject) => {

            const onAbort = (): void => {

              const index = pendingTicks.indexOf(resolveOnTick);

              if(index >= 0) {

                pendingTicks.splice(index, 1);
              }

              const error = new Error("The operation was aborted.");

              error.name = "AbortError";

              reject(error);
            };

            const resolveOnTick = (): void => {

              options.signal.removeEventListener("abort", onAbort);
              resolve({ done: false, value: undefined });
            };

            options.signal.addEventListener("abort", onAbort, { once: true });
            pendingTicks.push(resolveOnTick);
          });
        }
      };

      return { [Symbol.asyncIterator]: () => iterator };
    },

    tick: async (): Promise<void> => {

      // Release one pending tick, taking the queue's head rather than draining it, so repeated calls advance one iteration at a time.
      const next = pendingTicks.shift();

      next?.();

      // Yield once so the consumer's `for await` body runs before this returns. Without the yield, a caller expecting the side effects to be visible immediately
      // after `await tick()` would read stale state.
      await delay(0);
    },

    wait: (delayMs: number, options: { signal: AbortSignal }): Promise<void> => {

      // An already-aborted signal rejects immediately and registers no deadline, matching `setTimeout` from `node:timers/promises`.
      if(options.signal.aborted) {

        const error = new Error("The operation was aborted.");

        error.name = "AbortError";

        return Promise.reject(error);
      }

      return new Promise<void>((resolve, reject) => {

        const entry: PendingWait = {

          deadline: currentTime + delayMs,
          detach: (): void => options.signal.removeEventListener("abort", onAbort),
          resolve
        };

        // An abort before the deadline drops the entry so a later `advance()` cannot fire it, then rejects like a real timer would.
        const onAbort = (): void => {

          pendingWaitList = pendingWaitList.filter((pending) => pending !== entry);

          const error = new Error("The operation was aborted.");

          error.name = "AbortError";

          reject(error);
        };

        options.signal.addEventListener("abort", onAbort, { once: true });
        pendingWaitList.push(entry);
      });
    }
  };
}

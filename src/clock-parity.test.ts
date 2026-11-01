/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * clock-parity.test.ts: Differential tests holding this library's clock to homebridge-plugin-utils' clock. The library takes no runtime dependency on
 * homebridge-plugin-utils, so `armDeadline` and the production clock's handling of a span past the platform timer's ceiling or at infinity are implemented in both
 * places, and this suite holds each pair to one behavior over what its scenarios observe. One table of scenarios - the behaviors homebridge-plugin-utils' own suite
 * asserts of its deadline - runs through each deadline over a fresh `TestClock`, asserting the same observations come back: the clock's ledger, the deadline's
 * signal, and the class, message, and name of the reason it aborts with. Another runs `wallClock` and homebridge-plugin-utils' `systemClock` through one set of
 * one-shot timers and signalled delays on `node:test`'s mock timers - within the ceiling, at it, one hop and several hops past it, cut short mid-chain, and at an
 * infinite span, referenced and unreferenced - asserting the same timers armed and cleared, the same waits on the promise primitive, and the same readings after
 * each step, an aborted wait's reading saying whether its rejection carries the reason the abort was handed. A change on either side to what those rows observe
 * reddens it here, and a divergence is a divergence from homebridge-plugin-utils' shape, resolved by reading its clock, never by loosening the assertion.
 * The differential rows read no timer's process-hold policy and no `NaN` or negative-infinity span, so `wallClock`'s own rows in `src/clock.test.ts` are what hold
 * the per-hop `unref` and the `NaN` and negative-infinity handling. Beside the scenarios, one row holds `wallClock`'s monotonic reading between bracketing reads of
 * `systemClock`'s, and the compiler holds homebridge-plugin-utils' `TestClock` and `systemClock` to this library's `Clock`, so a consumer may inject either.
 */
import type { Assert, Extends } from "homebridge-plugin-utils/testing";
import type { Clock, Deadline } from "./clock.ts";
import type { MockTimers, TestContext } from "node:test";
import { TIMER_DELAY_MAX_MS, armDeadline, wallClock } from "./clock.ts";
import { TestClock, settle } from "homebridge-plugin-utils/testing";
import { armDeadline as armWithPluginUtils, systemClock } from "homebridge-plugin-utils";
import { describe, test } from "node:test";
import type { Nullable } from "./types/index.ts";
import assert from "node:assert/strict";
import { getEventListeners } from "node:events";
import timersPromises from "node:timers/promises";

/* A member of the contract read as a function type rather than as the method signature it is declared with. Method signatures compare their parameters in both
 * directions, so a clock whose `delay` demanded more of its init than the contract offers would still assign to `Clock` whole; a function type compares them in one
 * direction only, so the member lines below are what hold each clock's parameters to the contract's.
 */
type AsFunction<Member> = Member extends (...args: infer Parameters) => infer Result ? (...args: Parameters) => Result : never;

// Each of homebridge-plugin-utils' clocks assigns to this library's `Clock` whole, and member by member through the function-typed reading.
const _testClockIsAClock: Clock = new TestClock();
const _systemClockIsAClock: Clock = systemClock;

type _DelayConforms = Assert<Extends<TestClock["delay"] | (typeof systemClock)["delay"], AsFunction<Clock["delay"]>>>;
type _MonotonicConforms = Assert<Extends<TestClock["monotonic"] | (typeof systemClock)["monotonic"], AsFunction<Clock["monotonic"]>>>;
type _NowConforms = Assert<Extends<TestClock["now"] | (typeof systemClock)["now"], AsFunction<Clock["now"]>>>;
type _ScheduleConforms = Assert<Extends<TestClock["schedule"] | (typeof systemClock)["schedule"], AsFunction<Clock["schedule"]>>>;

type ArmDeadline = (ms: number, options: { clock: TestClock }) => Deadline;

interface DeadlineObservation {

  readonly aborted: boolean;
  readonly nextDeadline: Nullable<number>;
  readonly pending: number;
  readonly reason: Nullable<{ readonly constructor: unknown; readonly message: string; readonly name: string }>;
  readonly requested: readonly number[];
}

interface DeadlineScenario {

  readonly name: string;
  readonly run: (clock: TestClock, arm: ArmDeadline) => DeadlineObservation;
}

function observe(clock: TestClock, deadline: Deadline): DeadlineObservation {

  const reason: unknown = deadline.signal.reason;

  return {

    aborted: deadline.signal.aborted,
    nextDeadline: clock.nextDeadline,
    pending: clock.pending,
    reason: (reason instanceof DOMException) ? { constructor: reason.constructor, message: reason.message, name: reason.name } : null,
    requested: [...clock.requested]
  };
}

const DEADLINE_SCENARIOS: readonly DeadlineScenario[] = [

  { name: "a deadline advanced short of its span", run: (clock: TestClock, arm: ArmDeadline): DeadlineObservation => {

    const deadline = arm(500, { clock });

    clock.advance(499);

    return observe(clock, deadline);
  } },

  { name: "a deadline advanced across its span", run: (clock: TestClock, arm: ArmDeadline): DeadlineObservation => {

    const deadline = arm(500, { clock });

    clock.advance(500);

    return observe(clock, deadline);
  } },

  { name: "a deadline disposed and then advanced across its span", run: (clock: TestClock, arm: ArmDeadline): DeadlineObservation => {

    const deadline = arm(500, { clock });

    deadline[Symbol.dispose]();
    clock.advance(1000);

    return observe(clock, deadline);
  } },

  { name: "a deadline advanced across its span and then disposed twice", run: (clock: TestClock, arm: ArmDeadline): DeadlineObservation => {

    const deadline = arm(100, { clock });

    clock.advance(100);
    deadline[Symbol.dispose]();
    deadline[Symbol.dispose]();

    return observe(clock, deadline);
  } }
];

describe("armDeadline parity with homebridge-plugin-utils", () => {

  for(const { name, run } of DEADLINE_SCENARIOS) {

    test(name + " leaves the same state behind as homebridge-plugin-utils' deadline does", () => {

      assert.deepEqual(run(new TestClock(), armDeadline), run(new TestClock(), armWithPluginUtils), "the two deadlines agree on " + name);
    });
  }
});

/* A scenario over the domain `wallClock` and `systemClock` share: a one-shot timer, or a delay under a signal, armed for `ms` and then driven through its steps.
 * A number is a tick of the mock timers by that many milliseconds; a one-shot's other step disposes its handle, and a delay's aborts its signal with the reason
 * below. A one-shot with `unref` set is armed with that option, and one without it is armed with no options at all.
 */
type ClockScenario = { readonly ms: number; readonly name: string } & ({ readonly shape: "delay"; readonly steps: readonly (number | "abort")[] } |
  { readonly shape: "one-shot"; readonly steps: readonly (number | "dispose")[]; readonly unref?: boolean });

// The reason every aborting scenario aborts with, so a rejection's cause is read as the reason handed in rather than one the primitive made up.
const ABORT_REASON = new Error("the scenario ended the wait");

// What a clock leaves behind over one scenario: the window of each timer it armed on the global `setTimeout` and the count of global clears, each wait on the
// promise primitive as its window and whether it carried the scenario's signal, and the readings taken after every step.
interface ClockObservation {

  readonly armed: readonly (number | undefined)[];
  readonly cleared: number;
  readonly readings: readonly (number | string)[];
  readonly waited: readonly (readonly [ number | undefined, boolean ])[];
}

// A wait's settlement, read on demand: pending until it settles, then resolved, or the name and code of the error it rejected with and whether that error carries
// the reason the scenario aborted with.
function settlementOf(wait: Promise<void>): () => string {

  let settlement = "pending";

  void wait.then((): void => {

    settlement = "resolved";
  }, (error: unknown): void => {

    const { cause, code, name } = error as { cause?: unknown; code?: unknown; name?: unknown };

    settlement = "rejected " + String(name) + " " + String(code) + ((cause === ABORT_REASON) ? " carrying the reason" : " without the reason");
  });

  return (): string => settlement;
}

/* Drive a scenario's steps on one clock, reading after each: how many times a one-shot has fired, or a delay's settlement beside the count of abort listeners its
 * signal holds. A delay's step settles before its reading, because a hop's continuation, and the next hop it arms, run on later turns than the tick that ends it.
 */
async function play(clock: Clock, scenario: ClockScenario, { controller, timers }: { controller: AbortController; timers: MockTimers }): Promise<(number | string)[]> {

  const readings: (number | string)[] = [];

  if(scenario.shape === "one-shot") {

    let fired = 0;

    const callback = (): void => {

      fired++;
    };

    using timer = (scenario.unref === true) ? clock.schedule(callback, scenario.ms, { unref: true }) : clock.schedule(callback, scenario.ms);

    for(const step of scenario.steps) {

      if(step === "dispose") {

        timer[Symbol.dispose]();
      } else {

        timers.tick(step);
      }

      readings.push(fired);
    }

    return readings;
  }

  const settlement = settlementOf(clock.delay(scenario.ms, { signal: controller.signal }));

  for(const step of scenario.steps) {

    if(step === "abort") {

      controller.abort(ABORT_REASON);
    } else {

      timers.tick(step);
    }

    // Each step has to come to rest before it is read, and before the next step drives the clock further.
    // eslint-disable-next-line no-await-in-loop
    await settle();

    readings.push(settlement(), getEventListeners(controller.signal, "abort").length);
  }

  return readings;
}

/* Play a scenario on one clock over `node:test`'s mock timers, with spies on the global callback timers and on the promise primitive the clock reads off the
 * `node:timers/promises` module object. The spies wrap the mock's own timers and call through, so the clock runs exactly as it would unobserved. The test's mocks
 * reset before this returns, which restores the spies before the mock timers, so the real timers stand again before the next clock plays and the test's own reset
 * at its end finds nothing left to undo.
 */
async function observeClock(t: TestContext, clock: Clock, scenario: ClockScenario): Promise<ClockObservation> {

  const controller = new AbortController();

  t.mock.timers.enable({ apis: ["setTimeout"] });

  const armed = t.mock.method(globalThis, "setTimeout");
  const cleared = t.mock.method(globalThis, "clearTimeout");
  const waited = t.mock.method(timersPromises, "setTimeout");

  try {

    const readings = await play(clock, scenario, { controller, timers: t.mock.timers });

    return {

      armed: armed.mock.calls.map((call) => call.arguments[1]),
      cleared: cleared.mock.callCount(),
      readings,
      waited: waited.mock.calls.map((call) => [ call.arguments[0], call.arguments[2]?.signal === controller.signal ] as const)
    };
  } finally {

    t.mock.reset();
  }
}

const CLOCK_SCENARIOS: readonly ClockScenario[] = [

  { ms: 1000, name: "a one-shot within the ceiling", shape: "one-shot", steps: [ 999, 1, 1000 ] },
  { ms: TIMER_DELAY_MAX_MS, name: "a one-shot at the ceiling", shape: "one-shot", steps: [ TIMER_DELAY_MAX_MS - 1, 1 ] },
  { ms: TIMER_DELAY_MAX_MS + 1, name: "a one-shot one past the ceiling", shape: "one-shot", steps: [ TIMER_DELAY_MAX_MS, 1, TIMER_DELAY_MAX_MS + 1 ] },

  // Each hop is crossed on a tick of its own, so the hop it releases arms its successor before the mock's time moves again.
  { ms: (3 * TIMER_DELAY_MAX_MS) + 7, name: "a one-shot several hops past the ceiling", shape: "one-shot",
    steps: [ TIMER_DELAY_MAX_MS, TIMER_DELAY_MAX_MS, TIMER_DELAY_MAX_MS, 6, 1 ] },

  // The mock times a hop armed inside a callback from the end of the tick that ran the callback, so the chain's last hop needs a tick of its own to be reachable.
  { ms: (2 * TIMER_DELAY_MAX_MS) + 5, name: "a chained one-shot disposed mid-chain", shape: "one-shot",
    steps: [ TIMER_DELAY_MAX_MS + 2, "dispose", (2 * TIMER_DELAY_MAX_MS) + 5, 10 ] },

  { ms: Infinity, name: "an infinite one-shot", shape: "one-shot", steps: [ TIMER_DELAY_MAX_MS, "dispose", "dispose" ] },
  { ms: Infinity, name: "an unreferenced infinite one-shot", shape: "one-shot", steps: [ TIMER_DELAY_MAX_MS, TIMER_DELAY_MAX_MS, "dispose", "dispose" ], unref: true },
  { ms: 1000, name: "a delay within the ceiling", shape: "delay", steps: [ 999, 1 ] },
  { ms: TIMER_DELAY_MAX_MS, name: "a delay at the ceiling", shape: "delay", steps: [ TIMER_DELAY_MAX_MS - 1, 1 ] },
  { ms: TIMER_DELAY_MAX_MS + 1, name: "a delay one past the ceiling", shape: "delay", steps: [ TIMER_DELAY_MAX_MS, 1 ] },
  { ms: (3 * TIMER_DELAY_MAX_MS) + 7, name: "a delay several hops past the ceiling", shape: "delay",
    steps: [ TIMER_DELAY_MAX_MS, TIMER_DELAY_MAX_MS, TIMER_DELAY_MAX_MS, 6, 1 ] },
  { ms: (2 * TIMER_DELAY_MAX_MS) + 5, name: "a chained delay aborted mid-chain", shape: "delay", steps: [ TIMER_DELAY_MAX_MS + 2, "abort" ] },
  { ms: Infinity, name: "an infinite delay", shape: "delay", steps: [ TIMER_DELAY_MAX_MS, "abort" ] }
];

describe("wallClock parity with homebridge-plugin-utils' systemClock", () => {

  for(const scenario of CLOCK_SCENARIOS) {

    test(scenario.name + " leaves the same observations behind as homebridge-plugin-utils' systemClock does", async (t) => {

      assert.deepEqual(await observeClock(t, wallClock, scenario), await observeClock(t, systemClock, scenario), "the two clocks agree on " + scenario.name);
    });
  }

  test("the monotonic reading falls between bracketing reads of homebridge-plugin-utils' systemClock, in the same whole microseconds", () => {

    // Both clocks read the one platform timeline, so a local reading taken between two of homebridge-plugin-utils' falls between them, and both truncate to whole
    // microseconds, so a reading landing on a bound's microsecond compares equal to it rather than falling outside a finer one.
    const before = systemClock.monotonic();
    const observed = wallClock.monotonic();
    const after = systemClock.monotonic();

    assert.ok((observed >= before) && (observed <= after), "wallClock must read within the bracketing systemClock reads: " + [ before, observed, after ].join(" "));
    assert.equal(Math.round(observed * 1000) / 1000, observed, "the reading must be a whole count of microseconds, in milliseconds, as systemClock's is");
  });
});

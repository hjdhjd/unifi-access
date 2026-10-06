/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * clock-parity.test.ts: Differential tests holding this library's deadline equal to homebridge-plugin-utils' deadline. The library takes no runtime dependency on
 * homebridge-plugin-utils, so `armDeadline` is implemented in both places; this suite is what keeps the two of them one behavior. It runs a table of scenarios -
 * the behaviors homebridge-plugin-utils' own suite asserts of its deadline - through each over a fresh `TestClock`, and asserts the same observations come back:
 * the clock's ledger, the deadline's signal, and the class, message, and name of the reason it aborts with. A change to either deadline reddens it here, and a
 * divergence is a divergence from homebridge-plugin-utils' shape, resolved by reading its clock, never by loosening the assertion.
 */
import { describe, test } from "node:test";
import type { Deadline } from "./clock.ts";
import type { Nullable } from "./types/index.ts";
import { TestClock } from "homebridge-plugin-utils/testing";
import { armDeadline } from "./clock.ts";
import { armDeadline as armWithPluginUtils } from "homebridge-plugin-utils";
import assert from "node:assert/strict";

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

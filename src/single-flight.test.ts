/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * single-flight.test.ts: Unit tests for the in-flight coalescing gate. What matters is the slot's lifecycle rather than the wrapped operation: who shares a run,
 * and whether the next caller starts a fresh one after the previous settled - either way it settled, because a gate that never cleared after a rejection would
 * stall every later caller forever.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { singleFlight } from "./single-flight.ts";

describe("singleFlight", () => {

  test("two callers overlapping in time share one run", async () => {

    let runs = 0;
    const { promise, resolve } = Promise.withResolvers<string>();
    const gated = singleFlight((): Promise<string> => {

      runs += 1;

      return promise;
    });

    const first = gated();
    const second = gated();

    assert.equal(runs, 1, "the second caller joined rather than starting a run of its own");

    resolve("one answer");

    assert.deepEqual(await Promise.all([ first, second ]), [ "one answer", "one answer" ]);
    assert.equal(runs, 1);
  });

  test("clears the slot after a fulfilled run, so the next caller starts a fresh one", async () => {

    let runs = 0;
    const gated = singleFlight((): Promise<number> => {

      runs += 1;

      return Promise.resolve(runs);
    });

    assert.equal(await gated(), 1);
    assert.equal(await gated(), 2, "a settled run leaves nothing for the next caller to join");
    assert.equal(runs, 2);
  });

  test("clears the slot after a rejected run, so a failure does not stall every later caller", async () => {

    let runs = 0;
    const gated = singleFlight((): Promise<string> => {

      runs += 1;

      return (runs === 1) ? Promise.reject(new Error("transient")) : Promise.resolve("recovered");
    });

    await assert.rejects(async () => gated(), /transient/);
    assert.equal(await gated(), "recovered");
    assert.equal(runs, 2);
  });

  test("hands a joiner the rejection the run it joined produced", async () => {

    let runs = 0;
    const { promise, reject } = Promise.withResolvers<string>();
    const gated = singleFlight((): Promise<string> => {

      runs += 1;

      return promise;
    });

    const first = gated();
    const second = gated();

    reject(new Error("the shared run failed"));

    await assert.rejects(async () => first, /the shared run failed/);
    await assert.rejects(async () => second, /the shared run failed/);
    assert.equal(runs, 1, "a joiner accepts the fate of the run it joined");
  });

  test("runs the first caller's arguments, not the joiner's", async () => {

    const seen: string[] = [];
    const { promise, resolve } = Promise.withResolvers<string>();
    const gated = singleFlight((label: string): Promise<string> => {

      seen.push(label);

      return promise;
    });

    const first = gated("first");
    const second = gated("second");

    resolve("shared");

    await Promise.all([ first, second ]);

    assert.deepEqual(seen, ["first"], "the attempt a joiner joins was already shaped by the first caller's arguments");
  });
});

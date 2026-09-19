/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * testing.helpers.test.ts: Unit tests for the turn-budgeted poll, the typed rejection assertion, the topology walk, the presence narrowing, the errno-shaped
 * error double, and the typed channel subscription, whose own correctness the other suites depend on. A helper that silently does nothing passes every test that
 * merely calls it, so the cases here drive each of them in both directions - the condition each is meant to catch, and the clean case each must let through.
 */
import { READER_ID, captured } from "./protocol/capture.helpers.ts";
import { assertRejectsWith, errnoError, present, settleUntil, subscribeTo, topologyDevices } from "./testing.helpers.ts";
import { describe, test } from "node:test";
import type { AccessBootstrapConfig } from "./types/index.ts";
import type { AccessStoreDispatchPayload } from "./diagnostics.ts";
import { accessBootstrap2026Fixture } from "./protocol/topology.fixtures.ts";
import assert from "node:assert/strict";
import { channels } from "./diagnostics.ts";
import { settle } from "homebridge-plugin-utils/testing";

describe("settleUntil", () => {

  test("resolves once a predicate that becomes true on a later macrotask turn holds", async () => {

    let flipped = false;

    // The flip is scheduled a turn out rather than set here, so the poll has to cross a macrotask boundary to see it - which is the whole of what it does.
    void settle().then(() => {

      flipped = true;
    });

    await settleUntil(() => flipped);

    assert.equal(flipped, true);
  });

  test("fails with the caller's message once the turn budget is spent, and spends it in predicate calls rather than time", async () => {

    let calls = 0;
    const never = (): boolean => {

      calls++;

      return false;
    };

    await assert.rejects(settleUntil(never, { message: "the state never settled", turns: 5 }), /the state never settled/);

    /* What the budget buys is evaluations, not milliseconds: one before the first turn and one after each of the five the caller allowed. Reading the count is what
     * tells a turn budget apart from a deadline dressed up as one, because a poll that slept its way to exhaustion would report the same failure from far fewer
     * calls.
     */
    assert.equal(calls, 6);
  });

  test("awaits an asynchronous predicate", async () => {

    let calls = 0;
    const settling = (): Promise<boolean> => {

      calls++;

      return Promise.resolve(calls === 2);
    };

    await settleUntil(settling);

    assert.equal(calls, 2, "a promise the predicate returns is awaited rather than read as a truthy object");
  });

  test("calls a predicate that already holds exactly once", async () => {

    let calls = 0;

    await settleUntil(() => {

      calls++;

      return true;
    });

    assert.equal(calls, 1, "a state that has already settled costs no turn at all");
  });
});

describe("assertRejectsWith", () => {

  // Two classes a rejection can carry: one with a field the check reads, and a sibling that shares nothing but the base class, so a mismatch is a real mismatch.
  class Refusal extends Error {

    readonly code: string;

    constructor(code: string) {

      super("refused");
      this.code = code;
    }
  }

  class Unrelated extends Error {}

  test("passes a rejection of the named class and hands the check the narrowed error", async () => {

    let seen: string | null = null;

    await assertRejectsWith(Promise.reject(new Refusal("CODE_BUSY")), Refusal, { check: (error) => {

      seen = error.code;
    } });

    assert.equal(seen, "CODE_BUSY", "the check receives the error already narrowed to the class, so it reads the field without a cast");
  });

  test("fails a rejection of another class with a message naming the class it expected", async () => {

    await assert.rejects(assertRejectsWith(Promise.reject(new Unrelated("elsewhere")), Refusal), /expected Refusal/);
  });

  test("fails when the check itself throws, reporting the check's own message", async () => {

    await assert.rejects(assertRejectsWith(async () => { throw new Refusal("CODE_BUSY"); }, Refusal, { check: () => {

      assert.fail("the field the check reads was wrong");
    } }), /the field the check reads was wrong/);
  });

  test("fails a subject that resolves rather than rejecting", async () => {

    await assert.rejects(assertRejectsWith(Promise.resolve("answered"), Refusal), /Missing expected rejection/);
  });
});

describe("topologyDevices", () => {

  test("hands back the document's own records, root groups ahead of the floors", () => {

    /* The default capture attaches all its hardware to doors, so a building-hosted record is stated here rather than found - which is what puts the walk's root
     * arm in front of its floor arm at all.
     */
    const rooted: AccessBootstrapConfig = { ...accessBootstrap2026Fixture, "device_groups": [[captured(READER_ID)]] };
    const walked = topologyDevices(rooted);

    assert.ok(Object.is(walked[0], captured(READER_ID)), "the building's own hardware is walked ahead of the floors beneath it, and as the document's own object");
    assert.deepEqual(walked.slice(1), topologyDevices(accessBootstrap2026Fixture), "and everything behind it is the document's own walk, in its own order");
  });

  test("walks an empty document to an empty list", () => {

    assert.equal(Object.hasOwn(accessBootstrap2026Fixture, "device_groups"), false, "the document hosts nothing directly, so emptying its floors empties the walk");
    assert.deepEqual(topologyDevices({ ...accessBootstrap2026Fixture, "floors": [] }), []);
  });
});

describe("present", () => {

  test("hands back a value that is present, narrowed to its type", () => {

    const record = { name: "Acme Name 6" };
    const found = present(new Map([[ "hub", record ]]).get("hub"), "the hub");

    // The lookup's own type admits undefined, so the member read below compiles only because the helper narrowed it...and the identity says the value came back
    // itself rather than as a copy.
    assert.equal(found, record, "the helper hands back the very value the lookup answered");
    assert.equal(found.name, "Acme Name 6");
  });

  test("fails a lookup that answered undefined, naming what was expected", () => {

    assert.throws(() => present(new Map<string, string>().get("hub"), "the hub"), /expected the hub, got undefined/);
  });

  test("fails a null the same way", () => {

    assert.throws(() => present(null, "the hub"), /expected the hub, got null/);
  });
});

describe("errnoError", () => {

  test("carries the message and the code a platform-level connection failure would", () => {

    const error = errnoError("connect ECONNREFUSED", "ECONNREFUSED");

    assert.ok(error instanceof Error, "an errno failure is an Error before it is anything else, which is what a classifier meets it as");
    assert.equal(error.message, "connect ECONNREFUSED");
    assert.equal(error.code, "ECONNREFUSED");
  });
});

describe("subscribeTo", () => {

  test("delivers every payload published on a roster channel to a handler typed by that channel", () => {

    const seen: AccessStoreDispatchPayload[] = [];

    using subscription = subscribeTo(channels.storeDispatch, (message) => void seen.push(message));

    channels.storeDispatch.publish({ host: "10.0.0.1", kind: "bootstrapLoaded" });

    // The fields are read off the payload's own type rather than through a cast at the call site, which is the whole of what the helper buys a suite.
    assert.deepEqual(seen.map((payload) => payload.kind), ["bootstrapLoaded"]);
    assert.equal(seen[0]?.host, "10.0.0.1");
  });

  test("stops delivering once the handle it returned is disposed", () => {

    const seen: AccessStoreDispatchPayload[] = [];
    const subscription = subscribeTo(channels.storeDispatch, (message) => void seen.push(message));

    channels.storeDispatch.publish({ host: "10.0.0.1", kind: "bootstrapLoaded" });
    subscription[Symbol.dispose]();
    channels.storeDispatch.publish({ host: "10.0.0.1", kind: "censusApplied" });

    assert.deepEqual(seen.map((payload) => payload.kind), ["bootstrapLoaded"], "a payload published after the disposal reaches nobody");
  });
});

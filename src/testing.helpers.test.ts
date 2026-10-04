/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * testing.helpers.test.ts: Unit tests for the topology walk and the typed channel subscription, whose own correctness the other suites depend on. A helper that
 * silently does nothing passes every test that merely calls it, so the cases here drive each of them in both directions - the condition each is meant to catch,
 * and the clean case each must let through.
 */
import { READER_ID, captured } from "./protocol/capture.helpers.ts";
import { describe, test } from "node:test";
import { subscribeTo, topologyDevices } from "./testing.helpers.ts";
import type { AccessBootstrapConfig } from "./types/index.ts";
import type { AccessStoreDispatchPayload } from "./diagnostics.ts";
import { accessBootstrap2026Fixture } from "./protocol/topology.fixtures.ts";
import assert from "node:assert/strict";
import { channels } from "./diagnostics.ts";

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

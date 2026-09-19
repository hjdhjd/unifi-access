/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * cli.helpers.test.ts: Unit tests for the offline rig the whole ufa command surface is driven through - the structural fake client's mode defaults, its held
 * stream, and its absence control, the rig's one cast to the client type, the capturing command context's credential counting and its refusal to open a client it
 * was never given, the output normalizer and the JSON document reader, the signal and planted-value assertions, and the wrappers that restore a process global.
 *
 * The arms that have never been driven from a command are the held stream's refusal of a call that brings no signal, and the rejecting path through each
 * wrapper's restore. A command always passes its signal and usually resolves, so a wrapper whose finally had been lost would keep the capture installed for the
 * rest of the file and every test after it would report to a stream nobody reads.
 *
 * No network, no credentials, and no controller anywhere in this file. The wrappers under test do mutate the process exit code and the standard error stream,
 * and each test asserts the restoration rather than performing it, so a lost restore fails here rather than leaking into the rest of the run.
 */
import { asAccessClient, assertNothingPlantedSurvives, makeCommandContext, makeFakeClient, officialCallSignal, parsedJson, rendered, withExitCode,
  withStderr } from "./cli.helpers.ts";
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { findPacket } from "../../protocol/capture.helpers.ts";
import { settle } from "homebridge-plugin-utils/testing";

/** The fake's raw-packet stream as a command calls it, narrowed to the shape the held-stream tests drive. */
type HeldStream = (opts?: { signal?: AbortSignal }) => AsyncGenerator;

// One captured packet behind the hold, so a stream that yielded anything at all would be visible. Which packet it is does not matter: the hold never reaches it.
const HELD_PACKET = findPacket((packet) => packet.event === "access.remote_view", "an interactive ring");

describe("makeFakeClient", () => {

  test("makeFakeClient defaults to credential mode alone and to dual with an official spec", () => {

    const bare = makeFakeClient();
    const withOfficial = makeFakeClient({ official: {} });

    assert.deepEqual(bare.client["capabilities"], { mode: "credential", official: false, override: "auto" });
    assert.equal(bare.client["official"], null, "nothing makes a credential-only client, so there is no official facade to answer through");
    assert.deepEqual(withOfficial.client["capabilities"], { mode: "dual", official: true, override: "auto" });
    assert.notEqual(withOfficial.client["official"], null, "an official spec makes a dual-mode client with the official path up");
  });

  test("a token-mode fake answers null for the controller name and the admin verdict", () => {

    const token = makeFakeClient({ capabilities: { mode: "token", official: true, override: "auto" }, official: {} });
    const credential = makeFakeClient();

    // The two verdicts a token-only client genuinely has none of: no controller document, so no name, and no account, so no privilege verdict.
    assert.equal(token.client["controllerName"], null);
    assert.equal(token.client["isAdmin"], null);
    assert.equal(credential.client["controllerName"], "Test Name 1", "a credential client answers both, which is what makes the nulls above a mode difference");
    assert.equal(credential.client["isAdmin"], true);
  });

  test("a held stream refuses a call that passes no signal", async () => {

    const { client } = makeFakeClient({ holdUntilAborted: true, packets: [HELD_PACKET] });
    const stream = client["rawPackets"] as HeldStream;

    await assert.rejects(async () => stream().next(), /A held stream needs the signal the command runs under, but the caller passed none\./);
  });

  test("a held stream yields nothing until its signal fires", async () => {

    const controller = new AbortController();
    const { calls, client } = makeFakeClient({ holdUntilAborted: true, packets: [HELD_PACKET] });
    const stream = client["rawPackets"] as HeldStream;
    const drained: unknown[] = [];
    const draining = (async (): Promise<void> => {

      for await (const packet of stream({ signal: controller.signal })) {

        drained.push(packet);
      }
    })();

    await settle();

    assert.deepEqual(drained, [], "the fake yields nothing while it waits, so a bound's effect is observable without depending on when its timer fires");

    controller.abort();

    await draining;

    assert.deepEqual(drained, [], "the abort ends the stream with the packet behind the hold never reached");
    assert.deepEqual(calls.consumed, []);
  });
});

describe("makeCommandContext", () => {

  test("makeCommandContext counts a credential load before the loader answers", async () => {

    const { calls } = makeFakeClient();
    const { ctx } = makeCommandContext({ calls, loadCredentials: async () => Promise.reject(new Error("the identity file could not be read")) });

    await assert.rejects(async () => ctx.loadCredentials(), /the identity file could not be read/);

    // What a refusal test reads is whether the identity file was reached for, not whether it answered, so a loader that throws is recorded as a read all the same.
    assert.equal(calls.credentialLoads, 1);
  });

  test("makeCommandContext refuses to open a client it was never given", async () => {

    const { ctx } = makeCommandContext();

    await assert.rejects(async () => ctx.openClient(), /The command context was built without a client to open\./);
  });
});

describe("the client handles and the shared assertions", () => {

  test("asAccessClient hands back the very fake, typed as a client", () => {

    const { client } = makeFakeClient();

    assert.equal(asAccessClient(client), client, "the cast hands back the fake itself rather than a wrapper around it");
    assert.equal(asAccessClient(client).capabilities.mode, "credential", "and a client member reads through the typed handle without a cast of its own");
  });

  test("markAbsent makes a handle's record read throw and refuses an id the fake never built", () => {

    const fake = makeFakeClient({ accessPoints: [{ id: "port-1", name: "EAH Port 1" }], devices: [{ id: "hub-1", name: "Acme Name 6" }] });
    const device = (fake.client["devices"] as Record<string, unknown>[])[0];
    const port = (fake.client["accessPoints"] as Record<string, unknown>[])[0];

    assert.equal((device?.["config"] as Record<string, unknown> | undefined)?.["unique_id"], "hub-1", "the record reads while the device is present");

    fake.markAbsent("hub-1");

    assert.throws(() => device?.["config"], ReferenceError, "the record read throws once the device has left controller state");
    assert.equal((port?.["config"] as Record<string, unknown> | undefined)?.["unique_id"], "port-1", "and a record nobody marked still reads");

    fake.markAbsent("port-1");

    assert.throws(() => port?.["config"], ReferenceError, "an access point's handle is marked the same way");
    assert.throws(() => fake.markAbsent("hub-9"), /The fake client built no handle for hub-9\./);
  });

  test("parsedJson joins the written chunks and parses them", () => {

    assert.deepEqual(parsedJson<{ ids: string[] }>([ "{\"ids\":[\"hub-1\",", "\"hub-2\"]}\n" ]), { ids: [ "hub-1", "hub-2" ] },
      "a single-line document split across writes");
    assert.deepEqual(parsedJson<{ ok: boolean }>([ "{\n  \"ok\": ", "true\n}\n" ]), { ok: true }, "and an indented document split the same way");
  });

  test("officialCallSignal reads the signal from a call's third argument and answers undefined for an absent call, a short call, and options without one", () => {

    const { signal } = new AbortController();

    assert.equal(officialCallSignal({ args: [ "d-1", {}, { signal } ], method: "spaces.unlock" }), signal, "the call options in third place carry the signal");
    assert.equal(officialCallSignal(undefined), undefined, "a call that never happened carries no signal");
    assert.equal(officialCallSignal({ args: ["d-1"], method: "spaces.unlock" }), undefined, "a call that passed no options carries none");
    assert.equal(officialCallSignal({ args: [ "d-1", {}, {} ], method: "spaces.unlock" }), undefined, "and neither do options that name no signal");
  });

  test("assertNothingPlantedSurvives passes clean text and fails naming the planted value and the label", () => {

    const planted = [ "Acme Holdings HQ", "Loading Dock" ];

    assert.doesNotThrow(() => assertNothingPlantedSurvives([ "Test Name 1\n", "Test Name 2\n" ], planted, "info"));
    assert.throws(() => assertNothingPlantedSurvives([ "Test Name 1 at Loading ", "Dock\n" ], planted, "info devices"), /info devices carries no "Loading Dock"/);
  });
});

describe("the output and process-global wrappers", () => {

  test("rendered drops blank lines", () => {

    assert.deepEqual(rendered([ "one\n", "\n", "two\nthree\n" ]), [ "one", "two", "three" ]);
    assert.deepEqual(rendered([]), []);
  });

  test("withExitCode restores the exit code when the run rejects", async () => {

    const before = process.exitCode;

    await assert.rejects(async () => withExitCode(async () => {

      process.exitCode = 3;

      return Promise.reject(new Error("the command failed"));
    }), /the command failed/);

    assert.equal(process.exitCode, before, "the restore is in a finally, so a command's exit code never becomes the test run's on the rejecting path either");
  });

  test("withStderr restores the stream and the exit code when the run rejects", async () => {

    const before = process.exitCode;

    let installed: typeof process.stderr.write | undefined;

    await assert.rejects(async () => withStderr(async () => {

      // The identity of the installed writer is the observation here, so the value is read rather than called.
      // eslint-disable-next-line @typescript-eslint/unbound-method
      installed = process.stderr.write;
      process.exitCode = 4;

      return Promise.reject(new Error("the command failed"));
    }), /the command failed/);

    assert.ok(installed, "the run saw a writer the wrapper had installed in place of the real one");

    /* The writer after the wrapper is the bound copy the wrapper saved, which is a different function object from the capture the run saw - so a wrapper whose
     * restore was lost on the rejecting path would leave the capture in place and fail right here. Nothing in this test writes to stderr outside the wrapped run.
     */
    // eslint-disable-next-line @typescript-eslint/unbound-method
    assert.notEqual(process.stderr.write, installed);
    assert.equal(process.exitCode, before);
  });
});

/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * cli-device.test.ts: Tests for the ufa device group - the fleet restart policy under the `all` keyword, the access-method settings with their read-back, and the
 * direct configuration write. Every test runs offline against the structural fake.
 */
import { CREDENTIALS_PAIR, CREDENTIALS_TOKEN, makeCommandContext, makeFakeClient, rendered } from "./cli.helpers.ts";
import { describe, test } from "node:test";
import { AccessAbortedError } from "../../index.ts";
import { CliError } from "./shared.ts";
import assert from "node:assert/strict";
import { device } from "./commands/device.ts";

const HUB_ID = "02ffee000000";
const READER_ID = "02ffee000002";

describe("the device restart command", () => {

  test("the all keyword restarts every device in the union and reports each one", async () => {

    const { calls, client } = makeFakeClient({ accessPoints: [{ id: "port-1", name: "EAH Port 1" }],
      devices: [{ id: HUB_ID, name: "Acme Name 6" }] });
    const { ctx, lines } = makeCommandContext({ args: [ "restart", "all" ], calls, client });

    await device.run(ctx);

    assert.deepEqual(calls.restarts, [ HUB_ID, "port-1" ]);
    assert.equal(rendered(lines).length, 2);
    assert.match(rendered(lines)[0] ?? "", /Acme Name 6 .* - restarting\./);
  });

  test("the keyword is tested before name resolution, so a device named all cannot shadow it", async () => {

    const { calls, client } = makeFakeClient({ devices: [ { id: "dev-all", name: "all" }, { id: HUB_ID, name: "Acme Name 6" } ] });
    const { ctx } = makeCommandContext({ args: [ "restart", "all" ], calls, client });

    await device.run(ctx);

    assert.deepEqual(calls.restarts, [ "dev-all", HUB_ID ], "the keyword commands the fleet, never one device");
  });

  test("attached devices are restarted before the hubs that carry them", async () => {

    // The inventory deliberately reports each carrier ahead of the device it carries, which is the order that strands a reader mid-run when it is followed.
    const { calls, client } = makeFakeClient({ devices: [ { id: "hub-1", name: "Hub One" }, { id: "reader-a", name: "Reader A", uplinkId: "hub-1" },
      { id: "standalone", name: "Standalone" }, { id: "hub-2", name: "Hub Two" }, { id: "reader-b", name: "Reader B", uplinkId: "hub-2" } ] });
    const { ctx } = makeCommandContext({ args: [ "restart", "all" ], calls, client });

    await device.run(ctx);

    // Every device is still commanded exactly once: the attached ones first, then everything that connects in its own right, each side in the order the
    // inventory reported it.
    assert.deepEqual(calls.restarts, [ "reader-a", "reader-b", "hub-1", "standalone", "hub-2" ]);
  });

  test("the skip notes stay in inventory order when an attached device is not connected", async () => {

    const { calls, client } = makeFakeClient({ devices: [ { config: { "is_connected": false }, id: "reader-a", name: "Reader A", uplinkId: "hub-1" },
      { id: "hub-1", name: "Hub One" }, { config: { "is_connected": false }, id: "reader-b", name: "Reader B", uplinkId: "hub-1" } ] });
    const { ctx, lines } = makeCommandContext({ args: [ "restart", "all" ], calls, client });

    await device.run(ctx);

    // Only the command order is partitioned. What the gating pass reports it skipped still reads in the order the inventory arrived in, so an operator's notes
    // line up with the listing they just looked at.
    assert.match(rendered(lines)[0] ?? "", /Reader A .* not connected/);
    assert.match(rendered(lines)[1] ?? "", /Reader B .* not connected/);
    assert.deepEqual(calls.restarts, ["hub-1"]);
  });

  test("it restarts one named target", async () => {

    const { calls, client } = makeFakeClient({ devices: [ { id: HUB_ID, name: "Acme Name 6" }, { id: READER_ID, name: "Reader" } ] });
    const { ctx } = makeCommandContext({ args: [ "restart", "Acme Name 6" ], calls, client });

    await device.run(ctx);

    assert.deepEqual(calls.restarts, [HUB_ID]);
  });

  test("it skips a device that is already rebooting or not connected", async () => {

    const { calls, client } = makeFakeClient({ devices: [ { config: { "is_rebooting": true }, id: HUB_ID, name: "Acme Name 6" },
      { config: { "is_connected": false }, id: READER_ID, name: "Reader" } ] });
    const { ctx, lines } = makeCommandContext({ args: [ "restart", "all" ], calls, client });

    await device.run(ctx);

    assert.deepEqual(calls.restarts, []);
    assert.match(rendered(lines)[0] ?? "", /already rebooting/);
    assert.match(rendered(lines)[1] ?? "", /not connected/);
    assert.match(rendered(lines)[2] ?? "", /No connected devices to restart\./);
  });

  test("an unmatched name lists what the controller does have", async () => {

    const { calls, client } = makeFakeClient({ devices: [{ id: HUB_ID, name: "Acme Name 6" }] });
    const { ctx } = makeCommandContext({ args: [ "restart", "Nothing" ], calls, client });

    await assert.rejects(async () => device.run(ctx), (error: unknown) => (error instanceof CliError) && error.message.includes("Acme Name 6 => " + HUB_ID));
  });

  test("a failed restart is reported and the run continues", async () => {

    const { calls, client } = makeFakeClient({ devices: [ { id: HUB_ID, name: "Acme Name 6", restartError: new Error("the controller refused") },
      { id: READER_ID, name: "Reader" } ] });
    const { ctx, lines } = makeCommandContext({ args: [ "restart", "all" ], calls, client });

    await device.run(ctx);

    assert.deepEqual(calls.restarts, [ HUB_ID, READER_ID ]);
    assert.match(rendered(lines)[0] ?? "", /failed: the controller refused/);
    assert.match(rendered(lines)[1] ?? "", /Reader .* - restarting\./);
  });

  test("an abort mid-loop stops the run before the next device is commanded", async () => {

    const { calls, client } = makeFakeClient({ devices: [ { id: HUB_ID, name: "Acme Name 6", restartError: new AccessAbortedError("stopped") },
      { id: READER_ID, name: "Reader" } ] });
    const { ctx } = makeCommandContext({ args: [ "restart", "all" ], calls, client });

    await assert.rejects(async () => device.run(ctx), AccessAbortedError);

    assert.deepEqual(calls.restarts, [HUB_ID], "the second device is never commanded");
  });

  test("a record that vanishes mid-run fails its own restart and does not break the loop", async () => {

    const handles: Record<string, unknown>[] = [];
    const { calls, client } = makeFakeClient({ devices: [ { beforeRestart: (): void => {

      // The second device's record leaves controller state while the first is being restarted.
      (handles[1]?.["markAbsent"] as () => void)();
    }, id: HUB_ID, name: "Acme Name 6" }, { id: READER_ID, name: "Reader" } ] });

    handles.push(...(client["devices"] as Record<string, unknown>[]));

    const { ctx, lines } = makeCommandContext({ args: [ "restart", "all" ], calls, client });

    await device.run(ctx);

    // The line still names the device, because the run reads its own snapshot rather than a record that is no longer there.
    assert.match(rendered(lines)[1] ?? "", /^Reader \(.*\) - failed: /);
    assert.deepEqual(calls.restarts, [HUB_ID]);
  });

  test("a target can be named by its identifier", async () => {

    const { calls, client } = makeFakeClient({ devices: [ { id: HUB_ID, name: "Acme Name 6" }, { id: READER_ID, name: "Reader" } ] });
    const { ctx } = makeCommandContext({ args: [ "restart", HUB_ID ], calls, client });

    await device.run(ctx);

    assert.deepEqual(calls.restarts, [HUB_ID]);
  });

  test("it requires exactly one target", async () => {

    const { client } = makeFakeClient({ devices: [] });
    const { ctx } = makeCommandContext({ args: ["restart"], client });

    await assert.rejects(async () => device.run(ctx), (error: unknown) => (error instanceof CliError) && (error.exitCode === 2));
  });

  test("a token-only identity is refused before anything connects, and the one-shot convention holds", async () => {

    const { calls, client } = makeFakeClient({ devices: [{ id: HUB_ID, name: "Acme Name 6" }] });
    const refused = makeCommandContext({ args: [ "restart", "all" ], calls, client, credentials: CREDENTIALS_TOKEN });

    await assert.rejects(async () => device.run(refused.ctx),
      (error: unknown) => (error instanceof CliError) && error.message.includes("device restart command"));

    assert.equal(calls.opens.length, 0);

    const allowed = makeCommandContext({ args: [ "restart", "all" ], calls, client });

    await device.run(allowed.ctx);

    assert.equal(calls.opens[0]?.refreshIntervalMs, false);
  });

  test("the device group does not accept the --api flag", async () => {

    // The routing override belongs to the door group alone - no device command routes - so the strict parser refuses the flag here rather than carrying it inert.
    const { calls, client } = makeFakeClient({ devices: [{ id: HUB_ID, name: "Acme Name 6" }] });
    const { ctx } = makeCommandContext({ args: [ "restart", "all", "--api", "auto" ], calls, client });

    await assert.rejects(async () => device.run(ctx),
      (error: unknown) => (typeof (error as NodeJS.ErrnoException).code === "string") && ((error as NodeJS.ErrnoException).code ?? "").startsWith("ERR_PARSE_ARGS"));

    assert.equal(calls.opens.length, 0);
  });
});

describe("the device settings command", () => {

  const officialSpec = { capabilities: { mode: "dual", official: true, override: "auto" } as const, devices: [{ id: READER_ID, name: "Front Reader" }],
    official: { settings: { "access_methods": { "face": { "enabled": "no" }, "nfc": { "enabled": "yes" } }, "device_id": READER_ID } } };

  test("with no flags the settings read renders", async () => {

    const { calls, client } = makeFakeClient(officialSpec);
    const { ctx, lines } = makeCommandContext({ args: [ "settings", "Front Reader", "--json" ], calls, client });

    await device.run(ctx);

    assert.deepEqual(calls.official.map((call) => call.method), ["devices.fetchSettings"]);
    assert.equal(rendered(lines)[0], JSON.stringify(officialSpec.official.settings));
  });

  test("a toggle writes the sparse update, awaits it, reads back, and reports what held", async () => {

    const { calls, client } = makeFakeClient(officialSpec);
    const { ctx, lines } = makeCommandContext({ args: [ "settings", "Front Reader", "--enable", "nfc" ], calls, client });

    await device.run(ctx);

    // The write precedes the read-back in the recorded call order - the read that reports what held must never race the write it reports on.
    assert.deepEqual(calls.official.map((call) => call.method), [ "devices.updateSettings", "devices.fetchSettings" ]);
    assert.deepEqual(calls.official[0]?.args, [ READER_ID, { "access_methods": { "nfc": { "enabled": "yes" } } }, { signal: ctx.signal } ]);
    assert.match(rendered(lines)[0] ?? "", /^nfc - enabled\.$/);
    assert.equal(calls.opens[0]?.refreshIntervalMs, false);
  });

  test("a silent decline is surfaced per method rather than reported as success", async () => {

    // The fake echoes success for the write and reports face still off on the read-back - the silent-decline shape unsupported hardware answers with.
    const { calls, client } = makeFakeClient(officialSpec);
    const { ctx, lines } = makeCommandContext({ args: [ "settings", "Front Reader", "--enable", "face", "--disable", "nfc" ], calls, client });

    await device.run(ctx);

    assert.deepEqual(calls.official[0]?.args,
      [ READER_ID, { "access_methods": { "face": { "enabled": "yes" }, "nfc": { "enabled": "no" } } }, { signal: ctx.signal } ]);

    const output = rendered(lines);

    assert.match(output[0] ?? "", /^face - declined: /);
    assert.match(output[1] ?? "", /^nfc - declined: /);
  });

  test("a method the device does not offer reads back as absent and reports the decline by name", async () => {

    const { calls, client } = makeFakeClient(officialSpec);
    const { ctx, lines } = makeCommandContext({ args: [ "settings", "Front Reader", "--enable", "wave" ], calls, client });

    await device.run(ctx);

    assert.match(rendered(lines)[0] ?? "", /^wave - declined: the device reports no such method/);
    assert.equal(calls.official.length, 2, "the write and the read-back both happened");
  });

  test("an unknown method and a contradictory pair are refused before anything connects", async () => {

    const { calls, client } = makeFakeClient(officialSpec);
    const unknown = makeCommandContext({ args: [ "settings", "Front Reader", "--enable", "telepathy" ], calls, client });

    await assert.rejects(async () => device.run(unknown.ctx),
      (error: unknown) => (error instanceof CliError) && (error.exitCode === 2) && error.message.includes("bt_button"));

    const contradiction = makeCommandContext({ args: [ "settings", "Front Reader", "--enable", "nfc", "--disable", "nfc" ], calls, client });

    await assert.rejects(async () => device.run(contradiction.ctx),
      (error: unknown) => (error instanceof CliError) && (error.exitCode === 2) && error.message.includes("nfc"));

    assert.equal(calls.opens.length, 0);
  });

  test("a credential-only identity is refused, naming the official API", async () => {

    const { calls, client } = makeFakeClient(officialSpec);
    const { ctx } = makeCommandContext({ args: [ "settings", "Front Reader" ], calls, client, credentials: CREDENTIALS_PAIR });

    await assert.rejects(async () => device.run(ctx),
      (error: unknown) => (error instanceof CliError) && error.message.includes("device settings command") && error.message.includes("official API"));

    assert.equal(calls.opens.length, 0);
  });

  test("token mode resolves the device through the same projections every other identity resolves through", async () => {

    const { calls, client } = makeFakeClient({ capabilities: { mode: "token", official: true, override: "auto" },
      devices: [ { id: READER_ID, name: "Front Reader" }, { id: HUB_ID, name: "Acme Name 6" } ],
      official: { settings: { "access_methods": {}, "device_id": READER_ID } } });
    const { ctx } = makeCommandContext({ args: [ "settings", "Front Reader" ], calls, client, credentials: CREDENTIALS_TOKEN });

    await device.run(ctx);

    // The inventory the census seeded answers the name, so the settings read is the only thing the official surface is asked for.
    assert.deepEqual(calls.official.map((call) => call.method), ["devices.fetchSettings"]);
    assert.equal(calls.official[0]?.args[0], READER_ID);
  });
});

describe("the device update command", () => {

  const spec = { devices: [{ id: READER_ID, name: "Front Reader" }] };

  test("a dry run prints the target and the payload and sends nothing", async () => {

    const { calls, client } = makeFakeClient(spec);
    const { ctx, lines } = makeCommandContext({ args: [ "update", "Front Reader", "--json", "{\"name\": \"Lobby Reader\"}", "--dry-run" ], calls, client });

    await device.run(ctx);

    assert.deepEqual(calls.updates, []);
    assert.match(rendered(lines)[0] ?? "", /dry run, nothing sent/);
    assert.equal(rendered(lines)[1], "{\"name\":\"Lobby Reader\"}");
  });

  test("the send path writes the payload and renders the echoed record", async () => {

    const { calls, client } = makeFakeClient(spec);
    const { ctx, lines } = makeCommandContext({ args: [ "update", "Front Reader", "--json", "{\"name\": \"Lobby Reader\"}" ], calls, client });

    await device.run(ctx);

    assert.deepEqual(calls.updates, [{ id: READER_ID, payload: { name: "Lobby Reader" } }]);
    assert.match(lines.join(""), /Lobby Reader/, "the echoed record renders");
    assert.equal(calls.opens[0]?.refreshIntervalMs, false);
  });

  test("a missing, malformed, or non-object payload is refused before anything connects", async () => {

    const cases: string[][] = [ [ "update", "Front Reader" ], [ "update", "Front Reader", "--json", "{nope" ], [ "update", "Front Reader", "--json", "[1]" ] ];

    for(const args of cases) {

      const { calls, client } = makeFakeClient(spec);
      const { ctx } = makeCommandContext({ args, calls, client });

      // Sequential by intent: each payload shape is asserted on its own invocation.
      // eslint-disable-next-line no-await-in-loop
      await assert.rejects(async () => device.run(ctx), (error: unknown) => (error instanceof CliError) && (error.exitCode === 2), args.join(" "));

      assert.equal(calls.opens.length, 0, args.join(" "));
    }
  });

  test("a token-only identity is refused before anything connects", async () => {

    const { calls, client } = makeFakeClient(spec);
    const { ctx } = makeCommandContext({ args: [ "update", "Front Reader", "--json", "{}" ], calls, client, credentials: CREDENTIALS_TOKEN });

    await assert.rejects(async () => device.run(ctx),
      (error: unknown) => (error instanceof CliError) && error.message.includes("device update command"));

    assert.equal(calls.opens.length, 0);
  });
});

describe("the device capture scrub", () => {

  test("the settings read is scrubbed while the access-method vocabulary survives", async () => {

    // The settings document names the device it belongs to and the methods its hardware offers. The identity goes; the method names and their yes/no readings are
    // exactly what a reader diagnoses with, and stay.
    const settings = { "access_methods": { "nfc": { "enabled": "yes" } }, "device_id": READER_ID, "device_name": "Front Reader" };
    const spec = { capabilities: { mode: "dual", official: true, override: "auto" } as const, devices: [{ id: READER_ID, name: "Front Reader" }],
      official: { settings } };

    const plain = makeFakeClient(spec);
    const plainRun = makeCommandContext({ args: [ "settings", "Front Reader", "--json" ], calls: plain.calls, client: plain.client });

    await device.run(plainRun.ctx);

    assert.equal(rendered(plainRun.lines)[0], JSON.stringify(settings), "without the flag the read is byte-identical to what the controller answered");

    const scrubbed = makeFakeClient(spec);
    const scrubbedRun = makeCommandContext({ args: [ "settings", "Front Reader", "--json", "--scrub" ], calls: scrubbed.calls, client: scrubbed.client });

    await device.run(scrubbedRun.ctx);

    const text = rendered(scrubbedRun.lines)[0] ?? "";

    assert.ok(!text.includes(READER_ID));
    assert.ok(!text.includes("Front Reader"));
    assert.ok(text.includes("\"nfc\""), "the access-method vocabulary survives");
    assert.ok(text.includes("\"yes\""), "and so does its reading");
  });

  test("the echoed record from a write is scrubbed", async () => {

    const { calls, client } = makeFakeClient({ devices: [{ id: READER_ID, name: "Front Reader" }] });
    const { ctx, lines } = makeCommandContext({ args: [ "update", "Front Reader", "--json", "{\"name\": \"Lobby Reader\"}", "--scrub" ], calls, client });

    await device.run(ctx);

    const text = lines.join("");

    assert.deepEqual(calls.updates, [{ id: READER_ID, payload: { name: "Lobby Reader" } }], "the write itself carries the operator's own payload, unscrubbed");
    assert.ok(!text.includes("Lobby Reader"), "the record the controller echoed back is what the flag reaches");
    assert.match(text, /Test Name \d+/);
  });

  test("a settings change asked to scrub is refused before anything connects", async () => {

    const { calls, client } = makeFakeClient({ devices: [{ id: READER_ID, name: "Front Reader" }] });
    const { ctx } = makeCommandContext({ args: [ "settings", "Front Reader", "--enable", "nfc", "--scrub" ], calls, client });

    await assert.rejects(async () => device.run(ctx), (error: unknown) => (error instanceof CliError) && (error.exitCode === 2) &&
      (error.message === "A settings change reports each method rather than printing a document, so --scrub applies to the settings read only."));

    assert.equal(calls.opens.length, 0);
  });

  test("a dry run asked to scrub is refused before anything connects", async () => {

    const { calls, client } = makeFakeClient({ devices: [{ id: READER_ID, name: "Front Reader" }] });
    const { ctx } = makeCommandContext({ args: [ "update", "Front Reader", "--json", "{\"name\": \"Lobby Reader\"}", "--dry-run", "--scrub" ], calls, client });

    await assert.rejects(async () => device.run(ctx), (error: unknown) => (error instanceof CliError) && (error.exitCode === 2) &&
      (error.message === "A dry run prints the payload you supplied rather than a controller document, so --scrub has nothing to act on."));

    assert.equal(calls.opens.length, 0);
  });
});

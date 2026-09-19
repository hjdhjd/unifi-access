/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * cli-doctor.test.ts: Tests for the mode-aware ufa doctor - the per-mode check sets, the capability and facade checks in both polarities, and the abort posture.
 * Every test runs offline against the structural fake.
 */
import { describe, test } from "node:test";
import { makeCommandContext, makeFakeClient, parsedJson, rendered, withExitCode } from "./cli.helpers.ts";
import type { FakeClientSpec } from "./cli.helpers.ts";
import { accessEventPacketsInteractiveFixture } from "../../protocol/events.fixtures.ts";
import assert from "node:assert/strict";
import { doctor } from "./commands/doctor.ts";
import { findPacket } from "../../protocol/capture.helpers.ts";

const RING = findPacket((packet) => packet.event === "access.remote_view", "an interactive ring", { corpus: accessEventPacketsInteractiveFixture });
const LOG_ADD = findPacket((packet) => packet.event === "access.logs.add", "an interactive log entry", { corpus: accessEventPacketsInteractiveFixture });

// A healthy credential-mode fixture.
const healthy: FakeClientSpec = { devices: [{ id: "02ffee000000", name: "Acme Name 6" }], hubIds: ["02ffee000000"],
  snapshot: { controller: { host: { uptime: 90061 } }, root: { name: "Acme Name 12" } } };

// The shape of one parsed doctor report.
interface DoctorReport {

  ok: boolean;
  results: { detail?: string; name: string; status: string }[];
}

// Run the doctor against a fake and parse its JSON report.
async function runDoctor(spec: FakeClientSpec): Promise<{ code: typeof process.exitCode; report: DoctorReport }> {

  const { calls, client } = makeFakeClient(spec);
  const { ctx, lines } = makeCommandContext({ args: ["--json"], calls, client });
  const code = await withExitCode(async () => doctor.run(ctx));

  return { code, report: parsedJson<DoctorReport>(lines) };
}

describe("the mode-aware check sets", () => {

  test("a credential-mode run carries the credential checks and no facade check", async () => {

    const { code, report } = await runDoctor({ ...healthy, packets: [RING] });

    assert.equal(report.ok, true);
    assert.equal(code, 0);
    assert.deepEqual(report.results.map((result) => result.name), [ "Connect and authenticate", "Capabilities", "State and inventory",
      "Derived state (selectors)", "Door states", "Realtime event firehose", "Event classification", "Connection monitor", "Diagnostics channels" ]);
  });

  test("a dual-mode run adds the facade check beside the credential set", async () => {

    const { report } = await runDoctor({ ...healthy, official: { doors: [ { "id": "od-1" }, { "id": "od-2" } ] }, packets: [RING] });

    assert.deepEqual(report.results.map((result) => result.name), [ "Connect and authenticate", "Capabilities", "State and inventory",
      "Derived state (selectors)", "Door states", "Official API facade", "Realtime event firehose", "Event classification", "Connection monitor",
      "Diagnostics channels" ]);
    assert.equal(report.results.find((result) => result.name === "Official API facade")?.status, "pass");
  });

  test("a token-mode run reports the inventory it does have, skips the checks whose subject it does not, and the facade check stands in", async () => {

    const { code, report } = await runDoctor({ capabilities: { mode: "token", official: true, override: "auto" },
      official: { doors: [{ "id": "od-1" }] }, packets: [RING] });

    // The inventory row survives without a topology and the selector row does not, which is the line between a count a census can report and a verdict only a
    // topology and a privileged account can support.
    assert.deepEqual(report.results.map((result) => result.name), [ "Connect and authenticate", "Capabilities", "State and inventory", "Door states",
      "Official API facade", "Realtime event firehose", "Event classification", "Connection monitor", "Diagnostics channels" ]);
    assert.equal(report.results.find((result) => result.name === "State and inventory")?.status, "pass", "an empty inventory is reported, never failed");
    assert.equal(report.ok, true);
    assert.equal(code, 0);
  });

  test("the connect detail names the controller and the mode, per mode", async () => {

    const credential = await runDoctor({ ...healthy, packets: [] });

    assert.equal(credential.report.results[0]?.detail, "connected to Test Name 1 in credential mode");

    const dual = await runDoctor({ ...healthy, official: { doors: [] }, packets: [] });

    assert.equal(dual.report.results[0]?.detail, "connected to Test Name 1 in dual mode");

    const token = await runDoctor({ capabilities: { mode: "token", official: true, override: "auto" }, official: { doors: [] }, packets: [] });

    assert.equal(token.report.results[0]?.detail, "connected to the controller in token mode");
  });

  test("an api override joins the connect detail", async () => {

    const { report } = await runDoctor({ ...healthy, capabilities: { mode: "credential", official: false, override: "direct-only" }, packets: [] });

    assert.equal(report.results[0]?.detail, "connected to Test Name 1 in credential mode, held to direct-only");
  });

  test("the capabilities line reports mode, official, and override, varying by mode", async () => {

    const credential = await runDoctor({ ...healthy, packets: [] });

    assert.equal(credential.report.results.find((result) => result.name === "Capabilities")?.detail, "mode=credential, official=false, override=auto");
    assert.equal(credential.report.results.find((result) => result.name === "Capabilities")?.status, "pass");

    const dual = await runDoctor({ ...healthy, official: { doors: [] }, packets: [] });

    assert.equal(dual.report.results.find((result) => result.name === "Capabilities")?.detail, "mode=dual, official=true, override=auto");

    const token = await runDoctor({ capabilities: { mode: "token", official: true, override: "official-only" }, official: { doors: [] }, packets: [] });

    assert.equal(token.report.results.find((result) => result.name === "Capabilities")?.detail, "mode=token, official=true, override=official-only");
  });

  test("the facade check passes with the door count and demotes to a failure when the read throws", async () => {

    const passing = await runDoctor({ ...healthy, official: { doors: [ { "id": "od-1" }, { "id": "od-2" } ] }, packets: [] });
    const passRow = passing.report.results.find((result) => result.name === "Official API facade");

    assert.equal(passRow?.status, "pass");
    assert.equal(passRow?.detail, "2 doors visible through the official API");

    const failing = await runDoctor({ ...healthy, official: { doorsError: new Error("the token was revoked") }, packets: [] });
    const failRow = failing.report.results.find((result) => result.name === "Official API facade");

    assert.equal(failRow?.status, "fail");
    assert.match(failRow?.detail ?? "", /the token was revoked/);
    assert.equal(failing.report.ok, false);
  });

  test("the door-states detail reports the established count and never judges it", async () => {

    const { report } = await runDoctor({ ...healthy, packets: [] });
    const row = report.results.find((result) => result.name === "Door states");

    assert.equal(row?.status, "pass");
    assert.match(row?.detail ?? "", /0 doors carry established state/);
  });
});

describe("the doctor's carried posture", () => {

  test("the firehose passes on a packet and warns on a quiet window", async () => {

    const withPacket = await runDoctor({ ...healthy, packets: [RING] });
    const passRow = withPacket.report.results.find((result) => result.name === "Realtime event firehose");

    assert.equal(passRow?.status, "pass");
    assert.match(passRow?.detail ?? "", /first packet: access\.remote_view/);

    const quiet = await runDoctor({ ...healthy, packets: [] });

    // A quiet site is not a broken one, so the empty window warns and the run still succeeds.
    assert.equal(quiet.report.results.find((result) => result.name === "Realtime event firehose")?.status, "warn");
    assert.equal(quiet.report.ok, true);
  });

  test("the window consumes exactly one packet however many are waiting", async () => {

    const { calls, client } = makeFakeClient({ ...healthy, packets: [ RING, LOG_ADD ] });
    const { ctx } = makeCommandContext({ args: ["--json"], calls, client });

    await withExitCode(async () => doctor.run(ctx));

    assert.deepEqual(calls.consumed, ["access.remote_view"]);
  });

  test("the classification row is informational for an unmodeled packet", async () => {

    const { report } = await runDoctor({ ...healthy, packets: [LOG_ADD] });
    const row = report.results.find((result) => result.name === "Event classification");

    assert.equal(row?.status, "pass");
    assert.match(row?.detail ?? "", /is not modeled/);
    assert.equal(report.ok, true);
  });

  test("each verdict-bearing check can register a failure", async () => {

    const cases: [ string, FakeClientSpec ][] = [
      [ "State and inventory", { ...healthy, snapshot: { controller: { host: { uptime: 1 } }, root: null } } ],
      [ "Derived state (selectors)", { ...healthy, controllerName: null } ],
      [ "Connection monitor", { ...healthy, connection: { isHealthy: false, state: "disconnected" } } ]
    ];

    for(const [ name, spec ] of cases) {

      // Sequential by intent: each case is its own doctor run.
      // eslint-disable-next-line no-await-in-loop
      const { code, report } = await runDoctor(spec);

      assert.equal(report.results.find((result) => result.name === name)?.status, "fail", name);
      assert.equal(report.ok, false, name);
      assert.equal(code, 1, name);
    }
  });

  test("a check that throws is demoted to a failed row and the rest still run", async () => {

    const { report } = await runDoctor({ ...healthy, doorStatesError: new Error("the door-state rail is unreadable"), packets: [RING] });

    assert.equal(report.results.find((result) => result.name === "Door states")?.status, "fail");
    assert.match(report.results.find((result) => result.name === "Door states")?.detail ?? "", /unreadable/);

    // The point of the chokepoint: one probe's crash costs one row, not the remaining checks.
    assert.equal(report.results.length, 9);
    assert.equal(report.ok, false);
  });

  test("a stream failure is attributed to the check that owns stream health", async () => {

    const { report } = await runDoctor({ ...healthy, streamError: new Error("the notification socket is closed") });
    const row = report.results.find((result) => result.name === "Realtime event firehose");

    assert.equal(row?.status, "fail");
    assert.match(row?.detail ?? "", /socket is closed/);
  });

  test("a failing check's detail carries the diagnosis its cause held", async () => {

    // The shared catch every check funnels through. A probe that wraps what it caught keeps the underlying words in the row an operator reads.
    const { report } = await runDoctor({ ...healthy, doorStatesError: new Error("The door-state rail is unreadable.",
      { cause: new Error("the hub answered with no ports") }), packets: [RING] });
    const row = report.results.find((result) => result.name === "Door states");

    assert.equal(row?.status, "fail");
    assert.equal(row?.detail, "The door-state rail is unreadable: the hub answered with no ports",
      "the row carries the wrapper's sentence and the cause's words below it");
  });

  test("a failed connect's detail carries the diagnosis its cause held", async () => {

    const { ctx, lines } = makeCommandContext({ args: ["--json"], openClient: (): never => {

      throw new Error("Unable to authenticate against the UniFi Access controller.", { cause: new Error("the controller refused the credentials") });
    } });

    await withExitCode(async () => doctor.run(ctx));

    const report = parsedJson<DoctorReport>(lines);

    assert.equal(report.results[0]?.detail, "Unable to authenticate against the UniFi Access controller: the controller refused the credentials",
      "the connect row carries what the controller actually said");
  });

  test("the stream window's detail carries the diagnosis its cause held", async () => {

    const { report } = await runDoctor({ ...healthy, streamError: new Error("The notification socket is closed.",
      { cause: new Error("connect ECONNREFUSED") }) });
    const row = report.results.find((result) => result.name === "Realtime event firehose");

    assert.equal(row?.status, "fail");
    assert.equal(row?.detail, "The notification socket is closed: connect ECONNREFUSED", "the firehose row carries the errno the cause held");
  });

  test("a stop during connect ends the run through the cascade", async () => {

    const { AccessAbortedError } = await import("../../index.ts");
    const { ctx, lines } = makeCommandContext({ args: ["--json"], openClient: (): never => {

      throw new AccessAbortedError("stopped during connect");
    } });

    await withExitCode(async () => assert.rejects(async () => doctor.run(ctx), AccessAbortedError));

    assert.deepEqual(lines, []);
  });

  test("the human report tags a failing check", async () => {

    const { calls, client } = makeFakeClient({ ...healthy, connection: { isHealthy: false, state: "disconnected" } });
    const { ctx, lines } = makeCommandContext({ calls, client });

    const code = await withExitCode(async () => doctor.run(ctx));

    assert.match(rendered(lines).find((line) => line.includes("Connection monitor")) ?? "", /^FAIL {2}Connection monitor/);
    assert.equal(code, 1);
  });

  test("a failed connect ends the run with the failure reported", async () => {

    const { ctx, lines } = makeCommandContext({ args: ["--json"], openClient: (): never => {

      throw new Error("the controller refused the credentials");
    } });

    const code = await withExitCode(async () => doctor.run(ctx));
    const report = parsedJson<DoctorReport>(lines);

    assert.equal(report.ok, false);
    assert.equal(code, 1);
    assert.deepEqual(report.results.map((result) => result.name), ["Connect and authenticate"]);
    assert.match(report.results[0]?.detail ?? "", /refused the credentials/);
  });

  test("a stopped run ends through the cascade rather than reporting", async () => {

    const { AccessAbortedError } = await import("../../index.ts");
    const aborted = new AbortController();

    aborted.abort();

    const { calls, client } = makeFakeClient(healthy);
    const { ctx, lines } = makeCommandContext({ args: ["--json"], calls, client, signal: aborted.signal });

    await withExitCode(async () => assert.rejects(async () => doctor.run(ctx), AccessAbortedError));

    // Nothing is rendered: a health check the operator stopped has found nothing, and a report saying otherwise would be a fabrication.
    assert.deepEqual(lines, []);
    assert.equal(calls.disposals, 1);
  });

  test("a run stopped during the stream window still ends through the cascade", async () => {

    const { AccessAbortedError } = await import("../../index.ts");
    const aborted = new AbortController();
    const { calls, client } = makeFakeClient({ ...healthy, onStream: (): void => aborted.abort(), packets: [] });
    const { ctx, lines } = makeCommandContext({ args: ["--json"], calls, client, signal: aborted.signal });

    await withExitCode(async () => assert.rejects(async () => doctor.run(ctx), AccessAbortedError));

    assert.deepEqual(lines, []);
    assert.equal(calls.disposals, 1);
  });

  test("a check that is itself stopped ends through the cascade", async () => {

    const { AccessAbortedError } = await import("../../index.ts");
    const { calls, client } = makeFakeClient({ ...healthy,
      doorStatesError: new AccessAbortedError("The door state read was stopped by the caller's signal.") });
    const { ctx, lines } = makeCommandContext({ args: ["--json"], calls, client });

    await withExitCode(async () => assert.rejects(async () => doctor.run(ctx), AccessAbortedError));

    /* The abort surfaces from inside a check's own body, where the door-state read happens, rather than from the pre-check guard the caller's signal trips or
     * from the stream window, which swallows its own. The door-state check runs ahead of that window, so the window is never entered at all.
     */
    assert.deepEqual(lines, []);
    assert.equal(calls.disposals, 1);
  });

  test("the human report renders a verdict tag per check and a summary", async () => {

    const { calls, client } = makeFakeClient({ ...healthy, packets: [RING] });
    const { ctx, lines } = makeCommandContext({ calls, client });

    await withExitCode(async () => doctor.run(ctx));

    const report = rendered(lines);

    assert.match(report[0] ?? "", /^PASS {2}Connect and authenticate/);
    assert.match(report.at(-1) ?? "", /^\d+ passed, \d+ warnings, \d+ failed\.$/);
    assert.match(report.find((line) => line.includes("Derived state")) ?? "", /uptime 1d 1h/);
  });

  test("the doctor keeps the refresh failsafe, the one-shot convention's negative control", async () => {

    const { calls, client } = makeFakeClient({ ...healthy, packets: [] });
    const { ctx } = makeCommandContext({ args: ["--json"], calls, client });

    await withExitCode(async () => doctor.run(ctx));

    assert.equal(calls.opens[0]?.refreshIntervalMs, undefined);
  });
});

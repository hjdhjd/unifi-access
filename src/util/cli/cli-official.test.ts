/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * cli-official.test.ts: Tests for the official-consumer groups - user, visitor, logs, webhook, the api hatch, and the offline classify command. Every test runs
 * offline against the structural fake.
 */
import { CREDENTIALS_PAIR, makeCommandContext, makeFakeClient, rendered, specimen, withStderr } from "./cli.helpers.ts";
import { describe, test } from "node:test";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { CliError } from "./shared.ts";
import type { CommandSpec } from "./shared.ts";
import { Readable } from "node:stream";
import { accessEventPacketsInteractiveFixture } from "../../protocol/events.fixtures.ts";
import { api } from "./commands/api.ts";
import assert from "node:assert/strict";
import { classify } from "./commands/classify.ts";
import { logs } from "./commands/logs.ts";
import { openOfficialClient } from "./client.ts";
import path from "node:path";
import { tmpdir } from "node:os";
import { user } from "./commands/user.ts";
import { visitor } from "./commands/visitor.ts";
import { webhook } from "./commands/webhook.ts";

const RING = specimen(accessEventPacketsInteractiveFixture, "access.remote_view");
const LOG_ADD = specimen(accessEventPacketsInteractiveFixture, "access.logs.add");

// The user records the fake answers with. The full name deliberately differs from a first-plus-last join, so a resolver that re-derived the join would miss where
// the canonical member matches.
const USERS = [
  { "email": "jane@example.net", "first_name": "Jane", "full_name": "Dr. Jane Smith", "id": "user-1", "last_name": "Smith" },
  { "email": "sam@example.net", "first_name": "Sam", "full_name": "Sam Jones", "id": "user-2", "last_name": "Jones" }
];

const VISITORS = [
  { "end_time": 1755400000, "first_name": "Guest", "id": "vis-1", "last_name": "One", "start_time": 1755300000 },
  { "end_time": 1755500000, "first_name": "Guest", "id": "vis-2", "last_name": "Two", "start_time": 1755400000 }
];

describe("the user group", () => {

  const spec = { official: { users: USERS } };

  test("list renders one aligned line per user, or the records verbatim as JSON", async () => {

    const { calls, client } = makeFakeClient(spec);
    const human = makeCommandContext({ args: ["list"], calls, client });

    await user.run(human.ctx);

    assert.match(rendered(human.lines)[0] ?? "", /^ {2}Dr\. Jane Smith +user-1 {2}jane@example\.net$/);
    assert.match(rendered(human.lines)[1] ?? "", /^ {2}Sam Jones +user-2 {2}sam@example\.net$/);

    const machine = makeCommandContext({ args: [ "list", "--json" ], calls, client });

    await user.run(machine.ctx);

    assert.equal(rendered(machine.lines)[0], JSON.stringify(USERS));
  });

  test("show resolves by the canonical full name, never a re-derived join, and fetches the record", async () => {

    const { calls, client } = makeFakeClient(spec);
    const { ctx, lines } = makeCommandContext({ args: [ "show", "dr. jane smith", "--json" ], calls, client });

    await user.run(ctx);

    assert.deepEqual(calls.official.filter((call) => call.method === "users.fetch").map((call) => call.args[0]), ["user-1"]);
    assert.equal(rendered(lines)[0], JSON.stringify(USERS[0]));

    // The join "Jane Smith" names nobody: the canonical member is "Dr. Jane Smith", and resolution reads the record's own spelling.
    const joined = makeCommandContext({ args: [ "show", "Jane Smith" ], calls, client });

    await assert.rejects(async () => user.run(joined.ctx), (error: unknown) => (error instanceof CliError) && error.message.includes("Dr. Jane Smith => user-1"));
  });

  test("avatar reads the file's bytes and uploads them under the file's own name", async () => {

    const dir = await mkdtemp(path.join(tmpdir(), "ufa-avatar-"));
    const file = path.join(dir, "jane.jpg");

    await writeFile(file, Buffer.from("jpeg-bytes"));

    const { calls, client } = makeFakeClient(spec);
    const { ctx, lines } = makeCommandContext({ args: [ "avatar", "user-1", file ], calls, client });

    await user.run(ctx);

    const upload = calls.official.find((call) => call.method === "users.uploadAvatar");

    assert.equal(upload?.args[0], "user-1");
    assert.deepEqual(upload?.args[1], { data: Buffer.from("jpeg-bytes"), filename: "jane.jpg" });
    assert.match(lines.join(""), /avatar_url/, "the returned avatar record renders");
  });

  test("an unreadable avatar file is a usage error before anything connects", async () => {

    const { calls, client } = makeFakeClient(spec);
    const { ctx } = makeCommandContext({ args: [ "avatar", "user-1", "/nonexistent/path.jpg" ], calls, client });

    await assert.rejects(async () => user.run(ctx), (error: unknown) => (error instanceof CliError) && (error.exitCode === 2));

    assert.equal(calls.opens.length, 0);
  });
});

describe("the visitor group", () => {

  const spec = { official: { visitors: VISITORS } };

  test("list renders one aligned line per visitor, or the records verbatim as JSON", async () => {

    const { calls, client } = makeFakeClient(spec);
    const human = makeCommandContext({ args: ["list"], calls, client });

    await visitor.run(human.ctx);

    assert.match(rendered(human.lines)[0] ?? "", /^ {2}Guest One +vis-1 {2}2025-08-15T23:20:00\.000Z to 2025-08-17T03:06:40\.000Z$/);

    const machine = makeCommandContext({ args: [ "list", "--json" ], calls, client });

    await visitor.run(machine.ctx);

    assert.equal(rendered(machine.lines)[0], JSON.stringify(VISITORS));
  });

  test("show resolves by id, then by the joined first and last name", async () => {

    const { calls, client } = makeFakeClient(spec);
    const byId = makeCommandContext({ args: [ "show", "vis-2" ], calls, client });

    await visitor.run(byId.ctx);

    assert.deepEqual(calls.official.filter((call) => call.method === "visitors.fetch").map((call) => call.args[0]), ["vis-2"]);

    const byName = makeCommandContext({ args: [ "show", "guest one" ], calls, client });

    await visitor.run(byName.ctx);

    assert.deepEqual(calls.official.filter((call) => call.method === "visitors.fetch").map((call) => call.args[0]), [ "vis-2", "vis-1" ]);
  });
});

describe("the logs group", () => {

  const HITS = [
    { "@timestamp": "2026-08-16T01:23:45Z", "_id": "hit-1", "_source": { "actor": { "display_name": "Jane" }, "event": { "type": "access.door.unlock" } },
      "tag": "" }
  ];

  test("search requires a topic and validates it against the vocabulary", async () => {

    const { calls, client } = makeFakeClient({ official: { hits: HITS } });
    const missing = makeCommandContext({ args: ["search"], calls, client });

    await assert.rejects(async () => logs.run(missing.ctx), (error: unknown) => (error instanceof CliError) && (error.exitCode === 2));

    const unknown = makeCommandContext({ args: [ "search", "--topic", "gossip" ], calls, client });

    await assert.rejects(async () => logs.run(unknown.ctx),
      (error: unknown) => (error instanceof CliError) && (error.exitCode === 2) && error.message.includes("door_openings"));

    assert.equal(calls.opens.length, 0);
  });

  test("search converts both accepted time forms to epoch seconds at the boundary", async () => {

    const { calls, client } = makeFakeClient({ official: { hits: HITS } });
    const iso = makeCommandContext({ args: [ "search", "--topic", "critical", "--since", "2026-08-01T00:00:00Z", "--until", "1755300000" ], calls, client });

    await logs.run(iso.ctx);

    const fetched = calls.official.find((call) => call.method === "logs.fetch");

    assert.deepEqual(fetched?.args[0], { since: Date.parse("2026-08-01T00:00:00Z") / 1000, topic: "critical", until: 1755300000 });
  });

  test("an unparseable time names both accepted forms", async () => {

    const { calls, client } = makeFakeClient({ official: { hits: HITS } });
    const { ctx } = makeCommandContext({ args: [ "search", "--topic", "critical", "--since", "yesterday-ish" ], calls, client });

    await assert.rejects(async () => logs.run(ctx),
      (error: unknown) => (error instanceof CliError) && (error.exitCode === 2) && error.message.includes("ISO 8601") && error.message.includes("epoch"));

    assert.equal(calls.opens.length, 0);
  });

  test("search renders one line per hit, or the hits verbatim as JSON", async () => {

    const { calls, client } = makeFakeClient({ official: { hits: HITS } });
    const human = makeCommandContext({ args: [ "search", "--topic", "door_openings" ], calls, client });

    await logs.run(human.ctx);

    assert.deepEqual(rendered(human.lines), ["2026-08-16T01:23:45Z  Jane  access.door.unlock"]);

    const machine = makeCommandContext({ args: [ "search", "--topic", "door_openings", "--json" ], calls, client });

    await logs.run(machine.ctx);

    assert.equal(rendered(machine.lines)[0], JSON.stringify(HITS));
  });

  test("export requires the whole window", async () => {

    for(const args of [ [ "export", "--since", "1", "--until", "2" ], [ "export", "--topic", "critical", "--until", "2" ],
      [ "export", "--topic", "critical", "--since", "1" ] ]) {

      const { calls, client } = makeFakeClient({ official: {} });
      const { ctx } = makeCommandContext({ args, calls, client });

      // Sequential by intent: each missing flag is asserted on its own invocation.
      // eslint-disable-next-line no-await-in-loop
      await assert.rejects(async () => logs.run(ctx), (error: unknown) => (error instanceof CliError) && (error.exitCode === 2), args.join(" "));

      assert.equal(calls.opens.length, 0, args.join(" "));
    }
  });

  test("export always sends a timezone - the host's own zone unless overridden - and writes the bytes to the sink", async () => {

    const dir = await mkdtemp(path.join(tmpdir(), "ufa-export-"));
    const file = path.join(dir, "log.csv");
    const { calls, client } = makeFakeClient({ official: { exportBytes: Buffer.from("csv-bytes") } });
    const defaulted = makeCommandContext({ args: [ "export", "--topic", "critical", "--since", "1", "--until", "2", "--out", file ], calls, client });

    await logs.run(defaulted.ctx);

    const first = calls.official.find((call) => call.method === "logs.export");

    assert.deepEqual(first?.args[0], { since: 1, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, topic: "critical", until: 2 });
    assert.equal(await readFile(file, "utf8"), "csv-bytes");

    const overridden = makeCommandContext({ args: [ "export", "--topic", "critical", "--since", "1", "--until", "2", "--out", file, "--timezone",
      "America/New_York" ], calls, client });

    await logs.run(overridden.ctx);

    const second = calls.official.filter((call) => call.method === "logs.export")[1];

    assert.equal((second?.args[0] as { timezone: string }).timezone, "America/New_York");
  });
});

describe("the webhook group", () => {

  const ENDPOINTS = [
    { "endpoint": "https://example.net/hook", "events": ["access.door.unlock"], "id": "wh-1", "name": "alerts", "secret": "durable-secret" }
  ];

  test("list renders the endpoints, secrets included", async () => {

    const { calls, client } = makeFakeClient({ official: { webhookEndpoints: ENDPOINTS } });
    const { ctx, lines } = makeCommandContext({ args: [ "list", "--json" ], calls, client });

    await webhook.run(ctx);

    assert.equal(rendered(lines)[0], JSON.stringify(ENDPOINTS));
    assert.match(rendered(lines)[0] ?? "", /durable-secret/, "the durable secret renders from the list read");
  });

  test("add requires events, composes the wire's write shape, and renders the created record with its minted secret", async () => {

    const { calls, client } = makeFakeClient({ official: {} });
    const missing = makeCommandContext({ args: [ "add", "alerts", "https://example.net/hook" ], calls, client });

    await assert.rejects(async () => webhook.run(missing.ctx), (error: unknown) => (error instanceof CliError) && (error.exitCode === 2));

    const { ctx, lines } = makeCommandContext({ args: [ "add", "alerts", "https://example.net/hook", "--events", "access.door.unlock,access.door.close",
      "--header", "Authorization:Bearer t0ken" ], calls, client });

    await webhook.run(ctx);

    const created = calls.official.find((call) => call.method === "webhooks.createEndpoint");

    assert.deepEqual(created?.args[0], { endpoint: "https://example.net/hook", events: [ "access.door.unlock", "access.door.close" ],
      headers: { "Authorization": "Bearer t0ken" }, name: "alerts" });
    assert.match(lines.join(""), /minted-secret/, "the controller-minted secret renders from the created record");
  });

  test("a header without both halves is refused", async () => {

    const { calls, client } = makeFakeClient({ official: {} });
    const { ctx } = makeCommandContext({ args: [ "add", "alerts", "https://example.net/hook", "--events", "a", "--header", "no-colon" ], calls, client });

    await assert.rejects(async () => webhook.run(ctx), (error: unknown) => (error instanceof CliError) && (error.exitCode === 2));

    assert.equal(calls.opens.length, 0);
  });

  test("remove resolves by id or name against the fetched list and unregisters", async () => {

    const { calls, client } = makeFakeClient({ official: { webhookEndpoints: ENDPOINTS } });
    const { ctx, lines } = makeCommandContext({ args: [ "remove", "alerts" ], calls, client });

    await webhook.run(ctx);

    assert.deepEqual(calls.official.filter((call) => call.method === "webhooks.deleteEndpoint").map((call) => call.args[0]), ["wh-1"]);
    assert.match(rendered(lines)[0] ?? "", /alerts \(wh-1\) - removed\./);
  });
});

describe("the api hatch", () => {

  test("a get rides the request arm and renders the payload as wire-order JSON", async () => {

    const { calls, client } = makeFakeClient({ official: { requestResult: { data: [{ "id": "od-1" }] } } });
    const { ctx, lines } = makeCommandContext({ args: [ "get", "/doors" ], calls, client });

    await api.run(ctx);

    assert.deepEqual(calls.official.filter((call) => call.method === "request").map((call) => call.args[0]), ["/doors"]);
    assert.equal(rendered(lines)[0], JSON.stringify([{ "id": "od-1" }]));
  });

  test("a paginating get renders the payload and its pagination together", async () => {

    const { calls, client } = makeFakeClient({ official: { requestResult: { data: [], pagination: { "page_num": 1, "page_size": 25, "total": 0 } } } });
    const { ctx, lines } = makeCommandContext({ args: [ "get", "/users" ], calls, client });

    await api.run(ctx);

    assert.equal(rendered(lines)[0], JSON.stringify({ data: [], pagination: { "page_num": 1, "page_size": 25, "total": 0 } }));
  });

  test("a get with --out rides the download arm to the byte sink", async () => {

    const dir = await mkdtemp(path.join(tmpdir(), "ufa-download-"));
    const file = path.join(dir, "avatar.jpg");
    const { calls, client } = makeFakeClient({ official: { downloadBytes: Buffer.from("jpeg") } });
    const { ctx } = makeCommandContext({ args: [ "get", "/system/static/avatar/a", "--out", file ], calls, client });

    await api.run(ctx);

    assert.deepEqual(calls.official.map((call) => call.method), ["download"]);
    assert.equal(await readFile(file, "utf8"), "jpeg");
  });

  test("a mutation rides the command arm, confirms on stderr, and prints nothing to stdout", async () => {

    const { calls, client } = makeFakeClient({ official: {} });
    const { ctx, lines } = makeCommandContext({ args: [ "put", "/doors/od-1/unlock" ], calls, client });

    const stderr = await withStderr(async () => api.run(ctx));

    assert.deepEqual(calls.official.map((call) => call.method), ["command"]);
    assert.deepEqual(calls.official[0]?.args, [ "/doors/od-1/unlock", { method: "PUT", signal: ctx.signal } ]);
    assert.deepEqual(rendered(lines), []);
    assert.match(stderr.text, /The PUT request to \/doors\/od-1\/unlock succeeded\./);
  });

  test("a mutation with a body sends it, and --print rides the request arm instead", async () => {

    const { calls, client } = makeFakeClient({ official: { requestResult: { data: { "id": "vis-1" } } } });
    const { ctx, lines } = makeCommandContext({ args: [ "post", "/visitors", "--json", "{\"first_name\": \"Guest\"}", "--print" ], calls, client });

    await api.run(ctx);

    assert.deepEqual(calls.official.map((call) => call.method), ["request"]);
    assert.deepEqual(calls.official[0]?.args, [ "/visitors", { json: { "first_name": "Guest" }, method: "POST", signal: ctx.signal } ]);
    assert.equal(rendered(lines)[0], JSON.stringify({ "id": "vis-1" }));
  });

  test("the flag and path refusals happen before anything connects", async () => {

    const cases: string[][] = [ [ "get", "doors" ], [ "fetch", "/doors" ], [ "get", "/doors", "--json", "{}" ], [ "get", "/doors", "--print" ],
      [ "put", "/doors", "--out", "f" ], [ "put", "/doors", "--json", "{nope" ] ];

    for(const args of cases) {

      const { calls, client } = makeFakeClient({ official: {} });
      const { ctx } = makeCommandContext({ args, calls, client });

      // Sequential by intent: each refusal is asserted on its own invocation.
      // eslint-disable-next-line no-await-in-loop
      await assert.rejects(async () => api.run(ctx), (error: unknown) => (error instanceof CliError) && (error.exitCode === 2), args.join(" "));

      assert.equal(calls.opens.length, 0, args.join(" "));
    }
  });
});

describe("the official surface refusals", () => {

  // Every official-consumer group refuses a credential-only identity the same way, before anything connects, and every one honors the connected client's own
  // folded-capability verdict - the two layers of the one gate.
  const commands: [ string, CommandSpec, string[] ][] = [
    [ "user", user, ["list"] ],
    [ "visitor", visitor, ["list"] ],
    [ "logs", logs, [ "search", "--topic", "critical" ] ],
    [ "webhook", webhook, ["list"] ],
    [ "api", api, [ "get", "/doors" ] ]
  ];

  test("a credential-only identity is refused before anything connects", async () => {

    for(const [ name, spec, args ] of commands) {

      const { calls, client } = makeFakeClient({ official: {} });
      const { ctx } = makeCommandContext({ args, calls, client, credentials: CREDENTIALS_PAIR });

      // Sequential by intent: each group is asserted on its own invocation.
      // eslint-disable-next-line no-await-in-loop
      await assert.rejects(async () => spec.run(ctx), (error: unknown) => (error instanceof CliError) && error.message.includes("official API"), name);

      assert.equal(calls.opens.length, 0, name);
    }
  });

  test("a dual client whose official capability folded away gets the calm post-connect refusal", async () => {

    for(const [ name, spec, args ] of commands) {

      const { calls, client } = makeFakeClient({ capabilities: { mode: "dual", official: false, override: "auto" } });
      const { ctx } = makeCommandContext({ args, calls, client });

      // Sequential by intent: each group is asserted on its own invocation.
      // eslint-disable-next-line no-await-in-loop
      await assert.rejects(async () => spec.run(ctx), (error: unknown) => (error instanceof CliError) && error.message.includes("official API"), name);

      assert.equal(calls.opens.length, 1, name + " connects before the runtime verdict refuses");
    }
  });
});

describe("the classify command", () => {

  // Run classify over an input file and return the emitted NDJSON lines.
  async function runClassify(text: string, args: string[] = []): Promise<string[]> {

    const dir = await mkdtemp(path.join(tmpdir(), "ufa-classify-"));
    const file = path.join(dir, "capture.ndjson");

    await writeFile(file, text);

    const { ctx, lines } = makeCommandContext({ args: [ ...args, file ] });

    await classify.run(ctx);

    return rendered(lines);
  }

  test("a whole-document object is one packet and an array is a packet list, pretty-printed included", async () => {

    const single = await runClassify(JSON.stringify(RING, null, 2));

    assert.equal(single.length, 1);
    assert.equal((JSON.parse(single[0] ?? "{}") as { kind: string }).kind, "doorbellRing");
    assert.equal((JSON.parse(single[0] ?? "{}") as { event: string }).event, "access.remote_view");

    const list = await runClassify(JSON.stringify([ RING, LOG_ADD ], null, 2));

    assert.equal(list.length, 2);
  });

  test("NDJSON input classifies line by line, skipping the trailing blank the sibling commands emit", async () => {

    const lines = await runClassify(JSON.stringify(RING) + "\n" + JSON.stringify(LOG_ADD) + "\n");

    assert.equal(lines.length, 2);
    assert.equal((JSON.parse(lines[0] ?? "{}") as { kind: string }).kind, "doorbellRing");
  });

  test("an unmodeled packet reports a null kind with its wire name intact", async () => {

    const lines = await runClassify(JSON.stringify(LOG_ADD) + "\n" + JSON.stringify(RING) + "\n");
    const first = JSON.parse(lines[0] ?? "{}") as { classified: unknown; event: string; kind: unknown };

    assert.equal(first.event, "access.logs.add");
    assert.equal(first.kind, null);
    assert.equal(first.classified, null);
  });

  test("a value that is not a packet reports as such rather than dying", async () => {

    const lines = await runClassify("{\"hello\": 1}\n" + JSON.stringify(RING) + "\n");
    const first = JSON.parse(lines[0] ?? "{}") as { classified: unknown; event: unknown; kind: unknown };

    assert.equal(first.event, null);
    assert.equal(first.kind, null);
    assert.equal(lines.length, 2, "the run continues past the non-packet value");
  });

  test("a non-JSON line is a usage error naming the line number", async () => {

    await assert.rejects(async () => runClassify(JSON.stringify(RING) + "\n{nope\n"),
      (error: unknown) => (error instanceof CliError) && (error.exitCode === 2) && error.message.includes("Line 2"));
  });

  test("stdin serves as the input when no file is named", async () => {

    const descriptor = Object.getOwnPropertyDescriptor(process, "stdin");

    Object.defineProperty(process, "stdin", { configurable: true, value: Readable.from([Buffer.from(JSON.stringify(RING) + "\n")]) });

    try {

      const { ctx, lines } = makeCommandContext({ args: [] });

      await classify.run(ctx);

      assert.equal((JSON.parse(rendered(lines)[0] ?? "{}") as { kind: string }).kind, "doorbellRing");
    } finally {

      if(descriptor !== undefined) {

        Object.defineProperty(process, "stdin", descriptor);
      }
    }
  });
});

describe("the official-consumer connect chokepoint", () => {

  test("openOfficialClient loads the identity once, gates it, and connects with the refresh failsafe off", async () => {

    const { calls, client } = makeFakeClient({});
    const { ctx } = makeCommandContext({ args: [], calls, client });

    // Every official-consumer group (user, visitor, logs, webhook, the api hatch) rides this one opener, so the one-shot convention is proven here at the chokepoint
    // rather than restated per group.
    await using opened = await openOfficialClient(ctx, "chokepoint probe");

    assert.equal(opened, client);
    assert.equal(calls.opens.length, 1);
    assert.equal(calls.opens[0]?.refreshIntervalMs, false);
    assert.notEqual(calls.opens[0]?.credentials, undefined, "the pre-loaded identity threads into the connect");
  });
});

describe("the capture scrub across the official groups", () => {

  /* One identity fixture, planted across every official document these groups print. The assertions below are about whether the flag reached each output path -
   * the aligned listings above all, which never touch the whole-document renderer and would be silently unscrubbed under a design that wrapped it.
   */
  const SCRUB_USERS = [
    { "email": "jane@acme.example", "employee_number": "EMP-004291", "full_name": "Dr. Jane Smith", "id": "user-1", "phone": "+1 617 555 8899" }
  ];

  const SCRUB_VISITORS = [
    { "end_time": 1755400000, "first_name": "Mallory", "id": "vis-1", "last_name": "Vance", "start_time": 1755300000, "visitor_company": "Beta Logistics" }
  ];

  const SCRUB_HITS = [
    { "@timestamp": "2026-08-16T01:23:45Z", "_id": "hit-1",
      "_source": { "actor": { "display_name": "Dr. Jane Smith" }, "event": { "type": "access.door.unlock" } } }
  ];

  const SCRUB_ENDPOINTS = [
    { "endpoint": "https://hooks.acme.example/access", "events": ["access.door.unlock"], "headers": { "Authorization": "Bearer receiver-t0ken" }, "id": "wh-1",
      "name": "Acme Alerts", "secret": "durable-secret-9f2ac1" }
  ];

  const PLANTED = [ "+1 617 555 8899", "Acme Alerts", "Beta Logistics", "Dr. Jane Smith", "EMP-004291", "Mallory", "Vance", "durable-secret-9f2ac1",
    "hooks.acme.example", "jane@acme.example", "receiver-t0ken" ];

  // Every value the fixtures plant, absent from what a command wrote.
  function assertNothingPlantedSurvives(lines: string[], label: string): void {

    const text = lines.join("");

    for(const value of PLANTED) {

      assert.ok(!text.includes(value), label + " carries no \"" + value + "\"");
    }
  }

  // Run one command's arguments against a fresh fake and answer what it wrote.
  async function run(command: CommandSpec, args: string[], official: Record<string, unknown>): Promise<string[]> {

    const { calls, client } = makeFakeClient({ official });
    const { ctx, lines } = makeCommandContext({ args, calls, client });

    await command.run(ctx);

    return lines;
  }

  test("the user group scrubs the aligned listing, the JSON listing, and one record alike", async () => {

    const official = { users: SCRUB_USERS };

    assert.ok((await run(user, ["list"], official)).join("").includes("Dr. Jane Smith"), "without the flag the listing prints the record as it stands");

    assertNothingPlantedSurvives(await run(user, [ "list", "--scrub" ], official), "user list");
    assertNothingPlantedSurvives(await run(user, [ "list", "--json", "--scrub" ], official), "user list --json");
    assertNothingPlantedSurvives(await run(user, [ "show", "user-1", "--json", "--scrub" ], official), "user show");
    assert.match((await run(user, [ "list", "--scrub" ], official)).join(""), /Test Name \d+/, "the listing still reads as a list of people");
  });

  test("an avatar upload scrubs the record the controller answers with", async () => {

    // The avatar path names the person it belongs to, so the record a successful upload prints is a document like any other.
    const dir = await mkdtemp(path.join(tmpdir(), "ufa-scrub-avatar-"));
    const file = path.join(dir, "jane.jpg");

    await writeFile(file, Buffer.from("jpeg-bytes"));

    const printed = await run(user, [ "avatar", "user-1", file, "--scrub" ], { avatar: { "avatar_url": "/avatars/jane-smith-9f2ac1.jpg" }, users: SCRUB_USERS });

    assert.ok(!printed.join("").includes("jane-smith"), "the path that names the person does not survive");
    assert.match(printed.join(""), /avatar_url/, "the record still renders");
  });

  test("the visitor group scrubs the aligned listing, the JSON listing, and one record alike", async () => {

    const official = { visitors: SCRUB_VISITORS };

    assert.ok((await run(visitor, ["list"], official)).join("").includes("Mallory"), "without the flag the listing prints the record as it stands");

    assertNothingPlantedSurvives(await run(visitor, [ "list", "--scrub" ], official), "visitor list");
    assertNothingPlantedSurvives(await run(visitor, [ "list", "--json", "--scrub" ], official), "visitor list --json");
    assertNothingPlantedSurvives(await run(visitor, [ "show", "vis-1", "--json", "--scrub" ], official), "visitor show");
  });

  test("the logs search scrubs the per-hit lines and the JSON hits alike", async () => {

    const official = { hits: SCRUB_HITS };
    const plain = await run(logs, [ "search", "--topic", "door_openings" ], official);

    assert.deepEqual(rendered(plain), ["2026-08-16T01:23:45Z  Dr. Jane Smith  access.door.unlock"]);

    const human = await run(logs, [ "search", "--topic", "door_openings", "--scrub" ], official);

    assertNothingPlantedSurvives(human, "logs search");
    assertNothingPlantedSurvives(await run(logs, [ "search", "--topic", "door_openings", "--json", "--scrub" ], official), "logs search --json");
    assert.match(rendered(human)[0] ?? "", /^2026-08-16T01:23:45Z {2}Test Name \d+ {2}access\.door\.unlock$/, "the timestamp and the event name are evidence");
  });

  test("the webhook group clears the secret and the caller-defined headers", async () => {

    // The delivery headers are the case no key catalog could ever anticipate: their names are chosen by whoever registered the endpoint, and their values are the
    // receiver's own credentials.
    const official = { webhookEndpoints: SCRUB_ENDPOINTS };

    assert.ok((await run(webhook, [ "list", "--json" ], official)).join("").includes("durable-secret-9f2ac1"), "without the flag the secret renders");

    const listed = await run(webhook, [ "list", "--json", "--scrub" ], official);

    assertNothingPlantedSurvives(listed, "webhook list --json");
    assertNothingPlantedSurvives(await run(webhook, [ "list", "--scrub" ], official), "webhook list");
    assert.ok((rendered(listed)[0] ?? "").includes("\"Authorization\""), "the header names survive, so the shape of the registration is still readable");
    assert.ok((rendered(listed)[0] ?? "").includes("access.door.unlock"), "the event names are protocol vocabulary and survive");

    const created = await run(webhook, [ "add", "Acme Alerts", "https://hooks.acme.example/access", "--events", "access.door.unlock", "--header",
      "Authorization:Bearer receiver-t0ken", "--json", "--scrub" ], { createdEndpoint: SCRUB_ENDPOINTS[0] });

    assertNothingPlantedSurvives(created, "webhook add");
  });

  test("the api hatch scrubs the payload it prints, on a get and on a printed mutation", async () => {

    const official = { requestResult: { data: SCRUB_USERS, pagination: { "page_num": 1, "total": 1 } } };
    const got = await run(api, [ "get", "/users", "--scrub" ], official);

    assertNothingPlantedSurvives(got, "api get");
    assert.ok((rendered(got)[0] ?? "").includes("\"pagination\""), "the pagination still rides beside the payload");
    assertNothingPlantedSurvives(await run(api, [ "post", "/users", "--print", "--scrub" ], official), "api post --print");
  });

  test("the api hatch clears a bare scalar document, which no key catalog could reach", async () => {

    // The credential-minting endpoints answer a bare string. There is no key to read, so the module's own entry point clears it - and the command needs no special
    // case for the shape.
    const printed = await run(api, [ "post", "/credentials/pin_codes", "--print", "--scrub" ], { requestResult: { data: "482913" } });

    assert.equal(rendered(printed)[0]?.includes("482913"), false, "the minted credential does not survive");
    assert.match(rendered(printed)[0] ?? "", /^"REDACTED-[0-9a-f]{8}-"$/, "the envelope shape - a bare scalar - is what a capture of that endpoint is for");
  });

  test("the api hatch refuses the flag where no document is printed", async () => {

    // Both combinations mean nothing rather than something surprising, so each is a stated usage error before anything connects.
    const cases: string[][] = [ [ "get", "/doors", "--scrub", "--out", "f" ], [ "put", "/doors/od-1/unlock", "--scrub" ] ];

    for(const args of cases) {

      const { calls, client } = makeFakeClient({ official: {} });
      const { ctx } = makeCommandContext({ args, calls, client });

      // Sequential by intent: each refusal is asserted on its own invocation.
      // eslint-disable-next-line no-await-in-loop
      await assert.rejects(async () => api.run(ctx), (error: unknown) => (error instanceof CliError) && (error.exitCode === 2), args.join(" "));

      assert.equal(calls.opens.length, 0, args.join(" "));
    }
  });
});

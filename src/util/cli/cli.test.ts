/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * cli.test.ts: Tests for the ufa CLI's core - the command surface, the shared infrastructure, credential loading, the surface gates, the read commands, the output
 * layer, and the entry point's error cascade.
 *
 * Every test here runs offline. Commands reach the controller only through the injected hooks, so a structural fake stands in for a connected client and the
 * assertions are about what each command reads, writes, and commands - never about a live controller.
 *
 * One path is deliberately untested and named here rather than left as a silent gap: the entry point's EPIPE handler calls `process.exit(0)` from a stream error
 * listener, which cannot be exercised in-process without ending the test run itself. It is a handful of lines with no branching beyond the errno check, and the
 * donor's suite leaves it unexercised for the same reason.
 */
import { CREDENTIALS_PAIR, CREDENTIALS_TOKEN, makeCommandContext, makeFakeClient, rendered, withExitCode, withStderr } from "./cli.helpers.ts";
import { CliError, groupCommand, isHelpToken, isMember, parseDuration, parseWholeMinutes, writeByteSink } from "./shared.ts";
import type { CommandContext, CommandSpec } from "./shared.ts";
import { accessBootstrap2026Fixture, accessControllerInfoFixture } from "../../protocol/topology.fixtures.ts";
import { describe, test } from "node:test";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { openClient, requireOfficial, requireSurface } from "./client.ts";
import { Output } from "./output/format.ts";
import { api } from "./commands/api.ts";
import assert from "node:assert/strict";
import { bootstrap } from "./commands/bootstrap.ts";
import { classify } from "./commands/classify.ts";
import { device } from "./commands/device.ts";
import { doctor } from "./commands/doctor.ts";
import { door } from "./commands/door.ts";
import { info } from "./commands/info.ts";
import { loadCredentials } from "./credentials.ts";
import { logs } from "./commands/logs.ts";
import path from "node:path";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { user } from "./commands/user.ts";
import { visitor } from "./commands/visitor.ts";
import { watch } from "./commands/watch.ts";
import { webhook } from "./commands/webhook.ts";

// The command table's twelve names, pinned as a literal expected array rather than derived from the COMMANDS object it checks - a pin derived from its own subject
// would be vacuous against an accidental removal.
const COMMAND_NAMES = [ "api", "bootstrap", "classify", "device", "doctor", "door", "info", "logs", "user", "visitor", "watch", "webhook" ];

// The command table as this suite reaches it, one spec per pinned name.
const COMMAND_TABLE: [ string, CommandSpec ][] = [ [ "api", api ], [ "bootstrap", bootstrap ], [ "classify", classify ], [ "device", device ],
  [ "doctor", doctor ], [ "door", door ], [ "info", info ], [ "logs", logs ], [ "user", user ], [ "visitor", visitor ], [ "watch", watch ],
  [ "webhook", webhook ] ];

// Every group's subcommands, for the help-paths table: each renders its usage offline, with both injected hooks throwing if touched.
const GROUP_LEAVES: [ string, CommandSpec, string[] ][] = [
  [ "device", device, [ "restart", "settings", "update" ] ],
  [ "door", door, [ "close", "emergency", "lock-rule", "unlock" ] ],
  [ "logs", logs, [ "export", "search" ] ],
  [ "user", user, [ "avatar", "list", "show" ] ],
  [ "visitor", visitor, [ "list", "show" ] ],
  [ "watch", watch, [ "events", "raw", "state" ] ],
  [ "webhook", webhook, [ "add", "list", "remove" ] ]
];

// A context whose hooks throw if touched: the proof that a help path neither loads credentials nor opens a client.
function offlineContext(args: string[]): { ctx: CommandContext; lines: string[] } {

  return makeCommandContext({ args, loadCredentials: (): never => {

    throw new Error("A help path must never load credentials.");
  }, openClient: (): never => {

    throw new Error("A help path must never open a client.");
  } });
}

describe("the command surface", () => {

  test("every command renders help offline", async () => {

    for(const [ name, spec ] of COMMAND_TABLE) {

      const { ctx, lines } = offlineContext(["-h"]);

      // Sequential by intent: each command's help is asserted against its own context.
      // eslint-disable-next-line no-await-in-loop
      await spec.run(ctx);

      assert.match(rendered(lines)[0] ?? "", new RegExp("^Usage: ufa " + name), name + " renders its usage first");
    }
  });

  test("every group leaf renders help offline", async () => {

    for(const [ group, spec, leaves ] of GROUP_LEAVES) {

      for(const leaf of leaves) {

        const { ctx, lines } = offlineContext([ leaf, "--help" ]);

        // Sequential by intent: each leaf's help is asserted against its own context.
        // eslint-disable-next-line no-await-in-loop
        await spec.run(ctx);

        assert.match(rendered(lines)[0] ?? "", new RegExp("^Usage: ufa " + group + " " + leaf), group + " " + leaf + " renders its usage first");
      }
    }
  });

  test("every group's usage screen lists each subcommand from its own table", async () => {

    for(const [ group, spec, leaves ] of GROUP_LEAVES) {

      const { ctx, lines } = offlineContext([]);

      // Sequential by intent: each group's usage is asserted against its own context.
      // eslint-disable-next-line no-await-in-loop
      await spec.run(ctx);

      const text = lines.join("");

      // The screen derives from the same table that dispatches, so every dispatchable subcommand is listed beside its summary.
      for(const leaf of leaves) {

        assert.match(text, new RegExp("\\n {2}" + leaf + " +\\S"), group + " lists " + leaf);
      }
    }
  });

  test("an unknown flag is a parse error the entry point renders as a usage error", async () => {

    const { ctx } = offlineContext(["--nope"]);

    await assert.rejects(async () => info.run(ctx), (error: NodeJS.ErrnoException) => error.code === "ERR_PARSE_ARGS_UNKNOWN_OPTION");
  });
});

describe("the group dispatcher", () => {

  const alpha: CommandSpec = { run: async (ctx): Promise<void> => {

    ctx.output.line("alpha ran with " + ctx.args.join(","));

    return Promise.resolve();
  }, summary: "The alpha leaf." };
  const beta: CommandSpec = { run: async () => Promise.resolve(), summary: "The beta leaf." };
  const group = groupCommand({ commands: { alpha, beta }, group: "sample", summary: "A sample group.", usage: "Usage: ufa sample <subcommand>" });

  test("every help token prints the group usage without dispatching", async () => {

    for(const args of [ [], ["help"], ["--help"], ["-h"] ]) {

      const { ctx, lines } = makeCommandContext({ args });

      // Sequential by intent: each help spelling is asserted against its own context.
      // eslint-disable-next-line no-await-in-loop
      await group.run(ctx);

      assert.deepEqual(rendered(lines), ["Usage: ufa sample <subcommand>"], args.join(" "));
    }
  });

  test("an unknown subcommand is a usage error naming the valid set derived from the table", async () => {

    const { ctx } = makeCommandContext({ args: ["gamma"] });

    await assert.rejects(async () => group.run(ctx),
      (error: unknown) => (error instanceof CliError) && (error.exitCode === 2) && error.message.includes("alpha, beta"));
  });

  test("a known subcommand dispatches with the remaining arguments and the same context", async () => {

    const { ctx, lines } = makeCommandContext({ args: [ "alpha", "--x", "y" ] });

    await group.run(ctx);

    assert.deepEqual(rendered(lines), ["alpha ran with --x,y"]);
  });

  test("the group's summary is the one the composer was given", () => {

    assert.equal(group.summary, "A sample group.");
  });
});

describe("the duration grammar", () => {

  test("each unit converts to milliseconds", () => {

    const table: [ string, number ][] = [ [ "500ms", 500 ], [ "30s", 30000 ], [ "5m", 300000 ], [ "1h", 3600000 ], [ "1500ms", 1500 ], [ "90m", 5400000 ] ];

    for(const [ value, expected ] of table) {

      assert.equal(parseDuration(value, "--duration"), expected, value);
    }
  });

  test("a bare number, an unknown unit, a fraction, and a compound form are refused", () => {

    for(const value of [ "30", "5x", "1.5s", "-5s", "1h30m", "soon", "" ]) {

      assert.throws(() => parseDuration(value, "--duration"), (error: unknown) => (error instanceof CliError) && (error.exitCode === 2), value);
    }
  });

  test("a zero magnitude is refused inside the parser, whatever the unit", () => {

    for(const value of [ "0s", "0ms", "0m", "0h" ]) {

      assert.throws(() => parseDuration(value, "--duration"), (error: unknown) => (error instanceof CliError) && (error.exitCode === 2), value);
    }
  });

  test("whole minutes convert across units and refuse everything between", () => {

    const accepted: [ string, number ][] = [ [ "5m", 5 ], [ "1h", 60 ], [ "60s", 1 ], [ "60000ms", 1 ], [ "120s", 2 ] ];

    for(const [ value, expected ] of accepted) {

      assert.equal(parseWholeMinutes(value, "--duration"), expected, value);
    }

    for(const value of [ "90s", "59s", "61s", "30s", "500ms" ]) {

      assert.throws(() => parseWholeMinutes(value, "--duration"),
        (error: unknown) => (error instanceof CliError) && (error.exitCode === 2) && error.message.includes("whole-minute"), value);
    }
  });
});

describe("the shared predicates", () => {

  test("the help-token predicate admits exactly the help spellings", () => {

    for(const token of [ undefined, "help", "--help", "-h" ]) {

      assert.equal(isHelpToken(token), true, String(token));
    }

    for(const token of [ "unlock", "-help", "h", "" ]) {

      assert.equal(isHelpToken(token), false, token);
    }
  });

  test("the vocabulary membership check admits members and declines the rest", () => {

    const list = [ "alpha", "beta" ] as const;

    assert.equal(isMember(list, "alpha"), true);
    assert.equal(isMember(list, "gamma"), false);
    assert.equal(isMember(list, ""), false);
  });

  test("take yields nothing for a non-positive count, which is why its callers guard", async () => {

    const { take } = await import("./shared.ts");

    async function *source(): AsyncGenerator<number> {

      yield 1;
      yield 2;
    }

    const taken: number[] = [];

    for await (const value of take(source(), 0)) {

      taken.push(value);
    }

    assert.deepEqual(taken, [], "a zero count yields nothing, so a zero that means no bound must never reach it");

    const bounded: number[] = [];

    for await (const value of take(source(), 1)) {

      bounded.push(value);
    }

    assert.deepEqual(bounded, [1]);
  });
});

describe("credential loading", () => {

  test("the working directory wins over the home directory and the identity composes as a credential pair", async () => {

    const cwd = await mkdtemp(path.join(tmpdir(), "ufa-cwd-"));
    const home = await mkdtemp(path.join(tmpdir(), "ufa-home-"));

    await writeFile(path.join(cwd, "ufa.json"), JSON.stringify({ controller: "https://10.0.0.1:8443/path", password: "p", username: "u" }));
    await writeFile(path.join(home, ".ufa.json"), JSON.stringify({ controller: "10.0.0.2", password: "p2", username: "u2" }));

    const credentials = await loadCredentials({ cwd, home });

    // The address is normalized to the bare host the connect path wants: the scheme and any path are dropped, and a port that is not the scheme's default is kept.
    assert.deepEqual(credentials, { host: "10.0.0.1:8443", identity: { password: "p", username: "u" } });
  });

  test("the home directory is the fallback", async () => {

    const cwd = await mkdtemp(path.join(tmpdir(), "ufa-cwd-"));
    const home = await mkdtemp(path.join(tmpdir(), "ufa-home-"));

    await writeFile(path.join(home, ".ufa.json"), JSON.stringify({ controller: "10.0.0.2", password: "p2", username: "u2" }));

    assert.equal((await loadCredentials({ cwd, home })).host, "10.0.0.2");
  });

  test("a token-only file composes the token identity", async () => {

    const cwd = await mkdtemp(path.join(tmpdir(), "ufa-token-"));

    // The file qualifies the token by the application that issued it; the library's identity takes the bare token. The translation is the loader's, which is what
    // this asserts on both sides of the arrow.
    await writeFile(path.join(cwd, "ufa.json"), JSON.stringify({ controller: "10.0.0.1", tokens: { access: "t" } }));

    assert.deepEqual(await loadCredentials({ cwd, home: cwd }), { host: "10.0.0.1", identity: { token: "t" } });
  });

  test("a file carrying both identities composes the dual identity", async () => {

    const cwd = await mkdtemp(path.join(tmpdir(), "ufa-dual-"));

    await writeFile(path.join(cwd, "ufa.json"), JSON.stringify({ controller: "10.0.0.1", password: "p", tokens: { access: "t" }, username: "u" }));

    assert.deepEqual(await loadCredentials({ cwd, home: cwd }), { host: "10.0.0.1", identity: { password: "p", token: "t", username: "u" } });
  });

  test("no configuration at all names both locations and the identity forms", async () => {

    const empty = await mkdtemp(path.join(tmpdir(), "ufa-none-"));

    await assert.rejects(async () => loadCredentials({ cwd: empty, home: empty }),
      (error: unknown) => (error instanceof CliError) && error.message.includes("./ufa.json or ~/.ufa.json") && error.message.includes("\"tokens.access\""));
  });

  test("a present but malformed configuration is a hard error", async () => {

    const cwd = await mkdtemp(path.join(tmpdir(), "ufa-bad-"));

    await writeFile(path.join(cwd, "ufa.json"), "{not json");

    await assert.rejects(async () => loadCredentials({ cwd, home: cwd }),
      (error: unknown) => (error instanceof CliError) && error.message.includes("not valid JSON"));
  });

  test("a configuration that is valid JSON but not an object is refused", async () => {

    const cwd = await mkdtemp(path.join(tmpdir(), "ufa-scalar-"));

    await writeFile(path.join(cwd, "ufa.json"), "3");

    await assert.rejects(async () => loadCredentials({ cwd, home: cwd }),
      (error: unknown) => (error instanceof CliError) && error.message.includes("must be a JSON object"));
  });

  test("a partial credential pair names the missing half rather than falling through", async () => {

    const cwd = await mkdtemp(path.join(tmpdir(), "ufa-partial-"));

    await writeFile(path.join(cwd, "ufa.json"), JSON.stringify({ controller: "10.0.0.1", username: "u" }));

    await assert.rejects(async () => loadCredentials({ cwd, home: cwd }),
      (error: unknown) => (error instanceof CliError) && error.message.includes("\"password\"") && error.message.includes("credential pair"));

    await writeFile(path.join(cwd, "ufa.json"), JSON.stringify({ controller: "10.0.0.1", password: "p", tokens: { access: "t" } }));

    await assert.rejects(async () => loadCredentials({ cwd, home: cwd }),
      (error: unknown) => (error instanceof CliError) && error.message.includes("\"username\""));
  });

  test("a file with no identity at all names what it must carry", async () => {

    const cwd = await mkdtemp(path.join(tmpdir(), "ufa-empty-"));

    await writeFile(path.join(cwd, "ufa.json"), JSON.stringify({ controller: "10.0.0.1" }));

    await assert.rejects(async () => loadCredentials({ cwd, home: cwd }),
      (error: unknown) => (error instanceof CliError) && error.message.includes("must carry an identity"));
  });

  test("an empty token entry is refused rather than treated as absent", async () => {

    const cwd = await mkdtemp(path.join(tmpdir(), "ufa-blank-"));

    await writeFile(path.join(cwd, "ufa.json"), JSON.stringify({ controller: "10.0.0.1", tokens: { access: "" } }));

    await assert.rejects(async () => loadCredentials({ cwd, home: cwd }),
      (error: unknown) => (error instanceof CliError) && error.message.includes("\"tokens.access\""));
  });

  test("a tokens field that is not an application map is refused by name", async () => {

    const cwd = await mkdtemp(path.join(tmpdir(), "ufa-shape-"));
    const refused = async (): Promise<void> => assert.rejects(async () => loadCredentials({ cwd, home: cwd }),
      (error: unknown) => (error instanceof CliError) && error.message.includes("\"tokens\"") && error.message.includes("keyed by UniFi application"));

    /* The two shapes a hand-edited file reaches for when it means the map: a bare token where the map belongs, and a list of them. Neither can be read as an
     * application-keyed map, so each is named rather than quietly ignored...ignoring it would report a file carrying no identity at all, which is a more confusing
     * thing to be told than the mistake itself.
     */
    await writeFile(path.join(cwd, "ufa.json"), JSON.stringify({ controller: "10.0.0.1", tokens: "t" }));
    await refused();

    await writeFile(path.join(cwd, "ufa.json"), JSON.stringify({ controller: "10.0.0.1", tokens: ["t"] }));
    await refused();
  });

  test("a tokens map with no Access entry supplies no token rather than an empty one", async () => {

    const cwd = await mkdtemp(path.join(tmpdir(), "ufa-sibling-"));

    // A map carrying only a sibling application's token holds no Access identity, so the file is refused for the identity it lacks rather than for a shape fault.
    await writeFile(path.join(cwd, "ufa.json"), JSON.stringify({ controller: "10.0.0.1", tokens: { network: "n" } }));

    await assert.rejects(async () => loadCredentials({ cwd, home: cwd }),
      (error: unknown) => (error instanceof CliError) && error.message.includes("must carry an identity"));

    // The same map beside a credential pair is simply a pair. That a sibling application's entry passes through untouched is the whole point of keying the map by
    // application: this loader reads the one key it has a use for and leaves the rest alone.
    await writeFile(path.join(cwd, "ufa.json"), JSON.stringify({ controller: "10.0.0.1", password: "p", tokens: { network: "n" }, username: "u" }));

    assert.deepEqual(await loadCredentials({ cwd, home: cwd }), { host: "10.0.0.1", identity: { password: "p", username: "u" } });
  });

  test("an identity field that is present but empty is refused by name", async () => {

    const cwd = await mkdtemp(path.join(tmpdir(), "ufa-hollow-"));

    // Present-and-empty is not absent: the pair is complete as far as the any-of rule can see, so the emptiness is caught where the field is read rather than
    // where the identity is composed.
    await writeFile(path.join(cwd, "ufa.json"), JSON.stringify({ controller: "10.0.0.1", password: "", username: "u" }));

    await assert.rejects(async () => loadCredentials({ cwd, home: cwd }),
      (error: unknown) => (error instanceof CliError) && error.message.includes("missing the required \"password\" field"));
  });

  test("a bare token field is not an identity, and the diagnostic names the shape that is", async () => {

    const cwd = await mkdtemp(path.join(tmpdir(), "ufa-flat-"));

    // A file that puts the token at the top level supplies nothing the loader recognizes as an identity, and it says so by naming the shapes an identity takes. The
    // worth of that answer is that it points at the fix rather than at the symptom.
    await writeFile(path.join(cwd, "ufa.json"), JSON.stringify({ controller: "10.0.0.1", token: "t" }));

    await assert.rejects(async () => loadCredentials({ cwd, home: cwd }),
      (error: unknown) => (error instanceof CliError) && error.message.includes("must carry an identity") && error.message.includes("\"tokens.access\""));
  });

  test("the strict-TLS opt-in is carried as the file states it, and left absent when the file is silent", async () => {

    const cwd = await mkdtemp(path.join(tmpdir(), "ufa-tls-"));
    const identity = { password: "p", username: "u" };

    await writeFile(path.join(cwd, "ufa.json"), JSON.stringify({ controller: "10.0.0.1", ...identity, verifyTls: true }));

    assert.deepEqual(await loadCredentials({ cwd, home: cwd }), { host: "10.0.0.1", identity, verifyTls: true });

    // A stated false is carried as stated rather than folded into silence: the two ask the library for the same thing, and only one of them asks on purpose.
    await writeFile(path.join(cwd, "ufa.json"), JSON.stringify({ controller: "10.0.0.1", ...identity, verifyTls: false }));

    assert.deepEqual(await loadCredentials({ cwd, home: cwd }), { host: "10.0.0.1", identity, verifyTls: false });

    // Silence leaves the key off the result entirely rather than carrying an undefined one, which is what lets the connect path's conditional spread mean "not
    // asked for" rather than "asked for nothing".
    await writeFile(path.join(cwd, "ufa.json"), JSON.stringify({ controller: "10.0.0.1", ...identity }));

    assert.deepEqual(Object.keys(await loadCredentials({ cwd, home: cwd })), [ "host", "identity" ]);
  });

  test("a non-boolean strict-TLS value is refused rather than coerced", async () => {

    const cwd = await mkdtemp(path.join(tmpdir(), "ufa-tls-bad-"));

    // The string "false" is the case that earns the check: coercing it would read as an opt-in and change how the connection is trusted, so the file is corrected
    // rather than interpreted.
    await writeFile(path.join(cwd, "ufa.json"), JSON.stringify({ controller: "10.0.0.1", password: "p", username: "u", verifyTls: "false" }));

    await assert.rejects(async () => loadCredentials({ cwd, home: cwd }),
      (error: unknown) => (error instanceof CliError) && error.message.includes("\"verifyTls\"") && error.message.includes("boolean"));
  });
});

describe("the surface gates", () => {

  test("the credential arm refuses a token-only identity, naming the operation and the token-mode surface", () => {

    assert.throws(() => requireSurface(CREDENTIALS_TOKEN, "credential", "info command"),
      (error: unknown) => (error instanceof CliError) && error.message.includes("info command") && error.message.includes("door group") &&
        error.message.includes("api hatch"));

    assert.doesNotThrow(() => requireSurface(CREDENTIALS_PAIR, "credential", "info command"));
  });

  test("the official arm refuses a credential-only identity and honors a direct-only pin as a usage error", () => {

    assert.throws(() => requireSurface(CREDENTIALS_PAIR, "official", "lock-rule read"),
      (error: unknown) => (error instanceof CliError) && error.message.includes("lock-rule read") && error.message.includes("official API"));

    assert.throws(() => requireSurface(CREDENTIALS_TOKEN, "official", "lock-rule read", "direct-only"),
      (error: unknown) => (error instanceof CliError) && (error.exitCode === 2) && error.message.includes("--api direct-only"));

    assert.doesNotThrow(() => requireSurface(CREDENTIALS_TOKEN, "official", "lock-rule read"));
    assert.doesNotThrow(() => requireSurface(CREDENTIALS_TOKEN, "official", "lock-rule read", "official-only"));
  });

  test("the post-connect gate honors the runtime capability verdict", () => {

    const folded = makeFakeClient({ capabilities: { mode: "dual", official: false, override: "auto" } });

    assert.throws(() => requireOfficial(folded.client as never, "user commands"),
      (error: unknown) => (error instanceof CliError) && error.message.includes("user commands") && error.message.includes("official API"));

    const up = makeFakeClient({ official: {} });

    assert.equal(requireOfficial(up.client as never, "user commands"), (up.client as { official: unknown }).official);
  });

  test("the opener refuses an api pin the identities contradict, before anything connects", async () => {

    await assert.rejects(async () => openClient({ api: "direct-only", credentials: CREDENTIALS_TOKEN }),
      (error: unknown) => (error instanceof CliError) && (error.exitCode === 2) && error.message.includes("direct-only"));

    await assert.rejects(async () => openClient({ api: "official-only", credentials: CREDENTIALS_PAIR }),
      (error: unknown) => (error instanceof CliError) && (error.exitCode === 2) && error.message.includes("official-only"));
  });
});

describe("the read commands", () => {

  /* A captured topology document, wrapped in the envelope the controller answers with. The document is the committed corpus rather than a hand-built record, which is
   * what makes the field-order assertions below mean something: a captured record's keys sit in the order the wire delivered them, and that order is not alphabetical.
   */
  const document = accessBootstrap2026Fixture;
  const envelope = { code: 200, codeS: "SUCCESS", data: [document] };
  const documentFloors = document.floors ?? [];

  test("bootstrap unwraps the envelope and prints the document", async () => {

    const { calls, client } = makeFakeClient({ document: envelope });
    const { ctx, lines } = makeCommandContext({ args: ["--json"], calls, client });

    await bootstrap.run(ctx);

    assert.equal(rendered(lines)[0], JSON.stringify(document));
  });

  test("bootstrap prints a non-envelope value verbatim", async () => {

    const { calls, client } = makeFakeClient({ document });
    const { ctx, lines } = makeCommandContext({ args: ["--json"], calls, client });

    await bootstrap.run(ctx);

    assert.equal(rendered(lines)[0], JSON.stringify(document));
  });

  test("the JSON rendering preserves the wire's own field order", async () => {

    const { calls, client } = makeFakeClient({ document: envelope });
    const { ctx, lines } = makeCommandContext({ args: ["--json"], calls, client });

    await bootstrap.run(ctx);

    // The captured document's keys are not in alphabetical order, so a rendering that sorted them would differ from this - which is what makes the assertion a pin on
    // wire order rather than one that any serialization would satisfy.
    assert.notDeepEqual(Object.keys(document), [...Object.keys(document)].sort());
    assert.equal(rendered(lines)[0], JSON.stringify(document));
  });

  test("the default rendering inspects the document without color", async () => {

    const { calls, client } = makeFakeClient({ document: envelope });
    const { ctx, lines } = makeCommandContext({ calls, client });

    await bootstrap.run(ctx);

    const text = lines.join("");

    assert.match(text, /floors:/);
    assert.ok(!text.includes("\u001b"), "a non-colorized rendering carries no styling escapes");
  });

  test("a bare info prints the controller document", async () => {

    const { calls, client } = makeFakeClient({ controllerInfo: accessControllerInfoFixture });
    const { ctx, lines } = makeCommandContext({ args: ["--json"], calls, client });

    await info.run(ctx);

    assert.equal(rendered(lines)[0], JSON.stringify(accessControllerInfoFixture));
    assert.equal(calls.opens[0]?.refreshIntervalMs, false);
  });

  test("the devices category prints every record in the device and access-point union", async () => {

    const { calls, client } = makeFakeClient({ accessPoints: [{ id: "port-1", name: "EAH Port 1" }],
      devices: [ { id: "hub-1", name: "Acme Name 13" }, { id: "reader-1", name: "Reader" } ] });
    const { ctx, lines } = makeCommandContext({ args: [ "devices", "--json" ], calls, client });

    await info.run(ctx);

    const printed = JSON.parse(rendered(lines)[0] ?? "[]") as { unique_id: string }[];

    // The port is listed alongside the devices: an Enterprise hub's ports each drive their own door, and a listing that omitted them would name doors the other
    // commands can act on but this one cannot show.
    assert.deepEqual(printed.map((record) => record.unique_id), [ "hub-1", "reader-1", "port-1" ]);
  });

  test("the hubs and access-points categories print their own collections", async () => {

    const { calls, client } = makeFakeClient({ accessPoints: [{ id: "port-1", name: "EAH Port 1" }],
      devices: [ { id: "hub-1", name: "Acme Name 13" }, { id: "reader-1", name: "Reader" } ], hubIds: ["hub-1"] });
    const hubsRun = makeCommandContext({ args: [ "hubs", "--json" ], calls, client });

    await info.run(hubsRun.ctx);

    assert.deepEqual((JSON.parse(rendered(hubsRun.lines)[0] ?? "[]") as { unique_id: string }[]).map((record) => record.unique_id), ["hub-1"]);

    const portsRun = makeCommandContext({ args: [ "access-points", "--json" ], calls, client });

    await info.run(portsRun.ctx);

    assert.deepEqual((JSON.parse(rendered(portsRun.lines)[0] ?? "[]") as { unique_id: string }[]).map((record) => record.unique_id), ["port-1"]);
  });

  test("the doors category flattens the document's floors and the floors category prints them whole", async () => {

    const { calls, client } = makeFakeClient({ document: envelope });
    const doorsRun = makeCommandContext({ args: [ "doors", "--json" ], calls, client });

    await info.run(doorsRun.ctx);

    // The doors are the raw records gathered from under each floor, whole - not the pruned form the library's state model stores, and not a map that would serialize
    // to an empty object.
    assert.equal(rendered(doorsRun.lines)[0], JSON.stringify(documentFloors.flatMap((entry) => entry.doors)));

    const floorsRun = makeCommandContext({ args: [ "floors", "--json" ], calls, client });

    await info.run(floorsRun.ctx);

    assert.equal(rendered(floorsRun.lines)[0], JSON.stringify(documentFloors));
  });

  test("an empty topology prints null for both doors and floors", async () => {

    const { calls, client } = makeFakeClient({ document: { code: 200, data: [{ name: "Acme Name 16" }] } });
    const doorsRun = makeCommandContext({ args: [ "doors", "--json" ], calls, client });

    await info.run(doorsRun.ctx);

    assert.equal(rendered(doorsRun.lines)[0], "null");

    const floorsRun = makeCommandContext({ args: [ "floors", "--json" ], calls, client });

    await info.run(floorsRun.ctx);

    assert.equal(rendered(floorsRun.lines)[0], "null");
  });

  test("a floor list carrying no doors still prints null for doors", async () => {

    const { calls, client } = makeFakeClient({ document: { code: 200, data: [{ floors: [{ doors: [], name: "Test Name 2" }] }] } });
    const { ctx, lines } = makeCommandContext({ args: [ "doors", "--json" ], calls, client });

    await info.run(ctx);

    assert.equal(rendered(lines)[0], "null");
  });

  test("a document that is not an object passes through the topology helpers untouched", async () => {

    const { calls, client } = makeFakeClient({ document: "not a document" });
    const bootstrapRun = makeCommandContext({ args: ["--json"], calls, client });

    await bootstrap.run(bootstrapRun.ctx);

    assert.equal(rendered(bootstrapRun.lines)[0], "\"not a document\"");

    const floorsRun = makeCommandContext({ args: [ "floors", "--json" ], calls, client });

    await info.run(floorsRun.ctx);

    assert.equal(rendered(floorsRun.lines)[0], "null");
  });

  test("an unknown category is a usage error naming the valid set", async () => {

    const { calls, client } = makeFakeClient();
    const { ctx } = makeCommandContext({ args: ["everything"], calls, client });

    await assert.rejects(async () => info.run(ctx),
      (error: unknown) => (error instanceof CliError) && (error.exitCode === 2) && error.message.includes("access-points"));

    assert.equal(calls.opens.length, 0, "a category refusal never opens a client");
  });

  test("info and bootstrap refuse a token-only identity before connecting", async () => {

    for(const spec of [ info, bootstrap ]) {

      const { calls, client } = makeFakeClient();
      const { ctx } = makeCommandContext({ calls, client, credentials: CREDENTIALS_TOKEN });

      // Sequential by intent: each command's refusal is asserted against its own context.
      // eslint-disable-next-line no-await-in-loop
      await assert.rejects(async () => spec.run(ctx),
        (error: unknown) => (error instanceof CliError) && error.message.includes("door group") && error.message.includes("api hatch"));

      assert.equal(calls.opens.length, 0, "the refusal happens before anything connects");
    }
  });

  test("a one-shot read disables the refresh failsafe", async () => {

    const { calls, client } = makeFakeClient({ document: envelope });
    const { ctx } = makeCommandContext({ calls, client });

    await bootstrap.run(ctx);

    assert.equal(calls.opens[0]?.refreshIntervalMs, false);
    assert.equal(calls.disposals, 1);
  });
});

describe("the capture scrub wiring", () => {

  // A topology document carrying one value of each class the read commands print, so an assertion below is about whether the flag reached that output path rather
  // than about the scrub's own rules, which the module's own suite covers.
  const identity = { "floors": [{ "doors": [{ "full_name": "Loading Dock", "mac": "AABBCC000002", "unique_id": "door-1" }], "name": "Third Floor" }],
    "host": { "ip": "10.13.0.42", "shortname": "Acme Holdings HQ" } };
  const envelope = { code: 200, codeS: "SUCCESS", data: [identity] };
  const planted = [ "10.13.0.42", "Acme Holdings HQ", "AABBCC000002", "Loading Dock", "Third Floor" ];

  // Every value the fixture plants, absent from what a command wrote.
  function assertNothingPlantedSurvives(lines: string[], label: string): void {

    const text = lines.join("");

    for(const value of planted) {

      assert.ok(!text.includes(value), label + " carries no \"" + value + "\"");
    }
  }

  test("bootstrap prints the document verbatim without the flag and pseudonymized with it, in both formats", async () => {

    for(const format of [ [], ["--json"] ]) {

      const plain = makeFakeClient({ document: envelope });
      const plainRun = makeCommandContext({ args: format, calls: plain.calls, client: plain.client });

      // Sequential by intent: each format is asserted on its own invocation, against its own fake.
      // eslint-disable-next-line no-await-in-loop
      await bootstrap.run(plainRun.ctx);

      assert.ok(plainRun.lines.join("").includes("Loading Dock"), "without the flag the document prints as the controller sent it");

      const scrubbed = makeFakeClient({ document: envelope });
      const scrubbedRun = makeCommandContext({ args: [ ...format, "--scrub" ], calls: scrubbed.calls, client: scrubbed.client });

      // eslint-disable-next-line no-await-in-loop
      await bootstrap.run(scrubbedRun.ctx);

      assertNothingPlantedSurvives(scrubbedRun.lines, "bootstrap " + (format[0] ?? "default"));
      assert.match(scrubbedRun.lines.join(""), /Test Name \d+/, "the document still reads as a topology");
    }

    // The envelope is peeled after the scrub, so the JSON view is still the document alone rather than the wrapper the controller answers with.
    const shaped = makeFakeClient({ document: envelope });
    const shapedRun = makeCommandContext({ args: [ "--json", "--scrub" ], calls: shaped.calls, client: shaped.client });

    await bootstrap.run(shapedRun.ctx);

    assert.deepEqual(Object.keys(JSON.parse(rendered(shapedRun.lines)[0] ?? "{}") as object), Object.keys(identity));
  });

  test("info scrubs the controller document and an inventory category alike", async () => {

    // Both of this command's acquisition points, each asserted on its own invocation: a bare read answers the controller's own document, and a category answers the
    // records beneath it. A wiring that reached one and missed the other fails here.
    const bare = makeFakeClient({ controllerInfo: identity });
    const bareRun = makeCommandContext({ args: [ "--json", "--scrub" ], calls: bare.calls, client: bare.client });

    await info.run(bareRun.ctx);

    assertNothingPlantedSurvives(bareRun.lines, "info");

    const spec = { devices: [{ config: { "mac": "AABBCC000002" }, id: "hub-1", name: "Loading Dock" }] };
    const plain = makeFakeClient(spec);
    const plainRun = makeCommandContext({ args: [ "devices", "--json" ], calls: plain.calls, client: plain.client });

    await info.run(plainRun.ctx);

    assert.ok(plainRun.lines.join("").includes("Loading Dock"), "without the flag the inventory prints the records as they stand");

    const scrubbed = makeFakeClient(spec);
    const scrubbedRun = makeCommandContext({ args: [ "devices", "--json", "--scrub" ], calls: scrubbed.calls, client: scrubbed.client });

    await info.run(scrubbedRun.ctx);

    assertNothingPlantedSurvives(scrubbedRun.lines, "info devices");
  });

  test("the scrub never modifies the state the projections read through to", async () => {

    // The inventory reads live records out of the store, so a scrub that edited in place would corrupt controller state for everything that came after it.
    const config = { "mac": "AABBCC000002" };
    const { calls, client } = makeFakeClient({ devices: [{ config, id: "hub-1", name: "Loading Dock" }] });
    const { ctx } = makeCommandContext({ args: [ "devices", "--json", "--scrub" ], calls, client });

    await info.run(ctx);

    assert.equal(config.mac, "AABBCC000002");
  });
});

describe("the output layer", () => {

  test("a palette styles when color is on and is the identity when it is off", async () => {

    const { createPalette } = await import("./output/colors.ts");

    assert.equal(createPalette(false).green("ok"), "ok");
    assert.equal(createPalette(true).green("ok"), "\u001b[32mok\u001b[39m");
  });

  test("colorization honors the terminal and the environment", async () => {

    const { colorsEnabled } = await import("./output/colors.ts");

    assert.equal(colorsEnabled({ isTTY: true }, {}), true);
    assert.equal(colorsEnabled({ isTTY: false }, {}), false);
    assert.equal(colorsEnabled({}, {}), false);
    assert.equal(colorsEnabled({ isTTY: true }, { NO_COLOR: "1" }), false);
    assert.equal(colorsEnabled({ isTTY: true }, { NO_COLOR: "" }), true);
    assert.equal(colorsEnabled({ isTTY: true }, { TERM: "dumb" }), false);
  });

  test("the library logger writes to its stream, tagged by level, with debug and info gated", async () => {

    const { createCliLogger } = await import("./client.ts");
    const captured: string[] = [];
    const stream = { write: (chunk: string | Uint8Array): boolean => {

      captured.push(String(chunk));

      return true;
    } };

    const quiet = createCliLogger({ stream });

    quiet.debug("A debug detail.");
    quiet.info("A lifecycle line.");
    quiet.warn("A warning.", { reason: "throttled" });
    quiet.error("A failure.", new Error("boom"));

    // Without debug, only what an operator needs to see reaches stderr, and the structured context is rendered rather than stringified to [object Object].
    assert.equal(captured.length, 2);
    assert.match(captured[0] ?? "", /^\[warn\] A warning\. \{ reason: 'throttled' \}\n$/);
    assert.match(captured[1] ?? "", /^\[error\] A failure\. Error: boom/);

    const verbose = createCliLogger({ debug: true, stream });

    verbose.debug("A debug detail.");
    verbose.info("A lifecycle line.", "extra");

    assert.equal(captured[2], "[debug] A debug detail.\n");
    assert.equal(captured[3], "[info] A lifecycle line. extra\n");
  });

  test("the byte sink writes a file and confirms through the command's own output", async () => {

    const dir = await mkdtemp(path.join(tmpdir(), "ufa-sink-"));
    const file = path.join(dir, "payload.bin");
    const lines: string[] = [];
    const output = new Output({ colorize: false, env: {}, stream: { write: (chunk: string | Uint8Array): boolean => {

      lines.push(String(chunk));

      return true;
    } } });

    await writeByteSink(output, Buffer.from("payload"), file);

    assert.equal(await readFile(file, "utf8"), "payload");
    assert.match(rendered(lines)[0] ?? "", /Wrote 7 bytes to .*payload\.bin\./);
  });

  test("the byte sink refuses an interactive terminal and writes a pipe with the confirmation on stderr", async () => {

    const output = new Output({ colorize: false, env: {}, stream: { write: (): boolean => true } });
    const isTTY = process.stdout.isTTY;
    const write = process.stdout.write.bind(process.stdout);
    const captured: string[] = [];

    process.stdout.isTTY = true;

    try {

      await assert.rejects(async () => writeByteSink(output, Buffer.from("payload"), undefined),
        (error: unknown) => (error instanceof CliError) && (error.exitCode === 2));
    } finally {

      process.stdout.isTTY = isTTY;
    }

    process.stdout.write = ((chunk: string | Uint8Array): boolean => {

      captured.push(String(chunk));

      return true;
    });

    try {

      const stderr = await withStderr(async () => writeByteSink(output, Buffer.from("payload"), "-"));

      assert.deepEqual(captured, ["payload"]);
      assert.match(stderr.text, /Wrote 7 bytes to stdout\./);
    } finally {

      process.stdout.write = write;
    }
  });
});

describe("the entry point", () => {

  // The symbols the entry point exports for direct testing, named as a shape so the dynamic import below carries a type without an inline import annotation.
  interface EntryModule {

    main(): Promise<void>;
    readVersion(): string;
    renderError(error: unknown): void;
  }

  /* Load the entry module under a stdout capture.
   *
   * The entry point runs itself on import, which is what makes it an entry point; a test that imports it therefore has to expect one usage screen. Capturing stdout
   * across the first import swallows it, and every later call resolves from the module cache without running anything again.
   */
  let entryModule: EntryModule | undefined;

  async function loadEntry(): Promise<EntryModule> {

    if(entryModule !== undefined) {

      return entryModule;
    }

    const argv = process.argv;
    const write = process.stdout.write.bind(process.stdout);

    process.stdout.write = ((): boolean => true);
    process.argv = [ "node", "ufa" ];

    try {

      entryModule = await import("./index.ts");

      return entryModule;
    } finally {

      process.stdout.write = write;
      process.argv = argv;
    }
  }

  test("the version is read from the package", async () => {

    const entry = await loadEntry();
    const pkg = JSON.parse(readFileSync(new URL("../../../package.json", import.meta.url), "utf8")) as { version: string };

    assert.equal(entry.readVersion(), pkg.version);
  });

  test("the version flag prints it", async () => {

    const entry = await loadEntry();
    const argv = process.argv;
    const write = process.stdout.write.bind(process.stdout);
    const captured: string[] = [];

    process.stdout.write = ((chunk: string | Uint8Array): boolean => {

      captured.push(String(chunk));

      return true;
    });
    process.argv = [ "node", "ufa", "--version" ];

    try {

      await entry.main();
    } finally {

      process.stdout.write = write;
      process.argv = argv;
    }

    assert.equal(captured.join("").trim(), entry.readVersion());
  });

  test("a bare invocation renders usage, lists the twelve commands, and sets no exit code", async () => {

    const entry = await loadEntry();
    const argv = process.argv;
    const write = process.stdout.write.bind(process.stdout);
    const captured: string[] = [];

    process.stdout.write = ((chunk: string | Uint8Array): boolean => {

      captured.push(String(chunk));

      return true;
    });
    process.argv = [ "node", "ufa" ];

    const code = await withExitCode(async () => {

      try {

        await entry.main();
      } finally {

        process.stdout.write = write;
        process.argv = argv;
      }
    });

    const text = captured.join("");

    assert.match(text, /^ufa - a command-line client for the UniFi Access API\./);
    assert.match(text, /Credentials are read from \.\/ufa\.json or ~\/\.ufa\.json/);
    assert.match(text, /"tokens\.access"/, "the credentials line names the token entry the file carries");

    // Every command is listed, and each line comes from the same table that dispatches. The names are the literal twelve, never derived from the table under test.
    for(const name of COMMAND_NAMES) {

      assert.match(text, new RegExp("\\n {2}" + name + " +\\S"), name + " is listed");
    }

    // An example is a promise that the line works if it is typed, so the piped one carries the flag that makes the output JSON in the first place, and the acting
    // ones spell the new grammar.
    assert.match(text, /ufa bootstrap --json \| jq \./, "the bootstrap example pipes the form that produces JSON");
    assert.match(text, /ufa door unlock "Loading Dock" --duration 30m/, "the unlock example spells the unit-suffixed duration");
    assert.match(text, /ufa device restart all/, "the restart example spells the all keyword");
    assert.match(text, /ufa watch events --ring/, "the streaming example spells the watch group");

    assert.equal(code, undefined, "usage is not an error");
  });

  test("a dispatched command runs with the Ctrl-C signal and leaves no listeners behind", async () => {

    const entry = await loadEntry();
    const argv = process.argv;
    const write = process.stdout.write.bind(process.stdout);
    const captured: string[] = [];
    const before = process.listenerCount("SIGINT");

    process.stdout.write = ((chunk: string | Uint8Array): boolean => {

      captured.push(String(chunk));

      return true;
    });

    // A help path dispatches through the real table and the real signal wiring while never opening a client, so the dispatch path is exercised offline.
    process.argv = [ "node", "ufa", "info", "--help" ];

    const code = await withExitCode(async () => {

      try {

        await entry.main();
      } finally {

        process.stdout.write = write;
        process.argv = argv;
      }
    });

    assert.match(captured.join(""), /^Usage: ufa info/);
    assert.equal(code, undefined);
    assert.equal(process.listenerCount("SIGINT"), before, "the signal listeners are detached when the command returns");
  });

  test("an unknown command is a usage error", async () => {

    const entry = await loadEntry();
    const argv = process.argv;

    process.argv = [ "node", "ufa", "nonsense" ];

    try {

      await assert.rejects(async () => entry.main(), (error: unknown) => (error instanceof CliError) && (error.exitCode === 2));
    } finally {

      process.argv = argv;
    }
  });

  test("the error cascade sets the exit code and renders the shape each class earns", async () => {

    const entry = await loadEntry();
    const { AccessAbortedError, AccessRequestError } = await import("../../index.ts");

    // A stopped operation: silent, and the conventional signal exit code.
    const abort = await withStderr(() => entry.renderError(new AccessAbortedError("stopped")));

    assert.equal(abort.code, 130);
    assert.equal(abort.text, "");

    // An expected CLI failure: one calm line, and the code the error itself carries.
    const cli = await withStderr(() => entry.renderError(new CliError("no such door", { exitCode: 2 })));

    assert.equal(cli.code, 2);
    assert.equal(cli.text, "ufa: no such door\n");

    // A library failure: one calm line, exit 1.
    const library = await withStderr(() => entry.renderError(new AccessRequestError("the controller refused the door command",
      { body: "", headers: {}, statusCode: 400 })));

    assert.equal(library.code, 1);
    assert.equal(library.text, "ufa: the controller refused the door command\n");

    // A parse failure: one calm line, and the usage exit code.
    const parseError: NodeJS.ErrnoException = Object.assign(new Error("Unknown option '--nope'"), { code: "ERR_PARSE_ARGS_UNKNOWN_OPTION" });
    const parsed = await withStderr(() => entry.renderError(parseError));

    assert.equal(parsed.code, 2);
    assert.equal(parsed.text, "ufa: Unknown option '--nope'\n");

    // Anything else is a bug, and a bug earns its stack.
    const unexpected = await withStderr(() => entry.renderError(new TypeError("undefined is not a function")));

    assert.equal(unexpected.code, 1);
    assert.match(unexpected.text, /^ufa: TypeError: undefined is not a function\n {4}at /);
  });
});

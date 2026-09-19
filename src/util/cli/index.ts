#!/usr/bin/env node
/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * index.ts: The ufa CLI entry point - argv dispatch, the single Ctrl-C abort controller, and uniform error rendering. The reference consumer of the library.
 */
import { AccessAbortedError, AccessError, formatErrorChain } from "../../index.ts";
import { CliError, commandList, isHelpToken, wireAbortSignal } from "./shared.ts";
import { Output, alignedList } from "./output/format.ts";
import { loadUfaIdentity, openClient } from "./client.ts";
import type { CommandSpec } from "./shared.ts";
import { api } from "./commands/api.ts";
import { bootstrap } from "./commands/bootstrap.ts";
import { classify } from "./commands/classify.ts";
import { device } from "./commands/device.ts";
import { doctor } from "./commands/doctor.ts";
import { door } from "./commands/door.ts";
import { info } from "./commands/info.ts";
import { logs } from "./commands/logs.ts";
import { readFileSync } from "node:fs";
import { user } from "./commands/user.ts";
import { visitor } from "./commands/visitor.ts";
import { watch } from "./commands/watch.ts";
import { webhook } from "./commands/webhook.ts";

// The command table. The dispatcher and the usage text both derive from this one object, so a new command is registered in exactly one place and can never be listed
// but unroutable (or routable but unlisted).
const COMMANDS: Record<string, CommandSpec> = {

  api,
  bootstrap,
  classify,
  device,
  doctor,
  door,
  info,
  logs,
  user,
  visitor,
  watch,
  webhook
};

// A curated set of cross-command examples for the top-level usage - the few things a new user most likely wants to do, spanning inspect, stream, and act. They live
// here, the one place that knows the whole command surface, because each is a composition no single command owns. The order is deliberate (inspect, then stream, then
// act), so this list is authored, not sorted.
const EXAMPLES: readonly (readonly [string, string])[] = [

  [ "ufa info", "# the controller's own configuration" ],
  [ "ufa info doors", "# every door in the topology" ],
  [ "ufa bootstrap --json | jq .", "# the whole topology document, as the controller sent it" ],
  [ "ufa watch events --ring", "# stream doorbell rings as they happen" ],
  [ "ufa watch events --json", "# the notification firehose, as NDJSON for capture" ],
  [ "ufa watch events --json --scrub", "# the same capture, with every identifying value pseudonymized" ],
  [ "ufa door unlock \"Loading Dock\"", "# unlock a door" ],
  [ "ufa door unlock \"Loading Dock\" --duration 30m", "# hold it unlocked for thirty minutes" ],
  [ "ufa device restart all", "# restart every connected device" ],
  [ "ufa doctor", "# health-check every subsystem against the controller" ]
];

// Top-level usage. The command list (each command beside its one-line summary) renders through `commandList` from COMMANDS, so the screen cannot drift from what
// actually dispatches; the examples render through the shared `alignedList` so both blocks stay aligned as entries change.
function usage(): string {

  return [

    "ufa - a command-line client for the UniFi Access API.",
    "",
    "Usage: ufa <command> [options]",
    "",
    "Commands:",
    ...commandList(COMMANDS),
    "",
    "Examples:",
    ...alignedList(EXAMPLES),
    "",
    "Run \"ufa <command> --help\" for command-specific options.",
    "Credentials are read from ./ufa.json or ~/.ufa.json (\"controller\", plus \"username\" and \"password\", a \"tokens.access\" entry, or both)."
  ].join("\n");
}

/**
 * Read the package version for `--version`, relative to this module so it resolves identically whether the CLI runs from source or from the built output. The
 * location is a parameter so that a caller can point the read somewhere else.
 *
 * @param packageUrl - The package file to read, defaulting to the one beside this module's own output.
 *
 * @returns The package version, or "unknown" when it cannot be read.
 *
 * @category CLI
 */
export function readVersion(packageUrl: URL = new URL("../../../package.json", import.meta.url)): string {

  try {

    const pkg = JSON.parse(readFileSync(packageUrl, "utf8")) as { version?: string };

    return pkg.version ?? "unknown";
  } catch {

    return "unknown";
  }
}

/**
 * Render a thrown value to stderr and set the process exit code. Each case is deliberate: a `CliError` or a typed `AccessError` is an expected outcome and gets a calm
 * one-line message; a caller abort (Ctrl-C) exits 130 silently, per convention; an argument-parse error is a usage error and exits 2; anything else is an unexpected
 * bug and gets its stack, because that is the only case where a stack helps anyone.
 *
 * @param error - The thrown value.
 *
 * @category CLI
 */
export function renderError(error: unknown): void {

  if(error instanceof AccessAbortedError) {

    process.exitCode = 130;

    return;
  }

  if(error instanceof CliError) {

    process.stderr.write("ufa: " + formatErrorChain(error) + ".\n");
    process.exitCode = error.exitCode;

    return;
  }

  if(error instanceof AccessError) {

    process.stderr.write("ufa: " + formatErrorChain(error) + ".\n");
    process.exitCode = 1;

    return;
  }

  const code = (error as NodeJS.ErrnoException | null)?.code;

  if((typeof code === "string") && code.startsWith("ERR_PARSE_ARGS")) {

    process.stderr.write("ufa: " + ((error instanceof Error) ? error.message : String(error)) + "\n");
    process.exitCode = 2;

    return;
  }

  process.stderr.write("ufa: " + ((error instanceof Error) ? (error.stack ?? error.message) : String(error)) + "\n");
  process.exitCode = 1;
}

/**
 * Parse the verb, handle the help and version short-circuits, then dispatch the rest of argv to the matching command with the shared output and Ctrl-C signal. The
 * signal listeners are detached in the finally, so a short command leaves no handlers attached to the process.
 *
 * @category CLI
 */
export async function main(): Promise<void> {

  const output = new Output();
  const [ verb, ...rest ] = process.argv.slice(2);

  if(isHelpToken(verb)) {

    output.line(usage());

    return;
  }

  if((verb === "--version") || (verb === "-v")) {

    output.line(readVersion());

    return;
  }

  const command = COMMANDS[verb];

  if(command === undefined) {

    throw new CliError("Unknown command \"" + verb + "\". Run \"ufa --help\" for usage.", { exitCode: 2 });
  }

  const { dispose, signal } = wireAbortSignal();

  try {

    await command.run({ args: rest, env: process.env, loadCredentials: loadUfaIdentity, openClient, output, signal });
  } finally {

    dispose();
  }
}

// A reader closing the pipe (piping into head, less, or jq that exits) makes a write fail with EPIPE. For a streaming CLI that is a clean, expected end, so we exit 0
// rather than crash with an unhandled error.
function onPipeError(error: NodeJS.ErrnoException): void {

  if(error.code === "EPIPE") {

    process.exit(0);
  }
}

process.stdout.on("error", onPipeError);
process.stderr.on("error", onPipeError);

void main().catch((error: unknown) => renderError(error));

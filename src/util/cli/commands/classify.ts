/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * classify.ts: `ufa classify` - classify captured notification packets offline, the worked example of the static classifier surface. No controller connection.
 */
import { AccessClient, isAccessEventPacket } from "../../../index.ts";
import type { CommandHandler, CommandSpec } from "../shared.ts";
import { CliError } from "../shared.ts";
import type { Output } from "../output/format.ts";
import { parseArgs } from "node:util";
import { readFile } from "node:fs/promises";

const USAGE = [

  "Usage: ufa classify [FILE]",
  "",
  "Classify captured notification packets from a file (or stdin) and emit one NDJSON line per packet: the wire event name, the classified kind",
  "(null for a valid packet the library does not model), and the typed event itself. Offline: no controller connection or credentials - it runs",
  "the library's classifier over the packets you provide, the same classification the live rails perform.",
  "",
  "Input: one whole JSON document (an object is one packet, an array a packet list, pretty-printed included), or NDJSON - one JSON packet per",
  "line, the shape \"ufa watch events --json\" and \"ufa watch raw\" emit. Blank lines are skipped; a value that is not an Access notification",
  "packet emits a line whose event is null.",
  "",
  "Options:",
  "  -h, --help  Show this help.",
  "",
  "Examples:",
  "  ufa classify capture.ndjson              # classify a capture file",
  "  ufa watch raw --count=10 | ufa classify  # classify live packets as they arrive"
].join("\n");

// `classify` is connection-free, so it does not carry the usual --debug flag (there is no client to emit library logging); only --help applies.
const OPTIONS = {

  help: { short: "h", type: "boolean" }
} as const;

// Read every byte from stdin as one string, using the stream's async iterator - the modern, backpressure-aware way to drain a readable.
async function readStdin(): Promise<string> {

  const chunks: Buffer[] = [];

  for await (const chunk of process.stdin) {

    // process.stdin yields Buffer chunks by default, absent an explicit setEncoding call, which is why the cast is safe.
    chunks.push(chunk as Buffer);
  }

  return Buffer.concat(chunks).toString("utf8");
}

// Classify one parsed value and emit its NDJSON line. A value that is not an Access notification packet reports as such - a null event, which no valid packet
// produces - rather than dying, because a capture file may legitimately interleave other material.
function classifyValue(output: Output, value: unknown): void {

  if(!isAccessEventPacket(value)) {

    output.line(JSON.stringify({ classified: null, event: null, kind: null }));

    return;
  }

  const classified = AccessClient.classifyPacket(value);

  output.line(JSON.stringify({ classified, event: value.event, kind: classified?.kind ?? null }));
}

/**
 * `ufa classify`. Reads the whole input, then decides its shape deterministically: one JSON.parse of the entire text first - success means a single whole-document
 * value, which covers pretty-printed JSON unambiguously - and only on failure NDJSON line mode, one packet per line. Line mode skips blank and whitespace-only
 * lines, because a captured NDJSON file ends with the trailing newline its own emitter appended - the sibling commands' legitimate output, never an error.
 *
 * This is the offline twin of the live rails: the same `isAccessEventPacket` validation and the same static classification the notification stream applies.
 *
 * @category CLI
 */
const classifyHandler: CommandHandler = async (ctx) => {

  const { positionals, values } = parseArgs({ allowPositionals: true, args: ctx.args, options: OPTIONS, strict: true });

  if(values.help === true) {

    ctx.output.line(USAGE);

    return;
  }

  const [source] = positionals;

  if(positionals.length > 1) {

    throw new CliError("Specify at most one input file, or nothing for stdin. Run \"ufa classify --help\" for usage.", { exitCode: 2 });
  }

  // A read failure (a missing file, an unreadable stdin) is an expected user error, so it renders as a clean CliError rather than an uncaught stack.
  let text: string;

  try {

    text = ((source === undefined) || (source === "-")) ? await readStdin() : await readFile(source, "utf8");
  } catch(error) {

    throw new CliError("Unable to read packets from " + ((source === undefined) || (source === "-") ? "stdin" : ("\"" + source + "\"")) + ".",
      { cause: error, exitCode: 2 });
  }

  // The whole-document attempt first: success is unambiguous, and it is the only reading that can honor a pretty-printed multi-line document.
  let document: unknown;
  let wholeDocument = true;

  try {

    document = JSON.parse(text);
  } catch {

    wholeDocument = false;
  }

  if(wholeDocument) {

    for(const value of Array.isArray(document) ? (document as unknown[]) : [document]) {

      classifyValue(ctx.output, value);
    }

    return;
  }

  // NDJSON line mode: one packet per non-blank line, each parse failure named by its line number so the operator can find it in the capture.
  const lines = text.split("\n");

  for(const [ index, line ] of lines.entries()) {

    if(line.trim().length === 0) {

      continue;
    }

    let value: unknown;

    try {

      value = JSON.parse(line);
    } catch(error) {

      throw new CliError("Line " + (index + 1).toString() + " is not valid JSON.", { cause: error, exitCode: 2 });
    }

    classifyValue(ctx.output, value);
  }
};

// The command descriptor: the handler above plus the one-line summary the usage screen lists it by, so the listing derives from the same object that dispatches.
export const classify: CommandSpec = {

  run: classifyHandler,
  summary: "Classify captured packets offline, from a file or stdin."
};

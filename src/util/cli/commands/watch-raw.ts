/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * watch-raw.ts: `ufa watch raw` - the dedicated capture rail: every raw packet as wire-order NDJSON, no filters, no formats.
 */
import { COMMON_OPTIONS, SCRUB_OPTION, boundedSignal, createDocumentScrubber, parseDuration, parseNonNegativeInt, take } from "../shared.ts";
import type { CommandHandler, CommandSpec } from "../shared.ts";
import { parseArgs } from "node:util";
import { renderDocument } from "../output/format.ts";

const USAGE = [

  "Usage: ufa watch raw [--count=N] [--duration=30s] [--scrub] [--debug]",
  "",
  "Stream every raw notification packet as NDJSON - one JSON line per packet, field order preserved - until Ctrl-C, or until a --count or",
  "--duration bound is reached. No filters and no format flags: this is the capture rail, and the output is identical on a terminal and in a pipe.",
  "",
  "Options:",
  "  --count=N        Stop after N packets; 0 means no limit.",
  "  --duration=30s   Stop after this long (a positive integer with a unit: ms, s, m, h); omit it for no limit.",
  "  --scrub          Pseudonymize identifying values across the whole stream - one value reads as one stand-in in every packet of the run.",
  "  --debug          Emit the library's debug logging to stderr.",
  "  -h, --help       Show this help.",
  "",
  "Examples:",
  "  ufa watch raw > capture.ndjson          # capture everything until Ctrl-C",
  "  ufa watch raw --count=100               # capture one hundred packets",
  "  ufa watch raw --scrub > capture.ndjson  # a capture that is safe to send on"
].join("\n");

/**
 * `ufa watch raw`. Iterates the raw packet rail and emits each packet verbatim as one line of wire-order JSON. The one job here is fidelity: what the controller
 * sent is what lands in the capture, and `ufa classify` reads this shape back offline.
 *
 * @category CLI
 */
const rawHandler: CommandHandler = async (ctx) => {

  const { values } = parseArgs({ allowPositionals: true, args: ctx.args,
    options: { ...COMMON_OPTIONS, ...SCRUB_OPTION, count: { type: "string" }, duration: { type: "string" } }, strict: true });

  if(values.help === true) {

    ctx.output.line(USAGE);

    return;
  }

  const limit = (values.count !== undefined) ? parseNonNegativeInt(values.count, "--count") : 0;
  const durationMs = (values.duration !== undefined) ? parseDuration(values.duration, "--duration") : undefined;

  await using client = await ctx.openClient({ debug: values.debug === true, signal: ctx.signal });

  const deadline = boundedSignal(ctx.signal, durationMs);
  const source = client.rawPackets({ signal: deadline });

  // One scrubber for the whole stream, so a device named in one packet reads as the same stand-in when a later packet names it again and the capture still
  // describes a system rather than a crowd of strangers.
  const scrubPacket = createDocumentScrubber(values.scrub === true);

  for await (const packet of (limit >= 1) ? take(source, limit) : source) {

    renderDocument(ctx.output, scrubPacket(packet), "json");
  }
};

// The command descriptor: the handler above plus the one-line summary the group usage screen lists it by, so the listing derives from the same object that dispatches.
export const watchRaw: CommandSpec = {

  run: rawHandler,
  summary: "Stream every raw packet as NDJSON, the capture rail."
};

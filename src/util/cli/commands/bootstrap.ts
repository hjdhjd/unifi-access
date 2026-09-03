/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * bootstrap.ts: `ufa bootstrap` - the controller's topology document exactly as it sent it. The protocol-capture surface for the whole topology.
 */
import { COMMON_OPTIONS, SCRUB_OPTION, createDocumentScrubber, unwrapDocument } from "../shared.ts";
import type { CommandHandler, CommandSpec } from "../shared.ts";
import { parseArgs } from "node:util";
import { renderDocument } from "../output/format.ts";
import { requireSurface } from "../client.ts";

const USAGE = [

  "Usage: ufa bootstrap [--json] [--scrub] [--debug]",
  "",
  "Output the controller's complete topology document - buildings, floors, doors, and the device groups beneath them - as the controller sent it.",
  "This is the uncaptured document rather than the library's reduced state model, so it is the surface for exploring the wire shape.",
  "",
  "Options:",
  "  --json      Emit the document as a single line of JSON, field order preserved.",
  "  --scrub     Pseudonymize identifying values so the document can be shared - one value reads as one stand-in throughout a run.",
  "  --debug     Emit the library's debug logging to stderr.",
  "  -h, --help  Show this help.",
  "",
  "Examples:",
  "  ufa bootstrap          # the document, readably",
  "  ufa bootstrap --json | jq .  # the document, for capture and inspection",
  "  ufa bootstrap --json --scrub > topology.json  # a capture with no real names, addresses, or identifiers in it"
].join("\n");

// The option set: the common flags, the capture scrub, and the output selector every read command shares.
const OPTIONS = {

  ...COMMON_OPTIONS,
  ...SCRUB_OPTION,
  json: { type: "boolean" }
} as const;

/**
 * `ufa bootstrap`. Fetches the topology document on demand and prints it. The library's fetch answers with the response body verbatim, envelope and all, because its
 * contract is a faithful dump; peeling that envelope to the document beneath is a presentation choice and so it happens here. Credential surface: the topology is
 * served by the Access application's own endpoints alone, so a token-only configuration is refused before anything connects.
 *
 * @category CLI
 */
const bootstrapHandler: CommandHandler = async (ctx) => {

  const { values } = parseArgs({ allowPositionals: true, args: ctx.args, options: OPTIONS, strict: true });

  if(values.help === true) {

    ctx.output.line(USAGE);

    return;
  }

  const credentials = await ctx.loadCredentials();

  requireSurface(credentials, "credential", "bootstrap command");

  // A read-and-exit invocation, so the periodic bootstrap-refresh failsafe is switched off: there is no long-lived session for it to guard.
  await using client = await ctx.openClient({ credentials, debug: values.debug === true, refreshIntervalMs: false, signal: ctx.signal });

  // The scrub applies to the document as fetched, before the envelope is peeled, so what the operator sees and what a capture carries are the same pseudonymized
  // record whichever format was asked for.
  const document = createDocumentScrubber(values.scrub === true)(await client.fetchBootstrap({ signal: ctx.signal }));

  renderDocument(ctx.output, unwrapDocument(document), (values.json === true) ? "json" : "default");
};

// The command descriptor: the handler above plus the one-line summary the usage screen lists it by, so the listing derives from the same object that dispatches.
export const bootstrap: CommandSpec = {

  run: bootstrapHandler,
  summary: "Output the controller's complete topology document."
};

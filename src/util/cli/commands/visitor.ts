/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * visitor.ts: `ufa visitor <list|show>` - the operator-scoped visitor commands over the official API's visitor domain.
 */
import { COMMON_OPTIONS, CliError, SCRUB_OPTION, commandList, createDocumentScrubber, groupCommand } from "../shared.ts";
import type { CommandContext, CommandSpec } from "../shared.ts";
import { openOfficialClient, requireOfficial } from "../client.ts";
import type { AccessOfficialVisitor } from "../../../index.ts";
import { alignedList } from "../output/format.ts";
import { findOfficialRecord } from "../lookup.ts";
import { parseArgs } from "node:util";
import { renderDocument } from "../output/format.ts";

// What the refusal wording names this group's operations.
const OPERATION = "visitor commands";

// A visitor's display name. The visitor record carries no canonical full-name member - first and last name are its only spellings - so the join is the fallback the
// record's own shape leaves us.
function visitorName(record: AccessOfficialVisitor): string {

  return (record.first_name + " " + record.last_name).trim();
}

const LIST_USAGE = [

  "Usage: ufa visitor list [--json] [--scrub] [--debug]",
  "",
  "List the controller's visitors: one line per visitor with the name, id, and visit window, or the records verbatim with --json.",
  "",
  "Options:",
  "  --json      Emit the visitor records as a single line of JSON, field order preserved.",
  "  --scrub     Pseudonymize identifying values so the listing can be shared - one value reads as one stand-in throughout a run.",
  "  --debug     Emit the library's debug logging to stderr.",
  "  -h, --help  Show this help."
].join("\n");

/** `ufa visitor list`. Prints the visitor listing the official API answers. */
const listHandler = async (ctx: CommandContext): Promise<void> => {

  const { values } = parseArgs({ allowPositionals: true, args: ctx.args,
    options: { ...COMMON_OPTIONS, ...SCRUB_OPTION, json: { type: "boolean" } }, strict: true });

  if(values.help === true) {

    ctx.output.line(LIST_USAGE);

    return;
  }

  await using client = await openOfficialClient(ctx, OPERATION, { debug: values.debug === true });

  // The records are scrubbed where they arrive rather than where they render, so the aligned listing below and the JSON view carry exactly the same stand-ins.
  const scrubDocument = createDocumentScrubber(values.scrub === true);
  const records = scrubDocument((await requireOfficial(client, OPERATION).visitors.fetchAll({}, { signal: ctx.signal })).data);

  if(values.json === true) {

    renderDocument(ctx.output, records, "json");

    return;
  }

  for(const line of alignedList(records.map((record) => [ visitorName(record), record.id + "  " + new Date(record.start_time * 1000).toISOString() + " to " +
    new Date(record.end_time * 1000).toISOString() ] as const))) {

    ctx.output.line(line);
  }
};

const SHOW_USAGE = [

  "Usage: ufa visitor show <VISITOR> [--json] [--scrub] [--debug]",
  "",
  "Print one visitor's record, named by id or name.",
  "",
  "Options:",
  "  --json      Emit the record as a single line of JSON, field order preserved.",
  "  --scrub     Pseudonymize identifying values so the record can be shared - one value reads as one stand-in throughout a run.",
  "  --debug     Emit the library's debug logging to stderr.",
  "  -h, --help  Show this help."
].join("\n");

/** `ufa visitor show`. Resolves the visitor and prints the record the official API answers for it. */
const showHandler = async (ctx: CommandContext): Promise<void> => {

  const { positionals, values } = parseArgs({ allowPositionals: true, args: ctx.args,
    options: { ...COMMON_OPTIONS, ...SCRUB_OPTION, json: { type: "boolean" } }, strict: true });

  if(values.help === true) {

    ctx.output.line(SHOW_USAGE);

    return;
  }

  const [target] = positionals;

  if((target === undefined) || (positionals.length > 1)) {

    throw new CliError("Specify one visitor by id or name. Run \"ufa visitor show --help\" for usage.", { exitCode: 2 });
  }

  await using client = await openOfficialClient(ctx, OPERATION, { debug: values.debug === true });

  const visitors = requireOfficial(client, OPERATION).visitors;
  const record = findOfficialRecord((await visitors.fetchAll({}, { signal: ctx.signal })).data, target, { kind: "visitor", name: visitorName });
  const scrubDocument = createDocumentScrubber(values.scrub === true);

  renderDocument(ctx.output, scrubDocument(await visitors.fetch(record.id, { signal: ctx.signal })), (values.json === true) ? "json" : "default");
};

// The visitor subcommand table. The dispatcher, the usage text, and the unknown-subcommand diagnostic all derive from it through the shared group composer.
const SUBCOMMANDS: Record<string, CommandSpec> = {

  list: { run: listHandler, summary: "List the controller's visitors." },
  show: { run: showHandler, summary: "Print one visitor's record." }
};

const USAGE = [

  "Usage: ufa visitor <subcommand> [options]",
  "",
  "Subcommands:",
  ...commandList(SUBCOMMANDS),
  "",
  "Visitors resolve by id first, then by a case-insensitive exact match on the first and last name together. Official API surface.",
  "",
  "Run \"ufa visitor <subcommand> --help\" for subcommand options."
].join("\n");

/** `ufa visitor`. The visitor command group, composed through the shared group dispatcher. */
export const visitor: CommandSpec = groupCommand({ commands: SUBCOMMANDS, group: "visitor", summary: "List and inspect visitors.", usage: USAGE });

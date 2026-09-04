/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * logs.ts: `ufa logs <search|export>` - the system activity log: the searchable record and its CSV export, over the official API's log domain.
 */
import { COMMON_OPTIONS, CliError, SCRUB_OPTION, commandList, createDocumentScrubber, groupCommand, isMember, writeByteSink } from "../shared.ts";
import type { CommandContext, CommandSpec } from "../shared.ts";
import { openOfficialClient, requireOfficial } from "../client.ts";
import type { AccessOfficialSystemLogTopic } from "../../../index.ts";
import { parseArgs } from "node:util";
import { renderDocument } from "../output/format.ts";

// What the refusal wording names this group's operations.
const OPERATION = "logs commands";

// The searchable topics - the library vocabulary verbatim, satisfies-linked so a library rename breaks the compile rather than drifting this copy.
const LOG_TOPICS = [ "admin_activity", "critical", "device_events", "door_openings", "updates", "visitor" ] as const satisfies readonly AccessOfficialSystemLogTopic[];

// Validate a --topic value against the topic vocabulary.
function parseTopic(value: string): AccessOfficialSystemLogTopic {

  if(!isMember(LOG_TOPICS, value)) {

    throw new CliError("The --topic value must be one of: " + LOG_TOPICS.join(", ") + ", but received \"" + value + "\".", { exitCode: 2 });
  }

  return value;
}

// Convert a --since/--until value to the unix epoch seconds the wire speaks. The operator writes either an ISO 8601 date-time or bare epoch seconds; the conversion
// happens here, at the CLI's own boundary, so the library types stay the wire's truth.
function parseWhen(value: string, flag: string): number {

  if(/^\d+$/.test(value)) {

    return Number(value);
  }

  const parsed = Date.parse(value);

  if(Number.isNaN(parsed)) {

    throw new CliError("The " + flag + " value must be an ISO 8601 date-time (e.g. 2026-08-01T00:00:00Z) or unix epoch seconds, but received \"" + value + "\".",
      { exitCode: 2 });
  }

  return Math.floor(parsed / 1000);
}

const SEARCH_USAGE = [

  "Usage: ufa logs search --topic TOPIC [--since WHEN] [--until WHEN] [--actor ID] [--json] [--scrub] [--debug]",
  "",
  "Search the system activity log. Each hit prints as one line - timestamp, actor, and event - or verbatim with --json.",
  "",
  "Options:",
  "  --topic TOPIC  Required. One of: " + LOG_TOPICS.join(", ") + ".",
  "  --since WHEN   Only entries at or after this time: an ISO 8601 date-time, or unix epoch seconds.",
  "  --until WHEN   Only entries at or before this time, in the same forms.",
  "  --actor ID     Only entries attributed to this actor id.",
  "  --json         Emit the hits as a single line of JSON, field order preserved.",
  "  --scrub        Pseudonymize identifying values so the hits can be shared - one value reads as one stand-in throughout a run.",
  "  --debug        Emit the library's debug logging to stderr.",
  "  -h, --help     Show this help.",
  "",
  "Examples:",
  "  ufa logs search --topic door_openings                          # recent door activity",
  "  ufa logs search --topic critical --since 2026-08-01T00:00:00Z  # critical entries since August"
].join("\n");

/** `ufa logs search`. Queries the log with the wire's own required topic and optional window, and prints each hit. */
const searchHandler = async (ctx: CommandContext): Promise<void> => {

  const { values } = parseArgs({ allowPositionals: true, args: ctx.args,
    options: { ...COMMON_OPTIONS, ...SCRUB_OPTION, actor: { type: "string" }, json: { type: "boolean" }, since: { type: "string" }, topic: { type: "string" },
      until: { type: "string" } }, strict: true });

  if(values.help === true) {

    ctx.output.line(SEARCH_USAGE);

    return;
  }

  if(values.topic === undefined) {

    throw new CliError("Specify the topic to search with --topic. Run \"ufa logs search --help\" for usage.", { exitCode: 2 });
  }

  const topic = parseTopic(values.topic);
  const since = (values.since !== undefined) ? parseWhen(values.since, "--since") : undefined;
  const until = (values.until !== undefined) ? parseWhen(values.until, "--until") : undefined;

  await using client = await openOfficialClient(ctx, OPERATION, { debug: values.debug === true });

  const result = await requireOfficial(client, OPERATION).logs.fetch({ ...((values.actor !== undefined) && { "actor_id": values.actor }),
    ...((since !== undefined) && { since }), topic, ...((until !== undefined) && { until }) }, { signal: ctx.signal });

  // The hits are scrubbed where they arrive rather than where they render, so the per-hit lines below and the JSON view carry exactly the same stand-ins.
  const hits = createDocumentScrubber(values.scrub === true)(result.data.hits);

  if(values.json === true) {

    renderDocument(ctx.output, hits, "json");

    return;
  }

  for(const hit of hits) {

    ctx.output.line(hit["@timestamp"] + "  " + hit._source.actor.display_name + "  " + hit._source.event.type);
  }
};

const EXPORT_USAGE = [

  "Usage: ufa logs export --topic TOPIC --since WHEN --until WHEN [--out FILE] [--timezone TZ] [--actor ID] [--debug]",
  "",
  "Export log entries as CSV. The wire requires the whole window - topic, since, and until - and a timezone to render timestamps in; the window",
  "cannot exceed one month, which the controller itself enforces. The bytes go to --out: a path writes the file, - (or a pipe) writes stdout.",
  "",
  "Options:",
  "  --topic TOPIC   Required. One of: " + LOG_TOPICS.join(", ") + ".",
  "  --since WHEN    Required. An ISO 8601 date-time, or unix epoch seconds.",
  "  --until WHEN    Required, in the same forms.",
  "  --out FILE      Where the CSV bytes go: a path, or - for stdout. Omitted, stdout when piped.",
  "  --timezone TZ   The IANA zone to render timestamps in; defaults to this host's own zone.",
  "  --actor ID      Only entries attributed to this actor id.",
  "  --debug         Emit the library's debug logging to stderr.",
  "  -h, --help      Show this help.",
  "",
  "Examples:",
  "  ufa logs export --topic door_openings --since 2026-08-01 --until 2026-08-15 --out doors.csv"
].join("\n");

/** `ufa logs export`. Exports the CSV the controller renders for the window, through the shared byte sink. */
const exportHandler = async (ctx: CommandContext): Promise<void> => {

  const { values } = parseArgs({ allowPositionals: true, args: ctx.args,
    options: { ...COMMON_OPTIONS, actor: { type: "string" }, out: { type: "string" }, since: { type: "string" }, timezone: { type: "string" },
      topic: { type: "string" }, until: { type: "string" } }, strict: true });

  if(values.help === true) {

    ctx.output.line(EXPORT_USAGE);

    return;
  }

  // The wire's export shape requires the whole window, so the flags that carry it are required too - a missing one is named rather than defaulted, because
  // inventing a window would export something the operator did not ask for.
  if(values.topic === undefined) {

    throw new CliError("The --topic option is required for an export. Run \"ufa logs export --help\" for usage.", { exitCode: 2 });
  }

  if(values.since === undefined) {

    throw new CliError("The --since option is required for an export. Run \"ufa logs export --help\" for usage.", { exitCode: 2 });
  }

  if(values.until === undefined) {

    throw new CliError("The --until option is required for an export. Run \"ufa logs export --help\" for usage.", { exitCode: 2 });
  }

  const topic = parseTopic(values.topic);
  const since = parseWhen(values.since, "--since");
  const until = parseWhen(values.until, "--until");

  // The wire requires the timezone member, so the CLI always supplies it explicitly - the host's own IANA zone unless the operator overrides.
  const timezone = values.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;

  await using client = await openOfficialClient(ctx, OPERATION, { debug: values.debug === true });

  const bytes = await requireOfficial(client, OPERATION).logs.export({ ...((values.actor !== undefined) && { "actor_id": values.actor }), since, timezone, topic,
    until }, { signal: ctx.signal });

  await writeByteSink(ctx.output, bytes, values.out);
};

// The logs subcommand table. The dispatcher, the usage text, and the unknown-subcommand diagnostic all derive from it through the shared group composer.
const SUBCOMMANDS: Record<string, CommandSpec> = {

  export: { run: exportHandler, summary: "Export log entries as CSV, to a file or stdout." },
  search: { run: searchHandler, summary: "Search the system activity log." }
};

const USAGE = [

  "Usage: ufa logs <subcommand> [options]",
  "",
  "Subcommands:",
  ...commandList(SUBCOMMANDS),
  "",
  "Official API surface.",
  "",
  "Run \"ufa logs <subcommand> --help\" for subcommand options."
].join("\n");

/** `ufa logs`. The system-log command group, composed through the shared group dispatcher. */
export const logs: CommandSpec = groupCommand({ commands: SUBCOMMANDS, group: "logs", summary: "Search the activity log, or export it as CSV.", usage: USAGE });

/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * user.ts: `ufa user <list|show|avatar>` - the operator-scoped user commands over the official API's user domain.
 */
import type { AccessOfficialUser, AccessOfficialUserSearchResult, OfficialUsers } from "../../../index.ts";
import { COMMON_OPTIONS, CliError, SCRUB_OPTION, commandList, createDocumentScrubber, groupCommand } from "../shared.ts";
import type { CommandContext, CommandSpec } from "../shared.ts";
import { alignedList, renderDocument } from "../output/format.ts";
import { openOfficialClient, requireOfficial } from "../client.ts";
import { parseArgs } from "node:util";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { resolveOfficialRecord } from "../lookup.ts";

// What the refusal wording names this group's operations.
const OPERATION = "user commands";

// Resolve a user by id or canonical full name. The record's own `full_name` is the name of record on a fetched record and on a search hit alike - re-deriving a
// first-plus-last join here would fork the controller's own spelling. Which requests that resolution costs is the lookup module's rule, stated there once for every
// kind of official record.
async function resolveUser(users: OfficialUsers, token: string, signal?: AbortSignal): Promise<AccessOfficialUser> {

  const call = { ...((signal !== undefined) && { signal }) };

  return resolveOfficialRecord(token, { fetch: (id) => users.fetch(id, {}, call), kind: "user", name: (record) => record.full_name,
    search: { name: (hit: AccessOfficialUserSearchResult) => hit.full_name, run: (keyword) => users.iterateSearch({ keyword }, call) },
    walk: () => users.iterateAll({}, call) });
}

const LIST_USAGE = [

  "Usage: ufa user list [--json] [--scrub] [--debug]",
  "",
  "List the controller's users: one line per user with the name, id, and email, or the records verbatim with --json.",
  "",
  "Options:",
  "  --json      Emit the user records as a single line of JSON, field order preserved.",
  "  --scrub     Pseudonymize identifying values so the listing can be shared - one value reads as one stand-in throughout a run.",
  "  --debug     Emit the library's debug logging to stderr.",
  "  -h, --help  Show this help."
].join("\n");

/** `ufa user list`. Prints the user listing the official API answers. */
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
  const records = scrubDocument(await Array.fromAsync(requireOfficial(client, OPERATION).users.iterateAll({}, { signal: ctx.signal })));

  if(values.json === true) {

    renderDocument(ctx.output, records, "json");

    return;
  }

  for(const line of alignedList(records.map((record) => [ record.full_name, record.id + "  " + record.email ] as const))) {

    ctx.output.line(line);
  }
};

const SHOW_USAGE = [

  "Usage: ufa user show <USER> [--json] [--scrub] [--debug]",
  "",
  "Print one user's record, named by id or full name.",
  "",
  "Options:",
  "  --json      Emit the record as a single line of JSON, field order preserved.",
  "  --scrub     Pseudonymize identifying values so the record can be shared - one value reads as one stand-in throughout a run.",
  "  --debug     Emit the library's debug logging to stderr.",
  "  -h, --help  Show this help."
].join("\n");

/** `ufa user show`. Resolves the user and prints the record the official API answers for it. */
const showHandler = async (ctx: CommandContext): Promise<void> => {

  const { positionals, values } = parseArgs({ allowPositionals: true, args: ctx.args,
    options: { ...COMMON_OPTIONS, ...SCRUB_OPTION, json: { type: "boolean" } }, strict: true });

  if(values.help === true) {

    ctx.output.line(SHOW_USAGE);

    return;
  }

  const [target] = positionals;

  if((target === undefined) || (positionals.length > 1)) {

    throw new CliError("Specify one user by id or full name. Run \"ufa user show --help\" for usage.", { exitCode: 2 });
  }

  await using client = await openOfficialClient(ctx, OPERATION, { debug: values.debug === true });

  const users = requireOfficial(client, OPERATION).users;
  const record = await resolveUser(users, target, ctx.signal);
  const scrubDocument = createDocumentScrubber(values.scrub === true);

  renderDocument(ctx.output, scrubDocument(record), (values.json === true) ? "json" : "default");
};

const AVATAR_USAGE = [

  "Usage: ufa user avatar <USER> <FILE> [--scrub] [--debug]",
  "",
  "Upload a user's profile picture from an image file, and print the avatar record the controller answers with.",
  "Requires UniFi Access 3.3.10 or later, and applies to local users only.",
  "",
  "Options:",
  "  --scrub     Pseudonymize identifying values in the record printed afterwards - one value reads as one stand-in throughout a run.",
  "  --debug     Emit the library's debug logging to stderr.",
  "  -h, --help  Show this help.",
  "",
  "Examples:",
  "  ufa user avatar \"Jane Smith\" ./jane.jpg   # upload a profile picture"
].join("\n");

/** `ufa user avatar`. Reads the image bytes and uploads them through the official API's multipart path, reporting where the picture now lives. */
const avatarHandler = async (ctx: CommandContext): Promise<void> => {

  const { positionals, values } = parseArgs({ allowPositionals: true, args: ctx.args, options: { ...COMMON_OPTIONS, ...SCRUB_OPTION }, strict: true });

  if(values.help === true) {

    ctx.output.line(AVATAR_USAGE);

    return;
  }

  const [ target, file ] = positionals;

  if((target === undefined) || (file === undefined) || (positionals.length > 2)) {

    throw new CliError("Specify one user by id or full name, and an image file. Run \"ufa user avatar --help\" for usage.", { exitCode: 2 });
  }

  // A read failure - a missing file, a directory, a permission problem - is the operator's own input, so it earns a calm usage error rather than a stack.
  let data: Buffer;

  try {

    data = await readFile(file);
  } catch(error) {

    throw new CliError("Unable to read the image file \"" + file + "\".", { cause: error, exitCode: 2 });
  }

  await using client = await openOfficialClient(ctx, OPERATION, { debug: values.debug === true });

  const users = requireOfficial(client, OPERATION).users;
  const record = await resolveUser(users, target, ctx.signal);
  const scrubDocument = createDocumentScrubber(values.scrub === true);

  renderDocument(ctx.output, scrubDocument(await users.uploadAvatar(record.id, { data, filename: path.basename(file) }, { signal: ctx.signal })), "default");
};

// The user subcommand table. The dispatcher, the usage text, and the unknown-subcommand diagnostic all derive from it through the shared group composer.
const SUBCOMMANDS: Record<string, CommandSpec> = {

  avatar: { run: avatarHandler, summary: "Upload a user's profile picture from a file." },
  list: { run: listHandler, summary: "List the controller's users." },
  show: { run: showHandler, summary: "Print one user's record." }
};

const USAGE = [

  "Usage: ufa user <subcommand> [options]",
  "",
  "Subcommands:",
  ...commandList(SUBCOMMANDS),
  "",
  "Users resolve by id first, then by a case-insensitive exact match on the full name. Official API surface.",
  "",
  "Run \"ufa user <subcommand> --help\" for subcommand options."
].join("\n");

/** `ufa user`. The user command group, composed through the shared group dispatcher. */
export const user: CommandSpec = groupCommand({ commands: SUBCOMMANDS, group: "user", summary: "List and inspect users, and upload profile pictures.",
  usage: USAGE });

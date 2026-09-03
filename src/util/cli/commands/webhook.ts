/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * webhook.ts: `ufa webhook <list|add|remove>` - webhook endpoint administration over the official API's webhook domain.
 */
import { COMMON_OPTIONS, CliError, SCRUB_OPTION, commandList, createDocumentScrubber, groupCommand, parseList } from "../shared.ts";
import type { CommandContext, CommandSpec } from "../shared.ts";
import { openOfficialClient, requireOfficial } from "../client.ts";
import type { AccessOfficialWebhookEventName } from "../../../index.ts";
import { findOfficialRecord } from "../lookup.ts";
import { parseArgs } from "node:util";
import { renderDocument } from "../output/format.ts";

// What the refusal wording names this group's operations.
const OPERATION = "webhook commands";

const LIST_USAGE = [

  "Usage: ufa webhook list [--json] [--scrub] [--debug]",
  "",
  "List the registered webhook endpoints, each with the events it receives and its signing secret - the controller keeps the secret readable,",
  "so this is where to recover one.",
  "",
  "Options:",
  "  --json      Emit the endpoint records as a single line of JSON, field order preserved.",
  "  --scrub     Clear the secrets and delivery headers, and pseudonymize the rest, so the listing can be shared.",
  "  --debug     Emit the library's debug logging to stderr.",
  "  -h, --help  Show this help."
].join("\n");

/** `ufa webhook list`. Prints the registered endpoints, secrets included. */
const listHandler = async (ctx: CommandContext): Promise<void> => {

  const { values } = parseArgs({ allowPositionals: true, args: ctx.args,
    options: { ...COMMON_OPTIONS, ...SCRUB_OPTION, json: { type: "boolean" } }, strict: true });

  if(values.help === true) {

    ctx.output.line(LIST_USAGE);

    return;
  }

  await using client = await openOfficialClient(ctx, OPERATION, { debug: values.debug === true });

  const scrubDocument = createDocumentScrubber(values.scrub === true);
  const records = scrubDocument(await requireOfficial(client, OPERATION).webhooks.fetchAllEndpoints({ signal: ctx.signal }));

  renderDocument(ctx.output, records, (values.json === true) ? "json" : "default");
};

const ADD_USAGE = [

  "Usage: ufa webhook add <NAME> <URL> --events a,b,c [--header KEY:VALUE]... [--json] [--scrub] [--debug]",
  "",
  "Register a webhook endpoint and print the created record. The controller mints the signing secret and the record carries it; the list",
  "command reads it back at any time.",
  "",
  "Options:",
  "  --events a,b,c      Required. The event names to deliver, comma-separated; the controller validates the names.",
  "  --header KEY:VALUE  A header sent with every delivery (for a receiver behind its own authentication). Repeatable.",
  "  --json              Emit the created record as a single line of JSON, field order preserved.",
  "  --scrub             Clear the minted secret and the delivery headers, and pseudonymize the rest, in the record printed afterwards.",
  "  --debug             Emit the library's debug logging to stderr.",
  "  -h, --help          Show this help.",
  "",
  "Examples:",
  "  ufa webhook add alerts https://example.net/hook --events access.door.unlock",
  "  ufa webhook add alerts https://example.net/hook --events a,b --header \"Authorization:Bearer t0ken\""
].join("\n");

/** `ufa webhook add`. Registers an endpoint with the wire's own write shape - name, url, required events, optional headers - and prints the created record. */
const addHandler = async (ctx: CommandContext): Promise<void> => {

  const { positionals, values } = parseArgs({ allowPositionals: true, args: ctx.args,
    options: { ...COMMON_OPTIONS, ...SCRUB_OPTION, events: { type: "string" }, header: { multiple: true, type: "string" }, json: { type: "boolean" } },
    strict: true });

  if(values.help === true) {

    ctx.output.line(ADD_USAGE);

    return;
  }

  const [ name, endpoint ] = positionals;

  if((name === undefined) || (endpoint === undefined) || (positionals.length > 2)) {

    throw new CliError("Specify a name and a delivery URL. Run \"ufa webhook add --help\" for usage.", { exitCode: 2 });
  }

  /* The event names cross into the library's union by the one documented cast at this compose site: the union is compile-time only and the names pass through to the
   * controller's own validation, so a CLI-side name list would fork the vocabulary rather than enforce it.
   */
  const events = parseList(values.events) as readonly AccessOfficialWebhookEventName[];

  if(events.length === 0) {

    throw new CliError("Specify the events to deliver with --events. Run \"ufa webhook add --help\" for usage.", { exitCode: 2 });
  }

  // Each --header splits on the first colon, because a header value - an Authorization bearer above all - may itself carry colons.
  const headers: Record<string, string> = {};

  for(const header of values.header ?? []) {

    const split = header.indexOf(":");
    const key = (split > 0) ? header.substring(0, split) : "";
    const value = (split > 0) ? header.substring(split + 1) : "";

    if((key.length === 0) || (value.length === 0)) {

      throw new CliError("The --header value must be a KEY:VALUE pair, but received \"" + header + "\".", { exitCode: 2 });
    }

    headers[key] = value;
  }

  await using client = await openOfficialClient(ctx, OPERATION, { debug: values.debug === true });

  const scrubDocument = createDocumentScrubber(values.scrub === true);
  const record = scrubDocument(await requireOfficial(client, OPERATION).webhooks.createEndpoint({ endpoint, events,
    ...((Object.keys(headers).length > 0) && { headers }), name }, { signal: ctx.signal }));

  renderDocument(ctx.output, record, (values.json === true) ? "json" : "default");
};

const REMOVE_USAGE = [

  "Usage: ufa webhook remove <ID_OR_NAME> [--debug]",
  "",
  "Unregister a webhook endpoint, named by its id or its name.",
  "",
  "Options:",
  "  --debug     Emit the library's debug logging to stderr.",
  "  -h, --help  Show this help."
].join("\n");

/** `ufa webhook remove`. Resolves the endpoint against the fetched list and unregisters it. */
const removeHandler = async (ctx: CommandContext): Promise<void> => {

  const { positionals, values } = parseArgs({ allowPositionals: true, args: ctx.args, options: { ...COMMON_OPTIONS }, strict: true });

  if(values.help === true) {

    ctx.output.line(REMOVE_USAGE);

    return;
  }

  const [target] = positionals;

  if((target === undefined) || (positionals.length > 1)) {

    throw new CliError("Specify one webhook endpoint by id or name. Run \"ufa webhook remove --help\" for usage.", { exitCode: 2 });
  }

  await using client = await openOfficialClient(ctx, OPERATION, { debug: values.debug === true });

  const webhooks = requireOfficial(client, OPERATION).webhooks;
  const record = findOfficialRecord(await webhooks.fetchAllEndpoints({ signal: ctx.signal }), target, { kind: "webhook endpoint", name: (endpoint) => endpoint.name });

  await webhooks.deleteEndpoint(record.id, { signal: ctx.signal });

  ctx.output.line(record.name + " (" + record.id + ") - removed.");
};

// The webhook subcommand table. The dispatcher, the usage text, and the unknown-subcommand diagnostic all derive from it through the shared group composer.
const SUBCOMMANDS: Record<string, CommandSpec> = {

  add: { run: addHandler, summary: "Register a webhook endpoint and print the created record." },
  list: { run: listHandler, summary: "List the registered webhook endpoints, secrets included." },
  remove: { run: removeHandler, summary: "Unregister a webhook endpoint." }
};

const USAGE = [

  "Usage: ufa webhook <subcommand> [options]",
  "",
  "Subcommands:",
  ...commandList(SUBCOMMANDS),
  "",
  "Replacing an endpoint's whole registration rides the api hatch (PUT /webhooks/endpoints/:id takes the full record). Official API surface.",
  "",
  "Run \"ufa webhook <subcommand> --help\" for subcommand options."
].join("\n");

/** `ufa webhook`. The webhook administration group, composed through the shared group dispatcher. */
export const webhook: CommandSpec = groupCommand({ commands: SUBCOMMANDS, group: "webhook", summary: "List, register, and remove webhook endpoints.",
  usage: USAGE });

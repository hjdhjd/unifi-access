/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * api.ts: `ufa api <get|post|put|delete>` - the generic hatch over the official facade's request, command, and download arms.
 */
import { COMMON_OPTIONS, CliError, SCRUB_OPTION, createDocumentScrubber, writeByteSink } from "../shared.ts";
import type { CommandContext, CommandSpec, DocumentScrubber } from "../shared.ts";
import { Output, renderDocument } from "../output/format.ts";
import { openOfficialClient, requireOfficial } from "../client.ts";
import type { AccessOfficialResult } from "../../../index.ts";
import { parseArgs } from "node:util";

// What the refusal wording names this command.
const OPERATION = "api command";

// The verb vocabulary, each mapped to the HTTP method it sends.
const METHODS = { delete: "DELETE", get: "GET", post: "POST", put: "PUT" } as const;

const USAGE = [

  "Usage: ufa api <get|post|put|delete> /path [--json BODY] [--out FILE] [--print] [--scrub] [--debug]",
  "",
  "Send a request to any official API endpoint, documented or not, below the application prefix - the same envelope handling, error",
  "classification, and encoding the typed commands get. This is how everything the named commands do not cover stays reachable.",
  "",
  "A get prints the endpoint's result - the payload, plus its pagination when the endpoint paginates - as one line of wire-order JSON; with",
  "--out, the raw bytes go to the byte sink instead (a path writes the file, - or a pipe writes stdout). A mutation prints a confirmation to",
  "stderr and nothing to stdout, or the echoed payload with --print.",
  "",
  "Options:",
  "  --json BODY  The request body, as JSON. Mutations only.",
  "  --out FILE   Fetch raw bytes to a path, or - for stdout. Gets only.",
  "  --print      Print the payload a mutation echoes. Mutations only.",
  "  --scrub      Pseudonymize identifying values in the printed document so it can be shared - one value reads as one stand-in throughout a run.",
  "  --debug      Emit the library's debug logging to stderr.",
  "  -h, --help   Show this help.",
  "",
  "Examples:",
  "  ufa api get /doors | jq '.[].full_name'                     # every door name",
  "  ufa api get /system/static/avatar/abc123 --out avatar.jpg   # raw bytes to a file",
  "  ufa api put /doors/abc123/unlock                            # an unlock, by hand",
  "  ufa api post /visitors --json '{\"first_name\": \"Guest\"}' --print"
].join("\n");

// Narrow the verb positional to the method vocabulary's own keys.
function isApiVerb(value: string): value is keyof typeof METHODS {

  return value in METHODS;
}

// Print what a request answered with: the payload, plus its pagination when the endpoint paginates - the pagination would be silently lost if only the payload
// printed. The payload alone is the wire document, so that is what the scrub sees, and the envelope is composed around the result afterwards.
function emitResult(output: Output, result: AccessOfficialResult<unknown>, scrubDocument: DocumentScrubber): void {

  const document = scrubDocument(result.data);

  renderDocument(output, (result.pagination !== undefined) ? { data: document, pagination: result.pagination } : document, "json");
}

/**
 * `ufa api`. Maps the verb onto the facade's generic arms: a get goes through `request` (or `download` with --out), and a mutation goes through `command` - success
 * with nothing worth reading - unless --print asks for the echoed payload through `request`. The path is taken verbatim below the application prefix, and the
 * controller is the validator of everything beyond its shape.
 *
 * @category CLI
 */
const apiHandler = async (ctx: CommandContext): Promise<void> => {

  const { positionals, values } = parseArgs({ allowPositionals: true, args: ctx.args,
    options: { ...COMMON_OPTIONS, ...SCRUB_OPTION, json: { type: "string" }, out: { type: "string" }, print: { type: "boolean" } }, strict: true });

  if(values.help === true) {

    ctx.output.line(USAGE);

    return;
  }

  const [ verb, apiPath ] = positionals;

  if((verb === undefined) || (apiPath === undefined) || (positionals.length > 2)) {

    throw new CliError("Specify a verb (get, post, put, delete) and a path. Run \"ufa api --help\" for usage.", { exitCode: 2 });
  }

  if(!isApiVerb(verb)) {

    throw new CliError("The verb must be one of: " + Object.keys(METHODS).join(", ") + ", but received \"" + verb + "\".", { exitCode: 2 });
  }

  if(!apiPath.startsWith("/")) {

    throw new CliError("The path must start with \"/\", below the official API's application prefix, but received \"" + apiPath + "\".", { exitCode: 2 });
  }

  const isGet = verb === "get";

  if(isGet && (values.json !== undefined)) {

    throw new CliError("A get carries no body, so --json applies to mutations only.", { exitCode: 2 });
  }

  if(isGet && (values.print === true)) {

    throw new CliError("A get always prints its result, so --print applies to mutations only.", { exitCode: 2 });
  }

  if(!isGet && (values.out !== undefined)) {

    throw new CliError("The --out byte sink applies to gets only.", { exitCode: 2 });
  }

  // The scrub rewrites a document on its way to the terminal, so it has nothing to act on where no document is printed. Both combinations are refused rather than
  // quietly honored, on the same reasoning as the flag refusals above: a stated rejection is easier to predict than a flag that silently means nothing.
  if((values.scrub === true) && (values.out !== undefined)) {

    throw new CliError("The --scrub flag applies to document output, and --out fetches raw bytes.", { exitCode: 2 });
  }

  if((values.scrub === true) && !isGet && (values.print !== true)) {

    throw new CliError("A mutation prints no document without --print, so --scrub has nothing to act on.", { exitCode: 2 });
  }

  let body: unknown;

  if(values.json !== undefined) {

    try {

      body = JSON.parse(values.json);
    } catch(error) {

      throw new CliError("The --json body is not valid JSON.", { cause: error, exitCode: 2 });
    }
  }

  await using client = await openOfficialClient(ctx, OPERATION, { debug: values.debug === true });

  const official = requireOfficial(client, OPERATION);
  const method = METHODS[verb];
  const scrubDocument = createDocumentScrubber(values.scrub === true);

  if(isGet) {

    if(values.out !== undefined) {

      await writeByteSink(ctx.output, await official.download(apiPath, { signal: ctx.signal }), values.out);

      return;
    }

    emitResult(ctx.output, await official.request<unknown>(apiPath, { signal: ctx.signal }), scrubDocument);

    return;
  }

  if(values.print === true) {

    emitResult(ctx.output, await official.request<unknown>(apiPath, { ...((body !== undefined) && { json: body }), method, signal: ctx.signal }), scrubDocument);

    return;
  }

  await official.command(apiPath, { ...((body !== undefined) && { json: body }), method, signal: ctx.signal });

  // The confirmation goes to stderr, so a scripted mutation's stdout stays empty and composable.
  new Output({ env: ctx.env, stream: process.stderr }).line("The " + method + " request to " + apiPath + " succeeded.");
};

// The command descriptor: the handler above plus the one-line summary the usage screen lists it by, so the listing derives from the same object that dispatches.
export const api: CommandSpec = {

  run: apiHandler,
  summary: "Send a request to any official API endpoint."
};

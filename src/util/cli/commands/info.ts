/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * info.ts: `ufa info [category]` - the controller's information document, and the inventory listings beneath it.
 */
import { COMMON_OPTIONS, CliError, SCRUB_OPTION, createDocumentScrubber, documentDoors, documentFloors, isMember, unwrapDocument } from "../shared.ts";
import type { CommandContext, CommandHandler, CommandSpec } from "../shared.ts";
import type { AccessClient } from "../../../index.ts";
import type { DocumentFormat } from "../output/format.ts";
import { allTargets } from "../lookup.ts";
import { parseArgs } from "node:util";
import { renderDocument } from "../output/format.ts";
import { requireSurface } from "../client.ts";

const USAGE = [

  "Usage: ufa info [devices|hubs|access-points|doors|floors] [--json] [--scrub] [--debug]",
  "",
  "Output the controller's own information document, or one inventory category beneath it.",
  "",
  "Categories:",
  "  devices        Every device record the controller manages, one per Enterprise Access Hub port included.",
  "  hubs           The hub records - the devices that drive a door.",
  "  access-points  The Enterprise Access Hub port records, each driving its own door.",
  "  doors          Every door record in the topology, gathered from each floor.",
  "  floors         The floor records, each with the doors beneath it.",
  "",
  "The door and floor records are the controller's own, complete, rather than the pruned form the library's state model keeps.",
  "",
  "Options:",
  "  --json      Emit the output as a single line of JSON, field order preserved.",
  "  --scrub     Pseudonymize identifying values so the output can be shared - one value reads as one stand-in throughout a run.",
  "  --debug     Emit the library's debug logging to stderr.",
  "  -h, --help  Show this help.",
  "",
  "Examples:",
  "  ufa info                             # the controller document",
  "  ufa info devices --json | jq '.[].name'   # every device name",
  "  ufa info doors                       # every door record"
].join("\n");

// The category vocabulary. Declared once, so the validation diagnostic and the dispatch below cannot disagree about what a category is.
const CATEGORIES = [ "access-points", "devices", "doors", "floors", "hubs" ] as const;

// Answer one category's records. The doors and floors categories read the fetched topology document rather than the state model, because the model prunes each
// record of the members it stores elsewhere and this command's contract is the controller's own record.
async function categoryRecords(client: AccessClient, category: (typeof CATEGORIES)[number], signal: AbortSignal): Promise<unknown> {

  switch(category) {

    case "access-points": {

      return client.accessPoints.map((device) => device.config);
    }

    case "devices": {

      return allTargets(client).map((device) => device.config);
    }

    case "doors": {

      return documentDoors(unwrapDocument(await client.fetchBootstrap({ signal })));
    }

    case "floors": {

      return documentFloors(unwrapDocument(await client.fetchBootstrap({ signal })));
    }

    default: {

      // Hubs carries no case of its own; it is the deliberate fallback for the one category CATEGORIES names that this switch does not spell out explicitly.
      return client.hubs.map((device) => device.config);
    }
  }
}

/**
 * `ufa info`. A bare invocation prints the controller's information document, which connect fetched and every refresh advances; a category prints that inventory.
 * The bare document and the doors, floors, and access-points categories need the credential surface, since they read the topology that only credentials
 * populate; the devices and hubs categories are gated the same way for uniformity, even though the official census alone would answer them without it.
 *
 * @category CLI
 */
const infoHandler: CommandHandler = async (ctx: CommandContext) => {

  const { positionals, values } = parseArgs({ allowPositionals: true, args: ctx.args,
    options: { ...COMMON_OPTIONS, ...SCRUB_OPTION, json: { type: "boolean" } }, strict: true });

  if(values.help === true) {

    ctx.output.line(USAGE);

    return;
  }

  const [category] = positionals;

  if(positionals.length > 1) {

    throw new CliError("Specify at most one category. Run \"ufa info --help\" for usage.", { exitCode: 2 });
  }

  if((category !== undefined) && !isMember(CATEGORIES, category)) {

    throw new CliError("The category must be one of: " + CATEGORIES.join(", ") + ", but received \"" + category + "\".", { exitCode: 2 });
  }

  const credentials = await ctx.loadCredentials();

  requireSurface(credentials, "credential", "info command");

  // A read-and-exit invocation, so the periodic bootstrap-refresh failsafe is switched off: there is no long-lived session for it to guard.
  await using client = await ctx.openClient({ credentials, debug: values.debug === true, refreshIntervalMs: false, signal: ctx.signal });

  const format: DocumentFormat = (values.json === true) ? "json" : "default";

  // Both documents this command can answer with pass through the one scrubber, so the controller's own record and an inventory listing agree on every stand-in when
  // the flag is set, and neither is touched when it is not.
  const scrubDocument = createDocumentScrubber(values.scrub === true);

  if(category === undefined) {

    renderDocument(ctx.output, scrubDocument(client.controllerInfo), format);

    return;
  }

  renderDocument(ctx.output, scrubDocument(await categoryRecords(client, category, ctx.signal)), format);
};

// The command descriptor: the handler above plus the one-line summary the usage screen lists it by, so the listing derives from the same object that dispatches.
export const info: CommandSpec = {

  run: infoHandler,
  summary: "Output the controller document, or one inventory category."
};

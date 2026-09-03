/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * watch-events.ts: `ufa watch events` - the realtime notification firehose with the property-filter grammar, the output formats, and the run bounds.
 */
import { COMMON_OPTIONS, CliError, SCRUB_OPTION, boundedSignal, compileEventFilters, createDocumentScrubber, packetSubjectId, parseDuration, parseList,
  parseNonNegativeInt, resolveValueAtPath, take } from "../shared.ts";
import type { CommandHandler, CommandSpec, EventPredicate } from "../shared.ts";
import type { AccessEventPacket } from "../../../index.ts";
import type { DeviceResolution } from "../lookup.ts";
import type { Output } from "../output/format.ts";
import { buildDeviceResolution } from "../lookup.ts";
import { parseArgs } from "node:util";
import { renderDocument } from "../output/format.ts";

const USAGE = [

  "Usage: ufa watch events [filters...] [--json | --compact | --fields=a,b,c] [--stats] [--count=N] [--duration=30s] [--scrub] [--debug]",
  "",
  "Stream realtime notifications from the controller until Ctrl-C, or until a --count or --duration bound is reached.",
  "",
  "Filter syntax (every filter must match, so filters narrow the stream rather than widening it):",
  "  property=value      Match a property by case-insensitive equality (== is the same operator).",
  "  property!=value     Match everything the equality form would not.",
  "  property~pattern    Match a pattern: plain text matches anywhere in the value, * and ? are wildcards,",
  "                      and /pattern/flags is a regular expression, e.g. event~/^access\\.door/i.",
  "  property!~pattern   Match everything the pattern form would not.",
  "  property>value      Compare numerically; >=, <, and <= work the same way.",
  "",
  "Property paths:",
  "  Top level           event, event_object_id, receiver_id",
  "  Payload             data.device_type, data.name, and anything else the payload carries",
  "  Metadata            meta.id, meta.object_type, meta.source",
  "",
  "Device shortcuts:",
  "  --device=NAME       Match one device by name or id. Repeat it and every one must match, so two names match nothing.",
  "  --hubs              Match hub events only.",
  "  --readers           Match reader events only.",
  "",
  "Event shortcuts:",
  "  --ring              Match doorbell rings.",
  "  --unlock            Match door unlocks, under either name the controller reports them by.",
  "",
  "Output (choose at most one):",
  "  --json              One packet per line as JSON, field order preserved - the capture format.",
  "  --compact           One line per packet: the event name and the device it names.",
  "  --fields=a,b,c      One line per packet as JSON, carrying only these paths.",
  "",
  "Controls:",
  "  --stats             Count events by name and print the tally at the end instead of printing each one.",
  "  --count=N           Stop after N matching events; 0 means no limit.",
  "  --duration=30s      Stop after this long (a positive integer with a unit: ms, s, m, h); omit it for no limit.",
  "  --scrub             Pseudonymize identifying values across the whole stream - one value reads as one stand-in in every packet of the run.",
  "  --debug             Emit the library's debug logging to stderr.",
  "  -h, --help          Show this help.",
  "",
  "Examples:",
  "  ufa watch events                                    # everything",
  "  ufa watch events --ring                             # doorbell rings only",
  "  ufa watch events --device=\"Loading Dock\"          # one device",
  "  ufa watch events event~door                         # any event whose name mentions a door",
  "  ufa watch events event~/^access\\.door/             # a regular expression",
  "  ufa watch events --json --count=10                  # ten packets, as JSON",
  "  ufa watch events --json --scrub --count=50          # fifty packets, pseudonymized for sharing",
  "  ufa watch events --stats --duration=1m              # a one-minute tally by event name"
].join("\n");

// The option set: the common flags, the device and event shortcuts, the output selectors, and the run bounds.
const OPTIONS = {

  ...COMMON_OPTIONS,
  ...SCRUB_OPTION,
  compact: { type: "boolean" },
  count: { type: "string" },
  device: { multiple: true, type: "string" },
  duration: { type: "string" },
  fields: { type: "string" },
  hubs: { type: "boolean" },
  json: { type: "boolean" },
  readers: { type: "boolean" },
  ring: { type: "boolean" },
  stats: { type: "boolean" },
  unlock: { type: "boolean" }
} as const;

// How each surviving packet is rendered.
type EventFormat = "compact" | "default" | "fields" | "json";

// Decide the output format, refusing a combination rather than silently honoring one flag and dropping another: a single stated rejection is both easier to predict
// and impossible to be surprised by.
function selectFormat(values: { compact?: boolean; fields?: string; json?: boolean }): EventFormat {

  const requested: EventFormat[] = [];

  if(values.compact === true) {

    requested.push("compact");
  }

  if(values.fields !== undefined) {

    requested.push("fields");
  }

  if(values.json === true) {

    requested.push("json");
  }

  if(requested.length > 1) {

    throw new CliError("The " + requested.map((format) => "--" + format).join(" and ") + " output flags cannot be combined; choose one.", { exitCode: 2 });
  }

  return requested[0] ?? "default";
}

// Project the requested paths out of a packet, dropping the ones it does not carry, and render the result as one line of JSON. Paths resolve through the same resolver
// the filters use, so `--fields=data.device_type` selects exactly what `data.device_type==UAH` matched on.
function renderFields(output: Output, packet: AccessEventPacket, fields: string[]): void {

  const projected: Record<string, unknown> = {};

  for(const field of fields) {

    const value = resolveValueAtPath(packet, field);

    if(value !== undefined) {

      projected[field] = value;
    }
  }

  output.line(JSON.stringify(projected));
}

// Render one packet in the selected format. The default and JSON renderings are the whole-document renderings every read command uses, so a packet and a topology
// document reach the terminal through one code path.
function renderPacket(output: Output, packet: AccessEventPacket, format: EventFormat, fields: string[], resolve: DeviceResolution): void {

  switch(format) {

    case "compact": {

      const id = packetSubjectId(packet);

      output.line("[" + packet.event + "] " + (resolve.name(id) ?? id));

      break;
    }

    case "fields": {

      renderFields(output, packet, fields);

      break;
    }

    case "json": {

      renderDocument(output, packet, "json");

      break;
    }

    default: {

      renderDocument(output, packet, "default");
    }
  }
}

// Print the tally: the total, then each event name with its count, most frequent first.
function renderStats(output: Output, counts: Map<string, number>): void {

  let total = 0;

  for(const count of counts.values()) {

    total += count;
  }

  output.line();
  output.line("Event Statistics:");
  output.line("  Total events: " + total.toString());
  output.line();
  output.line("  By Event Type:");

  for(const [ name, count ] of [...counts].sort(([ , a ], [ , b ]) => b - a)) {

    output.line("    " + name + ": " + count.toString());
  }
}

// Apply the compiled terms to the firehose. A pure pass-through generator, so it composes with `take`: the early return propagates back through here and into the
// firehose, ending the subscription.
async function *filterPackets(source: AsyncIterable<AccessEventPacket>, filters: EventPredicate[]): AsyncGenerator<AccessEventPacket> {

  for await (const packet of source) {

    if(filters.every((filter) => filter(packet))) {

      yield packet;
    }
  }
}

/**
 * `ufa watch events`. Connects, compiles the filter expression once, then iterates the raw notification firehose, testing each packet against every compiled term and
 * rendering the ones that pass.
 *
 * The raw rail is the right one for this command: it carries every frame the controller sent, the ones the library does not model included, which is what makes this
 * the tool for exploring the wire protocol as well as for watching a door. Filters compile once and name resolution is snapshotted once, so the per-packet path
 * evaluates predicates and reads maps without building anything.
 *
 * @category CLI
 */
const eventsHandler: CommandHandler = async (ctx) => {

  const { positionals, values } = parseArgs({ allowPositionals: true, args: ctx.args, options: OPTIONS, strict: true });

  if(values.help === true) {

    ctx.output.line(USAGE);

    return;
  }

  const format = selectFormat(values);

  // The tally prints event names it counted rather than the packets themselves, so the scrub never reaches a rendered packet on that path. Refused rather than
  // quietly honored, on the same reasoning as the output-flag conflict above.
  if((values.scrub === true) && (values.stats === true)) {

    throw new CliError("The --stats tally counts event names rather than printing packets, so --scrub has nothing to act on.", { exitCode: 2 });
  }

  const fields = parseList(values.fields);
  const limit = (values.count !== undefined) ? parseNonNegativeInt(values.count, "--count") : 0;
  const durationMs = (values.duration !== undefined) ? parseDuration(values.duration, "--duration") : undefined;

  await using client = await ctx.openClient({ debug: values.debug === true, signal: ctx.signal });

  const resolve = buildDeviceResolution(client);
  const filters = compileEventFilters({ resolve,
    shortcuts: { device: values.device, hubs: values.hubs, readers: values.readers, ring: values.ring, unlock: values.unlock }, tokens: positionals });

  /* Both bounds spell "no bound" without a bound: an omitted --duration arms no deadline at all, and a zero count skips the take wrapper, which yields nothing when
   * asked for a non-positive number of values. The duration grammar itself refuses a zero magnitude, so no zero ever reaches the timer.
   */
  const deadline = boundedSignal(ctx.signal, durationMs);
  const counts = new Map<string, number>();
  const matching = filterPackets(client.rawPackets({ signal: deadline }), filters);

  /* One scrubber for the whole stream, applied where a packet enters the rendering path, so every format below reads the pseudonymized packet and one context
   * across the run keeps a device recognizable from one packet to the next.
   *
   * It runs after the filters rather than ahead of them, because the two answer different questions. A filter resolves a device name against the controller's own
   * inventory and compares it against what the packet says, so filtering pseudonymized packets would match nothing the operator asked for. What packets to show is
   * the filter's business; what a shown packet may say is the scrub's.
   */
  const scrubPacket = createDocumentScrubber(values.scrub === true);

  for await (const packet of (limit >= 1) ? take(matching, limit) : matching) {

    if(values.stats === true) {

      counts.set(packet.event, (counts.get(packet.event) ?? 0) + 1);

      continue;
    }

    renderPacket(ctx.output, scrubPacket(packet), format, fields, resolve);
  }

  if(values.stats === true) {

    renderStats(ctx.output, counts);
  }
};

// The command descriptor: the handler above plus the one-line summary the group usage screen lists it by, so the listing derives from the same object that dispatches.
export const watchEvents: CommandSpec = {

  run: eventsHandler,
  summary: "Stream realtime notifications, with filters, formats, and run bounds."
};

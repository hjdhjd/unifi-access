/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * watch-state.ts: `ufa watch state` - the per-door state rail: the seeded snapshot up front, then every change as it lands.
 */
import type { AccessClient, AccessDoorStateEntry } from "../../../index.ts";
import { COMMON_OPTIONS, boundedSignal, parseDuration, parseNonNegativeInt, take } from "../shared.ts";
import type { CommandHandler, CommandSpec } from "../shared.ts";
import type { Output } from "../output/format.ts";
import { alignedList } from "../output/format.ts";
import { parseArgs } from "node:util";
import { selectDoorStates } from "../../../index.ts";

const USAGE = [

  "Usage: ufa watch state [--json] [--count=N] [--duration=30s] [--debug]",
  "",
  "Print the per-door state established at connect, then stream it as it changes, until Ctrl-C or until a --count or --duration bound is reached.",
  "Door state is seeded in every mode - from the topology's hardware readings with credentials, from the official doors read with a token - and",
  "corrected live by the notification stream, so a quiet site still answers immediately with what connect established.",
  "",
  "Options:",
  "  --json           One JSON object per emission, keyed by door id, as NDJSON.",
  "  --count=N        Stop after N changes (the initial snapshot is not counted); 0 means no limit.",
  "  --duration=30s   Stop after this long (a positive integer with a unit: ms, s, m, h); omit it for no limit.",
  "  --debug          Emit the library's debug logging to stderr.",
  "  -h, --help       Show this help.",
  "",
  "Examples:",
  "  ufa watch state                  # the seeded snapshot, then every change",
  "  ufa watch state --json --count=5 # the snapshot and five changes, as NDJSON"
].join("\n");

// Describe one door's state as its established members, staying silent on what no source has said - an absent member is "not established", which is different from
// a reported "none".
function describeEntry(entry: AccessDoorStateEntry): string {

  const parts: string[] = [];

  if(entry.dps !== undefined) {

    parts.push("position " + entry.dps);
  }

  if(entry.lock !== undefined) {

    parts.push("lock " + entry.lock);
  }

  if(entry.dps_connected !== undefined) {

    parts.push("wired " + (entry.dps_connected ? "yes" : "no"));
  }

  return (parts.length > 0) ? parts.join(", ") : "no established state";
}

// Render one emission - the seeded snapshot and every later change go through this same renderer. The default form is one aligned line per door, named through the
// topology's own door records with the id as the fallback; the JSON form is one object keyed by door id, in the map's own order.
function renderStates(output: Output, client: AccessClient, states: ReadonlyMap<string, AccessDoorStateEntry>, json: boolean): void {

  if(json) {

    output.line(JSON.stringify(Object.fromEntries(states)));

    return;
  }

  if(states.size === 0) {

    output.line("No doors carry established state.");

    return;
  }

  const doors = client.state.snapshot().doors;
  const rows = [...states.entries()].map(([ id, entry ]) => [ doors.get(id)?.full_name ?? id, describeEntry(entry) ] as const);

  for(const line of alignedList(rows)) {

    output.line(line);
  }
}

/**
 * `ufa watch state`. Renders the current seeded door-state snapshot once up front, then iterates the store's observation of the same selector, rendering each change.
 * The initial render is not a `--count` draw: the count bounds the changes.
 *
 * @category CLI
 */
const stateHandler: CommandHandler = async (ctx) => {

  const { values } = parseArgs({ allowPositionals: true, args: ctx.args,
    options: { ...COMMON_OPTIONS, count: { type: "string" }, duration: { type: "string" }, json: { type: "boolean" } }, strict: true });

  if(values.help === true) {

    ctx.output.line(USAGE);

    return;
  }

  const limit = (values.count !== undefined) ? parseNonNegativeInt(values.count, "--count") : 0;
  const durationMs = (values.duration !== undefined) ? parseDuration(values.duration, "--duration") : undefined;
  const json = values.json === true;

  await using client = await ctx.openClient({ debug: values.debug === true, signal: ctx.signal });

  const deadline = boundedSignal(ctx.signal, durationMs);

  /* The snapshot read, its render, and the loop's entry into the observation are synchronously adjacent - no await between them - and that ordering is the
   * correctness condition, not a style choice: the observer seeds its change baseline from the state at the moment its generator first runs, so an await in this
   * window would let a change land that neither the rendered snapshot nor any later yield ever shows.
   */
  renderStates(ctx.output, client, selectDoorStates(client.state.snapshot()), json);

  const observation = client.state.observe(selectDoorStates, { signal: deadline });

  for await (const states of (limit >= 1) ? take(observation, limit) : observation) {

    renderStates(ctx.output, client, states, json);
  }
};

// The command descriptor: the handler above plus the one-line summary the group usage screen lists it by, so the listing derives from the same object that dispatches.
export const watchState: CommandSpec = {

  run: stateHandler,
  summary: "Print the seeded door states, then stream them as they change."
};

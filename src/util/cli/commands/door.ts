/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * door.ts: `ufa door <unlock|close|lock-rule|emergency>` - the door command group, acting through the routed hub projections where a handle drives the door and
 * through the official facade's door-addressed surface where none does.
 */
import type { AccessApiOverride, AccessClient, AccessLockRule, AccessOfficialDoorUnlockActor, AccessOfficialEmergencyState,
  AccessStateDoor } from "../../../index.ts";
import { COMMON_OPTIONS, CliError, SCRUB_OPTION, commandList, createDocumentScrubber, groupCommand, isMember, parseWholeMinutes,
  refuseDocumentFlags } from "../shared.ts";
import type { CommandContext, CommandSpec } from "../shared.ts";
import { doorLabel, doorName, findDoorTarget } from "../lookup.ts";
import { requireOfficial, requireSurface } from "../client.ts";
import type { UfaCredentials } from "../credentials.ts";
import { parseArgs } from "node:util";
import { renderDocument } from "../output/format.ts";

// The routing override's accepted spellings - the library vocabulary verbatim, satisfies-linked so a library rename breaks the compile rather than drifting this copy.
const API_OVERRIDES = [ "auto", "direct-only", "official-only" ] as const satisfies readonly AccessApiOverride[];

// The site-wide emergency states - the library's own tri-state vocabulary verbatim, satisfies-linked for the same reason.
const EMERGENCY_STATES = [ "evacuation", "lockdown", "normal" ] as const satisfies readonly AccessOfficialEmergencyState[];

// The lock-rule vocabulary as the CLI spells it, mapped one-to-one onto the wire verbs. The values are satisfies-linked to the library's own rule union, so the map
// cannot drift from the vocabulary it translates; a DURATION argument reaches the `custom` rule through the duration grammar instead of this map.
const LOCK_RULE_VERBS = { "keep-lock": "keep_lock", "keep-unlock": "keep_unlock", "lock-early": "lock_early", "lock-now": "lock_now",
  "reset": "reset" } as const satisfies Record<string, AccessLockRule["type"]>;

// Parse the --api flag into the library's override vocabulary, or refuse an unknown spelling calmly.
function parseApiOverride(value: string | undefined): AccessApiOverride | undefined {

  if(value === undefined) {

    return undefined;
  }

  if(!isMember(API_OVERRIDES, value)) {

    throw new CliError("The --api value must be one of: " + API_OVERRIDES.join(", ") + ", but received \"" + value + "\".", { exitCode: 2 });
  }

  return value;
}

// Parse an --actor value into the official attribution pair, split on the LAST colon so a name may itself carry colons. Both halves are required by the wire's own
// shape, so a missing half is named rather than sent empty.
function parseActor(value: string): AccessOfficialDoorUnlockActor {

  const split = value.lastIndexOf(":");
  const name = (split > 0) ? value.substring(0, split) : "";
  const id = (split > 0) ? value.substring(split + 1) : "";

  if((name.length === 0) || (id.length === 0)) {

    throw new CliError("The --actor value must be a NAME:ID pair, but received \"" + value + "\".", { exitCode: 2 });
  }

  return { id, name };
}

/* The surface a door NO handle drives is commanded on: the published API's door-addressed methods, which are the only ones that can reach it.
 *
 * The conditions that leave a client with nothing to offer such a door refuse in the same words, because from the operator's side they are the same outcome. A client
 * whose token the controller did not honor holds no facade at all; a client held to `--api direct-only` has asked to stay off the one channel that addresses doors
 * directly, and that choice means one channel here as it does everywhere else.
 */
function doorArmSpaces(client: AccessClient, door: AccessStateDoor): NonNullable<AccessClient["official"]>["spaces"] {

  const official = client.official;

  if((official === null) || (client.capabilities.override === "direct-only")) {

    throw new CliError("The door \"" + doorName(door) + "\" is in the topology, but no hub handle drives it.");
  }

  return official.spaces;
}

// What one door invocation established before acting: the loaded identity, the api choice, and the connected client. Every subcommand connects through this one path,
// so the one-shot convention (the refresh failsafe off) and the single credential read are stated once.
async function openDoorClient(ctx: CommandContext, opts: { api?: AccessApiOverride; credentials: UfaCredentials; debug: boolean }): Promise<AccessClient> {

  return ctx.openClient({ ...((opts.api !== undefined) && { api: opts.api }), credentials: opts.credentials, debug: opts.debug, refreshIntervalMs: false,
    signal: ctx.signal });
}

const UNLOCK_USAGE = [

  "Usage: ufa door unlock <DOOR> [--duration 5m] [--hold] [--actor NAME:ID] [--api auto|direct-only|official-only] [--debug]",
  "",
  "Unlock a door. Name it by the hub or port that drives it, or by the topology's own door name, full name, or id.",
  "",
  "Options:",
  "  --duration 5m    Hold the door unlocked for a whole number of minutes (30s refuses; 90m and 2h work), via a custom lock rule.",
  "  --hold           Hold the door unlocked until the rule is reset (the keep-unlock rule).",
  "  --actor NAME:ID  Attribute the unlock to an actor in the controller's logs and webhooks. Official API only, and only for a plain",
  "                   unlock - the lock rules carry no attribution, so --actor cannot combine with --duration or --hold.",
  "  --api VALUE      Hold the command to one API: auto (default), direct-only, or official-only.",
  "  --debug          Emit the library's debug logging to stderr.",
  "  -h, --help       Show this help.",
  "",
  "Examples:",
  "  ufa door unlock \"Loading Dock\"                # unlock, controller default",
  "  ufa door unlock \"Loading Dock\" --duration 30m # hold it unlocked for thirty minutes",
  "  ufa door unlock \"Loading Dock\" --hold         # hold it unlocked until reset"
].join("\n");

/**
 * `ufa door unlock`. A bare invocation unlocks the way the controller's own default does; a duration or hold establishes a lock rule instead; an actor attributes a
 * plain unlock. A door a handle drives is commanded through that handle's projection, whose routing already prefers the official path where one serves; a door no
 * handle drives is commanded through the official facade by door id.
 *
 * @category CLI
 */
const unlockHandler = async (ctx: CommandContext): Promise<void> => {

  const { positionals, values } = parseArgs({ allowPositionals: true, args: ctx.args,
    options: { ...COMMON_OPTIONS, actor: { type: "string" }, api: { type: "string" }, duration: { type: "string" }, hold: { type: "boolean" } }, strict: true });

  if(values.help === true) {

    ctx.output.line(UNLOCK_USAGE);

    return;
  }

  const [target] = positionals;

  if((target === undefined) || (positionals.length > 1)) {

    throw new CliError("Specify one door by name or id. Run \"ufa door unlock --help\" for usage.", { exitCode: 2 });
  }

  if((values.duration !== undefined) && (values.hold === true)) {

    throw new CliError("The --duration and --hold options cannot be combined; choose one.", { exitCode: 2 });
  }

  if((values.actor !== undefined) && ((values.duration !== undefined) || (values.hold === true))) {

    throw new CliError("An attributed unlock cannot carry a lock rule - the wire offers no attribution for rules - so --actor cannot combine with --duration " +
      "or --hold.", { exitCode: 2 });
  }

  const api = parseApiOverride(values.api);
  const actor = (values.actor !== undefined) ? parseActor(values.actor) : undefined;
  const minutes = (values.duration !== undefined) ? parseWholeMinutes(values.duration, "--duration") : undefined;
  const credentials = await ctx.loadCredentials();

  await using client = await openDoorClient(ctx, { ...((api !== undefined) && { api }), credentials, debug: values.debug === true });

  // One resolution, and the confirmation's spelling of the door taken from it before anything is issued.
  const doorTarget = findDoorTarget(client, target);
  const label = doorLabel(doorTarget);

  if(doorTarget.kind === "door") {

    const spaces = doorArmSpaces(client, doorTarget.door);

    if(minutes !== undefined) {

      await spaces.setLockRule(doorTarget.doorId, { interval: minutes, type: "custom" }, { signal: ctx.signal });

      ctx.output.line(label + " - unlocked for " + minutes.toString() + " minutes.");

      return;
    }

    if(values.hold === true) {

      await spaces.setLockRule(doorTarget.doorId, { type: "keep_unlock" }, { signal: ctx.signal });

      ctx.output.line(label + " - unlocked until reset.");

      return;
    }

    await spaces.unlock(doorTarget.doorId, { ...((actor !== undefined) && { actor }) }, { signal: ctx.signal });

    ctx.output.line(label + " - unlocked.");

    return;
  }

  const hub = doorTarget.hub;

  if(minutes !== undefined) {

    await hub.setLockRule({ interval: minutes, type: "custom" }, { signal: ctx.signal });

    ctx.output.line(label + " - unlocked for " + minutes.toString() + " minutes.");

    return;
  }

  if(values.hold === true) {

    await hub.setLockRule({ type: "keep_unlock" }, { signal: ctx.signal });

    ctx.output.line(label + " - unlocked until reset.");

    return;
  }

  await hub.unlock({ ...((actor !== undefined) && { actor }), signal: ctx.signal });

  ctx.output.line(label + " - unlocked.");
};

const CLOSE_USAGE = [

  "Usage: ufa door close <DOOR> [--api auto|direct-only|official-only] [--debug]",
  "",
  "Close a door, ending an unlock that is holding it open. Name it by the hub or port that drives it, or by the topology's own door name, full",
  "name, or id.",
  "Close acts on either API: the Access application's own close command with credentials, the official API's gate control command with a token.",
  "Close belongs to gate hardware - a door hub refuses it on both APIs. To end a held-open unlock on a door hub, reset its lock rule instead.",
  "",
  "Options:",
  "  --api VALUE  Hold the command to one API: auto (default), direct-only, or official-only.",
  "  --debug      Emit the library's debug logging to stderr.",
  "  -h, --help   Show this help.",
  "",
  "Examples:",
  "  ufa door close \"Front Gate\"                # end a held-open unlock on gate hardware",
  "  ufa door lock-rule \"Loading Dock\" reset    # the door-hub way to end a held-open unlock"
].join("\n");

/**
 * `ufa door close`. The other half of the two-button surface a gate presents: unlock begins, this ends. A door a handle drives is closed through that handle's
 * projection, whose routing takes the close command the hardware proves; a door no handle drives is closed through the official facade's gate control command.
 *
 * @category CLI
 */
const closeHandler = async (ctx: CommandContext): Promise<void> => {

  const { positionals, values } = parseArgs({ allowPositionals: true, args: ctx.args,
    options: { ...COMMON_OPTIONS, api: { type: "string" } }, strict: true });

  if(values.help === true) {

    ctx.output.line(CLOSE_USAGE);

    return;
  }

  const [target] = positionals;

  if((target === undefined) || (positionals.length > 1)) {

    throw new CliError("Specify one door by name or id. Run \"ufa door close --help\" for usage.", { exitCode: 2 });
  }

  const api = parseApiOverride(values.api);
  const credentials = await ctx.loadCredentials();

  await using client = await openDoorClient(ctx, { ...((api !== undefined) && { api }), credentials, debug: values.debug === true });

  const doorTarget = findDoorTarget(client, target);
  const label = doorLabel(doorTarget);

  if(doorTarget.kind === "door") {

    await doorArmSpaces(client, doorTarget.door).unlock(doorTarget.doorId, { controlCmd: "close" }, { signal: ctx.signal });
  } else {

    await doorTarget.hub.close({ signal: ctx.signal });
  }

  ctx.output.line(label + " - closed.");
};

const LOCK_RULE_USAGE = [

  "Usage: ufa door lock-rule <DOOR> [keep-lock|keep-unlock|lock-early|lock-now|reset|DURATION] [--json] [--scrub] [--api ...] [--debug]",
  "",
  "Read or set the temporary locking rule on a door. With no rule argument, the rule in force is read and printed; with one, it is established.",
  "The read goes through the official API. Setting goes through whichever API can express the rule: keep-unlock, reset, and a DURATION (a custom",
  "rule in whole minutes, e.g. 30m) work with credentials alone, while keep-lock, lock-early, and lock-now require the official API.",
  "",
  "Options:",
  "  --json       Emit the rule read as a single line of JSON, field order preserved.",
  "  --scrub      Pseudonymize identifying values in the rule read so it can be shared - one value reads as one stand-in throughout a run.",
  "  --api VALUE  Hold the command to one API: auto (default), direct-only, or official-only.",
  "  --debug      Emit the library's debug logging to stderr.",
  "  -h, --help   Show this help.",
  "",
  "Examples:",
  "  ufa door lock-rule \"Loading Dock\"             # read the rule in force",
  "  ufa door lock-rule \"Loading Dock\" keep-unlock # hold it unlocked until reset",
  "  ufa door lock-rule \"Loading Dock\" 45m         # hold it unlocked for forty-five minutes",
  "  ufa door lock-rule \"Loading Dock\" reset       # restore the schedule"
].join("\n");

// Narrow a rule token to the kebab vocabulary's own keys, so the verb read is an exactly-typed property access.
function isLockRuleVerb(value: string): value is keyof typeof LOCK_RULE_VERBS {

  return value in LOCK_RULE_VERBS;
}

// Parse the rule argument: a kebab-spelled verb from the one vocabulary, or a duration reaching the custom rule. A token that is neither is named against both forms.
function parseLockRule(value: string): AccessLockRule {

  if(isLockRuleVerb(value)) {

    return { type: LOCK_RULE_VERBS[value] };
  }

  if(/^\d/.test(value)) {

    return { interval: parseWholeMinutes(value, "rule"), type: "custom" };
  }

  throw new CliError("The rule must be one of: " + Object.keys(LOCK_RULE_VERBS).join(", ") + ", or a whole-minute duration such as 30m, but received \"" +
    value + "\".", { exitCode: 2 });
}

// Describe a rule for the confirmation line, in the operator's own spelling.
function describeLockRule(rule: AccessLockRule): string {

  if(rule.type === "custom") {

    return "a " + rule.interval.toString() + " minute custom hold";
  }

  const spelling = Object.entries(LOCK_RULE_VERBS).find(([ , verb ]) => verb === rule.type);

  return spelling?.[0] ?? rule.type;
}

/**
 * `ufa door lock-rule`. With no rule argument, reads the rule in force through the official API - the one channel that can answer - and with one, establishes it
 * through the driving handle's projection, whose routing decides the path per verb, or through the official facade where no handle drives the door.
 *
 * @category CLI
 */
const lockRuleHandler = async (ctx: CommandContext): Promise<void> => {

  const { positionals, values } = parseArgs({ allowPositionals: true, args: ctx.args,
    options: { ...COMMON_OPTIONS, ...SCRUB_OPTION, api: { type: "string" }, json: { type: "boolean" } }, strict: true });

  if(values.help === true) {

    ctx.output.line(LOCK_RULE_USAGE);

    return;
  }

  const [ target, ruleToken ] = positionals;

  if((target === undefined) || (positionals.length > 2)) {

    throw new CliError("Specify one door by name or id, and optionally a rule. Run \"ufa door lock-rule --help\" for usage.", { exitCode: 2 });
  }

  // A rule argument selects the mutation arm, which prints a confirmation line composed here rather than a document the controller sent. The presence of the
  // token is the whole test, and it is knowable before anything connects.
  refuseDocumentFlags(values, { changing: ruleToken !== undefined, prints: "A rule change prints a confirmation rather than a document", read: "rule read" });

  const api = parseApiOverride(values.api);

  // The rule token's grammar is knowable before the identity file is read, so a malformed token is refused without a read, the way the emergency handler settles
  // its verb before its own load. Branching the arms on the parsed rule is what narrows it for the mutation arm below.
  const rule = (ruleToken === undefined) ? undefined : parseLockRule(ruleToken);
  const credentials = await ctx.loadCredentials();

  if(rule === undefined) {

    // The read is official surface in every mode, and the refusals - a missing token, a direct-only choice - are knowable before anything connects.
    requireSurface(credentials, "official", "lock-rule read", api);

    await using client = await openDoorClient(ctx, { ...((api !== undefined) && { api }), credentials, debug: values.debug === true });

    const spaces = requireOfficial(client, "lock-rule read").spaces;
    const doorTarget = findDoorTarget(client, target);

    // The read is door-addressed on both arms, so the only thing the arm decides is where the door's identity is read from.
    const doorId = (doorTarget.kind === "door") ? doorTarget.doorId : doorTarget.hub.doorId;

    const inForce = createDocumentScrubber(values.scrub === true)(await spaces.fetchLockRule(doorId, { signal: ctx.signal }));

    renderDocument(ctx.output, inForce, (values.json === true) ? "json" : "default");

    return;
  }

  await using client = await openDoorClient(ctx, { ...((api !== undefined) && { api }), credentials, debug: values.debug === true });

  const doorTarget = findDoorTarget(client, target);
  const label = doorLabel(doorTarget);

  if(doorTarget.kind === "door") {

    await doorArmSpaces(client, doorTarget.door).setLockRule(doorTarget.doorId, rule, { signal: ctx.signal });
  } else {

    await doorTarget.hub.setLockRule(rule, { signal: ctx.signal });
  }

  ctx.output.line(label + " - lock rule set to " + describeLockRule(rule) + ".");
};

const EMERGENCY_USAGE = [

  "Usage: ufa door emergency [evacuation|lockdown|normal] [--json] [--scrub] [--api ...] [--debug]",
  "",
  "Read or set the site-wide emergency state. With no argument, the state in force is read and printed as its two status flags; with one, it is",
  "established across every door at once: evacuation unlocks, lockdown locks, and normal stands both modes down. Official API surface in every mode.",
  "",
  "Options:",
  "  --json       Emit the state read as a single line of JSON, field order preserved.",
  "  --scrub      Pseudonymize identifying values in the state read so it can be shared - one value reads as one stand-in throughout a run.",
  "  --api VALUE  Hold the command to one API: auto (default), direct-only, or official-only.",
  "  --debug      Emit the library's debug logging to stderr.",
  "  -h, --help   Show this help.",
  "",
  "Examples:",
  "  ufa door emergency             # read the state in force",
  "  ufa door emergency lockdown    # lock every door",
  "  ufa door emergency normal      # stand down"
].join("\n");

/**
 * `ufa door emergency`. Site-wide by the wire's own shape, so it takes no door argument: the verb positional is the state, spelled in the library's own tri-state
 * vocabulary. The facade method composes the wire's both-flags body from the single verb, so a contradictory both-in-force request cannot be written here at all.
 *
 * @category CLI
 */
const emergencyHandler = async (ctx: CommandContext): Promise<void> => {

  const { positionals, values } = parseArgs({ allowPositionals: true, args: ctx.args,
    options: { ...COMMON_OPTIONS, ...SCRUB_OPTION, api: { type: "string" }, json: { type: "boolean" } }, strict: true });

  if(values.help === true) {

    ctx.output.line(EMERGENCY_USAGE);

    return;
  }

  const [verb] = positionals;

  if(positionals.length > 1) {

    throw new CliError("Specify at most one emergency state. Run \"ufa door emergency --help\" for usage.", { exitCode: 2 });
  }

  // A state argument selects the mutation arm, which prints a confirmation line composed here rather than a document the controller sent. The presence of the
  // verb is the whole test, and it is knowable before anything connects.
  refuseDocumentFlags(values, { changing: verb !== undefined, prints: "A state change prints a confirmation rather than a document", read: "state read" });

  if((verb !== undefined) && !isMember(EMERGENCY_STATES, verb)) {

    throw new CliError("The emergency state must be one of: " + EMERGENCY_STATES.join(", ") + ", but received \"" + verb + "\".", { exitCode: 2 });
  }

  const api = parseApiOverride(values.api);
  const credentials = await ctx.loadCredentials();

  requireSurface(credentials, "official", "emergency command", api);

  await using client = await openDoorClient(ctx, { ...((api !== undefined) && { api }), credentials, debug: values.debug === true });

  const spaces = requireOfficial(client, "emergency command").spaces;

  if(verb === undefined) {

    const state = createDocumentScrubber(values.scrub === true)(await spaces.fetchEmergency({ signal: ctx.signal }));

    renderDocument(ctx.output, state, (values.json === true) ? "json" : "default");

    return;
  }

  await spaces.setEmergency(verb, { signal: ctx.signal });

  ctx.output.line("The site-wide emergency state is now " + verb + ".");
};

// The door subcommand table. The dispatcher, the usage text, and the unknown-subcommand diagnostic all derive from it through the shared group composer.
const SUBCOMMANDS: Record<string, CommandSpec> = {

  "close": { run: closeHandler, summary: "Close a door, ending a held-open unlock." },
  "emergency": { run: emergencyHandler, summary: "Read or set the site-wide emergency state." },
  "lock-rule": { run: lockRuleHandler, summary: "Read or set the temporary locking rule on a door." },
  "unlock": { run: unlockHandler, summary: "Unlock a door, optionally for a duration or until reset." }
};

const USAGE = [

  "Usage: ufa door <subcommand> [options]",
  "",
  "Subcommands:",
  ...commandList(SUBCOMMANDS),
  "",
  "A door is named by the hub or port that drives it, or by the topology's own door name, full name, or id.",
  "",
  "Run \"ufa door <subcommand> --help\" for subcommand options."
].join("\n");

/** `ufa door`. The door command group, composed through the shared group dispatcher. */
export const door: CommandSpec = groupCommand({ commands: SUBCOMMANDS, group: "door", summary: "Unlock, close, and govern doors and the site-wide emergency state.",
  usage: USAGE });

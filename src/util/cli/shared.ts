/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * shared.ts: Cross-command CLI infrastructure - the typed CLI error, the compiled event filter engine, the topology extraction, and the Ctrl-C abort wiring.
 */
import type { AccessApiOverride, AccessEventPacket, Nullable } from "../../index.ts";
import { Output, alignedList, compareCodeUnit } from "./output/format.ts";
import { createScrubContext, scrub } from "./scrub.ts";
import { AccessClient } from "../../index.ts";
import type { DeviceResolution } from "./lookup.ts";
import type { ParseArgsOptionsConfig } from "node:util";
import type { UfaCredentials } from "./credentials.ts";
import { createWriteStream } from "node:fs";
import { once } from "node:events";

/**
 * A user-facing CLI failure. Carrying an `exitCode` lets the entry point render a clean one-line message to stderr and set the process exit code, rather than dumping a
 * stack trace - a stack is for a bug, a `CliError` is for "you asked for a door that does not exist" or "no ufa.json was found". Library failures (the typed
 * `AccessError` hierarchy) are rendered the same calm way; an *unexpected* error is the only thing that gets a stack, because that is the only thing that is a bug.
 *
 * @category CLI
 */
export class CliError extends Error {

  /** The process exit code to set when this error reaches the entry point. */
  readonly exitCode: number;

  constructor(message: string, opts: { cause?: unknown; exitCode?: number } = {}) {

    super(message, (opts.cause !== undefined) ? { cause: opts.cause } : undefined);

    this.exitCode = opts.exitCode ?? 1;
    this.name = "CliError";
  }
}

/**
 * The context every command receives from the entry point: its own argument slice (everything after the command verb), the environment, the injected credential-loader
 * and client-opener hooks ({@link LoadCredentials}, {@link OpenClient}), the default `Output` (stdout), and the process-wide Ctrl-C signal.
 *
 * @category CLI
 */
export interface CommandContext {

  args: string[];
  env: NodeJS.ProcessEnv;
  loadCredentials: LoadCredentials;
  openClient: OpenClient;
  output: Output;
  signal: AbortSignal;
}

/**
 * The credential-loader hook. A mode-gated command reads the identity file through this before connecting, so it can refuse an operation the file's identities cannot
 * reach with a calm usage error instead of a connect-time failure - and it hands the loaded value to {@link OpenClient}, so the file is read exactly once per
 * invocation. The entry point injects the production loader; a test injects a fake returning the identity shape under test.
 *
 * @category CLI
 */
export type LoadCredentials = () => Promise<UfaCredentials>;

/**
 * The client-opener hook. The entry point injects the production opener (load credentials, then `AccessClient.connect`); a test injects a fake returning a fake client.
 * Commands always open through `ctx.openClient`, never by importing the opener directly, which is what makes every command unit-testable without a live controller.
 *
 * @category CLI
 */
export type OpenClient = (opts?: { api?: AccessApiOverride; credentials?: UfaCredentials; debug?: boolean; refreshIntervalMs?: number | false;
  signal?: AbortSignal; }) => Promise<AccessClient>;

/**
 * The behavior half of a CLI command: it does its work and resolves, or throws (a {@link CliError} for an expected failure, a library `AccessError` for a controller
 * failure). The entry point renders the throw and sets the exit code, so a handler never calls `process.exit` itself.
 *
 * @category CLI
 */
export type CommandHandler = (ctx: CommandContext) => Promise<void>;

/**
 * A CLI command descriptor: the {@link CommandHandler} that runs it paired with the one-line summary the usage screen lists it by. The dispatcher and the usage text
 * both derive from this one object, so a command is registered in exactly one place - it can never be routable-but-unlisted or listed-but-unroutable, and its listed
 * description can never drift from the command that actually runs.
 *
 * @category CLI
 */
export interface CommandSpec {

  readonly run: CommandHandler;
  readonly summary: string;
}

/**
 * Render a command table as aligned `name  summary` lines for the usage screen's "Commands:" block, sorted by command name (code unit). Each summary is read off its
 * {@link CommandSpec}, so the listing derives from the same dispatch table - it cannot drift from the commands that actually run.
 *
 * @param table - The command dispatch table.
 *
 * @returns One aligned `name  summary` line per command, sorted by name.
 *
 * @category CLI
 */
export function commandList(table: Record<string, CommandSpec>): string[] {

  const rows = Object.entries(table).sort(([a], [b]) => compareCodeUnit(a, b)).map(([ name, spec ]) => [ name, spec.summary ] as const);

  return alignedList(rows);
}

/**
 * Whether an argument is a request for help: absent, the word `help`, or either help flag spelling. The one predicate both the entry point's top-level short-circuit
 * and every group dispatcher consume, so the two layers cannot drift on what counts as asking for help.
 *
 * @param token - The argument to test, or `undefined` when none was given.
 *
 * @returns `true` when the token asks for help. The predicate narrows, so a caller's else branch holds a definite subcommand string.
 *
 * @category CLI
 */
export function isHelpToken(token: string | undefined): token is "--help" | "-h" | "help" | undefined {

  return (token === undefined) || (token === "help") || (token === "--help") || (token === "-h");
}

/**
 * Compose a command group from its subcommand table. The returned {@link CommandSpec} consumes the first argument as the subcommand and forwards the rest to it with
 * the same context: a help token prints the group's usage screen, an unknown subcommand is a usage error whose diagnostic derives the valid set from the table itself
 * (a hand-kept list would drift the first time a subcommand was added), and everything else dispatches. The group's own summary is an input here, so a group module's
 * whole export is one call and no throwaway summary is ever synthesized.
 *
 * @param opts - The subcommand table, the group's name for diagnostics, the summary the top-level table lists the group by, and the usage screen to print.
 *
 * @returns The group's command descriptor.
 *
 * @category CLI
 */
export function groupCommand(opts: { commands: Record<string, CommandSpec>; group: string; summary: string; usage: string }): CommandSpec {

  return {

    run: async (ctx: CommandContext): Promise<void> => {

      const [ sub, ...rest ] = ctx.args;

      if(isHelpToken(sub)) {

        ctx.output.line(opts.usage);

        return;
      }

      const command = opts.commands[sub];

      if(command === undefined) {

        throw new CliError("Unknown " + opts.group + " subcommand \"" + sub + "\". Expected one of: " +
          Object.keys(opts.commands).sort(compareCodeUnit).join(", ") + ".", { exitCode: 2 });
      }

      await command.run({ ...ctx, args: rest });
    },
    summary: opts.summary
  };
}

/**
 * Whether a value is a member of a literal-typed vocabulary list, narrowing it when it is. The CLI's validated literal sets are declared as `as const` arrays with a
 * `satisfies` link to the library type they mirror, which keeps each element narrowly typed - and `Array.prototype.includes` refuses a plain string against a narrow
 * element type under strict settings. The widened read lives here, once, so every membership check is the same three words at its call site.
 *
 * @typeParam T - The list's literal element type.
 *
 * @param list  - The vocabulary list.
 * @param value - The value to test.
 *
 * @returns `true` when the value is in the list, narrowing it to the list's element type.
 *
 * @category CLI
 */
export function isMember<T extends string>(list: readonly T[], value: string): value is T {

  return (list as readonly string[]).includes(value);
}

/**
 * The options every command accepts, merged into each command's own option set before parsing. `--debug` turns on the library's debug logging (to stderr); `--help`
 * prints the command's usage. Both carry the short spellings the CLI has always accepted, so `-d` and `-h` work wherever their long forms do.
 *
 * @category CLI
 */
export const COMMON_OPTIONS = {

  debug: { short: "d", type: "boolean" },
  help: { short: "h", type: "boolean" }
} as const satisfies ParseArgsOptionsConfig;

/**
 * The capture-scrub flag, merged into the option set of every command that emits a wire document. Declared once here so the flag is spelled one way across the whole
 * surface, and so a command that emits documents is opted in by composing this rather than by restating the option.
 *
 * @category CLI
 */
export const SCRUB_OPTION = {

  scrub: { type: "boolean" }
} as const satisfies ParseArgsOptionsConfig;

/**
 * The transform a wired command applies to each document at acquisition: pseudonymizing when `--scrub` was given, the identity function when it was not.
 *
 * It is generic in the document's own type because the scrub is shape-preserving - it rebuilds a document whose members carry stand-ins - so a handler keeps the
 * typed record it fetched and every listing projection downstream still compiles against it.
 *
 * @category CLI
 */
export type DocumentScrubber = <T>(document: T) => T;

/**
 * Compose the document transform for one invocation.
 *
 * Scrubbing is a property of the document rather than of a view, so a handler applies this where a document arrives - before any format branch, listing projection,
 * or render call - and every rendering downstream reads pseudonymized data by construction. One context for the whole invocation is what makes a value read as the
 * same stand-in in every document a command emits, and what keeps a stream's cross-packet references intact.
 *
 * Disabled, this constructs nothing and returns each document unchanged, so a command with no `--scrub` behaves exactly as it did before the flag existed.
 *
 * @param enabled - Whether `--scrub` was given.
 *
 * @returns The transform to apply at each document acquisition.
 *
 * @category CLI
 */
export function createDocumentScrubber(enabled: boolean): DocumentScrubber {

  if(!enabled) {

    return <T>(document: T): T => document;
  }

  const context = createScrubContext();

  // The one assertion the shape-preserving contract is stated at: the scrub rebuilds a document with the same members, so the copy answers the type the original did.
  return <T>(document: T): T => scrub(document, context) as T;
}

/**
 * Split a comma-separated option value into its trimmed, non-empty terms. The shared parser for every list-shaped flag (`--fields a,b,c`), so the splitting rule lives
 * in one place.
 *
 * @param value - The raw flag value, or `undefined` when the flag was absent.
 *
 * @returns The trimmed terms, or an empty array when the flag was absent or held only whitespace.
 *
 * @category CLI
 */
export function parseList(value: string | undefined): string[] {

  if(value === undefined) {

    return [];
  }

  return value.split(",").map((term) => term.trim()).filter((term) => term.length > 0);
}

/**
 * Parse a CLI option value as a non-negative integer (`--count`), where zero is a valid choice rather than an error: an event count of zero is the CLI's own spelling
 * of "no bound".
 *
 * @param value - The raw flag value.
 * @param flag  - The flag name, for the error message.
 *
 * @returns The parsed non-negative integer.
 *
 * @throws {@link CliError} (exit 2) when the value is not a non-negative integer.
 *
 * @category CLI
 */
export function parseNonNegativeInt(value: string, flag: string): number {

  const parsed = Number(value);

  if(!Number.isInteger(parsed) || (parsed < 0)) {

    throw new CliError("The " + flag + " value must be a non-negative integer, but received \"" + value + "\".", { exitCode: 2 });
  }

  return parsed;
}

// The unit suffixes a duration accepts, mapped to their millisecond factor. A plain const literal rather than an index-signatured table, because the shared tsconfig's
// noUncheckedIndexedAccess would type every read of a signatured table as possibly-undefined, where the literal's property reads are exactly typed. The single source
// for what a duration string may say - the whole-minute conversion below reads its factor from this table's own `m` entry rather than restating it.
const DURATION_UNITS = { h: 3600000, m: 60000, ms: 1, s: 1000 } as const;

// Narrow a captured unit suffix to the table's own keys, so the factor read is an exactly-typed property access.
function isDurationUnit(value: string | undefined): value is keyof typeof DURATION_UNITS {

  return (value !== undefined) && (value in DURATION_UNITS);
}

/**
 * Parse a CLI duration value into milliseconds. The value is a positive integer with a required unit suffix - `500ms`, `30s`, `5m`, `1h` - because a bare number is
 * ambiguous (30 what?). A single number-plus-unit expresses any bound the commands need (90 minutes is `90m`), so there is no parser surface for compound forms like
 * `1h30m` - one rule, and the smallest unit already covers every convenience a compound would add.
 *
 * @param value - The raw value.
 * @param flag  - The flag or argument name, for the error message.
 *
 * @returns The duration in milliseconds.
 *
 * @throws {@link CliError} (exit 2) when the value is not a positive integer followed by a known unit.
 *
 * @category CLI
 */
export function parseDuration(value: string, flag: string): number {

  // Anchor the whole token: a run of digits, then one of the known units. Anything else - a bare number, a unit we do not recognize, a fractional or negative value -
  // falls through to the single diagnostic below rather than silently misparsing.
  const match = /^(\d+)(ms|s|m|h)$/.exec(value);
  const unit = match?.[2];

  if((match === null) || !isDurationUnit(unit)) {

    throw new CliError("The " + flag + " value must be a positive integer with a unit (ms, s, m, h), e.g. 30s or 5m, but received \"" + value + "\".",
      { exitCode: 2 });
  }

  const magnitude = Number(match[1]);

  if(magnitude <= 0) {

    throw new CliError("The " + flag + " value must be greater than zero, but received \"" + value + "\".", { exitCode: 2 });
  }

  return magnitude * DURATION_UNITS[unit];
}

/**
 * Parse a CLI duration value into whole minutes - the unit the controller's lock rule speaks. The duration grammar is {@link parseDuration}'s, composed with the
 * conversion in one function so a call site that needs minutes never holds a milliseconds intermediate: a value that is not a positive multiple of one minute is
 * refused here, because the controller's interval has whole-minute granularity and truncating would hold a door for a different time than the operator asked.
 *
 * @param value - The raw value.
 * @param flag  - The flag or argument name, for the error message.
 *
 * @returns The duration in whole minutes.
 *
 * @throws {@link CliError} (exit 2) when the value does not parse as a duration, or is not a positive multiple of one minute.
 *
 * @category CLI
 */
export function parseWholeMinutes(value: string, flag: string): number {

  const durationMs = parseDuration(value, flag);

  if((durationMs % DURATION_UNITS.m) !== 0) {

    throw new CliError("The " + flag + " value must be a whole number of minutes - the controller's lock rule has whole-minute granularity - but received \"" +
      value + "\".", { exitCode: 2 });
  }

  return durationMs / DURATION_UNITS.m;
}

/**
 * A compiled filter term: one question asked of each raw packet. The engine compiles the operator's whole filter expression into a list of these and requires every one
 * of them to answer `true`, so the AND composition lives in the caller's `every` rather than inside any term.
 *
 * @category CLI
 */
export type EventPredicate = (packet: AccessEventPacket) => boolean;

/**
 * The filter shortcuts, as parsed from the command line. Each is the flag form of a filter the property grammar can also express the long way, and each composes with
 * everything else by AND.
 *
 * @category CLI
 */
export interface EventShortcuts {

  device?: string[];
  hubs?: boolean;
  readers?: boolean;
  ring?: boolean;
  unlock?: boolean;
}

// The property-filter grammar: a dot-path, an operator, and a value, anchored so a token either is a filter or is not one. Taken from the shipped CLI verbatim, which
// is what makes an operator's existing filter expression keep working.
const FILTER_PATTERN = /^([a-zA-Z0-9_.]+)(==|!=|~|!~|>=|<=|>|<|=)(.+)$/;

// The device types the hardware shortcuts select, as the controller spells them on the wire.
const HUB_DEVICE_TYPE = "UAH";
const READER_DEVICE_TYPE = "UA-Reader";

/**
 * Resolve a dot-path to a value within a notification packet. A path beginning with `data.` or `meta.` resolves inside that member; every other path resolves from the
 * packet root. An absent path, or a path that tries to descend through a non-object, yields `undefined`.
 *
 * This is the one path resolver in the CLI: the filter engine asks it for the value to compare, and `--fields` asks it for the value to project, so the two cannot
 * disagree about what `data.device_type` means.
 *
 * @param packet - The packet to read.
 * @param path   - The dot-path.
 *
 * @returns The value at that path, or `undefined`.
 *
 * @category CLI
 */
export function resolveValueAtPath(packet: AccessEventPacket, path: string): unknown {

  const parts = path.split(".");
  const head = parts[0];

  let current: unknown = packet;

  if((head === "data") || (head === "meta")) {

    current = (head === "data") ? packet.data : packet.meta;
    parts.shift();
  }

  for(const part of parts) {

    if((current === null) || (current === undefined) || (typeof current !== "object")) {

      return undefined;
    }

    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * The device a packet is about, as the identifier a filter and a rendered line key on.
 *
 * The classifier owns per-kind identity, so this consumes its verdict rather than re-deriving one, and the arms below cover the packet space between them. A
 * classified event carrying its own identifier answers with it, which is what routes a doorbell ring to the reader named in its payload rather than to the
 * per-notification identifier its envelope carries. A door-state report answers with whichever facet it arrived on, because that carrier names the entity while the
 * envelope again carries a per-notification value. Everything else - a ring cancellation, which carries no device attribution at all, and any packet the library does
 * not model - answers with the envelope's own identifier, which is all such a packet offers.
 *
 * @param packet - The packet to attribute.
 *
 * @returns The subject's identifier.
 *
 * @category CLI
 */
export function packetSubjectId(packet: AccessEventPacket): string {

  const event = AccessClient.classifyPacket(packet);

  if(event === null) {

    return packet.event_object_id;
  }

  switch(event.kind) {

    case "doorStateChanged": {

      // Exactly one facet is present by construction of the event type, so this chain is total.
      return (event.device ?? event.location).id;
    }

    case "doorbellCancel": {

      return packet.event_object_id;
    }

    default: {

      return event.id;
    }
  }
}

/**
 * Compile a filter expression into the predicates the packet loop evaluates. Every term is compiled once here - regular expressions built, names resolved to
 * identifiers, comparisons bound to their operator - so the per-packet path evaluates prepared terms rather than re-parsing the expression, and the only work it
 * repeats is splitting each term's path as it walks the packet.
 *
 * Composition is AND across every term, which is the shipped grammar's own rule: two terms narrow the stream rather than widening it, and two contradictory terms
 * therefore match nothing.
 *
 * @param opts - The name resolution snapshot, the shortcut flags, and the bare filter tokens as typed.
 *
 * @returns The compiled predicates; an empty list matches every packet.
 *
 * @category CLI
 */
export function compileEventFilters(opts: { resolve: DeviceResolution; shortcuts: EventShortcuts; tokens: string[] }): EventPredicate[] {

  const predicates: EventPredicate[] = [];

  /* A token that does not parse as a property filter is not an error: the shipped CLI passed such tokens through to the command as arguments and streamed unfiltered,
   * and the two-token legacy form below is the one shape that gave them meaning.
   */
  const bare: string[] = [];

  for(const token of opts.tokens) {

    const match = FILTER_PATTERN.exec(token);

    if(match === null) {

      bare.push(token);

      continue;
    }

    const [ , path = "", operator = "", value = "" ] = match;

    predicates.push(compilePropertyFilter(path, normalizeOperator(operator), value, opts.resolve));
  }

  // Each `--device` value becomes its own term, exactly as each occurrence of the flag pushed its own filter in the shipped CLI. Two different values therefore match
  // nothing, which is what AND composition means and what the help text states.
  for(const device of opts.shortcuts.device ?? []) {

    predicates.push(compilePropertyFilter("device", "==", device, opts.resolve));
  }

  // The hardware shortcuts are the device-type equality the property grammar can also express, compiled through the same path so there is one comparison rule.
  if(opts.shortcuts.hubs === true) {

    predicates.push(compilePropertyFilter("data.device_type", "==", HUB_DEVICE_TYPE, opts.resolve));
  }

  if(opts.shortcuts.readers === true) {

    predicates.push(compilePropertyFilter("data.device_type", "==", READER_DEVICE_TYPE, opts.resolve));
  }

  /* The activity shortcuts test the classified kind rather than a wire name. The classifier is where the vocabulary lives, so every wire name it already normalizes
   * into one kind - an unlock arrives under more than one - is matched here without this module knowing any of them.
   */
  if(opts.shortcuts.ring === true) {

    predicates.push((packet) => AccessClient.classifyPacket(packet)?.kind === "doorbellRing");
  }

  if(opts.shortcuts.unlock === true) {

    predicates.push((packet) => AccessClient.classifyPacket(packet)?.kind === "unlock");
  }

  // The legacy positional form: two bare tokens and nothing else compose one equality filter, the shape the CLI accepted before the operator grammar existed.
  const [ legacyPath = "", legacyValue = "" ] = bare;

  if((predicates.length === 0) && (bare.length === 2)) {

    predicates.push(compilePropertyFilter(legacyPath, "==", legacyValue, opts.resolve));
  }

  return predicates;
}

// Normalize the grammar's operators to the set the comparison switch answers for. A bare "=" is the equality operator's shorthand and nothing else, so it is folded
// here rather than carried as a second spelling through the compile.
function normalizeOperator(operator: string): string {

  return (operator === "=") ? "==" : operator;
}

// Translate a shell-style glob into an anchored, case-insensitive regular expression. We escape every regex metacharacter first, then re-activate the glob wildcards:
// an escaped "\*" becomes ".*" (any run) and an escaped "\?" becomes "." (any single character). Anchoring with ^...$ makes a glob match the whole value, so
// "Loading*" matches "Loading Dock" but not "Rear Loading".
function globToRegExp(pattern: string): RegExp {

  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, (character) => "\\" + character);
  const globbed = escaped.replace(/\\\*/g, ".*").replace(/\\\?/g, ".");

  return new RegExp("^" + globbed + "$", "i");
}

/* Compile the value half of a `~` or `!~` term into a matcher. The forms are distinguished by what the value looks like, which is the grammar the help text
 * documents: a value delimited by slashes is a regular expression with its own flags, a value carrying a wildcard is an anchored glob, and anything else is a
 * case-insensitive containment test. Containment is what the documented grammar promises for plain text, and it is what makes `~` a different operator from `==`
 * rather than a second spelling of it.
 */
function compileMatchTerm(value: string): (actual: string) => boolean {

  const lastSlash = value.lastIndexOf("/");

  if(value.startsWith("/") && (lastSlash > 0)) {

    // A malformed pattern is the operator's own typo, so it earns a calm usage error naming the pattern rather than the constructor's stack.
    let regExp: RegExp;

    try {

      regExp = new RegExp(value.substring(1, lastSlash), value.substring(lastSlash + 1));
    } catch(error) {

      throw new CliError("The filter pattern \"" + value + "\" did not parse as a regular expression.", { cause: error, exitCode: 2 });
    }

    return (actual: string): boolean => regExp.test(actual);
  }

  if(value.includes("*") || value.includes("?")) {

    const regExp = globToRegExp(value);

    return (actual: string): boolean => regExp.test(actual);
  }

  const needle = value.toLowerCase();

  return (actual: string): boolean => actual.toLowerCase().includes(needle);
}

// Compile one property term into its predicate. The comparison is bound to the operator here, once, so the packet loop resolves a value and calls a function rather
// than branching on an operator string per packet.
function compilePropertyFilter(path: string, operator: string, value: string, resolve: DeviceResolution): EventPredicate {

  const negate = (operator === "!=") || (operator === "!~");

  /* The "device" path is not a path at all: it names the subject of the packet, and its value may be a device name rather than an identifier. We resolve the name once,
   * here, and fall back to comparing the term as an identifier when it names nothing - which is what lets an operator filter by either spelling.
   */
  if(path === "device") {

    const target = (resolve.resolve(value) ?? value).toLowerCase();

    return (packet: AccessEventPacket): boolean => {

      const matched = packetSubjectId(packet).toLowerCase() === target;

      return negate ? !matched : matched;
    };
  }

  const compare = compileComparison(operator, value);

  return (packet: AccessEventPacket): boolean => {

    const text = comparableText(resolveValueAtPath(packet, path));

    /* Two cases answer the same way. A path the packet does not carry is not the value you asked for, and it is not not-the-value either, so the affirmative
     * operators decline it and the negated operators admit it. A value with no meaningful text form answers identically, for the same reason: comparing against
     * the language's "[object Object]" would be comparing against nothing the operator could have meant.
     */
    if(text === null) {

      return negate;
    }

    return compare(text);
  };
}

// Reduce a resolved path value to the text a comparison sees, or null when it has none. A primitive converts to itself, and a JSON null converts to the word, which is
// what lets a filter match the null payload a deletion notification carries. An object or a function has no text form worth comparing.
function comparableText(value: unknown): Nullable<string> {

  switch(typeof value) {

    case "bigint":
    case "boolean":
    case "number":
    case "string":
    case "symbol": {

      return String(value);
    }

    case "object": {

      return (value === null) ? "null" : null;
    }

    default: {

      return null;
    }
  }
}

// Bind an operator and its value into the comparison the predicate runs. Equality is case-insensitive because device names and event names are typed by humans; the
// ordering operators coerce both sides to numbers, which is the only reading that gives them meaning.
function compileComparison(operator: string, value: string): (actual: string) => boolean {

  const expected = value.toLowerCase();
  const numeric = Number(value);

  switch(operator) {

    case "!=": {

      return (actual: string): boolean => actual.toLowerCase() !== expected;
    }

    case "~": {

      return compileMatchTerm(value);
    }

    case "!~": {

      const matches = compileMatchTerm(value);

      return (actual: string): boolean => !matches(actual);
    }

    case "<": {

      return (actual: string): boolean => Number(actual) < numeric;
    }

    case "<=": {

      return (actual: string): boolean => Number(actual) <= numeric;
    }

    case ">": {

      return (actual: string): boolean => Number(actual) > numeric;
    }

    case ">=": {

      return (actual: string): boolean => Number(actual) >= numeric;
    }

    default: {

      return (actual: string): boolean => actual.toLowerCase() === expected;
    }
  }
}

/**
 * Extract the topology document from what the controller answered with. The library's fetch returns the response body verbatim, envelope and all, because its contract
 * is a faithful dump rather than a parsed model. Presenting it is this layer's job, so the envelope is peeled here: a body carrying an array-shaped `data` member
 * yields that array's first element, and anything else is already the document and passes through untouched.
 *
 * @param body - The fetched response body.
 *
 * @returns The topology document.
 *
 * @category CLI
 */
export function unwrapDocument(body: unknown): unknown {

  if((typeof body !== "object") || (body === null)) {

    return body;
  }

  const data = (body as { data?: unknown }).data;

  return Array.isArray(data) ? (data as unknown[])[0] : body;
}

/**
 * The floors of a topology document, or `null` when it carries none. Reading the raw document rather than the reduced state model is deliberate: the model prunes each
 * record of the members it stores elsewhere, and this command's contract is the controller's own record.
 *
 * @param document - The topology document.
 *
 * @returns The floor records, or `null`.
 *
 * @category CLI
 */
export function documentFloors(document: unknown): Nullable<unknown[]> {

  if((typeof document !== "object") || (document === null)) {

    return null;
  }

  const floors = (document as { floors?: unknown }).floors;

  return Array.isArray(floors) ? (floors as unknown[]) : null;
}

/**
 * The doors of a topology document, flattened out of its floors, or `null` when that yields nothing. An empty result reads as `null` rather than as an empty array,
 * which is the shipped CLI's own answer for a topology whose floors carry no doors.
 *
 * @param document - The topology document.
 *
 * @returns The door records, or `null`.
 *
 * @category CLI
 */
export function documentDoors(document: unknown): Nullable<unknown[]> {

  const floors = documentFloors(document);

  if(floors === null) {

    return null;
  }

  const doors = floors.flatMap((floor) => {

    const value = ((typeof floor === "object") && (floor !== null)) ? (floor as { doors?: unknown }).doors : undefined;

    return Array.isArray(value) ? (value as unknown[]) : [];
  }).filter(Boolean);

  return (doors.length > 0) ? doors : null;
}

/**
 * Take at most `count` values from an async iterable, then stop. Returning early from the `for await` disposes the source, so the underlying stream is torn down
 * cleanly. This is the equivalent of the still-proposal-stage `AsyncIterator.prototype.take`, which is unavailable across our supported Node range, provided as a small
 * generator so the `--count N` path stays in the async-iterator idiom.
 *
 * @typeParam T - The element type.
 *
 * @param source - The async iterable to draw from.
 * @param count  - The maximum number of values to yield; a non-positive count yields nothing, so a caller whose zero means "no bound" must not wrap with it.
 *
 * @returns An async generator of at most `count` values.
 *
 * @category CLI
 */
export async function *take<T>(source: AsyncIterable<T>, count: number): AsyncGenerator<T> {

  if(count <= 0) {

    return;
  }

  let taken = 0;

  for await (const value of source) {

    yield value;

    taken += 1;

    if(taken >= count) {

      return;
    }
  }
}

/**
 * Wire a single {@link AbortController} to SIGINT and SIGTERM. The returned signal is threaded through `AccessClient.connect({ signal })` and every nested operation, so
 * one Ctrl-C aborts the whole tree and `await using` unwinds it cleanly. Call `dispose()` on normal completion to detach the listeners, so a short command does not
 * leave handlers attached to the process.
 *
 * @returns The lifetime signal and a disposer that removes the process listeners.
 *
 * @category CLI
 */
export function wireAbortSignal(): { dispose: () => void; signal: AbortSignal } {

  const controller = new AbortController();
  const onSignal = (): void => controller.abort();

  process.on("SIGINT", onSignal);
  process.on("SIGTERM", onSignal);

  const dispose = (): void => {

    process.removeListener("SIGINT", onSignal);
    process.removeListener("SIGTERM", onSignal);
  };

  return { dispose, signal: controller.signal };
}

/**
 * Bound a streaming command's lifetime by an optional timeout, returning the signal its iteration should actually run under. With no bound it is the base signal
 * (Ctrl-C only); with one it is the base signal **or** a fresh `AbortSignal.timeout`, combined via `AbortSignal.any`, so the stream ends on whichever fires first.
 *
 * Only `undefined` means unbounded here. A caller whose own zero means "no bound" translates it to `undefined` before calling, because `AbortSignal.timeout(0)` fires
 * on the very next tick and would end the stream almost immediately.
 *
 * @param signal     - The base lifetime signal (the wired Ctrl-C signal).
 * @param durationMs - The bound in milliseconds, or `undefined` for no bound.
 *
 * @returns The base signal unchanged when no bound is set; otherwise a signal that also aborts after `durationMs`.
 *
 * @category CLI
 */
export function boundedSignal(signal: AbortSignal, durationMs: number | undefined): AbortSignal {

  if(durationMs === undefined) {

    return signal;
  }

  return AbortSignal.any([ signal, AbortSignal.timeout(durationMs) ]);
}

/**
 * Write a byte payload where the operator pointed it: a path writes the file, and `-` or an omitted destination writes raw bytes to stdout. An omitted destination
 * is refused when stdout is an interactive terminal, because spraying bytes into one is never what the operator meant, while an explicit `-` is honored there as a
 * request the operator actually typed. The single home for the CLI's byte-sink discipline, shared by every command that produces bytes rather than text, so the
 * refusal and the confirmation routing are written once.
 *
 * The human confirmation never contaminates the payload: the file arm confirms through the command's own output, and the stdout arm diverts its confirmation to a
 * fresh stderr sink so a piped consumer receives the bytes alone.
 *
 * @param output - The command's output sink, used by the file arm's confirmation.
 * @param bytes  - The payload.
 * @param out    - The `--out` value: a path, `-` for stdout, or `undefined` (treated as stdout).
 *
 * @throws {@link CliError} (exit 2) when the destination is omitted and stdout is an interactive terminal.
 *
 * @category CLI
 */
export async function writeByteSink(output: Output, bytes: Uint8Array, out: string | undefined): Promise<void> {

  const filePath = ((out !== undefined) && (out !== "-")) ? out : null;
  const toStdout = (filePath === null) && ((out === "-") || !process.stdout.isTTY);

  if((filePath === null) && !toStdout) {

    throw new CliError("Refusing to write raw bytes to a terminal. Use --out <path>, or pipe stdout.", { exitCode: 2 });
  }

  if(filePath !== null) {

    const file = createWriteStream(filePath);

    file.write(bytes);
    file.end();

    await once(file, "finish");

    output.line("Wrote " + bytes.length.toString() + " bytes to " + filePath + ".");

    return;
  }

  // Bytes to stdout; the confirmation goes to stderr so it never contaminates the piped payload.
  process.stdout.write(bytes);

  new Output({ stream: process.stderr }).line("Wrote " + bytes.length.toString() + " bytes to stdout.");
}

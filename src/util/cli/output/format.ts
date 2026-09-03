/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * format.ts: The Output value object - the single home for the CLI's stdout discipline and colorization - and the document renderer the read commands share.
 */
import { colorsEnabled, createPalette } from "./colors.ts";
import type { Palette } from "./colors.ts";
import { inspect } from "node:util";

/**
 * The minimal writable surface the CLI needs. We type against this rather than `NodeJS.WriteStream` so output is testable with a trivial in-memory capture - and so the
 * abstraction states exactly what it uses: a `write` and an `isTTY` hint.
 *
 * @category CLI
 */
export interface OutputStream {

  isTTY?: boolean;
  write(chunk: string | Uint8Array): boolean;
}

/**
 * Construction options for {@link Output}. All optional; the defaults bind to the real process streams and environment.
 *
 * @category CLI
 */
export interface OutputOptions {

  colorize?: boolean;
  env?: NodeJS.ProcessEnv;
  stream?: OutputStream;
}

/**
 * How a whole document is rendered: `default` is the human-readable inspection, `json` is one line of machine-readable JSON. The read commands take this from their
 * flags and hand it to {@link renderDocument}, so the renderings are named once rather than spelled per command.
 *
 * @category CLI
 */
export type DocumentFormat = "default" | "json";

/**
 * `Output` is the one place the CLI decides *where* a byte goes and *whether* it is colored. Every command writes human-readable output through an `Output`; nothing
 * calls `console` (which the lint preset flags) or pokes `process.stdout` for text directly. Centralizing it is what makes the stdout-versus-stderr contract a property
 * of the design rather than a convention each command must remember.
 *
 * @category CLI
 */
export class Output {

  /** The resolved color palette for this output's stream. Commands call `output.colors.dim(...)` and never branch on whether color is enabled. */
  readonly colors: Palette;

  /* The colorization decision itself, resolved once at construction and readable because one renderer needs the boolean rather than the palette: `util.inspect` does
   * its own coloring of a whole document tree, so it takes the decision as a flag instead of styling through palette members.
   */
  readonly colorize: boolean;

  readonly #stream: OutputStream;

  constructor(opts: OutputOptions = {}) {

    const stream = opts.stream ?? process.stdout;
    const env = opts.env ?? process.env;

    this.#stream = stream;
    this.colorize = opts.colorize ?? colorsEnabled(stream, env);
    this.colors = createPalette(this.colorize);
  }

  /**
   * Write a line of text, appending a newline.
   *
   * @param text - The line to write; defaults to an empty line.
   */
  line(text = ""): void {

    this.#stream.write(text + "\n");
  }

  /**
   * Write one value as indented, human-readable JSON. For a single-shot machine-readable report where readability beats line-delimited density. Object keys are
   * emitted in deterministic sorted order (see {@link sortKeysReplacer}), so a report reads the same way every time.
   *
   * @param value - The value to serialize.
   */
  jsonPretty(value: unknown): void {

    this.#stream.write(JSON.stringify(value, sortKeysReplacer, 2) + "\n");
  }
}

/**
 * Render a whole document to an output, in the format the operator asked for. The single rendering home behind every read command, so `ufa info devices` and
 * `ufa info doors` cannot drift on how a record reaches the terminal.
 *
 * The default rendering is `util.inspect` with sorted keys and unlimited depth, colored when the output is colorized. The JSON rendering is a plain single-line
 * `JSON.stringify` with **no** key-sorting replacer: this CLI is the capture tooling for the Access wire protocol, so the controller's own field order is evidence and
 * is preserved verbatim. Sorted keys belong to the reports that have no wire order to preserve, which is why {@link Output.jsonPretty} sorts and this does not.
 *
 * @param output - The destination sink.
 * @param value  - The document to render.
 * @param format - The rendering to use.
 *
 * @category CLI
 */
export function renderDocument(output: Output, value: unknown, format: DocumentFormat): void {

  output.line((format === "json") ? JSON.stringify(value) : inspect(value, { colors: output.colorize, depth: null, sorted: true }));
}

/**
 * Render a list of label/description pairs as aligned lines: every label is right-padded to the widest label so the descriptions line up in one column. The single home
 * for the CLI's "name then description" lists - the command list and the examples block - so they align by the same rule and an added entry can never leave a list
 * ragged (the width is measured from the entries, not hand-spaced). Each line is indented two spaces, with two spaces between the columns.
 *
 * @param rows - The `[label, description]` pairs, in display order.
 *
 * @returns One formatted line per row.
 *
 * @category CLI
 */
export function alignedList(rows: readonly (readonly [string, string])[]): string[] {

  const width = rows.reduce((max, [label]) => Math.max(max, label.length), 0);

  return rows.map(([ label, description ]) => "  " + label.padEnd(width) + "  " + description);
}

/**
 * Compare two strings by UTF-16 code unit - the default, locale-independent string ordering. The single comparator behind every deterministic sort the CLI performs (the
 * JSON key ordering below and the usage-screen command list), so "sorted" means one thing, identical on every machine.
 *
 * @param a - The first string.
 * @param b - The second string.
 *
 * @returns A negative number when `a` precedes `b`, positive when it follows, zero when equal.
 *
 * @category CLI
 */
export function compareCodeUnit(a: string, b: string): number {

  return (a < b) ? -1 : ((a > b) ? 1 : 0);
}

/**
 * Format a duration in milliseconds as a compact, human-readable string - the two most significant non-zero units, e.g. "3d 4h" or "12m 8s". Used for the controller
 * uptime the health report quotes, where a precise millisecond count is noise but the order of magnitude is the point.
 *
 * @param ms - The duration in milliseconds.
 *
 * @returns The compact representation, or "0s" when the duration rounds down to zero whole seconds (any value under one second, a non-positive one included).
 *
 * @category CLI
 */
export function formatDuration(ms: number): string {

  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts: string[] = [];

  if(days > 0) {

    parts.push(days.toString() + "d");
  }

  if(hours > 0) {

    parts.push(hours.toString() + "h");
  }

  if(minutes > 0) {

    parts.push(minutes.toString() + "m");
  }

  if(seconds > 0) {

    parts.push(seconds.toString() + "s");
  }

  return (parts.length > 0) ? parts.slice(0, 2).join(" ") : "0s";
}

/* The `JSON.stringify` replacer that gives the CLI's report output a stable shape: every plain object's keys are emitted in deterministic order via the shared
 * `compareCodeUnit` (locale-independent, so the ordering is identical on every machine). Any value that is not a plain record - null, a primitive, an array, or a
 * typed array - is returned untouched rather than reordered. An array is exempt for correctness: folding it through the entries/sort path would turn `[1, 2, 3]` into
 * the object `{ "0": 1, ... }`, losing both its element order and its array-ness. The returned object holds the original values; `JSON.stringify` re-applies this
 * replacer as it descends, so the whole tree sorts from this one rule. Note this normalizes a payload's keys, so its output is canonical rather than a byte-for-byte
 * reproduction of the controller's field order - which is why the wire-order rendering in `renderDocument` deliberately does not use it.
 */
function sortKeysReplacer(_key: string, value: unknown): unknown {

  if((value === null) || (typeof value !== "object") || Array.isArray(value) || ArrayBuffer.isView(value)) {

    return value;
  }

  return Object.fromEntries(Object.entries(value).sort(([a], [b]) => compareCodeUnit(a, b)));
}

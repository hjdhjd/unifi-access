/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * terminal-inputs.ts: The hub terminal catalog - which keys a hub speaks about the terminals on its back, what their values mean, and when one is in service.
 */

/**
 * The single home of what a hub's terminal values mean: the catalog of every terminal family a hub reports, the on/off vocabulary those keys are written in, the
 * wiring-pair rule that decides whether a terminal is in service, and the duty selector that stands in for a pair on hardware that detects none.
 *
 * A UniFi Access hub has screw terminals on its back, and the controller reports two quite different things about each one. It reports whether something is wired to
 * the terminal, as a pair of live-circuit keys the hardware revises as circuits appear and vanish, and it reports what that terminal currently reads, as an on/off
 * row beside them. Both are raw hardware flags rather than an interpretation, which is what this catalog is for: which keys a device carries, what their values are
 * spelled as, and when the two together amount to a reading worth answering with.
 *
 * This is protocol-tier material for the same reason {@link AccessDoorState} is. The knowledge is about what the wire's values mean, it performs no I/O, and both of
 * its consumers sit above it: the door-state derivation reads the position half of this catalog to say what a door is doing, and the state tier publishes the whole
 * of it as a per-terminal read. Declaring the vocabulary once below both is what keeps the door meaning and the raw terminal read from each carrying their own copy
 * of the keys a hub speaks.
 *
 * @module AccessTerminalInputs
 */
import type { AccessDeviceEntryConfig, AccessKnownJsonValue } from "../types/index.ts";
import { portExtensionsOf } from "./port-bindings.ts";

/**
 * Every terminal a hub reports about: `dps` the door position sensor, `rel` the remote release, `ren` the request to enter, `rex` the request to exit, and
 * `sideDps` the position sensor of the side door a UA Hub or a UA Gate drives.
 *
 * The names are this library's own rather than the wire's. The controller spells one terminal differently on each hardware family - a UA Hub's position input is
 * `input_state_dps` where a UA Hub Door Mini's is `input_d1_dps` - so a vocabulary keyed on wire spellings would hand every consumer the same per-model table this
 * module exists to own. A consumer iterating the terminals a hub can report reads this list rather than restating it.
 *
 * @category Protocol
 */
export const ACCESS_TERMINAL_INPUTS = [ "dps", "rel", "ren", "rex", "sideDps" ] as const;

/** One terminal of {@link ACCESS_TERMINAL_INPUTS}. */
export type AccessTerminalInput = (typeof ACCESS_TERMINAL_INPUTS)[number];

/**
 * What a terminal read established, shaped so that the coupling rules between its members cannot be violated.
 *
 * The three arms are the three honest outcomes rather than one shape with optional members. A terminal in service carries its reading wherever one is readable; a
 * terminal the hardware reports nothing wired to says exactly that and carries no reading, because a floating input's row is a value nothing has qualified; and a
 * terminal nothing has said anything about makes no claim in either direction, which is a different statement from reporting it unwired. `wired` means in service:
 * a live circuit detected on the terminal's own wiring pair, or, on hardware that detects no circuits, the port's duty selector naming this terminal as the one
 * that input is assigned to. The third arm is the empty object, typed with an optional-undefined member so that a consumer reads `facts.wired` as a three-way
 * value and narrows on it.
 *
 * A member whose evidence is absent is ABSENT from the object rather than present and `undefined`. The project's compiler settings do not police explicit
 * `undefined`, so this is a rule the tests enforce with `Object.hasOwn` rather than one the type system can hold.
 *
 * @category Protocol
 */
export type AccessTerminalInputFacts = { state?: boolean; wired: true } | { wired: false } | { wired?: undefined };

/**
 * What the terminal reads read off a device record.
 *
 * Declared structurally rather than as the stored device record, so this module depends on exactly the members it consults and takes no type edge to the reducer.
 * Each member serves one read. `configs` carries every flag, the row array being where the controller keeps a wiring pair and the reading it qualifies alike;
 * `extensions` carries the port's duty selector on a whole hub record; and `source_id` names the port a synthesized per-port record stands for. The wire record
 * declares `source_id` at its top level because the access-point expansion spreads a port's extension onto the record it synthesizes, so the stored record carries
 * it as declared surface rather than through an index signature. Both the wire's device record and the reducer's stored form satisfy this.
 *
 * @category Protocol
 */
export interface AccessTerminalSource {

  readonly configs?: readonly AccessDeviceEntryConfig[];
  readonly extensions?: readonly {

    readonly extension_name: string;
    readonly target_config: readonly { readonly config_key: string; readonly config_value: boolean | number | string }[];
  }[];
  readonly source_id?: string;
}

/**
 * One terminal family: which terminal it is, the row the controller keeps that terminal's reading on, the wiring pair that says whether it is in service, and, for
 * a position terminal that serves a door, the lock relay output the same door port carries.
 *
 * A family is identified by the keys a device carries rather than by a device type string, because the same keys serve more than one model and the controller's
 * model naming is not the thing that decides which terminals a hub has. The wiring pair is named by every family while the lock relay is not: whether a device
 * answers a pair's keys is what varies, where whether the family has names for them is not, and only the lock relay is genuinely absent from a family's
 * vocabulary. It is named here at all because it is the one output belonging to the same door port as the position input, which is the pair the door-state
 * derivation reads together.
 *
 * @category Protocol
 */
export interface AccessTerminalFamily {

  readonly input: AccessTerminalInput;
  readonly key: string;
  readonly lockRelay?: string;
  readonly wiring: readonly [string, string];
}

/* The per-hardware key catalog, with each family's provenance stated so a reader knows which rows rest on captures and which on field reports.
 *
 * - The `d` families (a UA Hub Door Mini, a UA Ultra, and every port of an Enterprise Access Hub). Position and lock relay capture-proven 2026-08-16 against a live
 *   controller: the Mini's input toggled through a full reed cycle in step with the stream's own verdict, and the lock relay flipped exactly as the stream reported
 *   the lock. The Ultra carries the same two keys and no wiring pair whatsoever, proven present-and-absent respectively in the same session while the door was
 *   wired and reporting.
 * - The UA Hub's main door. Position inversion field-proven at consumer scale by this library's own earlier consumers; lock relay capture-proven 2026-08-16 on the
 *   same live controller. A UA Hub duplicates these three facts onto its door's extras under a `uah-` prefix, which the door-state module accepts as the same facts.
 * - The UA Hub's side door and the UA Gate hub. Field-derived from consumer reports rather than from any capture in hand - no sampled topology includes gate
 *   hardware - so they are marked as such here and carry no lock relay, because no report establishes one.
 * - The UA Hub's remote release, request to enter, and request to exit. Every one of these keys is present on both captured UA Hub units, with every reading and
 *   every pair member reading `off`, so the keys themselves are capture-established while the `on` reading of these three has never been captured - an honest limit
 *   the reads below inherit.
 * - The UA Ultra's duty selector, captured reading `dps` on live hardware. Its other value is field-reported by this library's own earlier consumers, which read
 *   this same selector to decide which duty an Ultra's one input terminal was serving.
 * - The Enterprise Access Hub's ports. Every port's rows and every port's extension are in the capture, and the port index is what the parallel numbering of the
 *   extension's `source_id` and the row keys establishes; no reading of any of them has been observed as anything but `off`.
 *
 * The wiring keys are LIVE CIRCUIT DETECTION rather than static configuration. The controller updates them as circuits appear and vanish, proven in the
 * disconnection direction on 2026-08-16: pulling a door's sensor flipped both of its wiring keys from on to off in the topology, and the notification stream
 * degraded that same door to an unconnected position report in the same window. That is what makes deriving connection state from them honest at any read rather
 * than only at the moment a hub was commissioned.
 */
const FIXED_FAMILIES: readonly AccessTerminalFamily[] = [

  { input: "dps", key: "input_state_dps", lockRelay: "input_state_rly-lock_dry", wiring: [ "wiring_state_dps-neg", "wiring_state_dps-pos" ] },
  { input: "dps", key: "input_gate_dps", wiring: [ "wiring_state_gate-dps-neg", "wiring_state_gate-dps-pos" ] },
  { input: "rel", key: "input_state_rel", wiring: [ "wiring_state_rel-neg", "wiring_state_rel-pos" ] },
  { input: "ren", key: "input_state_ren", wiring: [ "wiring_state_ren-neg", "wiring_state_ren-pos" ] },
  { input: "rex", key: "input_state_rex", wiring: [ "wiring_state_rex-neg", "wiring_state_rex-pos" ] },
  { input: "sideDps", key: "input_door_dps", wiring: [ "wiring_state_door-dps-neg", "wiring_state_door-dps-pos" ] }
];

/* The two families a numbered door port speaks, built from the port's own decimal index: its door position sensor with the lock relay beside it, and the request to
 * exit its button terminal carries. A single-door hub that speaks this vocabulary - a UA Hub Door Mini, a UA Ultra - speaks it as port one, which is why nothing
 * here treats a one-port hub as a shape of its own.
 */
function portFamilies(port: number): readonly AccessTerminalFamily[] {

  const prefix = "d" + port.toString();

  return [

    { input: "dps", key: "input_" + prefix + "_dps", lockRelay: "output_" + prefix + "_lock_relay",
      wiring: [ "wiring_state_" + prefix + "-dps-neg", "wiring_state_" + prefix + "-dps-pos" ] },
    { input: "rex", key: "input_" + prefix + "_button", wiring: [ "wiring_state_" + prefix + "-button-neg", "wiring_state_" + prefix + "-button-pos" ] }
  ];
}

/* The port configuration entry naming which duty an assignable input terminal is serving. The same key spelling also appears as a device-level configuration row on
 * a UA Ultra and a UA Hub, where it reads `push`: that row is the button's electrical behavior rather than the duty, so the duty is read from the port extension's
 * `target_config` and never from the rows, and a device-level row spelling a duty name is not a duty.
 */
const DUTY_KEY = "rex_button_mode";

// The duties a single assignable input terminal can be given: door position sensing, or request to exit.
type TerminalDuty = "dps" | "rex";

/* Which terminal each duty stands for, and the duty vocabulary derived from it. The annotation is what lets the whole terminal vocabulary index this table - a
 * `satisfies` would hold the literal to its two keys and refuse every other input - and a terminal absent from it is one no hardware assigns a duty to.
 */
const DUTY_OF: Readonly<Partial<Record<AccessTerminalInput, TerminalDuty>>> = { dps: "dps", rex: "rex" };
const TERMINAL_DUTIES: ReadonlySet<string> = new Set(Object.values(DUTY_OF));

/* What a record's port extension says its assignable input is assigned to, or undefined where nothing says. A synthesized per-port record carries no extensions at
 * all and answers undefined here, which is honest: no captured Enterprise Access Hub port carries a duty selector, their extensions carrying a `button_mode` entry
 * instead, a different key whose meaning nothing has established. A record carrying several port extensions is a whole multi-port hub, which the ambiguity rule
 * answers before any duty is read, so this reads the first port extension without scoping it to a port.
 */
function dutyOf(device: AccessTerminalSource): string | undefined {

  for(const extension of portExtensionsOf(device)) {

    const value = extension.target_config.find((entry) => entry.config_key === DUTY_KEY)?.config_value;

    return (typeof value === "string") ? value : undefined;
  }

  return undefined;
}

// How a synthesized per-port record names the port it stands for, and how a numbered row key spells its own port. The record's identity is the authority where it
// carries one, and the rows are what a whole hub's port vocabulary is read from otherwise.
const PORT_SOURCE = /^port(\d+)$/;
const PORT_ROW = /^input_d(\d+)_(?:dps|button)$/;
const PORT_RELAY_ROW = /^output_d(\d+)_lock_relay$/;

// The port a record stands for, where its identity names one. This is the access-point expansion's own `source_id`, which is what makes a synthesized port read its
// own terminals and no sibling's.
function portOf(device: AccessTerminalSource): number | undefined {

  const port = PORT_SOURCE.exec(device.source_id ?? "")?.[1];

  return (port === undefined) ? undefined : Number(port);
}

// Every port index a record's rows spell, in ascending order. This is the port vocabulary a whole record speaks, which is one port for single-door hardware and
// eight for a captured Enterprise Access Hub.
function portsOf(device: AccessTerminalSource): readonly number[] {

  const ports = new Set<number>();

  for(const entry of device.configs ?? []) {

    const port = PORT_ROW.exec(entry.key)?.[1] ?? PORT_RELAY_ROW.exec(entry.key)?.[1];

    if(port !== undefined) {

      ports.add(Number(port));
    }
  }

  return [...ports].sort((first, second) => first - second);
}

/* The families a record is judged against: the fixed ones every time, plus the port families of exactly the port the record identifies itself as, or of every port
 * its rows spell where it identifies none. That is what makes a synthesized port answer for its own port alone while a whole multi-port hub speaks all of them and
 * meets the ambiguity rule below.
 */
function familySetOf(device: AccessTerminalSource): readonly AccessTerminalFamily[] {

  const identified = portOf(device);
  const ports = (identified === undefined) ? portsOf(device) : [identified];

  return [ ...FIXED_FAMILIES, ...ports.flatMap((port) => portFamilies(port)) ];
}

/**
 * Read one hardware flag as the on/off condition the controller writes it as.
 *
 * Anything outside that vocabulary reads as absent. The controller has never written these keys any other way, and a value it has not been observed to write is not
 * something to guess the meaning of.
 *
 * @param value - The raw configuration value, as the row carried it.
 *
 * @returns `true` for `on`, `false` for `off`, and `undefined` for anything else.
 *
 * @category Protocol
 */
export function readTerminalFlag(value: AccessKnownJsonValue | undefined): boolean | undefined {

  switch(value) {

    case "on":

      return true;

    case "off":

      return false;

    default:

      return undefined;
  }
}

/**
 * Read one of a device's flag rows, falling back to a second carrier of the same keys where the device's own record is silent.
 *
 * The fallback is what accepts a UA Hub's facts duplicated onto the door it drives. It is a fallback rather than a merge because the device record is the hub
 * speaking about its own terminals, where the second carrier is the same facts copied elsewhere - so where both exist they agree, and where they disagree the
 * hub's own record is the one to believe.
 *
 * @param device   - The record to read the row from.
 * @param key      - The row key.
 * @param fallback - The second carrier of the same keys, consulted only where the record holds no such row.
 *
 * @returns What {@link readTerminalFlag} makes of the value, or `undefined` where neither carrier holds the key.
 *
 * @category Protocol
 */
export function readTerminalKey(device: AccessTerminalSource, key: string, fallback?: (key: string) => AccessKnownJsonValue | undefined): boolean | undefined {

  return readTerminalFlag(device.configs?.find((entry) => entry.key === key)?.value ?? fallback?.(key));
}

/**
 * Which terminal families a record carries.
 *
 * A family counts as carried when the record holds either of the keys that identify it, so a hub reporting a lock relay and no position input is still recognized
 * as the family it belongs to. Which families a record is judged against follows from the port it identifies itself as, or from the ports its rows spell.
 *
 * @param device - The record to read.
 *
 * @returns The families this record carries, in catalog order.
 *
 * @category Protocol
 */
export function terminalFamiliesOf(device: AccessTerminalSource): readonly AccessTerminalFamily[] {

  const keys = new Set((device.configs ?? []).map((entry) => entry.key));

  return familySetOf(device).filter((family) => keys.has(family.key) || ((family.lockRelay !== undefined) && keys.has(family.lockRelay)));
}

/**
 * What a device reports about one of its terminals: whether it is in service, and what it reads where it is.
 *
 * @param device   - The record to read.
 * @param input    - Which terminal to read.
 * @param fallback - A second carrier of the same keys, consulted only where the record holds no such row.
 *
 * @returns The facts, with every member whose evidence is absent left out entirely. An empty object means nothing established either verdict.
 *
 * @category Protocol
 */
export function readTerminalInput(device: AccessTerminalSource, input: AccessTerminalInput,
  fallback?: (key: string) => AccessKnownJsonValue | undefined): AccessTerminalInputFacts {

  const [ family, ambiguous ] = terminalFamiliesOf(device).filter((candidate) => candidate.input === input);

  /* No family speaking this terminal is no evidence, and more than one is ambiguity answered with silence rather than with a guess. A whole Enterprise Access Hub
   * asked about its request to exit is the second case: eight ports each speak one and nothing on the record says which of them is meant, so the per-port handles
   * are what answer instead.
   */
  if((family === undefined) || (ambiguous !== undefined)) {

    return {};
  }

  const read = (key: string): boolean | undefined => readTerminalKey(device, key, fallback);
  const wired = readWiring(read, family) ?? dutyWiring(device, input);

  if(wired === undefined) {

    return {};
  }

  if(!wired) {

    return { wired: false };
  }

  /* The reading is taken only behind the wired verdict that qualifies it. A floating input still has a row, and that row is a value the hardware has not stood
   * behind, so publishing it would dress an unqualified reading as a reading. A wiring pair reporting a live circuit while the input it qualifies reads nothing is
   * a shape no capture has produced, and rather than invent an arm for it the reading drops out and the wired verdict stands on its own.
   */
  const state = read(family.key);

  return (state === undefined) ? { wired: true } : { state, wired: true };
}

/* Whether the family's wiring pair reports a live circuit, or undefined when the pair is not readable at all - which is a UA Ultra's ordinary condition rather than
 * a fault. Both halves must read for the pair to mean anything, and both must be live for the circuit to be: a single connected terminal is a half-wired sensor,
 * which is not a sensor.
 */
function readWiring(read: (key: string) => boolean | undefined, family: AccessTerminalFamily): boolean | undefined {

  const [ negative, positive ] = family.wiring;
  const negativeState = read(negative);
  const positiveState = read(positive);

  if((negativeState === undefined) || (positiveState === undefined)) {

    return undefined;
  }

  return negativeState && positiveState;
}

/* The duty selector read as wiring evidence, for hardware that detects no circuits and so reports no pair. One input terminal that can be assigned to either duty
 * makes the assignment the evidence: the selector naming this terminal is a terminal in service, the selector naming the other duty is a terminal nothing is wired
 * to, and a selector reading a value outside the two duties establishes neither rather than being guessed at.
 */
function dutyWiring(device: AccessTerminalSource, input: AccessTerminalInput): boolean | undefined {

  const duty = DUTY_OF[input];
  const selected = dutyOf(device);

  if((duty === undefined) || (selected === undefined)) {

    return undefined;
  }

  if(selected === duty) {

    return true;
  }

  return TERMINAL_DUTIES.has(selected) ? false : undefined;
}

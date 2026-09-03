/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * door-state.ts: The door-state interpretation - a hub's wiring, input, and lock-relay flags translated into the door state the rest of the library speaks.
 */

/**
 * The single home of door-state wire interpretation: what a hub's raw hardware flags say about the door it drives, and the translations that turn the controller's
 * several spellings of one condition into one vocabulary.
 *
 * This is protocol-tier material for the same reason {@link AccessVocabulary} is. The knowledge here is about what the wire's values mean, it performs no I/O, and
 * placing it above the protocol tier would make protocol-tier consumers reach upward for the vocabulary they themselves speak. The reducer's topology seed is its
 * first consumer and the composition root's official seed is its second, which is precisely why the translations are declared once here rather than at either
 * call site.
 *
 * The controller reports a door's condition in two quite different ways, and the difference is what shapes this module. A door-state notification carries the
 * controller's own semantic verdict - `close`, `open`, `locked`, `unlocked` - already interpreted. The topology document carries no door state at all; what it
 * carries is the raw hardware flags a hub reports about its terminals, and turning those into the same vocabulary is this module's job. A seeded reading is
 * therefore an interpretation of hardware, where a streamed reading is the controller's own report, and the stream is always the fresher and more authoritative of
 * the two.
 *
 * @module AccessDoorState
 */
import type { AccessDeviceConfig, AccessKnownJsonValue } from "../types/index.ts";

/** A door's position, as the controller's own door-state notifications spell it. */
export type AccessDoorPosition = "close" | "none" | "open";

/** A door's lock condition, as the controller's own door-state notifications spell it. */
export type AccessDoorLockState = "locked" | "unlocked";

/**
 * What a derivation established about a door, shaped so that the coupling rules between its members cannot be violated.
 *
 * The three arms are the three honest outcomes rather than one shape with three optional members. A wired door has a real position and says so; an unwired door
 * reports the position vocabulary's own `none` and says that too; a door whose hardware carries no wiring evidence at all makes no claim about position in either
 * direction, which is a different statement from claiming it is disconnected. Expressing that as a union means a position without the connection state that
 * qualifies it, or a `none` paired with a connected verdict, are not merely wrong but unwritable.
 *
 * A member whose evidence is absent is ABSENT from the object rather than present and `undefined`. That matters because the seed spreads these facts into a door
 * state entry and relies on key absence to leave a held member standing; the project's compiler settings do not police explicit `undefined`, so this is a rule the
 * tests enforce with `Object.hasOwn` rather than one the type system can hold.
 */
export type AccessDoorStateFacts =
  { dps: "close" | "open"; dps_connected: true; lock?: AccessDoorLockState } |
  { dps: "none"; dps_connected: false; lock?: AccessDoorLockState } |
  { lock?: AccessDoorLockState };

/* One hardware family's flag names: the door position input, the wiring pair that says whether that input is connected to anything, and the lock relay.
 *
 * A family is identified by the keys it uses rather than by a device type string, because the same keys serve more than one model and the controller's model
 * naming is not the thing that decides which terminals a hub has. The `d1` family below is exactly that case: a UA Hub Door Mini and a UA Ultra speak the same
 * key vocabulary, and they differ only in that the Ultra reports no wiring pair at all - which the derivation reads as absent evidence rather than as a model it
 * has to know about. That is why the wiring pair is named by every family while the lock relay is not: whether a device answers those keys is what varies, where
 * whether the family has names for them is not, and only the lock relay is genuinely absent from a family's vocabulary.
 */
interface DoorStateFamily {

  input: string;
  lockRelay?: string;
  wiring: readonly [string, string];
}

/* The per-hardware key catalog, with each family's provenance stated so a reader knows which rows rest on captures and which on field reports.
 *
 * - The `d1` family (UA Hub Door Mini, UA Ultra). Position and lock relay capture-proven 2026-08-16 against a live controller: the Mini's input toggled through a
 *   full reed cycle in step with the stream's own verdict, and the lock relay flipped exactly as the stream reported the lock. The Ultra carries the same two keys
 *   and no wiring pair whatsoever, proven present-and-absent respectively in the same session while the door was wired and reporting.
 * - The UAH main door. Position inversion field-proven at consumer scale by this library's own earlier consumers; lock relay capture-proven 2026-08-16 on the same
 *   live controller. A UA Hub duplicates these three facts onto its door's extras under a `uah-` prefix, which the reader below accepts as the same facts.
 * - The UAH side door and the UA Gate hub. Field-derived from consumer reports rather than from any capture in hand - no sampled topology includes gate hardware -
 *   so they are marked as such here and carry no lock relay, because no report establishes one.
 *
 * The wiring keys are LIVE CIRCUIT DETECTION rather than static configuration. The controller updates them as circuits appear and vanish, proven in the
 * disconnection direction on 2026-08-16: pulling a door's sensor flipped both of its wiring keys from on to off in the topology, and the notification stream
 * degraded that same door to an unconnected position report in the same window. That is what makes deriving connection state from them honest at any read rather
 * than only at the moment a hub was commissioned.
 */
const DOOR_STATE_FAMILIES: readonly DoorStateFamily[] = [

  { input: "input_d1_dps", lockRelay: "output_d1_lock_relay", wiring: [ "wiring_state_d1-dps-neg", "wiring_state_d1-dps-pos" ] },
  { input: "input_state_dps", lockRelay: "input_state_rly-lock_dry", wiring: [ "wiring_state_dps-neg", "wiring_state_dps-pos" ] },
  { input: "input_door_dps", wiring: [ "wiring_state_door-dps-neg", "wiring_state_door-dps-pos" ] },
  { input: "input_gate_dps", wiring: [ "wiring_state_gate-dps-neg", "wiring_state_gate-dps-pos" ] }
];

// The prefix a UA Hub duplicates its door-state facts onto the door's own extras under. The duplicated values are the same facts under a longer name, so the flag
// reader falls back to them rather than treating them as a separate family.
const DOOR_EXTRAS_PREFIX = "uah-";

/**
 * What the derivation reads off the door itself.
 *
 * Declared structurally rather than as the stored door record, so this module depends on exactly the one member it consults and takes no type edge to the reducer
 * that calls it. Both the wire's door record and the reducer's pruned form satisfy it.
 */
export interface AccessDoorStateSource {

  readonly extras?: Readonly<Record<string, AccessKnownJsonValue>>;
}

/**
 * Derive what a door's serving hardware says about it.
 *
 * The caller resolves which devices serve the door - the door's own device group is that membership - and passes them, because the protocol tier holds no topology
 * of its own to resolve it from.
 *
 * **Position derives from the input flag under the family's proven polarity: `on` reads as closed and `off` as open.** A door position sensor is a contact whose
 * sense depends on how an installer wired and mounted it, so a deployment that inverts the contact would invert this reading; the controller's own door-state
 * notification is always the fresher and more authoritative verdict, and the first one to arrive replaces whatever was seeded here.
 *
 * Ambiguity is answered with silence rather than with a guess. Exactly one serving device carrying exactly one applicable family derives; anything else derives
 * nothing at all. A device carrying two families is speaking for two doors and nothing here can tell which one this is; two devices each carrying a family leave
 * no way to say which describes the door; and a door driven by hardware the building hosts directly has no serving device in its own group at all, so it falls out
 * as the no-candidate case rather than needing a rule of its own. Hardware that carries none of these keys - a reader alongside a hub, say - is not a candidate and
 * creates no ambiguity, so the ordinary door with a hub and its readers derives from the hub.
 *
 * @param door    - The door, read for the extras a UA Hub duplicates its facts onto.
 * @param devices - The devices serving that door.
 *
 * @returns What the hardware established, with every member whose evidence is absent left out entirely. An empty object means the hardware said nothing readable.
 *
 * @category Protocol
 */
export function deriveDoorState(door: AccessDoorStateSource, devices: readonly AccessDeviceConfig[]): AccessDoorStateFacts {

  let candidate: { device: AccessDeviceConfig; family: DoorStateFamily } | undefined;

  for(const device of devices) {

    const families = familiesOf(device);

    // One device speaking for two doors. Which door this is cannot be answered from the device record, so the whole derivation stops rather than picking.
    if(families.length > 1) {

      return {};
    }

    const family = families[0];

    if(family === undefined) {

      continue;
    }

    // A second device that also carries a family. Neither can be preferred over the other on anything the records say.
    if(candidate !== undefined) {

      return {};
    }

    candidate = { device, family };
  }

  if(candidate === undefined) {

    return {};
  }

  const { device, family } = candidate;
  const read = (key: string): boolean | undefined => readFlag(door, device, key);
  const lock = (family.lockRelay === undefined) ? undefined : read(family.lockRelay);

  // The lock half is independent of the position half: a family may prove one and say nothing about the other, and each is carried or omitted on its own evidence.
  const lockFacts = (lock === undefined) ? {} : { lock: lock ? "unlocked" as const : "locked" as const };
  const wired = readWiring(read, family);

  if(wired === undefined) {

    return lockFacts;
  }

  if(!wired) {

    return { "dps": "none", "dps_connected": false, ...lockFacts };
  }

  const input = read(family.input);

  /* A wiring pair that reports a live circuit while the input it qualifies reads nothing is a shape no capture has produced. Rather than invent an arm for it,
   * the position half drops out entirely and the lock half stands on its own - the same honest-absence answer every other missing flag gets.
   */
  if(input === undefined) {

    return lockFacts;
  }

  return { "dps": input ? "close" : "open", "dps_connected": true, ...lockFacts };
}

/**
 * Translate the official API's lock spelling into the vocabulary the notification stream uses.
 *
 * The two channels describe one condition with different words - the official door read answers `lock` and `unlock` where the stream says `locked` and `unlocked` -
 * so this is the one place that fold happens, exactly as the actor-type fold has one place.
 *
 * @param status - The lock status as the official read spelled it.
 *
 * @returns The stream's spelling, or `undefined` for a value outside the pair, which is absent evidence rather than a condition to invent.
 *
 * @category Protocol
 */
export function officialLockState(status: string): AccessDoorLockState | undefined {

  switch(status) {

    case "lock":

      return "locked";

    case "unlock":

      return "unlocked";

    default:

      return undefined;
  }
}

/**
 * Translate the official API's door position into the vocabulary the notification stream uses.
 *
 * The position vocabularies already agree, so the translation this owns is the null one: the official read answers `null` for a door it has no position for, which
 * is absence rather than a value, and the stream's own `none` is a real reading that carries through as itself.
 *
 * @param status - The position status as the official read spelled it.
 *
 * @returns The position, or `undefined` when the read carried none.
 *
 * @category Protocol
 */
export function officialDoorPosition(status: string | null): string | undefined {

  return status ?? undefined;
}

// Which families a device's own configuration carries. A family counts as carried when the device holds either of the keys that identify it, so a hub that reports
// a lock relay but no position input is still recognized as the family it belongs to.
function familiesOf(device: AccessDeviceConfig): DoorStateFamily[] {

  const keys = new Set(device.configs.map((entry) => entry.key));

  return DOOR_STATE_FAMILIES.filter((family) => keys.has(family.input) || ((family.lockRelay !== undefined) && keys.has(family.lockRelay)));
}

/* Whether the family's wiring pair reports a live circuit, or undefined when the pair is not readable at all - which is the UA Ultra's ordinary condition
 * rather than a fault. Both halves must read for the pair to mean anything, and both must be live for the circuit to be: a single connected terminal is a
 * half-wired sensor, which is not a sensor.
 */
function readWiring(read: (key: string) => boolean | undefined, family: DoorStateFamily): boolean | undefined {

  const [ negative, positive ] = family.wiring;
  const negativeState = read(negative);
  const positiveState = read(positive);

  if((negativeState === undefined) || (positiveState === undefined)) {

    return undefined;
  }

  return negativeState && positiveState;
}

/* Read one hardware flag as the on/off condition the controller writes it as, preferring the device's own configuration and falling back to the door's extras.
 *
 * The fallback is what accepts a UA Hub's duplicated facts. It is a fallback rather than a merge because the device record is the hub speaking about its own
 * terminals, where the extras are the same facts copied onto the door - so where both exist they agree, and where they disagree the hub's own record is the one to
 * believe.
 *
 * Anything outside the on/off vocabulary reads as absent. The controller has never written these keys any other way, and a value it has not been observed to write
 * is not something to guess the meaning of.
 */
function readFlag(door: AccessDoorStateSource, device: AccessDeviceConfig, key: string): boolean | undefined {

  const value = device.configs.find((entry) => entry.key === key)?.value ?? door.extras?.[DOOR_EXTRAS_PREFIX + key];

  switch(value) {

    case "on":

      return true;

    case "off":

      return false;

    default:

      return undefined;
  }
}

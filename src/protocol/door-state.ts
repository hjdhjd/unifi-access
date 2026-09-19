/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * door-state.ts: The door-state interpretation - what a hub's position terminal and lock relay say about the door it drives, in the vocabulary the library speaks.
 */

/**
 * The single home of door-state interpretation: what a hub's position terminal and lock relay say about the door that hardware drives, and the translations that
 * turn the controller's several spellings of one condition into one vocabulary.
 *
 * What lives here is door MEANING. The polarity a position sensor's reading is read under, the two conditions a lock relay stands for, and the door's own extras as
 * a second carrier of the hub's facts are all door knowledge, while which keys a hub speaks about its terminals - and whether any one of them is in service - is
 * terminal knowledge, and that half lives in {@link AccessTerminalInputs} below this module. The split is what keeps a raw terminal read and a door's condition from
 * each carrying a copy of the other's knowledge: this module names no wire key at all, and asks the catalog for the position terminal it then interprets.
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
import type { AccessTerminalFamily, AccessTerminalInput } from "./terminal-inputs.ts";
import { readTerminalInput, readTerminalKey, terminalFamiliesOf } from "./terminal-inputs.ts";

/** A door's position, as the controller's own door-state notifications spell it. */
export type AccessDoorPosition = "close" | "none" | "open";

/** A door's lock condition, as the controller's own door-state notifications spell it. */
export type AccessDoorLockState = "locked" | "unlocked";

/**
 * What a derivation established about a door, shaped so that the coupling rules between its members cannot be violated.
 *
 * Each arm is a distinct honest outcome rather than one shape with optional members. A wired door has a real position and says so; an unwired door reports the position
 * vocabulary's own `none` and says that too; a door whose hardware carries no wiring evidence at all makes no claim about position in either direction, which is a
 * different statement from claiming it is disconnected. Expressing that as a union means a position without the connection state that qualifies it, or a `none` paired
 * with a connected verdict, are not merely wrong but unwritable.
 *
 * A member whose evidence is absent is ABSENT from the object rather than present and `undefined`. That matters because the seed spreads these facts into a door
 * state entry and relies on key absence to leave a held member standing; the project's compiler settings do not police explicit `undefined`, so this is a rule the
 * tests enforce with `Object.hasOwn` rather than one the type system can hold.
 */
export type AccessDoorStateFacts =
  { dps: "close" | "open"; dps_connected: true; lock?: AccessDoorLockState } |
  { dps: "none"; dps_connected: false; lock?: AccessDoorLockState } |
  { lock?: AccessDoorLockState };

/* The terminals that position a door, which is what makes a device a candidate for speaking about one. A hub reports several terminals and only these two say
 * anything about where a door is: the door position sensor of the port a door is bound to, and the position sensor of the side door a UA Hub or a UA Gate drives.
 * Everything else a hub carries - its release and its two request terminals - is a button rather than a position, so the candidate rule below counts these alone.
 */
const DOOR_POSITION_INPUTS: ReadonlySet<AccessTerminalInput> = new Set<AccessTerminalInput>([ "dps", "sideDps" ]);

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
 * notification is always the fresher and more authoritative verdict, and the first one to arrive replaces whatever was seeded here. On hardware that detects no
 * wiring at all, the port's duty selector is the wiring evidence, so a UA Ultra assigned to door-position duty derives its position from its input and one assigned
 * to request-to-exit duty derives the disconnected reading.
 *
 * Ambiguity is answered with silence rather than with a guess. Exactly one serving device carrying exactly one position terminal derives; anything else derives
 * nothing at all. A device carrying two position terminals is speaking for two doors and nothing here can tell which one this is; two devices each carrying one
 * leave no way to say which describes the door; and a door driven by hardware the building hosts directly has no serving device in its own group at all, so it
 * falls out as the no-candidate case rather than needing a rule of its own. Only a position terminal is counted, so a hub reporting a request to exit beside its
 * door position sensor is speaking about one door rather than two, and hardware carrying no position terminal at all - a reader alongside a hub, say - is not a
 * candidate and creates no ambiguity, so the ordinary door with a hub and its readers derives from the hub.
 *
 * @param door    - The door, read for the extras a UA Hub duplicates its facts onto.
 * @param devices - The devices serving that door.
 *
 * @returns What the hardware established, with every member whose evidence is absent left out entirely. An empty object means the hardware said nothing readable.
 *
 * @category Protocol
 */
export function deriveDoorState(door: AccessDoorStateSource, devices: readonly AccessDeviceConfig[]): AccessDoorStateFacts {

  let candidate: { device: AccessDeviceConfig; family: AccessTerminalFamily } | undefined;

  for(const device of devices) {

    const families = terminalFamiliesOf(device).filter((family) => DOOR_POSITION_INPUTS.has(family.input));

    // One device speaking for two doors. Which door this is cannot be answered from the device record, so the whole derivation stops rather than picking.
    if(families.length > 1) {

      return {};
    }

    const family = families[0];

    if(family === undefined) {

      continue;
    }

    // A second device that also carries a position terminal. Neither can be preferred over the other on anything the records say.
    if(candidate !== undefined) {

      return {};
    }

    candidate = { device, family };
  }

  if(candidate === undefined) {

    return {};
  }

  const { device, family } = candidate;

  // The door's own extras, offered to every read as the second carrier of the hub's facts. A UA Hub copies its terminal rows onto the door under a longer name,
  // and the catalog's readers take that copy wherever the hub's own record is silent.
  const fallback = (key: string): AccessKnownJsonValue | undefined => door.extras?.[DOOR_EXTRAS_PREFIX + key];
  const lock = (family.lockRelay === undefined) ? undefined : readTerminalKey(device, family.lockRelay, fallback);

  // The lock half is independent of the position half: a family may prove one and say nothing about the other, and each is carried or omitted on its own evidence.
  const lockFacts = (lock === undefined) ? {} : { lock: lock ? "unlocked" as const : "locked" as const };
  const position = readTerminalInput(device, family.input, fallback);

  if(position.wired === undefined) {

    return lockFacts;
  }

  if(!position.wired) {

    return { "dps": "none", "dps_connected": false, ...lockFacts };
  }

  /* A terminal in service whose reading is not readable is a shape no capture has produced. Rather than invent an arm for it, the position half drops out entirely
   * and the lock half stands on its own - the same honest-absence answer every other missing flag gets.
   */
  if(position.state === undefined) {

    return lockFacts;
  }

  return { "dps": position.state ? "close" : "open", "dps_connected": true, ...lockFacts };
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

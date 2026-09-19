/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * selectors.ts: Pure, memoized derived views over AccessState - the data-layer projections the store's observers dedup against.
 */

/**
 * Pre-built selectors over {@link AccessState}. Every selector is a **pure function returning configuration records**, and every selector's result is
 * reference-stable across a dispatch that did not touch what it reads, whether through this module's memo helper or, where the reducer already guarantees it,
 * by construction.
 *
 * Memoization is a correctness requirement here, not a performance flourish. An observer detects change with `Object.is`: the reducer keeps a record's reference
 * stable across dispatches that did not touch it, and these selectors keep a *derived* collection's reference stable across dispatches that did not touch the state
 * it was derived from. A selector that rebuilt its result on every call would compare unequal every time, wake every observer on every dispatch, and defeat the
 * guarantee that a refresh finding no drift is invisible.
 *
 * Two shapes come out of this module, and which one a view returns follows from what it is. A view that **groups** devices under a key returns a
 * `ReadonlyMap`, because the key is the point and a consumer looks its own key up. A view that **selects a subset** of devices returns a readonly array,
 * because there is no key to look up - just a membership a consumer iterates.
 *
 * The joins read **live** fields. A topology device record carries embedded `door`, `floor`, and `location` members, but those are a snapshot of what those records
 * looked like when the device record was issued and they go stale between notifications, and a record projected from the official API's inventory embeds none at
 * all. Reading each device's own `location_id` against the current location maps is what serves both censuses and stays live in either.
 *
 * @module AccessStateSelectors
 */
import type { AccessControllerConfig, AccessDoorStateEntry, Nullable } from "../types/index.ts";
import type { AccessState, AccessStateDevice, AccessStateRoot } from "../protocol/reducer.ts";
import type { AccessTerminalInput, AccessTerminalInputFacts } from "../protocol/terminal-inputs.ts";
import { portExtensionsOf, readPortBindings } from "../protocol/port-bindings.ts";
import type { AccessPortBinding } from "../protocol/port-bindings.ts";
import { readTerminalInput } from "../protocol/terminal-inputs.ts";

// The capability string a device carries when it acts as a hub - the controller's own marker for hardware that drives door locks rather than merely reading
// credentials. It is a capability rather than a device type because the hub role cuts across models: a reader-shaped device can be a hub too.
const HUB_CAPABILITY = "is_hub";

// The capability string a device carries when it acts as a reader - the controller's own marker for hardware that presents credentials to a door rather than
// driving its lock. It is a capability rather than a device type because the reader role cuts across models: a hub-shaped device can be a reader too.
const READER_CAPABILITY = "is_reader";

// The capability string a device carries when its hardware can detect tampering - the controller's own marker for a unit that reports being opened or pulled off
// its mount. It is a capability rather than a device type for the same reason the role capabilities are: the sensor cuts across models.
const TAMPER_CAPABILITY = "tamper_proofing";

// The configuration row the controller keeps a device's live tamper reading on, named here so the read and the tests that hold it to account never spell the wire
// key twice.
const TAMPER_EVENT_KEY = "tamper_event";

// The configuration row the controller keeps a device's tampering-alert setting on: the switch in the Access console that sounds the hub's audible alarm when
// it is tampered with. The hardware reports no tamper input while the setting is off, which is what makes the row a qualifier on the reading beside it.
const TAMPER_ALERT_KEY = "tampering";

// The device type of an Enterprise Access Hub, the multi-port hub that serves several doors from one piece of hardware through its extensions.
const ENTERPRISE_HUB_DEVICE_TYPE = "UAH-Ent";

// The access-point expansion's answer before a topology document has been applied. It is a frozen module-level constant so that every pre-bootstrap read returns the
// identical reference and no observer is woken by a state that has nothing to report yet.
const NO_ACCESS_POINTS: readonly AccessStateDevice[] = Object.freeze([]);

// A state that has a topology root, which is what the access-point expansion needs in order to tell building-hosted hardware from door-hosted hardware, and what
// gives its memo a second key to hang on.
type RootedAccessState = AccessState & Readonly<{ root: AccessStateRoot }>;

// The state references a selector's result depends on, in declaration order: one for a view derived from a single collection, two for a view that joins across two
// independently-mutable ones.
type MemoInputs = readonly [object] | readonly [object, object];

// What a grouping needs: the devices to place, the key each device belongs under, and optionally the fixed key set the result is built over.
interface GroupingOptions {

  devices: Iterable<AccessStateDevice>;
  keyOf: (device: AccessStateDevice) => string;
  keys?: Iterable<string>;
}

/* The memo every view here is built on: a per-selector chain of `WeakMap` levels, one level per input reference, keyed in declaration order.
 *
 * A single map keyed on one collection is not enough, because two of these views join across two independently-mutable collections. Keyed on devices alone, a view
 * over devices and doors would answer from cache after a door was renamed; keyed on doors alone, it would answer from cache after a device moved between doors.
 * Keying the chain on every input the view reads is what makes both kinds of drift invalidate it, and only the drift it actually depends on.
 *
 * A chain of maps also gets three properties for free that a single remembered slot does not have. Two stores running side by side hold distinct state references,
 * so they occupy distinct entries and neither evicts the other. An entry is collected once the state references that key it are gone, so there is no eviction
 * policy to tune and no growth beyond the states a consumer is still holding. And a caller replaying an older state is answered from cache rather than thrashing a
 * single slot, so reads may arrive in any order.
 */
function memoize<S, R extends object>(inputsOf: (state: S) => MemoInputs, derive: (state: S) => R): (state: S) => R {

  // The chain's first level. A single-input view stores its results directly in `direct`; a two-input join stores a second-level map in `joined` for each distinct
  // first input, and its results live one level down.
  const direct = new WeakMap<object, R>();
  const joined = new WeakMap<object, WeakMap<object, R>>();

  return (state: S): R => {

    const [ first, second ] = inputsOf(state);
    let level = direct;

    if(second !== undefined) {

      let nested = joined.get(first);

      if(nested === undefined) {

        nested = new WeakMap<object, R>();
        joined.set(first, nested);
      }

      level = nested;
    }

    const key = second ?? first;
    const cached = level.get(key);

    if(cached !== undefined) {

      return cached;
    }

    const derived = derive(state);

    level.set(key, derived);

    return derived;
  };
}

/* Group devices into per-key buckets, each bucket in the devices map's own order. The two grouping views share this one implementation and differ only in how their
 * key set is decided.
 *
 * Without `keys`, the grouping discovers its buckets from the devices themselves, so the result holds exactly the keys the hardware produced. With `keys`, the key
 * set is fixed up front: a key nothing maps to is still present with an empty bucket, and a device whose key is not among them is left out entirely. That is what
 * lets a door-keyed view list every door including the ones with no hardware, while hardware the building hosts directly - which belongs to no door - falls out of
 * the result by construction rather than by a special case.
 */
function groupDevices(options: GroupingOptions): ReadonlyMap<string, readonly AccessStateDevice[]> {

  const groups = new Map<string, AccessStateDevice[]>();
  const seeded = options.keys !== undefined;

  for(const key of (options.keys ?? [])) {

    groups.set(key, []);
  }

  for(const device of options.devices) {

    const key = options.keyOf(device);
    const group = groups.get(key);

    if(group !== undefined) {

      group.push(device);

      continue;
    }

    // A seeded grouping admits only the keys it was seeded with, so a device belonging to none of them is not this view's business.
    if(seeded) {

      continue;
    }

    groups.set(key, [device]);
  }

  return groups;
}

// Capitalize the first letter of each whitespace-separated word. The access-point expansion composes a model label from a port identifier, and this is the shape
// that label takes. It stays a local one-liner with a single caller rather than reaching for the development toolchain's string helpers, because the packaging
// contract keeps that toolchain out of the runtime dependency graph.
function titleCase(value: string): string {

  return value.replace(/(^\w|\s+\w)/g, (match) => match.toUpperCase());
}

// Whether a topology document has been applied. Narrowing on the way in is what lets the access-point expansion key its memo on the root's reference, which a null
// root could never key.
function isRooted(state: AccessState): state is RootedAccessState {

  return state.root !== null;
}

/**
 * Whether a device record is an Enterprise Access Hub the building hosts directly - the multi-port hardware {@link selectAccessPoints} expands into one access point
 * per door-serving port.
 *
 * This is the one definition of that qualification, shared by the expansion and by the projection tier's hub accessors, which is what keeps the two complementary
 * by construction: a record is expanded into per-port handles exactly where it is withheld from the whole-hub handles, so no record is ever reachable through both
 * views and no record is reachable through neither. Two independent predicates could drift into leaving a record with either both views or none.
 *
 * An Enterprise Access Hub also qualifies in a state with no topology root at all. Without a root there is no building identity to match its placement against and
 * no port extensions to expand, so a whole-hub handle would resolve its door to the hub's own location and command the wrong resource. Withholding it from the hub
 * views is the honest answer until a topology places it, and the per-port view answers empty there for the same reason.
 *
 * @param device - Any device record the state holds.
 * @param state  - The current state, whose topology root supplies the building identity the scan matches against.
 *
 * @returns `true` when the record is an Enterprise Access Hub the building hosts, or one no topology has placed.
 *
 * @category State
 */
export function isEnterpriseHubRecord(device: AccessStateDevice, state: AccessState): boolean {

  return (device.device_type === ENTERPRISE_HUB_DEVICE_TYPE) && ((state.root === null) || (device.location_id === state.root.unique_id));
}

/**
 * Whether a device acts as a hub - hardware that drives a door's lock, as opposed to a reader that only presents credentials to one.
 *
 * The check is the controller's own `is_hub` capability rather than a list of hub model names. The capability travels with the hardware's role, so a device type
 * this library has never seen still classifies correctly the day it ships, and a model that gains or loses the role is followed rather than second-guessed.
 *
 * @param device - Any device configuration record (only its capabilities are read).
 *
 * @returns `true` when the device carries the hub capability.
 *
 * @category State
 */
export function isHub(device: AccessStateDevice): boolean {

  return device.capabilities.includes(HUB_CAPABILITY);
}

/**
 * Whether a device acts as a reader - hardware that presents credentials to a door, as opposed to a hub that drives its lock.
 *
 * The check is the controller's own `is_reader` capability rather than a list of reader model names. The capability travels with the hardware's role, so a device
 * type this library has never seen still classifies correctly the day it ships, and a model that gains or loses the role is followed rather than second-guessed.
 * The roles are not exclusive: hardware that drives a door and reads credentials at it answers `true` here and from {@link isHub} alike.
 *
 * @param device - Any device configuration record (only its capabilities are read).
 *
 * @returns `true` when the device carries the reader capability.
 *
 * @category State
 */
export function isReader(device: AccessStateDevice): boolean {

  return device.capabilities.includes(READER_CAPABILITY);
}

/**
 * Whether a device's hardware can detect tampering - a unit that reports being opened, or pulled off the mount it was installed on.
 *
 * The check is the controller's own `tamper_proofing` capability, and both censuses carry it: the topology document lists it among a device's capabilities and so
 * does the official device inventory. That is what sets this apart from {@link tamperState}, which answers only where a census established the configuration rows
 * - a client holding only a token can ask whether the hardware detects tampering at all, even though nothing has told it what the hardware currently reports.
 *
 * @param device - Any device configuration record (only its capabilities are read).
 *
 * @returns `true` when the device carries the tamper capability.
 *
 * @category State
 */
export function isTamperCapable(device: AccessStateDevice): boolean {

  return device.capabilities.includes(TAMPER_CAPABILITY);
}

/**
 * What a device's `tamper_event` configuration row reports: `true` where the controller has that device's tamper condition raised, `false` where it does not, and
 * `undefined` where nothing has established a reading.
 *
 * Tampering is a property of the record rather than of a notification, which is why it is read rather than subscribed to. The controller keeps the condition on the
 * device's own row and revises it there, so a consumer asking what is true right now reads this, while the typed `tamperAlert` activity event announces the incident
 * as it happens. Each answers a different question, and a consumer announcing an alert reads the state separately rather than inferring it from the alert's arrival.
 *
 * The neighboring `tampering` row is the device's tampering-alert setting, and a live capture on a UA Ultra established what that setting does to the reading
 * beside it: the hardware reports no tamper input while it is off. An enclosure trip made with the setting off moved no row and raised no notification, while the
 * same trip made with it on moved the input row and raised the notification. So a record whose setting row is present and reads anything but `true` answers
 * `undefined` here, its input row being a stale reading rather than a quiet one, while a record carrying no setting row gates nothing, because an absent setting
 * is no evidence of gating.
 *
 * The absent answer covers the situations a caller may want to tell apart from a quiet device, and they are deliberately not collapsed into `false`. The record may
 * carry no such row; it may carry no configuration rows at all, which is every record a token-only census produced, so a token client reads `undefined` here by
 * construction while {@link isTamperCapable} still answers; the device's tampering alert may be switched off, which leaves its input row a reading the hardware
 * has stopped revising; or the row may carry a value outside the spellings the controller has been observed to write, which is not guessed at. A caller telling a
 * first observation from a change needs that absence distinct from a reported `false`.
 *
 * The reading is refreshed by the topology census and by the controller's original device-update dialect, whose every captured delivery is a full record carrying
 * the whole row array. The newer dialect carries no configuration rows at all, so a controller emitting only that one refreshes this at the periodic topology
 * re-read alone. And because a topology fetch already in flight when the condition flips lands the reading it was answered with, a flip can read as reverted until
 * the next delivery corrects it - the eventual consistency the reducer accepts for every member a census supplies.
 *
 * @param device - Any device configuration record (only its configuration rows are read).
 *
 * @returns `true` or `false` as the input row reports where the tampering-alert setting is on or absent, and `undefined` where no reading is established.
 *
 * @category State
 */
export function tamperState(device: AccessStateDevice): boolean | undefined {

  const rows = device.configs;
  const alert = rows?.find((entry) => entry.key === TAMPER_ALERT_KEY)?.value;

  // The alert setting gates the reading: while it is off the hardware reports no tamper input, so the input row is stale rather than quiet. A setting row that
  // reads something outside the observed vocabulary is not guessed at either, and an absent setting row gates nothing.
  if((alert !== undefined) && (alert !== "true")) {

    return undefined;
  }

  switch(rows?.find((entry) => entry.key === TAMPER_EVENT_KEY)?.value) {

    case "true":

      return true;

    case "false":

      return false;

    default:

      return undefined;
  }
}

/**
 * What a device reports about one of the terminals on its back: whether the hardware has something in service on it, and what that terminal currently reads.
 *
 * The answer is one of three, and the union's own shape is what keeps them apart. A terminal reporting `wired: true` is in service and carries its reading as
 * `state` wherever one is readable; a terminal reporting `wired: false` is one the hardware says nothing is attached to, and it carries no reading at all, because
 * a floating input's row is a value nothing has qualified; and an empty object is no evidence either way, which is a different statement from reporting nothing
 * wired. **Wired means in service**, which the hardware establishes in one of two ways: a live circuit detected on the terminal's own wiring pair, which is what
 * every model but one reports, or, on a UA Ultra, which detects no circuits at all, the port setting that assigns its one input terminal to a duty.
 *
 * Which terminals a device carries is what the captures establish rather than what a model name implies, so this answers per record. A UA Hub carries all four -
 * its door position sensor, its remote release, its request to enter, and its request to exit. A UA Hub Door Mini and a UA Ultra carry the position sensor and the
 * request to exit of their one door port. A port of an Enterprise Access Hub carries its own two, and the whole hub carries none that can be named without
 * ambiguity: eight ports speak the same terminals, so the hub itself answers with no evidence and its per-port access points answer instead. A reader carries
 * none, and answers nothing for every terminal.
 *
 * The absent answer covers the situations a caller wants to tell apart from a terminal with nothing wired to it, and they are deliberately not collapsed together.
 * The record may carry none of the terminal's keys; it may carry no configuration rows at all, which is every record a token-only census produced, so a token
 * client reads `{}` here by construction for every terminal; the wiring pair may be only half readable, which is no pair; or the hardware may report neither a
 * pair nor a duty, which is a UA Ultra whose port setting has never been established.
 *
 * This is read live on every call, where the door-state entry a door carries is seeded once from the same hardware and then left to the notification stream. So a
 * consumer asking what a terminal reports right now reads this, and one asking what the controller last said about a door reads that.
 *
 * The reading is refreshed by the topology census and by the controller's original device-update dialect, whose every captured delivery is a full record carrying
 * the whole row array and the extensions beside it. The newer dialect carries its terminals under a member the canonical merge excludes, so a controller emitting
 * only that one refreshes this at the periodic topology re-read alone.
 *
 * There is no capability predicate beside this the way {@link isTamperCapable} sits beside {@link tamperState}, because no single capability string marks
 * terminal-bearing hardware across the families - a UA Ultra and a UA Hub carry different ones - so the presence of the keys is the evidence, and it is what this
 * answers on.
 *
 * `on` and `off` are the controller's own vocabulary for what a terminal reads, and the physical sense of a reading is the consumer's to apply: whether a closed
 * contact reads `on` depends on how an installer wired and mounted it, exactly as the door position polarity does.
 *
 * @param device - Any device configuration record (only its configuration rows, its extensions, and its port identity are read).
 * @param input  - Which terminal to read, from {@link ACCESS_TERMINAL_INPUTS}.
 *
 * @returns What the hardware established, with every member whose evidence is absent left out entirely.
 *
 * @category State
 */
export function terminalInput(device: AccessStateDevice, input: AccessTerminalInput): AccessTerminalInputFacts {

  return readTerminalInput(device, input);
}

/**
 * The doors a hub's ports are bound to: one binding per port that names a door, in the order the controller delivered them.
 *
 * A hub records which door each of its ports serves as an extension of its own record, and the protocol tier's `readPortBindings` is where which extensions are port
 * bindings and what one of them says both live. This is that read over the stored record, so a consumer asking which doors a hub drives, the hub handle's own door
 * resolution, and the access-point expansion all answer from one rule rather than parsing the list separately in each place.
 *
 * There are three quite different ways to get an empty list back, and all three are honest. A synthesized per-port access point carries no extensions - the
 * expansion strips them on the way through - so it answers empty, which is what it should: it already is one port, and its door is that record's own location. A
 * record a token-only census produced carries no extensions either, so every record answers empty on that client by construction. And single-door hardware that
 * binds its port through no extension answers empty because there is nothing to answer with, its door likewise being its own location.
 *
 * It is re-evaluated on every call rather than memoized, joining {@link tamperState} and {@link terminalInput} in the per-record group the memo discipline does not
 * cover: the answer is derived from one record a caller already holds rather than being a collection an observer dedups against.
 *
 * What a binding means is the consumer's to decide. Which of a multi-door hub's doors is the one it cares about is policy this library holds no opinion about, and
 * commanding a particular door of such hardware stays the door commands' `doorId` target rather than anything the order of this list implies.
 *
 * @param device - Any device configuration record (only its extensions are read).
 *
 * @returns The bindings in delivered order, one per port that names a door.
 *
 * @category State
 */
export function portBindings(device: AccessStateDevice): readonly AccessPortBinding[] {

  return readPortBindings(device);
}

/**
 * A device's display name: the alias an administrator gave it when there is one, and the controller's own name for the hardware otherwise.
 *
 * The precedence is the controller interface's own - an alias is what a person chose to call this device, so it wins wherever one is set - and an alias set to
 * the empty string counts as unset, which is how clearing an alias in the interface reads on the wire. The rule lives here, at the record, so the projection's
 * own name and a routing refusal naming the device it could not serve read one answer rather than each deriving it.
 *
 * @param device - Any device configuration record (only its alias and name are read).
 *
 * @returns The alias where one is set, and the hardware name otherwise.
 *
 * @category State
 */
export function deviceDisplayName(device: Pick<AccessStateDevice, "alias" | "name">): string {

  return device.alias || device.name;
}

// Devices grouped by their device type, memoized on the devices map.
const devicesByType = memoize<AccessState, ReadonlyMap<string, readonly AccessStateDevice[]>>((state) => [state.devices],
  (state) => groupDevices({ devices: state.devices.values(), keyOf: (device) => device.device_type }));

// The hub subset, memoized on the devices map.
const hubs = memoize<AccessState, readonly AccessStateDevice[]>((state) => [state.devices],
  (state) => [...state.devices.values()].filter((device) => isHub(device)));

// Devices grouped under the door they serve, memoized on the devices map and the doors map, because either one drifting changes the answer.
const doorDevices = memoize<AccessState, ReadonlyMap<string, readonly AccessStateDevice[]>>((state) => [ state.devices, state.doors ],
  (state) => groupDevices({ devices: state.devices.values(), keyOf: (device) => device.location_id, keys: state.doors.keys() }));

/* The Enterprise Access Hub expansion, memoized on the devices map and the topology root, because a hub's extensions arrive on a device record and the building
 * identity the scan matches against lives on the root.
 *
 * One physical Enterprise Access Hub serves several doors through its extensions, one per port, so a consumer looking for "the hardware serving this door" would
 * find nothing at seven of the eight doors an eight-port hub drives. The expansion answers that by presenting each port as a device in its own right: the port's
 * extension supplies the identity, the target door supplies the location and the display name, and the hub supplies everything else about the hardware.
 *
 * Both spreads and both destructures carry weight. The hub's fields go down first and the extension's over them, so the synthesized record's `unique_id` is the
 * port's own rather than the hub's - eight ports yield eight distinct identities rather than eight copies of one. The hub's `extensions` array and the extension's
 * `target_name` and `target_value` are named in the destructures precisely to keep them off the result, so a synthesized access point carries neither the roster of
 * its siblings nor the raw targeting fields the mapping already consumed. And `name` takes the hub's alias while `alias` takes the door's name, which is the swap
 * that makes each port read as "this door, served by that hub".
 *
 * Every port binding of a qualifying hub expands, selected through the same rule the door-identity getter and the published bindings read use, so which extensions are
 * port bindings is stated once rather than restated at each call site. A port extension naming no door still expands, with the fallbacks below, because the port is
 * there whether or not a door is bound to it, and an extension of any other kind is not a port and expands into nothing.
 *
 * The scan is scoped to hubs the building hosts directly, matching the root's own identity, which is where every observed Enterprise Access Hub lives. The source
 * records are never touched: this is a read that builds new objects, so the devices map still holds exactly what the controller sent.
 *
 * The synthesized objects are cached per hub RECORD, one level below the memo. The result array is rebuilt whenever the devices map changes, exactly as every other
 * collection view here behaves, but each hub's ports are rebuilt only when that hub's own record changed - so an unrelated device advancing leaves every port object
 * reference-identical. That is what a consumer holding a per-port handle depends on: the handle reads its port through a by-identity lookup over this expansion, so
 * a fresh object per unrelated dispatch would wake its observer on every packet the controller sends. Reusing the whole array across two different memo keys would
 * be the stronger property and is deliberately not attempted: it would need a remembered slot outside the per-key chain, which two stores in one process would
 * fight over - the cross-store contamination the chain exists to prevent. Keying on the record reference means a hub's chunk is collected with the record itself,
 * so there is no eviction policy here either.
 */
const portChunks = new WeakMap<AccessStateDevice, readonly AccessStateDevice[]>();

const accessPoints = memoize<RootedAccessState, readonly AccessStateDevice[]>((state) => [ state.devices, state.root ], (state) => {

  const expanded: AccessStateDevice[] = [];

  for(const device of state.devices.values()) {

    if(!isEnterpriseHubRecord(device, state)) {

      continue;
    }

    let chunk = portChunks.get(device);

    if(chunk === undefined) {

      chunk = expandPorts(device);
      portChunks.set(device, chunk);
    }

    expanded.push(...chunk);
  }

  return expanded;
});

// Synthesize one access point per port binding of a qualifying hub. Both spreads and both destructures carry the weight described above; this is the per-hub half
// of the expansion, split out so its result can be cached against the record it was built from.
function expandPorts(device: AccessStateDevice): readonly AccessStateDevice[] {

  const { extensions: _extensions, alias, display_model: displayModel, location_id: locationId, ...hub } = device;
  const ports: AccessStateDevice[] = [];

  for(const extension of portExtensionsOf(device)) {

    const { target_name: targetName, target_value: targetValue, ...port } = extension;

    /* The extension fields carry fallbacks because target_name and target_value can be absent on the wire. The model label is different: the record type states only
     * that a census may or may not have established it, so the port carries it exactly when the hub does rather than composing a label around a value that was
     * never read.
     */
    ports.push({ ...hub, ...port, "alias": targetName ?? "Unknown",
      ...((displayModel !== undefined) && { "display_model": displayModel + ((port.source_id !== undefined) ? " " + titleCase(port.source_id) : "") }),
      "location_id": targetValue ?? locationId, "name": alias });
  }

  return ports;
}

/**
 * Every device grouped by its `device_type`. The type is an open string the controller chooses, so the map holds exactly the types the hardware in front of you
 * reports, in the order the devices map holds them - a type this library has never heard of gets its own bucket rather than being dropped.
 *
 * @param state - The current state.
 *
 * @returns A map from device type to the devices reporting it.
 *
 * @category State
 */
export function selectDevicesByType(state: AccessState): ReadonlyMap<string, readonly AccessStateDevice[]> {

  return devicesByType(state);
}

/**
 * Every device that acts as a hub, in the order the devices map holds them. A device qualifies by carrying the controller's own `is_hub` capability, so a hub-capable
 * device type this library has never seen still classifies correctly.
 *
 * @param state - The current state.
 *
 * @returns The hub devices.
 *
 * @category State
 */
export function selectHubs(state: AccessState): readonly AccessStateDevice[] {

  return hubs(state);
}

/**
 * The hardware attached to each door, keyed by door identity. Every door in the state is present, so a door with no hardware maps to an empty array rather than
 * being absent - a consumer iterating doors never has to distinguish "no hardware" from "unknown door".
 *
 * Hardware the building hosts directly, rather than through one of its doors, belongs to no door and appears in no entry here. It is still reachable through the
 * device views, and an Enterprise Access Hub hosted that way reaches its doors through {@link selectAccessPoints}.
 *
 * A client with no topology holds the doors its own census named, so this view answers there too - every door the official listing carried, keyed the same way.
 *
 * @param state - The current state.
 *
 * @returns A map from door identity to the devices serving that door.
 *
 * @category State
 */
export function selectDoorDevices(state: AccessState): ReadonlyMap<string, readonly AccessStateDevice[]> {

  return doorDevices(state);
}

/**
 * The logical access points: one entry per door-serving port of every Enterprise Access Hub, presented as a device in its own right so that a consumer sees one
 * piece of hardware per door rather than one hub standing in for eight of them.
 *
 * Each synthesized record takes its identity from the port's extension, its `location_id` from the door that port targets, its `alias` from that door's name, and
 * its `name` from the hub's alias, with every remaining hardware field coming from the hub itself. The controller's own records are left untouched: this is a
 * derived view, not a rewrite of state.
 *
 * The result is empty before a topology document has been applied, and empty on a controller with no Enterprise Access Hub.
 *
 * @param state - The current state.
 *
 * @returns The synthesized access-point devices.
 *
 * @category State
 */
export function selectAccessPoints(state: AccessState): readonly AccessStateDevice[] {

  if(!isRooted(state)) {

    return NO_ACCESS_POINTS;
  }

  return accessPoints(state);
}

/**
 * The live state of every door the reducer holds one for, keyed by door identity. A door with no derivable state is absent rather than present-and-empty, because
 * there is no such thing as a default door state: the entry means "this is what the door last said, or what its hardware flags imply", and its absence means
 * neither source has produced one. The reducer seeds an entry for every door whose topology record carries enough hardware flags to derive one, so a freshly
 * connected client already sees those doors before any of them reports.
 *
 * No memo level sits over this one. The map is the reducer's own product rather than something derived from it, so its reference is already stable across every
 * dispatch that did not change a door's state, which is exactly the property a memo would be added to supply.
 *
 * @param state - The current state.
 *
 * @returns A map from door identity to that door's last reported state.
 *
 * @category State
 */
export function selectDoorStates(state: AccessState): ReadonlyMap<string, AccessDoorStateEntry> {

  return state.doorStates;
}

/**
 * The controller's own information document, or `null` before one has been fetched. Read through a selector rather than off the state directly so that every
 * consumer of the controller record - including the client's own convenience getter - reaches it the one way.
 *
 * @param state - The current state.
 *
 * @returns The controller document, or `null`.
 *
 * @category State
 */
export function selectController(state: AccessState): Nullable<AccessControllerConfig> {

  return state.controller;
}

/**
 * The controller's display name, or `null` before its information document has been fetched. This is the host's own hostname - the name an administrator gave the
 * console, and the one that matches what the controller's interface shows - rather than the hardware shortname beside it, which names the model.
 *
 * @param state - The current state.
 *
 * @returns The controller's display name, or `null`.
 *
 * @category State
 */
export function selectControllerName(state: AccessState): Nullable<string> {

  return state.controller?.host.hostname ?? null;
}

/**
 * The controller host's uptime in seconds, or `null` before its information document has been fetched.
 *
 * The value is what the controller serves rather than a measurement this library takes. Across a long horizon it advances with elapsed time, and a restart returns
 * it to near zero; across a short one the controller can serve the identical value twice, so it is not a monotonic clock and a consumer should not read a flat
 * value as a stalled controller. No memo level is needed because the value is a number: an observer
 * comparing it by identity is comparing the number itself, so a re-served identical reading wakes nobody.
 *
 * @param state - The current state.
 *
 * @returns The host's uptime in seconds, or `null`.
 *
 * @category State
 */
export function selectControllerUptime(state: AccessState): Nullable<number> {

  return state.controller?.host.uptime ?? null;
}

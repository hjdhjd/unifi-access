/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * reducer.ts: The pure state reducer at the heart of the architecture.
 */

/**
 * The pure reducer that models a UniFi Access controller's state as a fold over a typed event stream.
 *
 * {@link reduce} is `(state, event) -> state`, where the event is an {@link AccessTypedEvent} from the classifier and the state is an immutable
 * {@link AccessState}. A census of the controller is not something the library fetches and holds off to one side: it is the initial state the reducer starts from,
 * through a synthetic event - the topology document via `bootstrapLoaded` where a client holds credentials, the official API's own listings via `censusApplied`
 * where it holds only a token - and every later notification advances that same state. Periodic re-reading is a permanent failsafe against a controller's
 * occasionally lossy event delivery, reconciled here so a refresh that finds no drift produces no observable change at all.
 *
 * Three guarantees make the observation layer above this cheap and correct:
 *
 * - **Immutability.** No function here mutates its input. Every step returns either the same reference, meaning nothing changed, or a new one.
 * - **Structural sharing.** A change rebuilds only the path from the root to the changed node; every untouched device, map, and nested object keeps its existing
 *   reference, which is what makes `Object.is` change detection in selectors and observers both correct and nearly free.
 * - **No-op fidelity.** A merge, removal, or full re-bootstrap that changes nothing by *value* returns the same reference by *identity*. This is the property that
 *   makes the periodic refresh invisible when nothing drifted.
 *
 * @module AccessReducer
 */
import type { AccessBootstrapConfig, AccessControllerConfig, AccessDeviceConfig, AccessDeviceEntryConfig, AccessDoorConfig, AccessDoorStateEntry,
  AccessFloorConfig, AccessKnownJsonValue, Nullable, OmitMembers } from "../types/index.ts";
import type { AccessTypedEvent } from "./events.ts";
import { assertNever } from "../errors.ts";
import { deriveDoorState } from "./door-state.ts";
import { isDeepStrictEqual } from "node:util";
import { isRecord } from "../json.ts";
import { normalizeMacAddress } from "./vocabulary.ts";

/* The records as they are stored, shaped by two principles.
 *
 * PRUNING: a record never embeds a collection another map owns. The wire nests the topology - the root holds floors, floors hold doors, and doors hold the hardware
 * attached to them - so storing those records as they arrive would put every door inside its floor and every device inside its door, the same record would exist in
 * two places, and a merge into one copy would leave the other stale. Flattening into maps and pruning the nested collection at each level means each record has
 * exactly one home. The principle is what governs here rather than the enumeration, which is why the root drops its own device group as well as its floors.
 *
 * CENSUS WIDTH: a record type carries as required only what every census that feeds its map can establish, and everything else as optional. The controller is
 * censused two ways - the topology document a credential client reads, and the official API's listings a token-only client reads - and they carry different
 * amounts. Requiring a member only one of them supplies would force the other's projection to invent a value or to lie in its type, so the type states the
 * intersection and a consumer reads an absent member as not established by that census rather than as a value. A topology record satisfies these types unchanged,
 * which is what lets one record shape serve both censuses through the same selectors and projections.
 */

/**
 * A door as stored: the record both censuses of the controller's doors can fill, without the device group the devices map owns.
 *
 * The topology document carries the whole location record; the official API's door listing carries the door's identity, its names, the floor above it, and its
 * kind. The members both establish are required. The rest are optional, so a record states what its census said and a consumer reads an absent member as not
 * established by that census rather than as a value. A topology door satisfies this type unchanged once its device group is pruned.
 *
 * @category Reducer
 */
export type AccessStateDoor = Pick<AccessDoorConfig, "full_name" | "location_type" | "name" | "unique_id" | "up_id"> &
  Partial<OmitMembers<AccessDoorConfig, "device_groups">>;

/** A floor as stored: the wire's floor record without the doors the doors map owns. The topology document is the only census that lists floors. */
export type AccessStateFloor = OmitMembers<AccessFloorConfig, "doors">;

/** The topology root as stored: the wire's root record without the floors and the root-level device group that the other maps own. */
export type AccessStateRoot = OmitMembers<AccessBootstrapConfig, "device_groups" | "floors">;

/**
 * A device as stored: the record both censuses of the controller's hardware can fill.
 *
 * The topology document, which a client with credentials seeds from, carries the whole wire record. The official API's device inventory, which a client with only
 * a token seeds from, carries the hardware's identity, its names, its role capabilities, its enrollment flags, and the door it serves - no addresses beyond the one
 * its identifier restores, no firmware, no configuration rows, no port extensions. The members both censuses establish are required; the rest are optional, so a
 * record carries what its census said and a consumer reads an absent member as not established by that census rather than as an invented value. A topology record
 * satisfies this type unchanged, which is what lets the selectors and projections serve both censuses through one record shape.
 *
 * `mac`, where a census established it, is spelled one way - uppercase, without separators, the spelling the companion UniFi Protect controller carries - whichever
 * way the wire spelled it, so a consumer keyed on the address is never re-keyed by the controller casing it differently from one read to the next.
 *
 * @category Reducer
 */
export type AccessStateDevice = Pick<AccessDeviceConfig, "alias" | "capabilities" | "connected_uah_id" | "device_type" | "is_adopted" | "is_connected" |
  "is_managed" | "is_online" | "location_id" | "name" | "unique_id"> & Partial<AccessDeviceConfig>;

/**
 * The immutable snapshot of a controller's modeled state. Devices, doors, and floors are normalized into `unique_id -> record` maps for direct lookup, and the
 * topology root is the single record above them, with the controller's own information document and the live door states held beside them.
 *
 * The topology root and the controller document are separate members because their reconciliation disciplines differ. The root is reference-stable across a refresh
 * that found no drift, which is the guarantee the observation layer rests on; the controller document carries the host's uptime, so it is expected to advance on
 * every genuine fetch. Folding the second into the first would make every refresh look like drift.
 *
 * `doorStates` is keyed by door identity rather than by the device that reported it, because a multi-door hub reports several doors and a door can be reported by
 * more than one carrier. It is the one collection here fed by more than one kind of source, so its lifecycle is enumerated in full on the reducer's door-state arm.
 *
 * A device record is stored as its census delivered it, and the two censuses deliver different amounts. A topology record is stored exactly as the controller sent
 * it, which means it still carries the `door`, `floor`, and `location` members the wire embeds in it; a record projected from the official API's device inventory
 * embeds no location snapshots at all, because that listing carries none. Where those members are present, keeping them is deliberate: the maps are the working
 * truth either way, and the embedded members are a snapshot of what the location records looked like when that device record was issued. They go stale between
 * events, and a consumer that wants a door's current state reads the doors map rather than a device's copy of it. Pruning them would be the alternative, but it
 * would discard wire material a consumer may legitimately want, and unlike the collections above they are not a second home for a record this state also stores
 * under its own identity. Where records are admitted, each admission rule turns a guarantee the wire does not make into one the state does: a record arriving
 * without a `capabilities` array is stored carrying an empty one, so the required member the device type declares is true of every record here; and a record's own
 * `mac`, like the controller document's `host.mac`, is stored in one spelling whichever way the wire spelled it, because the controller cases an address differently
 * from record to record and from one read to the next, and a consumer keyed on an address must never be re-keyed by that. The spelling rule reaches a record's own
 * member and nothing nested inside it: the camera records some hardware embeds are the companion UniFi Protect controller's own material, which this library
 * deliberately does not model, and they keep their addresses as the wire sent them.
 *
 * There is deliberately no counter or timestamp here. A pure reducer cannot write a wall-clock field without minting a new state reference on every packet, which
 * would destroy the no-op and structural-sharing guarantees the observation layer depends on.
 *
 * @category Reducer
 */
export type AccessState = Readonly<{

  controller: Nullable<AccessControllerConfig>;
  devices: ReadonlyMap<string, AccessStateDevice>;
  doorStates: ReadonlyMap<string, AccessDoorStateEntry>;
  doors: ReadonlyMap<string, AccessStateDoor>;
  floors: ReadonlyMap<string, AccessStateFloor>;
  root: Nullable<AccessStateRoot>;
}>;

/**
 * Build the empty starting state. The reducer begins here and advances through `bootstrapLoaded`.
 *
 * This is a factory rather than a shared constant because the state holds `Map` instances: a single exported constant would hand every client the same map objects,
 * so two clients composed in one process would begin life aliased to each other.
 *
 * @returns A new, empty {@link AccessState}.
 *
 * @category Reducer
 */
export function createInitialState(): AccessState {

  return { controller: null, devices: new Map(), doorStates: new Map(), doors: new Map(), floors: new Map(), root: null };
}

/**
 * Advance the state by one typed event. Pure: returns a new state when the event changes something, or the *same reference* when it does not.
 *
 * State transitions advance the model: `bootstrapLoaded` reconciles against a freshly fetched topology, `censusApplied` folds the official API's listings into the
 * devices, the doors, and their state together, `controllerChanged` stores a freshly fetched controller document, `deviceChanged` merges a partial into a device,
 * `deviceRemoved` deletes one, `locationChanged` merges a partial into whichever location record it names, and `doorStateChanged` folds the doors a packet reported
 * while merging that packet's own carrier facet. Activity signals - `doorbellRing`, `doorbellCancel`, and `unlock` - are occurrences rather than conditions, so
 * they reach consumers through the event rails and the reducer returns the state unchanged for them.
 *
 * @param state - The current state.
 * @param event - The typed event to apply.
 *
 * @returns The next state, identical by reference to `state` when nothing changed.
 *
 * @throws {@link AccessProtocolError} only if an unrecognized event kind reaches the reducer - a defect the exhaustiveness guard converts from a silent
 *   fall-through into a loud failure.
 *
 * @category Reducer
 */
export function reduce(state: AccessState, event: AccessTypedEvent): AccessState {

  switch(event.kind) {

    case "bootstrapLoaded":

      return applyBootstrap(state, event.data);

    case "censusApplied":

      return applyCensus(state, event);

    case "controllerChanged":

      return applyControllerChange(state, event.data);

    case "deviceChanged":

      return applyDeviceChange(state, event.id, event.payload);

    case "deviceRemoved":

      return removeDevice(state, event.id);

    case "doorStateChanged":

      return applyDoorStateChange(state, event);

    case "doorStateFactsApplied":

      return applyDoorStateFacts(state, event.entries, event.complete);

    case "locationChanged":

      return applyLocationChange(state, event.id, event.payload);

    // Activity signals are occurrences, not conditions. They reach consumers through the event rails; the reducer returns the current reference so no observer is
    // woken by something that changed no state.
    case "doorbellCancel":
    case "doorbellRing":
    case "unlock":

      return state;

    default:

      // Exhaustiveness guard. If a new event kind joins the union without a case above, `event` stops being `never` here and this fails to compile, turning a
      // silent fall-through into a build error. At runtime, reachable only from untyped code, it throws rather than quietly ignoring the event.
      return assertNever(event);
  }
}

/**
 * Atomically reconcile the state against a freshly fetched topology document. The wire's nesting is flattened into the state's maps here: floors come off the root,
 * doors off their floors, and devices off every door-level and root-level device group, unwrapping the double nesting the controller wraps hardware in.
 *
 * Each record is matched against the current state by identity: one that is unchanged by value keeps its existing reference, so selectors and observers see no
 * change; one that differs takes the new reference; and one absent from the document is dropped. A map with no net change keeps its own reference, and a document
 * that drifted nowhere returns the state object itself.
 *
 * The document is authoritative where it disagrees. On any per-record difference the fetched record replaces the stored one wholesale rather than being merged into
 * it, which means a field a live notification advanced after the document was fetched but before it was applied reverts to the document's value until the next
 * notification or refresh advances it again. That is eventual consistency by design: the alternative, merging a snapshot into live state, would make the result
 * depend on arrival order and could never converge. The client keeps the window small by dispatching the document before it attaches the event stream.
 *
 * @param state     - The current state.
 * @param bootstrap - The freshly fetched topology document.
 *
 * @returns The reconciled state, identical by reference to `state` when nothing drifted.
 *
 * @category Reducer
 */
export function applyBootstrap(state: AccessState, bootstrap: AccessBootstrapConfig): AccessState {

  const nextDevices: AccessDeviceConfig[] = [];
  const nextDoors: AccessStateDoor[] = [];
  const nextFloors: AccessStateFloor[] = [];
  // Which hardware serves which door, kept only for the seed below. The flattened devices map loses this, because it is keyed by device and a device's own record
  // carries the door it was attached to when that record was issued rather than the current binding.
  const servingDevices = new Map<string, AccessDeviceConfig[]>();

  // Hardware the building hosts directly, rather than through one of its doors. It serves no door in the document's own structure, which is what leaves the doors it
  // drives with nothing for the seed to read - their association is synthesized a tier above this one.
  flattenDeviceGroups(bootstrap.device_groups, nextDevices);

  for(const floor of (bootstrap.floors ?? [])) {

    const { doors, ...storedFloor } = floor;

    nextFloors.push(storedFloor);

    for(const door of doors) {

      const { device_groups: doorDeviceGroups, ...storedDoor } = door;
      const doorDevices: AccessDeviceConfig[] = [];

      nextDoors.push(storedDoor);
      flattenDeviceGroups(doorDeviceGroups, doorDevices);
      servingDevices.set(storedDoor.unique_id, doorDevices);

      for(const device of doorDevices) {

        nextDevices.push(device);
      }
    }
  }

  /* The pruning itself. Naming the two collections in the destructure is what excludes them from the rest, so the bindings exist to be discarded rather than read;
   * the underscore prefix says so. Building the stored record this way keeps it assignable to the pruned type with no cast.
   */
  const { device_groups: _rootDeviceGroups, floors: _rootFloors, ...storedRoot } = bootstrap;
  const devices = reconcileMap(state.devices, nextDevices);
  const doors = reconcileMap(state.doors, nextDoors);
  const nextRoot = ((state.root !== null) && isDeepStrictEqual(state.root, storedRoot)) ? state.root : storedRoot;
  const reconciledFloors = reconcileMap(state.floors, nextFloors);
  const doorStates = seedDoorStates(pruneAbsent(state.doorStates, doors), doors, servingDevices);

  // Whole-state reference reuse. When every collection and the root each kept their prior reference, nothing drifted anywhere, so we hand back the state object
  // itself and a consumer comparing states by identity sees the refresh as the no-op it was.
  if(Object.is(devices, state.devices) && Object.is(doors, state.doors) && Object.is(reconciledFloors, state.floors) && Object.is(nextRoot, state.root) &&
    Object.is(doorStates, state.doorStates)) {

    return state;
  }

  return { ...state, devices, doorStates, doors, floors: reconciledFloors, root: nextRoot };
}

/* Store a freshly fetched controller-information document, keeping the held reference when the fetch reported nothing new.
 *
 * The host's address takes the library's spelling before anything else reads the document, because the controller cases it differently from one read to the next
 * and a consumer keys its own records on it. Folding first is what lets the compare below see a re-served document that differs only in that spelling as the no-op
 * it is. The document is rebuilt around the folded host on every fetch: the fetch already parsed a fresh document, so one shallow copy beside it costs nothing that
 * matters at refresh cadence, and a copy made unconditionally is one branch fewer to reason about.
 *
 * The comparison is structural rather than by reference because every fetch parses a fresh document, so identity would report drift on every refresh. In practice
 * the document usually does differ, because it carries the host's uptime and uptime is what advancing time looks like on this wire - that is the member's purpose,
 * not noise to be filtered. The compare earns its place on the other case: a controller that re-serves a byte-identical document, which the live wire does, then
 * wakes nobody.
 */
function applyControllerChange(state: AccessState, controller: AccessControllerConfig): AccessState {

  const document = { ...controller, host: withCanonicalMac(controller.host) };

  if((state.controller !== null) && isDeepStrictEqual(state.controller, document)) {

    return state;
  }

  return { ...state, controller: document };
}

/* Merge a partial into an existing device. A notification for an unknown device is a no-op: membership comes from a census - the topology document, or the official
 * listings on a client with no topology - and a partial has no full record to merge onto. The controller's camera-class hardware exercises exactly this path,
 * appearing in notifications while being absent from every census; the periodic re-read is what reconciles any genuine drift.
 *
 * The payload's address, when it carries one, takes the library's spelling before the merge rather than after it. The merge decides by value whether anything
 * changed, so a payload restating the stored address in the other case would otherwise read as a change: the merge would clone the stored record to hold the
 * re-cased address, and the upsert below would then pay a structural compare of the whole record to find that nothing moved. Folding first costs one string
 * comparison and, on a re-cased payload, one copy of the payload itself; the stored record is never cloned for a spelling.
 */
function applyDeviceChange(state: AccessState, id: string, payload: Record<string, AccessKnownJsonValue>): AccessState {

  const existing = state.devices.get(id);

  if(existing === undefined) {

    return state;
  }

  const devices = upsertEntry(state.devices, id, mergeDeviceRecord(existing, withCanonicalMac(payload)));

  return Object.is(devices, state.devices) ? state : { ...state, devices };
}

/* Fold a door-state packet: the doors it reported, plus the facet its own carrier contributed.
 *
 * The entries REPLACE rather than merge. The wire sends a complete entry every time - the corpus shows one door alternating between carrying and omitting its
 * alarms - so an omitted optional member means the condition cleared, and only replacement reports that. Merging would leave a cleared alarm standing forever.
 *
 * The facet takes the exact path its standalone kind takes, so there is one merge implementation per collection reached by two event kinds rather than two that can
 * drift. The door state and the facet are independent: either can change while the other does not, and the state reference advances when either did.
 *
 * THE LIFECYCLE, in full, because this collection is fed from more than one kind of source. An entry is born one of three ways: from a door-state event; from the
 * connect-time seed {@link applyBootstrap} derives from the serving hardware's own flags; and from the facts an official read supplies. The two seeds are
 * subordinate to the wire in different ways - the topology seed fills only doors that have never reported at all, and the official merge writes member by member
 * over whatever is held - so neither can overwrite a live reading with an interpretation. An entry updates on later door-state events naming its door.
 *
 * It dies one of two ways, both of them a census of the controller's doors that no longer names it: a fresh topology document, and an official read that enumerated
 * every door it knows of. Neither a device removal nor a partial official read removes anything - losing the hub that reported a door is not the door leaving the
 * controller, and a source that spoke about some doors has said nothing about the others.
 *
 * A reconnect therefore retains whatever each surviving door last reported. That is eventual consistency with a partial reconciliation source: the topology document
 * carries the hardware flags the seed reads but no door state of its own, so a door that has reported once is restated by nothing until it reports again.
 * `dps_connected` and `is_unavailable` are the wire's own statements about whether an entry means anything, both checked at admission, and both readable by a
 * consumer that wants to know how much to trust a reading.
 */
function applyDoorStateChange(state: AccessState, event: Extract<AccessTypedEvent, { kind: "doorStateChanged" }>): AccessState {

  let doorStates = state.doorStates;

  for(const entry of event.states) {

    doorStates = upsertEntry(doorStates, entry.location_id, entry);
  }

  const next = (event.device !== undefined) ? applyDeviceChange(state, event.device.id, event.device.payload) :
    applyLocationChange(state, event.location.id, event.location.payload);

  return Object.is(doorStates, state.doorStates) ? next : { ...next, doorStates };
}

/* Fold a source that answers only part of what a record can carry onto one collection: supplied members win, held members survive, a record the collection does not
 * hold is admitted whole, and a complete, non-empty enumeration drops what it no longer names. One definition for the door states, the devices, and the doors, so
 * three collections cannot drift apart on the merge, the admission, or the removal license - each supplies only how its records are keyed and how a held record
 * takes a supplied one (the door-state entry is a fresh object off the wire every time and merges by spread; the device and door records are wire records and merge
 * through the same null-skipping deep merge a notification takes).
 *
 * An enumeration of no records removes nothing at all: a controller that answers an empty list while degraded is a real hazard, where a site that genuinely lost
 * its last record is the degenerate case, so the asymmetry favours keeping state that a later non-empty read will reconcile.
 *
 * Reference stability is the same discipline as everywhere else here: identical merged values mint no new entry and no new map, so re-applying facts that changed
 * nothing wakes no observer.
 */
function reconcileFacts<T>(existing: ReadonlyMap<string, T>, records: readonly T[],
  options: { complete: boolean; keyOf: (record: T) => string; merge: (held: T, supplied: T) => T }): ReadonlyMap<string, T> {

  let next = existing;

  for(const record of records) {

    const key = options.keyOf(record);
    const held = next.get(key);

    next = upsertEntry(next, key, (held === undefined) ? record : options.merge(held, record));
  }

  return (options.complete && (records.length > 0)) ? pruneAbsent(next, new Map(records.map((record) => [ options.keyOf(record), record ]))) : next;
}

/* Fold facts about doors from a source that answers only part of what a door-state report carries.
 *
 * This MERGES member by member where the door-state arm above replaces wholesale, and the difference is a difference in what each source is saying. A carrier
 * reporting door state sends a complete record, so an omitted member means the condition cleared and only replacement reports that. A source of facts answers what
 * it knows and is silent about the rest, so an omitted member means it was not asked - and merging is what keeps that silence from erasing something another source
 * established.
 *
 * The removal arm exists because a client with no topology has no other way to learn that a door is gone: the bootstrap prune is the only other deletion path, and
 * it needs a topology document to run. A source that enumerates every door it knows of therefore gets to say a door is gone by not naming it.
 */
function applyDoorStateFacts(state: AccessState, entries: readonly AccessDoorStateEntry[], complete: boolean): AccessState {

  const doorStates = reconcileFacts(state.doorStates, entries,
    { complete, keyOf: (entry) => entry.location_id, merge: (held, entry) => ({ ...held, ...entry }) });

  return Object.is(doorStates, state.doorStates) ? state : { ...state, doorStates };
}

/* Fold the official API's listings into the state, for a client whose only census of the controller's hardware and doors those listings are.
 *
 * The three collections land in one step so that a hub and the door it drives appear together, exactly as the topology document lands them: an observer of the hubs
 * never wakes to find the door state it reads still absent. Each collection takes the shared reconciliation, because the listing is a source of facts in the
 * door-facts sense - it answers a fixed subset of what a record can carry. That cuts both ways, on the same eventual-consistency terms the topology document
 * accepts: a member the listing is silent about survives - the firmware a notification established stays - and a member it does supply wins, so a listing read that
 * began before a notification and settled after it restates the listing's value until the next notification advances it again. The client keeps that window small
 * by reading on a schedule the stream otherwise owns.
 *
 * Removal carries the topology document's own authority, per collection: a complete listing that no longer names a device or a door says it is gone, and a listing
 * that names nothing says nothing. A listing that is partial without being empty prunes what it omits, exactly as a partial topology document would; that is the
 * price of having a census at all, and it is the same price the credential path pays.
 */
function applyCensus(state: AccessState, event: Extract<AccessTypedEvent, { kind: "censusApplied" }>): AccessState {

  const byIdentity = { complete: event.complete, keyOf: (record: { unique_id: string }): string => record.unique_id };
  const withDoorStates = applyDoorStateFacts(state, event.doorStates, event.complete);
  const devices = reconcileFacts(withDoorStates.devices, event.devices, { ...byIdentity, merge: mergeDeviceRecord });
  const doors = reconcileFacts(withDoorStates.doors, event.doors, { ...byIdentity, merge: mergeRecord });

  if(Object.is(devices, withDoorStates.devices) && Object.is(doors, withDoorStates.doors)) {

    return withDoorStates;
  }

  return { ...withDoorStates, devices, doors };
}

// Delete a device by identity. A removal naming a device we do not hold is a no-op. Door state is deliberately untouched: losing the hub that reported a door is
// not the door leaving the controller, so its last reported state stands until a census of the controller's doors - a fresh topology document, or an enumerating
// read from the official API - no longer carries the door itself.
function removeDevice(state: AccessState, id: string): AccessState {

  if(!state.devices.has(id)) {

    return state;
  }

  const devices = new Map(state.devices);

  devices.delete(id);

  return { ...state, devices };
}

/* Merge a partial into whichever location record it names, trying doors, then floors, then the root. The controller reuses one record shape for every kind of place,
 * and the notification names its subject by identity alone, so the routing is a lookup rather than a branch on the payload.
 *
 * The root is a merge target like the others. That is safe precisely because it is pruned: a stored root holds no floors and no device group, so merging into it
 * cannot make a stale second copy of a record another map owns. A notification naming none of the three leaves the state untouched.
 */
function applyLocationChange(state: AccessState, id: string, payload: Record<string, AccessKnownJsonValue>): AccessState {

  const door = state.doors.get(id);

  if(door !== undefined) {

    const doors = upsertEntry(state.doors, id, mergeRecord(door, payload));

    return Object.is(doors, state.doors) ? state : { ...state, doors };
  }

  const floor = state.floors.get(id);

  if(floor !== undefined) {

    const floors = upsertEntry(state.floors, id, mergeRecord(floor, payload));

    return Object.is(floors, state.floors) ? state : { ...state, floors };
  }

  if((state.root !== null) && (state.root.unique_id === id)) {

    const merged = mergeRecord(state.root, payload);

    return Object.is(merged, state.root) ? state : { ...state, root: merged };
  }

  return state;
}

/**
 * Whether a record carries its `capabilities` as the array the device type declares. The one statement of the rule every admission boundary applies: field evidence
 * shows a controller can deliver a record without the member, and a record admitted to state must carry it, so each boundary asks this and fills an empty array
 * where the answer is no.
 *
 * @param record - Any record that may carry a `capabilities` member.
 *
 * @returns `true` when the member is present as an array.
 *
 * @internal
 */
export function carriesCapabilities(record: { capabilities?: unknown }): boolean {

  return Array.isArray(record.capabilities);
}

/* Give a record's own hardware address the library's spelling, handing back the very same record when it already has it. Generic over the record rather than typed
 * to the device, because the same rule applies to a wire payload before it is merged and to the controller document's host beside the device records, and one
 * statement of it is what keeps those admissions from drifting apart. A record whose `mac` is not a string is handed back untouched: the merge's own null rule
 * decides what an explicit null means, and this has no business pre-empting it.
 */
function withCanonicalMac<T extends { mac?: unknown }>(record: T): T {

  if(typeof record.mac !== "string") {

    return record;
  }

  const mac = normalizeMacAddress(record.mac);

  return (mac === record.mac) ? record : { ...record, mac };
}

// Flatten the double nesting the controller wraps hardware in. The wire groups devices in an outer array of inner arrays, where the outer level is the controller's
// own grouping and is empty when a location has no hardware at all. This loop is the single path a TOPOLOGY record takes into state.
function flattenDeviceGroups(groups: AccessDeviceConfig[][] | undefined, into: AccessDeviceConfig[]): void {

  for(const group of (groups ?? [])) {

    for(const device of group) {

      /* This is where a declaration becomes a guarantee for a topology record, because this loop is the single path such a record takes into state. The declared
       * device type requires a capabilities array, and the push asks the one capabilities rule the official projection also asks at its own boundary, so every
       * downstream reader of the member stays total - the hub classification above all. The address takes the library's spelling on the same terms: one rule,
       * applied at every boundary a record crosses.
       */
      into.push(withCanonicalMac(carriesCapabilities(device) ? device : { ...device, "capabilities": [] }));
    }
  }
}

/* Place one caller-computed value under its key, and hand back the map itself when that changed nothing. This is the per-key upsert mechanics every collection here
 * shares - the equality test, the copy-on-write, and the reference discipline - defined once so four callers cannot drift apart on any of the three. What each
 * caller keeps is its own: how the next value is computed, and whether an absent key is a no-op or an insertion.
 *
 * The equality test is two-stage because the callers arrive with different guarantees. A merge hands back the stored record itself when the patch changed nothing,
 * so the identity check settles it outright and costs one comparison. A door-state entry is a fresh object off the wire every time, so identity can never settle
 * it and the structural compare is what keeps a re-reported, unchanged door from waking observers. The trade is that a merge that genuinely changed something pays
 * one structural compare that is guaranteed to disagree; that runs at notification cadence over a single record, which is worth one definition of these mechanics
 * rather than four.
 */
function upsertEntry<T>(map: ReadonlyMap<string, T>, key: string, next: T): ReadonlyMap<string, T> {

  const existing = map.get(key);

  if((existing !== undefined) && (Object.is(existing, next) || isDeepStrictEqual(existing, next))) {

    return map;
  }

  const updated = new Map(map);

  updated.set(key, next);

  return updated;
}

/* Drop the entries whose keys a census no longer carries. Surviving entries keep their references by construction, because this only ever removes, and the map
 * itself is handed back untouched when nothing was removed - which is the ordinary case on every refresh, so the failsafe stays invisible to an observer exactly as
 * it is to an observer of any other collection. Comparing sizes is a complete test here for the same reason: an entry can only leave, so an unchanged count means
 * an unchanged map.
 *
 * The census is typed by what this reads of it rather than by what its callers happen to hold. Only membership is consulted, so the value type is unconstrained and
 * every census satisfies it: the topology document's own doors, and the device and door records an enumerating official read answered with.
 */
function pruneAbsent<T>(existing: ReadonlyMap<string, T>, census: ReadonlyMap<string, unknown>): ReadonlyMap<string, T> {

  const next = new Map<string, T>();

  for(const [ id, entry ] of existing) {

    if(census.has(id)) {

      next.set(id, entry);
    }
  }

  return (next.size === existing.size) ? existing : next;
}

/* Fill in door state for the doors that have never reported any, from what their serving hardware's own flags establish.
 *
 * The seed is deliberately subordinate to the wire. A door that has already reported is skipped outright, so a live reading is never overwritten by an
 * interpretation of hardware flags, and the derivation's job is only to give a door that has said nothing yet something honest to show. That is what makes running
 * this on every refresh harmless as well as useful: once a door has reported, this never touches it again.
 *
 * A door whose hardware establishes nothing readable gets no entry at all rather than an empty one, because an entry that states nothing is indistinguishable from
 * a door that reported nothing while claiming to be a report. Reference stability follows the same discipline as every other collection here: the map is copied on
 * the first genuine addition and handed back untouched when there was none, which is the ordinary case on every refresh after the first.
 */
function seedDoorStates(existing: ReadonlyMap<string, AccessDoorStateEntry>, doors: ReadonlyMap<string, AccessStateDoor>,
  servingDevices: ReadonlyMap<string, AccessDeviceConfig[]>): ReadonlyMap<string, AccessDoorStateEntry> {

  let next: Map<string, AccessDoorStateEntry> | null = null;

  for(const [ id, door ] of doors) {

    if(existing.has(id)) {

      continue;
    }

    const facts = deriveDoorState(door, servingDevices.get(id) ?? []);

    if(Object.keys(facts).length === 0) {

      continue;
    }

    next ??= new Map(existing);
    next.set(id, { "location_id": id, ...facts });
  }

  return next ?? existing;
}

// Reconcile one map against the collection a fresh document carries. Reuses an existing record's reference when it is equal by value to its counterpart, and returns
// the existing map outright when nothing in it changed, so a drift-free refresh notifies no observer. Generic over the record type so each map keeps its precise
// typing with no widening.
function reconcileMap<T extends { unique_id: string }>(existing: ReadonlyMap<string, T>, records: readonly T[]): ReadonlyMap<string, T> {

  // A size mismatch means something was added or removed, which is necessarily a change. Seeding from it catches the same-size-different-membership case, which the
  // per-record checks below then confirm.
  let changed = records.length !== existing.size;
  const next = new Map<string, T>();

  for(const record of records) {

    const prior = existing.get(record.unique_id);

    if((prior !== undefined) && isDeepStrictEqual(prior, record)) {

      next.set(record.unique_id, prior);
    } else {

      next.set(record.unique_id, record);
      changed = true;
    }
  }

  return changed ? next : existing;
}

// The row member that identifies a configuration row, bound to the row type so a misspelling fails to compile rather than quietly matching nothing.
const ROW_IDENTITY: keyof AccessDeviceEntryConfig = "key";

/* Merge a wire partial onto a stored DEVICE record. This is the one entry every path into such a record takes - the legacy device update and the token client's
 * census reconcile alike - and it resolves the configuration rows and the capability set on the untyped wire plane before handing the result to the generic merge
 * below, which stays the single place an untyped wire payload meets a typed record.
 *
 * The principle is the one the object merge already applies, carried to the collections that arrive as arrays: the wire is authoritative for what it names, and
 * absence is never a clear. The rows are a keyed collection in array clothing, so they merge by row identity - keys are unique within a device's own array on every
 * captured topology, which is what makes identity the right join - and the capabilities are a value set, so they merge by union. Replacing either wholesale would
 * let a delivery that named one row, or one capability, truncate everything it did not mention, and every reader of the stored arrays - the capability predicates
 * above all - would answer from the truncation with nothing to show that it had happened.
 *
 * The cost is the one the null-skip already accepts for a cleared member: a row or a capability the controller stops reporting stands until the next full topology
 * reconcile. On a credential client the periodic refresh and any reconnect bound that; on a token client the census is the only reconcile there is, so a capability
 * a listing stops carrying stands for the session, which is unobserved because the capability list is a hardware fact. A row the record has never held appends at
 * the tail, so the next full reconcile may read the record as changed once where the controller orders its rows elsewhere.
 */
function mergeDeviceRecord(held: AccessStateDevice, patch: Record<string, AccessKnownJsonValue>): AccessStateDevice {

  const rows = patch["configs"];
  const capabilities = patch["capabilities"];
  const resolved: Record<string, AccessKnownJsonValue> = { ...patch };

  // A record holding no rows merges onto an empty list rather than taking the delivered array as it stands, so the admission guard governs every row on every path
  // and a record never admits an array nothing vouched for.
  if(Array.isArray(rows)) {

    resolved["configs"] = mergeKeyedRows(held.configs ?? [], rows);
  }

  if(Array.isArray(capabilities)) {

    resolved["capabilities"] = mergeValueSet(held.capabilities, capabilities);
  }

  return mergeRecord(held, resolved);
}

/* Merge a delivered configuration-row array onto the rows a device already holds, joined on each row's own identity.
 *
 * A supplied row the held list names takes the same null-skipping deep merge a notification takes, which hands back the held row itself when nothing changed - so
 * reference identity is the whole no-change test, and a row that did change is placed at the position it already occupied rather than moved. A supplied row no held
 * row names is admitted only when it carries every member the wire type requires, so an incomplete row is never stored as though the controller had sent the whole
 * of it: not admitted rather than invented, which is the discipline the classifier applies to a payload it cannot vouch for. A supplied row carrying no identity at
 * all is ignored, and a held row no delivery names stands.
 *
 * Each supplied row resolves against the rows as merged so far rather than against the held list alone, so a delivery naming one identity more than once layers
 * its later row onto its earlier one - the later statement wins member by member, exactly as it does across deliveries - and an identity the record has never
 * held is admitted once however many rows carry it.
 *
 * The held array comes back by reference when nothing moved, which is what lets the generic merge below find no change and keep the whole record's reference.
 */
function mergeKeyedRows(held: AccessDeviceEntryConfig[], supplied: readonly AccessKnownJsonValue[]): AccessDeviceEntryConfig[] {

  let result: AccessDeviceEntryConfig[] | null = null;

  for(const row of supplied) {

    if(!isRecord(row) || (typeof row[ROW_IDENTITY] !== "string")) {

      continue;
    }

    const rows = result ?? held;
    const current = rows.find((entry) => entry[ROW_IDENTITY] === row[ROW_IDENTITY]);

    if(current === undefined) {

      if(isConfigRow(row)) {

        result ??= [...held];
        result.push(row);
      }

      continue;
    }

    const merged = mergeRecord(current, row);

    if(!Object.is(merged, current)) {

      result ??= [...held];
      result[rows.indexOf(current)] = merged;
    }
  }

  return result ?? held;
}

/* Merge a delivered capability list onto the set a device already holds, by union: the members the held list lacks are appended in delivery order, each of them
 * once however many times one delivery repeats it. A list naming a subset - or the empty list a degraded official listing projects to - can therefore only add, so
 * no capability predicate is flipped to false by a delivery that simply said less. The held array comes back by reference when nothing is new.
 */
function mergeValueSet(held: string[], supplied: readonly AccessKnownJsonValue[]): string[] {

  const added = [...new Set(supplied.filter((value): value is string => typeof value === "string"))].filter((value) => !held.includes(value));

  return (added.length === 0) ? held : [ ...held, ...added ];
}

// Whether a delivered value is a complete configuration row: every member the wire type requires, each of them a string. A row arriving under an identity the
// record has never held is admitted on this and nothing else.
function isConfigRow(value: unknown): value is AccessDeviceEntryConfig {

  return isRecord(value) && (typeof value["device_id"] === "string") && (typeof value[ROW_IDENTITY] === "string") && (typeof value["tag"] === "string") &&
    (typeof value["value"] === "string");
}

// Merge a wire partial onto a stored record, preserving the record's own type. The value-level work is in mergeObjects below; this is the one place the untyped wire
// payload meets a typed record, so the widening lives here rather than at each call site.
function mergeRecord<T extends Record<string, AccessKnownJsonValue>>(record: T, patch: Record<string, AccessKnownJsonValue>): T {

  return mergeObjects(record, patch) as T;
}

/* Recursively merge a partial onto a record. Objects merge key by key, while arrays and primitives replace wholesale as the wire-authoritative values they are. The
 * merge is value-aware: it returns the *same reference* when the patch changes nothing and rebuilds only the nodes on the path to an actual change, which is the
 * structural-sharing engine the no-op guarantee rests on. The record is cloned lazily, on the first real change, so an all-no-op merge allocates nothing.
 *
 * A null-valued key is skipped at every depth. The obvious alternative, treating an explicit null as a clear, is wrong for this controller: on this wire a null means
 * the notification did not carry the field rather than that the controller cleared it, and a routine device update nulls more than a dozen keys whose stored values
 * are real, stable, and demonstrably still in force. Clearing on null would therefore corrupt state on most events. The choice has a cost: a field
 * the controller genuinely does clear arrives indistinguishable from one it merely omitted, so it stays stale until the next refresh reconciles it.
 *
 * The recursion matters because payloads are not uniformly full records. The controller sends different shapes for different hardware, including partial
 * sub-objects, so a shallow merge would replace a nested object wholesale and drop the sibling keys the payload did not mention.
 */
function mergeObjects(record: Record<string, unknown>, patch: Record<string, unknown>): Record<string, unknown> {

  let result: Record<string, unknown> | null = null;

  for(const key of Object.keys(patch)) {

    const patchValue = patch[key];

    if(patchValue === null) {

      continue;
    }

    const recordValue = record[key];
    let isChange: boolean;
    let nextValue: unknown;

    // Object onto object recurses, inheriting the reference-preserving no-op. Anything else replaces wholesale, and counts as a change only when it differs by value
    // from what is there, or introduces a key the record did not have.
    if(isRecord(patchValue) && isRecord(recordValue)) {

      nextValue = mergeObjects(recordValue, patchValue);
      isChange = !Object.is(nextValue, recordValue);
    } else {

      nextValue = patchValue;
      isChange = !(key in record) || !isDeepStrictEqual(recordValue, patchValue);
    }

    if(isChange) {

      result ??= { ...record };
      result[key] = nextValue;
    }
  }

  return result ?? record;
}

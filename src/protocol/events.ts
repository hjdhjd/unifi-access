/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * events.ts: The typed-event taxonomy and the pure classifier that lifts a notification packet into it.
 */

/**
 * The typed-event taxonomy for the UniFi Access notification stream and the pure {@link classifyPacket} that lifts an {@link AccessEventPacket} into it.
 *
 * This module performs no I/O, holds no state, and never throws. It owns what would otherwise be re-derived by every consumer: the `access.*` event-name vocabulary,
 * and every dialect translation the library speaks - the controller's second notification dialect rendered into the vocabulary the rest of the library uses, door
 * state among them.
 *
 * The dialect matters more than a rename would. A modern controller emits two independent notification namespaces: the original `access.data.*` names, whose payloads
 * speak the same vocabulary as the bootstrap document, and the newer `access.data.v2.*` names, whose payloads carry different field names, a different identity
 * convention, and in one case different units. The two are not guaranteed pairs, so a consumer that ignored the newer namespace would silently miss real updates.
 * Normalizing both into one typed event here means every consumer above this layer sees one vocabulary, while `eventName` preserves which wire name actually arrived.
 *
 * @module AccessEvents
 */
import type { AccessBootstrapConfig, AccessControllerConfig, AccessDeviceConfigPayload, AccessDoorStateAlarm, AccessDoorStateEmergency, AccessDoorStateEntry,
  AccessDoorStateSuspend, AccessEventDoorbellCancel, AccessEventDoorbellRing, AccessEventPacket, AccessEventTamperAlert, AccessKnownJsonValue, AccessLocationConfig,
  DeepWirePartial, Nullable } from "../types/index.ts";
import type { AccessStateDevice, AccessStateDoor } from "./reducer.ts";
import { isRecord } from "../json.ts";

// The notification names this classifier recognizes. Naming them once here makes this module the single home of the event vocabulary, which is otherwise re-parsed
// independently by every consumer that wants to branch on what happened.
const EVENT_DEVICE_UPDATE = "access.data.device.update";
const EVENT_DEVICE_UPDATE_V2 = "access.data.v2.device.update";
const EVENT_DEVICE_DELETE = "access.data.device.delete";
const EVENT_DEVICE_DELETE_V2 = "access.data.v2.device.delete";
const EVENT_LOCATION_UPDATE = "access.data.location.update";
const EVENT_LOCATION_UPDATE_V2 = "access.data.v2.location.update";
const EVENT_DOORBELL_RING = "access.remote_view";
const EVENT_DOORBELL_CANCEL = "access.remote_view.change";
const EVENT_REMOTE_UNLOCK = "access.data.device.remote_unlock";
const EVENT_DOOR_UNLOCK = "access.door.unlock";
const EVENT_TAMPER_ALERT = "access.tamper_resistant";

/* The fields a v2 device payload contributes to canonical state, mapped from the wire name the newer dialect uses to the name the bootstrap vocabulary uses. This
 * table is an allowlist, not a translation of everything present: a field is admitted only where its equivalence to a bootstrap field was confirmed by comparing a
 * live payload against the same device's bootstrap record. Every other field the dialect sends is dropped from the canonical payload and reaches consumers on the
 * raw packet rail instead, so nothing is lost, it simply does not overwrite modeled state.
 *
 * The exclusions are deliberate and each has a reason the wire demonstrated. `name` and `alias` are display variants rather than the bootstrap's own values, so
 * merging them would overwrite user-facing state with strings the bootstrap vocabulary never carries. `mac` is identity a census established, held in one spelling
 * whatever case the wire sends, so a notification restating it adds nothing. `version` carries a real string where the bootstrap carries null, so merging it would
 * flip that field against every refresh forever. `connected_hub_id`
 * agrees with the bootstrap's hub reference on readers but arrives empty on a hub describing itself, which would clobber a real value with an empty string. `cap` is
 * null on most notifications and, where it is populated at all, carries a reduced subset of the bootstrap's capabilities array, so merging it would truncate the
 * fuller record just as `settings` would: `settings` is a reduced projection of the fuller `configs` array. `category`, `direction`, and `access_method` have no
 * bootstrap counterpart at all. The dialect further sends structured state the bootstrap document models nowhere: `location_states` carries per-door lock and DPS
 * state, which is translated into the door-state event rather than merged here, because it describes doors rather than the device reporting them; `wire_state`
 * carries the wiring terminals, which has nothing to reconcile it against and so reaches consumers on the raw packet rail like every other unlisted field.
 */
const DEVICE_FIELD_MAP = {

  "adopting": "adopting",
  "device_type": "device_type",
  "firmware": "firmware",
  "guid": "guid",
  "hw_type": "hw_type",
  "id": "unique_id",
  "ip": "ip",
  "location_id": "location_id",
  "online": "is_online",
  "revision": "revision",
  "start_time": "start_time"
} as const;

/* The fields a v2 location payload contributes to canonical state, on the same allowlist discipline as the device table. The excluded fields are the ones with no
 * bootstrap counterpart by value: `device_ids`, `state`, and `last_activity` are v2-only, `thumbnail` is a reshaped projection of the extras thumbnail pair, and
 * `guard` carries resolved user records where the bootstrap's own door guard is a list of identifiers.
 */
const LOCATION_FIELD_MAP = {

  "extras": "extras",
  "id": "unique_id",
  "location_type": "location_type",
  "name": "name",
  "up_id": "up_id"
} as const;

/* The canonical field names each table admits, and the payload shapes built from them. Deriving the payload type from the table rather than restating it is what
 * makes the allowlist compile-enforced: reading an excluded field off a translated payload fails to build, so a translator that leaked one could not be consumed
 * silently, and adding a row to a table widens its payload type in the same edit.
 */
type TranslatedDeviceField = (typeof DEVICE_FIELD_MAP)[keyof typeof DEVICE_FIELD_MAP];
type TranslatedDevicePayload = Pick<AccessDeviceConfigPayload, TranslatedDeviceField>;
type TranslatedLocationField = (typeof LOCATION_FIELD_MAP)[keyof typeof LOCATION_FIELD_MAP];
type TranslatedLocationPayload = Pick<DeepWirePartial<AccessLocationConfig>, TranslatedLocationField>;

/* Epoch values at or above this magnitude are milliseconds rather than seconds. The controller is inconsistent about the unit of `start_time` on the newer dialect:
 * a camera-class device reports milliseconds while native Access hardware reports whole seconds, and the split follows the device class rather than the dialect, so
 * the unit cannot be decided from the event name. Magnitude decides it unambiguously instead, because epoch seconds do not reach this value until the year 33658.
 */
const EPOCH_MILLISECONDS_THRESHOLD = 1000000000000;

/**
 * The discriminated union of every notification the library models, produced by the classifier. It splits into two categories by relationship to state.
 *
 * **State transitions** advance the modeled state:
 *
 * - `deviceChanged` - a device record changed. Both notification dialects produce this one kind, with the newer dialect's payload already translated into the
 *   bootstrap vocabulary, so a consumer never sees the dialect split.
 * - `deviceRemoved` - a device was removed. Identity-only by design: the older dialect sends a record here and the newer one sends nothing, and the removal needs
 *   only the identity. The full payload the older dialect sends stays available on the raw packet rail.
 * - `locationChanged` - a door, floor, or building record changed, again with the newer dialect translated.
 * - `doorStateChanged` - one or more doors reported their live lock, position, alarm, and emergency condition. Both newer-dialect carriers produce it, each carrying
 *   its own facet of the packet alongside the door state, so nothing the packet said is lost to the modeling.
 * - `bootstrapLoaded` - a freshly fetched topology document. Synthetic rather than a wire packet: the client dispatches it so that the reducer has one input union
 *   and one entry point rather than a separate bootstrap path.
 * - `controllerChanged` - a freshly fetched controller-information document. Synthetic for the same reason as `bootstrapLoaded`, and dispatched from the same
 *   refresh: the controller document drifts on its own schedule from the topology document, so the two travel as separate events rather than one.
 * - `doorStateFactsApplied` - facts about doors read from a source that answers some of what a door-state report carries. Synthetic like the two above, and the
 *   third member of that family: the client dispatches it after reading the official API's door list, so that a partial set of facts reaches state through the same
 *   chokepoint a full report does.
 * - `censusApplied` - the official API's listings, projected into the records the state holds. Synthetic like the three above, and dispatched by a client whose
 *   only census of the controller's hardware and doors those listings are, so that its devices, doors, and door state all reach state in one step.
 *
 * **Activity signals** describe something that happened rather than a change of condition, and the reducer returns state untouched for them:
 *
 * - `doorbellRing` - a doorbell was pressed. Attributed to the reader that rang, taken from the payload rather than the envelope, because the envelope identifier on
 *   this notification is a per-notification value rather than a device.
 * - `doorbellCancel` - a ring was cancelled or otherwise ended.
 * - `unlock` - a door was unlocked.
 *
 * Every member lifted from the wire carries `eventName`, the raw notification name, so normalizing two dialects into one kind never hides which name arrived. The
 * synthetic members carry no `eventName`, because no packet produced them.
 *
 * @category Events
 */
export type AccessTypedEvent =

  | { data: AccessBootstrapConfig; kind: "bootstrapLoaded" } |
  { data: AccessControllerConfig; kind: "controllerChanged" } |

  /* Door facts from a source that answers less than a door-state report does, which is why this merges where the report replaces.
   *
   * `complete` says the entries are the whole of what the source knows about - every door it has - rather than a subset. A source that enumerates can be trusted to
   * say a door is gone by not mentioning it, and only then are unmentioned doors dropped. A source that answered about some doors says nothing about the others,
   * and dropping them on its word would delete state on no evidence.
   */
  { complete: boolean; entries: readonly AccessDoorStateEntry[]; kind: "doorStateFactsApplied" } |

  /* The official API's listings, projected into the records the state holds, from a client whose only census of the controller's hardware and doors those listings
   * are. Synthetic like the document events. The three collections travel together so that a hub and the door it drives land in one dispatch, exactly as the
   * topology document lands them, and `complete` carries the license the door facts carry, per collection: only an enumeration may say a record is gone by not
   * naming it, and one that names nothing says nothing.
   */
  { complete: boolean; devices: readonly AccessStateDevice[]; doorStates: readonly AccessDoorStateEntry[]; doors: readonly AccessStateDoor[]; kind: "censusApplied" } |
  { eventName: string; id: string; kind: "deviceChanged"; payload: AccessDeviceConfigPayload } |
  { eventName: string; id: string; kind: "deviceRemoved" } |
  { eventName: string; id: string; kind: "locationChanged"; payload: DeepWirePartial<AccessLocationConfig> } |
  { eventName: string; id: string; kind: "doorbellRing"; payload: AccessEventDoorbellRing } |
  { eventName: string; kind: "doorbellCancel"; payload: AccessEventDoorbellCancel } |

  /* The tamper alert, attributed to the hardware its payload names rather than to the envelope, whose identifier on this notification is a per-notification value
   * exactly as it is on the doorbell ring.
   *
   * The payload carries no verdict, because the wire carries none: it says an alert was raised, and what the hardware currently reports is a configuration row on
   * the device record that `tamperState` reads. Nor is the alert a reliable edge on that row - captures show it arriving both before and after the row moves - so a
   * consumer announcing an incident reads the state separately rather than inferring it from the alert's arrival. And like every activity event here, an alert
   * raised while the notification channel is down is not replayed: the state read is what a consumer re-reads on recovery.
   */
  { eventName: string; id: string; kind: "tamperAlert"; payload: AccessEventTamperAlert } |

  /* The door-state member, whose four properties each answer something the wire does.
   *
   * `states` is a non-empty array rather than a single entry because one multi-door hub reports every door it drives in one packet, and there is no top-level
   * identifier for the same reason: the packet names several doors, each entry carrying its own `location_id`. The array is non-empty by type, because an event
   * reporting no door state is not something the classifier ever produces - a packet whose entries are all unreadable falls through to its pre-existing kind
   * instead.
   *
   * `device` and `location` are the two carriers, and exactly one is present: the never-typed complement on each arm is what makes both-and-neither
   * unrepresentable, which the classifier and the reducer both rely on. Each carrier contributes its own facet because the wire proved neither half is redundant.
   * A device update carries genuinely non-duplicative device fields alongside the door state, and a state-bearing location update - the overwhelming majority of
   * that carrier, every specimen a whole-record push - carries the door's own canonical fields, whose realtime delivery would otherwise regress to the refresh
   * interval. One packet becomes one event carrying its carrier's facet, and nothing the packet said is dropped.
   */
  ({ eventName: string; kind: "doorStateChanged"; states: readonly [AccessDoorStateEntry, ...AccessDoorStateEntry[]] } &
    ({ device: { id: string; payload: AccessDeviceConfigPayload }; location?: never } |
    { device?: never; location: { id: string; payload: DeepWirePartial<AccessLocationConfig> } })) |

  /* The identifier's meaning here is per-notification, which is why it is documented rather than assumed. On `access.data.device.remote_unlock` from hub-class
   * hardware the envelope identifies the device that performed the unlock, confirmed against captured specimens whose payload carries the door's own location record
   * while the envelope names the hub. UGT gate hubs are reported to put the door's own location identifier in that same field instead, which no capture in hand
   * settles because none of the topologies sampled include gate hardware, so a consumer routing on this identifier has to tolerate both identity spaces. On
   * `access.door.unlock` no specimen exists in any capture in hand, so the envelope identifier is carried through as-is and which identity space it belongs to is
   * unverified; that name is modeled because the library's own earlier consumers filtered on it.
   */
  { eventName: string; id: string; kind: "unlock" };

/**
 * The members of {@link AccessTypedEvent} that a notification packet can actually produce - the rule being that a wire event is whatever the classifier can return.
 * The classifier lifts wire packets and nothing else, while the synthetic members are the ones the client dispatches directly from a fetched document, so a
 * consumer reading the notification stream can hold this narrower type honestly rather than carrying arms the wire will never hand it. Every member here is an
 * {@link AccessTypedEvent}, so anything that accepts the wider union accepts these unchanged.
 *
 * @category Events
 */
export type AccessWireEvent = Exclude<AccessTypedEvent, { kind: "bootstrapLoaded" } | { kind: "censusApplied" } | { kind: "controllerChanged" } |
  { kind: "doorStateFactsApplied" }>;

/**
 * Classify a notification packet into an {@link AccessWireEvent}, or `null` when the packet is well-formed but describes something the library does not model.
 *
 * This is a pure, stateless, total function over wire input. It reads only the packet's own self-description and never consults prior state, holds state, logs, or
 * throws. Returning `null` is the documented answer for an unmodeled packet: a name outside the vocabulary, a payload of the wrong shape, or a doorbell notification
 * that does not carry the fields its payload is supposed to have. The caller observes the `null` and moves on, while the raw packet rail still delivers the packet
 * verbatim to any consumer that wants it.
 *
 * @param packet - A notification packet as the controller sent it.
 *
 * @returns The classified event, or `null` for a valid-but-unmodeled packet.
 *
 * @category Events
 */
export function classifyPacket(packet: AccessEventPacket): Nullable<AccessWireEvent> {

  const eventName = packet.event;

  switch(eventName) {

    case EVENT_DEVICE_UPDATE: {

      // The older dialect already speaks the bootstrap vocabulary, so its payload passes through untranslated. A full record satisfies the partial payload type,
      // which is why sparse and complete payloads share one type here.
      const payload = asRecord(packet.data);

      return (payload === undefined) ? null : { eventName, id: packet.event_object_id, kind: "deviceChanged", payload };
    }

    case EVENT_DEVICE_UPDATE_V2: {

      const id = packet.meta?.id;
      const payload = asRecord(packet.data);

      if((id === undefined) || (payload === undefined)) {

        return null;
      }

      /* A device update carrying readable door state is a door-state event that also carries the device's own translated fields. The fall-through when nothing is
       * admitted is what keeps an unfamiliar entry shape degrading to the behavior this carrier had before door state was modeled at all, rather than to nothing.
       */
      const states = admitEntries(payload["location_states"]);

      if(states !== null) {

        return { device: { id, payload: translateDevicePayload(payload, id) }, eventName, kind: "doorStateChanged", states };
      }

      return { eventName, id, kind: "deviceChanged", payload: translateDevicePayload(payload, id) };
    }

    case EVENT_DEVICE_DELETE:

      // The older dialect carries the removed record and echoes its identity in the envelope; we take the envelope, so both dialects resolve identity the same way
      // from this classifier's point of view.
      return { eventName, id: packet.event_object_id, kind: "deviceRemoved" };

    case EVENT_DEVICE_DELETE_V2: {

      // The newer dialect sends no payload at all on a removal and identifies the subject through the packet's metadata, because its envelope identifier is a
      // per-notification value rather than the entity.
      const id = packet.meta?.id;

      return (id === undefined) ? null : { eventName, id, kind: "deviceRemoved" };
    }

    case EVENT_LOCATION_UPDATE: {

      const payload = asRecord(packet.data);

      return (payload === undefined) ? null : { eventName, id: packet.event_object_id, kind: "locationChanged",
        payload };
    }

    case EVENT_LOCATION_UPDATE_V2: {

      const id = packet.meta?.id;
      const payload = asRecord(packet.data);

      if((id === undefined) || (payload === undefined)) {

        return null;
      }

      /* The location carrier sends one door's state under `state`, in the same entry shape the device carrier arrays - except that it names no door, because the
       * packet is already about one. The envelope's identity supplies the `location_id` the entry omits, which is checked against a specimen rather than assumed.
       * A present-but-unreadable state falls through to the location update it would otherwise have been, on the same rule the device carrier follows.
       */
      const state = payload["state"];

      if(state !== undefined) {

        const entry = admitEntry(state, id);

        if(entry !== null) {

          return { eventName, kind: "doorStateChanged", location: { id, payload: translateLocationPayload(payload, id) }, states: [entry] };
        }
      }

      return { eventName, id, kind: "locationChanged", payload: translateLocationPayload(payload, id) };
    }

    case EVENT_DOORBELL_RING:

      // The ring is attributed to the reader named in the payload. The envelope identifier on this notification is a per-notification value, so it would not route
      // the signal to a device.
      return isDoorbellRingPayload(packet.data) ? { eventName, id: packet.data.device_id, kind: "doorbellRing", payload: packet.data } : null;

    case EVENT_DOORBELL_CANCEL:

      return isDoorbellCancelPayload(packet.data) ? { eventName, kind: "doorbellCancel", payload: packet.data } : null;

    case EVENT_TAMPER_ALERT:

      // Attributed to the device the payload names, for the ring's reason: the envelope identifier on this notification is a per-notification value.
      return isTamperAlertPayload(packet.data) ? { eventName, id: packet.data.device.unique_id, kind: "tamperAlert", payload: packet.data } : null;

    case EVENT_REMOTE_UNLOCK:
    case EVENT_DOOR_UNLOCK:

      return { eventName, id: packet.event_object_id, kind: "unlock" };

    default:

      // Every other name the controller emits is deliberately unmodeled rather than unrecognized: camera updates, the controller's own information broadcast, user
      // updates, and activity log additions all reach consumers on the raw packet rail without being folded into state.
      return null;
  }
}

/**
 * Whether a decoded value is shaped like an {@link AccessEventPacket}. This is the decode boundary the notification stream needs: `JSON.parse` hands back an
 * unchecked value, and asserting that value into the packet type would let any valid-JSON frame through, so a frame carrying no `event_object_id` would reach
 * consumers with an undefined identifier typed as a string and be published under it.
 *
 * The checked fields are the ones the classifier actually reads from the envelope: `event` and `event_object_id` must be strings, and `data` must be present and
 * either null or a record, because a deletion notification legitimately carries `data: null`. `meta` is deliberately not required - it is optional on the packet
 * and the classifier reaches it through optional chaining.
 *
 * @param value - A decoded value of unknown shape, typically the result of parsing a notification frame.
 *
 * @returns `true` when the value carries the envelope the classifier reads.
 *
 * @category Events
 */
export function isAccessEventPacket(value: unknown): value is AccessEventPacket {

  if(!isRecord(value)) {

    return false;
  }

  return (typeof value["event"] === "string") && (typeof value["event_object_id"] === "string") && ("data" in value) &&
    ((value["data"] === null) || isRecord(value["data"]));
}

/* Translate a newer-dialect device payload into the bootstrap vocabulary. Only the fields the table names are read, so an unlisted wire field cannot reach the
 * result, and the return type derives from the same table, so the two cannot drift.
 *
 * The identity is taken from the envelope rather than the payload's own `id` field. They agree on every captured specimen, but taking the envelope's value means the
 * stored record's self-identity and the key it is stored under come from one source and cannot disagree.
 */
function translateDevicePayload(data: Record<string, AccessKnownJsonValue>, id: string): TranslatedDevicePayload {

  const translated = translateFields(data, DEVICE_FIELD_MAP);

  translated["unique_id"] = id;

  const startTime = translated["start_time"];

  if(typeof startTime === "number") {

    translated["start_time"] = normalizeEpochSeconds(startTime);
  }

  // The one widening cast in this module. The table's values are canonical field names and the loop copies wire values under them, which the compiler cannot verify
  // for untyped wire data; the derived type above is what keeps the admitted set honest from here on.
  return translated;
}

// Translate a newer-dialect location payload, on the same discipline as the device translation above.
function translateLocationPayload(data: Record<string, AccessKnownJsonValue>, id: string): TranslatedLocationPayload {

  const translated = translateFields(data, LOCATION_FIELD_MAP);

  translated["unique_id"] = id;

  return translated;
}

// Copy the fields a translation table admits, under their canonical names. Iterating the table rather than the payload is what enforces the allowlist at runtime: a
// field the table does not name is never read, so it cannot reach canonical state no matter what the controller sends.
function translateFields(data: Record<string, AccessKnownJsonValue>, map: Readonly<Record<string, string>>): Record<string, AccessKnownJsonValue> {

  const translated: Record<string, AccessKnownJsonValue> = {};

  for(const [ wireName, canonicalName ] of Object.entries(map)) {

    const value = data[wireName];

    // A field the payload does not carry is simply absent from the translation. A field it carries as null is copied through as null, because null on this wire
    // means not-carried rather than cleared, and the merge is where that meaning is honored.
    if(value === undefined) {

      continue;
    }

    translated[canonicalName] = value;
  }

  return translated;
}

// Reduce an epoch value to whole seconds, dividing only when its magnitude shows it arrived in milliseconds. Truncating rather than rounding keeps the value on the
// same second the controller's own seconds-valued fields report.
function normalizeEpochSeconds(value: number): number {

  return (value >= EPOCH_MILLISECONDS_THRESHOLD) ? Math.trunc(value / 1000) : value;
}

/* Whether a payload carries what a ring notification is supposed to carry. The two required fields are the ones a consumer cannot do without: the channel the call
 * arrives on, and the reader the press is attributed to. A packet failing this is not classified, rather than being classified with an identity we would have had to
 * invent.
 */
function isDoorbellRingPayload(value: unknown): value is AccessEventDoorbellRing {

  return isRecord(value) && (typeof value["channel"] === "string") && (typeof value["device_id"] === "string");
}

/* Whether a payload carries what a tamper alert is supposed to carry. The one member a consumer cannot do without is the hardware the alert is attributed to, so
 * that is what is checked and nothing else. A packet failing it is not classified, rather than being classified against an identity we would have had to invent,
 * and everything else the payload holds is carried through exactly as the wire delivered it.
 */
function isTamperAlertPayload(value: unknown): value is AccessEventTamperAlert {

  return isRecord(value) && isRecord(value["device"]) && (typeof value["device"]["unique_id"] === "string");
}

// Whether a payload carries what a ring cancellation is supposed to carry: the identifier of the call being cancelled.
function isDoorbellCancelPayload(value: unknown): value is AccessEventDoorbellCancel {

  return isRecord(value) && (typeof value["remote_call_request_id"] === "string");
}

/* The admission contract for door state, defined here and applied by both carriers. An entry is admitted when every required member is present and of the declared
 * type, and when every optional member it carries is well-formed.
 *
 * A malformed optional rejects the whole entry rather than being dropped from it. That is the safer reading of the two, and the reasoning is about alarms: an entry
 * whose alarm data cannot be parsed says nothing about whether an alarm is in force, so admitting it without its alarms would report "no alarm" on the strength of a
 * payload we did not understand. Rejecting leaves whatever the door last cleanly reported standing until it reports cleanly again, which is a stale reading rather
 * than an invented one.
 */
function isDoorStateEntry(value: unknown): value is AccessDoorStateEntry {

  if(!isRecord(value)) {

    return false;
  }

  const required = (typeof value["location_id"] === "string") && (typeof value["lock"] === "string") && (typeof value["dps"] === "string") &&
    (typeof value["dps_connected"] === "boolean") && (typeof value["is_unavailable"] === "boolean") && isDoorStateEmergency(value["emergency"]);

  if(!required) {

    return false;
  }

  const alarms = value["alarms"];
  const suspend = value["unlock_suspend"];

  return ((alarms === undefined) || isDoorStateAlarms(alarms)) && ((suspend === undefined) || isDoorStateSuspend(suspend));
}

// Whether a value is the emergency pair every entry carries: the physical input and the controller-issued state, each a string.
function isDoorStateEmergency(value: unknown): value is AccessDoorStateEmergency {

  return isRecord(value) && (typeof value["hardware"] === "string") && (typeof value["software"] === "string");
}

// Whether a value is the alarm list an entry may carry - a list, every member of which names its kind.
function isDoorStateAlarms(value: unknown): value is AccessDoorStateAlarm[] {

  return Array.isArray(value) && value.every((alarm) => isRecord(alarm) && (typeof alarm["type"] === "string"));
}

// Whether a value is the unlock suspension an entry may carry: where the suspension stands, and which unlock it applies to.
function isDoorStateSuspend(value: unknown): value is AccessDoorStateSuspend {

  return isRecord(value) && (typeof value["status"] === "string") && (typeof value["unlock_type"] === "string");
}

/* Admit the entries of a device carrier's door-state array, or null when this packet is not one. Admission is per-entry: a mixed array contributes the entries that
 * pass and drops the rest, because a dropped entry's own door self-corrects on its next clean report while the entries beside it describe different doors entirely
 * and are not implicated. An array that contributes nothing - empty, or wholly unreadable - is reported as null so the caller falls through.
 */
function admitEntries(value: unknown): Nullable<readonly [AccessDoorStateEntry, ...AccessDoorStateEntry[]]> {

  if(!Array.isArray(value)) {

    return null;
  }

  const admitted = value.filter((entry) => isDoorStateEntry(entry));

  return isNonEmpty(admitted) ? admitted : null;
}

/* Admit a location carrier's single state member, supplying the door identity from the envelope. The member carries every other entry field but names no door,
 * because the packet already does, so the entry is completed here rather than being admitted incomplete and repaired downstream.
 */
function admitEntry(value: unknown, locationId: string): Nullable<AccessDoorStateEntry> {

  if(!isRecord(value)) {

    return null;
  }

  const candidate = { ...value, "location_id": locationId };

  return isDoorStateEntry(candidate) ? candidate : null;
}

// Whether an array has at least one member, expressed so the non-empty array type the door-state event declares is reached by a check rather than by assertion.
function isNonEmpty<T>(value: T[]): value is [T, ...T[]] {

  return value.length > 0;
}

// The packet's payload as a wire record, or undefined when the notification carried no payload or something other than an object. A removal legitimately carries no
// payload, so this returning undefined is not by itself a malformed packet.
function asRecord(data: AccessEventPacket["data"]): Record<string, AccessKnownJsonValue> | undefined {

  return isRecord(data) ? data : undefined;
}

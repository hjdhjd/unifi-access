/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * events.ts: The typed-event taxonomy and the pure classifier that lifts a notification packet into it.
 */

/**
 * The typed-event taxonomy for the UniFi Access notification stream and the pure {@link classifyPacket} that lifts an {@link AccessEventPacket} into it.
 *
 * This module performs no I/O, holds no state, and never throws. It owns what would otherwise be re-derived by every consumer: the `access.*` event-name vocabulary,
 * the members a notification of either dialect may write to the record it describes, and every dialect translation the library speaks - the controller's second
 * notification dialect rendered into the vocabulary the rest of the library uses, door state among them.
 *
 * The dialect matters more than a rename would. A modern controller emits two independent notification namespaces: the original `access.data.*` names, whose payloads
 * name each field as the bootstrap document does and restate the whole record, and the newer `access.data.v2.*` names, whose payloads carry different field names
 * and a different identity convention. The two are not guaranteed pairs, so a consumer that ignored the newer namespace would silently miss real updates. Each record
 * type declares once which members a notification may write, and both dialects resolve through that one declaration - the newer one translated into it, the
 * original one admitted through it name for name - so every consumer above this layer sees one vocabulary and one admitted set, while `eventName` preserves which
 * wire name actually arrived.
 *
 * @module AccessEvents
 */
import type { AccessBootstrapConfig, AccessControllerConfig, AccessDeviceConfigPayload, AccessDeviceEntryConfigPayload, AccessDoorStateAlarm,
  AccessDoorStateEmergency, AccessDoorStateEntry, AccessDoorStateSuspend, AccessEventDoorbellCancel, AccessEventDoorbellRing, AccessEventPacket,
  AccessEventTamperAlert, AccessKnownJsonValue, AccessLocationConfig, DeepWirePartial, Nullable } from "../types/index.ts";
import type { AccessStateDevice, AccessStateDoor } from "./reducer.ts";
import { accessMethodValue, readAccessMethodValue } from "./vocabulary.ts";
import { isPlainObject } from "./plain-object.ts";

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

/* The members a device notification of either dialect may write to a stored device record, declared once so both dialects resolve through the same set: the newer
 * dialect's tables below translate into it, and the original dialect's payload is admitted through it name for name. A member is declared on one criterion - a
 * newer-dialect field whose equivalence to the topology's own value a live comparison confirmed, less `revision` and `start_time`, or an original-dialect member a
 * reader relies on - and every other member a notification carries reaches consumers on the raw packet rail alone. So an undeclared member whose notification
 * value disagrees with the topology's own never reaches stored state, and a refresh has none of those to revert, while the next refresh that reads the topology
 * writes its own value over a declared member a notification advanced.
 *
 * The original dialect is why the declaration spans both dialects rather than living in the newer one's tables alone. Every captured device update on that dialect
 * restates the whole record, and a whole record carries members the topology owns in values of its own - a display name and version fields the topology spells
 * differently, a last-seen stamp that never advances, and a hub naming no uplink where the topology names the hub itself - so merging it whole would move those
 * members on every delivery for the next refresh to move back. The cost is what the declaration leaves out: a rename, a reader's uplink, and the door a device
 * embeds reach stored state at the next refresh or reconnect, and a record a token-only client seeds from the official listing never gains what that listing
 * lacks beyond the declared members, because the listing is the only census that client reads.
 *
 * The record type's index signature admits any member name, so no key list checks the declaration's spelling where it is written. A misspelled member fails the
 * census rows in the classifier's suite: the misspelling is a name no captured record carries, and the member it meant is carried but neither declared nor excluded.
 */
export const DEVICE_NOTIFICATION_MEMBERS = [ "adopting", "alias", "capabilities", "configs", "device_type", "extensions", "firmware", "guid", "hw_type", "ip",
  "is_adopted", "is_camera", "is_connected", "is_managed", "is_online", "is_rebooting", "location_id", "unique_id" ] as const;

// One member of the device declaration.
type NotifiedDeviceMember = (typeof DEVICE_NOTIFICATION_MEMBERS)[number];

// The original dialect's admission table, each declared member under its own name, because that dialect names every member as the topology does. It is built once
// from the declaration, so the dialect admits the declared set exactly and nothing restates it.
const ORIGINAL_DEVICE_FIELDS = identityFields(DEVICE_NOTIFICATION_MEMBERS);

/* The members an original-dialect device update carries that the declaration leaves out, declared so the classifier's suite can census the committed corpus against
 * the declaration as it does the newer dialect's tables: every member a captured record carries is in exactly one of the two, and a member the controller starts
 * sending fails that census rather than dropping in silence. Each reason follows from the declaration's criterion. The live comparison caught `name`, `version`,
 * `source`, `bom_rev`, `last_seen`, and a hub's own `connected_uah_id` disagreeing with the topology; `revision`, `revision_update_time`, and `start_time` are a
 * counter and stamps nothing reads; `mac` is identity a census established; `door`, `floor`, and `location` are snapshots of records the location maps own; and
 * every other member never differs from the topology, arrives null, appears on this dialect alone, or is camera material this library does not model.
 */
export const ORIGINAL_DEVICE_FIELD_EXCLUSIONS: ReadonlySet<string> = new Set([ "adopt_time", "bom_rev", "camera_resource", "camera_setting", "cameras",
  "connected_uah_id", "display_model", "door", "firmware_update_time", "floor", "images", "is_export_sf_blocked", "is_revision_up_to_date", "is_unavailable",
  "is_upgrade_blocked", "last_seen", "location", "mac", "model", "name", "need_advisory", "provision_percent", "provision_time", "resource_name", "revision",
  "revision_update_time", "security_check", "source", "start_time", "template", "update", "update_manual", "version", "version_update_time" ]);

/* The fields a v2 device payload contributes to canonical state, mapped from the wire name the newer dialect uses to the declared member it lands on. This table is
 * an allowlist, not a translation of everything present: a field is admitted only where its equivalence to a bootstrap field was confirmed by comparing a live
 * payload against the same device's bootstrap record, and every target is a declared member, which the `satisfies` clause turns into a build failure to break. A
 * field that states bootstrap values in a shape of its own reaches canonical state only through the projection table below, and every other field the dialect
 * sends is dropped from the canonical payload. The raw packet rail delivers every field verbatim whatever these tables say, so nothing is lost, and a dropped field
 * simply does not overwrite modeled state.
 *
 * The exclusions are deliberate and each has a reason the wire demonstrated. `name` and `alias` are display variants rather than the bootstrap's own values, so
 * merging them would overwrite user-facing state with strings the bootstrap vocabulary never carries. `mac` is identity a census established, held in one spelling
 * whatever case the wire sends, so a notification restating it adds nothing. `version` carries a real string where the bootstrap carries null, so merging it would
 * flip that field against every refresh forever. `revision` is a counter that runs ahead of the topology's own, which nothing reads, so merging it would move the
 * record on every delivery for the next refresh to move back, and `start_time` is a stamp nothing reads, in a unit that follows the device class rather than the
 * dialect. `connected_hub_id` agrees with the bootstrap's hub reference on readers but arrives empty on a hub describing itself, which would clobber a real value
 * with an empty string. `cap` is null on most notifications, and where it is populated it is not a subset of the bootstrap's capabilities array: the captured
 * hub's, at the guid and firmware of its own topology record, names capabilities that record does not carry, so the union a capability list merges by would admit
 * capabilities no census established, and the record would then disagree with every topology refresh. `settings` restates rows of the fuller `configs` array
 * under the key and tag the topology's own rows carry, and no reading this library derives rests on a key those rows carry, so folding them would move stored
 * state that nothing reads. `category` and `direction` have no bootstrap counterpart at all. The dialect further sends structured state the bootstrap document
 * models nowhere: `location_states` carries per-door lock and DPS state, which is translated into the door-state event rather than merged here, because it
 * describes doors rather than the device reporting them; `wire_state` carries the wiring terminals, which has nothing to reconcile it against and so reaches
 * consumers on the raw packet rail like every other unlisted field.
 */
export const DEVICE_FIELD_MAP = {

  "adopting": "adopting",
  "device_type": "device_type",
  "firmware": "firmware",
  "guid": "guid",
  "hw_type": "hw_type",
  "id": "unique_id",
  "ip": "ip",
  "location_id": "location_id",
  "online": "is_online"
} as const satisfies Record<string, NotifiedDeviceMember>;

/* The fields a v2 device payload carries in a shape of its own, mapped from the wire name to the canonical member each is projected into rather than copied to.
 *
 * `access_method` is the device's access-method map, each wire key beside its `"yes"` or `"no"` value, and it states the same readings the record's configuration
 * rows carry under the same keys. It is projected into those rows as one value-only row `{ key, value }` per entry the shared yes-or-no reading admits, and the
 * reducer's keyed row merge lands each one on the row the record already holds under that key, value only, and never admits one as a row of its own, because a
 * row carrying no tag and no device identity is not one the controller sent whole. So the topology stays the authority on which rows a record holds, and this
 * keeps their values current between refreshes. The join rests on the premise that merge already states, that a key is unique within one device's rows, and a
 * value outside the pair is left out rather than projected, so a held row is never overwritten with a reading the library would not report.
 */
export const DEVICE_FIELD_PROJECTIONS = {

  "access_method": "configs"
} as const satisfies Record<string, NotifiedDeviceMember>;

/* The fields a v2 device payload carries that the tables above deliberately leave out, declared so the classifier's suite can census the committed corpus against
 * every declaration: every field a captured payload carries is in exactly one of the allowlist, the projection table, and this set, and a field the controller
 * starts sending fails that census rather than dropping in silence. The reasons live in the paragraph above the allowlist.
 */
export const DEVICE_FIELD_EXCLUSIONS: ReadonlySet<string> = new Set([ "alias", "cap", "category", "connected_hub_id", "direction", "location_states", "mac", "name",
  "revision", "settings", "start_time", "version", "wire_state" ]);

/* The members a location notification of either dialect may write to a stored location record, on the device declaration's terms: the newer dialect's table below
 * translates into it, the original dialect's payload is admitted through it name for name, and the criterion is the same - the newer dialect's equivalence-confirmed
 * fields, plus `full_name`, which only the original dialect carries and which a door's lookup and its refusal wording read. Its spelling is checked as the device
 * declaration's is: a misspelled member fails the classifier suite's census rows.
 */
export const LOCATION_NOTIFICATION_MEMBERS = [ "extras", "full_name", "location_type", "name", "unique_id", "up_id" ] as const;

// One member of the location declaration.
type NotifiedLocationMember = (typeof LOCATION_NOTIFICATION_MEMBERS)[number];

// The original dialect's location admission table, built from the declaration as the device table is.
const ORIGINAL_LOCATION_FIELDS = identityFields(LOCATION_NOTIFICATION_MEMBERS);

/* The members an original-dialect location update carries that the declaration leaves out, on the device set's census discipline. Nothing reads any of them from
 * stored state, so the set is the consistency the declaration buys rather than a defect it stops: one admission rule for every original-dialect record, and a
 * member the controller starts sending fails the census rather than reaching stored state unread.
 */
export const ORIGINAL_LOCATION_FIELD_EXCLUSIONS: ReadonlySet<string> = new Set([ "extra_type", "level", "previous_name", "timezone", "work_time", "work_time_id" ]);

/* The fields a v2 location payload contributes to canonical state, on the same allowlist discipline as the device table, each target a declared location member.
 * The excluded fields are the ones with no bootstrap counterpart by value: `device_ids`, `state`, and `last_activity` are v2-only, `thumbnail` is a reshaped
 * projection of the extras thumbnail pair, and `guard` carries resolved user records where the bootstrap's own door guard is a list of identifiers.
 */
export const LOCATION_FIELD_MAP = {

  "extras": "extras",
  "id": "unique_id",
  "location_type": "location_type",
  "name": "name",
  "up_id": "up_id"
} as const satisfies Record<string, NotifiedLocationMember>;

// The fields a v2 location payload carries that the table above deliberately leaves out, on the same census discipline as the device set.
export const LOCATION_FIELD_EXCLUSIONS: ReadonlySet<string> = new Set([ "device_ids", "guard", "last_activity", "state", "thumbnail" ]);

/* The payload each declaration admits. Deriving it from the declaration rather than restating it is what makes the admitted set compile-enforced: reading an
 * undeclared member off an admitted payload fails to build, so an admission that leaked one could not be consumed silently, and declaring a member widens its
 * payload type in the same edit.
 */
type NotifiedDevicePayload = Pick<AccessDeviceConfigPayload, NotifiedDeviceMember>;
type NotifiedLocationPayload = Pick<DeepWirePartial<AccessLocationConfig>, NotifiedLocationMember>;

/**
 * The discriminated union of every notification the library models, produced by the classifier. It splits into two categories by relationship to state.
 *
 * **State transitions** advance the modeled state:
 *
 * - `deviceChanged` - a device record changed. Both notification dialects produce this one kind, and both resolve through one declaration of the members a device
 *   notification may write - the newer dialect's payload translated into the bootstrap vocabulary, the original dialect's admitted name for name - so a consumer
 *   reads one set of field names, and only the declared ones, whichever dialect arrived. Every other member either dialect sends stays on the raw packet rail. The
 *   configuration rows are where the two still differ in shape: the original dialect delivers each row whole, while the newer dialect's access-method map arrives
 *   as rows carrying only a key and a value, with no tag, no device identity, and no timestamps.
 * - `deviceRemoved` - a device was removed. Identity-only by design: the older dialect sends a record here and the newer one sends nothing, and the removal needs
 *   only the identity. The full payload the older dialect sends stays available on the raw packet rail.
 * - `locationChanged` - a door, floor, or building record changed, its payload admitted through the location declaration on the same terms.
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
  { eventName: string; id: string; kind: "deviceChanged"; payload: NotifiedDevicePayload } |
  { eventName: string; id: string; kind: "deviceRemoved" } |
  { eventName: string; id: string; kind: "locationChanged"; payload: NotifiedLocationPayload } |
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
    ({ device: { id: string; payload: NotifiedDevicePayload }; location?: never } |
    { device?: never; location: { id: string; payload: NotifiedLocationPayload } })) |

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

      // The older dialect names every member as the topology does, so its record is admitted through the declaration name for name rather than translated, and
      // what the declaration leaves out stays on the raw packet rail. Its identity is taken from the envelope, as the newer dialect's is.
      const payload = asRecord(packet.data);

      return (payload === undefined) ? null : { eventName, id: packet.event_object_id, kind: "deviceChanged",
        payload: admitDeviceFields(payload, ORIGINAL_DEVICE_FIELDS, packet.event_object_id) };
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

      // Admitted through the location declaration name for name, on the device update's terms.
      const payload = asRecord(packet.data);

      return (payload === undefined) ? null : { eventName, id: packet.event_object_id, kind: "locationChanged",
        payload: admitLocationFields(payload, ORIGINAL_LOCATION_FIELDS, packet.event_object_id) };
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

          return { eventName, kind: "doorStateChanged", location: { id, payload: admitLocationFields(payload, LOCATION_FIELD_MAP, id) }, states: [entry] };
        }
      }

      return { eventName, id, kind: "locationChanged", payload: admitLocationFields(payload, LOCATION_FIELD_MAP, id) };
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

  if(!isPlainObject(value)) {

    return false;
  }

  return (typeof value["event"] === "string") && (typeof value["event_object_id"] === "string") && ("data" in value) &&
    ((value["data"] === null) || isPlainObject(value["data"]));
}

/* Admit a device payload of either dialect through its table: the fields the table names, copied under the declared members it maps them to, with the identity
 * taken from the envelope rather than the payload's own field. The two agree on every captured specimen, but taking the envelope's value means the stored record's
 * self-identity and the key it is stored under come from one source and cannot disagree.
 *
 * The one widening cast a device payload takes. The compiler holds each table's values to the declared members, while the copy loop writes untyped wire values under
 * them, which it cannot verify; the derived payload type is what keeps the admitted set honest from here on.
 */
function admitDeviceFields(data: Record<string, AccessKnownJsonValue>, fields: Readonly<Record<string, NotifiedDeviceMember>>, id: string): NotifiedDevicePayload {

  const admitted = translateFields(data, fields);

  admitted["unique_id"] = id;

  return admitted;
}

/* Translate a newer-dialect device payload into the declared members. Only the fields the allowlist and the projection table name are read - the allowlist's
 * admitted under their declared names, the projection table's reshaped into the member it names - so an unlisted wire field cannot reach the result.
 */
function translateDevicePayload(data: Record<string, AccessKnownJsonValue>, id: string): NotifiedDevicePayload {

  const translated = admitDeviceFields(data, DEVICE_FIELD_MAP, id);

  // A map whose every entry falls outside the pair projects nothing, and the member is left out rather than carried empty, so the payload says nothing about
  // the rows where the wire established no reading.
  const accessMethodRows = projectAccessMethods(data["access_method"]);

  if(accessMethodRows.length > 0) {

    translated[DEVICE_FIELD_PROJECTIONS.access_method] = accessMethodRows;
  }

  return translated;
}

/* Project the newer dialect's access-method map into value-only configuration rows, one per entry the shared yes-or-no reading admits, in the order the map
 * delivered them. Each value is written back through the same vocabulary it was read by, so a projected row spells its value exactly as the row it lands on
 * does. A map that is not a record projects nothing, as an absent one does.
 */
function projectAccessMethods(map: AccessKnownJsonValue): AccessDeviceEntryConfigPayload[] {

  const rows: AccessDeviceEntryConfigPayload[] = [];

  if(!isPlainObject(map)) {

    return rows;
  }

  for(const [ key, value ] of Object.entries(map)) {

    const enabled = readAccessMethodValue(value);

    if(enabled !== undefined) {

      rows.push({ key, value: accessMethodValue(enabled) });
    }
  }

  return rows;
}

// Admit a location payload of either dialect through its table, on the device admission's terms, and the one widening cast a location payload takes.
function admitLocationFields(data: Record<string, AccessKnownJsonValue>, fields: Readonly<Record<string, NotifiedLocationMember>>,
  id: string): NotifiedLocationPayload {

  const admitted = translateFields(data, fields);

  admitted["unique_id"] = id;

  return admitted;
}

// An admission table that admits each member under its own name, for a dialect whose field names are already the declared ones.
function identityFields<Member extends string>(members: readonly Member[]): Readonly<Record<string, Member>> {

  return Object.fromEntries(members.map((member): [ string, Member ] => [ member, member ]));
}

// Copy the fields an admission table names, under the members it maps them to. Iterating the table rather than the payload is what enforces the admitted set at
// runtime: a field the table does not name is never read, so it cannot reach canonical state no matter what the controller sends.
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

/* Whether a payload carries what a ring notification is supposed to carry. The two required fields are the ones a consumer cannot do without: the channel the call
 * arrives on, and the reader the press is attributed to. A packet failing this is not classified, rather than being classified with an identity we would have had to
 * invent.
 */
function isDoorbellRingPayload(value: unknown): value is AccessEventDoorbellRing {

  return isPlainObject(value) && (typeof value["channel"] === "string") && (typeof value["device_id"] === "string");
}

/* Whether a payload carries what a tamper alert is supposed to carry. The one member a consumer cannot do without is the hardware the alert is attributed to, so
 * that is what is checked and nothing else. A packet failing it is not classified, rather than being classified against an identity we would have had to invent,
 * and everything else the payload holds is carried through exactly as the wire delivered it.
 */
function isTamperAlertPayload(value: unknown): value is AccessEventTamperAlert {

  return isPlainObject(value) && isPlainObject(value["device"]) && (typeof value["device"]["unique_id"] === "string");
}

// Whether a payload carries what a ring cancellation is supposed to carry: the identifier of the call being cancelled.
function isDoorbellCancelPayload(value: unknown): value is AccessEventDoorbellCancel {

  return isPlainObject(value) && (typeof value["remote_call_request_id"] === "string");
}

// Whether a value is the emergency pair a report may carry: the physical input and the controller-issued state, each a string.
function isDoorStateEmergency(value: unknown): value is AccessDoorStateEmergency {

  return isPlainObject(value) && (typeof value["hardware"] === "string") && (typeof value["software"] === "string");
}

// Whether a value is the alarm list an entry may carry - a list, every member of which names its kind.
function isDoorStateAlarms(value: unknown): value is AccessDoorStateAlarm[] {

  return Array.isArray(value) && value.every((alarm) => isPlainObject(alarm) && (typeof alarm["type"] === "string"));
}

// Whether a value is the unlock suspension an entry may carry: where the suspension stands, and which unlock it applies to.
function isDoorStateSuspend(value: unknown): value is AccessDoorStateSuspend {

  return isPlainObject(value) && (typeof value["status"] === "string") && (typeof value["unlock_type"] === "string");
}

// The primitive shapes the fact table reads, as predicates so every row of the table reads its member the same way.
function isString(value: unknown): value is string {

  return typeof value === "string";
}

function isBoolean(value: unknown): value is boolean {

  return typeof value === "boolean";
}

/* Each fact a report may state about its door, beside the guard that reads the fact's declared shape. The table is typed over every member of the entry but the
 * door's own identity, so a member added to the entry type without a row here fails to build, and it serves both halves of admission at once: the shape of every
 * member an entry carries, and whether it carries any fact at all. The classifier's suite reads its keys as the members an entry may carry.
 */
export const DOOR_STATE_FACT_GUARDS = {

  "alarms": isDoorStateAlarms,
  "dps": isString,
  "dps_connected": isBoolean,
  "emergency": isDoorStateEmergency,
  "is_unavailable": isBoolean,
  "lock": isString,
  "unlock_suspend": isDoorStateSuspend
} as const satisfies Record<Exclude<keyof AccessDoorStateEntry, "location_id">, (value: unknown) => boolean>;

// The table as rows, walked once per entry. Hoisted so admission allocates nothing on the packet path.
const DOOR_STATE_FACT_ROWS = Object.entries(DOOR_STATE_FACT_GUARDS);

/* The admission contract for door state, defined here and applied by both carriers. An entry is admitted when it names its door, states at least one fact about it,
 * and carries every fact it does state in the declared shape. Which facts a report states is the hardware's business: a door hub reports the whole record every
 * time, while hardware this library holds no capture of may report fewer members, so an entry is judged on what it carries rather than on what a hub would have
 * sent. An entry that names its door and states nothing is not a report: the reducer replaces a door's held entry with the one admitted, so admitting it would
 * erase what the door last said on the strength of a payload that said nothing.
 *
 * A malformed member rejects the whole entry rather than being dropped from it. That is the safer reading of the two, and the reasoning is about alarms: an entry
 * whose alarm data cannot be parsed says nothing about whether an alarm is in force, so admitting it without its alarms would report "no alarm" on the strength of
 * a payload we did not understand. Rejecting leaves whatever the door last cleanly reported standing until it reports cleanly again, which is a stale reading
 * rather than an invented one.
 */
function isDoorStateEntry(value: unknown): value is AccessDoorStateEntry {

  if(!isPlainObject(value) || (typeof value["location_id"] !== "string")) {

    return false;
  }

  let stated = false;

  for(const [ member, isShaped ] of DOOR_STATE_FACT_ROWS) {

    const fact = value[member];

    // A member the report does not carry is the hardware not reporting it, which is never a malformed report.
    if(fact === undefined) {

      continue;
    }

    if(!isShaped(fact)) {

      return false;
    }

    stated = true;
  }

  return stated;
}

/* A record without the members the dialect spells as null. On this wire null means not carried rather than cleared - the device translation copies it through
 * for the merge to read the same way - so a door-state member sent as null is the hardware not reporting it, and it leaves the entry here rather than landing in
 * the model as a value the entry type never holds. A record carrying no null member passes through as itself: the copy exists to leave members out, and a
 * report with nothing to leave out is admitted as delivered, the way every other wire record is stored.
 */
function withoutNullMembers(record: Record<string, unknown>): Record<string, unknown> {

  return Object.values(record).includes(null) ? Object.fromEntries(Object.entries(record).filter(([ , member ]) => member !== null)) : record;
}

/* Admit the entries of a device carrier's door-state array, or null when this packet is not one. Admission is per-entry: a mixed array contributes the entries that
 * pass and drops the rest, because a dropped entry's own door self-corrects on its next clean report while the entries beside it describe different doors entirely
 * and are not implicated. An array that contributes nothing - empty, or wholly unreadable - is reported as null so the caller falls through.
 */
function admitEntries(value: unknown): Nullable<readonly [AccessDoorStateEntry, ...AccessDoorStateEntry[]]> {

  if(!Array.isArray(value)) {

    return null;
  }

  const admitted: AccessDoorStateEntry[] = [];

  for(const entry of value) {

    // A non-record is not an entry at all; a record is read without the members the wire spelled as null, and admitted on what remains.
    if(!isPlainObject(entry)) {

      continue;
    }

    const candidate = withoutNullMembers(entry);

    if(isDoorStateEntry(candidate)) {

      admitted.push(candidate);
    }
  }

  return isNonEmpty(admitted) ? admitted : null;
}

/* Admit a location carrier's single state member, supplying the door identity from the envelope. The member carries every other entry field but names no door,
 * because the packet already does, so the entry is completed here rather than being admitted incomplete and repaired downstream.
 */
function admitEntry(value: unknown, locationId: string): Nullable<AccessDoorStateEntry> {

  if(!isPlainObject(value)) {

    return null;
  }

  const candidate = { ...withoutNullMembers(value), "location_id": locationId };

  return isDoorStateEntry(candidate) ? candidate : null;
}

// Whether an array has at least one member, expressed so the non-empty array type the door-state event declares is reached by a check rather than by assertion.
function isNonEmpty<T>(value: T[]): value is [T, ...T[]] {

  return value.length > 0;
}

// The packet's payload as a wire record, or undefined when the notification carried no payload or something other than an object. A removal legitimately carries no
// payload, so this returning undefined is not by itself a malformed packet.
function asRecord(data: AccessEventPacket["data"]): Record<string, AccessKnownJsonValue> | undefined {

  return isPlainObject(data) ? data : undefined;
}

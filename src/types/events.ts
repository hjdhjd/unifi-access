/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * events.ts: The UniFi Access realtime event types and the API response envelope.
 */
import type { Nullable } from "./common.ts";

/**
 * The UniFi Access realtime event surface: the notification packet the controller pushes over its websocket, the payloads carried on that stream - the doorbell
 * payloads and the per-door live state - and the response envelope the REST endpoints wrap their results in.
 *
 * @module AccessTypesEvents
 */

/**
 * A complete description of the UniFi Access notification events API packet format.
 *
 * A UniFi Access event packet is the representation of a notification event from a UniFi Access controller. The `event` property informs us of the notification type,
 * such as `access.data.device.remote_unlock` for door unlock events, and the details arrive as a JSON payload in the `data` property.
 *
 * `data` is deliberately unknown here rather than narrowed by event name. Recognizing an event and giving its payload a specific type is the protocol
 * layer's job, and doing it here would put a second, competing view of the same packet in the type tier.
 */
export interface AccessEventPacketInterface {

  // Raw payloads may be any parsed JSON value. Each event classifier owns its payload's shape, not the envelope guard.
  data: unknown;
  event: string;
  event_object_id: string;
  /* Present on the events that describe a change to a stored object, and absent from the rest. `target_field` names the fields that changed, and is `null` on the
   * majority of packets that carry meta at all - a whole-object update rather than a field-level one, which `all_field` also reports.
   */
  meta?: {

    all_field: boolean;
    id: string;
    object_type: string;
    source: string;
    target_field: Nullable<string[]>;
  };
  receiver_id: string;
  save_to_history: boolean;
}

/**
 * A description of the UniFi Access doorbell ring event data payload.
 *
 * The shape is verified against live captures on hub-class topology, a G2 Pro reader connected to a UAH door hub. Every required member arrives on both an older and a
 * current capture generation, while the optional members are the ones the current generation adds, so a consumer treats their absence as an ordinary payload rather
 * than a malformed one. Event shapes vary by door hub and reader type, and gate (UGT) topologies are unverified against any capture in hand, so a consumer running on
 * that hardware should expect the payload to differ from what is modeled here.
 */
export interface AccessEventDoorbellRingInterface {

  channel: string;
  clear_request_id: string;
  connected_uah_id: string;
  connected_uah_type: string;
  console_id?: string;
  controller_id: string;
  create_time: number;
  device_id: string;
  device_name: string;
  device_type: string;
  disable_pickup?: boolean;
  door_guard_ids: string[];
  door_id?: string;
  door_name: string;
  doorbell_channel?: string;
  floor_name: string;
  has_package_camera?: boolean;
  host_device_mac: string;
  hub_gate_door_mode?: string;
  in_or_out: string;
  is_camera?: boolean;
  is_double_driveway?: boolean;
  mutable_content?: boolean;
  reason_code: number;
  request_id: string;
  room_id: string;
  send_voip?: boolean;
  support_feature: string[];
  template_id?: string;
  token: string;
  unlocking_not_allowed?: boolean;
}

/**
 * A description of the UniFi Access doorbell ring cancel event data payload, verified against live captures: a cancellation carries exactly the members declared here
 * and nothing besides. `remote_call_request_id` repeats the `request_id` of the {@link AccessEventDoorbellRingInterface} it ends, which is how a consumer pairs a
 * cancellation with the call it belongs to.
 */
export interface AccessEventDoorbellCancelInterface {

  reason_code: number;
  remote_call_request_id: string;
}

/**
 * A description of the UniFi Access tamper alert event data payload, verified against live captures: an alert carries exactly the members declared here and nothing
 * besides. `device` names the hardware that raised it, which is the identity the alert is attributed to, and `title` is the controller's own notification headline.
 *
 * There is deliberately no verdict here, because the wire carries none. The payload says that an alert was raised and names what raised it; what the hardware
 * currently reports lives on that device's own configuration row, and a consumer wanting it reads the state rather than inferring it from this.
 */
export interface AccessEventTamperAlertInterface {

  device: {

    device_type: string;
    firmware: string;
    guid: string;
    is_connected: boolean;
    mac: string;
    name: string;
    unique_id: string;
  };
  door_id: string;
  door_name: string;
  host_device_mac: string;
  notify_user_ids: string[];
  request_id: string;
  title: string;
}

/**
 * A description of one door's live state, as the controller reports it on its newer notification dialect. Verified against live captures: a door hub sends an array of
 * these under `location_states` on a device update, and a door location sends the identical shape as its `state` member on a location update.
 *
 * `lock` and `dps` are the two members a consumer reads first. `lock` reports the lock's own condition, observed as `locked` and `unlocked`. `dps` reports the door
 * position sensor, observed as `close`, `open`, and `none` - the last on a door whose sensor is not wired, which is also what `dps_connected` reports as `false`.
 * Both vocabularies are open strings the controller chooses rather than closed unions, because a hub class this library has never seen may report a value neither
 * capture generation carries, and a closed union would make that value unrepresentable rather than merely unfamiliar.
 *
 * The alarm and suspension members reflect per-hub-class presence rather than a sparse payload: a door reporting no alarm and no suspension omits them entirely, and
 * the same door carries them on a later report when the condition arises. A consumer therefore reads their absence as "no alarm" and "not suspended".
 *
 * Every member but the door's own identity is optional, which describes what an entry's source established rather than a sparse wire. A door hub reports the whole
 * record on every notification, so an entry born from one of its reports carries them all, while hardware this library holds no capture of may report fewer members and
 * its entries carry what it sent. An entry can also be seeded at connect from what a controller's other surfaces answer about a door, and those surfaces answer less:
 * hardware flags establish position only where a sensor is wired, and the official API knows nothing about wiring at all. Requiring a member would force such an entry
 * to invent a value for something nothing asked, so an entry states what its source established and stays silent on the rest. A consumer therefore reads an absent
 * member as "not established", distinct from a `dps` of `none` or an `is_unavailable` of `false`, which are the controller positively reporting a condition.
 */
export interface AccessDoorStateEntryInterface {

  alarms?: AccessDoorStateAlarmInterface[];
  dps?: string;
  dps_connected?: boolean;
  emergency?: AccessDoorStateEmergencyInterface;
  is_unavailable?: boolean;
  location_id: string;
  lock?: string;
  unlock_suspend?: AccessDoorStateSuspendInterface;
}

/**
 * A description of one alarm a door reports. The vocabulary is open: `force_unlock` - the door held open past its relock - is the one value in hand across every
 * capture, so a closed union would be a guess about what else the controller can raise rather than a description of what it does.
 */
export interface AccessDoorStateAlarmInterface {

  type: string;
}

/**
 * A description of a door's emergency condition, reported as the two independent sources that can raise one. `hardware` is a physical emergency input wired to the
 * hub; `software` is a controller-issued emergency state. Both are open strings, observed as `none` when no emergency is in force.
 */
export interface AccessDoorStateEmergencyInterface {

  hardware: string;
  software: string;
}

/**
 * A description of a door's unlock suspension - the controller's own record of a scheduled unlock that was suspended. `status` reports where the suspension stands
 * and `unlock_type` names the unlock it applies to, both open strings, and both observed empty or `end` on a door with nothing suspended.
 */
export interface AccessDoorStateSuspendInterface {

  status: string;
  unlock_type: string;
}

/**
 * The one result envelope the controller's application writes on both of its surfaces, in the native dialect: a numeric `code` carrying the `CODE_*` vocabulary
 * string beside it in `codeS`.
 *
 * Those two members are the only ones anything verifies, because together they are what identifies the envelope. Every other member is declared as the controller
 * leaves it, unverified and typed as `unknown`, and is read defensively by whoever consumes it. `code`, `codeS`, `msg` and `error` arrive on every capture in hand;
 * `data` only on the ones that reported success, a refusal carrying none at all; `cloud_code` on the direct refusal captured on 2026-09-16, and `source` on the
 * official refusal captured on 2026-09-15, each an empty string there and read by nothing. `pagination` is declared because either dialect can answer either
 * outcome and the official listing endpoints report a page beside their results, no native page report having been observed.
 *
 * Note that the authenticated user endpoint does not use this envelope at all - it returns {@link AccessUserConfigInterface} as the entire response body.
 */
export interface AccessApiResponseInterface {

  cloud_code?: unknown;
  code: number;
  codeS: string;
  data?: unknown;
  error?: unknown;
  msg?: unknown;
  pagination?: unknown;
  source?: unknown;
}

/** @see {@link AccessApiResponseInterface} */
export type AccessApiResponse = AccessApiResponseInterface;

/** @see {@link AccessDoorStateAlarmInterface} */
export type AccessDoorStateAlarm = AccessDoorStateAlarmInterface;

/** @see {@link AccessDoorStateEmergencyInterface} */
export type AccessDoorStateEmergency = AccessDoorStateEmergencyInterface;

/** @see {@link AccessDoorStateEntryInterface} */
export type AccessDoorStateEntry = AccessDoorStateEntryInterface;

/** @see {@link AccessDoorStateSuspendInterface} */
export type AccessDoorStateSuspend = AccessDoorStateSuspendInterface;

/** @see {@link AccessEventDoorbellCancelInterface} */
export type AccessEventDoorbellCancel = AccessEventDoorbellCancelInterface;

/** @see {@link AccessEventDoorbellRingInterface} */
export type AccessEventDoorbellRing = AccessEventDoorbellRingInterface;

/** @see {@link AccessEventPacketInterface} */
export type AccessEventPacket = AccessEventPacketInterface;

/** @see {@link AccessEventTamperAlertInterface} */
export type AccessEventTamperAlert = AccessEventTamperAlertInterface;

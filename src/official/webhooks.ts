/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * webhooks.ts: The official API's webhook deliveries - the payload each event carries, and the signature that proves the controller sent it.
 */
import type { AccessKnownJsonValue, Nullable } from "../types/index.ts";
import type { AccessOfficialCallOptions, OfficialDispatch, OfficialDomainOptions } from "./dispatch.ts";
import { createHmac, timingSafeEqual } from "node:crypto";
import { isRecord } from "../json.ts";
import { officialEndpoint } from "./endpoints.ts";

/**
 * What the controller sends to a registered webhook endpoint, and how to establish that it really was the controller.
 *
 * A webhook delivery is the richest description the controller offers of what happened: where the socket disperses an unlock through a log record, the webhook
 * names the authentication method, the result, the policy and reader involved, and who it is attributed to, as first-class members of one payload. That is what
 * these types model.
 *
 * The listener is deliberately not here. Receiving a delivery means binding a port and serving HTTP, which is a deployment decision belonging to whatever is
 * consuming this library - a plugin that already owns an HTTP surface should serve webhooks on it, not on a second one a library opened. What the library owes such
 * a consumer is the shape of what arrives and a way to trust it, and that is exactly what is below.
 *
 * @module AccessWebhooks
 */

// The members of the delivery's signature header this scheme reads: `t` names the unix timestamp the signature covers, and `v1` carries the hex-encoded MAC.
const SIGNATURE_MAC_KEY = "v1";
const SIGNATURE_TIMESTAMP_KEY = "t";

/**
 * The door, floor, or building a delivery concerns, as the webhook channel describes it.
 *
 * `extras` is where a UA Hub reports its door's position, under the `uah-input_state_dps` and `uah-wiring_state_dps` members; a UA Hub Door Mini reports the same
 * condition on its device record instead and sends an empty object here, so an empty `extras` says nothing about whether the door has a position sensor.
 *
 * @category Official
 */
export interface AccessWebhookLocation {

  readonly device_ids: Nullable<string[]>;
  readonly extras: Readonly<Record<string, AccessKnownJsonValue>>;
  readonly id: string;
  readonly location_type: string;
  readonly name: string;
  readonly up_id: string;
}

/**
 * The device a delivery concerns, as the webhook channel describes it.
 *
 * The member names are the newer notification dialect's rather than the topology document's - `id` and `online` where the topology document says `unique_id` and
 * `is_online` - so this is its own record rather than a projection of one the library already models.
 *
 * @category Official
 */
export interface AccessWebhookDevice {

  readonly adopting: boolean;
  readonly alias: string;
  readonly cap: AccessKnownJsonValue;
  readonly category: AccessKnownJsonValue;
  readonly connected_hub_id: string;
  readonly device_type: string;
  readonly firmware: string;
  readonly guid: string;
  readonly hw_type: string;
  readonly id: string;
  readonly ip: string;
  readonly location_id: string;
  readonly mac: string;
  readonly name: string;
  readonly online: boolean;
  readonly revision: string;
  readonly start_time: number;
  readonly version: string;
}

/**
 * Who an action is attributed to, when the controller attributes it to anyone.
 *
 * `type` is the raw wire value, and the webhook channel spells the API-caller actor with a hyphen where the notification socket spells it with an underscore. Pass
 * it through {@link normalizeActorType} to read one spelling for the one concept rather than branching on which channel delivered the record.
 *
 * @category Official
 */
export interface AccessWebhookActor {

  readonly id: string;
  readonly name: string;
  readonly type: string;
}

/**
 * The body of a webhook delivery: the event's name, the identifier the controller minted for this delivery, and the payload.
 *
 * Every delivery carries the same payload members - the location, the device, the actor, and an `object` whose shape is the event's own. The location is always
 * present; the device is not, because an event raised by something other than a device names none; and the actor is present only where the controller attributes
 * the action to someone, which it does not for a doorbell press or a sensor transition.
 *
 * @typeParam TEvent  - The event name, which is what tells the members of {@link AccessWebhookEvent} apart.
 * @typeParam TObject - The event-specific payload.
 *
 * @category Official
 */
export interface AccessWebhookDelivery<TEvent extends string, TObject> {

  readonly data: {

    readonly actor: Nullable<AccessWebhookActor>;
    readonly device: Nullable<AccessWebhookDevice>;
    readonly location: AccessWebhookLocation;
    readonly object: TObject;
  };
  readonly event: TEvent;
  readonly event_object_id: string;
}

/**
 * What an unlock delivery reports: how the door was opened, whether it opened, and on whose behalf.
 *
 * `actor_id`, `actor_name`, and `extra` are present only on an unlock the official API performed with attribution supplied - they are exactly what the unlock
 * endpoint accepts and echoes back here, which is what makes an automated unlock legible in the controller's own records as the automation rather than as the
 * account it signed in with. An unlock from any other source carries none of them.
 *
 * `authentication_type` reads through {@link ACCESS_AUTHENTICATION_TYPES} when the value is being shown to a person, and a token that table does not name is
 * shown as the wire delivered it.
 *
 * Live-verified.
 *
 * @category Official
 */
export interface AccessWebhookDoorUnlockObject {

  readonly actor_id?: string;
  readonly actor_name?: string;
  readonly authentication_type: string;
  readonly authentication_value: string;
  readonly extra?: Readonly<Record<string, AccessKnownJsonValue>>;
  readonly policy_id: string;
  readonly policy_name: string;
  readonly reader_id: string;
  readonly result: string;
  readonly time: string;
}

/**
 * What a doorbell-ring delivery reports: the identifier of the call that is beginning.
 *
 * That identifier is the join key across channels - the notification socket names the same call as `remote_call_request_id` when it ends - so a consumer reading
 * both channels can correlate them on it.
 *
 * Live-verified.
 *
 * @category Official
 */
export interface AccessWebhookDoorbellIncomingObject {

  readonly request_id: string;
}

/**
 * What a doorbell-completed delivery reports: which call ended, and why.
 *
 * `reason_code` reads through {@link ACCESS_DOORBELL_REASON_CODES}, which carries the corrected meaning of the one code whose documented gloss the wire
 * contradicts.
 *
 * Live-verified.
 *
 * @category Official
 */
export interface AccessWebhookDoorbellCompletedObject {

  readonly host_device_mac: string;
  readonly reason_code: number;
  readonly request_id: string;
}

/**
 * What a request-to-enter delivery reports. The shape is the completed-call one, on a delivery that names no device: a request-to-enter button is wired to the
 * hub rather than being a device the controller adopted.
 *
 * Documentation-derived: no capture in hand exercises this event.
 *
 * @category Official
 */
export interface AccessWebhookDoorbellRenObject {

  readonly host_device_mac: string;
  readonly reason_code: number;
  readonly request_id: string;
}

/**
 * What a door-position delivery reports: which way the door moved.
 *
 * This is the plainest of the ways the controller describes door position - the notification socket carries the same condition inside a per-door state array, and
 * the older dialect hides it in a wiring flag whose polarity is inverted against the semantic state. The controller delivers it for hardware beyond what its own
 * changelog scopes it to, so a consumer should not decide from that list whether to expect it.
 *
 * Live-verified.
 *
 * @category Official
 */
export interface AccessWebhookDpsStatusObject {

  readonly event_type: "dps_change";
  readonly status: "close" | "open";
}

/**
 * What an emergency-status delivery reports: which emergency mode changed, whether it is now in force, and whether it applies to the whole site.
 *
 * Documentation-derived: no capture in hand exercises this event.
 *
 * @category Official
 */
export interface AccessWebhookEmergencyStatusObject {

  readonly glocal: boolean;
  readonly mode: "evacuation" | "lockdown";
  readonly value: boolean;
}

/**
 * The payload of an event the reference names in its webhook vocabulary without publishing a sample of it, and which no capture in hand has exercised.
 *
 * These deliveries carry the same location, device, and actor members as every other, so only the event-specific member is unknown - and it is left as the open
 * record it genuinely is, rather than being invented from the event's name. A consumer reading one of these narrows it itself; when a capture settles a shape, it
 * replaces this with the same evidence discipline every other type here follows.
 *
 * @category Official
 */
export type AccessWebhookUnmodeledObject = Readonly<Record<string, AccessKnownJsonValue>>;

/**
 * Every webhook event the controller can be registered for, as a discriminated union on `event`.
 *
 * A consumer switches on `event` and receives the matching payload with no cast. Four of the members are live-verified against deliveries from a real controller;
 * the rest are derived from the reference, and each says which it is in its own documentation, so nothing here presents a documented guess as an observation.
 *
 * @category Official
 */
export type AccessWebhookEvent =
  AccessWebhookDelivery<"access.device.dps_status", AccessWebhookDpsStatusObject> |
  AccessWebhookDelivery<"access.device.emergency_status", AccessWebhookEmergencyStatusObject> |
  AccessWebhookDelivery<"access.door.unlock", AccessWebhookDoorUnlockObject> |
  AccessWebhookDelivery<"access.doorbell.completed", AccessWebhookDoorbellCompletedObject> |
  AccessWebhookDelivery<"access.doorbell.incoming", AccessWebhookDoorbellIncomingObject> |
  AccessWebhookDelivery<"access.doorbell.incoming.REN", AccessWebhookDoorbellRenObject> |
  AccessWebhookDelivery<"access.temporary_unlock.end", AccessWebhookUnmodeledObject> |
  AccessWebhookDelivery<"access.temporary_unlock.start", AccessWebhookUnmodeledObject> |
  AccessWebhookDelivery<"access.unlock_schedule.activate", AccessWebhookUnmodeledObject> |
  AccessWebhookDelivery<"access.unlock_schedule.deactivate", AccessWebhookUnmodeledObject> |
  AccessWebhookDelivery<"access.visitor.status.changed", AccessWebhookUnmodeledObject>;

/**
 * What a verified signature established: the moment the controller signed the delivery, as the unix timestamp in seconds the header's `t` member carried and the
 * MAC covered. A receiver compares it against its own clock to apply whatever freshness window its policy calls for.
 *
 * @category Official
 */
export interface AccessWebhookSignature {

  readonly timestamp: number;
}

/**
 * Establish that a webhook delivery really came from the controller that holds this endpoint's secret, and answer with what its signature established.
 *
 * The scheme is the controller's, verified end to end against live deliveries: the `Signature` header carries a unix timestamp and a hex-encoded MAC, and the MAC
 * is HMAC-SHA256 over the timestamp's decimal digits, a literal `.`, and the request body exactly as it arrived. The body must therefore be the raw bytes or the
 * raw text - a body that has been parsed and re-serialized will not verify, because re-serializing is free to change whitespace and key order that the MAC covered.
 *
 * There is no freshness check here, and that is deliberate on two grounds. Comparing a timestamp against the present needs a clock, which would make this function
 * impure and put it at odds with how every other time-dependent thing in this library takes its clock by injection. And how old is too old is a policy question
 * with no library-wide answer: a consumer that queues deliveries tolerates minutes, one that acts on them immediately tolerates seconds. So the validated
 * timestamp is handed back instead, and a receiver applies its own window to it without re-parsing a header this function has already read and authenticated.
 *
 * Every failure is a clean `null` rather than a throw - a malformed header, an absent signature, a truncated MAC, and a MAC that simply does not match are all
 * "this did not come from the controller", and a receiver handling untrusted input should not have to distinguish them to stay safe.
 *
 * The other half, for a consumer's own tests, is `signWebhookDelivery` on the `unifi-access/testing` entry: it mints the header this function verifies, from the
 * same recipe, so a suite can hand its receiver a delivery that verifies without restating the scheme.
 *
 * @param opts        - The delivery to verify.
 * @param opts.body   - The request body exactly as received, as bytes or as text.
 * @param opts.header - The delivery's `Signature` header value.
 * @param opts.secret - The secret the controller minted when the endpoint was registered.
 *
 * @returns What the signature established when it is authentic, and `null` for every other outcome.
 *
 * @category Official
 */
export function verifyWebhookSignature(opts: { body: Uint8Array | string; header: string; secret: string }): Nullable<AccessWebhookSignature> {

  const signature = parseSignatureHeader(opts.header);

  if(signature === null) {

    return null;
  }

  const expected = signatureMac(opts.secret, signature.timestamp, opts.body);
  const provided = Buffer.from(signature.mac, "hex");

  /* The length check is what turns a truncated or malformed MAC into a clean `false`. Hex decoding a short or invalid value simply yields a shorter buffer, and the
   * constant-time comparison throws on operands of different lengths rather than returning false - so without this gate a truncated signature would raise an
   * exception at exactly the moment a receiver is handling input it does not trust.
   */
  if(provided.length !== expected.length) {

    return null;
  }

  return timingSafeEqual(provided, expected) ? { timestamp: Number(signature.timestamp) } : null;
}

/**
 * Sign a delivery the way the controller does, answering with the `Signature` header value a receiver verifies.
 *
 * This is the other half of {@link verifyWebhookSignature}, composed from the same recipe so the two cannot drift: a consumer's test suite hands its webhook
 * receiver a delivery that verifies, without restating the scheme in its own words. It is published through the `unifi-access/testing` entry rather than the
 * main surface, because minting controller signatures is a test's business and never production's - nothing in this library's production code calls it.
 *
 * @param opts           - The delivery to sign.
 * @param opts.body      - The request body exactly as it will be delivered, as bytes or as text.
 * @param opts.secret    - The secret the endpoint was registered with.
 * @param opts.timestamp - The unix timestamp in seconds the signature covers, a non-negative whole number.
 *
 * @returns The `Signature` header value: the timestamp and the hex-encoded MAC in the controller's own form.
 *
 * @throws {TypeError} If the timestamp is not a non-negative whole number - caller misuse, raised before anything is signed.
 *
 * @category Testing
 */
export function signWebhookDelivery(opts: { body: Uint8Array | string; secret: string; timestamp: number }): string {

  // A caller's own bad argument is a programming error rather than anything about a delivery, so it raises the language's own error type before any signing.
  if(!Number.isSafeInteger(opts.timestamp) || (opts.timestamp < 0)) {

    throw new TypeError("A webhook signature's timestamp must be a non-negative whole number of seconds.");
  }

  const timestamp = String(opts.timestamp);

  return SIGNATURE_TIMESTAMP_KEY + "=" + timestamp + "," + SIGNATURE_MAC_KEY + "=" + signatureMac(opts.secret, timestamp, opts.body).toString("hex");
}

/**
 * The name of an event an endpoint can be registered for.
 *
 * This is derived by indexing the delivery union rather than by respelling its names, so the set a caller may register for and the set they may receive stay one
 * vocabulary: adding a delivery type extends the registration surface with it, and a name that is not a delivery cannot be registered at all.
 *
 * @category Official
 */
export type AccessOfficialWebhookEventName = AccessWebhookEvent["event"];

/* The delivery vocabulary as a runtime set. The literal it is built from is checked against the union's own name member in both directions - a name the union
 * lacks is an excess property and a name it carries but this omits is a missing one - so the guard can never admit a name the union does not model or refuse one
 * it does, and this literal is the one place the vocabulary is spelled outside the union itself.
 */
const WEBHOOK_EVENT_NAMES: ReadonlySet<string> = new Set(Object.keys({

  "access.device.dps_status": true,
  "access.device.emergency_status": true,
  "access.door.unlock": true,
  "access.doorbell.completed": true,
  "access.doorbell.incoming": true,
  "access.doorbell.incoming.REN": true,
  "access.temporary_unlock.end": true,
  "access.temporary_unlock.start": true,
  "access.unlock_schedule.activate": true,
  "access.unlock_schedule.deactivate": true,
  "access.visitor.status.changed": true
} satisfies Record<AccessOfficialWebhookEventName, true>));

/**
 * Whether a decoded value is shaped like an {@link AccessWebhookEvent}. This is the decode boundary a receiver needs: a delivery arrives as untrusted JSON on the
 * receiver's own HTTP surface, and asserting the parsed value into the delivery union would let any valid-JSON body through to a `switch` on `event`.
 *
 * The checked members are the envelope every delivery shares: `event` must be a name the union carries, `event_object_id` a string, and `data` a record whose
 * `location` and `object` are records and whose `device` and `actor` are present as either a record or `null`. The event-specific shape under `object` is
 * deliberately not checked, on the same terms as the notification packet guard: the envelope is what a receiver switches on, the union's arms describe what each
 * event's object carries, and the open records carry whatever the controller sends.
 *
 * @param value - A decoded value of unknown shape, typically the parsed body of a delivery whose signature {@link verifyWebhookSignature} has established.
 *
 * @returns `true` when the value carries the envelope a delivery carries.
 *
 * @category Official
 */
export function isAccessWebhookDelivery(value: unknown): value is AccessWebhookEvent {

  if(!isRecord(value)) {

    return false;
  }

  const data = value["data"];

  if(!WEBHOOK_EVENT_NAMES.has(value["event"] as string) || (typeof value["event_object_id"] !== "string") || !isRecord(data)) {

    return false;
  }

  // The two nullable carriers are checked for PRESENCE as well as shape, because a delivery that omitted one is a different thing from one that named it null,
  // and only the second is something the controller sends.
  for(const member of [ "actor", "device" ]) {

    if(!(member in data) || ((data[member] !== null) && !isRecord(data[member]))) {

      return false;
    }
  }

  return isRecord(data["location"]) && isRecord(data["object"]);
}

/**
 * A registered webhook endpoint.
 *
 * `secret` is what {@link verifyWebhookSignature} takes to establish that a delivery really came from this controller. It is returned on every read and write, so
 * it can be re-read rather than having to be captured at registration.
 *
 * The field description calls `endpoint` an HTTPS URL, but the controller accepts and delivers to a plain `http://` endpoint without complaint - transport security
 * here is the receiver's responsibility rather than something the controller enforces.
 *
 * Live-verified.
 *
 * @category Official
 */
export interface AccessOfficialWebhookEndpoint {

  readonly endpoint: string;
  readonly events: readonly AccessOfficialWebhookEventName[];
  readonly headers?: Readonly<Record<string, string>>;
  readonly id: string;
  readonly name: string;
  readonly secret: string;
}

/**
 * Register or replace a webhook endpoint. The update endpoint takes the same full record rather than a partial one, so this shape serves both.
 *
 * `headers` are sent with every delivery to this endpoint, which is how a receiver behind its own authentication is reached.
 *
 * @category Official
 */
export interface AccessOfficialWebhookEndpointWrite {

  endpoint: string;
  events: readonly AccessOfficialWebhookEventName[];
  headers?: Readonly<Record<string, string>>;
  name: string;
}

/**
 * The official API's webhook administration: the endpoints the controller delivers to.
 *
 * This is the registration half of the webhook domain; the delivery shapes above and {@link verifyWebhookSignature} are what a consumer uses once deliveries start
 * arriving at whatever it registered.
 */
export class OfficialWebhooks {

  readonly #dispatch: OfficialDispatch;
  readonly #host: string;

  constructor(options: OfficialDomainOptions) {

    this.#dispatch = options.dispatch;
    this.#host = options.host;
  }

  /**
   * Fetch every registered webhook endpoint. `GET /webhooks/endpoints`, permission `view:webhook`. Requires UniFi Access 2.2.10 or later.
   *
   * Live-verified.
   *
   * @param call - The per-call options - an optional abort signal.
   *
   * @returns Every registered endpoint, each with its secret.
   */
  async fetchAllEndpoints(call: AccessOfficialCallOptions = {}): Promise<AccessOfficialWebhookEndpoint[]> {

    return (await this.#dispatch.request<AccessOfficialWebhookEndpoint[]>(officialEndpoint(this.#host, "/webhooks/endpoints"), {}, call)).data;
  }

  /**
   * Register a webhook endpoint. `POST /webhooks/endpoints`, permission `edit:webhook`. Requires UniFi Access 2.2.10 or later.
   *
   * The controller mints the endpoint's signing secret here and returns it on this response. It is also readable afterwards, so it does not have to be captured
   * from this call alone.
   *
   * Live-verified.
   *
   * @param opts - The endpoint to register and the events to send it.
   * @param call - The per-call options - an optional abort signal.
   *
   * @returns The registered endpoint, including its minted secret.
   */
  async createEndpoint(opts: AccessOfficialWebhookEndpointWrite, call: AccessOfficialCallOptions = {}): Promise<AccessOfficialWebhookEndpoint> {

    return (await this.#dispatch.request<AccessOfficialWebhookEndpoint>(officialEndpoint(this.#host, "/webhooks/endpoints"),
      { json: opts, method: "POST" }, call)).data;
  }

  /**
   * Replace a registered webhook endpoint. `PUT /webhooks/endpoints/:id`, permission `edit:webhook`. Requires UniFi Access 2.2.10 or later.
   *
   * Documentation-derived.
   *
   * @param id   - The endpoint's identifier.
   * @param opts - The full record to replace it with.
   * @param call - The per-call options - an optional abort signal.
   *
   * @returns The updated endpoint.
   */
  async updateEndpoint(id: string, opts: AccessOfficialWebhookEndpointWrite, call: AccessOfficialCallOptions = {}): Promise<AccessOfficialWebhookEndpoint> {

    return (await this.#dispatch.request<AccessOfficialWebhookEndpoint>(officialEndpoint(this.#host, "/webhooks/endpoints/" + encodeURIComponent(id)),
      { json: opts, method: "PUT" }, call)).data;
  }

  /**
   * Unregister a webhook endpoint. `DELETE /webhooks/endpoints/:id`, permission `edit:webhook`. Requires UniFi Access 2.2.10 or later.
   *
   * Live-verified.
   *
   * @param id   - The endpoint's identifier.
   * @param call - The per-call options - an optional abort signal.
   */
  async deleteEndpoint(id: string, call: AccessOfficialCallOptions = {}): Promise<void> {

    await this.#dispatch.command(officialEndpoint(this.#host, "/webhooks/endpoints/" + encodeURIComponent(id)), { method: "DELETE" }, call);
  }
}

/* The MAC the scheme puts over a delivery: HMAC-SHA256 over the timestamp's decimal digits, a literal `.`, and the body exactly as delivered, fed to the digest
 * separately rather than concatenated first so that a byte body never has to be decoded to text - a delivery is bytes on the wire, and decoding it to compare it
 * would be one more chance to alter what was signed. The verifier and the signing helper both read this one recipe, which is what keeps them from drifting.
 */
function signatureMac(secret: string, timestamp: string, body: Uint8Array | string): Buffer {

  return createHmac("sha256", secret).update(timestamp).update(".").update(body).digest();
}

/* Read the members the signature header carries. Returns null for a header that is not the documented comma-separated, `=`-delimited form, or that lacks
 * either member, or whose timestamp is not the decimal integer the MAC covers.
 *
 * Members the scheme does not define are read and ignored rather than rejected. The header's shape is a list of versioned parts, so a controller that one day signs
 * with a second algorithm alongside this one would send its MAC as an additional member - and a verifier that rejected the whole header for carrying one would stop
 * verifying deliveries it is perfectly able to verify.
 */
function parseSignatureHeader(header: string): { mac: string; timestamp: string } | null {

  const members: Record<string, string> = {};

  for(const part of header.split(",")) {

    const separator = part.indexOf("=");

    // A part carrying no delimiter is not this header, and reading the rest of it would be reading something else.
    if(separator === -1) {

      return null;
    }

    members[part.slice(0, separator).trim()] = part.slice(separator + 1).trim();
  }

  const mac = members[SIGNATURE_MAC_KEY];
  const timestamp = members[SIGNATURE_TIMESTAMP_KEY];

  if((mac === undefined) || (timestamp === undefined) || !(/^\d+$/).test(timestamp)) {

    return null;
  }

  return { mac, timestamp };
}

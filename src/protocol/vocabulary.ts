/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * vocabulary.ts: The cross-channel wire vocabulary - the actor-type spellings folded into one, the hardware address spelled one way, what a doorbell's reason
 * codes actually mean, what an unlock's authentication types say in plain English, and the access methods named once with the keys each write path spells them by,
 * the tag their configuration rows are filed under, and the yes-or-no pair every surface states them in.
 */

/**
 * The translations the controller's own inconsistencies make necessary, owned here so that no consumer has to know which channel delivered a record in order to
 * read it.
 *
 * This is protocol-tier rather than official-tier material even though the webhook is where half of it was observed: the values arrive on the notification socket
 * as much as on the webhook, and the protocol tier is where the wire vocabulary lives. Placing it above the protocol tier would make protocol-tier consumers reach
 * upward for the vocabulary they themselves speak.
 *
 * @module AccessVocabulary
 */

// The spelling the webhook channel uses for the API-caller actor, where every other channel spells the same concept with an underscore.
const ACTOR_TYPE_WEBHOOK_API = "open-api";

/**
 * Who or what an action is attributed to.
 *
 * Two members are named because the controller uses them to draw the one distinction a consumer most often cares about: `user` is a human operating the controller
 * or one of its readers, and `open_api` is a caller acting through the official API. An unlock's actor is what tells those apart, which is what makes attributed
 * unlocking worth anything - a log that reads as the automation that acted rather than as the account it authenticated with.
 *
 * The vocabulary is open beyond those because no source enumerates it. A closed union would be a claim about what else the controller can attribute an action to,
 * where this is a description of the values that have been seen and typed.
 *
 * @category Protocol
 */
export type AccessActorType = "open_api" | "user" |

  // The open arm. Intersecting with the empty object type preserves the literals above, which a bare `| string` would absorb along with their autocomplete and
  // their narrowing.
  (string & {});

/**
 * Fold an actor type into the library's single spelling of it.
 *
 * The controller spells the API-caller actor two ways for one concept: with an underscore on the notification socket and with a hyphen on the webhook. Underscore
 * is the spelling this library carries, because it is what the socket sends and because it matches how every other value on this wire is spelled. Everything else
 * passes through untouched - this folds a known split rather than filtering a vocabulary it does not own.
 *
 * @param actorType - The actor type exactly as the channel spelled it.
 *
 * @returns The actor type in the library's spelling.
 *
 * @category Protocol
 */
export function normalizeActorType(actorType: string): AccessActorType {

  return (actorType === ACTOR_TYPE_WEBHOOK_API) ? "open_api" : actorType;
}

/* The shapes a hardware address is written in: the six pairs joined by colons, the twelve digits run together, the six pairs joined by hyphens, and the three quads
 * joined by dots. Only the first two come from the controller - either arrives in either case, and the same device can arrive in both cases from one read to the
 * next - while the hyphen and dot spellings are what other tools and operators write, recognized here so that a value a consumer hands in folds the same way the
 * wire's own does.
 */
const MAC_ADDRESS = /^(?:[0-9a-f]{2}:){5}[0-9a-f]{2}$|^(?:[0-9a-f]{2}-){5}[0-9a-f]{2}$|^(?:[0-9a-f]{4}\.){2}[0-9a-f]{4}$|^[0-9a-f]{12}$/i;

/**
 * Whether a value is a hardware address. The accepted spellings are the six pairs joined by colons, the twelve digits run together, the six pairs joined by
 * hyphens, and the three quads joined by dots, in either case.
 *
 * The official API's device identifier is the address with its separators removed, so this is also the test for whether an identifier licenses an address at all:
 * the controller addresses camera-class hardware by an identifier that is not one.
 *
 * @param value - The value exactly as a channel carried it.
 *
 * @returns `true` when the value is a hardware address, in any of the four spellings and either case.
 *
 * @category Protocol
 */
export function isMacAddress(value: string): boolean {

  return MAC_ADDRESS.test(value);
}

/**
 * Fold a hardware address into the library's single spelling of it: uppercase, with no separators. Every spelling {@link isMacAddress} accepts folds the same way,
 * whether the digits are joined by colons, by hyphens, by dots, or by nothing at all.
 *
 * The controller spells one device's address with the case varying from record to record and from one read to the next, and the official API carries it with the
 * separators removed. Uppercase without separators is the spelling this library carries because it is the spelling the companion UniFi Protect controller and its
 * library carry verbatim from their own wire, so a consumer serving both families keys every device one way, and because one spelling is the whole point: a
 * consumer keyed on an address must never be re-keyed by the wire's case. A value that is not an address passes through untouched - this folds a known split rather
 * than filtering a vocabulary it does not own. An address a channel hands a consumer directly - a doorbell ring's host device, a webhook's device - is folded the
 * same way by the consumer that reads it.
 *
 * @param value - The address exactly as a channel spelled it.
 *
 * @returns The address in the library's spelling, or the value unchanged when it is not an address.
 *
 * @category Protocol
 */
export function normalizeMacAddress(value: string): string {

  return MAC_ADDRESS.test(value) ? value.replaceAll(/[:.-]/g, "").toUpperCase() : value;
}

/**
 * What each of a doorbell call's reason codes means, in words fit to show a person.
 *
 * Four of these carry the controller documentation's own meaning. The fifth, `400`, does not: the reference glosses it as the call having been answered by another
 * administrator, and a live call answered by the very person subscribed to the notification carried it anyway. Read the documented way the code would state a
 * falsehood about who acted, so what it actually reports is narrower - the call was answered somewhere other than here, which may well be somewhere else the same
 * person is signed in. That is the meaning carried below, and it is the one row whose wording departs from the reference.
 *
 * The type is keyed by plain `number` so that a reason code read off a payload indexes it directly, and a code outside the documented set reads as absent rather
 * than as a compile error. Absence is a real answer: the controller sends `0` on a call that is merely beginning, and nothing here should invent a meaning for it.
 *
 * @category Protocol
 */
export const ACCESS_DOORBELL_REASON_CODES: Readonly<Record<number, string>> = {

  105: "The call timed out.",
  106: "An administrator declined the unlock.",
  107: "An administrator unlocked the door.",
  108: "The visitor canceled the call.",
  400: "The call was answered somewhere other than here."
};

/**
 * What each of an unlock's authentication types means, in words fit to show a person.
 *
 * The controller reports how a door was opened as a bare token, and every channel that describes an unlock speaks the same vocabulary: the webhook's unlock
 * payload, the notification socket's log records, the official socket's doorbell-answer record, and the official system-logs endpoint. `WAVE` reads as the
 * controller's own display of the gesture does, which its log line states as "Access Granted (Hand)".
 *
 * Each meaning is a lowercase phrase fragment with no terminal punctuation, because these are written to sit inside a sentence the consumer composes - "unlocked
 * by Homebridge (remote command through the hub)" - where {@link ACCESS_DOORBELL_REASON_CODES} states standalone sentences because a reason code renders alone.
 * Rendering for a person is the whole of what this table is for: a protocol decision reads the token itself, and the token is what stays in anything
 * machine-facing.
 *
 * Absence is a real answer, so there is no fallback row. A token outside the set below reads as absent and a consumer shows the spelling the wire sent rather
 * than a meaning this library invented for it...the set is bounded by what captures have shown rather than by what the reference documents, which enumerates none
 * of this vocabulary, so a row arrives here when a capture shows the spelling and never by speculation about what else a reader might report.
 *
 * The keys are the uppercase spelling, which is what the webhook, the socket's `access.logs.add` frames, and the official system-logs endpoint all deliver. The
 * socket's `access.logs.insights.add` frames spell the same vocabulary lowercase, so a consumer reading that one channel folds case before looking a token up.
 *
 * @category Protocol
 */
export const ACCESS_AUTHENTICATION_TYPES: Readonly<Record<string, string>> = {

  CALL: "answered doorbell call",
  NFC: "NFC credential",
  REMOTE_THROUGH_UAH: "remote command through the hub",
  WAVE: "hand wave at the reader"
};

/**
 * Every access method a device can be switched by name - the ways a credential presented at a reader can open a door: `face` face unlock, `mobile` an unlock
 * from the UniFi Access mobile app over Bluetooth, `nfc` an NFC card, `pin` a PIN entered at the keypad, `qr` a QR code, `touchPass` a Touch Pass held in a
 * phone's wallet, and `wave` a hand wave at the reader.
 *
 * The names are this library's own rather than any channel's. The controller spells one method differently on each surface that writes it - TouchPass is
 * `apple_pass` in a device's configuration rows and `touch_pass` in its official settings, and mobile unlock spans more than one key on every surface - so a
 * vocabulary keyed on a wire spelling would hand every consumer the per-surface table this module keeps. A consumer naming a method to switch reads this list
 * rather than restating it.
 *
 * @category Protocol
 */
export const ACCESS_METHODS = [ "face", "mobile", "nfc", "pin", "qr", "touchPass", "wave" ] as const;

/** One access method of {@link ACCESS_METHODS}. */
export type AccessMethod = (typeof ACCESS_METHODS)[number];

// A key list one access method spans on one write path. It is never empty, which is what lets any column's first key stand for the method in a read.
type AccessMethodKeys = readonly [string, ...string[]];

/**
 * The keys each access method spans on each path that writes it: `direct` on the Access application's own `settings` collection, `camera` on its camera
 * configuration endpoint, and `official` in the published API's device settings.
 *
 * The `official` and `direct` columns also serve a read, each judging the method by its first key: the official settings read judges `official[0]`, and the
 * configuration-row read judges `direct[0]`. A camera-class write reads back through that same row, because every `direct` key sits in the same method's `camera`
 * set - mobile unlock's `bt_button` among them - so the rows a camera-class write lands include the one the read judges.
 *
 * Where each spelling comes from is stated per column, because the evidence differs. The `direct` keys are the spellings the captured configuration rows carry,
 * with mobile written as `bt_button` alone, the key homebridge-unifi-access writes for it there. The `official` keys are the spellings the captured official
 * settings carry, except `wave`, which no captured specimen reports: it is ported from homebridge-unifi-access's catalog, and the update type this library
 * declares names it too. The `camera` column is ported from homebridge-unifi-access's own composition and observed in no capture at all - none records a
 * camera-class write, its endpoint or the Bluetooth keys it takes, and the camera-class record the corpus caught carries no access-method rows.
 *
 * Declared `as const` so every key list keeps its literals: the official write indexes the update map by them and the read indexes the settings map, so a key
 * that stops naming a member of the map it indexes fails to compile rather than drifting. It is not published from the library's public surface, because its
 * readers are the library's own.
 *
 * @category Protocol
 */
export const ACCESS_METHOD_KEYS = {

  face: { camera: ["face"], direct: ["face"], official: ["face"] },
  mobile: { camera: [ "bt", "bt_button", "bt_tap" ], direct: ["bt_button"], official: [ "bt_button", "bt_tap" ] },
  nfc: { camera: ["nfc"], direct: ["nfc"], official: ["nfc"] },
  pin: { camera: ["pin_code"], direct: ["pin_code"], official: ["pin_code"] },
  qr: { camera: ["qr_code"], direct: ["qr_code"], official: ["qr_code"] },
  touchPass: { camera: ["apple_pass"], direct: ["apple_pass"], official: ["touch_pass"] },
  wave: { camera: ["wave"], direct: ["wave"], official: ["wave"] }
} as const satisfies Readonly<Record<AccessMethod, { camera: AccessMethodKeys; direct: AccessMethodKeys; official: AccessMethodKeys }>>;

/**
 * The tag the controller files a device's access-method configuration rows under, among the many tags one record's row array carries. A row is an access-method
 * row by this tag and its key together, which is why the write composes its rows under it and the read judges a row only where both agree. It is not published
 * from the library's public surface, because its readers are the library's own.
 *
 * @category Protocol
 */
export const ACCESS_METHOD_ROW_TAG = "open_door_mode";

/**
 * The value an access method's state is written as. Every surface that carries the state - the configuration rows, the official settings, and the newer
 * notification dialect's access-method map - spells it as the same `"yes"` and `"no"` pair rather than as a boolean, so a write on any path composes its value
 * here.
 *
 * @param enabled - Whether the method is switched on.
 *
 * @returns `"yes"` for a method switched on and `"no"` for one switched off.
 *
 * @category Protocol
 */
export function accessMethodValue(enabled: boolean): "no" | "yes" {

  return enabled ? "yes" : "no";
}

/**
 * What an access-method value says about the method's state, by the rule every reader of one shares: `"yes"` is enabled, `"no"` is disabled, and anything else
 * establishes no reading at all. A value outside the pair is not guessed at, because a spelling no surface has been observed to write says nothing about whether
 * the method is on, and reading it as `false` would report a verdict the controller never gave.
 *
 * @param value - The value exactly as a surface carried it.
 *
 * @returns `true` for `"yes"`, `false` for `"no"`, and `undefined` for anything else.
 *
 * @category Protocol
 */
export function readAccessMethodValue(value: unknown): boolean | undefined {

  switch(value) {

    case "yes":

      return true;

    case "no":

      return false;

    default:

      return undefined;
  }
}

/**
 * Each access method's state, by name, read from whatever surface a caller points it at. The caller supplies how one method's value is found on its surface, and
 * this applies the one value rule to every method: an established reading is an entry, and a method whose value is absent or outside the pair has no entry at all.
 * The official settings reading and the configuration-row reading each answer through this, so a method reads by one rule whichever surface stated it.
 *
 * @param read - How one method's value is found on the surface being read, or `undefined` where the surface carries none.
 *
 * @returns Each method with an established reading, mapped to whether it is enabled.
 *
 * @category Protocol
 */
export function readAccessMethodStates(read: (method: AccessMethod) => string | undefined): Partial<Readonly<Record<AccessMethod, boolean>>> {

  const states: Partial<Record<AccessMethod, boolean>> = {};

  for(const method of ACCESS_METHODS) {

    const state = readAccessMethodValue(read(method));

    if(state !== undefined) {

      states[method] = state;
    }
  }

  return states;
}

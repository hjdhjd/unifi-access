/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * vocabulary.ts: The cross-channel wire vocabulary - the actor-type spellings folded into one, the hardware address spelled one way, what a doorbell's reason
 * codes actually mean, and what an unlock's authentication types say in plain English.
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

/* The two shapes the controller gives a hardware address: the six pairs joined by colons, or the twelve digits run together. Either arrives in either case, and the
 * same device can arrive in both cases from one read to the next.
 */
const MAC_ADDRESS = /^(?:[0-9a-f]{2}:){5}[0-9a-f]{2}$|^[0-9a-f]{12}$/i;

/**
 * Whether a value is a hardware address in either shape the controller produces.
 *
 * The official API's device identifier is the address with its separators removed, so this is also the test for whether an identifier licenses an address at all:
 * the controller addresses camera-class hardware by an identifier that is not one.
 *
 * @param value - The value exactly as a channel carried it.
 *
 * @returns `true` when the value is a hardware address, in either shape and either case.
 *
 * @category Protocol
 */
export function isMacAddress(value: string): boolean {

  return MAC_ADDRESS.test(value);
}

/**
 * Fold a hardware address into the library's single spelling of it: uppercase, with no separators.
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

  return MAC_ADDRESS.test(value) ? value.replaceAll(":", "").toUpperCase() : value;
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

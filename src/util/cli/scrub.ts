/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * scrub.ts: Referentially-consistent pseudonymization of captured controller data, so a capture can leave a user's site carrying evidence but no identity.
 *
 * The scrub replaces every identifying value in a captured document with a synthetic stand-in, and replaces the same input with the same stand-in everywhere it
 * appears.
 *
 * Referential consistency is the property that makes a scrubbed capture still useful. One hub's hardware address appears in its own record, in the device listing
 * beneath a door, and inside the compound room identifier the controller keys that door by; if every occurrence took a fresh pseudonym, the relationships between
 * records would be destroyed and the capture would stop describing a system. One replacement memory per run keeps every cross-reference intact while none of the
 * real values survive.
 *
 * Two rules decide what a string becomes. The key it arrived under decides first, so a door someone named "192.168.1.5" is pseudonymized as a name rather than as
 * an address. Failing that, the value's own shape decides, which is what catches identifying values under keys no catalog anticipated - including fields on
 * hardware classes this library has never modeled, which is exactly the traffic a capture exists to collect. A value reaches its key as its own member name, as
 * the name of the array it is an element of, or - for the configuration rows the controller spells as `{ key, value }` and as `{ config_key, config_value }` - as
 * the text of the sibling field that says what the row is about.
 *
 * Numbers are otherwise left alone, with one exception. A latitude or a longitude carries a site's position, identity no string rule can reach, so a number arriving
 * under a coordinate key becomes zero: the field stays numeric, and it points nowhere a real installation could be.
 *
 * Replacements keep the shape of what they replace. Hardware addresses stay address-shaped and locally administered, network addresses land in the range RFC 5737
 * reserves for documentation, UUIDs keep their dash layout, and a cleared secret is sized to what it replaced - down to the fixed width of the redaction marker
 * itself, below which a short secret comes back longer than it went in. That size is measured against the value as the URL rule left it, because the authority
 * scrub runs ahead of the catalogs and a secret that was a URL is therefore cleared at the length of its host-substituted form. A consumer reading a scrubbed
 * capture sees data that still parses, still classifies, and still lines up.
 *
 * Two properties are accepted rather than solved. The replacement memory grows with the count of distinct identity values seen - that is what referential
 * consistency is bought with, bounded by a site's identity vocabulary plus one entry per event identifier on a long stream. And a value that legitimately changes
 * during a run, a renewed lease or a renamed door, takes a fresh stand-in: this is content-keyed pseudonymization, which describes values rather than entities.
 */
import { isMacAddress, normalizeMacAddress } from "../../index.ts";

// The replacement categories. Each keeps its own memory, so a hostname and a door name that happen to share text never collapse onto one pseudonym.
type ScrubCategory = "email" | "hash" | "host" | "ip" | "mac" | "name" | "phone" | "plate" | "token" | "uuid";

/**
 * The replacement memory for one scrub run.
 *
 * One context scrubs one capture: every value it has already replaced is remembered, so the same input maps to the same output for as long as the context lives, and
 * nothing carries over to the next run. Create it with {@link createScrubContext} and pass the same one to every {@link scrub} call that makes up a capture.
 *
 * @category CLI
 */
export interface ScrubContext {

  readonly replacements: Map<ScrubCategory, Map<string, string>>;
}

/* Several catalog entries below name keys the modeled wire does not carry today - `avatar_url`, `credentials`, `country_code`, `hashed_password`, `password`,
 * `pin`, `private_key`, `psk`, `public_key`, `serial`, `serial_number`, `session_token`, `fingerprint`, `latitude`, and `longitude` among them. They are
 * deliberate: the scrub reads the keys a controller actually sends, and a capture exists precisely to carry traffic the model has never seen. Naming them costs
 * nothing and covers the firmware that starts sending one. `avatar_url` is such a key by way of the vendor reference rather than a future firmware: the reference
 * documents an avatar upload answering under it where the controller answers under `url`, so a capture is covered whichever spelling arrives.
 *
 * The catalogs are disjoint, so the order they are consulted in below is presentation rather than precedence.
 */

// Keys whose values are secrets whatever they look like, cleared rather than pseudonymized. The webhook receiver keys - `endpoint`, `url`, and `headers` - are
// cleared whole rather than left to the URL rule that reaches only an authority: a receiver's path can carry its own capability token, and its caller-defined header
// map carries that receiver's credentials under names no catalog can anticipate. `preview` stands on the same ground `door_thumbnail` does: the controller names a
// stored image by a path it composes from a capture time and that image's own identifier, so the locator carries identity even though nothing about it reads as a
// secret, and `preview` is the spelling a configuration row states such a path under.
const SECRET_KEYS: ReadonlySet<string> = new Set([

  "authentication_value", "avatar", "avatar_relative_path", "avatar_rpath2", "avatar_url", "company_logo", "credentials", "door_thumbnail", "endpoint",
  "hashed_password", "headers", "nacl_private_key", "nacl_public_key", "nfc_token", "password", "pin", "pin_code", "preview", "private_key", "psk", "public_key",
  "secret", "session_token", "ssh_password", "sso_picture", "token", "uah_token", "url", "user_avatar", "video_record", "video_record_thumbnail"
]);

// The name keys that are, somewhere on the wire, a copy of some record's or actor's own name: an event names the actor who acted, a door state report names the
// door, a log hit names its target. They share one hint below so a copy and the original resolve to the same stand-in and the cross-reference between the two
// records survives. Two records that happen to share text - a person and a device both called "Lobby" - resolve to one stand-in as well, which is the deliberate
// consequence of keying the memory by text.
const SHARED_NAME_KEYS: ReadonlySet<string> = new Set([

  "actor_name", "device_name", "display_name", "door_name", "floor_name", "full_name", "inviter_name", "name", "previous_name", "resource_name", "target_name"
]);

// Keys carrying a login someone signs in with. A login is a display-name-class value, so it takes the name regime rather than a category of its own - and the wire
// spells the same concept several ways, a user record naming it one way and an identity-provider block another, so all the spellings share one hint and one account
// keeps one stand-in across them.
const USERNAME_KEYS: ReadonlySet<string> = new Set([ "ssh_user", "sso_account", "sso_username", "uid_sso_account", "user_name", "username" ]);

// Keys carrying a display name a person chose, pseudonymized to a readable stand-in so a capture still reads as a system rather than a wall of tokens. Every family
// listed above is folded in here by construction, so a key that shares a hint is a member of this set without anyone having to keep the lists in step.
const NAME_KEYS: ReadonlySet<string> = new Set([

  ...SHARED_NAME_KEYS, ...USERNAME_KEYS, "alias", "alternate_name", "card_name", "company_name", "first_name", "group_name", "last_name", "nfc_alias", "policy_name",
  "room_name", "short_name", "shortname", "system_name", "template_name", "visitor_company"
]);

// Keys carrying an email address.
const EMAIL_KEYS: ReadonlySet<string> = new Set([ "email", "emails", "maskedEmail", "user_email" ]);

// Keys carrying a telephone number - identity with a shape no other rule recognizes, since a number is just digits and punctuation.
const PHONE_KEYS: ReadonlySet<string> = new Set([ "mobile_phone", "phone" ]);

// Keys carrying a vehicle registration. The wire's plate text lives under each element's `credential` member of a `license_plates` array, so the member key is what
// catches it; the container key stays as a defense for a bare-string array, and any future non-plate `credential` spelling is de-identified rather than published,
// which is the safe direction to be wrong in.
const PLATE_KEYS: ReadonlySet<string> = new Set([ "credential", "license_plates" ]);

// Keys carrying a network address or a hostname. The value's own shape picks which of the two it is, and an array under one of these keys resolves element by
// element, so a list of mixed addresses and names comes out mixed the same way.
const HOST_KEYS: ReadonlySet<string> = new Set([

  "broadcast_ip", "broadcast_ips", "controller_ip", "discovery_broadcast_ips", "gateway_ip", "host", "hostname", "ip", "ip_subnet", "ip_subnets", "wan_ip"
]);

// Keys carrying a hardware address as their whole value.
const MAC_KEYS: ReadonlySet<string> = new Set([ "host_device_mac", "mac" ]);

// Keys carrying a compound identifier with a hardware address embedded inside it. The value is rewritten run by run rather than replaced whole, so the identifier
// keeps its structure while the address inside it does not survive.
const EMBEDDED_MAC_KEYS: ReadonlySet<string> = new Set([ "console_id", "room_id" ]);

// Keys carrying a checksum, a card identifier, or a hardware serial. Not sensitive in themselves, but they identify one physical unit, one credential, or one
// employee, so they are replaced with same-length stand-ins - a width that fits an arbitrary identifier format as readily as a fixed-width digest.
const HASH_KEYS: ReadonlySet<string> = new Set([

  "card_id", "cert_fingerprint", "display_id", "employee_number", "fingerprint", "nfc_display_id", "nfc_id", "serial", "serial_number"
]);

// Keys carrying the site's locale, each replaced by a fixed placeholder rather than a minted pseudonym. An IANA timezone names a city and a country code names a
// country, so both are location by another route...but they are one-per-site properties with nothing cross-referencing them, so a conventional stand-in carries
// everything a pseudonym would while reading as obviously synthetic. "ZZ" is the ISO 3166 code reserved for private use, and "Etc/UTC" is the zone that names no
// place.
const LOCALE_KEYS: ReadonlyMap<string, string> = new Map([ [ "country_code", "ZZ" ], [ "time_zone", "Etc/UTC" ], [ "timezone", "Etc/UTC" ] ]);

// Keys carrying a geographic position, and the module's one rule that reads a number. A coordinate is identity expressed numerically, so no string rule can reach
// it; the replacement is a fixed zero rather than a pseudonym, for the same reason the locale keys take one - a position has no cross-reference worth preserving.
const COORDINATE_KEYS: ReadonlySet<string> = new Set([ "latitude", "longitude" ]);

/* Keys stating what software a piece of hardware is running, kept rather than replaced. A version is diagnostic vocabulary, and telling a consumer which firmware
 * produced a capture is a large part of why the capture is worth having at all.
 *
 * They are named here because the controller spells a version several ways, and one of those spellings is four numbers joined by dots - which is precisely what an
 * address looks like to a guard that reads shape and nothing else. So these keys answer ahead of the shape rules rather than after them, and a version stays a
 * version instead of landing in the range reserved for documentation. A version under a key no catalog names is still read by its shape, which is the accepted
 * limit of a rule that decides by key: the shape rules exist to reach fields this library has never modeled, and that reach is worth more than a guarantee that
 * every version everywhere survives.
 */
const VERSION_KEYS: ReadonlySet<string> = new Set([ "firmware", "firmware_version", "from_version", "protect_version", "software_version", "ulp_version",
  "version" ]);

// The member-name pairs a configuration row is spelled with: the member carrying the payload, and beside it the sibling member naming what that payload is. The
// controller spells the same idiom differently from one record to the next - a device entry as `{ key, value }`, an extension entry as
// `{ config_key, config_value }` - so the pairs live here rather than in the walk, and a further spelling is one entry rather than another branch.
const ROW_SUBJECT_MEMBERS: ReadonlyMap<string, string> = new Map([ [ "config_value", "config_key" ], [ "value", "key" ] ]);

// Shape guards, each anchored so it recognizes a value that is entirely of that shape rather than one that merely contains it. The hardware address has no guard
// here at all: the library's own vocabulary answers that question, so the CLI cannot drift from what the wire calls an address.
const IP_PATTERN = /^(\d{1,3}\.){3}\d{1,3}$/;
const UUID_PATTERN = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
// The mail-address shape is deliberately broad - one at-sign with a dotted authority after it - so that no real address escapes it. That breadth also reads a
// package-at-version locator such as "eslint@9.0.0" as an address, which is accepted: a controller capture carries no such locator, and a stand-in for a value
// that was never an address costs nothing where a missed address would leak identity.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* An identifier that is entirely twenty-four hexadecimal characters, the width the controller addresses a camera-class device by. One camera's identity arrives
 * under several spellings - as an event's device identifier, as the object an event names, and as the camelCase member a metadata block states it in - and the
 * controller keys maps by it as well, so no catalog of key names reaches every occurrence and the width is what has to.
 *
 * It resolves through the serial regime rather than a category of its own, because a same-length opaque stand-in is exactly what that regime promises and exactly
 * what this value needs: the width a consumer parses survives, the identity does not, and every occurrence of one camera still points at one record.
 */
const HEX_IDENTIFIER_PATTERN = /^[0-9a-fA-F]{24}$/;

// Every maximal run of twelve or more hexadecimal characters, which is how an address embedded in a compound identifier is found: twelve is the width of an address
// with its separators removed, and the surrounding structure is whatever is not hexadecimal.
const HEX_RUN_PATTERN = /[0-9a-fA-F]{12,}/g;

// The lowercase and uppercase halves of the hexadecimal alphabet, which together say what letter case one occurrence of an address was spelled in.
const LOWER_HEX_PATTERN = /[a-f]/;
const UPPER_HEX_PATTERN = /[A-F]/;

// The fixed width of a cleared secret's prefix: "REDACTED-" plus eight hex digits plus the separator. Subtracted from the original length so the replacement is the
// same length as what it replaced.
const TOKEN_PREFIX_WIDTH = 18;

/**
 * Create a replacement memory for one capture.
 *
 * @returns A fresh context, remembering nothing.
 *
 * @category CLI
 */
export function createScrubContext(): ScrubContext {

  return { replacements: new Map() };
}

// Look up a value's replacement, minting one on first sight. The mint receives the count of replacements already issued in that category, which is what makes the
// synthetic values run in a stable, readable sequence within a run.
function remember(context: ScrubContext, category: ScrubCategory, value: string, mint: (index: number) => string): string {

  let known = context.replacements.get(category);

  if(known === undefined) {

    known = new Map<string, string>();
    context.replacements.set(category, known);
  }

  const existing = known.get(value);

  if(existing !== undefined) {

    return existing;
  }

  const minted = mint(known.size);

  known.set(value, minted);

  return minted;
}

/* A synthetic hardware address in the locally-administered range. This is the only place an address is minted, so the key catalogs, the shape rule, and the
 * embedded-run rewriting below cannot answer two spellings of one address differently.
 *
 * The memory is keyed by the library's own folded spelling and holds the canonical stand-in, because the controller spells one device's address in either case and
 * with or without separators, from one record to the next. The return is then styled to the occurrence in hand rather than to the first occurrence seen, which a
 * memory keyed by the raw text could not do: it would cache whichever spelling arrived first and answer it everywhere.
 */
function scrubMac(context: ScrubContext, value: string): string {

  const canonical = remember(context, "mac", normalizeMacAddress(value), (index) => "AABBCC" + index.toString(16).padStart(6, "0").toUpperCase());

  // An occurrence spelled with lowercase letters and no uppercase ones is a lowercase occurrence; anything else, an all-digit occurrence included, takes the
  // library's own uppercase spelling.
  const styled = (LOWER_HEX_PATTERN.test(value) && !UPPER_HEX_PATTERN.test(value)) ? canonical.toLowerCase() : canonical;

  return value.includes(":") ? (styled.match(/.{2}/g) ?? [styled]).join(":") : styled;
}

// A synthetic address in TEST-NET-1, the range RFC 5737 reserves for documentation, so nothing in a capture can ever be mistaken for a routable host. The index wraps
// at 254 distinct addresses, since that is every host TEST-NET-1 can address; a capture whose real IP vocabulary exceeds that count reuses a stand-in, so two real
// hosts beyond the wrap can end up sharing one pseudonym.
function scrubIp(context: ScrubContext, value: string): string {

  return remember(context, "ip", value, (index) => "192.0.2." + ((index % 254) + 1).toString());
}

// A synthetic UUID that keeps the dash layout, so length and format checks downstream still pass.
function scrubUuid(context: ScrubContext, value: string): string {

  return remember(context, "uuid", value, (index) => "00000000-0000-0000-0000-" + index.toString(16).padStart(12, "0"));
}

// A synthetic hostname.
function scrubHostname(context: ScrubContext, value: string): string {

  return remember(context, "host", value, (index) => "host-" + (index + 1).toString() + ".test.local");
}

// Resolve a value that names a host: an address, a hostname, or a subnet. A subnet keeps its prefix length and has only its address half replaced, so a network
// still reads as a network of that size while pointing nowhere real - and because the address half is remembered like any other, a device inside the subnet and the
// subnet itself agree.
function scrubHost(context: ScrubContext, value: string): string {

  const slash = value.indexOf("/");
  const address = (slash > 0) ? value.substring(0, slash) : value;

  if(!IP_PATTERN.test(address)) {

    return scrubHostname(context, value);
  }

  return scrubIp(context, address) + ((slash > 0) ? value.substring(slash) : "");
}

// A synthetic email address. Referential like every other category: the same address always becomes the same stand-in, so a capture still shows that two records
// name the same person.
function scrubEmail(context: ScrubContext, value: string): string {

  return remember(context, "email", value, (index) => "user-" + (index + 1).toString() + "@example.com");
}

// A synthetic telephone number. The 555 area code is unassignable, so the result is a number that can be printed anywhere and dialed nowhere; the first hundred distinct
// numbers minted in a run additionally fall within 555-01XX, the block reserved for fiction, before the suffix rolls past it.
function scrubPhone(context: ScrubContext, value: string): string {

  return remember(context, "phone", value, (index) => "+1555555" + (100 + index).toString().padStart(4, "0"));
}

// A synthetic vehicle registration, in a form no jurisdiction issues.
function scrubPlate(context: ScrubContext, value: string): string {

  return remember(context, "plate", value, (index) => "PLATE-" + (index + 1).toString().padStart(4, "0"));
}

/* A synthetic display name, seeded by the key it arrived under so the result reads as what it is - a `room_name` becomes "Test room_name 1".
 *
 * The memory is keyed by hint and value together, because the same text under two unrelated keys deserves two differently-worded stand-ins. Each such family is an
 * exception, because its several spellings name one thing: every spelling of a login collapses onto one hint, and every key that carries a copy of some record's own
 * name collapses onto another, so an event's actor and that person's user record read as one person afterwards.
 */
function scrubName(context: ScrubContext, value: string, key: string): string {

  const hint = USERNAME_KEYS.has(key) ? "username" : (SHARED_NAME_KEYS.has(key) ? "Name" : key);

  return remember(context, "name", hint + "|" + value, (index) => "Test " + hint + " " + (index + 1).toString());
}

// Clear a secret, sized to what it replaced so a capture still shows how long the real value was without showing any of it. A value shorter than the marker's own
// fixed width cannot be sized down to it, so a short secret comes back as the bare marker.
function scrubToken(context: ScrubContext, value: string): string {

  return remember(context, "token", value, (index) => "REDACTED-" + index.toString(16).padStart(8, "0") + "-" +
    "x".repeat(Math.max(0, value.length - TOKEN_PREFIX_WIDTH)));
}

// Replace a checksum or a serial with a same-length stand-in. The replacement is stable within a run but derived from encounter order rather than content, so it
// says nothing about the original.
function scrubHash(context: ScrubContext, value: string): string {

  return remember(context, "hash", value, (index) => ("0".repeat(Math.max(0, value.length - 8)) + index.toString(16).padStart(8, "0")).slice(0, value.length));
}

/* Rewrite a compound identifier that carries a hardware address inside it, run by run, leaving every non-hexadecimal character of its structure in place.
 *
 * The two shapes the wire carries want different answers. A run of exactly twelve characters is an address and nothing else, so it folds through the one address
 * mint and a room identifier keyed by its hub still points at that hub's own record. A longer run is one unbroken hexadecimal compound with no delimiter saying
 * which twelve of its characters are the address, so the whole run takes a same-length opaque stand-in instead: the address does not survive, the identifier keeps
 * its exact width and shape, and the run is still referential as a run.
 */
function scrubEmbeddedMac(context: ScrubContext, value: string): string {

  return value.replace(HEX_RUN_PATTERN, (run) => (run.length === 12) ? scrubMac(context, run) : scrubHash(context, run));
}

/* Replace the authority of a URL: any embedded credentials are dropped and the host is pseudonymized, while the scheme, port, path, and query survive.
 *
 * This is what reaches the portal, imagery, and vendor URLs the wire carries under keys no catalog names, where the identity is the host rather than the value as a
 * whole and the path is evidence worth keeping. A value that does not parse as a URL is returned untouched for the rest of the pipeline to judge, and so is one
 * that parses but carries no authority - a bare "scheme:text" string is not a locator, and rewriting it would rewrite values that were never URLs.
 */
function scrubUrl(context: ScrubContext, value: string): string {

  let url: URL;

  try {

    url = new URL(value);
  } catch {

    return value;
  }

  if(url.hostname.length === 0) {

    return value;
  }

  url.username = "";
  url.password = "";
  url.hostname = IP_PATTERN.test(url.hostname) ? scrubIp(context, url.hostname) : scrubHostname(context, url.hostname);

  return url.toString();
}

// Whether a value is a plain JSON object. Buffers and typed arrays answer `typeof` as objects but are binary, and arrays are handled on their own path, so the
// prototype is what the test reads.
function isPlainObject(value: unknown): value is Record<string, unknown> {

  if((typeof value !== "object") || (value === null)) {

    return false;
  }

  const prototype: unknown = Object.getPrototypeOf(value);

  return (prototype === Object.prototype) || (prototype === null);
}

// Replace a value the catalogs did not name, by its own shape, or answer `undefined` when it has no shape worth replacing. This is what covers fields on hardware
// classes the library has never modeled, which is the whole reason a capture is worth collecting and the reason novelty evidence is safe to include.
function scrubShape(context: ScrubContext, value: string): string | undefined {

  if(isMacAddress(value)) {

    return scrubMac(context, value);
  }

  if(IP_PATTERN.test(value)) {

    return scrubIp(context, value);
  }

  if(UUID_PATTERN.test(value)) {

    return scrubUuid(context, value);
  }

  if(HEX_IDENTIFIER_PATTERN.test(value)) {

    return scrubHash(context, value);
  }

  if(EMAIL_PATTERN.test(value)) {

    return scrubEmail(context, value);
  }

  return undefined;
}

// Replace one string, key first and shape second.
function scrubString(context: ScrubContext, value: string, key: string | undefined): string {

  if(value.length === 0) {

    return value;
  }

  const stripped = scrubUrl(context, value);

  // The key decides first, so a door named after an address is still pseudonymized as a name.
  if(key !== undefined) {

    if(SECRET_KEYS.has(key)) {

      return scrubToken(context, stripped);
    }

    if(NAME_KEYS.has(key)) {

      return scrubName(context, stripped, key);
    }

    if(MAC_KEYS.has(key)) {

      return scrubMac(context, stripped);
    }

    if(EMBEDDED_MAC_KEYS.has(key)) {

      return scrubEmbeddedMac(context, stripped);
    }

    if(HOST_KEYS.has(key)) {

      return scrubHost(context, stripped);
    }

    if(HASH_KEYS.has(key)) {

      return scrubHash(context, stripped);
    }

    if(EMAIL_KEYS.has(key)) {

      return scrubEmail(context, stripped);
    }

    if(PHONE_KEYS.has(key)) {

      return scrubPhone(context, stripped);
    }

    if(PLATE_KEYS.has(key)) {

      return scrubPlate(context, stripped);
    }

    // A locale value is answered from the fixed table rather than the replacement memory, so the lookup doubles as the test for whether this is a locale key at all.
    const locale = LOCALE_KEYS.get(key);

    if(locale !== undefined) {

      return locale;
    }

    if(VERSION_KEYS.has(key)) {

      return stripped;
    }
  }

  return scrubShape(context, stripped) ?? stripped;
}

// Replace an object key that is itself identifying. Some controller maps are keyed by a raw hardware address or identifier, so a scrub that only touched values
// would leave the identifiers sitting in the key positions.
function scrubKey(context: ScrubContext, key: string): string {

  if(isMacAddress(key)) {

    return scrubMac(context, key);
  }

  if(UUID_PATTERN.test(key)) {

    return scrubUuid(context, key);
  }

  if(HEX_IDENTIFIER_PATTERN.test(key)) {

    return scrubHash(context, key);
  }

  if(IP_PATTERN.test(key)) {

    return scrubIp(context, key);
  }

  return key;
}

/* Clear every string beneath a secret container, keeping the structure and the key names. A webhook registration's `headers` map is what this exists for: its keys
 * are chosen by whoever registered the endpoint, so no catalog can anticipate them, and its values are the receiver's own credentials. Keys still pass the key
 * replacement above, so an identifier used as a key is pseudonymized here as it is anywhere else.
 */
function clearSecrets(context: ScrubContext, value: unknown): unknown {

  if(typeof value === "string") {

    return (value.length === 0) ? value : scrubToken(context, value);
  }

  if((value === null) || (value === undefined) || ArrayBuffer.isView(value)) {

    return value;
  }

  if(Array.isArray(value)) {

    return value.map((element) => clearSecrets(context, element));
  }

  if(isPlainObject(value)) {

    const cleared: Record<string, unknown> = {};

    for(const [ name, inner ] of Object.entries(value)) {

      cleared[scrubKey(context, name)] = clearSecrets(context, inner);
    }

    return cleared;
  }

  return value;
}

/* The key one member of a walked object is classified under. A configuration row states its subject in a sibling field rather than in the member name carrying the
 * payload, so a row's payload member is classified under the text of that sibling and every other member under its own name.
 *
 * The sibling is read from the object being walked rather than from the key that object arrived under: for a row, the arriving key is the name of the array
 * holding it and says nothing about which setting the row carries. A row whose sibling text no catalog names, holding a value no shape rule recognizes, passes
 * through as any value under an uncataloged name does, so the rule is safe wherever the pairing appears outside a configuration row.
 */
function memberKeyFor(row: Record<string, unknown>, name: string): string {

  const subjectMember = ROW_SUBJECT_MEMBERS.get(name);

  if(subjectMember === undefined) {

    return name;
  }

  const subject = row[subjectMember];

  return (typeof subject === "string") ? subject : name;
}

/**
 * Scrub a captured value, returning a pseudonymized copy.
 *
 * The input is never modified: objects and arrays are rebuilt rather than edited, so a caller may keep using the original.
 *
 * A document that is a bare string is cleared rather than passed through. Such a document is a minted credential or an opaque scalar - the credential endpoints
 * answer exactly that shape - and no key-based catalog can reach a document that has no keys, so the conservative reading is the only safe one. The envelope shape
 * survives, which is what a capture of that endpoint is for.
 *
 * Binary values pass through untouched. Bytes are not string territory, and the layer that assembles a capture is what decides how to carry them.
 *
 * @param value   - Any JSON-shaped value: a whole document, a record, or a single field.
 * @param context - The replacement memory. Pass one context through a whole capture so its cross-references survive.
 *
 * @returns The scrubbed copy.
 *
 * @category CLI
 */
export function scrub(value: unknown, context: ScrubContext): unknown {

  if(typeof value === "string") {

    if(value.length === 0) {

      return value;
    }

    const stripped = scrubUrl(context, value);

    return scrubShape(context, stripped) ?? scrubToken(context, stripped);
  }

  return scrubValue(value, context, undefined);
}

// The recursive walk. `key` is the name the value arrived under, which is what lets the key catalogs decide ahead of the shape rules.
function scrubValue(value: unknown, context: ScrubContext, key: string | undefined): unknown {

  if(typeof value === "string") {

    return scrubString(context, value, key);
  }

  // The one numeric replacement. Gating on the number type as well as the key is what keeps it from shadowing anything else: a null coordinate still returns null
  // below, a string one still follows the string rules above, and an object or an array under the same key still takes its structural path.
  if((typeof value === "number") && (key !== undefined) && COORDINATE_KEYS.has(key)) {

    return 0;
  }

  if((value === null) || (value === undefined) || ArrayBuffer.isView(value)) {

    return value;
  }

  // A secret key holding a structure clears everything beneath it. A single string under the same key was already cleared above, so this is the container arm of
  // one rule rather than a second rule.
  if((key !== undefined) && SECRET_KEYS.has(key)) {

    return clearSecrets(context, value);
  }

  if(Array.isArray(value)) {

    // Every element inherits the key its array arrived under, so an array of addresses under a `broadcast_ips` key is treated the same as a single one would be.
    return value.map((element) => scrubValue(element, context, key));
  }

  if(isPlainObject(value)) {

    const scrubbed: Record<string, unknown> = {};

    for(const [ name, inner ] of Object.entries(value)) {

      scrubbed[scrubKey(context, name)] = scrubValue(inner, context, memberKeyFor(value, name));
    }

    return scrubbed;
  }

  return value;
}

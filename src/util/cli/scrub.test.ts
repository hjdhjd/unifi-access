/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * scrub.test.ts: Unit tests for the capture scrub - referential consistency in both directions, key-over-shape precedence, every cataloged key, the configuration
 * rows that name their subject in a sibling field, the mints and their shapes, URL authority replacement, secret containers, bare-document clearing, embedded
 * addresses, coordinate and locale replacement, key replacement, the promise that the input is never modified, and the promise that a scrubbed packet still
 * classifies as what it was.
 */
import { createScrubContext, scrub } from "./scrub.ts";
import { describe, test } from "node:test";
import { AccessClient } from "../../index.ts";
import type { AccessEventPacket } from "../../index.ts";
import { accessEventPacketsInteractiveFixture } from "../../protocol/events.fixtures.ts";
import assert from "node:assert/strict";
import { findPacket } from "../../protocol/capture.helpers.ts";

// Scrub a value with a fresh context, for the cases that do not need one context spanning several calls.
function scrubbed(value: unknown): unknown {

  return scrub(value, createScrubContext());
}

// Scrub one key and value in a fresh context and answer what that key became, for the table-driven catalog sweep below.
function scrubOne(key: string, planted: unknown): unknown {

  return (scrubbed({ [key]: planted }) as Record<string, unknown>)[key];
}

// The categories the catalog table below expects a key to be answered from.
type CatalogCategory = "coordinate" | "email" | "embedded" | "hash" | "host" | "locale" | "mac" | "name" | "phone" | "plate" | "token";

/* Every key the module catalogs for replacement, each with one realistic planted value. The sweep asserts two things per row: the planted value does not survive, and
 * what replaced it belongs to that key's category. VERSION_KEYS is the one catalog excluded here, since its values are preserved rather than replaced, and it gets its
 * own exhaustive test below. A key that is dropped from a catalog, moved to the wrong one, or misspelled fails here rather than leaking in the field, which is the whole
 * reason the table is exhaustive rather than a sample.
 */
const CATALOG_ROWS: readonly { category: CatalogCategory; key: string; planted: number | string }[] = [

  { category: "token", key: "authentication_value", planted: "NFC-4A9F22C1" },
  { category: "token", key: "avatar", planted: "/system/static/avatar/9f2ac1.jpg" },
  { category: "token", key: "avatar_relative_path", planted: "avatars/jane-smith-9f2ac1.jpg" },
  { category: "token", key: "avatar_rpath2", planted: "avatars/v2/jane-smith-9f2ac1.jpg" },
  { category: "token", key: "avatar_url", planted: "https://access.example.net/avatars/jane-9f2ac1.jpg" },
  { category: "token", key: "company_logo", planted: "https://access.example.net/logos/acme-holdings.png" },
  { category: "token", key: "credentials", planted: "operator:hunter2" },
  { category: "token", key: "door_thumbnail", planted: "/system/static/thumb/front-door-9f2ac1.jpg" },
  { category: "token", key: "endpoint", planted: "https://hooks.example.net/access/cap-9f2ac1" },
  { category: "token", key: "hashed_password", planted: "$2b$10$9f2ac1JaneSmithHashedValue" },
  { category: "token", key: "headers", planted: "Bearer 9f2ac1-receiver-token" },
  { category: "token", key: "nacl_private_key", planted: "kR7pQ2mVx9LrT4nBwZq6Yd3Hs8Ju1Ge5Ma0Ci4Ok7Ps=" },
  { category: "token", key: "nacl_public_key", planted: "Xf2Nb8Qw5Tz1Hr6Km3Lp9Vc4Gy7Ds0Ja2Ue5Ri8Wob3=" },
  { category: "token", key: "nfc_token", planted: "9f2ac1d4e5b6a7c8" },
  { category: "token", key: "password", planted: "hunter2-jane-smith" },
  { category: "token", key: "pin", planted: "482913" },
  { category: "token", key: "pin_code", planted: "482913" },
  { category: "token", key: "preview", planted: "/preview/1755300000_9f2ac1d4-e5b6-47c8-89e0-f1a2b3c4d5e6.jpg" },
  { category: "token", key: "private_key", planted: "MIIEvQIBADANBgkqhkiG9w0BAQEFAASC" },
  { category: "token", key: "psk", planted: "acme-holdings-preshared-key" },
  { category: "token", key: "public_key", planted: "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5" },
  { category: "token", key: "secret", planted: "whsec-9f2ac1d4e5b6a7c8" },
  { category: "token", key: "session_token", planted: "sess-9f2ac1d4e5b6a7c8" },
  { category: "token", key: "ssh_password", planted: "9fK2pQ7mVx4LrT8nBwZq" },
  { category: "token", key: "sso_picture", planted: "https://sso.example.net/photos/jane-smith.jpg" },
  { category: "token", key: "token", planted: "SAMPLE-00000000-xxxxxxxxxxxxxxxxxxxx" },
  { category: "token", key: "uah_token", planted: "0ace0000-0000-4000-8000-00000000000d" },
  { category: "token", key: "url", planted: "https://hooks.example.net/access/cap-9f2ac1" },
  { category: "token", key: "user_avatar", planted: "/system/static/avatar/jane-9f2ac1.jpg" },
  { category: "token", key: "video_record", planted: "/recordings/2026-08-31/front-door-0913.mp4" },
  { category: "token", key: "video_record_thumbnail", planted: "/recordings/2026-08-31/front-door-0913.jpg" },

  { category: "name", key: "actor_name", planted: "Jane Smith" },
  { category: "name", key: "alias", planted: "Jane's Reader" },
  { category: "name", key: "alternate_name", planted: "Jane Q. Smith" },
  { category: "name", key: "card_name", planted: "Jane Smith Badge" },
  { category: "name", key: "company_name", planted: "Acme Holdings" },
  { category: "name", key: "device_name", planted: "Acme Name 14" },
  { category: "name", key: "display_name", planted: "Jane Smith" },
  { category: "name", key: "door_name", planted: "Loading Dock" },
  { category: "name", key: "first_name", planted: "Jane" },
  { category: "name", key: "floor_name", planted: "Third Floor" },
  { category: "name", key: "full_name", planted: "Dr. Jane Smith" },
  { category: "name", key: "group_name", planted: "Night Shift" },
  { category: "name", key: "inviter_name", planted: "Sam Jones" },
  { category: "name", key: "last_name", planted: "Smith" },
  { category: "name", key: "name", planted: "Acme Name 13" },
  { category: "name", key: "nfc_alias", planted: "Jane Smith Card" },
  { category: "name", key: "policy_name", planted: "Warehouse After Hours" },
  { category: "name", key: "previous_name", planted: "Old Loading Dock" },
  { category: "name", key: "resource_name", planted: "Loading Dock Camera" },
  { category: "name", key: "room_name", planted: "Server Room" },
  { category: "name", key: "short_name", planted: "Dock" },
  { category: "name", key: "shortname", planted: "Acme Name 15" },
  { category: "name", key: "ssh_user", planted: "Acme username 1" },
  { category: "name", key: "sso_account", planted: "jane.smith@acme.example" },
  { category: "name", key: "sso_username", planted: "jane.smith" },
  { category: "name", key: "system_name", planted: "Acme Holdings Access" },
  { category: "name", key: "target_name", planted: "Acme Name 4" },
  { category: "name", key: "template_name", planted: "Contractor Visit" },
  { category: "name", key: "uid_sso_account", planted: "jane.smith" },
  { category: "name", key: "user_name", planted: "jsmith" },
  { category: "name", key: "username", planted: "jsmith" },
  { category: "name", key: "visitor_company", planted: "Beta Logistics" },

  { category: "mac", key: "host_device_mac", planted: "02FFEE000004" },
  { category: "mac", key: "mac", planted: "02FFEE000002" },

  { category: "embedded", key: "console_id", planted: "02FFEE000004000000001111111100000000222222220000000033333333:1457807768" },
  { category: "embedded", key: "room_id", planted: "WR-02ffee000002-D4aKxWPrjIOp7eVbBBcfJsMtbbxVhU2n" },

  { category: "host", key: "broadcast_ip", planted: "10.13.0.255" },
  { category: "host", key: "broadcast_ips", planted: "10.13.0.255" },
  { category: "host", key: "controller_ip", planted: "10.13.0.4" },
  { category: "host", key: "discovery_broadcast_ips", planted: "10.13.0.255" },
  { category: "host", key: "gateway_ip", planted: "10.13.0.1" },
  { category: "host", key: "host", planted: "access.acme.example" },
  { category: "host", key: "hostname", planted: "access-hub-01" },
  { category: "host", key: "ip", planted: "10.13.0.42" },
  { category: "host", key: "ip_subnet", planted: "10.13.0.0/24" },
  { category: "host", key: "ip_subnets", planted: "10.13.0.0/24" },
  { category: "host", key: "wan_ip", planted: "203.0.113.77" },

  { category: "hash", key: "card_id", planted: "0429AF31" },
  { category: "hash", key: "cert_fingerprint", planted: "3F1A9C7B25D048E6A1B4C93027E5F8D6B0A72C15" },
  { category: "hash", key: "display_id", planted: "4429113" },
  { category: "hash", key: "employee_number", planted: "EMP-004291" },
  { category: "hash", key: "fingerprint", planted: "be028cb02b364dc79f14f27d0aec23bf" },
  { category: "hash", key: "nfc_display_id", planted: "4429113" },
  { category: "hash", key: "nfc_id", planted: "0429AF31" },
  { category: "hash", key: "serial", planted: "UBNTX1234567" },
  { category: "hash", key: "serial_number", planted: "UA-9911-4429" },

  { category: "email", key: "email", planted: "jane@acme.example" },
  { category: "email", key: "emails", planted: "jane@acme.example" },
  { category: "email", key: "maskedEmail", planted: "j***@acme.example" },
  { category: "email", key: "user_email", planted: "jane@acme.example" },

  { category: "phone", key: "mobile_phone", planted: "+1 617 555 8899" },
  { category: "phone", key: "phone", planted: "+1 617 555 8899" },

  { category: "plate", key: "credential", planted: "7ABC123" },
  { category: "plate", key: "license_plates", planted: "7ABC123" },

  { category: "locale", key: "country_code", planted: "US" },
  { category: "locale", key: "time_zone", planted: "America/New_York" },
  { category: "locale", key: "timezone", planted: "America/New_York" },

  { category: "coordinate", key: "latitude", planted: 40.741895 },
  { category: "coordinate", key: "longitude", planted: -73.989308 }
];

// What each category's stand-in has to look like when the planted value was the first of its kind in a fresh context.
const CATEGORY_SHAPES: Readonly<Record<Exclude<CatalogCategory, "coordinate" | "embedded" | "hash" | "locale">, RegExp>> = {

  email: /^user-1@example\.com$/,
  host: /^(192\.0\.2\.\d+(\/\d+)?|host-\d+\.test\.local)$/,
  mac: /^[0-9A-F]{12}$/,
  name: /^Test \S+ \d+$/,
  phone: /^\+1555555\d{4}$/,
  plate: /^PLATE-\d{4}$/,
  token: /^REDACTED-[0-9a-f]{8}-x*$/
};

const RING = findPacket((packet) => packet.event === "access.remote_view", "an interactive ring", { corpus: accessEventPacketsInteractiveFixture });

describe("the capture scrub", () => {

  test("the same value maps to one stand-in wherever it appears", () => {

    // The property that keeps a scrubbed capture usable: a hub referenced by hardware address from three places is still one hub afterwards.
    const result = scrubbed({ devices: [ { mac: "02FFEE000002" }, { peer: "02FFEE000002" } ], owner: { mac: "02FFEE000002" } }) as {

      devices: [{ mac: string }, { peer: string }];
      owner: { mac: string };
    };

    assert.equal(result.devices[0].mac, result.devices[1].peer);
    assert.equal(result.devices[0].mac, result.owner.mac);
    assert.notEqual(result.devices[0].mac, "02FFEE000002");
  });

  test("two different values map to two different stand-ins", () => {

    // The other direction, and the one an implementation that simply collapsed everything onto a single token would fail: distinctness has to survive too, or the
    // capture stops describing a system with more than one device in it.
    const result = scrubbed({ first: { mac: "02FFEE00B002" }, second: { mac: "02FFEE00B003" } }) as { first: { mac: string }; second: { mac: string } };

    assert.notEqual(result.first.mac, result.second.mac);
  });

  test("two categories never share a memory", () => {

    // One text under two unrelated keys is two different things, and each has to keep its own vocabulary: a door called "10.13.0.42" is not the host at that
    // address, and a capture that collapsed them would assert a relationship the site does not have.
    const result = scrubbed({ ip: "10.13.0.42", name: "10.13.0.42" }) as { ip: string; name: string };

    assert.match(result.ip, /^192\.0\.2\.\d+$/);
    assert.match(result.name, /^Test Name \d+$/);
  });

  test("two contexts do not share a memory", () => {

    // One context per capture: a later run must not be able to reverse an earlier one by comparing stand-ins, and each run's numbering starts fresh.
    const first = scrub({ mac: "02FFEE00B002" }, createScrubContext()) as { mac: string };
    const second = scrub({ mac: "02FFEE00B003" }, createScrubContext()) as { mac: string };

    assert.equal(first.mac, second.mac, "each context numbers its own replacements from the start");
  });

  test("the key decides ahead of the value's shape", () => {

    // A door someone named after an address is a name, not an address. Without this precedence the capture would show a door called "198.51.100.1".
    const result = scrubbed({ name: "10.13.0.42" }) as { name: string };

    assert.match(result.name, /^Test Name \d+$/, "a name key wins over the address shape");
  });

  test("every cataloged key is replaced by a stand-in of its own category", () => {

    // The exhaustive sweep: every key the module names, planted with a value a controller could really send. A row that leaks, or that is answered from the wrong
    // category, names itself in the failure.
    for(const row of CATALOG_ROWS) {

      const replaced = scrubOne(row.key, row.planted);

      switch(row.category) {

        case "coordinate": {

          assert.equal(replaced, 0, row.key + " is zeroed");

          break;
        }

        case "embedded": {

          const planted = String(row.planted);

          assert.notEqual(replaced, planted, row.key + " is rewritten");
          assert.equal(typeof replaced, "string", row.key + " stays a string");
          assert.equal((replaced as string).length, planted.length, row.key + " keeps its width");

          break;
        }

        case "hash": {

          const planted = String(row.planted);

          assert.notEqual(replaced, planted, row.key + " does not survive");
          assert.equal((replaced as string).length, planted.length, row.key + " keeps its length");

          break;
        }

        case "locale": {

          assert.ok([ "Etc/UTC", "ZZ" ].includes(replaced as string), row.key + " takes a fixed placeholder");

          break;
        }

        default: {

          assert.notEqual(replaced, row.planted, row.key + " does not survive");
          assert.match(replaced as string, CATEGORY_SHAPES[row.category], row.key + " takes its category's shape");
        }
      }
    }
  });

  test("a hardware address keeps one canonical stand-in and takes the styling of each occurrence", () => {

    /* The controller spells one device's address in either case and with or without separators, from one record to the next. A memory keyed by the raw text would
     * mint a second stand-in for the second spelling and split one device in two; keying it by the library's own folded spelling and styling the answer to the
     * occurrence is what keeps the device whole and each occurrence readable in the form it arrived in. The hyphen and dot spellings are what an operator's own
     * material carries rather than what the wire sends, and they reach the same stand-in through the same fold.
     */
    const context = createScrubContext();
    const result = scrub({ bare: { mac: "02ffee000002" }, colons: { mac: "02:FF:EE:00:00:02" }, dots: { mac: "02ff.ee00.0002" },
      hyphens: { mac: "02-FF-EE-00-00-02" }, upper: { mac: "02FFEE000002" } }, context) as {

      bare: { mac: string };
      colons: { mac: string };
      dots: { mac: string };
      hyphens: { mac: string };
      upper: { mac: string };
    };

    assert.match(result.upper.mac, /^[0-9A-F]{12}$/);
    assert.equal(result.bare.mac, result.upper.mac.toLowerCase(), "a lowercase occurrence answers in lowercase");
    assert.equal(result.colons.mac, (result.upper.mac.match(/.{2}/g) ?? []).join(":"), "an occurrence with separators answers with them");
    assert.equal(result.colons.mac.replaceAll(":", ""), result.upper.mac, "every spelling is one address underneath");
    assert.equal(result.hyphens.mac, result.upper.mac, "a hyphen-spelled address does not survive, and answers with the same stand-in");
    assert.equal(result.dots.mac, result.upper.mac.toLowerCase(), "a dot-spelled address does not survive, and answers with the same stand-in");
  });

  test("an address, a UUID, an email, and a hostname each keep their own shape", () => {

    const uuid = "01234567-89ab-cdef-0123-456789abcdef";
    const result = scrubbed({ "email": "jane@acme.example", "host": "access.acme.example", "ip": "10.13.0.42", "unique_id": uuid }) as {

      email: string;
      host: string;
      ip: string;
      unique_id: string;
    };

    assert.match(result.ip, /^192\.0\.2\.\d+$/, "addresses land in the range reserved for documentation");
    assert.match(result.unique_id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    assert.notEqual(result.unique_id, uuid);
    assert.match(result.email, /^user-\d+@example\.com$/);
    assert.match(result.host, /^host-\d+\.test\.local$/);
  });

  test("a cleared secret and a replaced serial keep the length they replaced", () => {

    const secret = "whsec-9f2ac1d4e5b6a7c8d9e0f1";
    const unitSerial = "UBNTX1234567";
    const result = scrubbed({ secret, serial: unitSerial }) as { secret: string; serial: string };

    assert.equal(result.secret.length, secret.length, "the length survives so a capture still shows how long the real value was");
    assert.ok(result.secret.startsWith("REDACTED-"), "the cleared secret carries the redaction marker");
    assert.ok(!result.secret.includes("9f2ac1"), "the secret's own text does not survive the scrub");
    assert.equal(result.serial.length, unitSerial.length);
    assert.notEqual(result.serial, unitSerial);
  });

  test("a secret shorter than the redaction marker comes back as the bare marker", () => {

    // The one place the length promise cannot hold: a six-digit credential is shorter than the marker itself, so it is cleared to the marker rather than padded
    // down to a width that would leak how short it was.
    const result = scrubbed({ "pin_code": "482913" }) as { pin_code: string };

    assert.match(result.pin_code, /^REDACTED-[0-9a-f]{8}-$/);
    assert.ok(!result.pin_code.includes("482913"), "the short credential does not survive the scrub");
  });

  test("a phone number lands in the fictional block and a plate in a form no jurisdiction issues", () => {

    const result = scrubbed({ "license_plates": [{ "credential": "7ABC123", "credential_type": "license" }], "phone": "+1 617 555 8899" }) as {

      license_plates: [{ credential: string; credential_type: string }];
      phone: string;
    };

    assert.match(result.phone, /^\+1555555\d{4}$/);
    assert.match(result.license_plates[0].credential, /^PLATE-\d{4}$/);
    assert.equal(result.license_plates[0].credential_type, "license", "the kind of credential is evidence, not identity");
  });

  test("an event's actor and the user record naming the same person resolve to one stand-in", () => {

    // The cross-reference a capture is read for: an event attributing an unlock to someone has to still point at that person's record afterwards, which it only
    // does if both spellings of the name land on the same stand-in.
    const context = createScrubContext();
    const result = scrub({ "event": { "actor_name": "Dr. Jane Smith" }, "user": { "full_name": "Dr. Jane Smith" } }, context) as {

      event: { actor_name: string };
      user: { full_name: string };
    };

    assert.equal(result.event.actor_name, result.user.full_name);
    assert.notEqual(result.user.full_name, "Dr. Jane Smith");
  });

  test("a door's own name and the copy of it in an event resolve to one stand-in", () => {

    const context = createScrubContext();
    const result = scrub({ "door": { "name": "Loading Dock" }, "ring": { "door_name": "Loading Dock" } }, context) as {

      door: { name: string };
      ring: { door_name: string };
    };

    assert.equal(result.ring.door_name, result.door.name);
    assert.notEqual(result.door.name, "Loading Dock");
  });

  test("every spelling of a login collapses onto one stand-in", () => {

    const context = createScrubContext();
    const result = scrub({ "sso_account": "jsmith", "sso_username": "jsmith", "uid_sso_account": "jsmith", "user_name": "jsmith",
      "username": "jsmith" }, context) as {

      sso_account: string;
      sso_username: string;
      uid_sso_account: string;
      user_name: string;
      username: string;
    };

    assert.match(result.username, /^Test username \d+$/);
    assert.equal(result.sso_account, result.username);
    assert.equal(result.sso_username, result.username);
    assert.equal(result.uid_sso_account, result.username);
    assert.equal(result.user_name, result.username);
  });

  test("a name key outside the shared families keeps its own hint", () => {

    // A company and a policy are their own entities, so each keeps its own wording and a reader can still tell which is which.
    const result = scrubbed({ "company_name": "Acme Holdings", "policy_name": "Warehouse After Hours" }) as { company_name: string; policy_name: string };

    assert.match(result.company_name, /^Test company_name \d+$/);
    assert.match(result.policy_name, /^Test policy_name \d+$/);
  });

  test("a URL's authority is replaced while its path and query survive", () => {

    // The vendor icon map is the case this exists for: the host identifies the site nothing, the path is evidence, and the value sits under a key no catalog names.
    const context = createScrubContext();
    const result = scrub({ icons: { l: "https://host-1.acme.example/fingerprint/icons/be028cb0_64x64.png?v=3",
      xs: "https://host-1.acme.example/fingerprint/icons/be028cb0_25x25.png" } }, context) as { icons: { l: string; xs: string } };

    assert.ok(result.icons.xs.endsWith("/fingerprint/icons/be028cb0_25x25.png"), "the path is evidence and survives");
    assert.ok(result.icons.l.endsWith("?v=3"), "so does the query");
    assert.ok(!result.icons.xs.includes("host-1.acme.example"), "the icon host does not survive the scrub");
    assert.match(result.icons.xs, /^https:\/\/host-\d+\.test\.local\//);
    assert.equal(new URL(result.icons.l).hostname, new URL(result.icons.xs).hostname, "one host is one stand-in across both entries");
  });

  test("credentials embedded in a URL do not survive", () => {

    // A secret inside a value, under a key no catalog would flag. The rest of the locator survives, because it is the part that carries meaning.
    const result = scrubbed({ streamUrl: "https://operator:hunter2@10.13.0.42:8443/live/feed" }) as { streamUrl: string };

    assert.ok(!result.streamUrl.includes("hunter2"), "the password in the URL does not survive the scrub");
    assert.ok(!result.streamUrl.includes("operator"), "the user name in the URL does not survive the scrub");
    assert.ok(!result.streamUrl.includes("10.13.0.42"), "the host address in the URL does not survive the scrub");
    assert.ok(result.streamUrl.startsWith("https://192.0.2."), "the host address takes a documentation-range stand-in");
    assert.ok(result.streamUrl.endsWith(":8443/live/feed"), "the port and path are evidence and survive");
  });

  test("a value that parses as a URL but names no host passes through untouched", () => {

    // A string with a colon in it can parse as a URL without being a locator, and rewriting one would rewrite values that were never URLs. The scheme's case is the
    // tell: URL parsing lowercases it, so a value that came back unchanged was genuinely left alone.
    const document = { "authentication_type": "Bearer:opaque", "extension_name": "port_setting" };

    assert.deepEqual(scrubbed(document), document);
  });

  test("a secret container clears every string beneath it and keeps its structure", () => {

    // A webhook registration's delivery headers: the keys are chosen by whoever registered the endpoint, so no catalog can anticipate them, and the values are the
    // receiver's own credentials.
    const result = scrubbed({ headers: { "Authorization": "Bearer 9f2ac1-receiver-token", "X-Acme-Site": "warehouse-3" }, name: "alerts" }) as {

      headers: Record<string, string>;
      name: string;
    };

    assert.deepEqual(Object.keys(result.headers), [ "Authorization", "X-Acme-Site" ], "the header names survive so the shape of the registration is still readable");
    assert.match(result.headers["Authorization"] ?? "", /^REDACTED-/);
    assert.match(result.headers["X-Acme-Site"] ?? "", /^REDACTED-/);
    assert.ok(!JSON.stringify(result.headers).includes("9f2ac1"), "the authorization header's value does not survive the scrub");
    assert.ok(!JSON.stringify(result.headers).includes("warehouse-3"), "the site header's value does not survive the scrub");
  });

  test("a secret container reaches through an array as well as an object", () => {

    const result = scrubbed({ "credentials": [ { "value": "9f2ac1d4" }, "e5b6a7c8" ] }) as { credentials: [{ value: string }, string] };

    assert.match(result.credentials[0].value, /^REDACTED-/);
    assert.match(result.credentials[1], /^REDACTED-/);
  });

  test("a secret container clears the strings beneath it and leaves everything else as it found it", () => {

    // The container rule is about text, because text is what carries a credential. A timestamp, a count, a flag, or a member that was never set is evidence about
    // when and how the secret is used, and destroying it would protect nothing.
    const bytes = Buffer.from([0x01]);
    const result = scrubbed({ "credentials": { "expires_at": 1755300000, "is_active": true, "payload": bytes, "revoked_at": null,
      "value": "9f2ac1d4" } }) as { credentials: { expires_at: number; is_active: boolean; payload: Buffer; revoked_at: null; value: string } };

    assert.match(result.credentials.value, /^REDACTED-/);
    assert.equal(result.credentials.expires_at, 1755300000);
    assert.equal(result.credentials.is_active, true);
    assert.equal(result.credentials.revoked_at, null);
    assert.equal(result.credentials.payload, bytes);
    assert.deepEqual(scrubbed({ "secret": "" }), { "secret": "" }, "an empty secret has nothing to clear");
  });

  test("a bare string document is cleared, and a bare shaped value takes its shape's stand-in", () => {

    /* A document with no keys at all is what the credential-minting endpoints answer with, and no key catalog can ever reach one. Clearing it is the only safe
     * reading, and the envelope shape - a bare scalar - is what a capture of such an endpoint is for. A bare value the shape rules do recognize still takes its own
     * category, so a capture of a single address is not needlessly destroyed.
     */
    assert.match(scrubbed("482913") as string, /^REDACTED-[0-9a-f]{8}-$/);
    assert.match(scrubbed("02ffee000002") as string, /^[0-9a-f]{12}$/);
    assert.equal(scrubbed(""), "", "an empty document has nothing to clear");
    assert.equal(scrubbed(42), 42);
  });

  test("a top-level object is walked rather than cleared", () => {

    // The bare-document rule is the string arm of the entry point alone: a document with keys still takes the walk, or every capture would come back as one token.
    const result = scrubbed({ "device_type": "UA-G2-PRO", "mac": "02FFEE000002" }) as { device_type: string; mac: string };

    assert.equal(result.device_type, "UA-G2-PRO");
    assert.match(result.mac, /^[0-9A-F]{12}$/);
  });

  test("an embedded address folds through the same stand-in its own record receives", () => {

    // A room identifier is keyed by the hub that drives the door. Rewriting the run through the one address mint is what keeps the identifier pointing at that
    // hub's own record instead of at nothing.
    const context = createScrubContext();
    const result = scrub({ "hub": { "mac": "02ffee000002" }, "room_id": "WR-02ffee000002-D4aKxWPrjIOp7eVbBBcfJsMtbbxVhU2n" }, context) as {

      hub: { mac: string };
      room_id: string;
    };

    assert.equal(result.room_id, "WR-" + result.hub.mac + "-D4aKxWPrjIOp7eVbBBcfJsMtbbxVhU2n");
    assert.ok(!result.room_id.includes("02ffee000002"), "the address inside the room identifier does not survive the scrub");
    assert.ok(result.room_id.startsWith("WR-"), "the structure around the address is preserved");
  });

  test("a longer hexadecimal run is destroyed whole, keeping its width and its structure", () => {

    /* A console identifier leads with an address inside one unbroken hexadecimal compound, where no delimiter says which twelve characters are the address. The
     * whole run therefore takes a same-length opaque stand-in: the address does not survive it, and the identifier keeps the exact width and punctuation a
     * consumer parses.
     */
    const planted = "02FFEE000004000000001111111100000000222222220000000033333333:1457807768";
    const context = createScrubContext();
    const result = scrub({ "console_id": planted, "host_device_mac": "02FFEE000004" }, context) as { console_id: string; host_device_mac: string };
    const [ run = "", suffix = "" ] = result.console_id.split(":");

    assert.equal(result.console_id.length, planted.length, "the identifier keeps its exact width");
    assert.equal(suffix, "1457807768", "the structure past the address is evidence and survives");
    assert.equal(run.length, 60);
    assert.ok(!result.console_id.includes("02FFEE000004"), "the address inside the console identifier does not survive the scrub");
    assert.notEqual(run, result.host_device_mac, "the long run is not the address stand-in, because which twelve characters were the address is unknowable");
  });

  test("a subnet keeps its prefix length and agrees with a host inside it", () => {

    const context = createScrubContext();
    const result = scrub({ "gateway_ip": "10.13.0.0", "ip_subnets": [ "10.13.0.0/24", "10.14.0.0/16" ] }, context) as {

      gateway_ip: string;
      ip_subnets: string[];
    };

    assert.match(result.ip_subnets[0] ?? "", /^192\.0\.2\.\d+\/24$/);
    assert.match(result.ip_subnets[1] ?? "", /^192\.0\.2\.\d+\/16$/);
    assert.equal(result.ip_subnets[0], result.gateway_ip + "/24", "the address half is remembered like any other, so the two still agree");
  });

  test("a version survives every spelling the wire gives it, while an address under an address key still does not", () => {

    /* The version keys answer ahead of the shape rules, because the bare four-part spelling a controller sometimes sends is indistinguishable from an address to a
     * guard that reads shape alone. Every spelling the wire uses is planted here rather than a sample, so a key dropped from the set fails in this test rather
     * than by quietly destroying the evidence a capture is collected for.
     */
    const versions = { "firmware": "9.8.7.6", "firmware_version": "9.8.7", "from_version": "1.0.0.0", "protect_version": "v9.8.7",
      "software_version": "9.8.7+1234", "ulp_version": "v9.8.7+1234", "version": "v9.8.76" };

    assert.deepEqual(scrubbed(versions), versions, "every version key carries its value through untouched, dotted or prefixed");

    const mixed = scrubbed({ "firmware": "9.8.7.6", "ip": "10.13.0.42", "mac": "02FFEE000002" }) as { firmware: string; ip: string; mac: string };

    assert.equal(mixed.firmware, "9.8.7.6", "a version that happens to be address-shaped is still a version");
    assert.match(mixed.ip, /^192\.0\.2\.\d+$/, "and an address under an address key is still replaced, which is the polarity that makes the rule a rule");
    assert.match(mixed.mac, /^[0-9A-F]{12}$/);

    /* The accepted limit of deciding by key: the same four numbers under a key no catalog names are read as the address they look like. The shape rules exist to
     * reach fields this library has never modeled, and that reach is worth more than a promise that every version everywhere survives.
     */
    const uncataloged = scrubbed({ "uaVocSensorBuild": "9.8.7.6" }) as { uaVocSensorBuild: string };

    assert.match(uncataloged.uaVocSensorBuild, /^192\.0\.2\.\d+$/, "a version under an uncataloged key is judged by its shape, which reads it as an address");
  });

  test("the site's locale is replaced by fixed placeholders", () => {

    // A timezone names a city and a country code names a country, so both are location under another name. There is one of each per site and nothing points at
    // them, so a conventional value says as much as a minted stand-in would.
    assert.deepEqual(scrubbed({ "country_code": "US", "time_zone": "America/New_York", "timezone": "Europe/Berlin" }),
      { "country_code": "ZZ", "time_zone": "Etc/UTC", "timezone": "Etc/UTC" });
  });

  test("a coordinate is zeroed while the numbers beside it are untouched", () => {

    // A position is identity carried as numbers, which no string rule can reach. The neighbors are the other half of the promise: a settings block mixes
    // coordinates with ordinary readings, and replacing those would destroy evidence while protecting nothing.
    const result = scrubbed({ location: { latitude: 40.741895, longitude: -73.989308, radius: 200 } }) as {

      location: { latitude: number; longitude: number; radius: number };
    };

    assert.equal(result.location.latitude, 0);
    assert.equal(result.location.longitude, 0);
    assert.equal(result.location.radius, 200, "a number under any other key is evidence, not identity");
  });

  test("the coordinate rule reads the value's type as well as its key", () => {

    // Reading the key alone would answer zero for the object below and drop everything it carried, and would turn an unset coordinate into a position at the
    // origin.
    const unset = { location: { latitude: null, longitude: null } };
    const nested = scrubbed({ latitude: { mac: "02FFEE000002", precision: 4 } }) as { latitude: { mac: string; precision: number } };

    assert.deepEqual(scrubbed(unset), unset, "a coordinate that was never set is not a position");
    assert.equal(nested.latitude.precision, 4);
    assert.match(nested.latitude.mac, /^[0-9A-F]{12}$/, "the walk went into the object and replaced what was inside it");
  });

  test("an identifying object key is replaced along with the values", () => {

    // Some controller maps are keyed by a raw hardware address, an identifier, or an address, so a scrub that only touched values would leave the identity sitting
    // in the key positions.
    const result = scrubbed({ byAddress: { "10.13.0.42": true }, byId: { "01234567-89ab-cdef-0123-456789abcdef": true },
      byMac: { "02FFEE000002": { enabled: true } } }) as { byAddress: Record<string, unknown>; byId: Record<string, unknown>; byMac: Record<string, unknown> };

    assert.match(Object.keys(result.byMac)[0] ?? "", /^[0-9A-F]{12}$/, "the replacement is still address-shaped, so the map still parses");
    assert.notEqual(Object.keys(result.byMac)[0], "02FFEE000002");
    assert.match(Object.keys(result.byId)[0] ?? "", /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    assert.match(Object.keys(result.byAddress)[0] ?? "", /^192\.0\.2\.\d+$/);
  });

  test("a key and a value carrying the same identifier agree", () => {

    const context = createScrubContext();
    const result = scrub({ byMac: { "02FFEE000002": true }, mac: "02FFEE000002" }, context) as { byMac: Record<string, unknown>; mac: string };

    assert.deepEqual(Object.keys(result.byMac), [result.mac], "the key and the value resolve to one stand-in, so the map still points at the device");
  });

  test("array elements inherit the key their array arrived under", () => {

    // Elements are judged the way a single value under that key would be, which is what reaches a list of addresses or of mail under one plural key.
    const result = scrubbed({ "broadcast_ips": [ "10.13.0.255", "access.acme.example" ], "emails": [ "jane@acme.example", "sam@acme.example",
      "jane@acme.example" ] }) as { broadcast_ips: string[]; emails: string[] };

    assert.match(result.broadcast_ips[0] ?? "", /^192\.0\.2\.\d+$/);
    assert.match(result.broadcast_ips[1] ?? "", /^host-\d+\.test\.local$/, "a mixed list is judged element by element");
    assert.match(result.emails[0] ?? "", /^user-\d+@example\.com$/);
    assert.equal(result.emails[0], result.emails[2], "the same address is the same person throughout");
    assert.notEqual(result.emails[0], result.emails[1]);
  });

  test("a config row's value is judged by the setting its sibling key names", () => {

    /* A configuration row states its subject in a sibling field and carries the payload under the literal member name `value`, which no catalog reaches and most
     * payloads match no shape. Reading the sibling is what puts each payload in front of the catalogs: a password row clears, a login row takes the login
     * stand-in, a fingerprint row keeps its width, and a row whose key text is already cataloged is reached by the inheritance alone.
     */
    const result = scrubbed({ "configs": [ { "device_id": "02ffee000001", "key": "ssh_password", "tag": "credential", "value": "9fK2pQ7mVx4LrT8nBwZq" },
      { "device_id": "02ffee000001", "key": "ssh_user", "tag": "credential", "value": "Acme username 1" },
      { "device_id": "02ffee000001", "key": "cert_fingerprint", "tag": "credential", "value": "3F1A9C7B25D048E6A1B4C93027E5F8D6B0A72C15" },
      { "device_id": "02ffee000001", "key": "alias", "tag": "device_extra", "value": "Acme Name 3" },
      { "device_id": "02ffee000001", "key": "pin_code", "tag": "credential", "value": "482913" } ] }) as { configs: { value: string }[] };

    const [ sshPassword, sshUser, fingerprint, alias, pinCode ] = result.configs.map((row) => row.value);

    assert.match(sshPassword ?? "", /^REDACTED-[0-9a-f]{8}-x{2}$/, "a password row is cleared at the length it arrived with");
    assert.match(sshUser ?? "", /^Test username \d+$/, "a login row takes the login stand-in");
    assert.match(fingerprint ?? "", /^[0-9a-f]{40}$/, "a fingerprint row keeps its width");
    assert.notEqual(fingerprint, "3F1A9C7B25D048E6A1B4C93027E5F8D6B0A72C15");
    assert.match(alias ?? "", /^Test alias \d+$/, "a key text already in a catalog is reached by the inheritance alone");
    assert.match(pinCode ?? "", /^REDACTED-[0-9a-f]{8}-$/);
  });

  test("a config row carrying settings vocabulary passes through untouched", () => {

    // The other direction of the same rule, and the one an over-eager reading would fail: most configuration rows carry a reading a diagnosis needs - a
    // brightness, a mode, the greeting a reader speaks, which access methods the hardware offers - under key texts deliberately in no catalog, so the payload
    // survives exactly as it arrived.
    const result = scrubbed({ "configs": [ { "device_id": "02ffee000001", "key": "brightness", "tag": "device_setting", "value": "36" },
      { "device_id": "02ffee000001", "key": "dps_mode", "tag": "uah_config", "value": "no" },
      { "device_id": "02ffee000001", "key": "greeting_text", "tag": "device_setting", "value": "welcome" },
      { "device_id": "02ffee000001", "key": "greeting_broadcast_name", "tag": "device_setting", "value": "first_name_only" },
      { "device_id": "02ffee000001", "key": "apple_pass", "tag": "open_door_mode", "value": "no" } ] }) as { configs: { value: string }[] };

    assert.deepEqual(result.configs.map((row) => row.value), [ "36", "no", "welcome", "first_name_only", "no" ]);
  });

  test("a config row spelled the extension way is judged the same as the device way", () => {

    /* The controller spells the same row idiom differently from one record to the next: a device entry states its subject in `key` and carries the payload in
     * `value`, while an extension entry states it in `config_key` and carries the payload in `config_value`. The rule reads whichever sibling the row spells, so
     * both spellings scrub alike - the credential clears and the setting beside it stays readable.
     */
    const result = scrubbed({ "extensions": [{ "device_id": "02ffee000001", "extension_name": "port_setting",
      "target_config": [ { "config_key": "ssh_password", "config_tag": "credential", "config_value": "9fK2pQ7mVx4LrT8nBwZq" },
        { "config_key": "dps_mode", "config_tag": "uah_config", "config_value": "no" } ] }] }) as {

      extensions: [{ target_config: { config_key: string; config_value: string }[] }];
    };

    const [ credential, setting ] = result.extensions[0].target_config;

    assert.match(credential?.config_value ?? "", /^REDACTED-[0-9a-f]{8}-x{2}$/, "the second spelling clears a credential as the first one does");
    assert.equal(credential?.config_key, "ssh_password", "the subject the row names is evidence here too");
    assert.equal(setting?.config_value, "no", "and a structural row keeps the reading a diagnosis needs");
  });

  test("a config row's other members keep their own treatment and its key text survives", () => {

    // A row is more than its payload: the device it belongs to is identity, while the tag and the key text are the vocabulary a reader diagnoses with. Taking the
    // key text as well would leave a capture showing that something was redacted without saying what it was.
    const result = scrubbed({ "configs": [{ "device_id": "02ffee000001", "key": "ssh_password", "tag": "credential",
      "value": "9fK2pQ7mVx4LrT8nBwZq" }] }) as { configs: { device_id: string; key: string; tag: string; value: string }[] };

    const [row] = result.configs;

    assert.match(row?.device_id ?? "", /^[0-9a-f]{12}$/, "the device the row belongs to is identity and takes the address stand-in");
    assert.notEqual(row?.device_id, "02ffee000001");
    assert.equal(row?.key, "ssh_password", "the key text names what the row is about and is evidence, not identity");
    assert.equal(row?.tag, "credential");
    assert.ok(!(row?.value ?? "").includes("9fK2pQ7mVx4LrT8nBwZq"), "the credential row's value does not survive the scrub");
  });

  test("a config row whose value is a container clears every string beneath it", () => {

    // The inheritance composes with the container arm rather than restating it: a secret key text reaching a structure re-enters the walk under that text, and the
    // arm that already clears a secret container answers for whatever the row nests.
    const result = scrubbed({ "key": "nacl_private_key", "value": { "issued_at": 1755300000, "material": "kR7pQ2mVx9LrT4nBwZq6Yd3Hs8Ju1Ge5Ma0Ci4Ok7Ps=",
      "peers": ["Xf2Nb8Qw5Tz1Hr6Km3Lp9Vc4Gy7Ds0Ja2Ue5Ri8Wob3="] } }) as { key: string; value: { issued_at: number; material: string; peers: string[] } };

    assert.match(result.value.material, /^REDACTED-/);
    assert.match(result.value.peers[0] ?? "", /^REDACTED-/);
    assert.equal(result.value.issued_at, 1755300000, "the container arm clears text and leaves everything else as evidence");
    assert.equal(result.key, "nacl_private_key");
  });

  test("an object carrying a value member with no text key beside it is judged by that member's own name", () => {

    // What keeps the rule to the row idiom: with no sibling text to inherit, the member is classified under its own name as any other member is, and the shape
    // backstop is still what reaches a payload carrying identity.
    const noSibling = scrubbed({ "unit": "lux", "value": "Acme Name 3" }) as { unit: string; value: string };
    const numericSibling = scrubbed({ "key": 7, "value": "Acme Name 3" }) as { key: number; value: string };
    const shaped = scrubbed({ "value": "02FFEE000002" }) as { value: string };

    assert.equal(noSibling.value, "Acme Name 3", "an uncataloged member name over a shapeless payload leaves it alone");
    assert.equal(noSibling.unit, "lux");
    assert.equal(numericSibling.value, "Acme Name 3", "a sibling that is not text names no setting");
    assert.equal(numericSibling.key, 7);
    assert.match(shaped.value, /^[0-9A-F]{12}$/, "the shape backstop still reaches a payload that carries identity");
  });

  test("the input document is not modified", () => {

    // A reference-identity check alone would pass an implementation that edited a nested object in place, so the whole document is compared against a snapshot of
    // itself taken before the call.
    const document = { devices: [{ mac: "02FFEE000002", name: "Acme Name 13" }], nvr: { host: "10.13.0.4", token: "abcdef" } };
    const before = structuredClone(document);

    scrubbed(document);

    assert.deepEqual(document, before);
  });

  test("values with nothing to hide pass through", () => {

    const document = { count: 3, empty: "", enabled: true, event: "access.door.unlock", missing: null, ratio: 1.5 };

    assert.deepEqual(scrubbed(document), document);
  });

  test("binary passes through untouched", () => {

    const bytes = Buffer.from([ 0xAA, 0xBB, 0xCC ]);
    const result = scrubbed({ payload: bytes }) as { payload: Buffer };

    assert.equal(result.payload, bytes, "bytes are not string territory, so the walk leaves them alone");
  });

  test("an identifying value under a key no catalog names is caught by its shape", () => {

    /* The backstop that reaches novelty evidence: hardware the library has never modeled can carry an address, an identifier, or a mailbox under any field name at
     * all, and the shape is what catches it - consistently, so the new record still points at the records that reference it.
     */
    const context = createScrubContext();
    const result = scrub({ "mac": "02FFEE000002", "uaVocSensorGateway": "10.13.0.1", "uaVocSensorOwner": "jane@acme.example",
      "uaVocSensorPeer": "02FFEE000002" }, context) as { mac: string; uaVocSensorGateway: string; uaVocSensorOwner: string; uaVocSensorPeer: string };

    assert.equal(result.uaVocSensorPeer, result.mac);
    assert.match(result.uaVocSensorGateway, /^192\.0\.2\.\d+$/);
    assert.match(result.uaVocSensorOwner, /^user-\d+@example\.com$/);
  });

  test("an identifier that is entirely hexadecimal at the camera width is caught by that width, in key position as well", () => {

    /* The widest identifier the wire carries and the one no catalog reaches: a camera's identity arrives under several spellings - as an event's device identifier,
     * as the object an event names, as a metadata member spelled in camelCase, and as a key the controller maps entries by. They all have to answer alike or a
     * scrubbed capture stops showing that they are one camera. The two neighbors are the other half of the promise: the width is matched whole, so a value one
     * character short of it or one character past it is not an identifier and is left as the evidence it is.
     */
    const identifier = "0a1b2c3d4e5f60718293a4b5";
    const context = createScrubContext();
    const result = scrub({ "byId": { [identifier]: true }, "device_id": identifier, "long": identifier + "a", "metadata": { "uniqueId": identifier },
      "short": identifier.slice(1) }, context) as {

      byId: Record<string, unknown>;
      device_id: string;
      long: string;
      metadata: { uniqueId: string };
      short: string;
    };

    assert.equal(result.device_id.length, identifier.length, "the stand-in keeps the width a consumer parses");
    assert.notEqual(result.device_id, identifier);
    assert.equal(result.metadata.uniqueId, result.device_id, "every spelling of one camera resolves to one stand-in");
    assert.deepEqual(Object.keys(result.byId), [result.device_id], "a map keyed by the identifier still points at the record naming it");
    assert.equal(result.short, identifier.slice(1), "a value one character short of the width carries no identity this rule knows");
    assert.equal(result.long, identifier + "a", "and neither does one a character past it");
  });

  test("a run at the camera width inside a compound identifier is answered by the embedded-run rule", () => {

    // The two rules meet on the same category, which is what keeps them from disagreeing. A compound identifier is not entirely hexadecimal, so the width rule
    // never sees it; the run inside it is rewritten where it sits, and lands on the same stand-in the bare occurrence takes because both resolve through the
    // serial regime.
    const run = "0a1b2c3d4e5f60718293a4b5";
    const context = createScrubContext();
    const result = scrub({ "device_id": run, "room_id": "WR-" + run + "-D4aKxWPrjIOp7eVbBBcfJsMtbbxVhU2n" }, context) as { device_id: string; room_id: string };

    assert.equal(result.room_id, "WR-" + result.device_id + "-D4aKxWPrjIOp7eVbBBcfJsMtbbxVhU2n", "the structure around the run survives it");
    assert.ok(!result.room_id.includes(run), "the run inside the room identifier does not survive the scrub");
  });

  test("a representative document carries none of the values planted in it", () => {

    /* The end-to-end promise, stated as a search over the serialized result: one document carrying a value of every class the catalogs and the shape rules know,
     * and not one of them survives to the bytes a capture would be shared as.
     */
    const planted = [ "02FFEE000004", "10.13.0.42", "203.0.113.77", "7ABC123", "9f2ac1-receiver-token", "9fK2pQ7mVx4LrT8nBwZq", "Acme Holdings",
      "02FFEE000002", "Dr. Jane Smith", "Loading Dock", "UBNTX1234567", "access.acme.example", "02ffee000002", "hunter2", "jane@acme.example", "jsmith",
      "host-1.acme.example" ];

    const document = {

      "agent_info": { "company_logo": "https://host-1.acme.example/logos/acme.png", "company_name": "Acme Holdings" },
      "configs": [{ "device_id": "02FFEE000004", "key": "ssh_password", "tag": "credential", "value": "9fK2pQ7mVx4LrT8nBwZq" }],
      "device": { "console_id": "02FFEE00000400000000111111110000:1457807768", "host_device_mac": "02FFEE000004", "ip": "10.13.0.42", "mac": "02FFEE000002",
        "room_id": "WR-02ffee000002-D4aKxWPrjIOp7eVbBBcfJsMtbbxVhU2n", "serial": "UBNTX1234567" },
      "door": { "latitude": 40.741895, "name": "Loading Dock" },
      "host": { "host": "access.acme.example", "time_zone": "America/New_York", "wan_ip": "203.0.113.77" },
      "user": { "credentials": { "password": "hunter2" }, "email": "jane@acme.example", "full_name": "Dr. Jane Smith",
        "license_plates": [{ "credential": "7ABC123" }], "username": "jsmith" },
      "webhook": { "headers": { "Authorization": "Bearer 9f2ac1-receiver-token" }, "url": "https://hooks.example.net/access/9f2ac1-receiver-token" }
    };

    const serialized = JSON.stringify(scrubbed(document));

    for(const value of planted) {

      assert.ok(!serialized.includes(value), "the planted value \"" + value + "\" does not survive the scrub");
    }
  });

  test("a scrubbed packet still classifies as the event it was", () => {

    // Over-scrubbing is the other way to fail: a capture whose packets fail to classify has protected the site by destroying the evidence it was collected for.
    const scrubbedPacket = scrubbed(RING) as AccessEventPacket;

    assert.equal(AccessClient.classifyPacket(RING)?.kind, "doorbellRing");
    assert.equal(AccessClient.classifyPacket(scrubbedPacket)?.kind, "doorbellRing");
    assert.equal(scrubbedPacket.event, RING.event, "the notification name is protocol vocabulary and survives verbatim");
  });

  test("the vocabulary a diagnosis needs survives the scrub", () => {

    // The values a reader diagnoses with: a hardware class, a status, the tag the extras shapes branch on, and an opaque identifier that carries no outside
    // identity. Each is evidence, and each is deliberately outside every catalog.
    const document = { "data": { "device_type": "UA-G2-PRO", "extension_name": "port_setting", "request_id": "TxC3TMGjlPk30gEYGDVsgSrIpQWWZPEb",
      "status": "assigned" }, "event": "access.remote_view" };

    assert.deepEqual(scrubbed(document), document);
  });
});

/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * webhooks.test.ts: Unit tests for the webhook payload model and the delivery signature.
 *
 * The payload half is checked by compilation as much as by assertion: the fixture module declares real deliveries against the delivery union, so a type that
 * described a shape the controller does not send would fail to build, and the switch below reaches each arm's own members without a cast.
 *
 * The signature half is asserted against a fixed vector rather than against a signature this suite computes the same way the implementation does. A self-consistent check
 * would pass just as happily on an implementation that dropped the separator or covered the wrong bytes; a frozen expected value from an independent restatement of the
 * documented scheme cannot.
 */
import type { AccessOfficialWebhookEndpoint, AccessOfficialWebhookEventName } from "./webhooks.ts";
import { describe, test } from "node:test";
import { describeDomainTable, officialPath } from "./domain.helpers.ts";
import type { AccessBootstrapConfig } from "../types/index.ts";
import type { AccessWebhookEvent } from "./webhooks.ts";
import type { DomainRow } from "./domain.helpers.ts";
import { OfficialWebhooks } from "./webhooks.ts";
import { accessBootstrap2026Fixture } from "../protocol/topology.fixtures.ts";
import { accessWebhookDeliveriesFixture } from "./webhooks.fixtures.ts";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { isAccessWebhookDelivery } from "./webhooks.ts";
import { verifyWebhookSignature } from "./webhooks.ts";

// The event names the delivery union is told apart by, named once so the vocabulary list below is checked against the union rather than against itself, and the
// one delivery a given name selects, so a test that names an event receives that event's own payload rather than the whole union.
type AccessWebhookEventName = AccessWebhookEvent["event"];
type AccessWebhookDeliveryOf<K extends AccessWebhookEventName> = Extract<AccessWebhookEvent, { event: K }>;

// The vector: a real delivery body, a secret, the timestamp the signature covers, and the MAC the documented scheme produces over them. The MAC was computed from
// the scheme as the reference states it - the decimal timestamp, a literal dot, then the body bytes - and frozen here.
const VECTOR_SECRET = "a-secret-the-controller-minted";
const VECTOR_TIMESTAMP = "1786827828";
const VECTOR_MAC = "8423e5a6f32e147699940c9a9c51adec15107068c926cd2fdab9c3aeb2f81541";

// Find the one captured delivery a test names, narrowed to its own arm, failing loudly rather than silently skipping if the corpus ever stops carrying it.
function findDelivery<K extends AccessWebhookEventName>(event: K, predicate: (delivery: AccessWebhookDeliveryOf<K>) => boolean): AccessWebhookDeliveryOf<K> {

  const found = accessWebhookDeliveriesFixture.find((delivery): delivery is AccessWebhookDeliveryOf<K> => {

    return (delivery.event === event) && predicate(delivery as AccessWebhookDeliveryOf<K>);
  });

  assert.ok(found, "the fixture corpus should carry a " + event + " delivery matching the test's description");

  return found;
}

/* The delivery the vector was computed over: the unlock the official API performed with attribution, which is the largest specimen in the corpus.
 *
 * The bytes are recovered by re-serializing the specimen rather than being embedded a second time as a string. That is exact here rather than approximate: the
 * controller sends its deliveries with no insignificant whitespace, so re-serializing the parsed document reproduces the delivered bytes - which the vector's own
 * verification is what confirms, since a single byte of difference would fail it.
 */
const VECTOR_BODY = JSON.stringify(findDelivery("access.door.unlock", (delivery) => delivery.data.actor?.type === "open-api"));

// Every device identity the topology document holds, walked out of the nesting the wire wraps hardware in.
function topologyDeviceIds(bootstrap: AccessBootstrapConfig): string[] {

  const ids: string[] = [];

  for(const group of (bootstrap.device_groups ?? [])) {

    ids.push(...group.map((device) => device.unique_id));
  }

  for(const floor of (bootstrap.floors ?? [])) {

    for(const door of floor.doors) {

      for(const group of door.device_groups) {

        ids.push(...group.map((device) => device.unique_id));
      }
    }
  }

  return ids;
}

// Build the signature header from its members, so a test that varies one of them says which one it is varying.
function signatureHeader(timestamp: string, mac: string): string {

  return "t=" + timestamp + ",v1=" + mac;
}

describe("verifyWebhookSignature", () => {

  test("accepts a delivery signed with the documented scheme", () => {

    assert.deepEqual(verifyWebhookSignature({ body: VECTOR_BODY, header: signatureHeader(VECTOR_TIMESTAMP, VECTOR_MAC), secret: VECTOR_SECRET }),
      { timestamp: 1786827828 });
  });

  test("accepts the identical delivery presented as raw bytes", () => {

    // A receiver holding the request as bytes must not have to decode it to verify it, because decoding and re-encoding is one more chance to alter what was
    // signed. The two forms of the same delivery therefore have to reach the same verdict.
    const bytes = new TextEncoder().encode(VECTOR_BODY);

    assert.deepEqual(verifyWebhookSignature({ body: bytes, header: signatureHeader(VECTOR_TIMESTAMP, VECTOR_MAC), secret: VECTOR_SECRET }),
      { timestamp: 1786827828 });
  });

  test("rejects a body that has been altered, however slightly", () => {

    const tampered = VECTOR_BODY.replace("Access Granted", "Access Denied");

    assert.notEqual(tampered, VECTOR_BODY, "the tamper must actually change the body for this to be testing anything");
    assert.equal(verifyWebhookSignature({ body: tampered, header: signatureHeader(VECTOR_TIMESTAMP, VECTOR_MAC), secret: VECTOR_SECRET }), null);
  });

  test("rejects a signature made with a different secret", () => {

    const forged = createHmac("sha256", "not-the-secret").update(VECTOR_TIMESTAMP).update(".").update(VECTOR_BODY).digest("hex");

    assert.equal(verifyWebhookSignature({ body: VECTOR_BODY, header: signatureHeader(VECTOR_TIMESTAMP, forged), secret: VECTOR_SECRET }), null);
  });

  test("rejects a signature whose timestamp does not match the one it covers", () => {

    // The timestamp is inside the signed material, so replaying a valid signature under a fresher timestamp does not produce a valid delivery. That is what lets a
    // consumer treat the header's timestamp as trustworthy once verification has passed, and compare it against its own clock.
    assert.equal(verifyWebhookSignature({ body: VECTOR_BODY, header: signatureHeader("1786827999", VECTOR_MAC), secret: VECTOR_SECRET }), null);
  });

  test("rejects a signature computed without the separator the scheme puts between the timestamp and the body", () => {

    /* The separator is what keeps the covered material unambiguous: without it, a timestamp ending in a digit and a body beginning with one would produce the same
     * bytes as a different timestamp and a different body. This vector is the same delivery signed the same way minus that one byte, so it fails here and would
     * pass against an implementation that omitted it.
     */
    const withoutSeparator = "7841a0b631b884a506d04b9c04df947c80c4909f077991ff15bef56c6c08d8c9";

    assert.equal(verifyWebhookSignature({ body: VECTOR_BODY, header: signatureHeader(VECTOR_TIMESTAMP, withoutSeparator), secret: VECTOR_SECRET }), null);
  });

  test("rejects a truncated signature cleanly rather than raising", () => {

    /* The case the length gate exists for. Hex-decoding a truncated value yields a shorter buffer, and the constant-time comparison raises on operands of unequal length
     * rather than returning false - so without the gate a truncated signature would throw at exactly the moment a receiver is handling input it has no reason to trust.
     * Both the verdict and the absence of a throw are what this asserts.
     */
    const truncated = VECTOR_MAC.slice(0, 32);

    assert.doesNotThrow(() => verifyWebhookSignature({ body: VECTOR_BODY, header: signatureHeader(VECTOR_TIMESTAMP, truncated), secret: VECTOR_SECRET }));
    assert.equal(verifyWebhookSignature({ body: VECTOR_BODY, header: signatureHeader(VECTOR_TIMESTAMP, truncated), secret: VECTOR_SECRET }), null);
  });

  test("rejects a signature that is not hexadecimal at all", () => {

    // Hex decoding stops at the first character it cannot read, so a value like this decodes to nothing and the length gate catches it in the same place a
    // truncation is caught.
    assert.equal(verifyWebhookSignature({ body: VECTOR_BODY, header: signatureHeader(VECTOR_TIMESTAMP, "not-a-signature"), secret: VECTOR_SECRET }), null);
  });

  test("rejects a header that is not the documented form", () => {

    for(const header of [ "", "no-delimiters-here", "t", VECTOR_MAC, "t=" + VECTOR_TIMESTAMP + ",v1" ]) {

      assert.equal(verifyWebhookSignature({ body: VECTOR_BODY, header, secret: VECTOR_SECRET }), null, JSON.stringify(header) + " is not a signature header");
    }
  });

  test("rejects a header missing either of the two members the scheme needs", () => {

    assert.equal(verifyWebhookSignature({ body: VECTOR_BODY, header: "t=" + VECTOR_TIMESTAMP, secret: VECTOR_SECRET }), null, "a header with no signature");
    assert.equal(verifyWebhookSignature({ body: VECTOR_BODY, header: "v1=" + VECTOR_MAC, secret: VECTOR_SECRET }), null, "a header with no timestamp");
  });

  test("rejects a timestamp that is not the decimal integer the signature covers", () => {

    for(const timestamp of [ "not-a-number", "17868278.28", "", "0x1234" ]) {

      assert.equal(verifyWebhookSignature({ body: VECTOR_BODY, header: signatureHeader(timestamp, VECTOR_MAC), secret: VECTOR_SECRET }), null,
        JSON.stringify(timestamp) + " is not a unix timestamp");
    }
  });

  test("verifies a header carrying a member the scheme does not define", () => {

    // The header is a list of versioned members, so a controller signing with a second algorithm alongside this one would add a member rather than replace the
    // one here. A verifier that rejected the whole header for carrying an unfamiliar member would stop verifying deliveries it is perfectly able to verify.
    const header = signatureHeader(VECTOR_TIMESTAMP, VECTOR_MAC) + ",v2=00112233";

    assert.deepEqual(verifyWebhookSignature({ body: VECTOR_BODY, header, secret: VECTOR_SECRET }), { timestamp: 1786827828 });
  });
});

describe("isAccessWebhookDelivery", () => {

  /* One passing delivery as plain parsed JSON, with exactly one member removed or replaced. Building each negative from a passing body is what makes the rows say
   * what they tell apart: everything else about the value is identical, so only the named member can be what the guard read.
   */
  const passing = (): Record<string, unknown> => JSON.parse(JSON.stringify(accessWebhookDeliveriesFixture[0])) as Record<string, unknown>;

  const withData = (mutate: (data: Record<string, unknown>) => void): Record<string, unknown> => {

    const body = passing();

    mutate(body["data"] as Record<string, unknown>);

    return body;
  };

  test("admits every captured delivery", () => {

    for(const delivery of accessWebhookDeliveriesFixture) {

      assert.equal(isAccessWebhookDelivery(delivery), true, delivery.event + " is a delivery the controller really sent");
    }

    assert.equal(accessWebhookDeliveriesFixture.length > 0, true, "the corpus should not be empty, or the loop above proves nothing");
  });

  test("admits a body re-parsed from JSON, which is the shape a receiver actually holds", () => {

    // The guard's real input is a parsed request body rather than the fixture's own typed objects, so this is the row that says it works on plain JSON.
    for(const delivery of accessWebhookDeliveriesFixture) {

      assert.equal(isAccessWebhookDelivery(JSON.parse(JSON.stringify(delivery))), true);
    }
  });

  test("admits a delivery whose actor is null, which is how the controller reports an unattributed event", () => {

    assert.equal(isAccessWebhookDelivery(withData((data) => { data["actor"] = null; })), true);
    assert.equal(isAccessWebhookDelivery(withData((data) => { data["device"] = null; })), true);
  });

  test("rejects a value that is not a record at all", () => {

    for(const value of [ null, undefined, "a string", 42, true, [passing()] ]) {

      assert.equal(isAccessWebhookDelivery(value), false, JSON.stringify(value ?? null) + " is not a delivery");
    }
  });

  test("rejects an event name the delivery union does not carry", () => {

    assert.equal(isAccessWebhookDelivery({ ...passing(), "event": "access.door.locked" }), false, "a plausible name the union does not model");
    assert.equal(isAccessWebhookDelivery({ ...passing(), "event": "" }), false);

    const { event: _dropped, ...withoutEvent } = passing();

    assert.equal(isAccessWebhookDelivery(withoutEvent), false, "and a body with no event member at all");
  });

  test("rejects a delivery identifier that is absent or the wrong type", () => {

    // Both shapes, because a presence-only check passes the second: a numeric identifier would reach a consumer typed as a string and be published under it.
    const { event_object_id: _dropped, ...withoutId } = passing();

    assert.equal(isAccessWebhookDelivery(withoutId), false, "an absent identifier");
    assert.equal(isAccessWebhookDelivery({ ...passing(), "event_object_id": 42 }), false, "and one carried as a number");
  });

  test("rejects a payload that is not a record", () => {

    assert.equal(isAccessWebhookDelivery({ ...passing(), "data": "x" }), false);

    const { data: _dropped, ...withoutData } = passing();

    assert.equal(isAccessWebhookDelivery(withoutData), false);
  });

  test("rejects a location that is absent or the wrong type", () => {

    assert.equal(isAccessWebhookDelivery(withData((data) => { delete data["location"]; })), false, "an absent location");
    assert.equal(isAccessWebhookDelivery(withData((data) => { data["location"] = "x"; })), false, "and one carried as a string");
    assert.equal(isAccessWebhookDelivery(withData((data) => { data["location"] = null; })), false, "the location is never null on this wire");
  });

  test("rejects a delivery that omits a nullable carrier, which is different from naming it null", () => {

    /* The distinction the presence check exists for. `device: null` is something the controller sends and the union models; a body with no device key is a body
     * that did not come from this controller, and a consumer reading `data.device` on it gets undefined where the type promises a record or null.
     */
    assert.equal(isAccessWebhookDelivery(withData((data) => { delete data["device"]; })), false, "no device key at all");
    assert.equal(isAccessWebhookDelivery(withData((data) => { delete data["actor"]; })), false, "no actor key at all");
    assert.equal(isAccessWebhookDelivery(withData((data) => { data["device"] = "x"; })), false, "and a carrier that is neither a record nor null");
  });

  test("rejects an object member that is not a record", () => {

    assert.equal(isAccessWebhookDelivery(withData((data) => { data["object"] = "x"; })), false);
    assert.equal(isAccessWebhookDelivery(withData((data) => { delete data["object"]; })), false);
  });

  test("narrows the value so a consumer switches on the event without a cast", () => {

    const body: unknown = JSON.parse(JSON.stringify(findDelivery("access.door.unlock", (delivery) => delivery.data.actor?.type === "open-api")));

    assert.ok(isAccessWebhookDelivery(body));

    // Reading the arm's own member is what proves the narrowing: this line does not compile against `unknown`.
    assert.equal(body.event === "access.door.unlock" ? typeof body.data.object.result : "", "string");
  });
});

describe("the webhook payload model", () => {

  test("each captured delivery narrows to its own payload on its event name", () => {

    let seen = 0;

    for(const delivery of accessWebhookDeliveriesFixture) {

      // Reading a member that belongs only to this arm is what proves the narrowing: none of these accesses compiles on the wider union.
      switch(delivery.event) {

        case "access.device.dps_status":

          assert.equal(delivery.data.object.event_type, "dps_change");
          assert.ok([ "close", "open" ].includes(delivery.data.object.status));
          seen++;

          break;

        case "access.door.unlock":

          assert.equal(typeof delivery.data.object.result, "string");
          assert.equal(typeof delivery.data.object.authentication_type, "string");
          seen++;

          break;

        case "access.doorbell.completed":

          assert.equal(typeof delivery.data.object.reason_code, "number");
          assert.equal(typeof delivery.data.object.request_id, "string");
          seen++;

          break;

        case "access.doorbell.incoming":

          assert.equal(typeof delivery.data.object.request_id, "string");
          seen++;

          break;

        default:

          assert.fail("the corpus carries a delivery this switch does not name: " + delivery.event);
      }
    }

    assert.equal(seen, accessWebhookDeliveriesFixture.length, "every captured delivery reached an arm");
  });

  test("every delivery names hardware and a door the topology also holds", () => {

    /* The identity claim across a third channel. The webhook payload, the topology document, and the official listings all address one controller, so a delivery's
     * device and location identifiers have to resolve in the same spaces the other two use - otherwise a receiver could not join a delivery to the state model.
     */
    const deviceIds = new Set(topologyDeviceIds(accessBootstrap2026Fixture));
    const doorIds = new Set((accessBootstrap2026Fixture.floors ?? []).flatMap((floor) => floor.doors.map((door) => door.unique_id)));
    let checked = 0;

    for(const delivery of accessWebhookDeliveriesFixture) {

      assert.equal(doorIds.has(delivery.data.location.id), true, "the topology should hold door " + delivery.data.location.id);

      if(delivery.data.device !== null) {

        assert.equal(deviceIds.has(delivery.data.device.id), true, "the topology should hold device " + delivery.data.device.id);
        checked += 1;
      }
    }

    assert.equal(checked, accessWebhookDeliveriesFixture.length, "every captured delivery carries a device, so the device half is not vacuous");
  });

  test("an attributed unlock carries the caller's identity and passthrough, and one performed by a person carries neither", () => {

    const attributed = findDelivery("access.door.unlock", (delivery) => delivery.data.actor?.type === "open-api");
    const answered = findDelivery("access.door.unlock", (delivery) => delivery.data.actor?.type === "user");

    // The members the official unlock endpoint accepts and echoes back are exactly the ones that make an automated unlock legible as the automation.
    assert.equal(attributed.data.object.actor_id, "00000000-0000-0000-0000-000000000061");
    assert.equal(attributed.data.object.actor_name, "Test Name 99");
    assert.deepEqual(attributed.data.object.extra, { probe: "slice8-webhook" });

    // The same unlock performed by a person carries none of them, which is why each is optional rather than always-present-and-empty.
    assert.equal(Object.hasOwn(answered.data.object, "actor_id"), false);
    assert.equal(Object.hasOwn(answered.data.object, "actor_name"), false);
    assert.equal(Object.hasOwn(answered.data.object, "extra"), false);
    assert.equal(answered.data.actor?.name, "Test Name 69", "the controller names the person who acted");
  });

  test("a doorbell ring and the completion that ends it name the same call", () => {

    const ring = findDelivery("access.doorbell.incoming", () => true);
    const completed = findDelivery("access.doorbell.completed", () => true);

    // The call identifier is the join key between channels: the notification socket names this same call when it reports the call ending.
    assert.equal(completed.data.object.request_id, ring.data.object.request_id);
    assert.equal(completed.data.object.reason_code, 400, "this call was answered somewhere other than the endpoint receiving the delivery");
  });

  test("a door-position delivery reports both directions, on hardware its own changelog does not list", () => {

    const closed = findDelivery("access.device.dps_status", (delivery) => delivery.data.object.status === "close");
    const opened = findDelivery("access.device.dps_status", (delivery) => delivery.data.object.status === "open");

    assert.equal(closed.data.object.event_type, "dps_change");
    assert.equal(opened.data.object.event_type, "dps_change");

    // The changelog scopes this event to two other hardware models. The controller delivered it for a Door Mini, so the documented list understates what a
    // consumer should expect rather than bounding it.
    assert.equal(closed.data.device?.device_type, "UA-Hub-Door-Mini");
  });

  test("a delivery carries the door it concerns even where that door reports no position of its own", () => {

    // A UA Hub reports its door's position on the door's own record; a Door Mini's door record carries an empty extras and the position is carried by the device instead.
    // An empty extras therefore says nothing about whether the door has a position sensor, which is exactly what the pair of deliveries here shows.
    const mini = findDelivery("access.device.dps_status", () => true);
    const hub = findDelivery("access.doorbell.incoming", () => true);

    assert.deepEqual(mini.data.location.extras, {});
    assert.equal(hub.data.location.extras["uah-input_state_dps"], "off");
  });
});

// A registered endpoint as the controller reports it. The live probe registered a plain http:// endpoint and it delivered without complaint, despite the field
// description calling for HTTPS - so that is what the fixture carries.
const ENDPOINT: AccessOfficialWebhookEndpoint = { "endpoint": "http://192.168.1.1:8080", "events": [ "access.door.unlock", "access.doorbell.incoming" ],
  "headers": { "x-shared-secret": "hunter2" }, "id": "wh-1", "name": "Homebridge", "secret": "whsec_abc123" };

const ID = "a b/c";
const ENCODED = "a%20b%2Fc";

const endpointRows: readonly DomainRow<OfficialWebhooks>[] = [

  { expected: [ENDPOINT], method: "fetchAllEndpoints", path: officialPath("/webhooks/endpoints"), reply: { "code": "SUCCESS", "data": [ENDPOINT],
    "msg": "success" }, run: async (domain, call) => domain.fetchAllEndpoints(call), verb: "GET" },

  { body: "{\"endpoint\":\"http://192.168.1.1:8080\",\"events\":[\"access.door.unlock\"],\"name\":\"Homebridge\"}", expected: ENDPOINT,
    method: "createEndpoint", path: officialPath("/webhooks/endpoints"), reply: { "code": "SUCCESS", "data": ENDPOINT, "msg": "success" },
    run: async (domain, call) => domain.createEndpoint({ endpoint: "http://192.168.1.1:8080", events: ["access.door.unlock"], name: "Homebridge" }, call), verb: "POST" },

  { body: "{\"endpoint\":\"https://example.test/hook\",\"events\":[\"access.device.dps_status\"],\"name\":\"Homebridge\"}", expected: ENDPOINT,
    method: "updateEndpoint", path: officialPath("/webhooks/endpoints/" + ENCODED), reply: { "code": "SUCCESS", "data": ENDPOINT, "msg": "success" },
    run: async (domain, call) => domain.updateEndpoint(ID, { endpoint: "https://example.test/hook", events: ["access.device.dps_status"], name: "Homebridge" }, call),
    verb: "PUT" },

  { method: "deleteEndpoint", path: officialPath("/webhooks/endpoints/" + ENCODED), reply: { "code": "SUCCESS", "msg": "success" },
    run: async (domain, call) => domain.deleteEndpoint(ID, call), verb: "DELETE" }
];

describeDomainTable({ domainClass: OfficialWebhooks, name: "OfficialWebhooks", rows: endpointRows });

describe("OfficialWebhooks registration vocabulary", () => {

  test("the registrable event names are the delivery union's own, and nothing else", () => {

    /* Indexing the delivery union is what keeps one vocabulary across both halves of this domain: the names a caller may register for are exactly the names a
     * delivery can arrive under, so the two cannot drift apart as the union grows.
     */
    const registrable: AccessOfficialWebhookEventName = "access.door.unlock";
    const literals: [ Extract<AccessOfficialWebhookEventName, "access.device.dps_status">,
      Extract<AccessOfficialWebhookEventName, "access.doorbell.completed">,
      Extract<AccessOfficialWebhookEventName, "access.visitor.status.changed"> ] = [ "access.device.dps_status", "access.doorbell.completed",
      "access.visitor.status.changed" ];

    // @ts-expect-error - a name that is not a delivery cannot be registered for, because the union is what defines the set.
    const outside: AccessOfficialWebhookEventName = "access.door.locked";

    assert.deepEqual([ registrable, outside ], [ "access.door.unlock", "access.door.locked" ]);
    assert.deepEqual(literals, [ "access.device.dps_status", "access.doorbell.completed", "access.visitor.status.changed" ]);
  });
});

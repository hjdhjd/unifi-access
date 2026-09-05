/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * events.test.ts: Unit tests for the notification classifier. The classifier's contract is that it is total over wire input and that it presents one vocabulary for the
 * controller's two notification dialects, so these tests run every captured packet through it, assert the dialect pairs collapse to the same kind, and assert the
 * translation allowlist field by field against named specimens rather than against anything re-derived from the same fixture.
 */
import { accessEventPackets2024Fixture, accessEventPacketsDoorStateFixture, accessEventPacketsFixture, accessEventPacketsHistoricalFixture,
  accessEventPacketsInteractiveFixture, accessEventPacketsOfficialSocketFixture, accessEventPacketsTamperFixture } from "./events.fixtures.ts";
import { classifyPacket, isAccessEventPacket } from "./events.ts";
import { describe, test } from "node:test";
import type { AccessEventPacket } from "../types/index.ts";
import assert from "node:assert/strict";

/* The kind each notification name classifies to, or null where the name is deliberately unmodeled. Every packet in every fixture group is checked against this.
 *
 * A name whose classification depends on the payload rather than on the name alone is a predicate here rather than a fixed kind. Either newer-dialect carrier
 * becomes a door-state event when it carries readable door state and stays the plain update it otherwise is; and the ring-change name carries two structurally
 * unrelated payloads, of which only the one naming a call is a cancellation. Re-deriving the expectation from each packet at runtime is what makes this table catch
 * a specimen that changes sides - a fixed kind would have to be edited into agreement with whatever the classifier did, which is the opposite of a check.
 */
const EXPECTED_KIND: Readonly<Record<string, string | null | ((packet: AccessEventPacket) => string | null)>> = {

  "access.base.info": null,
  "access.data.camera.update": null,
  "access.data.device.delete": "deviceRemoved",
  "access.data.device.remote_unlock": "unlock",
  "access.data.device.update": "deviceChanged",
  "access.data.location.update": "locationChanged",
  "access.data.top_log.update": null,
  "access.data.v2.device.delete": "deviceRemoved",
  "access.data.v2.device.update": (packet) => hasAdmissibleEntry(packet.data?.["location_states"]) ? "doorStateChanged" : "deviceChanged",
  "access.data.v2.location.update": (packet) => hasAdmissibleEntry([packet.data?.["state"]]) ? "doorStateChanged" : "locationChanged",
  "access.logs.add": null,
  "access.logs.insights.add": null,
  "access.remote_view": "doorbellRing",
  "access.remote_view.change": (packet) => (typeof packet.data?.["remote_call_request_id"] === "string") ? "doorbellCancel" : null,
  "access.tamper_resistant": "tamperAlert"
};

/* Whether a value is an array holding at least one entry the admission contract would take. Written here independently of the classifier's own guards, so the table
 * above is an expectation the tests hold the classifier to rather than a restatement of what it does. The location carrier's `state` member is checked through the
 * same predicate by wrapping it, because it is the same entry shape minus the door identity the envelope supplies.
 */
function hasAdmissibleEntry(value: unknown): boolean {

  if(!Array.isArray(value)) {

    return false;
  }

  return value.some((entry) => {

    if((typeof entry !== "object") || (entry === null)) {

      return false;
    }

    const record = entry as Record<string, unknown>;
    const emergency = record["emergency"] as Record<string, unknown> | undefined;
    const alarms = record["alarms"];
    const suspend = record["unlock_suspend"] as Record<string, unknown> | undefined;

    const core = (typeof record["lock"] === "string") && (typeof record["dps"] === "string") && (typeof record["dps_connected"] === "boolean") &&
      (typeof record["is_unavailable"] === "boolean") && (typeof emergency?.["hardware"] === "string") && (typeof emergency["software"] === "string");

    const optionals = ((alarms === undefined) || (Array.isArray(alarms) && alarms.every((alarm) => typeof (alarm as Record<string, unknown>)["type"] === "string"))) &&
      ((suspend === undefined) || ((typeof suspend["status"] === "string") && (typeof suspend["unlock_type"] === "string")));

    return core && optionals;
  });
}

// The canonical field names a translated device payload may carry, and the wire fields that must never survive translation into it.
const DEVICE_ADMITTED = [ "adopting", "device_type", "firmware", "guid", "hw_type", "ip", "is_online", "location_id", "revision", "start_time", "unique_id" ];
const DEVICE_EXCLUDED = [ "access_method", "alias", "cap", "category", "connected_hub_id", "direction", "mac", "name", "settings", "version" ];
const LOCATION_ADMITTED = [ "extras", "location_type", "name", "unique_id", "up_id" ];
const LOCATION_EXCLUDED = [ "device_ids", "guard", "last_activity", "state", "thumbnail" ];

// The doorbell ring payload as the current capture generation sends it, sorted, so a re-capture that drops a field or adds one fails here rather than passing quietly.
const DOORBELL_RING_FIELDS = [ "channel", "clear_request_id", "connected_uah_id", "connected_uah_type", "console_id", "controller_id", "create_time", "device_id",
  "device_name", "device_type", "disable_pickup", "door_guard_ids", "door_id", "door_name", "doorbell_channel", "floor_name", "has_package_camera",
  "host_device_mac", "hub_gate_door_mode", "in_or_out", "is_camera", "is_double_driveway", "mutable_content", "reason_code", "request_id", "room_id", "send_voip",
  "support_feature", "template_id", "token", "unlocking_not_allowed" ];

// The tamper alert payload as the capture sends it, sorted, on the same terms as the ring's field list above.
const TAMPER_ALERT_FIELDS = [ "device", "door_id", "door_name", "host_device_mac", "notify_user_ids", "request_id", "title" ];

// The call identifier the interactive window's ring carries, which is also what its cancellation names, so both specimens are found by the same value.
const INTERACTIVE_RING_REQUEST_ID = "TxC3TMGjlPk30gEYGDVsgSrIpQWWZPEb";

/* The whole captured corpus, in the order the groups were accreted. findPacket below returns the first match, so a newly accreted group spreads last: an event name that
 * more than one window carries then still resolves to the specimen the tests written before that window relied on.
 */
const allPackets = [ ...accessEventPacketsFixture, ...accessEventPackets2024Fixture, ...accessEventPacketsHistoricalFixture,
  ...accessEventPacketsInteractiveFixture, ...accessEventPacketsDoorStateFixture, ...accessEventPacketsOfficialSocketFixture,
  ...accessEventPacketsTamperFixture ];

// Build a copy of a wire record without one key, so a near-miss packet can be made by taking a real specimen and removing exactly the field a guard requires.
const withoutKey = (record: Record<string, unknown>, key: string): Record<string, unknown> => Object.fromEntries(Object.entries(record).filter(([name]) => name !== key));

// Find the one captured packet a test names, failing loudly rather than silently skipping if the corpus ever stops carrying it.
const findPacket = (predicate: (packet: AccessEventPacket) => boolean, description: string): AccessEventPacket => {

  const packet = allPackets.find(predicate);

  assert.ok(packet, "the fixture corpus should carry " + description);

  return packet;
};

describe("classifyPacket over the captured corpus", () => {

  test("classifies every captured packet to its expected kind and never throws", () => {

    assert.equal(allPackets.length, 81,
      "the corpus is the 2026 ambient window, the 2024 and historical specimens, and the interactive, door-state, official-socket, and tamper capture windows");

    for(const packet of allPackets) {

      const rule = EXPECTED_KIND[packet.event];

      assert.notEqual(rule, undefined, "every captured name should be accounted for: " + packet.event);

      const expected = (typeof rule === "function") ? rule(packet) : rule;
      const event = classifyPacket(packet);

      assert.equal((event === null) ? null : event.kind, expected, packet.event + " should classify to " + String(expected));
    }
  });

  test("both device-update dialects collapse to one kind, and both delete dialects to another", () => {

    const legacyUpdate = findPacket((packet) => packet.event === "access.data.device.update", "a legacy device update");
    const v2Update = findPacket((packet) => packet.event === "access.data.v2.device.update", "a v2 device update");
    const legacyDelete = findPacket((packet) => packet.event === "access.data.device.delete", "a legacy device delete");
    const v2Delete = findPacket((packet) => packet.event === "access.data.v2.device.delete", "a v2 device delete");

    assert.equal(classifyPacket(legacyUpdate)?.kind, "deviceChanged");
    assert.equal(classifyPacket(v2Update)?.kind, "deviceChanged");
    assert.equal(classifyPacket(legacyDelete)?.kind, "deviceRemoved");
    assert.equal(classifyPacket(v2Delete)?.kind, "deviceRemoved");
  });

  test("each delete dialect resolves identity from where that dialect carries it", () => {

    const legacyDelete = findPacket((packet) => packet.event === "access.data.device.delete", "a legacy device delete");
    const legacyEvent = classifyPacket(legacyDelete);

    // The legacy dialect names the entity in the envelope and echoes it in the record it sends.
    assert.equal(legacyEvent?.kind, "deviceRemoved");
    assert.equal(legacyEvent.id, legacyDelete.event_object_id);
    assert.equal(legacyEvent.id, "00000000000000000000000c");

    const v2Delete = findPacket((packet) => packet.event === "access.data.v2.device.delete", "a v2 device delete");
    const v2Event = classifyPacket(v2Delete);

    // The v2 dialect sends no payload at all and names the entity in the packet metadata, where the envelope identifier is a per-notification value.
    assert.equal(v2Delete.data, null);
    assert.equal(v2Event?.kind, "deviceRemoved");
    assert.equal(v2Event.id, v2Delete.meta?.id);
    assert.equal(v2Event.id, "00000000000000000000000c");
    assert.notEqual(v2Event.id, v2Delete.event_object_id);
  });

  test("a v2 device update takes its identity from the packet metadata", () => {

    const packet = findPacket((entry) => (entry.event === "access.data.v2.device.update") && (entry.meta?.id === "aabbcc000001"), "the v2 hub update");
    const event = classifyPacket(packet);

    assert.equal(event?.kind, "deviceChanged");
    assert.equal(event.id, "aabbcc000001");
    assert.equal(event.eventName, "access.data.v2.device.update");
  });
});

describe("v2 device payload translation", () => {

  const packet = findPacket((entry) => (entry.event === "access.data.v2.device.update") && (entry.meta?.id === "aabbcc000001"), "the v2 hub update");
  const event = classifyPacket(packet);

  assert.equal(event?.kind, "deviceChanged");

  const payload = event.payload;

  test("translates to exactly the allowlist subset and nothing else", () => {

    assert.deepEqual(Object.keys(payload).sort(), DEVICE_ADMITTED);
  });

  test("carries each admitted field under its canonical name with its wire value", () => {

    assert.equal(payload.unique_id, "aabbcc000001");
    assert.equal(payload.is_online, true);
    assert.equal(payload.adopting, false);
    assert.equal(payload.device_type, "UAH");
    assert.equal(payload.firmware, "v4.12.19.0");
    assert.equal(payload.guid, "00000000-0000-0000-0000-000000000007");
    assert.equal(payload.hw_type, "");
    assert.equal(payload.ip, "192.0.2.2");
    assert.equal(payload.location_id, "00000000-0000-0000-0000-000000000006");
    assert.equal(payload.revision, "1786095367040183648");
    assert.equal(payload.start_time, 1780317315);
  });

  test("drops the pre-translation wire names once they are renamed", () => {

    // The dialect's own names for identity and connectivity must not survive alongside the canonical ones they became.
    assert.equal(Object.hasOwn(payload, "id"), false);
    assert.equal(Object.hasOwn(payload, "online"), false);
  });

  test("drops every excluded field", () => {

    for(const field of DEVICE_EXCLUDED) {

      assert.equal(Object.hasOwn(payload, field), false, field + " should not reach canonical state");
    }
  });

  test("excludes a field the wire carried, proving the drop is real rather than absent from this specimen", () => {

    // The hub's payload really does send these, so their absence above is the allowlist working rather than a sparse packet.
    const wire = packet.data ?? {};

    assert.equal(wire["name"], "Test Name 76");
    assert.equal(wire["version"], "v4.12.195");
    assert.equal(wire["connected_hub_id"], "");
    assert.equal(wire["cap"], null);
  });

  test("normalizes a millisecond start_time to whole seconds by magnitude", () => {

    const cameraPacket = findPacket((entry) => (entry.event === "access.data.v2.device.update") && (entry.data?.["start_time"] === 1782282073038),
      "the camera-class update whose start_time arrives in milliseconds");
    const cameraEvent = classifyPacket(cameraPacket);

    assert.equal(cameraEvent?.kind, "deviceChanged");
    assert.equal(cameraEvent.payload.start_time, 1782282073);
  });

  test("leaves a whole-second start_time untouched", () => {

    assert.equal(payload.start_time, 1780317315, "a native device already reports seconds and must not be divided");
  });

  test("translates only the admitted fields a payload actually carries", () => {

    /* Every captured v2 device payload happens to carry all eleven admitted fields, so a payload that omits some of them is synthetic. The behavior matters anyway:
     * a firmware that trimmed its payload must yield a translation of what arrived rather than a translation padded with absent keys.
     */
    const sparse = { ...packet, data: withoutKey(withoutKey(packet.data ?? {}, "firmware"), "guid") } as AccessEventPacket;
    const sparseEvent = classifyPacket(sparse);

    assert.equal(sparseEvent?.kind, "deviceChanged");
    assert.equal(Object.hasOwn(sparseEvent.payload, "firmware"), false, "an absent field should not be invented");
    assert.equal(Object.hasOwn(sparseEvent.payload, "guid"), false);

    // What it did carry still translates.
    assert.equal(sparseEvent.payload.unique_id, "aabbcc000001");
    assert.equal(sparseEvent.payload.is_online, true);
  });
});

describe("v2 location payload translation", () => {

  const stateBearing = findPacket((entry) => (entry.event === "access.data.v2.location.update") && (entry.data?.["guard"] !== undefined),
    "a v2 location update carrying the fields the allowlist excludes");

  /* The translation this describe asserts is what a location update does with its own fields, which is unchanged by whether the packet also carries door state. The
   * specimen is stripped of that state so it keeps exercising the translation path rather than the door-state one; the companion test below asserts that the original,
   * unstripped packet does take the door-state path, so the strip is a scoping of this describe rather than a claim about the wire.
   */
  const packet = { ...stateBearing, data: withoutKey(stateBearing.data ?? {}, "state") } as AccessEventPacket;
  const event = classifyPacket(packet);

  assert.equal(event?.kind, "locationChanged");

  const payload = event.payload;

  test("the same specimen with its door state intact classifies as a door-state event instead", () => {

    const stateful = classifyPacket(stateBearing);

    assert.equal(stateful?.kind, "doorStateChanged");
    assert.notEqual(stateBearing.data?.["state"], undefined, "the unstripped specimen really does carry door state");
  });

  test("translates to exactly the allowlist subset", () => {

    assert.deepEqual(Object.keys(payload).sort(), LOCATION_ADMITTED);
    assert.equal(event.id, "00000000-0000-0000-0000-000000000006");
  });

  test("carries each admitted field under its canonical name", () => {

    assert.equal(payload.unique_id, "00000000-0000-0000-0000-000000000006");
    assert.equal(payload.location_type, "door");
    assert.equal(payload.name, "Test Name 10");
    assert.equal(payload.up_id, "00000000-0000-0000-0000-000000000001");

    // The wire sends this as null, which the payload type admits and the merge later skips as not-carried.
    assert.equal(payload.extras, null);
  });

  test("drops the pre-translation identity name and every excluded field", () => {

    assert.equal(Object.hasOwn(payload, "id"), false);

    for(const field of LOCATION_EXCLUDED) {

      assert.equal(Object.hasOwn(payload, field), false, field + " should not reach canonical state");
    }
  });

  test("excludes fields the wire really carried on this specimen", () => {

    // Read from the unstripped specimen, which is what the controller actually sent: the exclusions above are only meaningful against a packet that carried the
    // fields being excluded.
    const wire = stateBearing.data ?? {};

    assert.ok(Array.isArray(wire["device_ids"]));
    assert.ok(Array.isArray(wire["guard"]));
    assert.notEqual(wire["state"], undefined);
    assert.notEqual(wire["thumbnail"], undefined);
  });
});

describe("legacy payload passthrough", () => {

  test("a legacy device update passes through carrying its wire values untranslated", () => {

    const packet = findPacket((entry) => (entry.event === "access.data.device.update") && (entry.event_object_id === "aabbcc000002"), "the legacy reader update");
    const event = classifyPacket(packet);

    assert.equal(event?.kind, "deviceChanged");
    assert.equal(event.id, "aabbcc000002");
    assert.equal(event.payload.unique_id, "aabbcc000002");
    assert.equal(event.payload.revision, "1785876758583455467");
    assert.equal(event.payload.ip, "192.0.2.3");
    assert.equal(event.payload.is_online, true);

    // A field the v2 allowlist excludes survives here, which is what shows no translation ran on this dialect.
    assert.equal(Object.hasOwn(event.payload, "mac"), true);
  });

  test("a legacy location update passes through and takes identity from the envelope", () => {

    const packet = findPacket((entry) => (entry.event === "access.data.location.update") && (entry.event_object_id === "00000000-0000-0000-0000-000000000006"),
      "the legacy door update");
    const event = classifyPacket(packet);

    assert.equal(event?.kind, "locationChanged");
    assert.equal(event.id, "00000000-0000-0000-0000-000000000006");
    assert.equal(event.payload.full_name, "Test Name 11");

    // The legacy dialect nulls this key, which the payload type admits because null here means not-carried.
    assert.equal(event.payload.previous_name, null);
  });
});

describe("the doorbell and unlock specimens", () => {

  test("a ring classifies and is attributed to the reader named in its payload", () => {

    const packet = findPacket((entry) => entry.event === "access.remote_view", "the historical ring specimen");
    const event = classifyPacket(packet);

    assert.equal(event?.kind, "doorbellRing");
    assert.equal(event.id, "aabbcc000002");
    assert.equal(event.payload.device_id, "aabbcc000002");
    assert.equal(event.payload.channel, "00000000-0000-0000-0000-000000000052");

    // The envelope identifier on this notification is a per-notification value, which is why the attribution comes from the payload instead.
    assert.notEqual(event.id, packet.event_object_id);
  });

  test("a ring cancellation classifies and carries the call it cancels", () => {

    const packet = findPacket((entry) => entry.event === "access.remote_view.change", "a historical ring cancellation specimen");
    const event = classifyPacket(packet);

    assert.equal(event?.kind, "doorbellCancel");
    assert.equal(typeof event.payload.remote_call_request_id, "string");
  });

  test("a remote unlock classifies and carries the envelope identifier", () => {

    const packet = findPacket((entry) => entry.event === "access.data.device.remote_unlock", "the historical remote unlock specimen");
    const event = classifyPacket(packet);

    assert.equal(event?.kind, "unlock");

    // On this notification the envelope names the device that performed the unlock, while the payload carries the door's own location record.
    assert.equal(event.id, "aabbcc000001");
    assert.equal(packet.data?.["unique_id"], "00000000-0000-0000-0000-00000000004c");
  });

  test("a door unlock classifies, carrying the envelope identifier through as its identity", () => {

    /* This packet is synthetic. No capture in any corpus carries this name, which is why nothing else in this suite reaches the classifier's arm for it. The name
     * is modeled because the library's own earlier consumers filtered on it, and its identity space is unverified against the wire: that is precisely why the
     * classifier carries the envelope identifier through as-is rather than resolving it against anything.
     */
    const synthetic: AccessEventPacket = { "data": null, "event": "access.door.unlock", "event_object_id": "00000000-0000-0000-0000-000000000006",
      "receiver_id": "", "save_to_history": false };
    const event = classifyPacket(synthetic);

    assert.equal(event?.kind, "unlock");
    assert.equal(event.id, synthetic.event_object_id);
    assert.equal(event.eventName, "access.door.unlock");
  });

  test("a ring missing the reader it should name is not classified", () => {

    const packet = findPacket((entry) => entry.event === "access.remote_view", "the historical ring specimen");
    const nearMiss = { ...packet, data: withoutKey(packet.data ?? {}, "device_id") } as AccessEventPacket;

    assert.equal(classifyPacket(nearMiss), null);
  });

  test("a ring cancellation missing the call it should name is not classified", () => {

    const packet = findPacket((entry) => entry.event === "access.remote_view.change", "a historical ring cancellation specimen");
    const nearMiss = { ...packet, data: withoutKey(packet.data ?? {}, "remote_call_request_id") } as AccessEventPacket;

    assert.equal(classifyPacket(nearMiss), null);
  });

  test("the two payloads sharing the ring-change name are told apart by the call identifier alone", () => {

    /* The controller sends two structurally unrelated payloads under this one name during a single call: a disposition that names the call it ended, and - when the
     * call is answered - a record of the unlock that followed. Only the first is a cancellation. The second stays unclassified and reaches consumers on the raw
     * rail, because the unlock it describes has already been reported under its own name, and lifting this one as well would report a single door opening twice.
     */
    const disposition = findPacket((entry) => (entry.event === "access.remote_view.change") && (entry.data?.["remote_call_request_id"] !== undefined),
      "a ring cancellation specimen");
    const outcome = findPacket((entry) => (entry.event === "access.remote_view.change") && (entry.data?.["remote_call_request_id"] === undefined),
      "the answered-call unlock record that reuses the ring-change name");

    assert.equal(classifyPacket(disposition)?.kind, "doorbellCancel");
    assert.equal(classifyPacket(outcome), null);

    // The specimens differ in a dozen fields, so classifying each of them correctly proves nothing about which field decided it. Swapping only the call identifier
    // between them does: each one takes the other's classification, which is what ties the decision to that field rather than to anything that travels with it.
    const anonymized = { ...disposition, data: withoutKey(disposition.data ?? {}, "remote_call_request_id") } as AccessEventPacket;
    const identified = { ...outcome, data: { ...outcome.data, "remote_call_request_id": "4laAz56oPVVqSpb2VFlxLD5eY7ALktUn" } } as AccessEventPacket;

    assert.equal(classifyPacket(anonymized), null);
    assert.equal(classifyPacket(identified)?.kind, "doorbellCancel");

    // The outcome record really does carry the unlock detail its raw-rail residence is about, so its declining to classify is the adjudication working rather than
    // the specimen being empty.
    assert.equal(outcome.data?.["authentication_type"], "CALL");
    assert.equal(outcome.data?.["source"], "bell");
    assert.equal(outcome.data?.["success"], true);
  });
});

describe("the tamper alert", () => {

  test("classifies, attributed to the hardware its payload names rather than to the envelope", () => {

    const packet = findPacket((entry) => entry.event === "access.tamper_resistant", "the tamper alert specimen");
    const event = classifyPacket(packet);

    assert.equal(event?.kind, "tamperAlert");
    assert.equal(event.id, "aabbcc000000");
    assert.equal(event.payload.device.unique_id, "aabbcc000000");

    // The envelope identifier on this notification is a per-notification value, which is why the attribution comes from the payload instead.
    assert.notEqual(event.id, packet.event_object_id);

    // The rest of the payload is carried exactly as the wire delivered it, which is what makes the guard's one identity check the whole of its contract.
    assert.deepEqual(Object.keys(event.payload).sort(), TAMPER_ALERT_FIELDS);
    assert.equal(event.payload.door_id, "00000000-0000-0000-0000-000000000002");
    assert.deepEqual(event.payload.notify_user_ids, ["00000000-0000-0000-0000-00000000000b"]);
  });

  test("a payload naming no device is not classified rather than classified against an invented identity", () => {

    const packet = findPacket((entry) => entry.event === "access.tamper_resistant", "the tamper alert specimen");

    assert.equal(classifyPacket({ ...packet, data: withoutKey(packet.data ?? {}, "device") } as AccessEventPacket), null);

    // A device object present but carrying no identity fails the same way, because the identity is the whole of what the guard requires.
    assert.equal(classifyPacket({ ...packet, data: { ...packet.data, "device": { "name": "Test Name 6" } } }), null);
  });
});

describe("the interactive capture specimens", () => {

  test("a ring carries the full payload its capture generation sends", () => {

    const packet = findPacket((entry) => entry.data?.["request_id"] === INTERACTIVE_RING_REQUEST_ID, "the interactive ring specimen");
    const event = classifyPacket(packet);

    assert.equal(event?.kind, "doorbellRing");
    assert.equal(event.id, "aabbcc000002");
    assert.deepEqual(Object.keys(event.payload).sort(), DOORBELL_RING_FIELDS);

    // Reading optional members off the typed payload is what proves they are reachable through the type, which a key-list comparison alone does not show.
    assert.equal(event.payload.door_id, "00000000-0000-0000-0000-000000000006");
    assert.equal(event.payload.create_time, 1786729371);
  });

  test("a ring and the cancellation that ends it name the same call", () => {

    const ringPacket = findPacket((entry) => entry.data?.["request_id"] === INTERACTIVE_RING_REQUEST_ID, "the interactive ring specimen");
    const cancelPacket = findPacket((entry) => entry.data?.["remote_call_request_id"] === INTERACTIVE_RING_REQUEST_ID, "the cancellation of the interactive ring");
    const ringEvent = classifyPacket(ringPacket);
    const cancelEvent = classifyPacket(cancelPacket);

    assert.equal(ringEvent?.kind, "doorbellRing");
    assert.equal(cancelEvent?.kind, "doorbellCancel");
    assert.equal(cancelEvent.payload.reason_code, 105);

    // Each side is classified from its own packet, so the match is the controller's correlation rather than one payload compared against itself.
    assert.equal(cancelEvent.payload.remote_call_request_id, ringEvent.payload.request_id);
  });

  test("a remote unlock takes its identity from the hub the envelope names", () => {

    const packet = findPacket((entry) => (entry.event === "access.data.device.remote_unlock") && Object.hasOwn(entry.data ?? {}, "previous_name"),
      "the interactive remote unlock specimen");
    const event = classifyPacket(packet);

    assert.equal(event?.kind, "unlock");

    // The envelope names the hub that performed the unlock while the payload carries the door's own location record, which is why the two identifiers differ.
    assert.equal(event.id, "aabbcc000001");
    assert.equal(packet.data?.["unique_id"], "00000000-0000-0000-0000-000000000006");
  });

  test("the allowlist holds against state carriers that have no bootstrap counterpart", () => {

    const packet = findPacket((entry) => entry.data?.["wire_state"] !== undefined, "the v2 device update carrying the wiring-terminal map");
    const event = classifyPacket(packet);

    // This specimen carries door state, so it is a door-state event whose device facet is where the translated device fields land. The allowlist governs that facet
    // exactly as it governed the standalone device payload, which is the point: one translation, reached by two kinds.
    assert.equal(event?.kind, "doorStateChanged");
    assert.ok(event.device, "a device-carried door-state event carries the device facet");

    const payload = event.device.payload;

    // A subset assertion rather than an equality one: this specimen need not carry every admitted field, and what is being asserted is that nothing outside the allowlist
    // leaks into canonical state.
    for(const field of Object.keys(payload)) {

      assert.ok(DEVICE_ADMITTED.includes(field), field + " should not reach canonical state");
    }

    for(const field of [ "cap", "location_states", "wire_state" ]) {

      assert.equal(Object.hasOwn(payload, field), false, field + " has nothing in the bootstrap vocabulary to merge into");
    }

    // The wire record really carries each of them, so their absence above is the allowlist working rather than a sparse packet.
    const wire = packet.data ?? {};

    assert.notEqual(wire["location_states"], undefined);
    assert.notEqual(wire["wire_state"], undefined);
    assert.ok(Array.isArray(wire["cap"]));

    // The door state the same packet carried reaches the event rather than being dropped alongside the fields the allowlist excludes.
    assert.equal(event.states.length, 1);
    assert.equal(event.states[0]?.location_id, "00000000-0000-0000-0000-000000000006", "the entry names the door this hub drives");
  });
});

describe("door-state classification", () => {

  // The Door Mini and the door it drives, named once so every assertion below cites the specific hardware rather than re-deriving identity from the packet it is
  // checking.
  const DOOR_MINI = "aabbcc000004";
  const DOOR_MINI_DOOR = "00000000-0000-0000-0000-00000000000e";

  // A device-carrier specimen and its door-state array, for the synthetic near-miss cases below. Each case rebuilds the array rather than editing the fixture, so
  // the corpus stays the corpus.
  const deviceCarrier = findPacket((entry) => (entry.event === "access.data.v2.device.update") && (entry.meta?.id === DOOR_MINI) &&
    Array.isArray(entry.data?.["location_states"]), "the Door Mini device update carrying door state");
  const entryOf = (packet: AccessEventPacket): Record<string, unknown> => {

    const entry = (packet.data?.["location_states"] as Record<string, unknown>[])[0];

    assert.ok(entry, "the specimen should carry a door-state entry to build near-misses from");

    return structuredClone(entry);
  };

  const withStates = (states: unknown[]): AccessEventPacket => ({ ...deviceCarrier, data: { ...deviceCarrier.data, "location_states": states } }) as AccessEventPacket;

  test("a device update carrying door state classifies with its entry and its own device facet", () => {

    const packet = findPacket((entry) => (entry.event === "access.data.v2.device.update") && (entry.meta?.id === DOOR_MINI) &&
      ((entry.data?.["location_states"] as { dps: string }[] | undefined)?.[0]?.dps === "close"), "the Door Mini update reporting a closed door");
    const event = classifyPacket(packet);

    assert.equal(event?.kind, "doorStateChanged");
    assert.equal(event.states.length, 1);

    const entry = event.states[0];

    assert.equal(entry?.location_id, DOOR_MINI_DOOR);
    assert.equal(entry.lock, "locked");
    assert.equal(entry.dps, "close");
    assert.equal(entry.dps_connected, true);
    assert.deepEqual(entry.emergency, { hardware: "none", software: "none" });

    // The device carrier contributes the device facet and only that one: its own translated fields come along, and there is no location facet to invent.
    assert.equal(event.device?.id, DOOR_MINI);
    assert.equal(event.device.payload.unique_id, DOOR_MINI);
    assert.equal(event.device.payload.device_type, "UA-Hub-Door-Mini");
    assert.equal(event.device.payload.is_online, true);
    assert.equal(event.location, undefined);
  });

  test("a location update carrying door state takes its door identity from the envelope and carries the location facet", () => {

    const packet = findPacket((entry) => (entry.event === "access.data.v2.location.update") && (entry.meta?.id === DOOR_MINI_DOOR) &&
      ((entry.data?.["state"] as { alarms?: unknown[] } | undefined)?.alarms !== undefined), "the Door Mini door update reporting a force-unlock alarm");
    const event = classifyPacket(packet);

    assert.equal(event?.kind, "doorStateChanged");
    assert.equal(event.states.length, 1);

    const entry = event.states[0];

    // The state member itself names no door - the envelope does - so this is where the two are joined.
    assert.equal(Object.hasOwn(packet.data?.["state"] as object, "location_id"), false, "the state member carries no door identity of its own");
    assert.equal(entry?.location_id, DOOR_MINI_DOOR);
    assert.equal(entry.dps, "open");
    assert.deepEqual(entry.alarms, [{ type: "force_unlock" }]);

    // The location carrier contributes the location facet and only that one.
    assert.equal(event.location?.id, DOOR_MINI_DOOR);
    assert.equal(event.location.payload.unique_id, DOOR_MINI_DOOR);
    assert.equal(event.location.payload.name, "Test Name 22");
    assert.equal(event.location.payload.location_type, "door");
    assert.equal(event.device, undefined);
  });

  test("the legacy dialect's door position stays untranslated and classifies as it always did", () => {

    const packet = findPacket((entry) => (entry.event === "access.data.device.update") && (entry.event_object_id === DOOR_MINI), "the legacy Door Mini update");
    const event = classifyPacket(packet);

    assert.equal(event?.kind, "deviceChanged");

    // The older dialect reports the door position as a configuration row rather than as door state, and it passes through untranslated - readable by a consumer that
    // wants it, and deliberately not folded into the door-state model.
    const configs = event.payload.configs as { key: string; value: string }[] | undefined;

    assert.ok(configs?.some((config) => config.key === "input_d1_dps"), "the legacy payload carries the door position sensor as a configuration row");
  });

  test("a mixed-validity array admits its valid entries and drops the rest, with the facet still carried", () => {

    const valid = entryOf(deviceCarrier);
    const invalid = entryOf(deviceCarrier);

    delete invalid["location_id"];

    const event = classifyPacket(withStates([ invalid, valid ]));

    assert.equal(event?.kind, "doorStateChanged");
    assert.equal(event.states.length, 1, "the entry naming no door is dropped while its sibling is admitted");
    assert.equal(event.states[0]?.location_id, DOOR_MINI_DOOR);
    assert.equal(event.device?.id, DOOR_MINI, "the packet's device facet is carried regardless of which entries were dropped");
  });

  test("an entry whose optional member is malformed is rejected rather than admitted without it", () => {

    // Alarm data that cannot be read says nothing about whether an alarm is in force, so admitting the entry with its alarms dropped would report "no alarm" on the
    // strength of a payload we did not understand. The entry is rejected instead, and with nothing else in the array the packet falls through to a device update.
    const alarming = entryOf(deviceCarrier);

    alarming["alarms"] = "not-an-array";

    assert.equal(classifyPacket(withStates([alarming]))?.kind, "deviceChanged");

    // The same rule holds for the other optional member, so neither predicate is the only one enforced.
    const suspended = entryOf(deviceCarrier);

    suspended["unlock_suspend"] = { "status": 42, "unlock_type": "" };

    assert.equal(classifyPacket(withStates([suspended]))?.kind, "deviceChanged");

    // A well-formed optional is admitted, which is what shows the rejections above are the guard working rather than the members being unreadable in general.
    const clean = entryOf(deviceCarrier);

    clean["unlock_suspend"] = { "status": "end", "unlock_type": "" };

    const event = classifyPacket(withStates([clean]));

    assert.equal(event?.kind, "doorStateChanged");
    assert.deepEqual(event.states[0]?.unlock_suspend, { "status": "end", "unlock_type": "" });
  });

  test("a device update whose door-state array is empty or wholly unreadable falls through to a device update", () => {

    assert.equal(classifyPacket(withStates([]))?.kind, "deviceChanged", "an empty array reports no door, so there is no door-state event to make of it");

    const invalid = entryOf(deviceCarrier);

    delete invalid["emergency"];

    assert.equal(classifyPacket(withStates([ invalid, "not-an-object" ]))?.kind, "deviceChanged");
  });

  test("a location update whose state member is malformed falls through to a location update", () => {

    const packet = findPacket((entry) => (entry.event === "access.data.v2.location.update") && (entry.data?.["state"] !== undefined),
      "a v2 location update carrying door state");

    // Two shapes of malformed: a record that is missing what an entry requires, and a member that is not a record at all. Both fall through to the location update
    // the packet would otherwise have been, rather than to nothing.
    for(const state of [ { lock: "locked" }, "not-an-object", 42 ]) {

      const malformed = { ...packet, data: { ...packet.data, state } } as AccessEventPacket;
      const event = classifyPacket(malformed);

      assert.equal(event?.kind, "locationChanged", JSON.stringify(state) + " is not a door-state report");
      assert.equal(event.id, packet.meta?.id);
    }
  });
});

describe("packets the classifier declines", () => {

  test("the unmodeled names classify as null", () => {

    for(const name of [ "access.data.camera.update", "access.base.info", "access.data.top_log.update", "access.logs.add", "access.logs.insights.add" ]) {

      const packet = findPacket((entry) => entry.event === name, "a " + name + " packet");

      assert.equal(classifyPacket(packet), null);
    }
  });

  test("a name outside the vocabulary classifies as null rather than throwing", () => {

    const packet = findPacket((entry) => entry.event === "access.data.device.update", "a legacy device update");

    for(const name of [ "access.data.user.update", "access.logs.add", "access.something.invented" ]) {

      assert.equal(classifyPacket({ ...packet, event: name }), null);
    }
  });

  test("an update whose payload is not a record classifies as null", () => {

    const legacyUpdate = findPacket((entry) => entry.event === "access.data.device.update", "a legacy device update");
    const v2Update = findPacket((entry) => entry.event === "access.data.v2.device.update", "a v2 device update");
    const legacyLocation = findPacket((entry) => entry.event === "access.data.location.update", "a legacy location update");
    const v2Location = findPacket((entry) => entry.event === "access.data.v2.location.update", "a v2 location update");

    for(const packet of [ legacyUpdate, v2Update, legacyLocation, v2Location ]) {

      assert.equal(classifyPacket({ ...packet, data: null }), null, packet.event + " with no payload should decline");
    }
  });

  test("a v2 packet with no metadata to identify its subject classifies as null", () => {

    const update = findPacket((entry) => entry.event === "access.data.v2.device.update", "a v2 device update");
    const remove = findPacket((entry) => entry.event === "access.data.v2.device.delete", "a v2 device delete");
    const location = findPacket((entry) => entry.event === "access.data.v2.location.update", "a v2 location update");

    for(const packet of [ update, remove, location ]) {

      assert.equal(classifyPacket({ ...packet, meta: undefined }), null, packet.event + " without metadata should decline");
    }
  });
});

describe("isAccessEventPacket", () => {

  test("accepts every captured packet in the corpus", () => {

    // The corpus is the positive half of the proof, and it is what keeps the check from drifting toward over-strictness: a guard that rejected any real
    // notification would silently drop live traffic, so every specimen the controller actually sent has to pass.
    for(const packet of allPackets) {

      assert.equal(isAccessEventPacket(packet), true, packet.event + " is a packet the controller really sent");
    }
  });

  test("accepts a delete-shaped packet whose payload is null", () => {

    // A deletion legitimately carries no payload, so requiring a record here would reject a whole class of real notifications.
    const packet = findPacket((entry) => entry.event === "access.data.v2.device.delete", "a v2 device delete");

    assert.equal(packet.data, null);
    assert.equal(isAccessEventPacket(packet), true);
  });

  test("rejects a record missing the envelope identifier", () => {

    /* The case the check exists for. Asserting this value into the packet type instead would hand consumers an identifier that is undefined while typed as a
     * string, and it would be published under that identifier as though it were real.
     */
    const packet = findPacket((entry) => entry.event === "access.data.device.update", "a legacy device update");

    assert.equal(isAccessEventPacket(withoutKey(packet as unknown as Record<string, unknown>, "event_object_id")), false);
    assert.equal(isAccessEventPacket(withoutKey(packet as unknown as Record<string, unknown>, "event")), false);
    assert.equal(isAccessEventPacket(withoutKey(packet as unknown as Record<string, unknown>, "data")), false, "an absent payload member is not the same as a null one");
  });

  test("rejects a record whose envelope members are of the wrong type", () => {

    const packet = findPacket((entry) => entry.event === "access.data.device.update", "a legacy device update");

    assert.equal(isAccessEventPacket({ ...packet, "event": 42 }), false);
    assert.equal(isAccessEventPacket({ ...packet, "event_object_id": null }), false);
    assert.equal(isAccessEventPacket({ ...packet, "data": "a string payload" }), false);
  });

  test("rejects values that are not records at all", () => {

    for(const value of [ null, undefined, 42, "a string", true, [ 1, 2, 3 ] ]) {

      assert.equal(isAccessEventPacket(value), false, String(value) + " is not a notification packet");
    }
  });
});

/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * capture.helpers.ts: The capture-backed record builders every protocol suite composes its fixtures from - a real device out of a committed topology document and
 * the variations the suites need on one - beside the captured notification corpus, the finder that names one packet out of it, and the classify-and-assert pair
 * every suite reads a typed event through.
 *
 * The discipline these serve is that a test's subject is a record the controller actually issued. Every builder starts from a captured device and varies exactly
 * what the test is about, so an assertion is about the flags rather than about a mock shape, and every builder answers a FRESH record: the capture is shared across
 * every suite in the run, so a builder that wrote through it would corrupt the evidence for whatever ran next.
 */
import type { AccessBootstrapConfig, AccessDeviceConfig, AccessDeviceEntryConfig, AccessEventPacket } from "../types/index.ts";
import { accessEventPackets2024Fixture, accessEventPacketsDoorStateFixture, accessEventPacketsFixture, accessEventPacketsHistoricalFixture,
  accessEventPacketsInteractiveFixture, accessEventPacketsOfficialSocketFixture, accessEventPacketsTamperFixture } from "./events.fixtures.ts";
import type { AccessTypedEvent } from "./events.ts";
import { accessBootstrap2026Fixture } from "./topology.fixtures.ts";
import assert from "node:assert/strict";
import { classifyPacket } from "./events.ts";
import { topologyDevices } from "../testing.helpers.ts";

// The real hardware the committed captures carry, by identity: a UA Ultra, a UA Hub and one of its readers, a UA Hub Door Mini, and the Enterprise Access Hub of
// the second document.
export const ULTRA_ID = "aabbcc000000";
export const UAH_ID = "aabbcc000001";
export const READER_ID = "aabbcc000002";
export const MINI_ID = "aabbcc000004";
export const EAH_ID = "aabbcc000005";

// The port configuration entry a hub names an assignable input terminal's duty in, and the extension it travels on. Both are spelled here rather than imported so
// that the tests do not agree with the implementation by construction: a helper reaching for the implementation's own names would answer with them whatever they
// were spelled as.
const DUTY_EXTENSION = "port_setting";
const DUTY_ENTRY = "rex_button_mode";

// One captured device by identity, failing loudly rather than quietly narrowing a suite if a document ever stops carrying it. The record handed back is the
// document's own object, which is what makes every builder below responsible for copying whatever it varies.
export const captured = (id: string, document: AccessBootstrapConfig = accessBootstrap2026Fixture): AccessDeviceConfig => {

  const device = topologyDevices(document).find((candidate) => candidate.unique_id === id);

  assert.ok(device !== undefined, "the capture should carry device " + id);

  return device;
};

/* One captured device wearing a different set of flags. The record is real - its identity, model, and every member the caller does not vary come from the capture -
 * and only the configuration rows are replaced, which is what keeps a test about the flags rather than about a mock shape.
 */
export const withFlags = (id: string, flags: Record<string, string>,
  document: AccessBootstrapConfig = accessBootstrap2026Fixture): AccessDeviceConfig => {

  const device = captured(id, document);
  const configs: AccessDeviceEntryConfig[] = Object.entries(flags).map(([ key, value ]) => ({ "device_id": id, key, "tag": "hub_action", value }));

  return { ...device, configs };
};

/* One captured device with its port extension's duty entry reassigned, or with its extensions taken away entirely when no duty is given. The duty is the wire's own
 * string rather than a narrowed vocabulary, so a value no hardware has been observed to report is a legal argument and the reads can be held to answering nothing
 * for it. The extension array and the entry are copied rather than written through, because the captured record is shared with every other suite in the run.
 */
export const withDuty = (id: string, duty: string | undefined, document: AccessBootstrapConfig = accessBootstrap2026Fixture): AccessDeviceConfig => {

  const device = captured(id, document);

  if(duty === undefined) {

    const next = { ...device };

    delete next.extensions;

    return next;
  }

  return { ...device, extensions: device.extensions?.map((extension) => ((extension.extension_name !== DUTY_EXTENSION) ? extension : { ...extension,
    "target_config": extension.target_config.map((entry) => ((entry.config_key !== DUTY_ENTRY) ? entry : { ...entry, "config_value": duty })) })) };
};

/* A topology document with one device record swapped for the one given, so a suite that reduces a whole document can put a varied record in front of the reducer.
 * The document is cloned rather than edited, for the same reason the record builders copy: the fixture is shared.
 */
export const documentWith = (document: AccessBootstrapConfig, device: AccessDeviceConfig): AccessBootstrapConfig => {

  const next = JSON.parse(JSON.stringify(document)) as AccessBootstrapConfig;
  const groups = [ ...(next.device_groups ?? []), ...(next.floors ?? []).flatMap((floor) => floor.doors.flatMap((door) => door.device_groups)) ];
  let replaced = false;

  for(const group of groups) {

    const index = group.findIndex((candidate) => candidate.unique_id === device.unique_id);

    if(index !== -1) {

      group[index] = device;
      replaced = true;
    }
  }

  assert.ok(replaced, "the capture should carry device " + device.unique_id);

  return next;
};

/* The whole captured corpus, in the order the groups were accreted. findPacket below returns the first match, so a newly accreted group spreads last: an event name
 * that more than one window carries then still resolves to the specimen the tests written before that window relied on.
 */
export const capturedPackets: readonly AccessEventPacket[] = [ ...accessEventPacketsFixture, ...accessEventPackets2024Fixture,
  ...accessEventPacketsHistoricalFixture, ...accessEventPacketsInteractiveFixture, ...accessEventPacketsDoorStateFixture,
  ...accessEventPacketsOfficialSocketFixture, ...accessEventPacketsTamperFixture ];

/* Find the one captured packet a test names, failing loudly rather than silently skipping if the corpus ever stops carrying it. The search covers the whole capture
 * by default; a caller that means one capture window names it through the corpus option, which is how a test says which window its specimen came out of.
 */
export function findPacket(predicate: (packet: AccessEventPacket) => boolean, description: string,
  options: { corpus?: readonly AccessEventPacket[] } = {}): AccessEventPacket {

  const packet = (options.corpus ?? capturedPackets).find(predicate);

  assert.ok(packet, "the fixture corpus should carry " + description);

  return packet;
}

/**
 * Classify a captured packet, failing the test that asked rather than handing back a nullable the caller has to narrow.
 *
 * The classifier answers `null` for a notification the library does not model, which every suite driving a modeled packet would otherwise have to rule out at each
 * call. Asserting it here is what keeps the failure inside the row that asked - naming the packet that stopped classifying - and what lets a caller read the
 * event's own members without a narrowing step of its own.
 *
 * @param packet - The captured packet to classify.
 *
 * @returns The typed event the classifier lifted the packet into.
 */
export function classify(packet: AccessEventPacket): AccessTypedEvent {

  const event = classifyPacket(packet);

  assert.ok(event, "the packet should classify");

  return event;
}

/**
 * Classify a captured packet and assert which member of the event union it became, handing it back as that member.
 *
 * A suite reading a translated payload wants the member, not the union, and a row deriving it inside itself is what keeps a failure attached to the row rather
 * than to the describe block that collected it. The return carries one cast: the kind is compared at runtime, but the comparison runs against a generic `K`
 * rather than a literal, and the compiler does not carry a generic through a property comparison into a narrowing of the union itself. The cast is answerable
 * for exactly what the line above it established.
 *
 * @param packet - The captured packet to classify.
 * @param kind   - The member the packet has to classify as.
 *
 * @returns The event, as the member named.
 */
export function classifyAs<K extends AccessTypedEvent["kind"]>(packet: AccessEventPacket, kind: K): Extract<AccessTypedEvent, { kind: K }> {

  const event = classify(packet);

  assert.equal(event.kind, kind, "the packet should classify as " + kind + " rather than as " + event.kind);

  return event as Extract<AccessTypedEvent, { kind: K }>;
}

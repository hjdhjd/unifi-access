/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * capture.helpers.test.ts: Unit tests for the capture-backed record builders - the named identities, the record lookup and the refusal behind it, the
 * variation builders, the document splice, the accreted packet corpus with its finder, and the classify-and-assert pair the protocol suites read events through.
 *
 * Every builder here fails loudly by design, and no consumer has ever handed one an input that would make it: a suite that merely calls a builder passes whether
 * or not the guard still guards. So each refusal is driven in the direction the consumers never take, beside the clean case it has to let through, and the
 * copying discipline is asserted from the capture's own side - a builder that wrote through a shared record would corrupt the evidence for whatever ran next.
 *
 * No network, no timer, and no filesystem anywhere in this file: every subject is a pure function over a committed capture document.
 */
import { EAH_ID, MINI_ID, READER_ID, UAH_ID, ULTRA_ID, captured, capturedPackets, classify, classifyAs, documentWith, findPacket, withDuty,
  withFlags } from "./capture.helpers.ts";
import { accessBootstrap2026Fixture, accessBootstrapEahFixture } from "./topology.fixtures.ts";
import { accessEventPackets2024Fixture, accessEventPacketsDoorStateFixture, accessEventPacketsFixture, accessEventPacketsHistoricalFixture,
  accessEventPacketsInteractiveFixture, accessEventPacketsOfficialSocketFixture, accessEventPacketsTamperFixture } from "./events.fixtures.ts";
import { describe, test } from "node:test";
import { present, topologyDevices } from "../testing.helpers.ts";
import type { AccessBootstrapConfig } from "../types/index.ts";
import assert from "node:assert/strict";

/* The port configuration entry and the extension that carries it, spelled here rather than imported for the reason capture.helpers.ts:25-27 gives: a test that
 * reached for the implementation's own names would agree with it whatever it spelled them as.
 */
const DUTY_ENTRY = "rex_button_mode";
const DUTY_EXTENSION = "port_setting";

// An identity shaped like the captures' own and carried by none of them, which is what every refusal below is driven with.
const MISSING_ID = "aabbccffffff";

describe("the captured identities", () => {

  test("each named id resolves to a record carrying it", () => {

    for(const id of [ ULTRA_ID, UAH_ID, READER_ID, MINI_ID ]) {

      assert.equal(captured(id).unique_id, id);
    }

    // The Enterprise hub is hardware of the second capture alone, so it resolves against that document rather than the default one.
    assert.equal(captured(EAH_ID, accessBootstrapEahFixture).unique_id, EAH_ID);
    assert.throws(() => captured(EAH_ID), /the capture should carry device aabbcc000005/);
  });

  test("captured hands back the document's own record", () => {

    const own = present(topologyDevices(accessBootstrap2026Fixture).find((candidate) => candidate.unique_id === ULTRA_ID), "the Ultra's own record");

    assert.ok(Object.is(captured(ULTRA_ID), own), "the document's own object is what makes every builder below responsible for copying what it varies");
  });

  test("captured refuses an id the document lacks, naming it", () => {

    assert.throws(() => captured(MISSING_ID), /the capture should carry device aabbccffffff/);
  });
});

describe("withFlags", () => {

  test("withFlags replaces exactly the configuration rows and leaves the captured record untouched", () => {

    const original = captured(ULTRA_ID);
    const originalConfigs = original.configs;
    const result = withFlags(ULTRA_ID, { "door_thumbnail": "on", "led_mode": "off" });

    assert.deepEqual(result.configs, [

      { "device_id": ULTRA_ID, "key": "door_thumbnail", "tag": "hub_action", "value": "on" },
      { "device_id": ULTRA_ID, "key": "led_mode", "tag": "hub_action", "value": "off" }
    ]);

    // Everything but the rows is the captured record's own: putting the original rows back makes the result that record again.
    assert.deepEqual({ ...result, configs: originalConfigs }, original);
    assert.ok(Object.is(captured(ULTRA_ID).configs, originalConfigs), "the capture still carries the rows it was read with, so nothing was written through");
  });
});

describe("withDuty", () => {

  test("withDuty removes the extensions when no duty is given", () => {

    const original = captured(ULTRA_ID);
    const result = withDuty(ULTRA_ID, undefined);

    assert.equal(Object.hasOwn(result, "extensions"), false, "the member is gone rather than present and undefined");
    assert.ok(original.extensions, "the capture still carries the extensions the removal copied away from");
  });

  test("withDuty rewrites the duty entry of the port extension", () => {

    const port = present(captured(ULTRA_ID).extensions?.find((extension) => extension.extension_name === DUTY_EXTENSION), "the Ultra's duty extension");

    const rewritten = present(withDuty(ULTRA_ID, "rex").extensions?.find((extension) => extension.extension_name === DUTY_EXTENSION), "the rewritten duty extension");

    assert.equal(rewritten.target_config.find((entry) => entry.config_key === DUTY_ENTRY)?.config_value, "rex");

    // Every entry the duty does not name is the captured one, and the capture's own entry still reads the value it was captured with.
    for(const [ index, entry ] of rewritten.target_config.entries()) {

      if(entry.config_key === DUTY_ENTRY) {

        continue;
      }

      assert.deepEqual(entry, port.target_config[index]);
    }

    assert.equal(port.target_config.find((entry) => entry.config_key === DUTY_ENTRY)?.config_value, "dps");
  });

  test("withDuty passes a non-matching extension through unchanged", () => {

    const original = captured(READER_ID);
    const result = withDuty(READER_ID, "rex");

    assert.deepEqual(result, original);
    assert.ok(Object.is(result.extensions?.[0], original.extensions?.[0]), "an extension the duty does not name is handed back as it is rather than rebuilt");
  });
});

describe("documentWith", () => {

  test("documentWith splices the record into its door group and clones the rest", () => {

    const varied = withDuty(ULTRA_ID, "rex");
    const result = documentWith(accessBootstrap2026Fixture, varied);

    assert.ok(Object.is(topologyDevices(result).find((candidate) => candidate.unique_id === ULTRA_ID), varied), "the document holds the given object itself");

    // The rest of the document is a clone, so no record the result carries is one of the fixture's own, and the fixture still holds the record it always did.
    assert.equal(Object.is(topologyDevices(result).find((candidate) => candidate.unique_id === UAH_ID), captured(UAH_ID)), false);
    assert.ok(Object.is(captured(ULTRA_ID), topologyDevices(accessBootstrap2026Fixture).find((candidate) => candidate.unique_id === ULTRA_ID)),
      "the fixture still holds its own Ultra record");
  });

  test("documentWith splices a record held in the root groups", () => {

    /* The default capture attaches all its hardware to doors, so a building-hosted record is stated here rather than found - which is what puts the walk's root
     * arm in front of the splice at all.
     */
    const rooted: AccessBootstrapConfig = { ...accessBootstrap2026Fixture, "device_groups": [[captured(READER_ID)]] };
    const varied = withFlags(READER_ID, { "led_mode": "off" });

    assert.ok(Object.is(documentWith(rooted, varied).device_groups?.[0]?.[0], varied), "the splice puts the given object in place of the building's own record");
  });

  test("documentWith refuses a record the document lacks, naming it", () => {

    const absent = { ...captured(ULTRA_ID), "unique_id": MISSING_ID };

    assert.throws(() => documentWith(accessBootstrap2026Fixture, absent), /the capture should carry device aabbccffffff/);
  });
});

describe("the captured packet corpus", () => {

  test("capturedPackets concatenates the capture windows in accretion order", () => {

    const windows = [ accessEventPacketsFixture, accessEventPackets2024Fixture, accessEventPacketsHistoricalFixture, accessEventPacketsInteractiveFixture,
      accessEventPacketsDoorStateFixture, accessEventPacketsOfficialSocketFixture, accessEventPacketsTamperFixture ];

    assert.equal(capturedPackets.length, windows.reduce((total, window) => total + window.length, 0));
    assert.ok(Object.is(capturedPackets[0], accessEventPacketsFixture[0]), "the earliest window opens the corpus");
    assert.ok(Object.is(capturedPackets.at(-1), accessEventPacketsTamperFixture.at(-1)), "the newest window closes it");
  });

  test("findPacket returns the first match in accretion order", () => {

    // The ordering is only observable where more than one packet answers the predicate, so the specimen is the earliest packet whose event the corpus repeats.
    const repeated = capturedPackets.find((packet) => capturedPackets.filter((candidate) => candidate.event === packet.event).length > 1);

    assert.ok(repeated, "the corpus carries at least one event name more than once");
    assert.ok(Object.is(findPacket((packet) => packet.event === repeated.event, "a repeated event"), repeated), "the first match in accretion order is the one found");
  });

  test("findPacket searches only the named corpus", () => {

    const inside = present(accessEventPacketsTamperFixture[0], "the tamper window's opening packet");
    const outside = present(capturedPackets[0], "the first captured packet");

    // One predicate, answered inside the window it names and refused outside it, which is what says the option narrows the search rather than decorating it.
    assert.ok(Object.is(findPacket((packet) => Object.is(packet, inside), "the tamper window's opening packet", { corpus: accessEventPacketsTamperFixture }),
      inside), "the predicate is answered inside the window it names");
    assert.throws(() => findPacket((packet) => Object.is(packet, outside), "a packet from another window", { corpus: accessEventPacketsTamperFixture }),
      /the fixture corpus should carry a packet from another window/);
  });

  test("findPacket refuses a packet the corpus lacks, naming the description", () => {

    assert.throws(() => findPacket(() => false, "an event no capture carries"), /the fixture corpus should carry an event no capture carries/);
  });
});

describe("classify", () => {

  test("refuses a packet the classifier declines to model", () => {

    // The classifier answers null for a notification the library does not model, and a caller reading the event's members off that null is the failure this
    // refusal moves to the packet itself.
    const unmodeled = findPacket((entry) => entry.event === "access.data.camera.update", "an unmodeled notification");

    assert.throws(() => classify(unmodeled), { message: /the packet should classify/ });
  });

  test("refuses a classifiable packet asked for the wrong member", () => {

    const packet = findPacket((entry) => (entry.event === "access.data.v2.device.update") && (entry.meta?.id === UAH_ID), "the v2 hub update");

    assert.throws(() => classifyAs(packet, "locationChanged"), { message: /locationChanged.*deviceChanged/ });
  });

  test("hands back the event the classifier answered, narrowed rather than rebuilt", () => {

    const packet = findPacket((entry) => (entry.event === "access.data.v2.device.update") && (entry.meta?.id === UAH_ID), "the v2 hub update");

    // The classifier mints a fresh event per call, so the comparison is by value: what it says is that the narrowing adds nothing to the event and takes
    // nothing off it.
    assert.deepEqual(classifyAs(packet, "deviceChanged"), classify(packet));
  });
});

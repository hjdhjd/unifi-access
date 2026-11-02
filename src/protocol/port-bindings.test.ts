/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * port-bindings.test.ts: Unit tests for the port-binding reads. Every record here is a real one from a committed topology capture or the scrubbed excerpt of one
 * captured update below, varied only where the case needs it, so the selection and the bindings it yields are exercised against the extension lists a controller
 * actually issues; and every absence assertion asks whether the member is there at all rather than comparing it to undefined, because absent and present-but-undefined
 * are what the record shape keeps apart.
 */
import type { AccessPortBinding, AccessPortBindingSource } from "./port-bindings.ts";
import { EAH_ID, READER_ID, UAH_ID, ULTRA_ID, captured } from "./capture.helpers.ts";
import { describe, test } from "node:test";
import { firstPortBinding, portExtensionsOf, readPortBindings } from "./port-bindings.ts";
import type { AccessDeviceConfig } from "../types/index.ts";
import { accessBootstrapEahFixture } from "./topology.fixtures.ts";
import assert from "node:assert/strict";
import { expectAt } from "homebridge-plugin-utils/testing";

// The UA Ultra's one binding, as the 2026 document delivers it: its single port, the door that port serves, and the name the controller wrote beside it.
const ULTRA_BINDING: AccessPortBinding = { doorId: "00000000-0000-0000-0000-000000000002", name: "Test Name 4", port: "port1" };

/* The Enterprise Access Hub's eight bindings, in the document's own delivery order. The ports are deliberately out of numeric order because the controller
 * delivered them that way, and delivered order is what every read here answers in.
 */
const EAH_BINDINGS: readonly AccessPortBinding[] = [

  { doorId: "00000000-0000-0000-0000-000000000013", name: "Test Name 29", port: "port2" },
  { doorId: "00000000-0000-0000-0000-000000000027", name: "Test Name 54", port: "port6" },
  { doorId: "00000000-0000-0000-0000-000000000014", name: "Test Name 31", port: "port3" },
  { doorId: "00000000-0000-0000-0000-000000000016", name: "Test Name 35", port: "port8" },
  { doorId: "00000000-0000-0000-0000-000000000028", name: "Test Name 58", port: "port1" },
  { doorId: "00000000-0000-0000-0000-000000000015", name: "Test Name 33", port: "port4" },
  { doorId: "00000000-0000-0000-0000-000000000025", name: "Test Name 50", port: "port7" },
  { doorId: "00000000-0000-0000-0000-000000000017", name: "Test Name 37", port: "port5" }
];

/* The port extensions of one captured UA Gate update, reduced to the rows the keys are read from, every identity a stand-in. The first port names its relay before its
 * sensor and the second the other way round, as the controller delivered them, so a read going by position would fail here.
 */
const GATE_DOOR_1 = "00000000-0000-0000-0000-000000000090";
const GATE_DOOR_2 = "00000000-0000-0000-0000-000000000091";
const GATE_EXTENSIONS = [

  { "extension_name": "port_setting", "source_id": "port1", "target_config": [ { "config_key": "relay_key", "config_value": "output_oper1_relay" },
    { "config_key": "dps_key", "config_value": "input_gate_dps" } ], "target_name": "Test Name 90", "target_value": GATE_DOOR_1 },
  { "extension_name": "port_setting", "source_id": "port2", "target_config": [ { "config_key": "dps_key", "config_value": "input_door_dps" },
    { "config_key": "relay_key", "config_value": "output_door_lock_relay" } ], "target_name": "Test Name 91", "target_value": GATE_DOOR_2 }
];

describe("the relay and door-position keys", () => {

  test("reads each port's keys from the rows a captured UA Gate carries, whatever their order", () => {

    const bindings = readPortBindings({ "extensions": GATE_EXTENSIONS });

    assert.deepEqual(bindings, [ { doorId: GATE_DOOR_1, dpsKey: "input_gate_dps", name: "Test Name 90", port: "port1", relayKey: "output_oper1_relay" },
      { doorId: GATE_DOOR_2, dpsKey: "input_door_dps", name: "Test Name 91", port: "port2", relayKey: "output_door_lock_relay" } ]);
    assert.deepEqual(firstPortBinding({ "extensions": GATE_EXTENSIONS }), bindings[0], "and the first binding carries them as the whole list does");
  });

  test("a captured hub whose configuration carries neither row has neither member", () => {

    const ultra = captured(ULTRA_ID);
    const binding = expectAt(readPortBindings(ultra), 0, "the binding");

    assert.ok((ultra.extensions?.[0]?.target_config.length ?? 0) > 0, "the capture's port configuration has rows, so the read looked and found neither key");
    assert.equal(Object.hasOwn(binding, "dpsKey"), false);
    assert.equal(Object.hasOwn(binding, "relayKey"), false);
    assert.deepEqual(binding, ULTRA_BINDING);
  });

  test("a row whose value is not a string leaves its member absent and the other member standing", () => {

    const [port1] = GATE_EXTENSIONS;

    assert.ok(port1, "the excerpt should carry its first port");

    for(const value of [ true, 1 ]) {

      const bindings = readPortBindings({ "extensions": [{ ...port1, "target_config": [ { "config_key": "relay_key", "config_value": value },
        { "config_key": "dps_key", "config_value": "input_gate_dps" } ] }] });
      const binding = expectAt(bindings, 0, "the binding");

      assert.equal(Object.hasOwn(binding, "relayKey"), false, "a " + typeof value + " value is not a key");
      assert.equal(binding.dpsKey, "input_gate_dps");
    }
  });

  test("an extension carrying no target configuration has neither member", () => {

    const [port1] = GATE_EXTENSIONS;

    assert.ok(port1, "the excerpt should carry its first port");

    // The member named in the destructure exists to be discarded, which is what the underscore prefix says; the rest is the extension without it.
    const { target_config: _targetConfig, ...bare } = port1;

    assert.deepEqual(readPortBindings({ "extensions": [bare] }), [{ doorId: GATE_DOOR_1, name: "Test Name 90", port: "port1" }]);
  });

  test("an intercom pairing carrying the same rows and a door still binds nothing", () => {

    const pairing = captured(READER_ID).extensions?.[0];
    const [port1] = GATE_EXTENSIONS;

    assert.equal(pairing?.extension_name, "intercom_pair", "the reader's own extension should be the intercom pairing");
    assert.ok(port1, "the excerpt should carry its first port");

    // The captured pairing names no door, which would bind nothing on its own, so it is given one and the extension's name is all that stands between it and a binding.
    assert.deepEqual(readPortBindings({ "extensions": [{ ...pairing, "target_config": port1.target_config, "target_value": GATE_DOOR_1 }] }), []);
  });
});

describe("readPortBindings", () => {

  test("reads every binding a captured record carries, in the order the controller delivered them", () => {

    // The single-door hub and the eight-port one, which is what shows the read is a list rather than an answer that happens to be right at one binding. The
    // Enterprise hub's ports arrive out of numeric order in the capture, so an implementation that sorted them would fail here.
    assert.deepEqual(readPortBindings(captured(ULTRA_ID)), [ULTRA_BINDING]);
    assert.deepEqual(readPortBindings(captured(EAH_ID, accessBootstrapEahFixture)), EAH_BINDINGS);

    // The two ways a record answers nothing: no extensions at all, and extensions that are not ports. Both are honest, and neither is an error.
    assert.deepEqual(readPortBindings(captured(UAH_ID)), [], "a hub carrying no extensions binds no door through one");
    assert.deepEqual(readPortBindings(captured(READER_ID)), [], "and a reader's only extension is an intercom pairing rather than a port");
  });

  test("leaves out a member the record carries no evidence for rather than answering with it undefined", () => {

    const ultra = captured(ULTRA_ID);
    const extension = ultra.extensions?.[0];

    assert.ok(extension, "the capture should carry the UA Ultra's port extension");

    // The two members named in the destructure exist to be discarded, which is what the underscore prefixes say; the rest is the extension without them.
    const { source_id: _sourceId, target_name: _targetName, ...bare } = extension;
    const bindings = readPortBindings({ ...ultra, "extensions": [bare] });
    const binding = expectAt(bindings, 0, "the binding");

    assert.deepEqual(bindings, [{ doorId: ULTRA_BINDING.doorId }]);
    assert.equal(Object.hasOwn(binding, "name"), false, "a name nothing established is absent from the object rather than present and undefined");
    assert.equal(Object.hasOwn(binding, "port"), false, "and so is a port nothing established");
  });

  test("passes over an extension that binds no door, and answers the first that does as the first binding", () => {

    /* The one shape no capture holds: a port the controller names without naming a door for it. A port like that is real - the expansion still presents it - but
     * it binds nothing, so a binding carrying an empty door identity would be inventing one.
     */
    const eah = captured(EAH_ID, accessBootstrapEahFixture);
    const extensions = eah.extensions;

    assert.ok(extensions?.[0], "the capture should carry the Enterprise Access Hub's port extensions");

    const { target_value: _targetValue, ...unnamed } = extensions[0];
    const unbound: AccessDeviceConfig = { ...eah, "extensions": [ unnamed, ...extensions.slice(1) ] };

    assert.deepEqual(readPortBindings(unbound), EAH_BINDINGS.slice(1), "the port naming no door is left out and the other seven stand where they were");
    assert.deepEqual(firstPortBinding(unbound), EAH_BINDINGS[1], "so the first binding is the first extension that names a door rather than the first extension");
    assert.equal(firstPortBinding(captured(UAH_ID)), undefined, "and a record carrying no extensions at all answers no first binding");
  });

  test("stops at the first binding and never reads an extension past it", () => {

    const ultra = captured(ULTRA_ID);

    /* An extension whose only member throws the moment anything reads it. The first-only read answering at all is what says the scan stopped where it found its
     * answer, and the whole-list read throwing is the positive control: it shows the throwing member is reachable, so the answer above was not a false pass.
     */
    const poison = { get "extension_name"(): string {

      throw new Error("an extension past the first binding was read");
    } };

    assert.ok(ultra.extensions?.[0], "the capture should carry the UA Ultra's port extension");

    const record: AccessPortBindingSource = { ...ultra, "extensions": [ ultra.extensions[0], poison ] };

    assert.equal(firstPortBinding(record)?.doorId, ULTRA_BINDING.doorId, "the first binding is answered from the first extension, with the one past it untouched");
    assert.throws(() => readPortBindings(record), /an extension past the first binding was read/,
      "while the whole-list read does reach it, which is what shows the first-only read stopped rather than the record being harmless");
  });
});

describe("portExtensionsOf", () => {

  test("selects the port bindings alone out of a record carrying an extension of another kind", () => {

    // A reader's intercom pairing beside the Ultra's port binding, both of them captured records rather than invented ones. The device type is what scopes the
    // access-point expansion, but which extensions are port bindings is this selection's to say, and a pairing is not one.
    const ultra = captured(ULTRA_ID);
    const pairing = captured(READER_ID).extensions?.[0];

    assert.ok(ultra.extensions?.[0], "the capture should carry the UA Ultra's port extension");
    assert.equal(pairing?.extension_name, "intercom_pair", "and the reader's own extension should be the intercom pairing");

    const mixed: AccessDeviceConfig = { ...ultra, "extensions": [ ...ultra.extensions, pairing ] };

    assert.deepEqual([...portExtensionsOf(mixed)], ultra.extensions, "the pairing is not a port binding, so the selection passes it over");
    assert.deepEqual(readPortBindings(mixed), [ULTRA_BINDING], "and the bindings read answers the one port the record does bind");
  });
});

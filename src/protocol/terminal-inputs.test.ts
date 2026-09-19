/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * terminal-inputs.test.ts: Unit tests for the hub terminal catalog. Every device record here is a real one from a committed topology capture with its rows varied,
 * so the reads are exercised against the shapes a controller actually issues rather than against invented ones, and every absence assertion asks whether the member
 * is there at all rather than comparing it to undefined - the facts union's arms are told apart by which keys they carry.
 */
import { ACCESS_TERMINAL_INPUTS, readTerminalFlag, readTerminalInput, readTerminalKey, terminalFamiliesOf } from "./terminal-inputs.ts";
import { EAH_ID, MINI_ID, READER_ID, UAH_ID, ULTRA_ID, captured, documentWith, withDuty, withFlags } from "./capture.helpers.ts";
import { accessBootstrap2026Fixture, accessBootstrapEahFixture } from "./topology.fixtures.ts";
import { describe, test } from "node:test";
import type { AccessDeviceConfig } from "../types/index.ts";
import assert from "node:assert/strict";

/* One port of the captured Enterprise Access Hub as the access-point expansion synthesizes it: the hub's own record without its extensions, wearing the fields of
 * the one port extension that names this port. That leaves the whole hub's rows on the record and exactly one `source_id` to read them under, which is the shape
 * the reads have to answer for a single port rather than for all eight.
 */
const synthesizedPort = (sourceId: string): AccessDeviceConfig => {

  const { extensions = [], ...hub } = captured(EAH_ID, accessBootstrapEahFixture);
  const extension = extensions.find((candidate) => candidate.source_id === sourceId);

  assert.ok(extension !== undefined, "the capture should carry the extension for " + sourceId);

  const { target_name: _targetName, target_value: _targetValue, ...port } = extension;

  return { ...hub, ...port };
};

// One record with a named set of its rows raised to `on`, leaving every other row exactly as the capture wrote it.
const raise = (device: AccessDeviceConfig, keys: readonly string[]): AccessDeviceConfig => {

  const raised = new Set(keys);

  return { ...device, "configs": device.configs.map((row) => (raised.has(row.key) ? { ...row, "value": "on" } : row)) };
};

describe("the terminal vocabulary", () => {

  test("names every terminal a hub reports, in the order a listing renders them", () => {

    assert.deepEqual([...ACCESS_TERMINAL_INPUTS], [ "dps", "rel", "ren", "rex", "sideDps" ]);
  });

  test("establishes nothing at all for hardware that carries no terminals", () => {

    // A reader presents credentials and drives nothing, so it carries none of these keys. That is absent evidence rather than a report of nothing being wired.
    for(const input of ACCESS_TERMINAL_INPUTS) {

      assert.deepEqual(readTerminalInput(captured(READER_ID), input), {}, input + " should establish nothing on a reader");
    }
  });
});

describe("readTerminalInput against the captures as they stand", () => {

  test("reports every UA Hub terminal as in service with nothing wired to it", () => {

    // Both captured UA Hub units carry all four terminals with every pair member reading off, which is a hub whose screw terminals have nothing attached.
    const hub = captured(UAH_ID);

    for(const input of [ "dps", "rel", "ren", "rex" ] as const) {

      assert.deepEqual(readTerminalInput(hub, input), { "wired": false }, input + " should report nothing wired");
    }
  });

  test("says nothing about a side door the UA Hub does not report", () => {

    // The side door's keys come from field reports rather than from any capture in hand, so a captured hub that carries none of them establishes neither verdict.
    assert.deepEqual(readTerminalInput(captured(UAH_ID), "sideDps"), {});
  });

  test("reads a UA Hub Door Mini's two terminals under port one, and nothing it does not carry", () => {

    // A single-door hub speaks the numbered port vocabulary as port one, so its position sensor and its request to exit both answer while the UA Hub's own release
    // terminal, whose key the Mini never carries, does not.
    const mini = captured(MINI_ID);

    assert.deepEqual(readTerminalInput(mini, "dps"), { "wired": false });
    assert.deepEqual(readTerminalInput(mini, "rex"), { "wired": false });
    assert.deepEqual(readTerminalInput(mini, "rel"), {});
  });

  test("reads the UA Ultra's duty selector as the wiring evidence its hardware reports no pair for", () => {

    /* The Ultra has one assignable input terminal and reports no wiring pair whatsoever. Its port extension says that terminal is serving door-position duty, so
     * the position is in service and reads from the input row while the request to exit is the duty the terminal is not serving.
     */
    const ultra = captured(ULTRA_ID);

    assert.deepEqual(readTerminalInput(ultra, "dps"), { "state": false, "wired": true });
    assert.deepEqual(readTerminalInput(ultra, "rex"), { "wired": false });
  });
});

describe("the wiring pair rule", () => {

  const wired = { "wiring_state_dps-neg": "on", "wiring_state_dps-pos": "on" };

  test("reads the terminal in both directions where both halves of the pair are live", () => {

    assert.deepEqual(readTerminalInput(withFlags(UAH_ID, { ...wired, "input_state_dps": "on" }), "dps"), { "state": true, "wired": true });
    assert.deepEqual(readTerminalInput(withFlags(UAH_ID, { ...wired, "input_state_dps": "off" }), "dps"), { "state": false, "wired": true });
  });

  test("reports nothing wired when either half of the pair goes dark, whatever the reading beside it says", () => {

    // Either half of the pair going dark is a sensor that is no longer a sensor, so the terminal reports nothing wired and carries no reading at all rather than
    // the value its row happens to still hold.
    for(const value of [ "on", "off" ]) {

      const facts = readTerminalInput(withFlags(UAH_ID, { "input_state_dps": value, "wiring_state_dps-neg": "off", "wiring_state_dps-pos": "on" }), "dps");

      assert.deepEqual(facts, { "wired": false });
      assert.equal(Object.hasOwn(facts, "state"), false, "an unwired terminal carries no reading, whatever its row says");
    }
  });

  test("establishes nothing when only one half of the pair is readable at all", () => {

    assert.deepEqual(readTerminalInput(withFlags(UAH_ID, { "input_state_dps": "on", "wiring_state_dps-neg": "on" }), "dps"), {});
  });
});

describe("the duty selector", () => {

  test("moves the wiring evidence with the duty a UA Ultra's terminal is assigned to", () => {

    // The same hardware with its one terminal reassigned: the request to exit becomes the terminal in service, and the position sensor becomes the duty it is not
    // serving. This is the assignment the consumer field reports established.
    const reassigned = withDuty(ULTRA_ID, "rex");

    assert.deepEqual(readTerminalInput(reassigned, "rex"), { "state": false, "wired": true });
    assert.deepEqual(readTerminalInput(reassigned, "dps"), { "wired": false });
  });

  test("establishes neither verdict for a duty outside the two this library has been observed to read", () => {

    const unknown = withDuty(ULTRA_ID, "aux");

    assert.deepEqual(readTerminalInput(unknown, "dps"), {});
    assert.deepEqual(readTerminalInput(unknown, "rex"), {});
  });

  test("establishes neither verdict where the hardware reports no pair and no selector", () => {

    const bare = withDuty(ULTRA_ID, undefined);

    assert.deepEqual(readTerminalInput(bare, "dps"), {});
    assert.deepEqual(readTerminalInput(bare, "rex"), {});
  });

  test("never reads the duty from the device-level configuration row that shares the key's spelling", () => {

    /* A UA Ultra and a UA Hub both carry a device-level row spelled exactly as the port extension's duty entry, reading `push` - the button's electrical behavior
     * rather than an assignment. Overriding that row with a duty name is what tells a read of the extension apart from a read of the rows: the captured value
     * matches no duty and would let the wrong read pass unnoticed, so the test hands it one that would be believed.
     */
    const collided = (duty: string): AccessDeviceConfig => {

      const device = withDuty(ULTRA_ID, undefined);

      return { ...device, "configs": device.configs.map((row) => ((row.key === "rex_button_mode") ? { ...row, "value": duty } : row)) };
    };

    assert.ok(collided("dps").configs.some((row) => row.key === "input_d1_dps"), "the family is carried, so an empty answer is the duty's absence");
    assert.deepEqual(readTerminalInput(collided("dps"), "dps"), {});
    assert.deepEqual(readTerminalInput(collided("rex"), "rex"), {});
  });
});

describe("the port rule", () => {

  test("answers nothing for a whole Enterprise Access Hub, whose eight ports each speak the same terminals", () => {

    // Eight ports speak a position sensor and a request to exit apiece, and nothing on the record says which of them a caller means. The per-port handles are what
    // answer instead, so the whole hub answers with silence rather than with the first port it happens to find.
    const hub = captured(EAH_ID, accessBootstrapEahFixture);

    assert.deepEqual(readTerminalInput(hub, "dps"), {});
    assert.deepEqual(readTerminalInput(hub, "rex"), {});
  });

  test("reads a synthesized port's own rows and no sibling's", () => {

    const third = synthesizedPort("port3");

    assert.deepEqual(readTerminalInput(third, "dps"), { "wired": false });
    assert.deepEqual(readTerminalInput(third, "rex"), { "wired": false });
  });

  test("keeps a raised sibling port out of the port it was asked about", () => {

    /* The third port's own request to exit raised, with the first port's raised beside it on the very same record - the whole hub's rows travel onto every
     * synthesized port, so a read that took the first family it found rather than this port's would answer from the wrong door.
     */
    const third = raise(synthesizedPort("port3"), [ "input_d1_button", "input_d3_button", "wiring_state_d3-button-neg", "wiring_state_d3-button-pos" ]);

    assert.deepEqual(readTerminalInput(third, "rex"), { "state": true, "wired": true });

    const first = raise(synthesizedPort("port1"), [ "input_d1_button", "input_d3_button", "wiring_state_d3-button-neg", "wiring_state_d3-button-pos" ]);

    assert.deepEqual(readTerminalInput(first, "rex"), { "wired": false }, "the first port's own pair is still dark, whatever the third port's reads");
  });
});

describe("the fallback carrier", () => {

  const supplied: Record<string, string> = { "input_state_dps": "on", "wiring_state_dps-neg": "on", "wiring_state_dps-pos": "on" };
  const fallback = (key: string): string | undefined => supplied[key];

  test("reads the keys a second carrier holds where the record itself is silent", () => {

    // A UA Hub duplicates its terminal facts onto the door it drives, and a hub whose own record has gone quiet on them is still read through that copy. The lock
    // relay alone is what keeps the family carried here, which is the rule a hub reporting a relay and no position input rests on.
    const hub = withFlags(UAH_ID, { "input_state_rly-lock_dry": "off" });

    assert.deepEqual(readTerminalInput(hub, "dps", fallback), { "state": true, "wired": true });
  });

  test("prefers the record's own row over the second carrier's copy of it", () => {

    // Where both carry a key they agree, so this is about which one to believe if they ever did not: the hub speaking about its own terminals.
    assert.deepEqual(readTerminalInput(withFlags(UAH_ID, { "input_state_dps": "off" }), "dps", fallback), { "state": false, "wired": true });
  });
});

describe("the absent-member discipline", () => {

  test("leaves every unestablished member absent rather than present and undefined", () => {

    // A consumer tells the arms apart by which keys they carry, so a member present with an undefined value would read as an arm the facts are not in.
    const none = readTerminalInput(captured(READER_ID), "dps");
    const unwired = readTerminalInput(captured(UAH_ID), "dps");
    const unreadable = readTerminalInput(withFlags(UAH_ID, { "input_state_dps": "yes", "wiring_state_dps-neg": "on", "wiring_state_dps-pos": "on" }), "dps");

    assert.deepEqual(Object.keys(none), []);
    assert.deepEqual(Object.keys(unwired), ["wired"]);
    assert.deepEqual(unreadable, { "wired": true });

    for(const member of [ "state", "wired" ]) {

      assert.equal(Object.hasOwn(none, member), false, member + " should be absent from a terminal nothing established");
    }

    assert.equal(Object.hasOwn(unwired, "state"), false, "an unwired terminal carries no reading");
    assert.equal(Object.hasOwn(unreadable, "state"), false, "a value outside the vocabulary is absent rather than guessed at");
  });
});

describe("the flag vocabulary", () => {

  test("reads the on/off pair the controller writes and nothing else", () => {

    assert.equal(readTerminalFlag("on"), true);
    assert.equal(readTerminalFlag("off"), false);

    // Guessing what an unobserved value means would be inventing a reading, so anything else reads as absent exactly like a missing key.
    for(const value of [ "", "ON", "yes", "true", 1, null, undefined ]) {

      assert.equal(readTerminalFlag(value), undefined);
    }
  });

  test("reads one key off a record, and through a fallback only where the record holds no such row", () => {

    const hub = withFlags(UAH_ID, { "input_state_rex": "on" });

    assert.equal(readTerminalKey(hub, "input_state_rex"), true);
    assert.equal(readTerminalKey(hub, "input_state_rel"), undefined);
    assert.equal(readTerminalKey(hub, "input_state_rel", () => "off"), false);
    assert.equal(readTerminalKey(hub, "input_state_rex", () => "off"), true, "the record's own row wins over the fallback");
  });
});

describe("terminalFamiliesOf", () => {

  test("counts a family the record carries by either the reading row or the lock relay beside it", () => {

    // A hub that reports a lock relay and no position input is still recognized as the family it belongs to, which is what keeps the lock half readable on a
    // record whose position row has gone.
    const relayOnly = withFlags(MINI_ID, { "output_d1_lock_relay": "off" });

    assert.deepEqual(terminalFamiliesOf(relayOnly).map((family) => family.key), ["input_d1_dps"]);
    assert.deepEqual(terminalFamiliesOf(captured(READER_ID)), []);
  });
});

describe("the capture builders", () => {

  test("answer fresh records rather than writing through the shared capture", () => {

    /* Every suite in the run reads the same fixture object, so a builder that edited it in place would corrupt whatever ran next - and would do so silently, since
     * the corrupted record is still a real one. Taking a clone first and comparing after each builder is what makes that failure loud and local.
     */
    const pristine = JSON.parse(JSON.stringify(captured(ULTRA_ID))) as AccessDeviceConfig;

    withDuty(ULTRA_ID, "rex");
    assert.deepEqual(captured(ULTRA_ID), pristine, "reassigning a duty leaves the capture as it was");

    withDuty(ULTRA_ID, undefined);
    assert.deepEqual(captured(ULTRA_ID), pristine, "taking the extensions away leaves the capture as it was");

    documentWith(accessBootstrap2026Fixture, withDuty(ULTRA_ID, undefined));
    assert.deepEqual(captured(ULTRA_ID), pristine, "swapping a record into a document leaves the capture as it was");

    assert.ok(captured(ULTRA_ID).extensions !== undefined, "and the captured Ultra still carries the port extension every other test reads");
  });

  test("swap exactly the named record into a cloned document", () => {

    const document = documentWith(accessBootstrap2026Fixture, withDuty(ULTRA_ID, undefined));

    assert.equal(captured(ULTRA_ID, document).extensions, undefined);
    assert.deepEqual(captured(UAH_ID, document), captured(UAH_ID), "and every other record arrives exactly as the capture wrote it");
  });
});

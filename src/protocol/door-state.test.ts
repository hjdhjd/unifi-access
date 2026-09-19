/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * door-state.test.ts: Unit tests for the door-state interpretation. Every device record here is a real one from the committed topology capture with its flags
 * varied, so the derivation is exercised against the shapes a controller actually issues rather than against invented ones, and every absence assertion asks
 * whether the member is there at all rather than comparing it to undefined - the seed's spread depends on key absence, which a value comparison would not catch.
 */
import { MINI_ID, READER_ID, UAH_ID, ULTRA_ID, captured, withDuty, withFlags } from "./capture.helpers.ts";
import { deriveDoorState, officialDoorPosition, officialLockState } from "./door-state.ts";
import { describe, test } from "node:test";
import type { AccessDoorStateFacts } from "./door-state.ts";
import assert from "node:assert/strict";

// The door as the derivation reads it. Most rows have nothing to say about the door itself, so the extras default to absent.
const doorWith = (extras: Record<string, string> = {}): { extras: Record<string, string> } => ({ extras });

describe("deriveDoorState", () => {

  describe("the d1 family - a UA Hub Door Mini and a UA Ultra speak these same keys", () => {

    test("reads a wired sensor's position under the family's polarity, in both directions", () => {

      const wiring = { "wiring_state_d1-dps-neg": "on", "wiring_state_d1-dps-pos": "on" };

      assert.deepEqual(deriveDoorState(doorWith(), [withFlags(MINI_ID, { ...wiring, "input_d1_dps": "on" })]), { "dps": "close", "dps_connected": true });
      assert.deepEqual(deriveDoorState(doorWith(), [withFlags(MINI_ID, { ...wiring, "input_d1_dps": "off" })]), { "dps": "open", "dps_connected": true });
    });

    test("reports an unwired sensor as the position vocabulary's own disconnected reading", () => {

      // Either half of the pair going dark is a sensor that is no longer a sensor, so the position is reported as unconnected rather than as whatever the input
      // happens to still read.
      const facts = deriveDoorState(doorWith(), [withFlags(MINI_ID, { "input_d1_dps": "on", "wiring_state_d1-dps-neg": "off", "wiring_state_d1-dps-pos": "on" })]);

      assert.deepEqual(facts, { "dps": "none", "dps_connected": false });
    });

    test("reads the duty selector as the wiring evidence where the hardware reports no pair", () => {

      /* A UA Ultra reports no wiring keys whatsoever, which is its ordinary condition rather than a fault. What it does report is which duty its one assignable
       * input terminal is serving, and a terminal assigned to door-position duty is a position sensor in service - so the input reads under the family's polarity
       * exactly as a pair-proven one does.
       */
      assert.deepEqual(deriveDoorState(doorWith(), [withFlags(ULTRA_ID, { "input_d1_dps": "on" })]), { "dps": "close", "dps_connected": true });
      assert.deepEqual(deriveDoorState(doorWith(), [withFlags(ULTRA_ID, { "input_d1_dps": "off" })]), { "dps": "open", "dps_connected": true });
    });

    test("says nothing about position at all when the hardware reports neither a wiring pair nor a duty selector", () => {

      /* The same hardware with nothing left to qualify its input: no wiring keys and no port extension to say what the terminal is for. There is no evidence
       * either way about whether that input is connected to anything, and claiming disconnection would be as much an invention as claiming a position.
       */
      const facts = deriveDoorState(doorWith(), [withDuty(ULTRA_ID, undefined)]);

      assert.equal(Object.hasOwn(facts, "dps"), false);
      assert.equal(Object.hasOwn(facts, "dps_connected"), false);
    });

    test("reads the lock relay in both directions, on each of the two carriers that share this key", () => {

      /* Both polarities on both devices rather than one each. The relay is an output the controller drives, which is why its polarity is identical across hardware
       * where the position input's is not - and asserting each carrier at both ends is what would catch a family whose relay ran the other way.
       */
      assert.deepEqual(deriveDoorState(doorWith(), [withFlags(MINI_ID, { "output_d1_lock_relay": "on" })]), { lock: "unlocked" });
      assert.deepEqual(deriveDoorState(doorWith(), [withFlags(MINI_ID, { "output_d1_lock_relay": "off" })]), { lock: "locked" });
      assert.deepEqual(deriveDoorState(doorWith(), [withFlags(ULTRA_ID, { "output_d1_lock_relay": "on" })]), { lock: "unlocked" });
      assert.deepEqual(deriveDoorState(doorWith(), [withFlags(ULTRA_ID, { "output_d1_lock_relay": "off" })]), { lock: "locked" });
    });
  });

  describe("the UA Hub's main door", () => {

    test("reads a wired sensor's position under the family's polarity, in both directions", () => {

      const wiring = { "wiring_state_dps-neg": "on", "wiring_state_dps-pos": "on" };

      assert.deepEqual(deriveDoorState(doorWith(), [withFlags(UAH_ID, { ...wiring, "input_state_dps": "on" })]), { "dps": "close", "dps_connected": true });
      assert.deepEqual(deriveDoorState(doorWith(), [withFlags(UAH_ID, { ...wiring, "input_state_dps": "off" })]), { "dps": "open", "dps_connected": true });
    });

    test("reads the lock relay in both directions", () => {

      assert.deepEqual(deriveDoorState(doorWith(), [withFlags(UAH_ID, { "input_state_rly-lock_dry": "on" })]), { lock: "unlocked" });
      assert.deepEqual(deriveDoorState(doorWith(), [withFlags(UAH_ID, { "input_state_rly-lock_dry": "off" })]), { lock: "locked" });
    });

    test("accepts the same facts duplicated onto the door's extras", () => {

      /* A UA Hub copies its position facts onto the door under a prefixed name. They are the same facts under longer names, so a hub whose own record has gone quiet
       * on them is still read through the door.
       */
      const door = doorWith({ "uah-input_state_dps": "on", "uah-wiring_state_dps-neg": "on", "uah-wiring_state_dps-pos": "on" });
      const facts = deriveDoorState(door, [withFlags(UAH_ID, { "input_state_rly-lock_dry": "off" })]);

      assert.deepEqual(facts, { "dps": "close", "dps_connected": true, "lock": "locked" });
    });

    test("prefers the hub's own record over the door's copy of it", () => {

      // Where both exist they agree, so this is about which one to believe if they ever did not: the hub speaking about its own terminals.
      const door = doorWith({ "uah-input_state_dps": "off", "uah-wiring_state_dps-neg": "on", "uah-wiring_state_dps-pos": "on" });
      const facts = deriveDoorState(door, [withFlags(UAH_ID, { "input_state_dps": "on", "wiring_state_dps-neg": "on", "wiring_state_dps-pos": "on" })]);

      assert.deepEqual(facts, { "dps": "close", "dps_connected": true });
    });
  });

  describe("the field-derived families", () => {

    test("derives a gate hub's position from its own wiring pair", () => {

      const facts = deriveDoorState(doorWith(), [withFlags(UAH_ID, { "input_gate_dps": "on", "wiring_state_gate-dps-neg": "on", "wiring_state_gate-dps-pos": "on" })]);

      assert.deepEqual(facts, { "dps": "close", "dps_connected": true });
    });

    test("derives nothing from a gate hub that reports its position input alone", () => {

      // The gate keys come from field reports rather than from any capture in hand, and a position input with nothing qualifying it establishes neither a position
      // nor a connection state. The family also has no lock relay, so there is nothing else to fall back on.
      assert.deepEqual(deriveDoorState(doorWith(), [withFlags(UAH_ID, { "input_gate_dps": "on" })]), {});
    });

    test("derives a side door's position from its own wiring pair", () => {

      const facts = deriveDoorState(doorWith(), [withFlags(UAH_ID, { "input_door_dps": "off", "wiring_state_door-dps-neg": "on", "wiring_state_door-dps-pos": "on" })]);

      assert.deepEqual(facts, { "dps": "open", "dps_connected": true });
    });
  });

  describe("the shapes the reference capture itself carries", () => {

    test("derives the UA Ultra exactly as the capture describes it", () => {

      // The Ultra's captured record verbatim: a duty selector reading door position, a position input reading off, a lock relay reading off, and no wiring pair.
      const facts = deriveDoorState(doorWith(), [captured(ULTRA_ID)]);

      assert.deepEqual(facts, { "dps": "open", "dps_connected": true, "lock": "locked" });
    });

    test("derives an Ultra assigned to request-to-exit duty as disconnected for position", () => {

      // The same record with its one terminal assigned elsewhere. The hardware is then reporting that nothing is wired to a position sensor, which is the
      // vocabulary's own disconnected reading rather than the silence an unqualified input gets.
      const facts = deriveDoorState(doorWith(), [withDuty(ULTRA_ID, "rex")]);

      assert.deepEqual(facts, { "dps": "none", "dps_connected": false, "lock": "locked" });
    });

    test("derives a door served by a hub and its readers from the hub", () => {

      /* The ordinary multi-device door: one hub that drives it and readers alongside that do not. The readers carry none of these keys, so they are not candidates
       * and create no ambiguity - which is what keeps the everyday case deriving rather than falling into the multiple-devices rule.
       */
      const facts = deriveDoorState(doorWith(), [ captured(READER_ID), captured(UAH_ID) ]);

      assert.deepEqual(facts, { "dps": "none", "dps_connected": false, "lock": "locked" });
    });
  });

  describe("ambiguity is answered with silence", () => {

    test("derives nothing when two serving devices each carry a family", () => {

      // Nothing in either record says which of them describes this door, and picking one would be a guess wearing the authority of a reading.
      const devices = [ withFlags(MINI_ID, { "input_d1_dps": "on" }), withFlags(UAH_ID, { "input_state_dps": "off" }) ];

      assert.deepEqual(deriveDoorState(doorWith(), devices), {});
    });

    test("derives nothing when one device speaks for both a main door and a side door", () => {

      const device = withFlags(UAH_ID, { "input_door_dps": "off", "input_state_dps": "on", "wiring_state_dps-neg": "on", "wiring_state_dps-pos": "on" });

      assert.deepEqual(deriveDoorState(doorWith(), [device]), {});
    });

    test("derives nothing for a door whose hardware the building hosts directly", () => {

      // Such a door has no serving device in its own group at all, because the hub that drives it is attached to the building. The association exists only as a
      // synthesis a tier above this one, so the honest answer here is that the document said nothing.
      assert.deepEqual(deriveDoorState(doorWith(), []), {});
    });

    test("ignores a value outside the vocabulary the controller writes", () => {

      // Guessing what an unobserved value means would be inventing a reading, so it reads as absent exactly like a missing key.
      const facts = deriveDoorState(doorWith(), [withFlags(MINI_ID, { "input_d1_dps": "yes", "wiring_state_d1-dps-neg": "on", "wiring_state_d1-dps-pos": "on" })]);

      assert.equal(Object.hasOwn(facts, "dps"), false);
      assert.equal(Object.hasOwn(facts, "dps_connected"), false);
    });
  });

  test("leaves every unestablished member absent rather than present and undefined", () => {

    /* The seed spreads these facts onto a door state entry and depends on key absence to leave a held member standing. A member present with an undefined value
     * would spread as a key and erase what it does not know, which no value comparison against undefined would catch.
     */
    const facts: AccessDoorStateFacts = deriveDoorState(doorWith(), [withFlags(MINI_ID, { "output_d1_lock_relay": "on" })]);

    assert.deepEqual(Object.keys(facts), ["lock"]);

    for(const member of [ "dps", "dps_connected" ]) {

      assert.equal(Object.hasOwn(facts, member), false, member + " should be absent rather than undefined");
    }
  });

  test("derives the lock and the position independently of each other", () => {

    // A family can prove one and say nothing about the other, and each member is carried or omitted on its own evidence rather than as a set.
    const facts = deriveDoorState(doorWith(), [withFlags(MINI_ID,
      { "output_d1_lock_relay": "on", "wiring_state_d1-dps-neg": "off", "wiring_state_d1-dps-pos": "off" })]);

    assert.deepEqual(facts, { "dps": "none", "dps_connected": false, "lock": "unlocked" });
  });
});

describe("officialLockState", () => {

  test("folds the official spelling onto the notification stream's own", () => {

    assert.equal(officialLockState("lock"), "locked");
    assert.equal(officialLockState("unlock"), "unlocked");
  });

  test("reads a value outside the documented pair as absent evidence", () => {

    for(const status of [ "", "locked", "unknown" ]) {

      assert.equal(officialLockState(status), undefined);
    }
  });
});

describe("officialDoorPosition", () => {

  test("reads the official read's null as no position rather than as a value", () => {

    assert.equal(officialDoorPosition(null), undefined);
  });

  test("carries every position the official read actually states, the disconnected one included", () => {

    // The two channels already agree on this vocabulary, so `none` is a real reading that carries through as itself rather than collapsing into absence.
    assert.equal(officialDoorPosition("none"), "none");
    assert.equal(officialDoorPosition("open"), "open");
    assert.equal(officialDoorPosition("close"), "close");
  });
});

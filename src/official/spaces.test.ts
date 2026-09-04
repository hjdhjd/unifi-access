/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * spaces.test.ts: Unit tests for the official API's spaces domain. Beyond the per-endpoint rows, these assert the wire truths this domain carries - the door position
 * value the reference does not document, the idle lock rule that names no rule at all, and the emergency write that always sends both flags.
 */
import type { AccessOfficialDoor, AccessOfficialDoorGroup, AccessOfficialDoorGroupResource, AccessOfficialDoorGroupTopology, AccessOfficialEmergencyState,
  AccessOfficialLockRule, AccessOfficialLockRuleSet, AccessOfficialResourceTopology, AccessOfficialTopologyResource } from "./spaces.ts";
import { describe, test } from "node:test";
import { describeDomainTable, domainRig, officialPath } from "./domain.helpers.ts";
import { AccessAbortedError } from "../errors.ts";
import type { DomainRow } from "./domain.helpers.ts";
import { OfficialSpaces } from "./spaces.ts";
import assert from "node:assert/strict";

const ID = "a b/c";
const ENCODED = "a%20b%2Fc";
const VOID_OK = { "code": "SUCCESS", "msg": "success" };

// Transcribed from a live controller: the UA Hub, whose position sensor is unwired and which reports the DPS triplet on its own door record.
const DOOR_HUB = { "door_lock_relay_status": "lock", "door_position_status": "none",
  "extras": { "door_thumbnail": "/preview/reader.jpg", "door_thumbnail_last_update": 1786822236, "uah-input_state_dps": "off",
    "uah-wiring_state_dps-neg": "off", "uah-wiring_state_dps-pos": "off" }, "floor_id": "0ace0000-0000-4000-8000-000000000005",
  "full_name": "Acme Name 9", "id": "0ace0000-0000-4000-8000-000000000002", "is_bind_hub": true, "name": "Acme Name 6", "type": "door" };

// Transcribed from a live controller: a UA Hub Door Mini, which reports its door position through its device record and sends an empty extras object here.
const DOOR_MINI = { "door_lock_relay_status": "lock", "door_position_status": "open", "extras": {}, "floor_id": "0ace0000-0000-4000-8000-000000000005",
  "full_name": "Acme Name 8", "id": "0ace0000-0000-4000-8000-000000000003", "is_bind_hub": true, "name": "Acme Name 7", "type": "door" };

const TOPOLOGY = { "id": "0ace0000-0000-4000-8000-000000000004", "name": "All Doors",
  "resource_topologies": [{ "id": "0ace0000-0000-4000-8000-000000000005", "name": "Acme Name 10",
    "resources": [{ "id": "0ace0000-0000-4000-8000-000000000002", "is_bind_hub": true, "name": "Acme Name 6", "type": "door" }], "type": "floor" }],
  "type": "building" };

const DOOR_GROUP = { "id": "grp-1", "name": "Perimeter", "resources": [{ "id": "0ace0000-0000-4000-8000-000000000002", "type": "door" }] };

const rows: readonly DomainRow<OfficialSpaces>[] = [

  { expected: [TOPOLOGY], method: "fetchTopology", path: officialPath("/door_groups/topology"), reply: { "code": "SUCCESS", "data": [TOPOLOGY],
    "msg": "success" }, run: async (domain, call) => domain.fetchTopology(call), verb: "GET" },

  { body: "{\"group_name\":\"Perimeter\",\"resources\":[\"d-1\"]}", expected: DOOR_GROUP, method: "createDoorGroup", path: officialPath("/door_groups"),
    reply: { "code": "SUCCESS", "data": DOOR_GROUP, "msg": "success" },
    run: async (domain, call) => domain.createDoorGroup({ "group_name": "Perimeter", resources: ["d-1"] }, call), verb: "POST" },

  { expected: DOOR_GROUP, method: "fetchDoorGroup", path: officialPath("/door_groups/" + ENCODED), reply: { "code": "SUCCESS", "data": DOOR_GROUP,
    "msg": "success" }, run: async (domain, call) => domain.fetchDoorGroup(ID, call), verb: "GET" },

  { body: "{\"resources\":[]}", expected: DOOR_GROUP, method: "updateDoorGroup", path: officialPath("/door_groups/" + ENCODED),
    reply: { "code": "SUCCESS", "data": DOOR_GROUP, "msg": "success" }, run: async (domain, call) => domain.updateDoorGroup(ID, { resources: [] }, call), verb: "PUT" },

  { expected: [], method: "fetchAllDoorGroups", path: officialPath("/door_groups"), reply: { "code": "SUCCESS", "data": [], "msg": "success" },
    run: async (domain, call) => domain.fetchAllDoorGroups(call), verb: "GET" },

  { method: "deleteDoorGroup", path: officialPath("/door_groups/" + ENCODED), reply: VOID_OK, run: async (domain, call) => domain.deleteDoorGroup(ID, call),
    verb: "DELETE" },

  { expected: DOOR_HUB, method: "fetch", path: officialPath("/doors/" + ENCODED), reply: { "code": "SUCCESS", "data": DOOR_HUB, "msg": "success" },
    run: async (domain, call) => domain.fetch(ID, call), verb: "GET" },

  { expected: [ DOOR_MINI, DOOR_HUB ], method: "fetchAll", path: officialPath("/doors"), reply: { "code": "SUCCESS", "data": [ DOOR_MINI, DOOR_HUB ],
    "msg": "success" }, run: async (domain, call) => domain.fetchAll(call), verb: "GET" },

  // A relay actuation, so the call site opts out of the transparent retry rather than inheriting the pool's default.
  { body: "{\"actor_id\":\"bot-1\",\"actor_name\":\"the automation\",\"extra\":{\"ticket\":\"T-42\"}}", method: "unlock",
    path: officialPath("/doors/" + ENCODED + "/unlock") + "?control_cmd=open&entry_method=in&reader_id=r-1", reply: VOID_OK, retry: false,
    run: async (domain, call) => domain.unlock(ID, { actor: { id: "bot-1", name: "the automation" }, controlCmd: "open", entryMethod: "in",
      extra: { ticket: "T-42" }, readerId: "r-1" }, call), verb: "PUT" },

  { body: "{}", method: "unlock", path: officialPath("/doors/" + ENCODED + "/unlock"), reply: VOID_OK, retry: false,
    run: async (domain, call) => domain.unlock(ID, {}, call), verb: "PUT" },

  // The interval is minutes, on the wire and in the reference alike - a two-unit custom rule was live-measured holding the relay for 120 seconds.
  { body: "{\"interval\":2,\"type\":\"custom\"}", method: "setLockRule", path: officialPath("/doors/" + ENCODED + "/lock_rule"), reply: VOID_OK,
    run: async (domain, call) => domain.setLockRule(ID, { interval: 2, type: "custom" }, call), verb: "PUT" },

  { body: "{\"type\":\"reset\"}", method: "setLockRule", path: officialPath("/doors/" + ENCODED + "/lock_rule"), reply: VOID_OK,
    run: async (domain, call) => domain.setLockRule(ID, { type: "reset" }, call), verb: "PUT" },

  { expected: { "ended_time": 0, "type": "" }, method: "fetchLockRule", path: officialPath("/doors/" + ENCODED + "/lock_rule"),
    reply: { "code": "SUCCESS", "data": { "ended_time": 0, "type": "" }, "msg": "success" }, run: async (domain, call) => domain.fetchLockRule(ID, call), verb: "GET" },

  // All three states, each sending both flags, so no request leaves the other flag's prior value ambiguous.
  { body: "{\"evacuation\":true,\"lockdown\":false}", method: "setEmergency", path: officialPath("/doors/settings/emergency"), reply: VOID_OK,
    run: async (domain, call) => domain.setEmergency("evacuation", call), verb: "PUT" },

  { body: "{\"evacuation\":false,\"lockdown\":true}", method: "setEmergency", path: officialPath("/doors/settings/emergency"), reply: VOID_OK,
    run: async (domain, call) => domain.setEmergency("lockdown", call), verb: "PUT" },

  { body: "{\"evacuation\":false,\"lockdown\":false}", method: "setEmergency", path: officialPath("/doors/settings/emergency"), reply: VOID_OK,
    run: async (domain, call) => domain.setEmergency("normal", call), verb: "PUT" },

  { expected: { "evacuation": false, "lockdown": false }, method: "fetchEmergency", path: officialPath("/doors/settings/emergency"),
    reply: { "code": "SUCCESS", "data": { "evacuation": false, "lockdown": false }, "msg": "success" }, run: async (domain, call) => domain.fetchEmergency(call),
    verb: "GET" }
];

describeDomainTable({ domainClass: OfficialSpaces, name: "OfficialSpaces", rows });

describe("OfficialSpaces wire truths", () => {

  test("a door reporting the undocumented position value returns it intact", async () => {

    const rig = domainRig((options) => new OfficialSpaces(options));

    // The reference documents null for a door with no position sensor connected; the wire answers the string "none". A type closed over the documented pair would
    // make this response unrepresentable.
    rig.pool.intercept({ method: "GET", path: officialPath("/doors/d-1") }).reply(200, { "code": "SUCCESS", "data": DOOR_HUB, "msg": "success" });

    const door = await rig.domain.fetch("d-1");

    assert.equal(door.door_position_status, "none");
    assert.equal(door.extras?.["uah-input_state_dps"], "off");
  });

  test("the door extras three-state reaches a caller as absent, empty, or populated", async () => {

    const rig = domainRig((options) => new OfficialSpaces(options));
    const bare = { ...DOOR_MINI };

    delete (bare as { extras?: unknown }).extras;

    rig.pool.intercept({ method: "GET", path: officialPath("/doors") }).reply(200, { "code": "SUCCESS", "data": [ bare, DOOR_MINI, DOOR_HUB ],
      "msg": "success" });

    const doors = await rig.domain.fetchAll();

    // The three states mirror three real hardware carriers, and nothing here synthesizes a fourth value to tell them apart.
    assert.equal(doors[0]?.extras, undefined);
    assert.deepEqual(doors[1]?.extras, {});
    assert.equal(typeof doors[2]?.extras?.["uah-wiring_state_dps-pos"], "string");
  });

  test("the idle lock rule returns the empty type and zero end time exactly as sent", async () => {

    const rig = domainRig((options) => new OfficialSpaces(options));

    rig.pool.intercept({ method: "GET", path: officialPath("/doors/d-1/lock_rule") }).reply(200, { "code": "SUCCESS",
      "data": { "ended_time": 0, "type": "" }, "msg": "success" });

    const rule = await rig.domain.fetchLockRule("d-1");

    assert.equal(rule.type, "", "the no-rule state the documented vocabulary omits entirely");
    assert.equal(rule.ended_time, 0);
  });
});

describe("OfficialSpaces vocabularies", () => {

  test("the door position admits an undocumented value while keeping its documented literals", () => {

    const undocumented: AccessOfficialDoor["door_position_status"] = "ajar";
    const literals: [ Extract<AccessOfficialDoor["door_position_status"], "close">, Extract<AccessOfficialDoor["door_position_status"], "none">,
      Extract<AccessOfficialDoor["door_position_status"], "open"> ] = [ "close", "none", "open" ];
    const absent: AccessOfficialDoor["door_position_status"] = null;

    assert.deepEqual([ undocumented, absent ], [ "ajar", null ]);
    assert.deepEqual(literals, [ "close", "none", "open" ]);
  });

  test("the door relay status admits an undocumented value while keeping its documented literals", () => {

    const undocumented: AccessOfficialDoor["door_lock_relay_status"] = "fault";
    const literals: [ Extract<AccessOfficialDoor["door_lock_relay_status"], "lock">,
      Extract<AccessOfficialDoor["door_lock_relay_status"], "unlock"> ] = [ "lock", "unlock" ];

    assert.equal(undocumented, "fault");
    assert.deepEqual(literals, [ "lock", "unlock" ]);
  });

  test("every resource-kind vocabulary in this domain admits an undocumented value while keeping its documented literals", () => {

    /* The topology, the door groups, and the doors all name what a thing IS with their own `type` member, and each has its own documented vocabulary. They widen for
     * the same reason the rest do - this reference has understated the wire repeatedly - so each gets both halves of the assertion rather than being taken on trust
     * because a sibling nearby was checked.
     */
    const undocumented: [ AccessOfficialTopologyResource["type"], AccessOfficialResourceTopology["type"], AccessOfficialDoorGroupTopology["type"],
      AccessOfficialDoorGroupResource["type"], AccessOfficialDoorGroup["type"], AccessOfficialDoor["type"] ] = [ "elevator", "wing", "campus", "elevator",
      "campus", "gate" ];

    const literals: [ Extract<AccessOfficialTopologyResource["type"], "door">, Extract<AccessOfficialResourceTopology["type"], "floor">,
      Extract<AccessOfficialDoorGroupTopology["type"], "access">, Extract<AccessOfficialDoorGroupTopology["type"], "building">,
      Extract<AccessOfficialDoorGroupResource["type"], "door">, Extract<AccessOfficialDoorGroupResource["type"], "door_group">,
      Extract<AccessOfficialDoorGroup["type"], "access">, Extract<AccessOfficialDoorGroup["type"], "building">,
      Extract<AccessOfficialDoor["type"], "door"> ] = [ "door", "floor", "access", "building", "door", "door_group", "access", "building", "door" ];

    assert.deepEqual(undocumented, [ "elevator", "wing", "campus", "elevator", "campus", "gate" ]);
    assert.deepEqual(literals, [ "door", "floor", "access", "building", "door", "door_group", "access", "building", "door" ]);
  });

  test("the lock rule response admits an undocumented value while keeping its documented literals and the idle sentinel", () => {

    const undocumented: AccessOfficialLockRule["type"] = "holiday";
    const literals: [ Extract<AccessOfficialLockRule["type"], "">, Extract<AccessOfficialLockRule["type"], "custom">,
      Extract<AccessOfficialLockRule["type"], "keep_lock">, Extract<AccessOfficialLockRule["type"], "keep_unlock">,
      Extract<AccessOfficialLockRule["type"], "lock_early">, Extract<AccessOfficialLockRule["type"], "schedule"> ] = [ "", "custom", "keep_lock",
      "keep_unlock", "lock_early", "schedule" ];

    assert.equal(undocumented, "holiday");
    assert.deepEqual(literals, [ "", "custom", "keep_lock", "keep_unlock", "lock_early", "schedule" ]);
  });

  test("the write vocabularies stay closed, and an interval cannot join a rule that has none", () => {

    // @ts-expect-error - the documented rule set is what a caller may put in force.
    const rule: AccessOfficialLockRuleSet = { type: "holiday" };

    // @ts-expect-error - the duration belongs to the custom rule alone, so pairing it with any other is not composable.
    const paired: AccessOfficialLockRuleSet = { interval: 5, type: "keep_unlock" };

    // @ts-expect-error - the three-state input forecloses composing the contradictory both-in-force request.
    const emergency: AccessOfficialEmergencyState = "both";

    assert.deepEqual([ rule.type, paired.type, emergency ], [ "holiday", "keep_unlock", "both" ]);
  });
});

describe("the caller's abort signal on a door command", () => {

  test("an unlock's signal travels in the call options and never on the wire", async () => {

    const rig = domainRig((options) => new OfficialSpaces(options));
    const controller = new AbortController();

    rig.pool.intercept({ method: "PUT", path: officialPath("/doors/d-1/unlock") }).reply(200, VOID_OK);

    await rig.domain.unlock("d-1", {}, { signal: controller.signal });

    const call = rig.dispatch.calls[0];

    assert.ok(call);

    /* A cancellation is something the request is steered by rather than something the controller is told, so it belongs to the call options alone. The body and
     * the query must read exactly as they would have without it - a signal that reached either would be a caller's control leaking onto the wire.
     */
    assert.equal(call.call.signal, controller.signal);
    assert.equal(call.opts.signal, undefined, "the payload bag carried none of it");
    assert.deepEqual(call.opts.json, {});
    assert.ok(!call.url.includes("signal"), "and the URL says nothing of it either");
  });

  test("a lock rule's signal travels in the call options and never on the wire", async () => {

    const rig = domainRig((options) => new OfficialSpaces(options));
    const controller = new AbortController();

    rig.pool.intercept({ method: "PUT", path: officialPath("/doors/d-1/lock_rule") }).reply(200, VOID_OK);

    await rig.domain.setLockRule("d-1", { type: "reset" }, { signal: controller.signal });

    const call = rig.dispatch.calls[0];

    assert.ok(call);
    assert.equal(call.call.signal, controller.signal);
    assert.deepEqual(call.opts.json, { type: "reset" }, "the rule alone is what was sent");
  });

  test("the caller's abort cancels an in-flight unlock", async () => {

    /* The functional proof the forwarding rows cannot give: the signal travels through this domain method into the dispatch, the transport's composition with its own
     * deadline, and the abort classification, so a cancellation made while the request is in flight is one the request observably takes.
     */
    const rig = domainRig((options) => new OfficialSpaces(options));
    const controller = new AbortController();

    rig.pool.intercept({ method: "PUT", path: officialPath("/doors/d-1/unlock") }).reply(200, VOID_OK).delay(2000);

    const pending = rig.domain.unlock("d-1", {}, { signal: controller.signal });

    controller.abort();

    await assert.rejects(pending, AccessAbortedError);
  });
});

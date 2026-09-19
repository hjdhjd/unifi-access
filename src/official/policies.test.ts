/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * policies.test.ts: Unit tests for the official API's access-policy domain. Each row asserts one endpoint's verb, path, and body against a mocked controller, and the
 * type assertions below establish that the response vocabularies stayed open where the wire has outgrown its documentation and closed where a caller composes a
 * request.
 */
import type { AccessOfficialAccessPolicy, AccessOfficialAccessPolicyResource, AccessOfficialAccessPolicyResourceRef, AccessOfficialSchedule } from "./policies.ts";
import { PATH_ID, PATH_ID_ENCODED, VOID_OK, describeDomainTable, officialPath } from "./domain.helpers.ts";
import { describe, test } from "node:test";
import type { DomainRow } from "./domain.helpers.ts";
import { OfficialAccessPolicies } from "./policies.ts";
import assert from "node:assert/strict";

// Transcribed from a live controller.
const POLICY = { "id": "0ace0000-0000-4000-8000-000000000009", "name": "Default Site Policy",
  "resources": [{ "id": "0ace0000-0000-4000-8000-000000000004", "type": "door_group" }], "schedule_id": "0ace0000-0000-4000-8000-00000000000a" };
const HOLIDAY_GROUP_SUMMARY = { "count": 0, "description": "", "id": "0ace0000-0000-4000-8000-00000000000b", "is_default": true, "is_private": false,
  "name": "No Holidays" };
const SCHEDULE = { "holiday_group_id": "0ace0000-0000-4000-8000-00000000000b", "id": "0ace0000-0000-4000-8000-00000000000c", "is_default": true,
  "name": "Always Access", "status": 1, "type": "access" };

// Transcribed from the reference's own holiday-group sample, whose response timestamps render without the `T` separator its request format uses.
const HOLIDAY_GROUP = { "description": "", "holidays": [{ "description": "", "end_time": "2023-08-26 00:00:00Z", "id": "hol-1", "is_template": false,
  "name": "Labor Day", "repeat": false, "start_time": "2023-08-25 00:00:00Z" }], "id": "grp-1", "is_default": false, "name": "Holidays",
"template_name": "" };

const WEEK = { "friday": [], "monday": [{ "end_time": "23:59:59", "start_time": "00:00:00" }], "saturday": [], "sunday": [], "thursday": [], "tuesday": [],
  "wednesday": [] };

const rows: readonly DomainRow<OfficialAccessPolicies>[] = [

  { body: "{\"name\":\"Nights\",\"schedule_id\":\"sched-1\"}", expected: POLICY, method: "create", path: officialPath("/access_policies"),
    reply: { "code": "SUCCESS", "data": POLICY, "msg": "success" },
    run: async (domain, call) => domain.create({ name: "Nights", "schedule_id": "sched-1" }, call), verb: "POST" },

  { body: "{\"name\":\"Days\"}", expected: POLICY, method: "update", path: officialPath("/access_policies/" + PATH_ID_ENCODED), reply:
    { "code": "SUCCESS", "data": POLICY, "msg": "success" }, run: async (domain, call) => domain.update(PATH_ID, { name: "Days" }, call), verb: "PUT" },

  { method: "delete", path: officialPath("/access_policies/" + PATH_ID_ENCODED), reply: VOID_OK, run: async (domain, call) => domain.delete(PATH_ID, call),
    verb: "DELETE" },

  { expected: POLICY, method: "fetch", path: officialPath("/access_policies/" + PATH_ID_ENCODED), reply: { "code": "SUCCESS", "data": POLICY, "msg": "success" },
    run: async (domain, call) => domain.fetch(PATH_ID, call), verb: "GET" },

  { expected: [POLICY], method: "fetchAll", path: officialPath("/access_policies"), reply: { "code": "SUCCESS", "data": [POLICY], "msg": "success" },
    run: async (domain, call) => domain.fetchAll(call), verb: "GET" },

  { body: "{\"name\":\"Holidays\"}", expected: HOLIDAY_GROUP, method: "createHolidayGroup", path: officialPath("/access_policies/holiday_groups"), reply:
    { "code": "SUCCESS", "data": HOLIDAY_GROUP, "msg": "success" }, run: async (domain, call) => domain.createHolidayGroup({ name: "Holidays" }, call), verb: "POST" },

  { body: "{\"name\":\"Holidays\"}", expected: HOLIDAY_GROUP, method: "updateHolidayGroup", path: officialPath("/access_policies/holiday_groups/" + PATH_ID_ENCODED),
    reply: { "code": "SUCCESS", "data": HOLIDAY_GROUP, "msg": "success" }, run: async (domain, call) => domain.updateHolidayGroup(PATH_ID, { name: "Holidays" }, call),
    verb: "PUT" },

  { method: "deleteHolidayGroup", path: officialPath("/access_policies/holiday_groups/" + PATH_ID_ENCODED), reply: VOID_OK,
    run: async (domain, call) => domain.deleteHolidayGroup(PATH_ID, call), verb: "DELETE" },

  { expected: HOLIDAY_GROUP, method: "fetchHolidayGroup", path: officialPath("/access_policies/holiday_groups/" + PATH_ID_ENCODED), reply:
    { "code": "SUCCESS", "data": HOLIDAY_GROUP, "msg": "success" }, run: async (domain, call) => domain.fetchHolidayGroup(PATH_ID, call), verb: "GET" },

  { expected: [HOLIDAY_GROUP_SUMMARY], method: "fetchAllHolidayGroups", path: officialPath("/access_policies/holiday_groups"), reply:
    { "code": "SUCCESS", "data": [HOLIDAY_GROUP_SUMMARY], "msg": "success" }, run: async (domain, call) => domain.fetchAllHolidayGroups(call), verb: "GET" },

  { body: JSON.stringify({ name: "Nights", "week_schedule": WEEK }), expected: SCHEDULE, method: "createSchedule",
    path: officialPath("/access_policies/schedules"), reply: { "code": "SUCCESS", "data": SCHEDULE, "msg": "success" },
    run: async (domain, call) => domain.createSchedule({ name: "Nights", "week_schedule": WEEK }, call), verb: "POST" },

  { body: "{\"name\":\"Nights\"}", method: "updateSchedule", path: officialPath("/access_policies/schedules/" + PATH_ID_ENCODED), reply: VOID_OK,
    run: async (domain, call) => domain.updateSchedule(PATH_ID, { name: "Nights" }, call), verb: "PUT" },

  { expected: SCHEDULE, method: "fetchSchedule", path: officialPath("/access_policies/schedules/" + PATH_ID_ENCODED), reply:
    { "code": "SUCCESS", "data": SCHEDULE, "msg": "success" }, run: async (domain, call) => domain.fetchSchedule(PATH_ID, call), verb: "GET" },

  { expected: [SCHEDULE], method: "fetchAllSchedules", path: officialPath("/access_policies/schedules"), reply:
    { "code": "SUCCESS", "data": [SCHEDULE], "msg": "success" }, run: async (domain, call) => domain.fetchAllSchedules(call), verb: "GET" },

  { method: "deleteSchedule", path: officialPath("/access_policies/schedules/" + PATH_ID_ENCODED), reply: VOID_OK,
    run: async (domain, call) => domain.deleteSchedule(PATH_ID, call), verb: "DELETE" }
];

describeDomainTable({ domainClass: OfficialAccessPolicies, name: "OfficialAccessPolicies", rows });

describe("OfficialAccessPolicies vocabularies", () => {

  test("the policy resource type admits an undocumented kind while keeping its documented literals", () => {

    /* The pair of assertions the enum rule asks for. The first compiles only while the open arm survives, so an over-closed union fails it. The `Extract` assignments
     * compile only while each documented literal is still a distinct member: against a union that dropped one, or that degenerated to bare `string`, the extraction
     * collapses to `never` and the assignment fails.
     */
    const undocumented: AccessOfficialAccessPolicyResource["type"] = "elevator";
    const literalDoor: Extract<AccessOfficialAccessPolicyResource["type"], "door"> = "door";
    const literalDoorGroup: Extract<AccessOfficialAccessPolicyResource["type"], "door_group"> = "door_group";

    assert.deepEqual([ undocumented, literalDoor, literalDoorGroup ], [ "elevator", "door", "door_group" ]);
  });

  test("the schedule type admits an undocumented kind while keeping its documented literal", () => {

    const undocumented: AccessOfficialSchedule["type"] = "maintenance";
    const literalAccess: Extract<AccessOfficialSchedule["type"], "access"> = "access";

    assert.deepEqual([ undocumented, literalAccess ], [ "maintenance", "access" ]);
  });

  test("the request resource vocabulary stays closed", () => {

    // @ts-expect-error - a caller composes requests from the documented set, so a kind outside it is a compile error rather than a request the controller refuses.
    const outside: AccessOfficialAccessPolicyResourceRef["type"] = "elevator";

    assert.equal(outside, "elevator");
  });

  test("the policy entity is what the live wire sent", () => {

    // The capture's own record, satisfying the type without a cast - which is what asserts that the transcription matches the bytes.
    const policy: AccessOfficialAccessPolicy = POLICY;

    assert.equal(policy.resources[0]?.type, "door_group");
  });
});

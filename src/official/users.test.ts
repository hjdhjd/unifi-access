/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * users.test.ts: Unit tests for the official API's user domain. Beyond the per-endpoint rows, these pin the three shapes this domain is easiest to get wrong on:
 * the bare-array bodies that carry no wrapper member, the string-valued expansion parameter the reference's field table mislabels, and the avatar upload's
 * multipart framing.
 */
import type { AccessOfficialUser, AccessOfficialUserCreated, AccessOfficialUserExpand, AccessOfficialUserGroupMember, AccessOfficialUserUpdate } from "./users.ts";
import { describe, test } from "node:test";
import { describeDomainTable, officialPath, parseMultipart } from "./domain.helpers.ts";
import type { DomainRow } from "./domain.helpers.ts";
import { OfficialUsers } from "./users.ts";
import assert from "node:assert/strict";

const ID = "a b/c";
const ENCODED = "a%20b%2Fc";
const VOID_OK = { "code": "SUCCESS", "msg": "success" };

// Transcribed from a live controller.
const USER = { "alias": "", "avatar_relative_path": "", "email": "user-1@acme.example", "email_status": "VERIFIED", "employee_number": "",
  "first_name": "Acme first_name 1", "full_name": "Acme Name 1", "id": "0ace0000-0000-4000-8000-000000000000", "last_name": "Acme last_name 1",
  "nfc_cards": [{ "id": "100000", "token": "dd51177a929667e8d5e047596c87123c3ca62cb3f3aef4f64f6c6ea7c6baa95a", "type": "ua_card" }], "onboard_time": 0,
  "phone": "", "pin_code": null, "status": "ACTIVE", "touch_pass": null, "user_email": "user-1@acme.example", "username": "" };

const GROUP_MEMBER = { "alias": "", "avatar_relative_path": "", "email": "", "email_status": "UNVERIFIED", "employee_number": "", "first_name": "Acme first_name 2",
  "full_name": "Acme Name 11", "id": "0ace0000-0000-4000-8000-000000000006", "last_name": "Acme last_name 2", "onboard_time": 0, "phone": "", "status": "ACTIVE",
  "user_email": "", "username": "Test Name 7" };

const SEARCH_RESULT = { ...GROUP_MEMBER, "nfc_cards": [], "pin_code": null };
const USER_GROUP = { "full_name": "Staff", "id": "grp-1", "name": "Staff", "up_id": "", "up_ids": [] };
const POLICY = { "id": "0ace0000-0000-4000-8000-000000000009", "name": "Default Site Policy",
  "resources": [{ "id": "0ace0000-0000-4000-8000-000000000004", "type": "door_group" }], "schedule_id": "0ace0000-0000-4000-8000-00000000000a" };
const TOUCH_PASS = { "bundles": [], "card_id": "AAAA-BBBB-CCCC-0001", "card_name": "", "id": "0ace0000-0000-4000-8000-000000000008", "last_activity": null,
  "status": "PENDING", "user_avatar": "", "user_email": "", "user_id": "", "user_name": "", "user_status": "ACTIVE" };
const PAGINATION = { "page_num": 1, "page_size": 3, "total": 3 };

const rows: readonly DomainRow<OfficialUsers>[] = [

  { body: "{\"first_name\":\"Ada\",\"last_name\":\"Lovelace\"}", expected: { "first_name": "Ada", "id": "u-1", "last_name": "Lovelace", "user_email": "" },
    method: "create", path: officialPath("/users"), reply: { "code": "SUCCESS", "data": { "first_name": "Ada", "id": "u-1", "last_name": "Lovelace",
      "user_email": "" }, "msg": "success" }, run: async (domain, call) => domain.create({ "first_name": "Ada", "last_name": "Lovelace" }, call), verb: "POST" },

  { body: "{\"status\":\"DEACTIVATED\"}", method: "update", path: officialPath("/users/" + ENCODED), reply: VOID_OK,
    run: async (domain, call) => domain.update(ID, { status: "DEACTIVATED" }, call), verb: "PUT" },

  { expected: USER, method: "fetch", path: officialPath("/users/" + ENCODED) + "?expand%5B%5D=access_policy", reply: { "code": "SUCCESS", "data": USER,
    "msg": "success" }, run: async (domain, call) => domain.fetch(ID, { expand: ["access_policy"] }, call), verb: "GET" },

  { expected: { data: [USER], pagination: PAGINATION }, method: "fetchAll", path: officialPath("/users") + "?page_num=1&page_size=3&expand%5B%5D=access_policy",
    reply: { "code": "SUCCESS", "data": [USER], "msg": "success", "pagination": PAGINATION },
    run: async (domain, call) => domain.fetchAll({ expand: ["access_policy"], pageNum: 1, pageSize: 3 }, call), verb: "GET" },

  { body: "{\"access_policy_ids\":[\"p-1\"]}", method: "assignAccessPolicies", path: officialPath("/users/" + ENCODED + "/access_policies"), reply: VOID_OK,
    run: async (domain, call) => domain.assignAccessPolicies(ID, ["p-1"], call), verb: "PUT" },

  { body: "{\"force_add\":true,\"token\":\"tok-1\"}", method: "assignNfcCard", path: officialPath("/users/" + ENCODED + "/nfc_cards"), reply: VOID_OK,
    run: async (domain, call) => domain.assignNfcCard(ID, { "force_add": true, token: "tok-1" }, call), verb: "PUT" },

  { body: "{\"token\":\"tok-1\"}", method: "unassignNfcCard", path: officialPath("/users/" + ENCODED + "/nfc_cards/delete"), reply: VOID_OK,
    run: async (domain, call) => domain.unassignNfcCard(ID, "tok-1", call), verb: "PUT" },

  { body: "{\"pin_code\":\"67203419\"}", method: "assignPinCode", path: officialPath("/users/" + ENCODED + "/pin_codes"), reply: VOID_OK,
    run: async (domain, call) => domain.assignPinCode(ID, "67203419", call), verb: "PUT" },

  { method: "unassignPinCode", path: officialPath("/users/" + ENCODED + "/pin_codes"), reply: VOID_OK, run: async (domain, call) => domain.unassignPinCode(ID, call),
    verb: "DELETE" },

  { body: "{\"name\":\"Staff\"}", method: "createGroup", path: officialPath("/user_groups"), reply: VOID_OK,
    run: async (domain, call) => domain.createGroup({ name: "Staff" }, call), verb: "POST" },

  { expected: [USER_GROUP], method: "fetchAllGroups", path: officialPath("/user_groups"), reply: { "code": "SUCCESS", "data": [USER_GROUP], "msg": "success" },
    run: async (domain, call) => domain.fetchAllGroups(call), verb: "GET" },

  { expected: USER_GROUP, method: "fetchGroup", path: officialPath("/user_groups/" + ENCODED), reply: { "code": "SUCCESS", "data": USER_GROUP,
    "msg": "success" }, run: async (domain, call) => domain.fetchGroup(ID, call), verb: "GET" },

  { body: "{\"name\":\"Contractors\"}", method: "updateGroup", path: officialPath("/user_groups/" + ENCODED), reply: VOID_OK,
    run: async (domain, call) => domain.updateGroup(ID, { name: "Contractors" }, call), verb: "PUT" },

  { method: "deleteGroup", path: officialPath("/user_groups/" + ENCODED), reply: VOID_OK, run: async (domain, call) => domain.deleteGroup(ID, call), verb: "DELETE" },

  // The bare array is the whole body. A wrapper member sneaking in is the documented trap on this endpoint and its three siblings below.
  { body: "[\"u-1\",\"u-2\"]", method: "assignToGroup", path: officialPath("/user_groups/" + ENCODED + "/users"), reply: VOID_OK,
    run: async (domain, call) => domain.assignToGroup(ID, [ "u-1", "u-2" ], call), verb: "POST" },

  { body: "[\"u-1\"]", method: "unassignFromGroup", path: officialPath("/user_groups/" + ENCODED + "/users/delete"), reply: VOID_OK,
    run: async (domain, call) => domain.unassignFromGroup(ID, ["u-1"], call), verb: "POST" },

  { expected: [GROUP_MEMBER], method: "fetchGroupUsers", path: officialPath("/user_groups/" + ENCODED + "/users"), reply: { "code": "SUCCESS",
    "data": [GROUP_MEMBER], "msg": "success" }, run: async (domain, call) => domain.fetchGroupUsers(ID, call), verb: "GET" },

  { expected: [GROUP_MEMBER], method: "fetchAllGroupUsers", path: officialPath("/user_groups/" + ENCODED + "/users/all"), reply: { "code": "SUCCESS",
    "data": [GROUP_MEMBER], "msg": "success" }, run: async (domain, call) => domain.fetchAllGroupUsers(ID, call), verb: "GET" },

  { expected: [POLICY], method: "fetchAccessPolicies", path: officialPath("/users/" + ENCODED + "/access_policies") + "?only_user_policies=true",
    reply: { "code": "SUCCESS", "data": [POLICY], "msg": "success" }, run: async (domain, call) => domain.fetchAccessPolicies(ID, { "only_user_policies": true }, call),
    verb: "GET" },

  { body: "{\"access_policy_ids\":[]}", method: "assignAccessPoliciesToGroup", path: officialPath("/user_groups/" + ENCODED + "/access_policies"),
    reply: VOID_OK, run: async (domain, call) => domain.assignAccessPoliciesToGroup(ID, [], call), verb: "PUT" },

  { expected: [POLICY], method: "fetchGroupAccessPolicies", path: officialPath("/user_groups/" + ENCODED + "/access_policies"), reply: { "code": "SUCCESS",
    "data": [POLICY], "msg": "success" }, run: async (domain, call) => domain.fetchGroupAccessPolicies(ID, call), verb: "GET" },

  { method: "delete", path: officialPath("/users/" + ENCODED), reply: VOID_OK, run: async (domain, call) => domain.delete(ID, call), verb: "DELETE" },

  { expected: { data: [SEARCH_RESULT], pagination: PAGINATION }, method: "search",
    path: officialPath("/users/search") + "?page_num=1&page_size=3&keyword=ada&only_admin=false&status=ACTIVE&status=PENDING&user_id=u-1&user_id=u-2",
    reply: { "code": "SUCCESS", "data": [SEARCH_RESULT], "msg": "success", "pagination": PAGINATION },
    run: async (domain, call) => domain.search({ keyword: "ada", onlyAdmin: false, pageNum: 1, pageSize: 3, status: [ "ACTIVE", "PENDING" ],
      userId: [ "u-1", "u-2" ] }, call), verb: "GET" },

  { expected: TOUCH_PASS, method: "assignTouchPass", path: officialPath("/users/" + ENCODED + "/touch_passes/" + ENCODED), reply: { "code": "SUCCESS",
    "data": TOUCH_PASS, "msg": "success" }, run: async (domain, call) => domain.assignTouchPass(ID, ID, call), verb: "PUT" },

  { expected: TOUCH_PASS, method: "unassignTouchPass", path: officialPath("/users/" + ENCODED + "/touch_passes/" + ENCODED), reply: { "code": "SUCCESS",
    "data": TOUCH_PASS, "msg": "success" }, run: async (domain, call) => domain.unassignTouchPass(ID, ID, call), verb: "DELETE" },

  { body: "{\"ids\":[\"u-1\"]}", expected: [TOUCH_PASS], method: "batchAssignTouchPasses", path: officialPath("/users/touch_passes/assign"),
    reply: { "code": "SUCCESS", "data": [TOUCH_PASS], "msg": "success" },
    run: async (domain, call) => domain.batchAssignTouchPasses({ ids: ["u-1"] }, call), verb: "PUT" },

  { body: "[\"abcd5\",\"efge36\"]", method: "assignLicensePlates", path: officialPath("/users/" + ENCODED + "/license_plates"), reply: VOID_OK,
    run: async (domain, call) => domain.assignLicensePlates(ID, [ "abcd5", "efge36" ], call), verb: "PUT" },

  { method: "unassignLicensePlate", path: officialPath("/users/" + ENCODED + "/license_plates/" + ENCODED), reply: VOID_OK,
    run: async (domain, call) => domain.unassignLicensePlate(ID, ID, call), verb: "DELETE" },

  { expected: { "avatar_url": "/avatar/u-1.png" },

    inspect: (request) => {

      const parts = parseMultipart(request.body, request.headers["content-type"] ?? "");

      assert.equal(parts.length, 1);
      assert.equal(parts[0]?.field, "file");
      assert.equal(parts[0]?.filename, "portrait.png");
      assert.deepEqual(parts[0]?.data, Buffer.from([ 137, 80, 78, 71 ]));
    },
    method: "uploadAvatar", path: officialPath("/users/" + ENCODED + "/avatar"), reply: { "code": "SUCCESS", "data": { "avatar_url": "/avatar/u-1.png" },
      "msg": "success" }, run: async (domain, call) => domain.uploadAvatar(ID, { data: new Uint8Array([ 137, 80, 78, 71 ]), filename: "portrait.png" }, call),
    verb: "POST" }
];

describeDomainTable({ domainClass: OfficialUsers, name: "OfficialUsers", rows });

describe("OfficialUsers vocabularies", () => {

  test("the user status admits an undocumented value while keeping its documented literals", () => {

    const undocumented: AccessOfficialUser["status"] = "ARCHIVED";
    const literals: [ Extract<AccessOfficialUser["status"], "ACTIVE">, Extract<AccessOfficialUser["status"], "DEACTIVATED">,
      Extract<AccessOfficialUser["status"], "PENDING"> ] = [ "ACTIVE", "DEACTIVATED", "PENDING" ];

    assert.equal(undocumented, "ARCHIVED");
    assert.deepEqual(literals, [ "ACTIVE", "DEACTIVATED", "PENDING" ]);
  });

  test("the group member's own status widens on the same terms as the full user record's", () => {

    // The membership list reports status too, on its own narrower record. It is checked here rather than assumed to follow the record above, because the two are
    // separate declarations and only one of them would fail if they ever diverged.
    const undocumented: AccessOfficialUserGroupMember["status"] = "ARCHIVED";
    const literals: [ Extract<AccessOfficialUserGroupMember["status"], "ACTIVE">, Extract<AccessOfficialUserGroupMember["status"], "DEACTIVATED">,
      Extract<AccessOfficialUserGroupMember["status"], "PENDING"> ] = [ "ACTIVE", "DEACTIVATED", "PENDING" ];

    assert.equal(undocumented, "ARCHIVED");
    assert.deepEqual(literals, [ "ACTIVE", "DEACTIVATED", "PENDING" ]);
  });

  test("the request vocabularies stay closed", () => {

    // @ts-expect-error - only the two statuses the update endpoint documents may be asked for; PENDING is a state the controller assigns, not one a caller sets.
    const status: AccessOfficialUserUpdate["status"] = "PENDING";

    // @ts-expect-error - the expansion is a string vocabulary, and only one value is documented for this endpoint.
    const expand: AccessOfficialUserExpand = "resource";

    assert.deepEqual([ status, expand ], [ "PENDING", "resource" ]);
  });

  test("the live user record satisfies its type without a cast", () => {

    const user: AccessOfficialUser = USER;

    assert.equal(user.pin_code, null);
    assert.equal(user.access_policies, undefined, "an unexpanded read reports no policies rather than an empty set");
  });
});

describe("the account shape the registration echo and the membership list share", () => {

  /* One account shape observed through two endpoints with different confidence, so the echo is derived from the membership record rather than restated beside it.
   * These rows are what make that derivation checkable: the four members the reference documents stay required on the echo, everything else becomes optional, and
   * the two shapes still describe the same account.
   */
  test("the four documented members are all a registration echo must carry", () => {

    const echoed: AccessOfficialUserCreated = { "first_name": "Acme first_name 1", "id": "0ace0000-0000-4000-8000-000000000000", "last_name": "Acme last_name 1",
      "user_email": "user-1@acme.example" };

    assert.equal(echoed.id, "0ace0000-0000-4000-8000-000000000000");
    assert.equal(echoed.username, undefined, "a member the echo did not carry reads as absent rather than failing to compile");
  });

  test("dropping one of the four documented members is a compile error", () => {

    // @ts-expect-error - the reference documents these four and the wire confirms them, so an echo missing one is not an echo this endpoint produces.
    const incomplete: AccessOfficialUserCreated = { "first_name": "Acme first_name 1", "id": "0ace0000-0000-4000-8000-000000000000", "last_name": "Acme last_name 1" };

    assert.equal(incomplete.user_email, undefined);
  });

  test("a complete membership record is a complete echo, and the echo's own members type as the membership record's do", () => {

    /* Assignability in both directions, which is what says the two are one shape rather than two that happen to share names. A full membership record satisfies the
     * echo outright; the echo does not satisfy the membership record, because its optional members are exactly what the membership list is confident about.
     */
    const member: AccessOfficialUserGroupMember = { "alias": "", "avatar_relative_path": "", "email": "user-1@acme.example", "email_status": "VERIFIED",
      "employee_number": "", "first_name": "Acme first_name 1", "full_name": "Acme Name 1", "id": "0ace0000-0000-4000-8000-000000000000",
      "last_name": "Acme last_name 1", "onboard_time": 1, "phone": "", "status": "ACTIVE", "user_email": "user-1@acme.example", "username": "Acme username 1" };
    const echoed: AccessOfficialUserCreated = member;

    // @ts-expect-error - the echo's members are optional, so it cannot stand in for the record the membership list is confident about.
    const asMember: AccessOfficialUserGroupMember = echoed;

    // The status vocabulary reaches the echo through the derivation rather than being restated as a bare string, so its documented literals narrow here too.
    const status: Extract<AccessOfficialUserCreated["status"], "ACTIVE"> = "ACTIVE";

    assert.equal(echoed.full_name, "Acme Name 1");
    assert.equal(asMember.username, "Acme username 1");
    assert.equal(status, "ACTIVE");
  });
});

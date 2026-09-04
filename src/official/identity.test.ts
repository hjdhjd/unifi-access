/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * identity.test.ts: Unit tests for the official API's UniFi Identity domain. Nothing here is live-verified - the endpoints need an Identity-joined controller - so
 * these rows assert the documented shapes, including the invitation body that is a bare array and the response key set that is wider than the query's own.
 */
import { describe, test } from "node:test";
import { describeDomainTable, domainRig, officialPath } from "./domain.helpers.ts";
import type { AccessOfficialIdentityResourceOptions } from "./identity.ts";
import type { DomainRow } from "./domain.helpers.ts";
import { OfficialIdentity } from "./identity.ts";
import assert from "node:assert/strict";

const ID = "a b/c";
const ENCODED = "a%20b%2Fc";
const VOID_OK = { "code": "SUCCESS", "msg": "success" };

// The response groups resources under four keys where the query parameter documents only three - camera is reachable in the answer but not askable for.
const RESOURCES = { "camera": [{ "deleted": false, "id": "cam-1", "name": "Lobby" }],
  "vpn": [{ "deleted": false, "id": "vpn-1", "metadata": { "has_ip": true }, "name": "Office", "short_name": "off" }],
  "wifi": [{ "deleted": false, "id": "wifi-1", "metadata": null, "name": "Guest" }] };

const rows: readonly DomainRow<OfficialIdentity>[] = [

  // The bare array is the whole body - a wrapper member here is the same trap the user-group assignment endpoints carry.
  { body: "[{\"email\":\"grace@example.test\",\"user_id\":\"u-1\"},{\"user_id\":\"u-2\"}]", expected: [], method: "sendInvitations",
    path: officialPath("/users/identity/invitations"), reply: { "code": "SUCCESS", "data": [], "msg": "success" },
    run: async (domain, call) => domain.sendInvitations([ { "email": "grace@example.test", "user_id": "u-1" }, { "user_id": "u-2" } ], call), verb: "POST" },

  { expected: RESOURCES, method: "fetchAvailableResources", path: officialPath("/users/identity/assignments") + "?resource_type=vpn",
    reply: { "code": "SUCCESS", "data": RESOURCES, "msg": "success" }, run: async (domain, call) => domain.fetchAvailableResources({ "resource_type": "vpn" }, call),
    verb: "GET" },

  { body: "{\"resource_ids\":[\"vpn-1\"],\"resource_type\":\"vpn\"}", method: "assignUserResources",
    path: officialPath("/users/" + ENCODED + "/identity/assignments"), reply: VOID_OK,
    run: async (domain, call) => domain.assignUserResources(ID, { "resource_ids": ["vpn-1"], "resource_type": "vpn" }, call), verb: "POST" },

  { expected: RESOURCES, method: "fetchUserResources", path: officialPath("/users/" + ENCODED + "/identity/assignments"), reply: { "code": "SUCCESS",
    "data": RESOURCES, "msg": "success" }, run: async (domain, call) => domain.fetchUserResources(ID, call), verb: "GET" },

  { body: "{\"resource_ids\":[\"wifi-1\"],\"resource_type\":\"wifi\"}", method: "assignGroupResources",
    path: officialPath("/user_groups/" + ENCODED + "/identity/assignments"), reply: VOID_OK,
    run: async (domain, call) => domain.assignGroupResources(ID, { "resource_ids": ["wifi-1"], "resource_type": "wifi" }, call), verb: "POST" },

  { expected: RESOURCES, method: "fetchGroupResources", path: officialPath("/user_groups/" + ENCODED + "/identity/assignments"), reply: { "code": "SUCCESS",
    "data": RESOURCES, "msg": "success" }, run: async (domain, call) => domain.fetchGroupResources(ID, call), verb: "GET" }
];

describeDomainTable({ domainClass: OfficialIdentity, name: "OfficialIdentity", rows });

describe("OfficialIdentity vocabularies", () => {

  test("the query resource type stays closed over the documented set", () => {

    // @ts-expect-error - the query parameter documents three kinds; camera appears in the response and cannot be asked for.
    const outside: AccessOfficialIdentityResourceOptions["resource_type"] = "camera";

    assert.equal(outside, "camera");
  });

  test("a partial invitation failure arrives in a success envelope", async () => {

    const failure = { "error_code": "", "error_msg": "invalid email", "user_email": "nope", "user_id": "u-2" };
    const rig = domainRig((options) => new OfficialIdentity(options));

    rig.pool.intercept({ method: "POST", path: officialPath("/users/identity/invitations") }).reply(200, { "code": "SUCCESS", "data": [failure],
      "msg": "success" });

    const failures = await rig.domain.sendInvitations([{ "user_id": "u-2" }]);

    // The envelope says success even though an invitation did not go out, so the returned array is the only place the failure is visible.
    assert.deepEqual(failures, [failure]);
  });
});

/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * visitors.test.ts: Unit tests for the official API's visitor domain - the per-endpoint rows, and the type assertions on the integer status code and the two distinct
 * spellings the reference uses for a visit's weekly pattern on the way in and on the way out.
 */
import type { AccessOfficialVisitor, AccessOfficialVisitorCreate, AccessOfficialVisitorResource, AccessOfficialVisitorSchedule } from "./visitors.ts";
import type { DomainRow, WalkRow } from "./domain.helpers.ts";
import { PATH_ID, PATH_ID_ENCODED, VOID_OK, describeDomainTable, describeWalkTable, officialPath } from "./domain.helpers.ts";
import { describe, test } from "node:test";
import { OfficialVisitors } from "./visitors.ts";
import assert from "node:assert/strict";

// Transcribed from the reference's own visitor sample, whose one-time visit carries a null weekly pattern.
const VISITOR = { "email": "guest@example.test", "end_time": 1689157339, "first_name": "Grace", "id": "v-1", "inviter_id": "u-1", "inviter_name": "Acme Name 1",
  "last_name": "Hopper", "mobile_phone": "", "nfc_cards": [], "pin_code": null, "remarks": "", "schedule": { "is_default": true, "name": "Always Access",
    "type": "access", "weekly": null }, "schedule_id": "sched-1", "start_time": 1689150139, "status": 1, "visit_reason": "Interview",
  "visitor_company": "" };

const PAGINATION = { "page_num": 1, "page_size": 0, "total": 0 };

const rows: readonly DomainRow<OfficialVisitors>[] = [

  { body: "{\"end_time\":1689157339,\"first_name\":\"Grace\",\"last_name\":\"Hopper\",\"start_time\":1689150139,\"visit_reason\":\"Interview\"}",
    expected: VISITOR, method: "create", path: officialPath("/visitors"), reply: { "code": "SUCCESS", "data": VISITOR, "msg": "success" },
    run: async (domain, call) => domain.create({ "end_time": 1689157339, "first_name": "Grace", "last_name": "Hopper", "start_time": 1689150139,
      "visit_reason": "Interview" }, call), verb: "POST" },

  { expected: VISITOR, method: "fetch", path: officialPath("/visitors/" + PATH_ID_ENCODED), reply: { "code": "SUCCESS", "data": VISITOR, "msg": "success" },
    run: async (domain, call) => domain.fetch(PATH_ID, call), verb: "GET" },

  { expected: { data: [], pagination: PAGINATION }, method: "fetchAll",
    path: officialPath("/visitors") + "?page_num=1&page_size=25&expand%5B%5D=nfc_card&keyword=gr&status=1",
    reply: { "code": "SUCCESS", "data": [], "msg": "succ", "pagination": PAGINATION },
    run: async (domain, call) => domain.fetchAll({ expand: ["nfc_card"], keyword: "gr", pageNum: 1, pageSize: 25, status: 1 }, call), verb: "GET" },

  { expected: [], method: "iterateAll", path: officialPath("/visitors") + "?page_num=1&page_size=25&expand%5B%5D=nfc_card&keyword=gr&status=1",
    reply: { "code": "SUCCESS", "data": [], "msg": "succ", "pagination": PAGINATION },
    run: async (domain, call) => Array.fromAsync(domain.iterateAll({ expand: ["nfc_card"], keyword: "gr", pageSize: 25, status: 1 }, call)), verb: "GET" },

  { body: "{\"remarks\":\"Rescheduled\"}", expected: VISITOR, method: "update", path: officialPath("/visitors/" + PATH_ID_ENCODED),
    reply: { "code": "SUCCESS", "data": VISITOR, "msg": "success" }, run: async (domain, call) => domain.update(PATH_ID, { remarks: "Rescheduled" }, call), verb: "PUT" },

  { method: "delete", path: officialPath("/visitors/" + PATH_ID_ENCODED) + "?is_force=true", reply: VOID_OK,
    run: async (domain, call) => domain.delete(PATH_ID, { "is_force": true }, call), verb: "DELETE" },

  { body: "{\"token\":\"tok-1\"}", method: "assignNfcCard", path: officialPath("/visitors/" + PATH_ID_ENCODED + "/nfc_cards"), reply: VOID_OK,
    run: async (domain, call) => domain.assignNfcCard(PATH_ID, { token: "tok-1" }, call), verb: "PUT" },

  { body: "{\"token\":\"tok-1\"}", method: "unassignNfcCard", path: officialPath("/visitors/" + PATH_ID_ENCODED + "/nfc_cards/delete"), reply: VOID_OK,
    run: async (domain, call) => domain.unassignNfcCard(PATH_ID, "tok-1", call), verb: "PUT" },

  { body: "{\"pin_code\":\"67203419\"}", method: "assignPinCode", path: officialPath("/visitors/" + PATH_ID_ENCODED + "/pin_codes"), reply: VOID_OK,
    run: async (domain, call) => domain.assignPinCode(PATH_ID, "67203419", call), verb: "PUT" },

  { method: "unassignPinCode", path: officialPath("/visitors/" + PATH_ID_ENCODED + "/pin_codes"), reply: VOID_OK,
    run: async (domain, call) => domain.unassignPinCode(PATH_ID, call), verb: "DELETE" },

  // The endpoint takes no body at all - the visitor named in the path is the whole request.
  { method: "assignQrCode", path: officialPath("/visitors/" + PATH_ID_ENCODED + "/qr_codes"), reply: VOID_OK,
    run: async (domain, call) => domain.assignQrCode(PATH_ID, call), verb: "PUT" },

  { method: "unassignQrCode", path: officialPath("/visitors/" + PATH_ID_ENCODED + "/qr_codes"), reply: VOID_OK,
    run: async (domain, call) => domain.unassignQrCode(PATH_ID, call), verb: "DELETE" },

  { body: "[\"abcd\",\"efge3\"]", method: "assignLicensePlates", path: officialPath("/visitors/" + PATH_ID_ENCODED + "/license_plates"), reply: VOID_OK,
    run: async (domain, call) => domain.assignLicensePlates(PATH_ID, [ "abcd", "efge3" ], call), verb: "PUT" },

  { method: "unassignLicensePlate", path: officialPath("/visitors/" + PATH_ID_ENCODED + "/license_plates/" + PATH_ID_ENCODED), reply: VOID_OK,
    run: async (domain, call) => domain.unassignLicensePlate(PATH_ID, PATH_ID, call), verb: "DELETE" }
];

describeDomainTable({ domainClass: OfficialVisitors, name: "OfficialVisitors", rows });

// The two-page walk. The page row above establishes what one request carries; this establishes that a walk keeps asking.
const walks: readonly WalkRow<OfficialVisitors>[] = [

  { method: "iterateAll", paths: [ officialPath("/visitors") + "?page_num=1&page_size=1", officialPath("/visitors") + "?page_num=2&page_size=1" ],
    records: [ VISITOR, { ...VISITOR, "id": "v-2" } ], run: async (domain, call) => Array.fromAsync(domain.iterateAll({ pageSize: 1 }, call)) }
];

describeWalkTable({ domainClass: OfficialVisitors, name: "OfficialVisitors walks", rows: walks });

describe("OfficialVisitors vocabularies", () => {

  test("the visitor status admits an undocumented code while keeping its documented literals", () => {

    const undocumented: AccessOfficialVisitor["status"] = 7;
    const literals: [ Extract<AccessOfficialVisitor["status"], 1>, Extract<AccessOfficialVisitor["status"], 2>, Extract<AccessOfficialVisitor["status"], 3>,
      Extract<AccessOfficialVisitor["status"], 4>, Extract<AccessOfficialVisitor["status"], 5>,
      Extract<AccessOfficialVisitor["status"], 6> ] = [ 1, 2, 3, 4, 5, 6 ];

    assert.equal(undocumented, 7);
    assert.deepEqual(literals, [ 1, 2, 3, 4, 5, 6 ]);
  });

  test("the visit reason admits an undocumented value while keeping its documented literals", () => {

    const undocumented: AccessOfficialVisitor["visit_reason"] = "Delivery";
    const literals: [ Extract<AccessOfficialVisitor["visit_reason"], "Business">, Extract<AccessOfficialVisitor["visit_reason"], "Cooperation">,
      Extract<AccessOfficialVisitor["visit_reason"], "Interview">,
      Extract<AccessOfficialVisitor["visit_reason"], "Others"> ] = [ "Business", "Cooperation", "Interview", "Others" ];

    assert.equal(undocumented, "Delivery");
    assert.deepEqual(literals, [ "Business", "Cooperation", "Interview", "Others" ]);
  });

  test("the visit schedule kind admits an undocumented value while keeping its documented literal", () => {

    const undocumented: AccessOfficialVisitorSchedule["type"] = "maintenance";
    const literal: Extract<AccessOfficialVisitorSchedule["type"], "access"> = "access";

    assert.deepEqual([ undocumented, literal ], [ "maintenance", "access" ]);
  });

  test("the visitor resource kind admits an undocumented value while keeping its documented literals", () => {

    const undocumented: AccessOfficialVisitorResource["type"] = "elevator";
    const literals: [ Extract<AccessOfficialVisitorResource["type"], "door">,
      Extract<AccessOfficialVisitorResource["type"], "door_group"> ] = [ "door", "door_group" ];

    assert.equal(undocumented, "elevator");
    assert.deepEqual(literals, [ "door", "door_group" ]);
  });

  test("the request vocabularies stay closed", () => {

    // @ts-expect-error - the four documented reasons are what a caller may send.
    const reason: AccessOfficialVisitorCreate["visit_reason"] = "Delivery";

    assert.equal(reason, "Delivery");
  });

  test("the response spells the weekly pattern differently from the request that sets it", () => {

    const visitor: AccessOfficialVisitor = VISITOR;
    const create: AccessOfficialVisitorCreate = { "end_time": 2, "first_name": "Grace", "last_name": "Hopper", "start_time": 1, "visit_reason": "Interview",
      "week_schedule": { friday: [], monday: [], saturday: [], sunday: [], thursday: [], tuesday: [], wednesday: [] } };

    // Two documented spellings for the one concept, transcribed rather than reconciled: `week_schedule` going in, `weekly` coming back.
    assert.equal(visitor.schedule?.weekly, null, "a one-time visit carries no recurring pattern");
    assert.deepEqual(create.week_schedule?.monday, []);
  });
});

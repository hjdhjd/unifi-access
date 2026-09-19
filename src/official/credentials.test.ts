/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * credentials.test.ts: Unit tests for the official API's credential domain, including the endpoints that leave the JSON path entirely, such as the CSV import
 * that sends a multipart body and the QR code download that answers raw bytes.
 */
import type { AccessOfficialLicensePlate, AccessOfficialNfcCard, AccessOfficialNfcCardRef, AccessOfficialTouchPass, AccessOfficialTouchPassBundle,
  AccessOfficialTouchPassBundleUpdate, AccessOfficialTouchPassListOptions, AccessOfficialTouchPassUpdate } from "./credentials.ts";
import type { DomainRow, WalkRow } from "./domain.helpers.ts";
import { PATH_ID, PATH_ID_ENCODED, VOID_OK, describeDomainTable, describeWalkTable, officialPath, parseMultipart } from "./domain.helpers.ts";
import { describe, test } from "node:test";
import { OfficialCredentials } from "./credentials.ts";
import assert from "node:assert/strict";

// Transcribed from a live controller, `note` and `nfc_id` included - both are on the wire and in no documented schema.
const NFC_CARD = { "alias": "dd51177a", "card_type": "ua_card", "display_id": "100000", "nfc_id": "0411224AA56580", "note": "100000", "status": "assigned",
  "token": "dd51177a929667e8d5e047596c87123c3ca62cb3f3aef4f64f6c6ea7c6baa95a",
  "user": { "avatar": "", "first_name": "Acme first_name 1", "id": "0ace0000-0000-4000-8000-000000000000", "last_name": "Acme last_name 1", "name": "Acme Name 1" },
  "user_id": "0ace0000-0000-4000-8000-000000000000", "user_type": "USER" };

// Transcribed from a live controller: an unassigned pass, whose empty `user_*` members are the wire's own way of saying so.
const TOUCH_PASS = { "bundles": [], "card_id": "AAAA-BBBB-CCCC-0001", "card_name": "", "id": "0ace0000-0000-4000-8000-000000000008", "last_activity": null,
  "status": "INACTIVE", "user_avatar": "", "user_email": "", "user_id": "", "user_name": "", "user_status": "" };

const PAGINATION = { "page_num": 1, "page_size": 1, "total": 1 };

const rows: readonly DomainRow<OfficialCredentials>[] = [

  { expected: "67203419", method: "generatePinCode", path: officialPath("/credentials/pin_codes"), reply: { "code": "SUCCESS", "data": "67203419",
    "msg": "success" }, run: async (domain, call) => domain.generatePinCode(call), verb: "POST" },

  { body: "{\"device_id\":\"reader-1\"}", expected: { "session_id": "sess-1" }, method: "enrollNfcCard", path: officialPath("/credentials/nfc_cards/sessions"),
    reply: { "code": "SUCCESS", "data": { "session_id": "sess-1" }, "msg": "success" },
    run: async (domain, call) => domain.enrollNfcCard({ "device_id": "reader-1" }, call),
    verb: "POST" },

  { expected: { "card_id": "100000", "token": "tok-1" }, method: "fetchNfcEnrollmentStatus", path: officialPath("/credentials/nfc_cards/sessions/" + PATH_ID_ENCODED),
    reply: { "code": "SUCCESS", "data": { "card_id": "100000", "token": "tok-1" }, "msg": "success" },
    run: async (domain, call) => domain.fetchNfcEnrollmentStatus(PATH_ID, call), verb: "GET" },

  { method: "cancelNfcEnrollment", path: officialPath("/credentials/nfc_cards/sessions/" + PATH_ID_ENCODED), reply: VOID_OK,
    run: async (domain, call) => domain.cancelNfcEnrollment(PATH_ID, call), verb: "DELETE" },

  { expected: NFC_CARD, method: "fetchNfcCard", path: officialPath("/credentials/nfc_cards/tokens/" + PATH_ID_ENCODED), reply: { "code": "SUCCESS", "data": NFC_CARD,
    "msg": "succ" }, run: async (domain, call) => domain.fetchNfcCard(PATH_ID, call), verb: "GET" },

  { expected: { data: [NFC_CARD], pagination: PAGINATION }, method: "fetchAllNfcCards",
    path: officialPath("/credentials/nfc_cards/tokens") + "?page_num=1&page_size=25", reply: { "code": "SUCCESS", "data": [NFC_CARD], "msg": "succ",
      "pagination": PAGINATION }, run: async (domain, call) => domain.fetchAllNfcCards({ pageNum: 1, pageSize: 25 }, call), verb: "GET" },

  { expected: [NFC_CARD], method: "iterateNfcCards", path: officialPath("/credentials/nfc_cards/tokens") + "?page_num=1&page_size=25",
    reply: { "code": "SUCCESS", "data": [NFC_CARD], "msg": "succ", "pagination": PAGINATION },
    run: async (domain, call) => Array.fromAsync(domain.iterateNfcCards({ pageSize: 25 }, call)), verb: "GET" },

  { method: "deleteNfcCard", path: officialPath("/credentials/nfc_cards/tokens/" + PATH_ID_ENCODED), reply: VOID_OK,
    run: async (domain, call) => domain.deleteNfcCard(PATH_ID, call), verb: "DELETE" },

  { body: "{\"alias\":\"Front desk\"}", method: "updateNfcCard", path: officialPath("/credentials/nfc_cards/tokens/" + PATH_ID_ENCODED), reply: VOID_OK,
    run: async (domain, call) => domain.updateNfcCard(PATH_ID, { alias: "Front desk" }, call), verb: "PUT" },

  { expected: { data: [TOUCH_PASS], pagination: PAGINATION }, method: "fetchAllTouchPasses",
    path: officialPath("/credentials/touch_passes") + "?page_num=1&page_size=10&status=INACTIVE", reply: { "code": "SUCCESS", "data": [TOUCH_PASS],
      "msg": "succ", "pagination": PAGINATION }, run: async (domain, call) => domain.fetchAllTouchPasses({ pageNum: 1, pageSize: 10, status: "INACTIVE" }, call),
    verb: "GET" },

  { expected: [TOUCH_PASS], method: "iterateTouchPasses", path: officialPath("/credentials/touch_passes") + "?page_num=1&page_size=10&status=INACTIVE",
    reply: { "code": "SUCCESS", "data": [TOUCH_PASS], "msg": "succ", "pagination": PAGINATION },
    run: async (domain, call) => Array.fromAsync(domain.iterateTouchPasses({ pageSize: 10, status: "INACTIVE" }, call)), verb: "GET" },

  { expected: [TOUCH_PASS], method: "searchTouchPasses", path: officialPath("/credentials/touch_passes/search") + "?condition=057B%2C+Example+Name",
    reply: { "code": "SUCCESS", "data": [TOUCH_PASS], "msg": "success" },
    run: async (domain, call) => domain.searchTouchPasses("057B, Example Name", call), verb: "GET" },

  { expected: [TOUCH_PASS], method: "fetchAssignableTouchPasses", path: officialPath("/credentials/touch_passes/assignable"), reply: { "code": "SUCCESS",
    "data": [TOUCH_PASS], "msg": "success" }, run: async (domain, call) => domain.fetchAssignableTouchPasses(call), verb: "GET" },

  { body: "{\"card_name\":\"Lobby\"}", expected: TOUCH_PASS, method: "updateTouchPass", path: officialPath("/credentials/touch_passes/" + PATH_ID_ENCODED),
    reply: { "code": "SUCCESS", "data": TOUCH_PASS, "msg": "success" },
    run: async (domain, call) => domain.updateTouchPass(PATH_ID, { "card_name": "Lobby" }, call), verb: "PUT" },

  { expected: TOUCH_PASS, method: "fetchTouchPass", path: officialPath("/credentials/touch_passes/" + PATH_ID_ENCODED), reply: { "code": "SUCCESS", "data": TOUCH_PASS,
    "msg": "success" }, run: async (domain, call) => domain.fetchTouchPass(PATH_ID, call), verb: "GET" },

  { body: "{\"count\":2}", expected: TOUCH_PASS, method: "purchaseTouchPasses", path: officialPath("/credentials/touch_passes"), reply: { "code": "SUCCESS",
    "data": TOUCH_PASS, "msg": "success" }, run: async (domain, call) => domain.purchaseTouchPasses(2, call), verb: "POST" },

  { expected: Buffer.from("PNGBYTES"), method: "downloadQrCode", path: officialPath("/credentials/qr_codes/download/" + PATH_ID_ENCODED),
    reply: Buffer.from("PNGBYTES"), replyHeaders: { "content-type": "image/png" }, run: async (domain, call) => domain.downloadQrCode(PATH_ID, call), verb: "GET" },

  { expected: [ { "alias": "alias1", "nfc_id": "068E2836", "token": "tok-1" }, { "alias": "alias2", "nfc_id": "068E2837", "token": "" } ],

    // The filename deliberately differs from anything the method could hard-code, so a method that invented one instead of forwarding the caller's fails here.
    inspect: (request) => {

      const parts = parseMultipart(request.body, request.headers["content-type"] ?? "");

      assert.equal(parts.length, 1);
      assert.equal(parts[0]?.field, "file");
      assert.equal(parts[0]?.filename, "third-party-cards.csv");
      assert.equal(parts[0]?.contentType, "application/octet-stream");
      assert.equal(parts[0]?.data.toString("utf8"), "068E2836,alias1\n068E2837,alias2\n");
    },
    method: "importNfcCards", path: officialPath("/credentials/nfc_cards/import"), reply: { "code": "SUCCESS", "data": [ { "alias": "alias1",
      "nfc_id": "068E2836", "token": "tok-1" }, { "alias": "alias2", "nfc_id": "068E2837", "token": "" } ], "msg": "success" },
    run: async (domain, call) => domain.importNfcCards({ data: "068E2836,alias1\n068E2837,alias2\n", filename: "third-party-cards.csv" }, call), verb: "POST" }
];

describeDomainTable({ domainClass: OfficialCredentials, name: "OfficialCredentials", rows });

// The two-page walks, one row per iterating method. A page row above establishes what one request carries; these establish that a walk keeps asking.
const walks: readonly WalkRow<OfficialCredentials>[] = [

  { method: "iterateNfcCards",
    paths: [ officialPath("/credentials/nfc_cards/tokens") + "?page_num=1&page_size=1", officialPath("/credentials/nfc_cards/tokens") + "?page_num=2&page_size=1" ],
    records: [ NFC_CARD, { ...NFC_CARD, "token": "tok-2" } ], run: async (domain, call) => Array.fromAsync(domain.iterateNfcCards({ pageSize: 1 }, call)) },

  { method: "iterateTouchPasses",
    paths: [ officialPath("/credentials/touch_passes") + "?page_num=1&page_size=1", officialPath("/credentials/touch_passes") + "?page_num=2&page_size=1" ],
    records: [ TOUCH_PASS, { ...TOUCH_PASS, "id": "tp-2" } ], run: async (domain, call) => Array.fromAsync(domain.iterateTouchPasses({ pageSize: 1 }, call)) }
];

describeWalkTable({ domainClass: OfficialCredentials, name: "OfficialCredentials walks", rows: walks });

describe("OfficialCredentials vocabularies", () => {

  test("the NFC card status admits an undocumented value while keeping its documented literals", () => {

    const undocumented: AccessOfficialNfcCard["status"] = "quarantined";
    const literals: [ Extract<AccessOfficialNfcCard["status"], "assigned">, Extract<AccessOfficialNfcCard["status"], "deleted">,
      Extract<AccessOfficialNfcCard["status"], "disable">, Extract<AccessOfficialNfcCard["status"], "loss">,
      Extract<AccessOfficialNfcCard["status"], "pending"> ] = [ "assigned", "deleted", "disable", "loss", "pending" ];

    assert.equal(undocumented, "quarantined");
    assert.deepEqual(literals, [ "assigned", "deleted", "disable", "loss", "pending" ]);
  });

  test("the NFC card holder kind admits an undocumented value while keeping its documented literals", () => {

    const undocumented: AccessOfficialNfcCard["user_type"] = "SERVICE";
    const literals: [ Extract<AccessOfficialNfcCard["user_type"], "USER">, Extract<AccessOfficialNfcCard["user_type"], "VISITOR"> ] = [ "USER", "VISITOR" ];

    assert.equal(undocumented, "SERVICE");
    assert.deepEqual(literals, [ "USER", "VISITOR" ]);
  });

  test("the Touch Pass statuses admit undocumented values while keeping their documented literals", () => {

    const undocumentedStatus: AccessOfficialTouchPass["status"] = "REVOKED";
    const undocumentedUserStatus: AccessOfficialTouchPass["user_status"] = "SUSPENDED";
    const statusLiterals: [ Extract<AccessOfficialTouchPass["status"], "ACTIVE">, Extract<AccessOfficialTouchPass["status"], "EXPIRED">,
      Extract<AccessOfficialTouchPass["status"], "INACTIVE">, Extract<AccessOfficialTouchPass["status"], "PENDING">,
      Extract<AccessOfficialTouchPass["status"], "SUSPENDED"> ] = [ "ACTIVE", "EXPIRED", "INACTIVE", "PENDING", "SUSPENDED" ];
    const userLiterals: [ Extract<AccessOfficialTouchPass["user_status"], "ACTIVE">, Extract<AccessOfficialTouchPass["user_status"], "PENDING">,
      Extract<AccessOfficialTouchPass["user_status"], "UNLINK"> ] = [ "ACTIVE", "PENDING", "UNLINK" ];

    assert.deepEqual([ undocumentedStatus, undocumentedUserStatus ], [ "REVOKED", "SUSPENDED" ]);
    assert.deepEqual(statusLiterals, [ "ACTIVE", "EXPIRED", "INACTIVE", "PENDING", "SUSPENDED" ]);
    assert.deepEqual(userLiterals, [ "ACTIVE", "PENDING", "UNLINK" ]);
  });

  test("the license plate vocabularies admit undocumented values while keeping their documented literals", () => {

    const status: AccessOfficialLicensePlate["credential_status"] = "revoked";
    const kind: AccessOfficialLicensePlate["credential_type"] = "rfid";
    const literals: [ Extract<AccessOfficialLicensePlate["credential_status"], "active">,
      Extract<AccessOfficialLicensePlate["credential_status"], "deactivate">,
      Extract<AccessOfficialLicensePlate["credential_type"], "license"> ] = [ "active", "deactivate", "license" ];

    assert.deepEqual([ status, kind ], [ "revoked", "rfid" ]);
    assert.deepEqual(literals, [ "active", "deactivate", "license" ]);
  });

  test("the card reference kind admits an undocumented value while keeping its documented literal", () => {

    const undocumented: AccessOfficialNfcCardRef["type"] = "mifare";
    const literal: Extract<AccessOfficialNfcCardRef["type"], "ua_card"> = "ua_card";

    assert.deepEqual([ undocumented, literal ], [ "mifare", "ua_card" ]);
  });

  test("the Touch Pass bundle vocabularies admit undocumented values while keeping their documented literals", () => {

    const status: AccessOfficialTouchPassBundle["bundle_status"] = "REVOKED";
    const source: AccessOfficialTouchPassBundle["source"] = "samsung";
    const literals: [ Extract<AccessOfficialTouchPassBundle["bundle_status"], "ACTIVE">,
      Extract<AccessOfficialTouchPassBundle["bundle_status"], "SUSPENDED">, Extract<AccessOfficialTouchPassBundle["source"], "apple">,
      Extract<AccessOfficialTouchPassBundle["source"], "google"> ] = [ "ACTIVE", "SUSPENDED", "apple", "google" ];

    assert.deepEqual([ status, source ], [ "REVOKED", "samsung" ]);
    assert.deepEqual(literals, [ "ACTIVE", "SUSPENDED", "apple", "google" ]);
  });

  test("the request vocabularies stay closed", () => {

    // @ts-expect-error - the documented set is what a caller may ask a Touch Pass to become.
    const status: AccessOfficialTouchPassUpdate["status"] = "EXPIRED";

    // @ts-expect-error - unbundling is the only bundle change the endpoint documents.
    const bundleStatus: AccessOfficialTouchPassBundleUpdate["bundle_status"] = "ACTIVE";

    // @ts-expect-error - the list filter takes the documented statuses only.
    const filter: AccessOfficialTouchPassListOptions["status"] = "EXPIRED";

    assert.deepEqual([ status, bundleStatus, filter ], [ "EXPIRED", "ACTIVE", "EXPIRED" ]);
  });

  test("the live card and pass records satisfy their types without a cast", () => {

    const card: AccessOfficialNfcCard = NFC_CARD;
    const pass: AccessOfficialTouchPass = TOUCH_PASS;

    assert.equal(card.nfc_id, "0411224AA56580");
    assert.equal(pass.user_id, "", "the empty string is the wire's own unassigned marker, carried rather than translated");
  });
});

/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * devices.test.ts: Unit tests for the official API's device domain. The two shapes this domain exists to get right are both pinned here: the grouped device payload
 * the reference's own schema table describes flat, and the access-method map that is sparse rather than complete.
 */
import type { AccessOfficialAccessMethodFace, AccessOfficialAccessMethodFaceUpdate, AccessOfficialAccessMethodValue } from "./devices.ts";
import { describe, test } from "node:test";
import { describeDomainTable, domainRig, officialPath } from "./domain.helpers.ts";
import type { DomainRow } from "./domain.helpers.ts";
import { OfficialDevices } from "./devices.ts";
import assert from "node:assert/strict";

const ID = "a b/c";
const ENCODED = "a%20b%2Fc";
const VOID_OK = { "code": "SUCCESS", "msg": "success" };

// Transcribed from a live controller: five devices across three per-door groups, trimmed to one device per group.
const HUB = { "alias": "Acme Name 6", "capabilities": [ "is_hub", "pin_code" ], "connected_uah_id": "", "id": "02ffee000000", "is_adopted": true,
  "is_connected": true, "is_managed": true, "is_online": true, "location_id": "0ace0000-0000-4000-8000-000000000002", "name": "Acme Name 4", "type": "UAH" };
const ULTRA = { "alias": "Acme Name 3", "capabilities": [ "is_hub", "is_reader" ], "connected_uah_id": "02ffee000001", "id": "02ffee000001",
  "is_adopted": false, "is_connected": false, "is_managed": true, "is_online": false, "location_id": "0ace0000-0000-4000-8000-000000000001",
  "name": "Acme Name 5", "type": "UA-ULTRA" };

// The three sparseness specimens, each transcribed from its own live capture: a hub reporting nothing, an Ultra reporting four methods, a G2 Pro reporting seven.
const HUB_SETTINGS = { "access_methods": {}, "device_id": "02ffee000000" };
const ULTRA_SETTINGS = { "access_methods": { "bt_button": { "enabled": "yes" }, "bt_tap": { "enabled": "yes" }, "nfc": { "enabled": "yes" },
  "touch_pass": { "enabled": "no" } }, "device_id": "02ffee000001" };
const G2PRO_SETTINGS = { "access_methods": { "bt_button": { "enabled": "yes" }, "bt_tap": { "enabled": "yes" },
  "face": { "anti_spoofing_level": "high", "enabled": "yes" }, "nfc": { "enabled": "yes" }, "pin_code": { "enabled": "no", "pin_code_shuffle": "no" },
  "qr_code": { "enabled": "yes" }, "touch_pass": { "enabled": "no" } }, "device_id": "02ffee000002" };

const rows: readonly DomainRow<OfficialDevices>[] = [

  { expected: [ [HUB], [ULTRA] ], method: "fetchAll", path: officialPath("/devices") + "?refresh=true", reply: { "code": "SUCCESS",
    "data": [ [HUB], [ULTRA] ], "msg": "success" }, run: async (domain, call) => domain.fetchAll({ refresh: true }, call), verb: "GET" },

  { expected: G2PRO_SETTINGS, method: "fetchSettings", path: officialPath("/devices/" + ENCODED + "/settings"), reply: { "code": "SUCCESS",
    "data": G2PRO_SETTINGS, "msg": "success" }, run: async (domain, call) => domain.fetchSettings(ID, call), verb: "GET" },

  /* The nested body, verbatim. The reference's field table names dotted top-level parameters and string boolean values; its own request sample sends this
   * `access_methods`-wrapped shape with yes and no, and on the read counterpart the live wire sided with the sample.
   */
  { body: "{\"access_methods\":{\"face\":{\"anti_spoofing_level\":\"medium\",\"detect_distance\":\"near\",\"enabled\":\"yes\"},\"nfc\":{\"enabled\":\"no\"}}}",
    method: "updateSettings", path: officialPath("/devices/" + ENCODED + "/settings"), reply: VOID_OK,
    run: async (domain, call) => domain.updateSettings(ID, { "access_methods": { face: { "anti_spoofing_level": "medium", "detect_distance": "near", enabled: "yes" },
      nfc: { enabled: "no" } } }, call), verb: "PUT" },

  { body: "{\"cancel\":false,\"room_name\":\"Lobby\"}", method: "triggerDoorbell", path: officialPath("/devices/" + ENCODED + "/doorbell"), reply: VOID_OK,
    run: async (domain, call) => domain.triggerDoorbell(ID, { cancel: false, "room_name": "Lobby" }, call), verb: "POST" }
];

describeDomainTable({ domainClass: OfficialDevices, name: "OfficialDevices", rows });

describe("OfficialDevices wire truths", () => {

  test("the grouped device payload round-trips as an array of arrays", async () => {

    const rig = domainRig((options) => new OfficialDevices(options));

    rig.pool.intercept({ method: "GET", path: officialPath("/devices") }).reply(200, { "code": "SUCCESS", "data": [ [ HUB, ULTRA ], [HUB] ], "msg": "success" });

    const groups = await rig.domain.fetchAll();

    // Flattening would throw away which devices share a door, which is the one thing the nesting says and nothing else in the payload does.
    assert.equal(groups.length, 2);
    assert.equal(groups[0]?.length, 2);
    assert.equal(groups[1]?.length, 1);
    assert.equal(groups[0]?.[0]?.id, "02ffee000000");
  });

  /* The three specimens, each from its own live capture and each a different hardware class: a hub with no reader at all, an Ultra with four methods, and a G2 Pro
   * with seven. One test per specimen, so a failure names which class it was.
   */
  for(const [ hardware, specimen, methods ] of [ [ "hub", HUB_SETTINGS, 0 ], [ "Ultra", ULTRA_SETTINGS, 4 ], [ "G2 Pro", G2PRO_SETTINGS, 7 ] ] as const) {

    test("the " + hardware + " reports exactly the methods its hardware class offers", async () => {

      const rig = domainRig((options) => new OfficialDevices(options));

      rig.pool.intercept({ method: "GET", path: officialPath("/devices/d-1/settings") }).reply(200, { "code": "SUCCESS", "data": specimen, "msg": "success" });

      const settings = await rig.domain.fetchSettings("d-1");

      assert.equal(Object.keys(settings.access_methods).length, methods);
    });
  }

  test("a method the hardware does not offer reads as absent, never as disabled", async () => {

    const rig = domainRig((options) => new OfficialDevices(options));

    rig.pool.intercept({ method: "GET", path: officialPath("/devices/d-1/settings") }).reply(200, { "code": "SUCCESS", "data": ULTRA_SETTINGS,
      "msg": "success" });

    const settings = await rig.domain.fetchSettings("d-1");

    /* The Ultra reports four methods and has no face reader at all. Reading the absent key as "no" would tell a consumer the device can do face unlock and has it
     * switched off, which is the misreading the all-optional type exists to prevent.
     */
    assert.equal(settings.access_methods.face, undefined);
    assert.equal(settings.access_methods.pin_code, undefined);
    assert.equal(settings.access_methods.nfc?.enabled, "yes");
  });
});

describe("OfficialDevices vocabularies", () => {

  test("the access-method value pair stays closed in both directions", () => {

    // The one response vocabulary carried closed rather than widened: both values have been observed live, and there is no third.
    // @ts-expect-error - the wire says yes and no, and the reference's own field table claiming true and false is contradicted by its own sample.
    const outside: AccessOfficialAccessMethodValue = "true";

    const literals: [ Extract<AccessOfficialAccessMethodValue, "no">, Extract<AccessOfficialAccessMethodValue, "yes"> ] = [ "no", "yes" ];

    assert.equal(outside, "true");
    assert.deepEqual(literals, [ "no", "yes" ]);
  });

  test("the face tuning vocabularies widen on the response and stay closed on the request", () => {

    const undocumentedLevel: AccessOfficialAccessMethodFace["anti_spoofing_level"] = "maximum";
    const undocumentedDistance: AccessOfficialAccessMethodFace["detect_distance"] = "adjacent";
    const literals: [ Extract<AccessOfficialAccessMethodFace["anti_spoofing_level"], "high">,
      Extract<AccessOfficialAccessMethodFace["anti_spoofing_level"], "medium">, Extract<AccessOfficialAccessMethodFace["anti_spoofing_level"], "no">,
      Extract<AccessOfficialAccessMethodFace["detect_distance"], "far">, Extract<AccessOfficialAccessMethodFace["detect_distance"], "medium">,
      Extract<AccessOfficialAccessMethodFace["detect_distance"], "near"> ] = [ "high", "medium", "no", "far", "medium", "near" ];

    // @ts-expect-error - a caller composes a settings write from the documented set.
    const outsideLevel: AccessOfficialAccessMethodFaceUpdate["anti_spoofing_level"] = "maximum";

    // @ts-expect-error - likewise for the detection distance.
    const outsideDistance: AccessOfficialAccessMethodFaceUpdate["detect_distance"] = "adjacent";

    assert.deepEqual([ undocumentedLevel, undocumentedDistance, outsideLevel, outsideDistance ], [ "maximum", "adjacent", "maximum", "adjacent" ]);
    assert.deepEqual(literals, [ "high", "medium", "no", "far", "medium", "near" ]);
  });
});

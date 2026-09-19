/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * webhooks.test.ts: Unit tests for the OfficialWebhooks domain - the endpoint table and the registration vocabulary.
 */
import type { AccessOfficialWebhookEndpoint, AccessOfficialWebhookEventName } from "./webhooks.ts";
import { PATH_ID, PATH_ID_ENCODED, describeDomainTable, officialPath } from "./domain.helpers.ts";
import { describe, test } from "node:test";
import type { DomainRow } from "./domain.helpers.ts";
import { OfficialWebhooks } from "./webhooks.ts";
import assert from "node:assert/strict";

// A registered endpoint as the controller reports it. The live probe registered a plain http:// endpoint and it delivered without complaint, despite the field
// description calling for HTTPS - so that is what the fixture carries.
const ENDPOINT: AccessOfficialWebhookEndpoint = { "endpoint": "http://192.168.1.1:8080", "events": [ "access.door.unlock", "access.doorbell.incoming" ],
  "headers": { "x-shared-secret": "hunter2" }, "id": "wh-1", "name": "Homebridge", "secret": "whsec_abc123" };

const endpointRows: readonly DomainRow<OfficialWebhooks>[] = [

  { expected: [ENDPOINT], method: "fetchAllEndpoints", path: officialPath("/webhooks/endpoints"), reply: { "code": "SUCCESS", "data": [ENDPOINT],
    "msg": "success" }, run: async (domain, call) => domain.fetchAllEndpoints(call), verb: "GET" },

  { body: "{\"endpoint\":\"http://192.168.1.1:8080\",\"events\":[\"access.door.unlock\"],\"name\":\"Homebridge\"}", expected: ENDPOINT,
    method: "createEndpoint", path: officialPath("/webhooks/endpoints"), reply: { "code": "SUCCESS", "data": ENDPOINT, "msg": "success" },
    run: async (domain, call) => domain.createEndpoint({ endpoint: "http://192.168.1.1:8080", events: ["access.door.unlock"], name: "Homebridge" }, call), verb: "POST" },

  { body: "{\"endpoint\":\"https://example.test/hook\",\"events\":[\"access.device.dps_status\"],\"name\":\"Homebridge\"}", expected: ENDPOINT,
    method: "updateEndpoint", path: officialPath("/webhooks/endpoints/" + PATH_ID_ENCODED), reply: { "code": "SUCCESS", "data": ENDPOINT, "msg": "success" },
    run: async (domain, call) => domain.updateEndpoint(PATH_ID, { endpoint: "https://example.test/hook", events: ["access.device.dps_status"],
      name: "Homebridge" }, call), verb: "PUT" },

  { method: "deleteEndpoint", path: officialPath("/webhooks/endpoints/" + PATH_ID_ENCODED), reply: { "code": "SUCCESS", "msg": "success" },
    run: async (domain, call) => domain.deleteEndpoint(PATH_ID, call), verb: "DELETE" }
];

describeDomainTable({ domainClass: OfficialWebhooks, name: "OfficialWebhooks", rows: endpointRows });

describe("OfficialWebhooks registration vocabulary", () => {

  test("the registrable event names are the delivery union's own, and nothing else", () => {

    /* Indexing the delivery union is what keeps one vocabulary across both halves of this domain: the names a caller may register for are exactly the names a
     * delivery can arrive under, so the two cannot drift apart as the union grows.
     */
    const registrable: AccessOfficialWebhookEventName = "access.door.unlock";
    const literals: [ Extract<AccessOfficialWebhookEventName, "access.device.dps_status">,
      Extract<AccessOfficialWebhookEventName, "access.doorbell.completed">,
      Extract<AccessOfficialWebhookEventName, "access.visitor.status.changed"> ] = [ "access.device.dps_status", "access.doorbell.completed",
      "access.visitor.status.changed" ];

    // @ts-expect-error - a name that is not a delivery cannot be registered for, because the union is what defines the set.
    const outside: AccessOfficialWebhookEventName = "access.door.locked";

    assert.deepEqual([ registrable, outside ], [ "access.door.unlock", "access.door.locked" ]);
    assert.deepEqual(literals, [ "access.device.dps_status", "access.doorbell.completed", "access.visitor.status.changed" ]);
  });
});

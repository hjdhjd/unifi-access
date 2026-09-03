/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * logs.test.ts: Unit tests for the official API's system-log domain. The two shapes worth pinning are the pagination the reference documents in the wrong place,
 * and the split between the query string carrying the page and the body carrying the filter.
 */
import { describe, test } from "node:test";
import { describeDomainTable, domainRig, officialPath } from "./domain.helpers.ts";
import type { AccessOfficialSystemLogFetchOptions } from "./logs.ts";
import type { DomainRow } from "./domain.helpers.ts";
import { OfficialSystemLogs } from "./logs.ts";
import assert from "node:assert/strict";

const ID = "a b/c";
const ENCODED = "a%20b%2Fc";

// Transcribed from a live controller: one unlock entry, carrying the log_key and log_category members no documented schema lists.
const HIT = { "@timestamp": "2026-08-15T12:44:28-05:00", "_id": "188841",
  "_source": { "actor": { "alternate_id": "", "alternate_name": "", "display_name": "Acme Name 1", "id": "0ace0000-0000-4000-8000-000000000000", "type": "user" },
    "authentication": { "credential_provider": "REMOTE_THROUGH_UAH", "issuer": "" },
    "event": { "display_message": "Access Granted (Remote)", "event": "", "level": 0, "log_category": "Unlocks",
      "log_key": "access.door.unlock.success.remote.user", "published": 1786815868000, "reason": "", "result": "ACCESS", "type": "access.door.unlock" },
    "target": [ { "alternate_id": "", "alternate_name": "", "display_name": "Acme Name 7", "id": "0ace0000-0000-4000-8000-000000000003", "type": "door" },
      { "alternate_id": "", "alternate_name": "", "display_name": "", "id": "0", "type": "reason_code" } ] }, "tag": "access" };

const PAGINATION = { "page_num": 1, "page_size": 10, "total": 73 };
const RESOURCE = { "created_at": 1786815868, "updated_at": 1786815869, "video_record": "activities_resource/video/a.jpg",
  "video_record_thumbnail": "activities_resource/thumbnail/a.jpg" };

const rows: readonly DomainRow<OfficialSystemLogs>[] = [

  /* The page rides the query string and the filter rides the body, which is the endpoint's own split. This is a POST-shaped read, so it opts back in to the
   * transparent retry the surface's genuinely-minting POSTs opt out of.
   */
  { body: "{\"actor_id\":\"u-1\",\"since\":1786815000,\"topic\":\"door_openings\",\"until\":1786816000}",
    expected: { data: { hits: [HIT] }, pagination: PAGINATION }, method: "fetch", path: officialPath("/system/logs") + "?page_num=1&page_size=10",
    reply: { "code": "SUCCESS", "data": { "hits": [HIT] }, "msg": "succ", "pagination": PAGINATION }, retry: true,
    run: async (domain, call) => domain.fetch({ "actor_id": "u-1", pageNum: 1, pageSize: 10, since: 1786815000, topic: "door_openings", until: 1786816000 }, call),
    verb: "POST" },

  { body: "{\"since\":1786815000,\"timezone\":\"America/New_York\",\"topic\":\"critical\",\"until\":1786816000}", expected: Buffer.from("a,b\n1,2\n"),
    method: "export", path: officialPath("/system/logs/export"), reply: Buffer.from("a,b\n1,2\n"), replyHeaders: { "content-type": "text/csv" },
    run: async (domain, call) => domain.export({ since: 1786815000, timezone: "America/New_York", topic: "critical", until: 1786816000 }, call), verb: "POST" },

  { expected: RESOURCE, method: "fetchResource", path: officialPath("/system/logs/resource/" + ENCODED), reply: { "code": "SUCCESS", "data": RESOURCE,
    "msg": "success" }, run: async (domain, call) => domain.fetchResource(ID, call), verb: "GET" },

  /* The one path parameter in the library that is deliberately not escaped: it is a wire path taken verbatim from a log record, so its slashes are structure the
   * controller expects rather than characters to encode.
   */
  { expected: Buffer.from("JPEGBYTES"), method: "fetchStaticResource", path: officialPath("/system/static/activities_resource/video/clip.jpg"),
    reply: Buffer.from("JPEGBYTES"), replyHeaders: { "content-type": "image/jpeg" },
    run: async (domain, call) => domain.fetchStaticResource("activities_resource/video/clip.jpg", call), verb: "GET" }
];

describeDomainTable({ domainClass: OfficialSystemLogs, name: "OfficialSystemLogs", rows });

describe("OfficialSystemLogs wire truths", () => {

  test("the log page reads its pagination from the top level, where its own documentation nests it inside the payload", async () => {

    const rig = domainRig((options) => new OfficialSystemLogs(options));

    rig.pool.intercept({ method: "POST", path: officialPath("/system/logs") }).reply(200, { "code": "SUCCESS", "data": { "hits": [HIT] }, "msg": "succ",
      "pagination": PAGINATION });

    const result = await rig.domain.fetch({ topic: "critical" });

    // The envelope is uniform: this endpoint paginates in exactly the place every other one does, and the documented exception is a documentation defect.
    assert.equal(result.data.hits.length, 1);
    assert.deepEqual(result.pagination, PAGINATION);
    assert.equal(result.data.hits[0]?._source.event.log_key, "access.door.unlock.success.remote.user");
  });
});

describe("OfficialSystemLogs vocabularies", () => {

  test("the topic vocabulary stays closed", () => {

    // @ts-expect-error - the six topics the query endpoint documents are what a caller may ask for.
    const outside: AccessOfficialSystemLogFetchOptions["topic"] = "all";

    assert.equal(outside, "all");
  });
});

/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * logs.test.ts: Unit tests for the official API's system-log domain. What is worth asserting here is the pagination the reference documents in the wrong place, and the
 * split between the query string carrying the page and the body carrying the filter.
 */
import { PATH_ID, PATH_ID_ENCODED, describeDomainTable, domainRig, officialPath } from "./domain.helpers.ts";
import { describe, test } from "node:test";
import type { AccessOfficialSystemLogFetchOptions } from "./logs.ts";
import type { DomainRow } from "./domain.helpers.ts";
import { OfficialSystemLogs } from "./logs.ts";
import assert from "node:assert/strict";

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

  /* The page goes in the query string and the filter goes in the body, which is the endpoint's own split. This is a POST-shaped read, so it opts back in to the
   * transparent retry the surface's genuinely-minting POSTs opt out of.
   */
  { body: "{\"actor_id\":\"u-1\",\"since\":1786815000,\"topic\":\"door_openings\",\"until\":1786816000}",
    expected: { data: { hits: [HIT] }, pagination: PAGINATION }, method: "fetch", path: officialPath("/system/logs") + "?page_num=1&page_size=10",
    reply: { "code": "SUCCESS", "data": { "hits": [HIT] }, "msg": "succ", "pagination": PAGINATION }, retry: true,
    run: async (domain, call) => domain.fetch({ "actor_id": "u-1", pageNum: 1, pageSize: 10, since: 1786815000, topic: "door_openings", until: 1786816000 }, call),
    verb: "POST" },

  /* The walk asks for its pages exactly as the page method does, the caller's own query in the body and the page in the query string, so a population the first
   * page holds whole is one request here as well.
   */
  { body: "{\"topic\":\"door_openings\"}", expected: [HIT], method: "iterate", path: officialPath("/system/logs") + "?page_num=1&page_size=10",
    reply: { "code": "SUCCESS", "data": { "hits": [HIT] }, "msg": "succ", "pagination": { "page_num": 1, "page_size": 10, "total": 1 } }, retry: true,
    run: async (domain, call) => Array.fromAsync(domain.iterate({ pageSize: 10, topic: "door_openings" }, call)), verb: "POST" },

  { body: "{\"since\":1786815000,\"timezone\":\"America/New_York\",\"topic\":\"critical\",\"until\":1786816000}", expected: Buffer.from("a,b\n1,2\n"),
    method: "export", path: officialPath("/system/logs/export"), reply: Buffer.from("a,b\n1,2\n"), replyHeaders: { "content-type": "text/csv" },
    run: async (domain, call) => domain.export({ since: 1786815000, timezone: "America/New_York", topic: "critical", until: 1786816000 }, call), verb: "POST" },

  { expected: RESOURCE, method: "fetchResource", path: officialPath("/system/logs/resource/" + PATH_ID_ENCODED), reply: { "code": "SUCCESS", "data": RESOURCE,
    "msg": "success" }, run: async (domain, call) => domain.fetchResource(PATH_ID, call), verb: "GET" },

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

  test("iterate walks the log to its end, on the caller's own options, with the hits projected out", async () => {

    const rig = domainRig((options) => new OfficialSystemLogs(options));
    const controller = new AbortController();
    const pages = [ { hit: HIT, path: officialPath("/system/logs") + "?page_num=1&page_size=1" },
      { hit: { ...HIT, "_id": "188842" }, path: officialPath("/system/logs") + "?page_num=2&page_size=1" } ];

    for(const [ index, page ] of pages.entries()) {

      rig.pool.intercept({ method: "POST", path: page.path }).reply(200, { "code": "SUCCESS", "data": { "hits": [page.hit] }, "msg": "succ",
        "pagination": { "page_num": index + 1, "page_size": 1, "total": pages.length } });
    }

    // What the walker yields is the page's hits rather than the payload holding them, so a projection that handed the walker the whole payload would answer two
    // objects carrying a hits member here instead of the two entries themselves.
    assert.deepEqual(await Array.fromAsync(rig.domain.iterate({ pageSize: 1, topic: "critical" }, { signal: controller.signal })),
      pages.map((page) => page.hit));

    // A walk that stopped after the first page leaves the second interception pending, and one that asked for a third would find nothing to answer it.
    rig.agent.assertNoPendingInterceptors();

    const requested = rig.dispatch.calls.map((call) => {

      const url = new URL(call.url);

      return url.pathname + url.search;
    });

    assert.deepEqual(requested, pages.map((page) => page.path));

    for(const call of rig.dispatch.calls) {

      // By identity rather than by shape: two unaborted signals are structurally equal, so anything short of this would pass on a signal minted along the way.
      assert.equal(call.call.signal, controller.signal, "the walk passed the caller's own signal on every page");
      assert.equal((call.opts.json as { topic?: string } | undefined)?.topic, "critical", "the walk sent the caller's own filter on every page");
    }
  });
});

describe("OfficialSystemLogs vocabularies", () => {

  test("the topic vocabulary stays closed", () => {

    // @ts-expect-error - the topics the query endpoint documents are what a caller may ask for.
    const outside: AccessOfficialSystemLogFetchOptions["topic"] = "all";

    assert.equal(outside, "all");
  });
});

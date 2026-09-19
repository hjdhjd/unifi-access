/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * pages.test.ts: Unit tests for the official API's page walker - the requests it issues, the order it yields in, and every shape that ends a walk.
 */
import { describe, test } from "node:test";
import type { AccessOfficialPageOptions } from "./endpoints.ts";
import type { AccessOfficialResult } from "./dispatch.ts";
import assert from "node:assert/strict";
import { officialPages } from "./pages.ts";

/** A record in a scripted population, carrying nothing beyond the identity a test reads it back by. */
interface Walked {

  id: string;
}

/** What a scripted fetcher hands a test: the page bags it was asked for, in order, and the fetcher itself. */
interface ScriptedFetcher {

  asked: AccessOfficialPageOptions[];
  fetchPage: (page: AccessOfficialPageOptions) => Promise<AccessOfficialResult<Walked[]>>;
}

const RECORDS: readonly Walked[] = [ { id: "r-1" }, { id: "r-2" }, { id: "r-3" }, { id: "r-4" }, { id: "r-5" }, { id: "r-6" } ];

/* One scripted page: the records it answers with, and the page report beside them. The report's echoed page number and size are the members a controller really
 * sends, and they are set to what one would send here - but the walk reads only the total, which is what the rows below establish.
 */
function scriptedPage(pageNum: number, records: readonly Walked[], total: number): AccessOfficialResult<Walked[]> {

  return { data: [...records], pagination: { "page_num": pageNum, "page_size": records.length, "total": total } };
}

/* A scripted page fetcher: it answers each request from a table indexed by the page number asked for, and records the page bag it was asked with. A test therefore
 * asserts both halves of a walk - what it asked the endpoint for, and what it did with the answers. A request past the table's end answers `beyond`, which is how a
 * test states what a controller does off the end of a population.
 */
function scriptedFetcher(pages: readonly AccessOfficialResult<Walked[]>[], beyond: AccessOfficialResult<Walked[]> = { data: [] }): ScriptedFetcher {

  const asked: AccessOfficialPageOptions[] = [];

  return {

    asked,
    fetchPage: (page: AccessOfficialPageOptions): Promise<AccessOfficialResult<Walked[]>> => {

      asked.push(page);

      return Promise.resolve(pages[(page.pageNum ?? 1) - 1] ?? beyond);
    }
  };
}

describe("officialPages", () => {

  test("walks a population that spans three pages, yielding every record in page order", async () => {

    const script = scriptedFetcher([ scriptedPage(1, RECORDS.slice(0, 2), 6), scriptedPage(2, RECORDS.slice(2, 4), 6), scriptedPage(3, RECORDS.slice(4, 6), 6) ]);
    const walked = await Array.fromAsync(officialPages(script.fetchPage));

    assert.deepEqual(walked, RECORDS);

    // The page bags carry no page size at all, which is the walker declining to invent one the caller never asked for.
    assert.deepEqual(script.asked, [ { pageNum: 1 }, { pageNum: 2 }, { pageNum: 3 } ]);
  });

  test("starts at the caller's own page, and asks for the caller's own page size on every request", async () => {

    const script = scriptedFetcher([ scriptedPage(1, RECORDS.slice(0, 1), 4), scriptedPage(2, RECORDS.slice(1, 3), 4) ]);
    const walked = await Array.fromAsync(officialPages(script.fetchPage, { pageNum: 2, pageSize: 2 }));

    assert.deepEqual(walked, RECORDS.slice(1, 3), "the walk began at the second page, so the first page's record is not among the records");
    assert.deepEqual(script.asked, [ { pageNum: 2, pageSize: 2 }, { pageNum: 3, pageSize: 2 } ]);
  });

  test("a total the first page already satisfies is one request", async () => {

    const script = scriptedFetcher([scriptedPage(1, RECORDS.slice(0, 3), 3)]);
    const walked = await Array.fromAsync(officialPages(script.fetchPage));

    assert.deepEqual(walked, RECORDS.slice(0, 3));
    assert.deepEqual(script.asked, [{ pageNum: 1 }], "a page holding the whole population is the end of the walk, not the start of a second request");
  });

  test("a response carrying no pagination yields its records and stops", async () => {

    const script = scriptedFetcher([{ data: [...RECORDS.slice(0, 2)] }]);
    const walked = await Array.fromAsync(officialPages(script.fetchPage));

    assert.deepEqual(walked, RECORDS.slice(0, 2));
    assert.deepEqual(script.asked, [{ pageNum: 1 }]);
  });

  test("an empty first page is one request and no records at all", async () => {

    const script = scriptedFetcher([scriptedPage(1, [], 0)]);
    const walked = await Array.fromAsync(officialPages(script.fetchPage));

    assert.deepEqual(walked, []);
    assert.deepEqual(script.asked, [{ pageNum: 1 }]);
  });

  test("a total the pages never reach ends on the empty page rather than walking on", async () => {

    // A population reporting five records and answering two is what a walk trusting the total alone would chase without end, so the empty page is what ends it.
    const script = scriptedFetcher([scriptedPage(1, RECORDS.slice(0, 2), 5)], { data: [], pagination: { "page_num": 2, "page_size": 0, "total": 5 } });
    const walked = await Array.fromAsync(officialPages(script.fetchPage));

    assert.deepEqual(walked, RECORDS.slice(0, 2));
    assert.deepEqual(script.asked, [ { pageNum: 1 }, { pageNum: 2 } ]);
  });

  test("a total that shrinks between pages ends the walk on the newest report rather than the first", async () => {

    // The second page reports a population of two, already met by the four records yielded, so the shrunken report is what ends the walk here.
    const script = scriptedFetcher([ scriptedPage(1, RECORDS.slice(0, 2), 5), scriptedPage(2, RECORDS.slice(2, 4), 2) ]);
    const walked = await Array.fromAsync(officialPages(script.fetchPage));

    assert.deepEqual(walked, RECORDS.slice(0, 4));
    assert.deepEqual(script.asked, [ { pageNum: 1 }, { pageNum: 2 } ], "a walk holding the first page's total would have asked for a third page");
  });
});

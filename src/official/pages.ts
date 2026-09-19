/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * pages.ts: The official API's page walker - one paginated listing drained to its end, page by page, on whatever page size the controller answers in.
 */
import type { AccessOfficialPageOptions } from "./endpoints.ts";
import type { AccessOfficialResult } from "./dispatch.ts";

/**
 * Walk a paginated official listing to its end, yielding every record on every page.
 *
 * Every paginated endpoint answers the same way - a page of records, and a report of where that page sits in the population - so one walk serves all of them, and
 * each domain's iterating method is this composed over its own page method rather than a loop written again per domain.
 *
 * The walk begins at the page the caller named, or at the first when it named none, and asks for each page on the caller's own terms with only the page number
 * moved. A caller's page size therefore reaches every request, and a caller who named none is answered in the controller's own default size rather than in a size
 * this walker invented. The page number is passed through exactly as the caller gave it, and the wire numbers pages from 1, so a caller naming page 0 or a
 * negative page asks the controller for that page.
 *
 * A walk ends on whichever of these the page it just read satisfies:
 *
 * - The response carried no pagination, so it describes no further page and there is nothing to advance to.
 * - The page came back empty, which is what a request past the end of a population answers, and what ends a walk whose reported total the pages never reach.
 * - The records yielded so far reach the reported total, which is the population read in full - and what spares a default page holding the whole population a
 *   second request for a page that does not exist.
 *
 * A walk that begins past the first page counts only the records it yields, so it ends on the empty page beyond the total rather than on the total itself, at
 * the cost of one request.
 *
 * The total is read from every page rather than remembered from the first, because a population can grow or shrink while a walk is in flight and the newest report
 * is the one that describes it. The echoed page size is read from none of them: a controller answering a request past the end reports a size it did not use, so
 * there is nothing a walk could conclude from it.
 *
 * @typeParam T - The record type the listing carries.
 *
 * @param fetchPage - The page method to walk, called once per page with the page to ask for.
 * @param opts      - The page to start at and the page size to walk in, both optional and both the caller's.
 *
 * @returns Every record the listing reports, in the order its pages carry them.
 *
 * @category Official
 */
export async function *officialPages<T>(fetchPage: (page: AccessOfficialPageOptions) => Promise<AccessOfficialResult<readonly T[]>>,
  opts: AccessOfficialPageOptions = {}): AsyncGenerator<T> {

  let pageNum = opts.pageNum ?? 1;
  let yielded = 0;

  for(;;) {

    // Sequential by intent: which page comes next is decided by the page that just arrived, so there is no set of requests here to issue together.
    // eslint-disable-next-line no-await-in-loop
    const page = await fetchPage({ ...opts, pageNum });

    yield* page.data;

    yielded += page.data.length;

    if((page.pagination === undefined) || (page.data.length === 0) || (yielded >= page.pagination.total)) {

      return;
    }

    pageNum++;
  }
}

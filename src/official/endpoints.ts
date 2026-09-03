/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * endpoints.ts: The single source of truth for the official UniFi Access API's addresses - the REST base and the notification socket.
 */
import { ACCESS_OFFICIAL_API_PATH_PREFIX, ACCESS_OFFICIAL_API_PORT } from "../settings.ts";

/**
 * The controller address the official API answers on: the bare host with the official API's dedicated port appended.
 *
 * This is the one derivation of that address in the library, and everything official flows through it - the REST base and the notification socket URL below, and
 * the address the official transport is constructed with. That last consumer is why this is exported rather than private: an origin-bound connection pool takes
 * its origin from the address it is built with, and the diagnostics channels stamp that same address, so a transport built with the bare host would pool against
 * the wrong origin and attribute its requests to an address no official request ever reached.
 *
 * @param host - The controller address (no scheme, no port).
 *
 * @returns The controller address with the official API's port.
 *
 * @category Official
 */
export function officialHost(host: string): string {

  return host + ":" + ACCESS_OFFICIAL_API_PORT.toString();
}

/* The base every REST builder composes from, private for the same reason the Access application's own base is: the address and the application path meet in
 * exactly one place, so no builder can drift onto a different one. The port is not re-spelled here either - it comes from the single derivation above.
 */
function officialApiBase(host: string): string {

  return "https://" + officialHost(host) + ACCESS_OFFICIAL_API_PATH_PREFIX;
}

/**
 * The query members an official endpoint accepts, as the caller spells them. A member's value is dropped when it is `undefined`, so a caller composes one record
 * with every parameter the endpoint documents and lets the absent ones fall away rather than assembling a different record per combination.
 *
 * An array value is the reference's repeated-key idiom: each element is appended under the same key, which is how a parameter like `expand[]` carries more than one
 * value. The bracket is part of the documented parameter name, so the caller spells it.
 *
 * @category Official
 */
export type AccessOfficialQuery = Readonly<Record<string, boolean | number | string | readonly (number | string)[] | undefined>>;

/**
 * The pagination members every paginated official endpoint accepts, in the library's own camelCase. They are renamed to the wire's own `page_num` and `page_size`
 * spelling on the way out, in one place rather than at each of the paginated call sites.
 *
 * @category Official
 */
export interface AccessOfficialPageOptions {

  pageNum?: number;
  pageSize?: number;
}

/**
 * The fully-qualified URL for a path on the official API.
 *
 * The path is the portion below the application prefix, leading slash included (for example `"/doors"`). Every official REST address is built through this one
 * join, so a caller never composes a scheme, a host, or the application prefix itself - and that includes the query string, which is why the query arrives here as
 * a record rather than pre-serialized by the caller.
 *
 * @param host  - The controller address (no scheme, no port).
 * @param path  - The endpoint path below the application prefix, with its leading slash.
 * @param query - The query members to append. A record whose every member is absent produces no query string at all, rather than a bare `?`.
 *
 * @returns The fully-qualified endpoint URL.
 *
 * @category Official
 */
export function officialEndpoint(host: string, path: string, query?: AccessOfficialQuery): string {

  const url = officialApiBase(host) + path;

  if(query === undefined) {

    return url;
  }

  const params = new URLSearchParams();

  for(const [ key, value ] of Object.entries(query)) {

    // An absent member is a parameter the caller did not supply, which is not the same as one supplied empty - so it drops before anything is serialized, and
    // before the emptiness test below decides whether there is a query string at all.
    if(value === undefined) {

      continue;
    }

    /* An array is the repeated-key idiom: one entry appended per element, all under the same key. Testing for an object rather than calling `Array.isArray` is
     * what keeps the element type: the array arm here is `readonly`, and the platform's array guard narrows a readonly array to a mutable `any[]`, which would
     * lose the element type this loop reads.
     */
    if(typeof value === "object") {

      for(const entry of value) {

        params.append(key, entry.toString());
      }

      continue;
    }

    params.append(key, value.toString());
  }

  const serialized = params.toString();

  return (serialized.length > 0) ? (url + "?" + serialized) : url;
}

/**
 * The wire-spelled pagination query for a paginated endpoint, from the caller's camelCase options.
 *
 * Paginated methods spread the result into their own query record, so the `pageNum`/`pageSize` to `page_num`/`page_size` rename is written once here instead of at
 * every paginated call site, where a single typo would silently ask for page one forever.
 *
 * @param opts - The caller's pagination options.
 *
 * @returns The query members, each absent when the caller supplied none.
 *
 * @category Official
 */
export function officialPageQuery(opts: AccessOfficialPageOptions = {}): AccessOfficialQuery {

  return { "page_num": opts.pageNum, "page_size": opts.pageSize };
}

/**
 * The official API's realtime notification socket.
 *
 * The socket upgrades on the same host and port as the REST surface, under the same application prefix, which is what lets one address derivation serve both. The
 * path is the one the controller answers on, verified against a live controller rather than taken from the reference alone.
 *
 * @param host - The controller address (no scheme, no port).
 *
 * @returns The fully-qualified `wss://` URL of the notification socket.
 *
 * @category Official
 */
export function officialNotificationUrl(host: string): string {

  return "wss://" + officialHost(host) + ACCESS_OFFICIAL_API_PATH_PREFIX + "/devices/notifications";
}

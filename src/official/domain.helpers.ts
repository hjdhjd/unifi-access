/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * domain.helpers.ts: The shared test rig for the official API's domain suites - the mocked controller each domain is driven against, the recording wrappers that
 * observe what a domain asked the layer below it for, the table runner every domain suite is written as, and a multipart reader for the upload rows.
 *
 * Every domain suite is the same test written once per domain over different rows: arrange an interception naming a verb and a path, call the method, assert what
 * came back, and establish that the call really went out. Writing that once here is what keeps a domain's own suite down to its table - the part that differs - and
 * what makes the census below possible at all.
 */
import type { AccessOfficialCallOptions, AccessOfficialRequestOptions, AccessOfficialResult, OfficialDomainOptions } from "./dispatch.ts";
import type { Interceptable, MockAgent } from "undici";
import { describe, test } from "node:test";
import { ACCESS_OFFICIAL_API_PATH_PREFIX } from "../settings.ts";
import { OfficialDispatch } from "./dispatch.ts";
import type { SendOptions } from "../transport/http.ts";
import { Transport } from "../transport/http.ts";
import assert from "node:assert/strict";
import { makeMockTransport } from "../transport/mock-controller.helpers.ts";
import { officialHost } from "./endpoints.ts";

/** The controller address every official suite is driven against. */
export const HOST = "10.0.0.1";

/** The controller's void success envelope: the body every endpoint that answers with no payload of its own comes back with. */
export const VOID_OK = { "code": "SUCCESS", "msg": "success" };

/* The specimen every path-encoding row is written against: an id carrying a space and a slash, beside its percent-encoding. Both characters have to survive the
 * trip into a path segment, so an id the controller would accept but a URL cannot spell verbatim is what establishes that the encoding happens at all.
 */
export const PATH_ID = "a b/c";
export const PATH_ID_ENCODED = "a%20b%2Fc";

/**
 * The path an interception matches: the application prefix plus the endpoint's own path, which is the portion of an official URL below the origin.
 *
 * @param path - The endpoint path below the application prefix.
 *
 * @returns The path to intercept on.
 */
export function officialPath(path: string): string {

  return ACCESS_OFFICIAL_API_PATH_PREFIX + path;
}

/** One call a domain method made against the dispatch: the arm, the URL, and the two option bags as the method passed them. */
export interface RecordedDispatchCall {

  arm: "command" | "download" | "request";
  call: AccessOfficialCallOptions;
  opts: AccessOfficialRequestOptions;
  url: string;
}

/**
 * A dispatch that records what each domain method asked of it before doing it for real.
 *
 * The recording is what lets a domain suite assert the arm a method chose and the options it passed - above all whether it hard-coded a retry override - which are
 * decisions no interception can see, because they are resolved before the request is built.
 *
 * The two bags are recorded UNMERGED and forwarded to the real dispatch as they arrived. Composing them is the dispatch's own job, done in exactly one place, and a
 * recorder that repeated that composition here would let the real one drift while these suites went on passing.
 */
export class RecordingDispatch extends OfficialDispatch {

  readonly calls: RecordedDispatchCall[] = [];

  override async request<T>(url: string, opts: AccessOfficialRequestOptions = {}, call: AccessOfficialCallOptions = {}): Promise<AccessOfficialResult<T>> {

    this.calls.push({ arm: "request", call, opts, url });

    return super.request<T>(url, opts, call);
  }

  override async command(url: string, opts: AccessOfficialRequestOptions = {}, call: AccessOfficialCallOptions = {}): Promise<void> {

    this.calls.push({ arm: "command", call, opts, url });

    return super.command(url, opts, call);
  }

  override async download(url: string, opts: AccessOfficialRequestOptions = {}, call: AccessOfficialCallOptions = {}): Promise<Buffer> {

    this.calls.push({ arm: "download", call, opts, url });

    return super.download(url, opts, call);
  }
}

/**
 * A transport that records the options each request reached it with.
 *
 * This is the other side of the recording pair: where {@link RecordingDispatch} sees what a domain asked for, this sees what the dispatch resolved that into - the
 * only place the retry default is observable, since a mocked agent replaces the dispatcher below the interceptor that would honor it.
 */
export class RecordingTransport extends Transport {

  readonly sends: SendOptions[] = [];

  override async send(url: string, opts: SendOptions = {}): Promise<Awaited<ReturnType<Transport["send"]>>> {

    this.sends.push(opts);

    return super.send(url, opts);
  }
}

/** The rig one domain row runs against. */
export interface DomainRig<T> {

  agent: MockAgent;
  dispatch: RecordingDispatch;
  domain: T;
  pool: Interceptable;
}

/**
 * Build a domain class over a mocked official controller.
 *
 * The transport is constructed with the address the endpoints module derives rather than with the bare host, which is what a composition root does and what binds
 * the connection pool to the origin every official URL resolves to - so this construction is itself the assertion that the two agree.
 *
 * @param build - Constructs the domain class under test from its options.
 *
 * @returns The domain, the recording dispatch beneath it, and the mock to arrange interceptions on.
 */
export function domainRig<T>(build: (options: OfficialDomainOptions) => T): DomainRig<T> {

  const { agent, pool, transport } = makeMockTransport({ host: officialHost(HOST) });
  const dispatch = new RecordingDispatch({ transport });

  return { agent, dispatch, domain: build({ dispatch, host: HOST }), pool };
}

/** A request as the mocked controller received it. */
export interface SeenRequest {

  body: Buffer;
  headers: Record<string, string>;
}

/**
 * Intercept one request, record it as the controller received it, and answer the reply the caller states.
 *
 * The callback reply form is what makes the request itself readable: a body the caller can state exactly goes on the interception's own matcher, but a multipart
 * body carries a boundary minted per request, so a row that asserts against one has to read the bytes and the headers back out of the callback instead. The getter
 * this hands back is what carries the narrowing...a call that never reached the interceptor fails here, naming that, rather than further down on a read of an
 * undefined body.
 *
 * @param pool      - The interceptable to install the interception on.
 * @param intercept - What the request has to match: its verb, its path, and the exact serialized body where the caller can state one.
 * @param reply     - What the controller answers with: the envelope or the raw bytes, and the headers that describe them.
 *
 * @returns A getter answering the request the interceptor received, asserting that one arrived.
 */
export function captureRequest(pool: Interceptable, intercept: { body?: string; method: string; path: string },
  reply: { data: Buffer | object | string; headers?: Record<string, string> }): () => SeenRequest {

  let seen: SeenRequest | undefined;

  pool.intercept({ ...((intercept.body !== undefined) && { body: intercept.body }), method: intercept.method, path: intercept.path }).reply((request) => {

    const body = request.body ?? "";

    /* Undici types the callback's body as the whole `BodyInit` union, and no `Buffer.from` overload accepts what is left of that union once the string arm is
     * narrowed away, so the byte arm carries one cast. It stands for every body a request in this corpus actually sends: a serialized document, or the bytes a
     * multipart upload frames.
     */
    seen = { body: (typeof body === "string") ? Buffer.from(body) : Buffer.from(body as Uint8Array), headers: (request.headers ?? {}) as Record<string, string> };

    return { data: reply.data, responseOptions: { headers: reply.headers ?? {} }, statusCode: 200 };
  });

  return (): SeenRequest => {

    assert.ok(seen, "the request reached the interceptor");

    return seen;
  };
}

/** One endpoint's row in a domain suite's table. */
export interface DomainRow<T> {

  /** The exact serialized request body to match on, for a row whose method sends one. */
  body?: string;

  /** What the method should return. Omitted for a row whose method returns nothing. */
  expected?: unknown;

  /** Asserts against the request as the controller received it, for a row whose body cannot be stated as an exact string. */
  inspect?: (request: SeenRequest) => void;

  /** The class method the row covers. The census reconciles these against the class's own prototype. */
  method: string;

  /** The path below the origin the request must reach, query string included. */
  path: string;

  /** The envelope the controller answers with, or the raw bytes for a row whose method reads a binary endpoint. */
  reply: Buffer | object | string;

  /** The headers the controller answers with. A binary row declares its own content type here, which is what sends the read down the bytes path. */
  replyHeaders?: Record<string, string>;

  /** The explicit `retry` the method must pass, or absent when it must pass none and inherit the dispatch's own default. */
  retry?: boolean;

  /** Invokes the method under test, threading the per-call options into whichever trailing position the method's own shape puts them. */
  run: (domain: T, call: AccessOfficialCallOptions) => Promise<unknown>;

  /** The verb the request must use. */
  verb: "DELETE" | "GET" | "POST" | "PUT";
}

/**
 * Register a domain suite from its endpoint table.
 *
 * Each row becomes one test that asserts the verb, the path, and where applicable the exact body, then establishes, beyond the returned value: that the interception
 * was consumed, so a method that never dispatched cannot pass by returning the right nothing; that the method passed the retry argument its row declares, so a stray
 * hard-coded override in either direction fails here; and, once across the whole table, that the rows and the class's own methods are the same set, so neither a new
 * method without a row nor a lost row survives review.
 *
 * The same table is then run a second time with a caller's abort signal in the per-call options, which is what asserts the convention every domain method shares.
 * Deriving both passes from one row list is deliberate: a second hand-written list would restate every method's minimal arguments, and the two would drift.
 *
 * @param opts             - The suite to register.
 * @param opts.domainClass - The class under test.
 * @param opts.name        - The suite's name.
 * @param opts.rows        - The endpoint table.
 */
export function describeDomainTable<T>(opts: { domainClass: new (options: OfficialDomainOptions) => T; name: string; rows: readonly DomainRow<T>[] }): void {

  describe(opts.name, () => {

    for(const row of opts.rows) {

      test(row.method + ": " + row.verb + " " + row.path, async () => {

        const rig = domainRig((options) => new opts.domainClass(options));
        const seen = captureRequest(rig.pool, { ...((row.body !== undefined) && { body: row.body }), method: row.verb, path: row.path },
          { data: row.reply, headers: row.replyHeaders });
        const result = await row.run(rig.domain, {});

        if(row.expected !== undefined) {

          assert.deepEqual(result, row.expected);
        }

        if(row.inspect !== undefined) {

          row.inspect(seen());
        }

        // A method that never dispatched leaves its interception pending, which is the only way to tell a correct void return from a method that did nothing.
        rig.agent.assertNoPendingInterceptors();

        const call = rig.dispatch.calls[0];

        assert.ok(call, "the method dispatched exactly once through the recorded arm");
        assert.equal(rig.dispatch.calls.length, 1);
        assert.equal(Object.hasOwn(call.opts, "retry") ? call.opts.retry : undefined, row.retry, "the call site's own retry argument");
      });
    }

    test("every method on the class has a covering row", () => {

      const covered = [...new Set(opts.rows.map((row) => row.method))].sort();
      const declared = Object.getOwnPropertyNames(opts.domainClass.prototype).filter((name) => name !== "constructor").sort();

      assert.deepEqual(covered, declared);
    });

    test("every method forwards its per-call options to the dispatch, and sends the same request it would without them", async () => {

      const controller = new AbortController();

      for(const row of opts.rows) {

        const rig = domainRig((options) => new opts.domainClass(options));

        /* The interception is the row's own, matched on the same verb, path, and exact body it declares. That is what makes this a parity assertion as well as a
         * forwarding one: a per-call member that had leaked into the query or the body would miss this matcher, leave the interception pending, and fail below.
         */
        rig.pool.intercept({ ...((row.body !== undefined) && { body: row.body }), method: row.verb, path: row.path }).reply(() => ({

          data: row.reply, responseOptions: { headers: row.replyHeaders ?? {} }, statusCode: 200
        }));

        // Sequential by intent: each row is asserted on its own rig, and reading a row's recording before the next one runs is what keeps a failure's message
        // pointing at the method that produced it.
        // eslint-disable-next-line no-await-in-loop
        await row.run(rig.domain, { signal: controller.signal });

        rig.agent.assertNoPendingInterceptors();

        const call = rig.dispatch.calls[0];

        assert.ok(call, row.method + " dispatched");

        // By identity rather than by shape: two unaborted signals are structurally equal, so anything short of this would pass on a signal minted along the way.
        assert.equal(call.call.signal, controller.signal, row.method + " passed the caller's own signal as its call options");
        assert.equal((call.opts.json as { signal?: unknown } | undefined)?.signal, undefined, row.method + " kept the signal out of its request body");
      }
    });
  });
}

/** One iterating method's row in a domain suite's walk table. */
export interface WalkRow<T> {

  /** The class method the row covers. */
  method: string;

  /** The paths the walk must request, in the order it must request them. */
  paths: readonly [ string, string ];

  /** The record each page answers with, paired to the path in the same position above. */
  records: readonly [ object, object ];

  /** Drains the iterating method into an array, threading the per-call options into whichever trailing position the method's own shape puts them. */
  run: (domain: T, call: AccessOfficialCallOptions) => Promise<unknown[]>;
}

/**
 * Register a domain suite's walk table: one test per iterating method, driven against a population that spans two pages.
 *
 * A page method's own row says nothing about any of this, because one request is all it makes. Each row here arranges a population of two records in pages of one,
 * so the only way the method under test can produce both is by asking for the second page - and the assertions are that both page numbers went out in order, that
 * the records came back in page order, and that the caller's own signal reached the later request as well as the first.
 *
 * @param opts             - The suite to register.
 * @param opts.domainClass - The class under test.
 * @param opts.name        - The suite's name.
 * @param opts.rows        - The walk table.
 */
export function describeWalkTable<T>(opts: { domainClass: new (options: OfficialDomainOptions) => T; name: string; rows: readonly WalkRow<T>[] }): void {

  describe(opts.name, () => {

    for(const row of opts.rows) {

      test(row.method + ": walks the listing to its end, on the caller's own options", async () => {

        const rig = domainRig((options) => new opts.domainClass(options));
        const controller = new AbortController();

        for(const [ index, path ] of row.paths.entries()) {

          rig.pool.intercept({ method: "GET", path }).reply(() => ({ data: { "code": "SUCCESS", "data": [row.records[index]], "msg": "success",
            "pagination": { "page_num": index + 1, "page_size": 1, "total": row.records.length } }, statusCode: 200 }));
        }

        assert.deepEqual(await row.run(rig.domain, { signal: controller.signal }), row.records);

        // A walk that stopped after the first page leaves the second interception pending, and one that asked for a third would find nothing to answer it.
        rig.agent.assertNoPendingInterceptors();

        const requested = rig.dispatch.calls.map((call) => {

          const url = new URL(call.url);

          return url.pathname + url.search;
        });

        assert.deepEqual(requested, row.paths);

        for(const call of rig.dispatch.calls) {

          // By identity rather than by shape: two unaborted signals are structurally equal, so anything short of this would pass on a signal minted along the way.
          assert.equal(call.call.signal, controller.signal, row.method + " passed the caller's own signal on every page");
        }
      });
    }
  });
}

/** One part read back out of an assembled multipart body. */
export interface MultipartPart {

  contentType: string;
  data: Buffer;
  field: string;
  filename: string;
}

/**
 * Read an assembled multipart body back into its parts, against the boundary the request's own content type declares.
 *
 * Reading the body through its declared boundary rather than through a boundary the test knows is what makes these assertions real: a body framed with one boundary
 * and announced with another would parse to nothing here, where a substring search for the part's bytes would still pass.
 *
 * @param body        - The request body as it went on the wire.
 * @param contentType - The request's content-type header, carrying the boundary.
 *
 * @returns The parts, in the order they were framed.
 *
 * @throws When the content type declares no boundary, or the body is not terminated by the closing delimiter.
 */
export function parseMultipart(body: Uint8Array, contentType: string): MultipartPart[] {

  const boundary = (/boundary=(.+)$/).exec(contentType)?.[1];

  assert.ok(boundary, "the content type declares a boundary");

  const buffer = Buffer.from(body);
  const delimiter = Buffer.from("--" + boundary);

  // The closing delimiter is the boundary's own two dashes plus a trailing CRLF, four bytes beyond the boundary text itself.
  assert.ok(buffer.subarray(buffer.length - (delimiter.length + 4)).equals(Buffer.from("--" + boundary + "--\r\n")), "the body ends with the closing delimiter");

  const positions: number[] = [];

  for(let at = buffer.indexOf(delimiter); at !== -1; at = buffer.indexOf(delimiter, at + delimiter.length)) {

    positions.push(at);
  }

  const parts: MultipartPart[] = [];

  // Each part lies between one delimiter and the next, less the CRLF that follows the opening delimiter and the CRLF that precedes the closing one. The final
  // position is the terminator, so it opens no part and the loop stops short of it.
  for(let index = 0; index < (positions.length - 1); index++) {

    const opens = positions[index];
    const closes = positions[index + 1];

    assert.ok((opens !== undefined) && (closes !== undefined));

    const segment = buffer.subarray(opens + delimiter.length + 2, closes - 2);
    const headerEnd = segment.indexOf("\r\n\r\n");

    assert.ok(headerEnd !== -1, "the part separates its headers from its bytes");

    const headers = segment.subarray(0, headerEnd).toString("utf8");

    parts.push({

      contentType: (/^Content-Type: (.+)$/m).exec(headers)?.[1]?.trim() ?? "",
      data: Buffer.from(segment.subarray(headerEnd + 4)),
      field: (/name="([^"]*)"/).exec(headers)?.[1] ?? "",
      filename: (/filename="([^"]*)"/).exec(headers)?.[1] ?? ""
    });
  }

  return parts;
}

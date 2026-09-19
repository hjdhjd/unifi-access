/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * domain.helpers.test.ts: Unit tests for the shared rig the official API's domain suites are written against - the path composer, the recording wrappers, the
 * rig that builds a domain over a mocked controller, and the multipart reader the upload rows assert through.
 *
 * The multipart reader's refusals are what have never been driven: every consumer hands it a body the library itself assembled, so a guard that stopped
 * guarding would pass every upload row in the tree. Each malformed case here differs from the well-formed body in exactly one respect, so its refusal is about
 * the guard it names rather than about an earlier one the body also tripped.
 *
 * describeDomainTable and describeWalkTable are deliberately not meta-tested: they register describe and test calls directly with the runner, a bad row fails
 * the containing test rather than being observable from one, and the domain suites they carry are their proof by construction.
 */
import type { AccessOfficialCallOptions, AccessOfficialRequestOptions, OfficialDomainOptions } from "./dispatch.ts";
import { HOST, RecordingDispatch, RecordingTransport, VOID_OK, domainRig, officialPath, parseMultipart } from "./domain.helpers.ts";
import { describe, test } from "node:test";
import { MockAgent } from "undici";
import { TestClock } from "homebridge-plugin-utils/testing";
import assert from "node:assert/strict";
import { makeMockTransport } from "../transport/mock-controller.helpers.ts";
import { officialHost } from "./endpoints.ts";
import { present } from "../testing.helpers.ts";

// The boundary every multipart case below is framed around, the content type that declares it, and the one part they all carry.
const BOUNDARY = "----probe";
const MULTIPART_CONTENT_TYPE = "multipart/form-data; boundary=" + BOUNDARY;
const PART_BYTES = "a,b";
const PART_HEADERS = "Content-Disposition: form-data; name=\"file\"; filename=\"a.csv\"\r\nContent-Type: text/csv";

// The official origin every request in this file resolves to, composed the way the endpoints module composes it.
const ORIGIN = "https://" + officialHost(HOST);

/* The well-formed body, and the single-respect deviations from it. Framing the body by hand rather than through the library's own serializer is what makes
 * these assertions about the reader: a body assembled by the code under observation would agree with it whatever either of them did.
 */
function multipartBody(opts: { closed?: boolean; separated?: boolean } = {}): Uint8Array {

  const closing = (opts.closed ?? true) ? ("--" + BOUNDARY + "--\r\n") : "";
  const separator = (opts.separated ?? true) ? "\r\n\r\n" : "\r\n";

  return Buffer.from("--" + BOUNDARY + "\r\n" + PART_HEADERS + separator + PART_BYTES + "\r\n" + closing);
}

describe("officialPath", () => {

  test("officialPath prefixes the official application path", () => {

    assert.equal(officialPath("/doors"), "/api/v1/developer/doors");
    assert.equal(officialPath("/users/u-1/avatar"), "/api/v1/developer/users/u-1/avatar");
  });
});

describe("the recording wrappers", () => {

  test("RecordingDispatch records the arm, the url, and both option bags unmerged", async () => {

    const mock = makeMockTransport({ host: officialHost(HOST) });
    const dispatch = new RecordingDispatch({ transport: mock.transport });
    const call: AccessOfficialCallOptions = { signal: new AbortController().signal };
    const opts: AccessOfficialRequestOptions = { retry: false };

    mock.pool.intercept({ method: "GET", path: officialPath("/read") }).reply(200, { "code": "SUCCESS", "data": { "answered": true }, "msg": "success" });
    mock.pool.intercept({ method: "GET", path: officialPath("/write") }).reply(200, VOID_OK);
    mock.pool.intercept({ method: "GET", path: officialPath("/bytes") }).reply(200, Buffer.from("bytes"), { headers: { "content-type": "text/csv" } });

    await dispatch.request(ORIGIN + officialPath("/read"), opts, call);
    await dispatch.command(ORIGIN + officialPath("/write"), opts, call);
    await dispatch.download(ORIGIN + officialPath("/bytes"), opts, call);

    assert.deepEqual(dispatch.calls.map((entry) => entry.arm), [ "request", "command", "download" ]);
    assert.deepEqual(dispatch.calls.map((entry) => entry.url), [ ORIGIN + officialPath("/read"), ORIGIN + officialPath("/write"),
      ORIGIN + officialPath("/bytes") ]);

    for(const entry of dispatch.calls) {

      // By identity rather than by shape: composing the two bags is the dispatch's own job, so a recorder that had merged them here would let the real one drift.
      assert.ok(Object.is(entry.opts, opts), entry.arm + " recorded the request bag as the object the caller passed");
      assert.ok(Object.is(entry.call, call), entry.arm + " recorded the call bag unmerged beside it");
    }

    mock.agent.assertNoPendingInterceptors();
  });

  test("RecordingTransport records the options each send received", async () => {

    const agent = new MockAgent();

    agent.disableNetConnect();

    const transport = new RecordingTransport({ clock: new TestClock(), dispatcher: agent, host: officialHost(HOST) });
    const pool = agent.get(ORIGIN);

    pool.intercept({ method: "GET", path: "/one" }).reply(200, "{}");
    pool.intercept({ body: "{}", method: "POST", path: "/two" }).reply(200, "{}");

    await transport.send(ORIGIN + "/one", { retry: false });
    await transport.send(ORIGIN + "/two", { body: "{}", method: "POST" });

    // This is the one vantage point where the retry the dispatch resolved is readable at all: a mocked interception has replaced the interceptor that honors it.
    assert.deepEqual(transport.sends, [ { retry: false }, { body: "{}", method: "POST" } ]);
    agent.assertNoPendingInterceptors();
  });
});

describe("domainRig", () => {

  test("domainRig hands the domain the recording dispatch and the fixed host", async () => {

    // A stand-in for a domain rather than a real one: what the rig hands its builder is the subject here, and a real domain would put its own endpoints between.
    class Probe {

      readonly options: OfficialDomainOptions;

      constructor(options: OfficialDomainOptions) {

        this.options = options;
      }
    }

    const rig = domainRig((options) => new Probe(options));

    assert.ok(rig.dispatch instanceof RecordingDispatch, "the rig records through its own dispatch");
    assert.ok(Object.is(rig.domain.options.dispatch, rig.dispatch), "the domain is built over the rig's own recording dispatch");
    assert.equal(rig.domain.options.host, HOST, "the domain is given the bare host, which is what its endpoint builders compose from");

    /* The transport beneath is built against the address the endpoints module derives rather than against the bare host, so a request the domain's own URL
     * builder would produce reaches the pool the rig hands back - and reaching it at all is what establishes that the two agree.
     */
    rig.pool.intercept({ method: "GET", path: officialPath("/probe") }).reply(200, { "code": "SUCCESS", "data": { "reached": true }, "msg": "success" });

    assert.deepEqual((await rig.dispatch.request(ORIGIN + officialPath("/probe"))).data, { reached: true });
    rig.agent.assertNoPendingInterceptors();
  });
});

describe("parseMultipart", () => {

  test("parseMultipart reads each part's field, filename, content type, and bytes", () => {

    const parts = parseMultipart(multipartBody(), MULTIPART_CONTENT_TYPE);
    const part = present(parts[0], "the one part");

    assert.equal(parts.length, 1);
    assert.equal(part.contentType, "text/csv");
    assert.equal(part.data.toString("utf8"), PART_BYTES);
    assert.equal(part.field, "file");
    assert.equal(part.filename, "a.csv");
  });

  test("parseMultipart refuses a content type that declares no boundary", () => {

    assert.throws(() => parseMultipart(multipartBody(), "multipart/form-data"), /the content type declares a boundary/);
  });

  test("parseMultipart refuses a body that does not end with the closing delimiter", () => {

    assert.throws(() => parseMultipart(multipartBody({ closed: false }), MULTIPART_CONTENT_TYPE), /the body ends with the closing delimiter/);
  });

  test("parseMultipart refuses a part with no separator between its headers and its bytes", () => {

    assert.throws(() => parseMultipart(multipartBody({ separated: false }), MULTIPART_CONTENT_TYPE), /the part separates its headers from its bytes/);
  });
});

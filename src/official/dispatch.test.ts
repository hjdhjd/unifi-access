/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * dispatch.test.ts: Unit tests for the official API's one request path. The dispatch is what stands between every official caller and an API that reports its
 * refusals inside a 2xx, so these tests drive each envelope shape the wire has actually produced - every payload type, the truncated message, pagination where the
 * reference says it is not - and pin that a refusal throws rather than resolving to a payload that was never sent.
 *
 * Everything runs against an undici MockAgent through the real transport, so the request travels the same path a live official call would, without a controller.
 */
import { AccessAuthorizationError, AccessNetworkError, AccessOfficialApiError, AccessProtocolError, AccessRequestError } from "../errors.ts";
import { HOST, RecordingTransport, parseMultipart } from "./domain.helpers.ts";
import { describe, test } from "node:test";
import { officialEndpoint, officialHost } from "./endpoints.ts";
import { ACCESS_OFFICIAL_API_PATH_PREFIX } from "../settings.ts";
import type { AccessKnownJsonValue } from "../types/index.ts";
import type { Interceptable } from "undici";
import { MockAgent } from "undici";
import { OfficialDispatch } from "./dispatch.ts";
import { Transport } from "../transport/http.ts";
import assert from "node:assert/strict";
import { createHttpsLoopback } from "../transport/loopback.helpers.ts";
import { fakeClock } from "../testing.helpers.ts";
import { makeMockTransport } from "../transport/mock-controller.helpers.ts";

// The path an interception matches, which is the application prefix plus the endpoint's own path - the portion of an official URL below the origin.
function officialPath(path: string): string {

  return ACCESS_OFFICIAL_API_PATH_PREFIX + path;
}

/* Build a dispatch over a mocked official controller.
 *
 * The transport is constructed with the address the endpoints module derives rather than with the bare host, which is what a composition root does and what binds
 * the connection pool to the origin every official URL resolves to. Building it with the bare host would pool against a different origin, and nothing set up here
 * would ever be reached - so this construction is itself the pin on the two agreeing.
 */
function officialRig(): { dispatch: OfficialDispatch; pool: Interceptable } {

  const { pool, transport } = makeMockTransport({ host: officialHost(HOST) });

  return { dispatch: new OfficialDispatch({ transport }), pool };
}

describe("OfficialDispatch", () => {

  describe("the success envelope", () => {

    test("unwraps an object payload", async () => {

      const { dispatch, pool } = officialRig();

      pool.intercept({ method: "GET", path: officialPath("/doors/abc/lock_rule") })
        .reply(200, { "code": "SUCCESS", "data": { "ended_time": 0, "type": "" }, "msg": "success" });

      const result = await dispatch.request<{ ended_time: number; type: string }>(officialEndpoint(HOST, "/doors/abc/lock_rule"));

      assert.deepEqual(result.data, { "ended_time": 0, "type": "" });
    });

    test("unwraps an array payload", async () => {

      const { dispatch, pool } = officialRig();

      pool.intercept({ method: "GET", path: officialPath("/doors") }).reply(200, { "code": "SUCCESS", "data": [{ "id": "abc" }], "msg": "success" });

      const result = await dispatch.request<{ id: string }[]>(officialEndpoint(HOST, "/doors"));

      assert.deepEqual(result.data, [{ id: "abc" }]);
    });

    test("unwraps a bare string payload", async () => {

      const { dispatch, pool } = officialRig();

      // Several endpoints answer with the literal string "success" as their payload where others answer with null. Both are payloads, so a dispatch that only
      // understood objects and arrays would reject half the write surface.
      pool.intercept({ method: "PUT", path: officialPath("/doors/abc/unlock") }).reply(200, { "code": "SUCCESS", "data": "success", "msg": "success" });

      const result = await dispatch.request<string>(officialEndpoint(HOST, "/doors/abc/unlock"), { method: "PUT" });

      assert.equal(result.data, "success");
    });

    test("unwraps a null payload", async () => {

      const { dispatch, pool } = officialRig();

      pool.intercept({ method: "DELETE", path: officialPath("/webhooks/endpoints/abc") }).reply(200, { "code": "SUCCESS", "data": null, "msg": "success" });

      const result = await dispatch.request<null>(officialEndpoint(HOST, "/webhooks/endpoints/abc"), { method: "DELETE" });

      assert.equal(result.data, null, "a payload of null is a payload, not an absent one");
    });

    test("accepts the truncated message several endpoints send", async () => {

      const { dispatch, pool } = officialRig();

      // A number of endpoints send "succ" rather than "success". It is the controller's own quirk rather than a corruption, so a dispatch that read the message at
      // all would have to tolerate it - and this one does not read it on success, which this pins.
      pool.intercept({ method: "GET", path: officialPath("/credentials/nfc_cards/tokens") }).reply(200, { "code": "SUCCESS", "data": [], "msg": "succ" });

      const result = await dispatch.request<unknown[]>(officialEndpoint(HOST, "/credentials/nfc_cards/tokens"));

      assert.deepEqual(result.data, []);
    });

    test("reports a success envelope that carries no payload as a protocol failure", async () => {

      const { dispatch, pool } = officialRig();

      /* The typed read's contract is a payload, so an envelope with no data member cannot satisfy it: resolving would hand the caller undefined under whatever
       * type it asked for, which is the one outcome the typed return exists to prevent. A mutation that genuinely answers with nothing rides `command`.
       */
      pool.intercept({ method: "GET", path: officialPath("/doors") }).reply(200, { "code": "SUCCESS", "msg": "success" });

      await assert.rejects(dispatch.request(officialEndpoint(HOST, "/doors")), AccessProtocolError);
    });
  });

  describe("pagination", () => {

    test("carries a list endpoint's pagination through by value", async () => {

      const { dispatch, pool } = officialRig();

      pool.intercept({ method: "GET", path: officialPath("/users") })
        .reply(200, { "code": "SUCCESS", "data": [ { "id": "a" }, { "id": "b" }, { "id": "c" } ], "msg": "success",
          "pagination": { "page_num": 1, "page_size": 3, "total": 3 } });

      const result = await dispatch.request<{ id: string }[]>(officialEndpoint(HOST, "/users"));

      assert.deepEqual(result.pagination, { "page_num": 1, "page_size": 3, "total": 3 });
    });

    test("reads the system log's pagination from the top level, where its own documentation says it is nested", async () => {

      const { dispatch, pool } = officialRig();

      /* This is the case that catches a dispatch keyed on the payload being an array. The system log answers with an object payload and its pagination beside it at
       * the top level - the same place every other paginated endpoint puts it - so one uniform envelope read serves them all, and the documented nesting is a
       * documentation defect rather than an exception to handle.
       */
      pool.intercept({ method: "POST", path: officialPath("/system/logs") })
        .reply(200, { "code": "SUCCESS", "data": { "hits": [{ "_id": "1" }] }, "msg": "succ", "pagination": { "page_num": 1, "page_size": 10, "total": 73 } });

      const result = await dispatch.request<{ hits: unknown[] }>(officialEndpoint(HOST, "/system/logs"), { method: "POST" });

      assert.deepEqual(result.data.hits.length, 1);
      assert.deepEqual(result.pagination, { "page_num": 1, "page_size": 10, "total": 73 });
    });

    test("leaves pagination structurally absent on an endpoint that reports none", async () => {

      const { dispatch, pool } = officialRig();

      pool.intercept({ method: "GET", path: officialPath("/doors") }).reply(200, { "code": "SUCCESS", "data": [], "msg": "success" });

      const result = await dispatch.request<unknown[]>(officialEndpoint(HOST, "/doors"));

      // Absent rather than present-and-undefined, so a caller can tell a paginated endpoint from an unpaginated one by what it received, and nothing here invents
      // a page count for a response that reported none.
      assert.equal(Object.hasOwn(result, "pagination"), false);
    });

    test("ignores a pagination member that does not report a page", async () => {

      const { dispatch, pool } = officialRig();

      // A partial page report describes no page a caller could act on, so it reads as unpaginated rather than as pagination with holes in it.
      pool.intercept({ method: "GET", path: officialPath("/visitors") })
        .reply(200, { "code": "SUCCESS", "data": [], "msg": "succ", "pagination": { "page_num": 1 } });

      const result = await dispatch.request<unknown[]>(officialEndpoint(HOST, "/visitors"));

      assert.equal(Object.hasOwn(result, "pagination"), false);
    });
  });

  describe("the refusal envelope", () => {

    test("throws the typed official error carrying the controller's code and message", async () => {

      const { dispatch, pool } = officialRig();

      // The status is a 2xx. Everything that says this request failed is inside the body, which is why the unwrap has to happen here rather than at the transport.
      pool.intercept({ method: "GET", path: officialPath("/doors/nope") })
        .reply(200, { "code": "CODE_RESOURCE_NOT_FOUND", "msg": "The requested resource was not found." });

      await assert.rejects(dispatch.request(officialEndpoint(HOST, "/doors/nope")), (error: unknown) => {

        assert.ok(error instanceof AccessOfficialApiError);
        assert.equal(error.code, "CODE_RESOURCE_NOT_FOUND");
        assert.equal(error.message, "The requested resource was not found.");

        return true;
      });
    });

    test("tells the two capability signals apart by their code rather than by their message", async () => {

      const { dispatch, pool } = officialRig();

      /* These two codes are what a capability layer routes on: one says the official API does not exist on this controller at all, the other says the addressed
       * device is below the endpoint's firmware floor. Both responses here carry the identical message, so a consumer that read the message could not tell them
       * apart, and only the typed code distinguishes them.
       */
      const message = "The API is currently not available.";

      pool.intercept({ method: "GET", path: officialPath("/doors") }).reply(200, { "code": "CODE_OTHERS_UID_ADOPTED_NOT_SUPPORTED", "msg": message });
      pool.intercept({ method: "GET", path: officialPath("/devices/abc/settings") }).reply(200, { "code": "CODE_DEVICE_API_NOT_SUPPORTED", "msg": message });

      const identityLocked = await dispatch.request(officialEndpoint(HOST, "/doors")).catch((error: unknown) => error);
      const belowFloor = await dispatch.request(officialEndpoint(HOST, "/devices/abc/settings")).catch((error: unknown) => error);

      assert.ok(identityLocked instanceof AccessOfficialApiError);
      assert.ok(belowFloor instanceof AccessOfficialApiError);
      assert.equal(identityLocked.message, belowFloor.message, "the messages are identical, so the code is the only thing telling these apart");
      assert.equal(identityLocked.code, "CODE_OTHERS_UID_ADOPTED_NOT_SUPPORTED");
      assert.equal(belowFloor.code, "CODE_DEVICE_API_NOT_SUPPORTED");
    });

    test("carries a code the documentation does not list, rather than rejecting it", async () => {

      const { dispatch, pool } = officialRig();

      // The documented vocabulary is what the reference publishes, not a guarantee about what the controller can send. An unfamiliar code reaches the caller typed
      // and intact rather than being flattened into a generic failure.
      pool.intercept({ method: "GET", path: officialPath("/doors") }).reply(200, { "code": "CODE_SOMETHING_UNDOCUMENTED", "msg": "Something went wrong." });

      await assert.rejects(dispatch.request(officialEndpoint(HOST, "/doors")), (error: unknown) => {

        assert.ok(error instanceof AccessOfficialApiError);
        assert.equal(error.code, "CODE_SOMETHING_UNDOCUMENTED");

        return true;
      });
    });

    test("still says something when a refusal arrives without a message", async () => {

      const { dispatch, pool } = officialRig();

      pool.intercept({ method: "GET", path: officialPath("/doors") }).reply(200, { "code": "CODE_SYSTEM_ERROR" });

      await assert.rejects(dispatch.request(officialEndpoint(HOST, "/doors")), (error: unknown) => {

        assert.ok(error instanceof AccessOfficialApiError);
        assert.equal(error.code, "CODE_SYSTEM_ERROR");
        assert.ok(error.message.length > 0, "an error with an empty message tells its reader nothing");

        return true;
      });
    });
  });

  describe("responses that are not an envelope at all", () => {

    test("throws a protocol error on a body that is not JSON", async () => {

      const { dispatch, pool } = officialRig();

      pool.intercept({ method: "GET", path: officialPath("/doors") }).reply(200, "<html>a proxy got in the way</html>",
        { headers: { "content-type": "text/html" } });

      await assert.rejects(dispatch.request(officialEndpoint(HOST, "/doors")), AccessProtocolError);
    });

    test("throws a protocol error on well-formed JSON that carries no result code", async () => {

      const { dispatch, pool } = officialRig();

      // A document that parses but is not an envelope has no code to read, so there is nothing to say whether it succeeded. Treating it as a success would publish
      // whatever it happened to contain as the endpoint's result.
      pool.intercept({ method: "GET", path: officialPath("/doors") }).reply(200, { "doors": [] });

      await assert.rejects(dispatch.request(officialEndpoint(HOST, "/doors")), AccessProtocolError);
    });
  });

  describe("the transport boundary", () => {

    test("leaves a non-2xx to the transport's own status classification rather than reclassifying it", async () => {

      /* This is the regression net for the boundary between the two error vocabularies. The official API's codes describe requests the controller understood and
       * refused; an HTTP status describes one it did not get to answer, and the library already has one place that turns a status into a typed error. A dispatch
       * that classified statuses itself would be a second such place, disagreeing with the first the day either changed.
       */
      const { dispatch, pool } = officialRig();

      pool.intercept({ method: "GET", path: officialPath("/doors") }).reply(403, { "code": "CODE_UNAUTHORIZED", "msg": "You are not allowed." });
      pool.intercept({ method: "GET", path: officialPath("/users") }).reply(500, "upstream failure");

      await assert.rejects(dispatch.request(officialEndpoint(HOST, "/doors")), AccessAuthorizationError);
      await assert.rejects(dispatch.request(officialEndpoint(HOST, "/users")), AccessRequestError);
    });

    test("threads request options through to the transport", async () => {

      const { dispatch, pool } = officialRig();

      pool.intercept({ body: "{\"actor_name\":\"the automation\"}", method: "PUT", path: officialPath("/doors/abc/unlock") })
        .reply(200, { "code": "SUCCESS", "data": "success", "msg": "success" });

      const result = await dispatch.request<string>(officialEndpoint(HOST, "/doors/abc/unlock"),
        { body: "{\"actor_name\":\"the automation\"}", method: "PUT" });

      assert.equal(result.data, "success", "the interception matches on the method and body, so reaching it at all is the pin that both were carried");
    });
  });
});

/* Build a dispatch whose transport records the options each request reached it with.
 *
 * The retry default is resolved between the domain method and the transport, so it is invisible from both ends: a domain suite sees what the method asked for, and
 * a mocked interception sees a request the interceptor has already been replaced beneath. This is the one vantage point where the resolved value is readable.
 */
function recordingRig(): { dispatch: OfficialDispatch; pool: Interceptable; transport: RecordingTransport } {

  const agent = new MockAgent();

  agent.disableNetConnect();

  const transport = new RecordingTransport({ clock: fakeClock(), dispatcher: agent, host: officialHost(HOST) });

  return { dispatch: new OfficialDispatch({ transport }), pool: agent.get("https://" + officialHost(HOST)), transport };
}

describe("OfficialDispatch: the void-mutation arm", () => {

  /* All four shapes the API's successful mutations answer with. They are one outcome - the controller accepted the request - so this arm establishes the envelope
   * reported success and never reads the member at all. The first of the four is the one that matters most: it fails loudly under the typed read.
   */
  for(const [ shape, envelope ] of [

    [ "no data member at all", { "code": "SUCCESS", "msg": "success" } ],
    [ "a null payload", { "code": "SUCCESS", "data": null, "msg": "success" } ],
    [ "an empty object payload", { "code": "SUCCESS", "data": {}, "msg": "success" } ],
    [ "the literal string success", { "code": "SUCCESS", "data": "success", "msg": "success" } ]
  ] as const) {

    test("resolves on a success envelope carrying " + shape, async () => {

      const { dispatch, pool } = officialRig();

      pool.intercept({ method: "DELETE", path: officialPath("/users/abc") }).reply(200, envelope);

      await dispatch.command(officialEndpoint(HOST, "/users/abc"), { method: "DELETE" });
    });
  }

  test("throws the typed official error on a refusal, exactly as the typed read does", async () => {

    const { dispatch, pool } = officialRig();

    pool.intercept({ method: "DELETE", path: officialPath("/users/abc") }).reply(200, { "code": "CODE_OPERATION_FORBIDDEN",
      "msg": "The requested operation is not allowed." });

    await assert.rejects(dispatch.command(officialEndpoint(HOST, "/users/abc"), { method: "DELETE" }), (error: unknown) => {

      assert.ok(error instanceof AccessOfficialApiError);
      assert.equal(error.code, "CODE_OPERATION_FORBIDDEN");

      return true;
    });
  });

  test("throws a protocol error on a document that is not an envelope", async () => {

    const { dispatch, pool } = officialRig();

    pool.intercept({ method: "DELETE", path: officialPath("/users/abc") }).reply(200, { "deleted": true });

    await assert.rejects(dispatch.command(officialEndpoint(HOST, "/users/abc"), { method: "DELETE" }), AccessProtocolError);
  });
});

describe("OfficialDispatch: the binary arm", () => {

  test("returns the bytes verbatim for a content type that is not JSON", async () => {

    const { dispatch, pool } = officialRig();

    pool.intercept({ method: "GET", path: officialPath("/credentials/qr_codes/download/v-1") }).reply(200, Buffer.from([ 137, 80, 78, 71 ]),
      { headers: { "content-type": "image/png" } });

    assert.deepEqual(await dispatch.download(officialEndpoint(HOST, "/credentials/qr_codes/download/v-1")), Buffer.from([ 137, 80, 78, 71 ]));
  });

  test("throws the typed official error when a binary endpoint answers a refusal envelope", async () => {

    const { dispatch, pool } = officialRig();

    // The API reports its refusals inside a 2xx everywhere else, and nothing suggests the binary endpoints abandon that - so a JSON answer here is read as an
    // envelope rather than handed back as a file the caller would then try to decode.
    pool.intercept({ method: "GET", path: officialPath("/credentials/qr_codes/download/v-1") }).reply(200, { "code": "CODE_RESOURCE_NOT_FOUND",
      "msg": "The requested resource was not found." }, { headers: { "content-type": "application/json" } });

    await assert.rejects(dispatch.download(officialEndpoint(HOST, "/credentials/qr_codes/download/v-1")), (error: unknown) => {

      assert.ok(error instanceof AccessOfficialApiError);
      assert.equal(error.code, "CODE_RESOURCE_NOT_FOUND");

      return true;
    });
  });

  test("throws a protocol error when a binary endpoint answers a success envelope", async () => {

    const { dispatch, pool } = officialRig();

    // A binary endpoint has no JSON success shape, so an envelope reporting success here is a response nobody can use as a file.
    pool.intercept({ method: "GET", path: officialPath("/credentials/qr_codes/download/v-1") }).reply(200, { "code": "SUCCESS", "data": "success",
      "msg": "success" }, { headers: { "content-type": "application/json" } });

    await assert.rejects(dispatch.download(officialEndpoint(HOST, "/credentials/qr_codes/download/v-1")), AccessProtocolError);
  });

  test("classifies both envelope arms when the content type arrives duplicated", async () => {

    const { dispatch, pool } = officialRig();

    /* A header the controller sent twice arrives as an array rather than a string, and the sniff reads it through the response's own header accessor for exactly
     * that reason: a read that only understands a bare string sees no content type at all here, skips the envelope branch, and hands the caller a refusal document
     * dressed as a file. Both arms are driven, because the duplicated shape is a property of the header rather than of which envelope the endpoint answered with.
     */
    pool.intercept({ method: "GET", path: officialPath("/credentials/qr_codes/download/v-1") }).reply(200, { "code": "CODE_RESOURCE_NOT_FOUND",
      "msg": "The requested resource was not found." }, { headers: { "content-type": [ "application/json", "application/json" ] } });

    await assert.rejects(dispatch.download(officialEndpoint(HOST, "/credentials/qr_codes/download/v-1")), (error: unknown) => {

      assert.ok(error instanceof AccessOfficialApiError);
      assert.equal(error.code, "CODE_RESOURCE_NOT_FOUND");

      return true;
    });

    pool.intercept({ method: "GET", path: officialPath("/credentials/qr_codes/download/v-1") }).reply(200, { "code": "SUCCESS", "data": "success",
      "msg": "success" }, { headers: { "content-type": [ "application/json", "application/json" ] } });

    await assert.rejects(dispatch.download(officialEndpoint(HOST, "/credentials/qr_codes/download/v-1")), AccessProtocolError);
  });

  test("throws a protocol error on a JSON body that parses but carries no result code", async () => {

    const { dispatch, pool } = officialRig();

    pool.intercept({ method: "GET", path: officialPath("/credentials/qr_codes/download/v-1") }).reply(200, { "error": "nope" },
      { headers: { "content-type": "application/json" } });

    await assert.rejects(dispatch.download(officialEndpoint(HOST, "/credentials/qr_codes/download/v-1")), AccessProtocolError);
  });

  test("throws a protocol error on a JSON content type whose body does not parse", async () => {

    const { dispatch, pool } = officialRig();

    /* The second of the two non-envelope paths, and the one a conflated implementation gets wrong: letting the parse failure fall through to the bytes-verbatim
     * return would hand a caller a truncated document announced as JSON, as though it were the file it asked for.
     */
    pool.intercept({ method: "GET", path: officialPath("/credentials/qr_codes/download/v-1") }).reply(200, "{\"code\": \"SUCC",
      { headers: { "content-type": "application/json" } });

    await assert.rejects(dispatch.download(officialEndpoint(HOST, "/credentials/qr_codes/download/v-1")), AccessProtocolError);
  });

  test("leaves a non-2xx to the transport's own status classification", async () => {

    const { dispatch, pool } = officialRig();

    pool.intercept({ method: "GET", path: officialPath("/credentials/qr_codes/download/v-1") }).reply(403, "denied");

    await assert.rejects(dispatch.download(officialEndpoint(HOST, "/credentials/qr_codes/download/v-1")), AccessAuthorizationError);
  });
});

describe("OfficialDispatch: outbound encoding", () => {

  test("serializes a JSON body exactly once, at this one place", async () => {

    const { dispatch, pool } = officialRig();
    const payload = { "access_policy_ids": [ "p-1", "p-2" ], "note": "a \"quoted\" value" };

    // Matching on the exact serialization is what catches a double-encode: a body serialized twice arrives as a JSON string containing JSON, which reaches the
    // controller as a document it cannot read.
    pool.intercept({ body: JSON.stringify(payload), method: "PUT", path: officialPath("/users/abc/access_policies") })
      .reply(200, { "code": "SUCCESS", "msg": "success" });

    await dispatch.command(officialEndpoint(HOST, "/users/abc/access_policies"), { json: payload, method: "PUT" });
  });

  test("serializes a bare array body without inventing a wrapper member", async () => {

    const { dispatch, pool } = officialRig();

    pool.intercept({ body: "[\"u-1\",\"u-2\"]", method: "POST", path: officialPath("/user_groups/abc/users") })
      .reply(200, { "code": "SUCCESS", "msg": "success" });

    await dispatch.command(officialEndpoint(HOST, "/user_groups/abc/users"), { json: [ "u-1", "u-2" ], method: "POST" });
  });

  for(const [ kind, data, expected ] of [

    [ "a byte array", new Uint8Array([ 78, 70, 67, 44, 97 ]), Buffer.from([ 78, 70, 67, 44, 97 ]) ],
    [ "a string", "068E2836,alias1\n", Buffer.from("068E2836,alias1\n") ]
  ] as const) {

    test("frames " + kind + " part into a multipart body its own content type describes", async () => {

      const { dispatch, pool } = officialRig();

      let seen: { body: Buffer; contentType: string } | undefined;

      pool.intercept({ method: "POST", path: officialPath("/credentials/nfc_cards/import") }).reply((request) => {

        seen = { body: Buffer.from((request.body ?? "") as string), contentType: ((request.headers ?? {}) as Record<string, string>)["content-type"] ?? "" };

        return { data: { "code": "SUCCESS", "msg": "success" }, responseOptions: { headers: {} }, statusCode: 200 };
      });

      await dispatch.command(officialEndpoint(HOST, "/credentials/nfc_cards/import"),
        { form: [{ data, field: "file", filename: "cards.csv" }], method: "POST" });

      assert.ok(seen);

      // The boundary is minted per request, so the assertions read the body back through the boundary the request itself declared - a body framed with one
      // boundary and announced with another would parse to nothing here.
      assert.match(seen.contentType, (/^multipart\/form-data; boundary=/));

      const parts = parseMultipart(seen.body, seen.contentType);

      assert.equal(parts.length, 1);
      assert.equal(parts[0]?.field, "file");
      assert.equal(parts[0]?.filename, "cards.csv");
      assert.equal(parts[0]?.contentType, "application/octet-stream");
      assert.deepEqual(parts[0]?.data, expected);
    });
  }

  test("carries every byte value through the framing unchanged", async () => {

    /* All 256 octets in one part, which is what says the serializer treats this as opaque bytes rather than as text: a value that meant something to the framing -
     * a delimiter character, a carriage return, a high byte a text encoding would rewrite - would come back altered.
     */
    const { dispatch, pool } = officialRig();
    const everyOctet = new Uint8Array(256);

    for(let value = 0; value < 256; value++) {

      everyOctet[value] = value;
    }

    let seen: { body: Buffer; contentType: string } | undefined;

    pool.intercept({ method: "POST", path: officialPath("/credentials/nfc_cards/import") }).reply((request) => {

      seen = { body: Buffer.from((request.body ?? "") as Uint8Array), contentType: ((request.headers ?? {}) as Record<string, string>)["content-type"] ?? "" };

      return { data: { "code": "SUCCESS", "msg": "success" }, responseOptions: { headers: {} }, statusCode: 200 };
    });

    await dispatch.command(officialEndpoint(HOST, "/credentials/nfc_cards/import"),
      { form: [{ data: everyOctet, field: "file", filename: "all-values.bin" }], method: "POST" });

    assert.ok(seen);

    const parts = parseMultipart(seen.body, seen.contentType);

    assert.equal(parts.length, 1);
    assert.deepEqual(parts[0]?.data, Buffer.from(everyOctet));
  });

  test("frames a zero-length part as a part that is present and empty", async () => {

    // An empty file is a real upload rather than an absent one, so it has to arrive as a part carrying no bytes rather than as no part at all.
    const { dispatch, pool } = officialRig();

    let seen: { body: Buffer; contentType: string } | undefined;

    pool.intercept({ method: "POST", path: officialPath("/users/abc/avatar") }).reply((request) => {

      seen = { body: Buffer.from((request.body ?? "") as string), contentType: ((request.headers ?? {}) as Record<string, string>)["content-type"] ?? "" };

      return { data: { "code": "SUCCESS", "msg": "success" }, responseOptions: { headers: {} }, statusCode: 200 };
    });

    await dispatch.command(officialEndpoint(HOST, "/users/abc/avatar"),
      { form: [ { data: new Uint8Array(0), field: "empty", filename: "empty.bin" }, { data: "after", field: "after", filename: "after.txt" } ], method: "POST" });

    assert.ok(seen);

    const parts = parseMultipart(seen.body, seen.contentType);

    assert.deepEqual(parts.map((part) => part.field), [ "empty", "after" ]);
    assert.equal(parts[0]?.data.length, 0);
    assert.equal(parts[1]?.data.toString("utf8"), "after", "and the empty part does not swallow the one that follows it");
  });

  test("frames a request with no parts as a body carrying only its own terminator", async () => {

    const { dispatch, pool } = officialRig();

    let seen: { body: Buffer; contentType: string } | undefined;

    pool.intercept({ method: "POST", path: officialPath("/users/abc/avatar") }).reply((request) => {

      seen = { body: Buffer.from((request.body ?? "") as string), contentType: ((request.headers ?? {}) as Record<string, string>)["content-type"] ?? "" };

      return { data: { "code": "SUCCESS", "msg": "success" }, responseOptions: { headers: {} }, statusCode: 200 };
    });

    await dispatch.command(officialEndpoint(HOST, "/users/abc/avatar"), { form: [], method: "POST" });

    assert.ok(seen);
    assert.match(seen.contentType, (/^multipart\/form-data; boundary=/));

    // Still a well-formed multipart body: it declares a boundary and closes it, and parses to no parts rather than to nothing at all.
    assert.deepEqual(parseMultipart(seen.body, seen.contentType), []);
  });

  test("escapes the characters a field name or filename could otherwise forge a part header with", async () => {

    const { dispatch, pool } = officialRig();

    let seen: { body: Buffer; contentType: string } | undefined;

    pool.intercept({ method: "POST", path: officialPath("/users/abc/avatar") }).reply((request) => {

      seen = { body: Buffer.from((request.body ?? "") as string), contentType: ((request.headers ?? {}) as Record<string, string>)["content-type"] ?? "" };

      return { data: { "code": "SUCCESS", "msg": "success" }, responseOptions: { headers: {} }, statusCode: 200 };
    });

    await dispatch.command(officialEndpoint(HOST, "/users/abc/avatar"), { form: [{ data: "x", field: "file", filename: "a\"b\r\nc.png" }], method: "POST" });

    assert.ok(seen);

    const parts = parseMultipart(seen.body, seen.contentType);

    // A raw quote would close the filename early and let the rest of the name pose as further header parameters; the carriage return and newline would end the
    // header line outright.
    assert.equal(parts[0]?.filename, "a%22b%0D%0Ac.png");
  });

  test("frames every part a request carries, in the order it was given them", async () => {

    const { dispatch, pool } = officialRig();

    let seen: { body: Buffer; contentType: string } | undefined;

    pool.intercept({ method: "POST", path: officialPath("/api_server/certificates") }).reply((request) => {

      seen = { body: Buffer.from((request.body ?? "") as string), contentType: ((request.headers ?? {}) as Record<string, string>)["content-type"] ?? "" };

      return { data: { "code": "SUCCESS", "msg": "success" }, responseOptions: { headers: {} }, statusCode: 200 };
    });

    await dispatch.command(officialEndpoint(HOST, "/api_server/certificates"), { form: [ { data: "KEY", field: "key", filename: "k.pem" },
      { data: "CERT", field: "cert", filename: "c.pem" } ], method: "POST" });

    assert.ok(seen);

    const parts = parseMultipart(seen.body, seen.contentType);

    assert.deepEqual(parts.map((part) => part.field), [ "key", "cert" ]);
    assert.deepEqual(parts.map((part) => part.data.toString("utf8")), [ "KEY", "CERT" ]);
  });

  test("declares the multipart content type in place of the transport's JSON stamp", async () => {

    const { dispatch, pool } = officialRig();

    let stamped = "";

    pool.intercept({ method: "POST", path: officialPath("/users/abc/avatar") }).reply((request) => {

      stamped = ((request.headers ?? {}) as Record<string, string>)["content-type"] ?? "";

      return { data: { "code": "SUCCESS", "msg": "success" }, responseOptions: { headers: {} }, statusCode: 200 };
    });

    await dispatch.command(officialEndpoint(HOST, "/users/abc/avatar"), { form: [{ data: "x", field: "file", filename: "a.png" }], method: "POST" });

    // The transport stamps JSON on every request that does not say otherwise. A multipart body announced as JSON would reach the controller as an unparseable
    // document, and a boundary named nowhere would be unreadable even if it did not.
    assert.doesNotMatch(stamped, (/application\/json/));
    assert.match(stamped, (/^multipart\/form-data; boundary=/));
  });

  test("rides the encoded options through to the transport untouched", async () => {

    /* The encode step owns exactly one member of the request options - the retry policy it re-derives - and every other member reaches the transport as the
     * caller wrote it. The abort signal is the member the routed door commands rest on, so it is the one pinned here.
     */
    const { dispatch, pool, transport } = recordingRig();
    const controller = new AbortController();

    pool.intercept({ method: "PUT", path: officialPath("/doors/abc/unlock") }).reply(200, { "code": "SUCCESS", "msg": "success" });

    await dispatch.command(officialEndpoint(HOST, "/doors/abc/unlock"), { json: {}, method: "PUT", retry: false, signal: controller.signal });

    assert.equal(transport.sends[0]?.signal, controller.signal, "the caller's own signal, not a copy made along the way");
  });

  for(const [ combination, opts ] of [

    [ "body and json", { body: "{}", json: {} } ],
    [ "body and form", { body: "{}", form: [{ data: "x", field: "file", filename: "a.png" }] } ],
    [ "json and form", { form: [{ data: "x", field: "file", filename: "a.png" }], json: {} } ]
  ] as const) {

    test("throws on a request supplying " + combination, async () => {

      const { dispatch } = officialRig();

      // Two channels describing one body is a caller defect rather than anything the wire did, so it raises the platform's invalid-argument class rather than the
      // protocol hierarchy, which describes what a controller sent.
      await assert.rejects(dispatch.command(officialEndpoint(HOST, "/users/abc"), { ...opts, method: "POST" }), TypeError);
    });
  }
});

describe("OfficialDispatch: the per-call options merge", () => {

  test("every arm carries the caller's own signal from the call options through to the transport", async () => {

    /* The one place the two option bags are composed, which is why every arm is asked here rather than one standing in for the others: a merge written into one
     * arm and forgotten in another would leave the arms beside it unable to cancel, with every row that read only the first arm still green.
     */
    const { dispatch, pool, transport } = recordingRig();
    const controller = new AbortController();

    pool.intercept({ method: "GET", path: officialPath("/doors") }).reply(200, { "code": "SUCCESS", "data": [], "msg": "success" });
    pool.intercept({ method: "DELETE", path: officialPath("/doors/abc") }).reply(200, { "code": "SUCCESS", "msg": "success" });
    pool.intercept({ method: "GET", path: officialPath("/system/static/a.jpg") }).reply(200, Buffer.from([ 255, 216 ]),
      { headers: { "content-type": "image/jpeg" } });

    await dispatch.request(officialEndpoint(HOST, "/doors"), {}, { signal: controller.signal });
    await dispatch.command(officialEndpoint(HOST, "/doors/abc"), { method: "DELETE" }, { signal: controller.signal });
    await dispatch.download(officialEndpoint(HOST, "/system/static/a.jpg"), {}, { signal: controller.signal });

    // By identity on each arm: two unaborted signals are structurally equal, so a comparison by shape would pass on a signal composed or copied along the way.
    assert.equal(transport.sends[0]?.signal, controller.signal, "the typed read");
    assert.equal(transport.sends[1]?.signal, controller.signal, "the void mutation");
    assert.equal(transport.sends[2]?.signal, controller.signal, "the binary read");
  });

  test("a signal in the call options wins over one in the request options", async () => {

    /* Both channels can carry a signal - the escape hatches take one in their request options, every domain method takes one in its call options - so which wins
     * is a decision rather than an accident. The call options belong to the caller of this one call, where the request options belong to whatever composed the
     * request, so the call options are the more particular statement and they win.
     */
    const { dispatch, pool, transport } = recordingRig();
    const requestController = new AbortController();
    const callController = new AbortController();

    pool.intercept({ method: "GET", path: officialPath("/doors") }).reply(200, { "code": "SUCCESS", "data": [], "msg": "success" });

    await dispatch.request(officialEndpoint(HOST, "/doors"), { signal: requestController.signal }, { signal: callController.signal });

    assert.equal(transport.sends[0]?.signal, callController.signal, "the call options' own controller reached the transport");
    assert.notEqual(transport.sends[0]?.signal, requestController.signal);
  });
});

describe("OfficialDispatch: the retry policy", () => {

  test("defaults a POST to no-retry, because every POST on this surface mints or triggers", async () => {

    const { dispatch, pool, transport } = recordingRig();

    pool.intercept({ method: "POST", path: officialPath("/credentials/pin_codes") }).reply(200, { "code": "SUCCESS", "data": "1234", "msg": "success" });

    await dispatch.request<string>(officialEndpoint(HOST, "/credentials/pin_codes"), { method: "POST" });

    assert.equal(transport.sends[0]?.retry, false);
  });

  test("leaves every other verb on the pool's own retry profile", async () => {

    const { dispatch, pool, transport } = recordingRig();

    pool.intercept({ method: "GET", path: officialPath("/doors") }).reply(200, { "code": "SUCCESS", "data": [], "msg": "success" });
    pool.intercept({ method: "PUT", path: officialPath("/doors/abc/lock_rule") }).reply(200, { "code": "SUCCESS", "msg": "success" });
    pool.intercept({ method: "DELETE", path: officialPath("/users/abc") }).reply(200, { "code": "SUCCESS", "msg": "success" });

    await dispatch.request<unknown[]>(officialEndpoint(HOST, "/doors"));
    await dispatch.command(officialEndpoint(HOST, "/doors/abc/lock_rule"), { method: "PUT" });
    await dispatch.command(officialEndpoint(HOST, "/users/abc"), { method: "DELETE" });

    // Absent rather than present-and-false: a read repeated is merely read twice, and a setting re-asserted lands on the same state, so neither has anything to
    // gain from giving up the pool's absorption of a transient blip.
    assert.deepEqual(transport.sends.map((send) => send.retry), [ undefined, undefined, undefined ]);
  });

  test("an explicit retry wins over the verb default, in both directions", async () => {

    const { dispatch, pool, transport } = recordingRig();

    pool.intercept({ method: "POST", path: officialPath("/system/logs") }).reply(200, { "code": "SUCCESS", "data": { "hits": [] }, "msg": "succ" });
    pool.intercept({ method: "PUT", path: officialPath("/doors/abc/unlock") }).reply(200, { "code": "SUCCESS", "msg": "success" });

    // The two endpoints that break the verb correlation: a POST-shaped read that is safe to repeat, and a relay actuation that is not.
    await dispatch.request<unknown>(officialEndpoint(HOST, "/system/logs"), { method: "POST", retry: true });
    await dispatch.command(officialEndpoint(HOST, "/doors/abc/unlock"), { method: "PUT", retry: false });

    assert.deepEqual(transport.sends.map((send) => send.retry), [ true, false ]);
  });
});

describe("OfficialDispatch: over a real socket", () => {

  test("puts a multipart body on the wire that a server can parse against the boundary it announced", async () => {

    await using loopback = await createHttpsLoopback(() => ({ body: "{\"code\":\"SUCCESS\",\"msg\":\"success\"}", contentType: "application/json", status: 200 }));
    await using transport = new Transport({ host: loopback.host });

    const dispatch = new OfficialDispatch({ transport });

    await dispatch.command(loopback.origin + "/upload", { form: [ { data: new Uint8Array([ 78, 70, 67 ]), field: "file", filename: "cards.csv" },
      { data: "PEM", field: "cert", filename: "c.pem" } ], method: "POST" });

    assert.equal(loopback.hits.length, 1);

    const hit = loopback.hits[0];

    assert.ok(hit);

    /* The bytes as a real server received them, parsed against the content type that really arrived. A mocked agent cannot reach this: it replaces undici's
     * dispatch wholesale, so everything below it - the socket write included - is out of its view.
     */
    const parts = parseMultipart(hit.body, hit.contentType);

    assert.deepEqual(parts.map((part) => [ part.field, part.filename, part.data.length ]), [ [ "file", "cards.csv", 3 ], [ "cert", "c.pem", 3 ] ]);
    assert.deepEqual(parts[0]?.data, Buffer.from([ 78, 70, 67 ]));
    assert.equal(parts[1]?.data.toString("utf8"), "PEM");
  });

  test("absorbs a transient status under the pool's default, and surfaces it when the caller opts out", async () => {

    await using loopback = await createHttpsLoopback((hit) => ((hit === 1) ?
      { body: "unavailable", contentType: "text/plain", status: 503 } :
      { body: "{\"code\":\"SUCCESS\",\"data\":[],\"msg\":\"success\"}", contentType: "application/json", status: 200 }));

    await using transport = new Transport({ host: loopback.host });

    const dispatch = new OfficialDispatch({ transport });

    // Under the pool's default the interceptor re-sends the request and the caller never learns the first answer existed.
    const result = await dispatch.request<unknown[]>(loopback.origin + "/doors");

    assert.deepEqual(result.data, []);
    assert.equal(loopback.hits.length, 2, "the transient status was absorbed by a second send");
  });

  test("sends exactly once when the caller opts out of retries", async () => {

    await using loopback = await createHttpsLoopback(() => ({ body: "unavailable", contentType: "text/plain", status: 503 }));
    await using transport = new Transport({ host: loopback.host });

    const dispatch = new OfficialDispatch({ transport });

    /* The other half of the pair, and the reason the option exists: a request that must not be applied twice is sent once, and the transient status reaches the
     * caller as a failure instead of being silently recovered from. No mocked interception can establish this - the mock replaces dispatch below the interceptor
     * that would do the re-sending.
     *
     * The class is the network error rather than the request error, and that is the interceptor's doing rather than this layer's: a retryable status with no
     * attempts left is reported by undici as its own exhausted-retries failure rather than as the response, which the transport has always classified as a
     * reachability fault. The same class arrives on a permanently-unavailable controller under the pool's default; opting out only changes how many sends it
     * takes to get there.
     */
    await assert.rejects(dispatch.command(loopback.origin + "/doors/abc/unlock", { method: "PUT", retry: false }), AccessNetworkError);

    assert.equal(loopback.hits.length, 1, "the one thing the opt-out buys: the door relay was fired at most once");
  });
});

describe("the passthrough JSON vocabulary", () => {

  test("admits no function value, so a loosened declaration would not compile", () => {

    // Every open passthrough member on this surface - the unlock body's extra, the door and location extras, the identity metadata - rides this one vocabulary. A
    // declaration loosened to an unknown-valued record would accept things that cannot survive serialization, and this row is what makes that a build failure.
    // @ts-expect-error - a function is not a JSON value.
    const extras: Readonly<Record<string, AccessKnownJsonValue>> = { "handler": (): void => undefined };

    assert.equal(typeof extras["handler"], "function");
  });
});

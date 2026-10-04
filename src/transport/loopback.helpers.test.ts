/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * loopback.helpers.test.ts: Unit tests for the recording https peer that the real-socket suites in this codebase dial, answering each request however the caller says.
 *
 * The peer is driven by the library's own transport rather than by a hand-rolled client, which is what makes the recorded hits the bytes a real request put on
 * a real socket. The transport is declared after the peer so that disposal releases the pool's keepalive connection before the server stops listening.
 */
import { describe, test } from "node:test";
import { Transport } from "./http.ts";
import assert from "node:assert/strict";
import { createHttpsLoopback } from "./loopback.helpers.ts";
import { url } from "./mock-controller.helpers.ts";

describe("createHttpsLoopback", () => {

  test("createHttpsLoopback answers each hit with the responder's answer for its one-based count", async () => {

    await using peer = await createHttpsLoopback((hit) => ({ body: "{\"hit\":" + hit.toString() + "}", contentType: "application/json",
      status: (hit === 1) ? 200 : 201 }));
    await using transport = new Transport({ host: peer.host });

    const first = await transport.send(url(peer.host, "/first"));
    const second = await transport.send(url(peer.host, "/second"));

    assert.equal(first.statusCode, 200);
    assert.equal(first.text(), "{\"hit\":1}");
    assert.equal(second.statusCode, 201, "the responder reads the first request as hit one, so the second is the one that varies");
    assert.equal(second.text(), "{\"hit\":2}");
  });

  test("createHttpsLoopback records each request's body and content type", async () => {

    await using peer = await createHttpsLoopback(() => ({ body: "{}", contentType: "application/json", status: 200 }));
    await using transport = new Transport({ host: peer.host });

    await transport.send(url(peer.host, "/read"));
    await transport.send(url(peer.host, "/write"), { body: "{\"asked\":true}", method: "POST" });

    assert.equal(peer.hits.length, 2);
    assert.equal(peer.hits[0]?.body.length, 0, "a bodiless read records an empty body rather than nothing at all");
    assert.equal(peer.hits[1]?.body.toString("utf8"), "{\"asked\":true}");

    // The transport stamps the JSON content type on every request it sends, a bodiless one included, so both hits record it.
    assert.deepEqual(peer.hits.map((hit) => hit.contentType), [ "application/json", "application/json" ]);
  });
});

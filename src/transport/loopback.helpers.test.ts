/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * loopback.helpers.test.ts: Unit tests for the https peers the real-socket suites in this codebase dial - the recording peer, which answers each request however the
 * caller says, and the unanswering peer, which takes each request and answers none.
 *
 * The recording peer is driven by the library's own transport rather than by a hand-rolled client, which is what makes the recorded hits the bytes a real request
 * put on a real socket. The transport is declared after the peer so that disposal releases the pool's keepalive connection before the server stops listening.
 * The unanswering peer is driven by the platform's own HTTP/2 client instead, because what a transport does when it is torn down under a request in flight is
 * the transport suite's subject, and the question here is only what the peer negotiates, records and answers.
 */
import { createHttpsLoopback, createUnansweringHttpsLoopback, pendingThroughRedialWait } from "./loopback.helpers.ts";
import { describe, test } from "node:test";
import { Transport } from "./http.ts";
import assert from "node:assert/strict";
import { connect } from "node:http2";
import { once } from "node:events";
import { url } from "./mock-controller.helpers.ts";

describe("createHttpsLoopback", () => {

  test("createHttpsLoopback answers each hit with the responder's answer for its one-based count", async () => {

    await using peer = await createHttpsLoopback((hit) => ({ body: "{\"hit\":" + hit.toString() + "}", contentType: "application/json",
      status: (hit === 1) ? 200 : 201 }));
    await using transport = new Transport({ host: peer.host, origin: peer.origin });

    const first = await transport.send(url(peer.host, "/first"));
    const second = await transport.send(url(peer.host, "/second"));

    assert.equal(first.statusCode, 200);
    assert.equal(first.text(), "{\"hit\":1}");
    assert.equal(second.statusCode, 201, "the responder reads the first request as hit one, so the second is the one that varies");
    assert.equal(second.text(), "{\"hit\":2}");
  });

  test("createHttpsLoopback records each request's body and content type", async () => {

    await using peer = await createHttpsLoopback(() => ({ body: "{}", contentType: "application/json", status: 200 }));
    await using transport = new Transport({ host: peer.host, origin: peer.origin });

    await transport.send(url(peer.host, "/read"));
    await transport.send(url(peer.host, "/write"), { body: "{\"asked\":true}", method: "POST" });

    assert.equal(peer.hits.length, 2);
    assert.equal(peer.hits[0]?.body.length, 0, "a bodiless read records an empty body rather than nothing at all");
    assert.equal(peer.hits[1]?.body.toString("utf8"), "{\"asked\":true}");

    // The transport stamps the JSON content type on every request it sends, a bodiless one included, so both hits record it.
    assert.deepEqual(peer.hits.map((hit) => hit.contentType), [ "application/json", "application/json" ]);
  });
});

describe("createUnansweringHttpsLoopback", () => {

  test("createUnansweringHttpsLoopback negotiates h2 by default, records the request, and answers none", async () => {

    await using peer = await createUnansweringHttpsLoopback();

    const session = connect("https://" + peer.host, { rejectUnauthorized: false });

    // The client session is destroyed whatever the assertions find, so a failing row leaves no session open behind it for the peer's disposal to sever.
    try {

      const stream = session.request({ ":method": "PATCH", ":path": "/x" });
      const answered = once(stream, "response");

      stream.end();

      assert.deepEqual(await peer.request(0), { method: "PATCH", path: "/x" }, "the peer records the method and the path the request carried");
      assert.equal((await peer.connection(0)).alpnProtocol, "h2", "a client that offers HTTP/2 negotiates it by default");
      assert.ok(await pendingThroughRedialWait(answered), "the peer answers nothing, so the request stays in flight");
    } finally {

      session.destroy();
    }
  });
});

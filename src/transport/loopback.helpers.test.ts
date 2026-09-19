/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * loopback.helpers.test.ts: Unit tests for the loopback plumbing every real-socket suite in this codebase stands on - the ephemeral-port listen, the stop that
 * waits for the handle, and the recording https peer that answers each request however the caller says.
 *
 * The peer is driven by the library's own transport rather than by a hand-rolled client, which is what makes the recorded hits the bytes a real request put on
 * a real socket. The transport is declared after the peer so that disposal releases the pool's keepalive connection before the server stops listening.
 *
 * The non-object-address guard in listenOnLoopback is deliberately untested: a listening TCP server always reports an address record, so driving that arm would
 * take a stubbed server whose address read lies, and the test would then establish the stub rather than the helper.
 */
import { connect, createServer } from "node:net";
import { createHttpsLoopback, listenOnLoopback, stopListening } from "./loopback.helpers.ts";
import { describe, test } from "node:test";
import { Transport } from "./http.ts";
import assert from "node:assert/strict";
import { url } from "./mock-controller.helpers.ts";

describe("the listen and stop lifecycle", () => {

  test("listenOnLoopback binds port zero and reports the assigned port", async () => {

    const server = createServer();

    try {

      const port = await listenOnLoopback(server);

      assert.ok(port > 0, "the kernel handed out a free port rather than the zero it was asked for, which is what lets these suites run in parallel");
      assert.deepEqual(server.address(), { address: "127.0.0.1", family: "IPv4", port });
    } finally {

      await stopListening(server);
    }
  });

  test("stopListening resolves once the handle is released, accepted or not", async () => {

    const idle = createServer();

    await listenOnLoopback(idle);

    assert.equal(idle.listening, true);

    await stopListening(idle);

    assert.equal(idle.listening, false, "a listener that never accepted releases its handle");

    // The second half of the title: a server's close resolves only once every connection it accepted has ended, so this one accepts and ends one first.
    const busy = createServer((accepted) => accepted.end());
    const port = await listenOnLoopback(busy);
    const client = connect({ host: "127.0.0.1", port });

    client.on("error", () => undefined);

    try {

      await new Promise<void>((resolve) => client.once("close", () => resolve()));
      await stopListening(busy);

      assert.equal(busy.listening, false, "a listener whose connection has ended releases its handle too");
    } finally {

      client.destroy();
    }
  });
});

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

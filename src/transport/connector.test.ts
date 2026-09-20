/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * connector.test.ts: Tests for the owned connector - cutting a connection attempt still in flight, releasing what is held, leaving an established connection
 * alone, and the ALPN offer a function connector has to restate for itself.
 *
 * These drive the helper directly through an undici `Agent`, because the whole subject is what undici does with a socket the helper destroyed under it: the
 * rejection a pending request gets, and whether the peer sees the connection end. A silent loopback peer is what holds a connection attempt open for as long as a
 * test needs it, and the https responder is what supplies an established one.
 */
import { Agent, errors, request } from "undici";
import { DIAL_CUT_BOUND_MS, createHttpsLoopback, createSilentLoopback, elapsedSince, listenOnLoopback, stopListening } from "./loopback.helpers.ts";
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { createLoopbackServer } from "./events-stream.helpers.ts";
import { createOwnedConnector } from "./connector.ts";
import { createServer as createTcpServer } from "node:net";
import { resolveErrnoCause } from "../errors.ts";
import { settle } from "homebridge-plugin-utils/testing";

// What the https responder answers every request with. The body is never read for its content - what these tests need from it is a request that completes, which
// is what moves a socket out of the connecting set and into the established one.
const OK_RESPONSE = { body: "{\"ok\":true}", contentType: "application/json", status: 200 };

describe("createOwnedConnector", () => {

  test("cutDials rejects a pending request with the very reason it was cut with", async () => {

    await using peer = await createSilentLoopback();

    const connector = createOwnedConnector({ allowH2: false, verifyTls: false });
    const agent = new Agent({ connect: connector.connect });
    const reason = new DOMException("the cut this test asked for", "AbortError");
    const arriving = peer.connection(0);
    const pending = request("https://" + peer.host + "/x", { dispatcher: agent });
    const connection = await arriving;
    const startedAt = process.hrtime.bigint();

    connector.cutDials(reason);

    // Identity is the whole point: undici hands the destroy's error straight back to the pending request, which is what lets the transport name the cause by
    // comparing against the reason of the signal that fired rather than by guessing from the error's shape.
    await assert.rejects(pending, (error: unknown) => error === reason);
    await connection.closed;

    assert.ok(elapsedSince(startedAt) < DIAL_CUT_BOUND_MS, "a cut connection attempt settles at once rather than running on to undici's own connect timer");

    await agent.destroy();
  });

  test("cutDials with a reason that is not an Error rejects the request with undici's own reasonless-abort class", async () => {

    await using peer = await createSilentLoopback();

    const connector = createOwnedConnector({ allowH2: false, verifyTls: false });
    const agent = new Agent({ connect: connector.connect });
    const arriving = peer.connection(0);
    const pending = request("https://" + peer.host + "/x", { dispatcher: agent });
    const connection = await arriving;

    // A socket can only be destroyed with an error, so a reason that is not one becomes the class undici itself raises for a signal aborted without a reason.
    connector.cutDials(null);

    await assert.rejects(pending, errors.RequestAbortedError);
    await connection.closed;

    await agent.destroy();
  });

  test("release cuts a connection attempt still in flight as the pool-reset interruption", async () => {

    await using peer = await createSilentLoopback();

    const connector = createOwnedConnector({ allowH2: false, verifyTls: false });
    const agent = new Agent({ connect: connector.connect });
    const arriving = peer.connection(0);
    const pending = request("https://" + peer.host + "/x", { dispatcher: agent });
    const connection = await arriving;
    const startedAt = process.hrtime.bigint();

    connector.release();

    await assert.rejects(pending, errors.ClientDestroyedError);
    await connection.closed;

    assert.ok(elapsedSince(startedAt) < DIAL_CUT_BOUND_MS, "a released connection attempt settles at once rather than running on to undici's own connect timer");

    await agent.destroy();
  });

  test("cutDials leaves an established connection alone", async () => {

    await using peer = await createHttpsLoopback(() => OK_RESPONSE);

    const connector = createOwnedConnector({ allowH2: false, verifyTls: false });
    const agent = new Agent({ connect: connector.connect });
    const first = await request(peer.origin + "/one", { dispatcher: agent });

    await first.body.text();

    // undici hands a drained socket back to its pool on a later turn of the queue, so the yield is what makes the second request able to reuse it at all - without
    // it the agent opens a second connection and the count below would say nothing about the cut.
    await settle();

    connector.cutDials(new Error("a cut that must touch nothing"));

    const second = await request(peer.origin + "/two", { dispatcher: agent });

    await second.body.text();

    assert.equal(peer.hits.length, 2, "a cut must not disturb a request on an established connection");
    assert.equal(peer.accepted, 1, "the agent reused the very socket the cut left alone");

    await agent.destroy();
  });

  test("release destroys an established connection", async () => {

    await using peer = await createHttpsLoopback(() => OK_RESPONSE);

    const connector = createOwnedConnector({ allowH2: false, verifyTls: false });
    const agent = new Agent({ connect: connector.connect });
    const arriving = peer.connection(0);
    const response = await request(peer.origin + "/one", { dispatcher: agent });

    await response.body.text();

    const connection = await arriving;

    // The keepalive socket the completed request left behind is what release has to reach. It is destroyed bare, because nothing is pending on the connector's
    // side of an established connection.
    connector.release();

    await connection.closed;

    await agent.destroy();
  });

  test("lastDialFailure describes the most recent dial and nothing older", async () => {

    /* A port that was listening and is not any more, so a dial against it is refused at once rather than left hanging. The connector's record is the only place
     * that error survives for a WebSocket caller, which is what this row is about.
     */
    const vacant = createTcpServer();
    const vacantPort = await listenOnLoopback(vacant);

    await stopListening(vacant);

    const connector = createOwnedConnector({ allowH2: false, verifyTls: false });
    const refusingAgent = new Agent({ connect: connector.connect });

    assert.equal(connector.lastDialFailure, undefined, "a connector that has dialed nothing has nothing to report");

    await assert.rejects(request("https://127.0.0.1:" + vacantPort.toString() + "/x", { dispatcher: refusingAgent }));

    const refusal = connector.lastDialFailure;

    assert.ok(refusal !== undefined, "a refused dial leaves the platform's own error behind");
    assert.equal(resolveErrnoCause(refusal)?.code, "ECONNREFUSED", "and what it left is the platform's error, errno and all");

    await refusingAgent.destroy();

    await using peer = await createHttpsLoopback(() => OK_RESPONSE);

    const succeedingAgent = new Agent({ connect: connector.connect });
    const response = await request(peer.origin + "/one", { dispatcher: succeedingAgent });

    await response.body.text();

    // The record describes the dial that just happened, so a connector whose latest dial connected reports no failure at all - which is what keeps a later
    // socket error from being read against a dial that is long over.
    assert.equal(connector.lastDialFailure, undefined, "a dial that succeeded clears what the failed one left");

    await succeedingAgent.destroy();
  });

  test("the ALPN offer follows allowH2 in both directions", async () => {

    await using server = await createLoopbackServer("neverUpgrades");

    const host = "127.0.0.1:" + server.port.toString();

    /* The peer offers `h2` ahead of `http/1.1`, so what it negotiates is a reading of the client's own offer. That offer comes from the connector rather than from
     * the dispatcher, which is the whole reason a function connector has to restate `allowH2` for itself: a connector that stayed silent would take the builder's
     * own default and quietly widen the offer past what its dispatcher asked for.
     */
    const offered = createOwnedConnector({ allowH2: true, verifyTls: false });
    const offeringAgent = new Agent({ allowH2: true, connect: offered.connect });
    const arrivingOffered = server.connection(0);
    const pendingOffered = request("https://" + host + "/x", { dispatcher: offeringAgent });

    // The peer answers nothing, so the request is ended by the agent's teardown below. Its rejection is claimed here, before the teardown that causes it, because
    // a rejection nobody is waiting on yet is one the runner reports as unhandled.
    const endedOffered = assert.rejects(pendingOffered);

    assert.equal((await arrivingOffered).alpnProtocol, "h2", "a connector that allows HTTP/2 offers it");

    await offeringAgent.destroy();
    await endedOffered;

    const withheld = createOwnedConnector({ allowH2: false, verifyTls: false });
    const withholdingAgent = new Agent({ allowH2: false, connect: withheld.connect });
    const arrivingWithheld = server.connection(1);
    const pendingWithheld = request("https://" + host + "/x", { dispatcher: withholdingAgent });
    const endedWithheld = assert.rejects(pendingWithheld);

    assert.equal((await arrivingWithheld).alpnProtocol, "http/1.1", "a connector that withholds HTTP/2 negotiates HTTP/1.1");

    await withholdingAgent.destroy();
    await endedWithheld;
  });
});

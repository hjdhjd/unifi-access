/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * connector-parity.test.ts: Differential tests holding this library's owned connector to homebridge-plugin-utils' createOwnedConnector. The library takes no runtime
 * dependency on homebridge-plugin-utils, so the connector is implemented in both places; this suite runs each scenario against both and asserts the same outcome, so
 * a change to either connector's behavior reddens it here.
 *
 * Every assertion reads an error's name and code and never its class, because homebridge-plugin-utils' connector raises the classes of its own undici copy, which an
 * `instanceof` against this library's copy is not guaranteed to recognize. Each scenario drives a real socket against this library's loopback peers through an undici
 * `Agent`, because what a connector is for - a dial still in its handshake, a keepalive connection, a certificate nothing trusts, a connection the peer resets or
 * corrupts once it is up - is reachable no other way.
 */
import { Agent, request } from "undici";
import { CLOSING_RESPONSE, CORRUPT_TLS_RECORD, DIAL_SETTLE_BOUND_MS, KEEP_ALIVE_RESPONSE, createHttpsLoopback, createScriptedLoopback, createSilentLoopback,
  createTlsProxyLoopback, elapsedSince } from "./loopback.helpers.ts";
import { describe, test } from "node:test";
import { expectAt, freePort, present, settle, waitUntil } from "homebridge-plugin-utils/testing";
import type { OwnedConnector } from "./connector.ts";
import type { Socket } from "node:net";
import assert from "node:assert/strict";
import type { buildConnector } from "undici";
import { classifyTransportError } from "./failure.ts";
import { createLoopbackServer } from "./events-stream.helpers.ts";
import { createOwnedConnector } from "./connector.ts";
import { createOwnedConnector as createPluginUtilsConnector } from "homebridge-plugin-utils";

// What the https responder answers every request with. A request that completes is what moves a socket out of the dialing set and into the established one.
const OK_RESPONSE = { body: "{\"ok\":true}", contentType: "application/json", status: 200 };

// What both connectors share, and the whole of what these scenarios drive: the connector to hand an agent, the record of the first error an established connection
// raised, the record of the latest dial, and the release.
type SharedConnector = Pick<OwnedConnector, "connect" | "lastConnectionFailure" | "lastDialFailure" | "release">;

// One connector under test: its name in the suite, and how it is built from the options every scenario states, spelled in that connector's own vocabulary.
interface ConnectorCase {

  build: (options: { allowH2: boolean; verifyTls: boolean }) => SharedConnector;
  name: string;
}

const CONNECTORS: ConnectorCase[] = [

  { build: ({ allowH2, verifyTls }) => createOwnedConnector({ allowH2, verifyTls }), name: "the library's own connector" },

  // homebridge-plugin-utils names the verification flag for the transport option it sets. It is always passed explicitly here, because omitting it leaves the
  // answer to the platform's environment rather than to the scenario.
  { build: ({ allowH2, verifyTls }) => createPluginUtilsConnector({ allowH2, rejectUnauthorized: verifyTls }), name: "homebridge-plugin-utils' connector" }
];

// The code an error carries, read without trusting its class, so a failure raised from either undici copy reads the same way.
function codeOf(error: unknown): unknown {

  return ((typeof error === "object") && (error !== null) && ("code" in error)) ? error.code : undefined;
}

/* A connector that dials through `connector` and keeps each socket a successful dial vends, so a row can read the established socket's own state. It wraps the
 * callback rather than the connector, so the connector's own listeners are on the socket before the row's copy of it is kept.
 */
function keepingVended(connector: SharedConnector, vended: Socket[]): buildConnector.connector {

  return (options, callback): void => connector.connect(options, (...args) => {

    const [ error, socket ] = args;

    if(error === null) {

      vended.push(socket);
    }

    callback(...args);
  });
}

// Issue one request and drain its body, so the connection returns to the pool rather than staying checked out, and answer the status the peer gave.
async function fetchStatus(agent: Agent, origin: string): Promise<number> {

  const response = await request(origin + "/", { dispatcher: agent });

  await response.body.text();

  return response.statusCode;
}

describe("createOwnedConnector parity with homebridge-plugin-utils", () => {

  for(const { build, name } of CONNECTORS) {

    describe(name, () => {

      test("release cuts a dial still in flight as the pool-reset interruption", async () => {

        await using peer = await createSilentLoopback();

        const connector = build({ allowH2: false, verifyTls: false });
        const agent = new Agent({ connect: connector.connect });
        const arriving = peer.connection(0);
        const pending = request("https://" + peer.host + "/x", { dispatcher: agent });
        const connection = await arriving;
        const startedAt = process.hrtime.bigint();

        connector.release();

        await assert.rejects(pending, { code: "UND_ERR_DESTROYED", name: "ClientDestroyedError" });
        await connection.closed;

        assert.ok(elapsedSince(startedAt) < DIAL_SETTLE_BOUND_MS, "a released dial settles at once rather than running on to undici's own connect timer");

        await agent.destroy();
      });

      test("release destroys an established connection", async () => {

        await using peer = await createHttpsLoopback(() => OK_RESPONSE);

        const connector = build({ allowH2: false, verifyTls: false });
        const agent = new Agent({ connect: connector.connect });
        const arriving = peer.connection(0);
        const response = await request(peer.origin + "/one", { dispatcher: agent });

        await response.body.text();

        const connection = await arriving;

        // The keepalive socket the completed request left behind is what the release has to reach, and the peer seeing its end close is the proof it did.
        connector.release();

        await connection.closed;

        await agent.destroy();
      });

      test("lastDialFailure describes the most recent dial and nothing older", async () => {

        const connector = build({ allowH2: false, verifyTls: false });
        const refusingAgent = new Agent({ connect: connector.connect });

        // Read into a binding of its own, so the assertion narrows that binding rather than the getter every later read of the record goes through.
        const beforeAnyDial = connector.lastDialFailure;

        assert.equal(beforeAnyDial, undefined, "a connector that has dialed nothing has nothing to report");

        // The request rejects with the dial's own platform error, a plain `Error` and the very object the connector records, so the record read below is the assertion
        // and the rejection is only awaited.
        await assert.rejects(request("https://127.0.0.1:" + (await freePort()).toString() + "/x", { dispatcher: refusingAgent }));

        const refusal = present(connector.lastDialFailure, "the refused dial's own error");

        assert.equal(refusal.name, "Error", "the record is the platform's own error");
        assert.equal(codeOf(refusal), "ECONNREFUSED", "and it carries the platform's errno");

        await refusingAgent.destroy();

        await using peer = await createHttpsLoopback(() => OK_RESPONSE);

        const succeedingAgent = new Agent({ connect: connector.connect });
        const response = await request(peer.origin + "/one", { dispatcher: succeedingAgent });

        await response.body.text();

        assert.equal(connector.lastDialFailure, undefined, "a dial that succeeded clears what the failed one left");

        connector.release();

        await succeedingAgent.destroy();
      });

      test("the ALPN offer follows allowH2 in both directions", async () => {

        await using server = await createLoopbackServer("neverUpgrades");

        const target = "https://127.0.0.1:" + server.port.toString() + "/x";

        // The peer offers `h2` ahead of `http/1.1`, so what it negotiates is a reading of the connector's own offer. Each request is ended by its agent's teardown,
        // and its rejection is claimed before that teardown, because a rejection nobody is waiting on yet is one the runner reports as unhandled.
        const offered = build({ allowH2: true, verifyTls: false });
        const offeringAgent = new Agent({ allowH2: true, connect: offered.connect });
        const arrivingOffered = server.connection(0);
        const endedOffered = assert.rejects(request(target, { dispatcher: offeringAgent }));

        assert.equal((await arrivingOffered).alpnProtocol, "h2", "a connector that allows HTTP/2 offers it");

        await offeringAgent.destroy();
        await endedOffered;

        const withheld = build({ allowH2: false, verifyTls: false });
        const withholdingAgent = new Agent({ allowH2: false, connect: withheld.connect });
        const arrivingWithheld = server.connection(1);
        const endedWithheld = assert.rejects(request(target, { dispatcher: withholdingAgent }));

        assert.equal((await arrivingWithheld).alpnProtocol, "http/1.1", "a connector that withholds HTTP/2 negotiates HTTP/1.1");

        await withholdingAgent.destroy();
        await endedWithheld;
      });

      test("a certificate refusal from a self-signed peer leaves a dial failure the local classifier reads as certificate", async () => {

        await using peer = await createHttpsLoopback(() => OK_RESPONSE);

        const connector = build({ allowH2: false, verifyTls: true });
        const agent = new Agent({ connect: connector.connect });

        // The request rejects with the dial's own platform error, a plain `Error` and the very object the connector records, so the record read below is the assertion
        // and the rejection is only awaited.
        await assert.rejects(request(peer.origin + "/one", { dispatcher: agent }));

        const failure = present(connector.lastDialFailure, "the refused peer's own verdict");
        const reading = classifyTransportError(failure);

        assert.equal(codeOf(failure), "DEPTH_ZERO_SELF_SIGNED_CERT", "the dial carries the platform's own certificate verdict");
        assert.deepEqual({ code: reading.code, kind: reading.kind }, { code: "DEPTH_ZERO_SELF_SIGNED_CERT", kind: "certificate" },
          "the verdict reads as a certificate failure, which is what both transports report through AccessCertificateError");

        connector.release();

        await agent.destroy();
      });

      test("a peer's reset of a request in flight on a keep-alive connection is recorded with ECONNRESET, the very error the request rejects with", async (t) => {

        const peer = await createScriptedLoopback((socket) => socket.resetAndDestroy());
        const connector = build({ allowH2: false, verifyTls: false });
        const agent = new Agent({ connect: connector.connect });

        t.after(async (): Promise<void> => {

          connector.release();

          await agent.destroy();
          await peer[Symbol.asyncDispose]();
        });

        await assert.rejects(fetchStatus(agent, "http://" + peer.host), (error: unknown) => {

          // The transport rejects a request in flight with the error its socket raised, so the record is readable here and is that same object.
          assert.equal(codeOf(connector.lastConnectionFailure), "ECONNRESET", "the reset is recorded with the errno the platform raised");
          assert.equal(error, connector.lastConnectionFailure, "the record holds the very error the socket raised, its errno and cause chain intact");

          return true;
        });
      });

      test("a bare FIN the peer sends on an idle keep-alive connection records nothing", async (t) => {

        const peer = await createScriptedLoopback((socket) => socket.write(KEEP_ALIVE_RESPONSE));
        const connector = build({ allowH2: false, verifyTls: false });
        const agent = new Agent({ connect: connector.connect });

        t.after(async (): Promise<void> => {

          connector.release();

          await agent.destroy();
          await peer[Symbol.asyncDispose]();
        });

        assert.equal(await fetchStatus(agent, "http://" + peer.host), 200);

        peer.end();

        // The client closes its side once the transport has destroyed the socket over the FIN, so the peer seeing its connection close marks the record as final.
        await (await peer.connection(0)).closed;

        assert.equal(connector.lastConnectionFailure, undefined, "the transport destroys the socket with an error of its own over a bare FIN, which is no record");
      });

      test("a response that asks for Connection: close records nothing", async (t) => {

        const peer = await createScriptedLoopback((socket) => socket.write(CLOSING_RESPONSE));
        const connector = build({ allowH2: false, verifyTls: false });
        const agent = new Agent({ connect: connector.connect });

        t.after(async (): Promise<void> => {

          connector.release();

          await agent.destroy();
          await peer[Symbol.asyncDispose]();
        });

        assert.equal(await fetchStatus(agent, "http://" + peer.host), 200);

        // The transport closes the connection the response asked it to close, so the peer seeing its connection close marks the record as final.
        await (await peer.connection(0)).closed;

        assert.equal(connector.lastConnectionFailure, undefined, "the transport destroys the socket with an error of its own over a clean close, which is no record");
      });

      test("release records nothing", async (t) => {

        const peer = await createHttpsLoopback(() => OK_RESPONSE);
        const connector = build({ allowH2: false, verifyTls: false });
        const agent = new Agent({ connect: connector.connect });

        t.after(async (): Promise<void> => {

          await agent.destroy();
          await peer[Symbol.asyncDispose]();
        });

        assert.equal(await fetchStatus(agent, peer.origin), 200);

        connector.release();

        await (await peer.connection(0)).closed;

        assert.equal(connector.lastConnectionFailure, undefined, "a release destroys its sockets bare, which raises no error to record");
      });

      test("a TLS error after the handshake is recorded while the socket stays open", async (t) => {

        const peer = await createTlsProxyLoopback();
        const connector = build({ allowH2: false, verifyTls: false });
        const vended: Socket[] = [];
        const agent = new Agent({ connect: keepingVended(connector, vended) });

        t.after(async (): Promise<void> => {

          connector.release();

          await agent.destroy();
          await peer[Symbol.asyncDispose]();
        });

        assert.equal(await fetchStatus(agent, peer.origin), 200);

        peer.write(CORRUPT_TLS_RECORD);

        await waitUntil(() => connector.lastConnectionFailure !== undefined, { description: "the client's TLS layer to raise its error over the corrupt record" });

        assert.match(String(codeOf(connector.lastConnectionFailure)), /^ERR_SSL_/u, "the record is the TLS layer's own error");

        // Nothing destroys an idle socket over a TLS error, so no close follows it, and a record read at the socket's close would hold nothing.
        await settle(5);

        assert.equal(expectAt(vended, 0, "the socket the dial vended").destroyed, false, "the socket stays open after the TLS error it raised");
      });

      test("a later error the socket raises does not replace the first", async (t) => {

        const peer = await createTlsProxyLoopback();
        const connector = build({ allowH2: false, verifyTls: false });
        const raised: unknown[] = [];
        const vended: Socket[] = [];
        const agent = new Agent({ connect: keepingVended(connector, vended) });

        t.after(async (): Promise<void> => {

          connector.release();

          await agent.destroy();
          await peer[Symbol.asyncDispose]();
        });

        assert.equal(await fetchStatus(agent, peer.origin), 200);

        expectAt(vended, 0, "the socket the dial vended").on("error", (error: unknown) => raised.push(error));
        peer.write(CORRUPT_TLS_RECORD);

        await waitUntil(() => connector.lastConnectionFailure !== undefined, { description: "the client's TLS layer to raise its error over the corrupt record" });

        const first = connector.lastConnectionFailure;

        peer.reset();

        await waitUntil(() => raised.some((error) => codeOf(error) === "ECONNRESET"), { description: "the socket to raise the reset that followed" });

        assert.equal(connector.lastConnectionFailure, first, "the first error the socket raised stands, the reset after it being its consequence");
      });

      test("a successful connect clears what an earlier connection recorded", async (t) => {

        const peer = await createScriptedLoopback((socket) => socket.write(KEEP_ALIVE_RESPONSE));
        const connector = build({ allowH2: false, verifyTls: false });
        const agent = new Agent({ connect: connector.connect });

        t.after(async (): Promise<void> => {

          connector.release();

          await agent.destroy();
          await peer[Symbol.asyncDispose]();
        });

        assert.equal(await fetchStatus(agent, "http://" + peer.host), 200);

        peer.reset();

        await waitUntil(() => connector.lastConnectionFailure !== undefined, { description: "the reset of the idle connection to be recorded" });

        assert.equal(codeOf(connector.lastConnectionFailure), "ECONNRESET", "the idle connection's reset is recorded first");

        // The reset connection is gone, so the next request dials again, and that dial's success clears what the reset left.
        assert.equal(await fetchStatus(agent, "http://" + peer.host), 200);
        assert.equal(connector.lastConnectionFailure, undefined, "a successful connect clears the record an earlier connection left");
      });
    });
  }
});

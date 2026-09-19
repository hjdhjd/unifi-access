/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * events-stream.helpers.test.ts: Unit tests for the two peers the notification-stream suite drives EventStream against - the in-memory fake socket's listener
 * registry and dispatch ordering, and the loopback TLS peer's handshake, each of its behaviors, and the frame walk that decides when a client has asked to
 * close.
 *
 * The consumers of both peers only ever feed them well-formed input, so the arms that matter most here have never been driven: a once entry that re-enters
 * dispatch, a sibling detached mid-dispatch, and the extended-length branches of the frame walk. The walk's branches are established positively, by a peer that
 * replies, with decoys planted where a misreading walk would land - a reply that arrives cannot be explained by a parser that read the length another way.
 *
 * The socket tests are pure. The peer tests speak real TLS on a loopback port, and every reply from the peer is awaited on the socket's own data event rather
 * than on a turn budget, because the answer is real I/O and no count of macrotask turns bounds it. Every server and client socket is released through
 * `await using` or a `finally`, so a failed assertion cannot leave a handle holding the event loop.
 */
import { FakeWebSocket, createLoopbackServer } from "./events-stream.helpers.ts";
import { describe, test } from "node:test";
import type { TLSSocket } from "node:tls";
import assert from "node:assert/strict";
import { connect } from "node:tls";
import { settle } from "homebridge-plugin-utils/testing";

// The blank line that ends an HTTP header block, and the handshake key the client offers: any sixteen base64-encoded bytes satisfies RFC 6455.
const HEADER_TERMINATOR = "\r\n\r\n";
const WEBSOCKET_KEY = "AAAAAAAAAAAAAAAAAAAAAA==";

const UPGRADE_REQUEST = "GET /notifications HTTP/1.1\r\nHost: 127.0.0.1\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: " + WEBSOCKET_KEY +
  "\r\nSec-WebSocket-Version: 13" + HEADER_TERMINATOR;

/* The decoys the extended-length tests plant. Each is a text-frame header announcing a payload far larger than the wire behind it, so a walk that reads one
 * as a frame header finds that frame incomplete and stops. The two-byte form announces 65535 through the two-byte extension; the eight-byte form announces
 * 2 ** 40 through the eight-byte one, spelled here as the big-endian bytes that go on the wire.
 */
const TWO_BYTE_DECOY = [ 0x81, 0x7E, 0xFF, 0xFF ];
const EIGHT_BYTE_DECOY = [ 0x81, 0xFF, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00 ];

/** A byte sequence planted at an offset within a frame's payload, which is how a test puts readable bytes where the peer is meant to step over them. */
interface FramePlant {

  readonly at: number;
  readonly bytes: readonly number[];
}

/* Everything the peer has sent on one connection, and a promise for the moment it has sent enough. One accumulator serves the whole connection rather than a
 * listener per read: bytes the kernel coalesces with an earlier read are then never dropped in the gap between two listeners.
 */
interface PeerReader {

  readonly discard: () => void;
  readonly seen: () => Buffer;
  readonly until: (holds: (seen: Buffer) => boolean) => Promise<Buffer>;
}

/** One raw client connection to the loopback peer, with its reader. Disposing it severs the client's end. */
interface ClientConnection extends AsyncDisposable {

  readonly reader: PeerReader;
  readonly socket: TLSSocket;
}

function readPeer(socket: TLSSocket): PeerReader {

  let buffered = Buffer.alloc(0);
  let pending: { holds: (seen: Buffer) => boolean; resolve: (seen: Buffer) => void } | null = null;

  socket.on("data", (chunk: Buffer) => {

    buffered = Buffer.concat([ buffered, chunk ]);

    if(pending?.holds(buffered) === true) {

      const waiting = pending;

      pending = null;
      waiting.resolve(buffered);
    }
  });

  return {

    discard: (): void => {

      buffered = Buffer.alloc(0);
    },
    seen: (): Buffer => buffered,
    until: (holds: (seen: Buffer) => boolean): Promise<Buffer> => {

      if(holds(buffered)) {

        return Promise.resolve(buffered);
      }

      const { promise, resolve } = Promise.withResolvers<Buffer>();

      pending = { holds, resolve };

      return promise;
    }
  };
}

// Dial the loopback peer over TLS, offering http/1.1 alone as a WebSocket upgrade requires. The caller severs its own end, so the reset that raises on the socket
// is arranged rather than a fault.
function dial(port: number): TLSSocket {

  const socket = connect({ ALPNProtocols: ["http/1.1"], host: "127.0.0.1", port, rejectUnauthorized: false });

  socket.on("error", () => undefined);

  return socket;
}

/* Dial the peer and complete the WebSocket upgrade by hand, answering with the connected socket and a reader over everything that arrives after the handshake.
 * The handshake bytes are dropped once read, which is safe because the peer writes again only in answer to what this client writes next.
 */
async function connectUpgraded(port: number): Promise<ClientConnection> {

  const socket = dial(port);

  await new Promise<void>((resolve) => socket.once("secureConnect", () => resolve()));

  const reader = readPeer(socket);

  socket.write(UPGRADE_REQUEST);

  const handshake = (await reader.until((seen) => seen.includes(HEADER_TERMINATOR))).toString("latin1");

  assert.match(handshake, /^HTTP\/1\.1 101 Switching Protocols\r\n/, "the peer answered the upgrade");
  assert.match(handshake, /\r\nSec-WebSocket-Accept: \S+\r\n/, "the peer proved it speaks the protocol by echoing the key through the handshake digest");
  reader.discard();

  return {

    reader,
    socket,
    [Symbol.asyncDispose]: (): Promise<void> => {

      socket.destroy();

      return Promise.resolve();
    }
  };
}

// Dial a port and report the error code a refused connection carries, which is how a listener that has stopped is observed from outside.
async function refusedAt(port: number): Promise<string> {

  const socket = dial(port);

  try {

    return await new Promise<string>((resolve, reject) => {

      socket.once("error", (error: NodeJS.ErrnoException) => resolve(error.code ?? ""));
      socket.once("secureConnect", () => reject(new Error("the port answered a connection after the server stopped listening")));
    });
  } finally {

    socket.destroy();
  }
}

/* One masked client frame, as RFC 6455 requires every client-to-server frame to be. The mask key is zero - a legal key - which leaves the payload bytes on the
 * wire exactly as written, and that is what makes a planted decoy readable by a walk that lands on it.
 */
function frame(opcode: number, payloadLength: number, plants: readonly FramePlant[] = []): Buffer {

  const indicator = (payloadLength < 126) ? payloadLength : ((payloadLength <= 65535) ? 126 : 127);
  const extension = (indicator === 126) ? 2 : ((indicator === 127) ? 8 : 0);

  // Two header bytes, the extended length where the payload calls for one, and the four mask bytes, which stay at the zeros Buffer.alloc leaves behind.
  const header = Buffer.alloc(2 + extension + 4);

  header.writeUInt8(0x80 | opcode, 0);
  header.writeUInt8(0x80 | indicator, 1);

  if(indicator === 126) {

    header.writeUInt16BE(payloadLength, 2);
  } else if(indicator === 127) {

    header.writeBigUInt64BE(BigInt(payloadLength), 2);
  }

  // The writer states its own framing rather than trusting it: a decoy planted at an offset derived from this header is worth something only when the header is
  // the one the derivation assumed.
  assert.equal(header.readUInt8(1) & 0x7f, indicator, "the frame declares the length indicator its payload calls for");

  const payload = Buffer.alloc(payloadLength);

  for(const plant of plants) {

    Buffer.from(plant.bytes).copy(payload, plant.at);
  }

  return Buffer.concat([ header, payload ]);
}

describe("FakeWebSocket", () => {

  test("opens on the next microtask by default", async () => {

    const socket = new FakeWebSocket();

    // The blob spelling is the field's construction value and the one observation a plain field no consumer reads back admits at all.
    assert.equal(socket.binaryType, "blob");

    let opened = false;

    socket.addEventListener("open", () => {

      opened = true;
    });

    assert.equal(opened, false, "the open is queued rather than fired inside the constructor, so a consumer's listeners attach first");

    await Promise.resolve();

    assert.equal(opened, true);
  });

  test("stays closed until emitOpen when autoOpen is false", async () => {

    const socket = new FakeWebSocket({ autoOpen: false });

    let opened = false;

    socket.addEventListener("open", () => {

      opened = true;
    });

    await settle();

    assert.equal(opened, false, "a full macrotask turn passes with nothing fired, which is what a handshake test needs in order to drive the open itself");

    socket.emitOpen();

    assert.equal(opened, true);
  });

  test("delivers message, close, and error payloads to their listeners", () => {

    const socket = new FakeWebSocket({ autoOpen: false });
    const closes: { code: number; reason: string }[] = [];
    const errors: unknown[] = [];
    const messages: unknown[] = [];

    socket.addEventListener("close", (event) => closes.push(event));
    socket.addEventListener("error", (event) => errors.push(event.error));
    socket.addEventListener("message", (event) => messages.push(event.data));

    socket.emitMessage("text");
    socket.emitClose();
    socket.emitClose(1006, "gone");
    socket.emitError(new Error("underlying"));

    assert.deepEqual(messages, ["text"]);
    assert.deepEqual(closes, [ { code: 1000, reason: "" }, { code: 1006, reason: "gone" } ]);
    assert.equal(errors.length, 1);
    assert.ok(errors[0] instanceof Error, "the socket's error is relayed as an Error");
    assert.equal(errors[0].message, "underlying");
  });

  test("a once listener fires exactly once", () => {

    const socket = new FakeWebSocket({ autoOpen: false });

    let calls = 0;

    socket.addEventListener("message", () => {

      calls++;
    }, { once: true });

    socket.emitMessage("first");
    socket.emitMessage("second");

    assert.equal(calls, 1);
  });

  test("a once listener that re-enters dispatch is already detached when the re-entry fires", () => {

    const socket = new FakeWebSocket({ autoOpen: false });

    let calls = 0;

    socket.addEventListener("message", () => {

      calls++;

      // The re-entry is guarded to one, so the count reports whether the entry was still registered when the nested dispatch ran rather than runaway recursion.
      if(calls === 1) {

        socket.emitMessage("second");
      }
    }, { once: true });

    socket.emitMessage("first");

    assert.equal(calls, 1, "the entry is deleted before it is called, so the nested dispatch finds nothing registered");
  });

  test("removeEventListener detaches the listener it names", () => {

    const socket = new FakeWebSocket({ autoOpen: false });
    const seen: unknown[] = [];
    const listener = (event: { data: unknown }): void => void seen.push(event.data);

    socket.addEventListener("message", listener);
    socket.emitMessage("before");
    socket.removeEventListener("message", listener);
    socket.emitMessage("after");

    assert.deepEqual(seen, ["before"], "detaching goes by the identity of the function that was registered, which is the handle the stream keeps and hands back");
  });

  test("removing a listener that was never registered leaves the rest of the set alone", () => {

    const socket = new FakeWebSocket({ autoOpen: false });
    const seen: unknown[] = [];

    socket.addEventListener("message", (event) => seen.push(event.data));

    // A teardown detaches each of its listeners whether or not a `once` dispatch has already taken one off, so removing an unknown function has to be quiet
    // rather than a failure...and it must not take a stranger's listener with it.
    socket.removeEventListener("message", (): void => undefined);
    socket.removeEventListener("open", (): void => undefined);
    socket.emitMessage("still here");

    assert.deepEqual(seen, ["still here"]);
  });

  test("failsOnClose reports the close from inside close() itself", () => {

    const socket = new FakeWebSocket({ autoOpen: false, failsOnClose: true });
    const closes: { code: number; reason: string }[] = [];

    socket.addEventListener("close", (event) => closes.push(event));

    // undici fails a connection that never finished its upgrade rather than sending it a close frame, and reports that failure before close() returns...which is
    // what lands a close event inside the caller's own teardown.
    socket.close();

    assert.equal(socket.closeRequested, true);
    assert.deepEqual(closes, [{ code: 1006, reason: "connection failed" }]);
  });

  test("a listener that detaches a sibling mid-dispatch does not perturb the delivery", () => {

    const socket = new FakeWebSocket({ autoOpen: false });
    const first: unknown[] = [];
    const second: unknown[] = [];
    const sibling = (event: { data: unknown }): void => void second.push(event.data);

    socket.addEventListener("message", (event) => {

      first.push(event.data);
      socket.removeEventListener("message", sibling);
    });

    socket.addEventListener("message", sibling);
    socket.emitMessage("one");

    assert.deepEqual(first, ["one"]);
    assert.deepEqual(second, ["one"], "a sibling removed mid-dispatch still receives the dispatch it was registered for when that dispatch began");

    socket.emitMessage("two");

    assert.deepEqual(first, [ "one", "two" ]);
    assert.deepEqual(second, ["one"], "and receives nothing after it");
  });

  test("records a close request without emitting close", () => {

    const socket = new FakeWebSocket({ autoOpen: false });

    let closes = 0;

    socket.addEventListener("close", () => {

      closes++;
    });

    assert.equal(socket.closeRequested, false);

    socket.close();

    assert.equal(socket.closeRequested, true);
    assert.equal(closes, 0, "the fake records the request and leaves the close event for the test to emit");
  });
});

describe("the loopback peer", () => {

  test("answersClose finds a close frame behind a text frame carrying a two-byte extended length", async () => {

    await using server = await createLoopbackServer("answersClose");
    await using client = await connectUpgraded(server.port);

    const payloadLength = 200;

    // This frame's own header, and the wire offset a walk that misread the two-byte indicator as a seven-bit length would step to instead: two header bytes, the
    // four mask bytes, and 126 payload bytes.
    const header = 2 + 2 + 4;
    const misreadStep = 2 + 4 + 126;

    /* A decoy at each offset a misreading walk could land on, spelled through the extension branch this case leaves alone, so such a walk reads a decoy as it
     * misread the real header rather than collapsing it to a small complete frame it would step over. The mid decoy sits where a walk that misread the two-byte
     * indicator lands, the tail decoy where a walk that ignored the mask bit lands. A correct walk steps over the whole payload and reads neither.
     */
    const text = frame(0x1, payloadLength, [ { at: misreadStep - header, bytes: EIGHT_BYTE_DECOY },
      { at: payloadLength - TWO_BYTE_DECOY.length, bytes: TWO_BYTE_DECOY } ]);
    const reply = client.reader.until((seen) => seen.length >= 2);

    client.socket.write(Buffer.concat([ text, frame(0x8, 0) ]));

    assert.deepEqual([...(await reply).subarray(0, 2)], [ 0x88, 0x00 ], "the peer read past the extended-length text frame and answered the close behind it");
  });

  test("answersClose finds a close frame behind a text frame carrying an eight-byte extended length", async () => {

    await using server = await createLoopbackServer("answersClose");
    await using client = await connectUpgraded(server.port);

    const payloadLength = 66000;

    // The same shape one extension wider: a walk that misread the eight-byte indicator as a seven-bit length steps to two header bytes, the four mask bytes, and
    // 127 payload bytes.
    const header = 2 + 8 + 4;
    const misreadStep = 2 + 4 + 127;
    const text = frame(0x1, payloadLength, [ { at: misreadStep - header, bytes: TWO_BYTE_DECOY },
      { at: payloadLength - TWO_BYTE_DECOY.length, bytes: TWO_BYTE_DECOY } ]);
    const reply = client.reader.until((seen) => seen.length >= 2);

    client.socket.write(Buffer.concat([ text, frame(0x8, 0) ]));

    assert.deepEqual([...(await reply).subarray(0, 2)], [ 0x88, 0x00 ], "the peer read past the extended-length text frame and answered the close behind it");
  });

  test("ignoresClose holds its end open after a close frame", async () => {

    await using server = await createLoopbackServer("ignoresClose");

    const arriving = server.connection(0);

    await using client = await connectUpgraded(server.port);

    const connection = await arriving;

    client.socket.write(frame(0x8, 0));

    /* The one negative observation this suite keeps, and it is bounded by turns rather than proven: ten macrotask settles is long enough for a loopback peer
     * that meant to answer to have answered, and no count of turns can establish that one never will.
     */
    await settle(10);

    assert.equal(client.reader.seen().length, 0, "the hostile peer leaves the close frame unanswered, which is the live controller's own habit");

    // The client's own release is then the only thing that can end the connection, which is the condition the stream's disposal contract has to hold under.
    client.socket.destroy();

    await connection.closed;
  });

  test("neverUpgrades leaves the upgrade unanswered", async () => {

    await using server = await createLoopbackServer("neverUpgrades");

    const socket = dial(server.port);

    try {

      await new Promise<void>((resolve) => socket.once("secureConnect", () => resolve()));

      const reader = readPeer(socket);

      socket.write(UPGRADE_REQUEST);

      await settle(10);

      assert.equal(reader.seen().length, 0, "the peer completed TCP and TLS and answered nothing above them, so a client's connect stays in flight");
    } finally {

      socket.destroy();
    }
  });

  test("connection resolves a connection that has already arrived", async () => {

    await using server = await createLoopbackServer("ignoresClose");

    const arming = server.connection(0);

    await using client = await connectUpgraded(server.port);

    const armed = await arming;

    assert.ok(Object.is(await server.connection(0), armed), "a position asked for after the fact is answered from the connections already accepted");
    assert.ok(client.socket.writable, "and it names the connection that is still open");
  });

  test("reports the protocol the client negotiated", async () => {

    await using server = await createLoopbackServer("ignoresClose");

    const arriving = server.connection(0);

    await using client = await connectUpgraded(server.port);

    // The peer offers h2 ahead of http/1.1, so what it reports is an assertion on the client's own offer staying http/1.1-only, which an upgrade requires.
    assert.equal((await arriving).alpnProtocol, "http/1.1");
    assert.equal(client.socket.alpnProtocol, "http/1.1");
  });

  test("close severs an open connection and stops listening", async () => {

    await using server = await createLoopbackServer("ignoresClose");

    const arriving = server.connection(0);

    await using client = await connectUpgraded(server.port);

    const connection = await arriving;

    assert.ok(client.socket.writable, "the connection is open at the moment the server is asked to close");

    // Severing comes before the listener stops, so a connection a client deliberately left open cannot hold the close open indefinitely.
    await server.close();
    await connection.closed;

    assert.equal(await refusedAt(server.port), "ECONNREFUSED", "the listener released its port, so a fresh dial finds nothing there");
  });
});

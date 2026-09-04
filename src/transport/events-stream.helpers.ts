/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * events-stream.helpers.ts: The two peers EventStream tests drive it against - a deterministic in-memory fake WebSocket for everything above the socket, and a
 * loopback TLS server that speaks the upgrade by hand for the things only a real socket can show.
 */
import { listenOnLoopback, stopListening } from "./loopback.helpers.ts";
import { loopbackCertificateFixture, loopbackPrivateKeyFixture } from "./tls.fixtures.ts";
import type { AccessWebSocket } from "./ws.ts";
import type { TLSSocket } from "node:tls";
import { createHash } from "node:crypto";
import { createServer } from "node:tls";

// The fixed value RFC 6455 defines for the handshake digest, and the blank line that ends an HTTP header block.
const WEBSOCKET_ACCEPT_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
const HEADER_TERMINATOR = "\r\n\r\n";

// The listener-registration options EventStream uses - a subset of the standard addEventListener options.
interface ListenerOptions {

  once?: boolean;
  signal?: AbortSignal;
}

// A registered listener and whether it should fire only once. Stored type-erased; the public addEventListener overloads keep the call sites fully typed.
interface ListenerEntry {

  listener: (event: unknown) => void;
  once: boolean;
}

/**
 * Construction options for {@link FakeWebSocket}.
 *
 * - `autoOpen` (default `true`) schedules an `open` event on the next microtask, so a consumer that simply `await`s the stream's open handshake connects without
 *   the test having to drive `emitOpen()` by hand. Tests that scrutinize the handshake itself pass `false` and open explicitly.
 */
export interface FakeWebSocketOptions {

  autoOpen?: boolean;
}

/**
 * A deterministic in-memory WebSocket that satisfies the {@link AccessWebSocket} surface {@link EventStream} consumes. Tests inject it through the `webSocket`
 * factory and drive the connection with the `emit*` methods - no network, no real server, no timing nondeterminism. It honors `once` and `signal` on
 * `addEventListener` exactly as the real socket does, so the stream's single-AbortController teardown (which detaches every listener at once) is exercised
 * faithfully.
 */
export class FakeWebSocket implements AccessWebSocket {

  binaryType: "arraybuffer" | "blob" = "blob";

  // Whether close() has been requested on the socket, for tests that assert the EventStream asked the underlying socket to close.
  closeRequested = false;

  readonly #listeners = new Map<string, Set<ListenerEntry>>();

  constructor(options: FakeWebSocketOptions = {}) {

    // Open on the next microtask by default, after the EventStream constructor has synchronously attached its listeners.
    if(options.autoOpen ?? true) {

      queueMicrotask(() => this.emitOpen());
    }
  }

  addEventListener(type: "open", listener: () => void, options?: ListenerOptions): void;
  addEventListener(type: "message", listener: (event: { data: unknown }) => void, options?: ListenerOptions): void;
  addEventListener(type: "close", listener: (event: { code: number; reason: string }) => void, options?: ListenerOptions): void;
  addEventListener(type: "error", listener: (event: { error?: unknown; message?: string }) => void, options?: ListenerOptions): void;
  addEventListener(type: string, listener: (event: never) => void, options: ListenerOptions = {}): void {

    const set = this.#setFor(type);
    const entry: ListenerEntry = { listener: listener as (event: unknown) => void, once: options.once ?? false };

    set.add(entry);

    // The signal detaches the listener on abort - the mechanism the EventStream's one AbortController uses to tear every listener down together.
    options.signal?.addEventListener("abort", () => set.delete(entry), { once: true });
  }

  /** Request the socket close. Records the request; teardown in EventStream flows through its own close path rather than waiting on a close event here. */
  close(): void {

    this.closeRequested = true;
  }

  /** Fire the `open` event. */
  emitOpen(): void {

    this.#dispatch("open", undefined);
  }

  /** Fire a `message` event carrying `data` - typically a string, since the notification wire is JSON text frames and the heartbeat is a text literal. */
  emitMessage(data: unknown): void {

    this.#dispatch("message", { data });
  }

  /** Fire a `close` event with the given frame code and reason. */
  emitClose(code = 1000, reason = ""): void {

    this.#dispatch("close", { code, reason });
  }

  /** Fire an `error` event carrying an optional underlying cause. */
  emitError(error?: unknown): void {

    this.#dispatch("error", { error });
  }

  // Dispatch an event to every listener registered for the type, removing any that asked to fire only once. We snapshot the set first so a listener that detaches
  // mid-dispatch does not perturb the iteration.
  #dispatch(type: string, event: unknown): void {

    const set = this.#listeners.get(type);

    if(set === undefined) {

      return;
    }

    for(const entry of [...set]) {

      if(entry.once) {

        set.delete(entry);
      }

      entry.listener(event);
    }
  }

  #setFor(type: string): Set<ListenerEntry> {

    let set = this.#listeners.get(type);

    if(set === undefined) {

      set = new Set();
      this.#listeners.set(type, set);
    }

    return set;
  }
}

// The loopback peer.

/**
 * How the loopback peer answers a connected client - the one dial each test sets.
 *
 * - `answersClose` completes the closing handshake and ends the connection, which is what RFC 6455 asks a server to do.
 * - `ignoresClose` accepts the client's close frame and holds its end of the connection open, which is the live controller's own habit.
 * - `neverUpgrades` accepts the connection and never answers the upgrade request, leaving the client's connect in flight.
 */
export type LoopbackPeerBehavior = "answersClose" | "ignoresClose" | "neverUpgrades";

/**
 * One connection the loopback server accepted, as a test observes it.
 *
 * `closed` is armed at accept rather than on demand: severance lands within milliseconds of a client's teardown, so a listener attached after the fact would miss
 * the very event it exists to observe. `alpnProtocol` is read at the same moment, and is what the negotiated-protocol assertion reads.
 */
export interface LoopbackConnection {

  readonly alpnProtocol: string | false | null;
  readonly closed: Promise<void>;
}

/**
 * A listening loopback server. `connection(index)` resolves with the connection at that position in accept order, whether it has already arrived or is still to
 * come, so a test can arm itself against a connection before the client makes it.
 */
export interface LoopbackServer extends AsyncDisposable {

  readonly port: number;
  close(): Promise<void>;
  connection(index: number): Promise<LoopbackConnection>;
}

/**
 * Build a loopback TLS server that speaks just enough of the WebSocket protocol for the realtime stream to connect to it, and that misbehaves on demand.
 *
 * The notification URL's scheme is `wss://` by construction, so exercising the stream's own socket path at all takes a real TLS peer: {@link FakeWebSocket} stands
 * in for everything above the socket and for nothing at it. The upgrade is completed by hand rather than by a WebSocket implementation, which is what lets the peer
 * then behave in ways no library would - accepting a close frame and never answering it is the condition the stream's disposal contract has to hold under.
 *
 * Every accepted socket is put in flowing mode at accept whatever the dial says, because a socket that is never read may never emit `close` once the peer severs
 * it, and `close` is the event the disposal tests wait on. The server offers `h2` ahead of `http/1.1` in ALPN so that a client which offered both would negotiate
 * `h2`, which is what makes the negotiated protocol worth asserting.
 *
 * @param behavior - How the peer answers a connected client.
 *
 * @returns The listening server. Close or dispose it to sever every connection and stop listening.
 */
export async function createLoopbackServer(behavior: LoopbackPeerBehavior): Promise<LoopbackServer> {

  const connections: LoopbackConnection[] = [];
  const server = createServer({ ALPNProtocols: [ "h2", "http/1.1" ], cert: loopbackCertificateFixture, key: loopbackPrivateKeyFixture });
  const sockets: TLSSocket[] = [];
  const waiting = new Map<number, (connection: LoopbackConnection) => void>();

  server.on("secureConnection", (socket) => {

    const closed = Promise.withResolvers<undefined>();
    const connection: LoopbackConnection = { alpnProtocol: socket.alpnProtocol, closed: closed.promise };
    const index = connections.length;
    let buffered = Buffer.alloc(0);
    let upgraded = false;

    connections.push(connection);
    sockets.push(socket);
    socket.once("close", () => closed.resolve(undefined));

    // A client severing its end of the connection is the very thing these tests arrange, so the reset it raises here is expected rather than a fault.
    socket.on("error", () => undefined);

    waiting.get(index)?.(connection);
    waiting.delete(index);

    socket.on("data", (chunk: Buffer) => {

      // The peer that never upgrades reads and discards, which leaves the client's connect in flight - the pre-open condition one of the disposal tests tears down
      // from.
      if(behavior === "neverUpgrades") {

        return;
      }

      buffered = Buffer.concat([ buffered, chunk ]);

      if(!upgraded) {

        const boundary = buffered.indexOf(HEADER_TERMINATOR);

        if(boundary < 0) {

          return;
        }

        const key = (/^sec-websocket-key: *(\S+)/im).exec(buffered.subarray(0, boundary).toString("latin1"))?.[1] ?? "";

        buffered = buffered.subarray(boundary + HEADER_TERMINATOR.length);
        upgraded = true;
        socket.write("HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: " + acceptDigest(key) +
          HEADER_TERMINATOR);
      }

      // The cooperative peer answers the close frame and ends the connection; the hostile one leaves the frame unanswered and its end open, so the client's own
      // release is the only thing that can end it.
      if((behavior === "answersClose") && hasCloseFrame(buffered)) {

        socket.end(Buffer.from([ 0x88, 0x00 ]));
      }
    });
  });

  const port = await listenOnLoopback(server);

  const close = async (): Promise<void> => {

    // Severing before closing rather than after: a server's close() resolves only once every connection has ended, and a connection the client deliberately left
    // open is exactly the state this has to clean up from.
    for(const socket of sockets) {

      socket.destroy();
    }

    await stopListening(server);
  };

  return {

    close,
    connection: async (index: number): Promise<LoopbackConnection> => {

      const arrived = connections[index];

      if(arrived !== undefined) {

        return arrived;
      }

      const { promise, resolve } = Promise.withResolvers<LoopbackConnection>();

      waiting.set(index, resolve);

      return promise;
    },
    port,
    [Symbol.asyncDispose]: close
  };
}

// The handshake's proof that the peer speaks the protocol: the client's key concatenated with the RFC's fixed value, hashed and encoded. A client that does not
// see its own key echoed back this way refuses the connection, which is why the server cannot simply answer 101 and be done.
function acceptDigest(key: string): string {

  return createHash("sha1").update(key + WEBSOCKET_ACCEPT_GUID).digest("base64");
}

/* Walk the client's frame stream and report whether a close frame has arrived in full.
 *
 * Only the opcode and the framing lengths are read - a payload is stepped over rather than unmasked - because the one question here is whether the client asked to
 * close. Client-to-server frames are always masked, so a header is two bytes, an optional extended length, and the four-byte mask key.
 */
function hasCloseFrame(frames: Buffer): boolean {

  let offset = 0;

  while((offset + 2) <= frames.length) {

    const opcode = frames.readUInt8(offset) & 0x0f;
    const masked = (frames.readUInt8(offset + 1) & 0x80) !== 0;
    const indicator = frames.readUInt8(offset + 1) & 0x7f;
    let header = 2;
    let payload = indicator;

    if(indicator === 126) {

      header += 2;

      if(frames.length < (offset + header)) {

        return false;
      }

      payload = frames.readUInt16BE(offset + 2);
    } else if(indicator === 127) {

      header += 8;

      if(frames.length < (offset + header)) {

        return false;
      }

      payload = Number(frames.readBigUInt64BE(offset + 2));
    }

    if(masked) {

      header += 4;
    }

    if((offset + header + payload) > frames.length) {

      return false;
    }

    if(opcode === 0x8) {

      return true;
    }

    offset += header + payload;
  }

  return false;
}

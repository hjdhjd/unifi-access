/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * loopback.helpers.ts: The loopback peers these suites drive real sockets against - a recording https responder, an https peer that takes requests over HTTP/2 or
 * HTTP/1.1 and answers none, a silent peer that answers nothing, and a silent peer that resets every connection it accepts - plus the accept-order ledger every
 * loopback peer records its connections in.
 *
 * A peer lives here when more than one suite needs it, or when its lifecycle is the plumbing rather than the point. The notification stream's hand-rolled
 * WebSocket upgrade stays beside its own tests instead: it speaks raw TLS sockets and shares no server shape with an https responder, so the accept-order ledger
 * and the record of a TLS connection are all it takes from here.
 */
import type { Http2ServerRequest, ServerHttp2Session } from "node:http2";
import { listenOnLoopback, stopListening } from "homebridge-plugin-utils/testing";
import { loopbackCertificateFixture, loopbackPrivateKeyFixture } from "./tls.fixtures.ts";
import type { IncomingMessage } from "node:http";
import type { Socket } from "node:net";
import type { Server as TlsServer } from "node:tls";
import { createSecureServer } from "node:http2";
import { createServer } from "node:https";
import { createServer as createTcpServer } from "node:net";
import { setTimeout as setTimeoutAsync } from "node:timers/promises";

/* The real-time bound, in milliseconds, within which a cancelled or expired request settles and within which a reset or a disposal releases a connection attempt,
 * before a test calls it a failure. It sits more than an order of magnitude above what either costs and an order of magnitude below undici's own ten-second
 * connect timer - which is what a settlement or a release that silently did nothing would fall through to, and is what makes the bound tell the two apart.
 */
export const DIAL_SETTLE_BOUND_MS = 1000;

/* How long a dial test waits on real time before it reads what a cancel left alone: that no second connection attempt reached the peer, that a connection attempt
 * left to the pool is still open, and that a request waiting on it is still pending. A re-dial is a connect syscall and an accept event, a couple of milliseconds
 * on loopback, which a single macrotask turn does not reliably span; this wait spans it more than an order of magnitude over.
 */
export const REDIAL_WAIT_MS = 50;

// How long the resetting peer holds a connection before it resets it. The accept and a test's own reaction to it share one turn of the event loop, so any delay
// orders the reset after whatever the test does to the connection attempt; this one also gives the client time to send the opening of its handshake.
const HANDSHAKE_RESET_DELAY_MS = 50;

// Nanoseconds per millisecond, which is the unit `process.hrtime.bigint()` answers in and the one the bound above is written in.
const NANOSECONDS_PER_MILLISECOND = 1000000;

/**
 * Real elapsed milliseconds since a `process.hrtime.bigint()` reading.
 *
 * A settlement has to be bounded on real time whatever clock its subject is driven by: a virtual clock cannot tell a prompt settlement from undici's own connect
 * timer, because the two end a request the same way and a `TestClock` reports whatever elapsed time its advance says.
 *
 * @param startedAt - The reading to measure from.
 *
 * @returns Milliseconds of real time elapsed since that reading.
 */
export function elapsedSince(startedAt: bigint): number {

  return Number(process.hrtime.bigint() - startedAt) / NANOSECONDS_PER_MILLISECOND;
}

/**
 * Wait out {@link REDIAL_WAIT_MS} on real time, and report whether every promise given was still pending when it elapsed.
 *
 * A promise that settles inside the wait - a rejection as much as a resolution - ends the wait early and answers `false`, so a test that expects something to stay
 * open learns at once when it did not.
 *
 * @param promises - What has to stay pending: a request, an accepted connection's `closed`, or a connection the peer has yet to accept.
 *
 * @returns Whether the wait elapsed with every one of them still pending.
 */
export async function pendingThroughRedialWait(...promises: Promise<unknown>[]): Promise<boolean> {

  return Promise.race([ setTimeoutAsync(REDIAL_WAIT_MS, true), ...promises.map(async (promise) => promise.then(() => false, () => false)) ]);
}

/**
 * The accept-order bookkeeping every loopback peer here shares: connections recorded in the order they arrive, and an accessor that resolves with the one at a
 * given position whether it has already arrived or is still to come.
 *
 * Arming against a connection before the client makes it is what these tests need, because severance lands within milliseconds of a teardown and a listener
 * attached after the fact would miss the very event it exists to observe. `accepted` reads the count so far, which is how a test proves that a settled request
 * was never re-dialed.
 */
export interface ConnectionLedger<T> {

  readonly accepted: number;
  connection(index: number): Promise<T>;
  record(connection: T): void;
}

/**
 * Build an accept-order ledger.
 *
 * @typeParam T - What one accepted connection is recorded as, which each peer shapes for what its own tests read.
 *
 * @returns The ledger.
 */
export function createConnectionLedger<T>(): ConnectionLedger<T> {

  const connections: T[] = [];
  const waiting = new Map<number, (connection: T) => void>();

  return {

    get accepted(): number {

      return connections.length;
    },

    connection: async (index: number): Promise<T> => {

      const arrived = connections[index];

      if(arrived !== undefined) {

        return arrived;
      }

      const { promise, resolve } = Promise.withResolvers<T>();

      waiting.set(index, resolve);

      return promise;
    },

    record: (connection: T): void => {

      const index = connections.length;

      connections.push(connection);
      waiting.get(index)?.(connection);
      waiting.delete(index);
    }
  };
}

/** One connection a loopback peer accepted, as a test observes it: the promise that resolves once the peer's own end of it closes, armed at accept so a severance
 * cannot be missed.
 */
export interface AcceptedConnection {

  readonly closed: Promise<void>;
}

/** One connection a loopback peer accepted over TLS, as a test observes it: the `closed` every accepted connection carries, and the application protocol its
 * handshake negotiated, read at the same moment. The protocol is what a test asserts before anything protocol-specific, because a row meant for one protocol that
 * quietly ran over the other would pass for the wrong reason.
 */
export interface LoopbackConnection extends AcceptedConnection {

  readonly alpnProtocol: string | false | null;
}

/**
 * Take in one connection a loopback peer has just accepted: keep its socket for the peer's disposal to sever when the peer keeps them, swallow the error a client
 * severing its end raises, and arm the `closed` a test reads. Every loopback peer accepts through this, so a connection is watched the same way whichever peer
 * took it, and each peer adds only what is its own - reading the socket, acting on it, or recording the protocol it negotiated.
 *
 * @typeParam S  - The socket the peer accepted, a plain or a TLS one.
 *
 * @param socket - The socket just accepted.
 * @param kept   - Where the peer keeps its sockets for disposal, when it keeps them at all.
 *
 * @returns The accepted connection, its `closed` armed before any event can fire on the socket.
 */
export function acceptConnection<S extends Socket>(socket: S, kept?: S[]): AcceptedConnection {

  const closed = Promise.withResolvers<undefined>();

  kept?.push(socket);
  socket.once("close", () => closed.resolve(undefined));

  // A client severing its end of the connection is the very thing these tests arrange, so the reset it raises here is expected rather than a fault.
  socket.on("error", () => undefined);

  return { closed: closed.promise };
}

/** A silent peer on loopback: how many connections it has accepted, where to reach it, and the connection at a given position in accept order. */
export interface SilentLoopback extends AsyncDisposable {

  readonly accepted: number;
  readonly host: string;
  connection(index: number): Promise<AcceptedConnection>;
}

/**
 * A peer on loopback that accepts every connection and then says nothing at all.
 *
 * A TLS client dialing it completes TCP and waits forever in the handshake, which is the one peer behavior that leaves a connection attempt in flight for as long
 * as a test needs it - a black hole at a loopback address, with none of a routed black hole's dependence on the network.
 *
 * @returns The listening peer. Dispose it to sever every connection and stop listening.
 */
export async function createSilentLoopback(): Promise<SilentLoopback> {

  return createQuietLoopback(() => undefined);
}

/**
 * A peer on loopback that accepts every connection, says nothing, and resets it a short while later.
 *
 * A TLS client dialing it completes TCP and then has its handshake reset under it, reported as `ECONNRESET` - a connection fault undici's retry interceptor treats
 * as retryable, so this is the peer that asks whether a failed connection attempt is dialed again. The delay before the reset is the window a test acts in while
 * the attempt is still in flight, and the accepted connection's `closed` is how a test knows the reset has landed.
 *
 * @returns The listening peer. Dispose it to sever every connection and stop listening.
 */
export async function createResettingLoopback(): Promise<SilentLoopback> {

  return createQuietLoopback((socket) => {

    const reset = setTimeout(() => socket.resetAndDestroy(), HANDSHAKE_RESET_DELAY_MS);

    // A connection that ends before its reset is due, severed by the client or by disposal, has nothing left to reset.
    socket.once("close", () => clearTimeout(reset));
  });
}

/* The body every silent peer here shares: accept each connection, say nothing, record it in accept order, and sever everything on disposal. `onAccept` is what a
 * particular peer does with a connection beyond that. Every accepted socket is put in flowing mode, because a socket that is never read may never emit `close` once
 * its peer severs it, and `close` is the event these tests wait on.
 */
async function createQuietLoopback(onAccept: (socket: Socket) => void): Promise<SilentLoopback> {

  const ledger = createConnectionLedger<AcceptedConnection>();
  const sockets: Socket[] = [];
  const server = createTcpServer((socket) => {

    const connection = acceptConnection(socket, sockets);

    socket.resume();
    onAccept(socket);
    ledger.record(connection);
  });

  const host = "127.0.0.1:" + (await listenOnLoopback(server)).toString();

  return {

    [Symbol.asyncDispose]: async (): Promise<void> => {

      // Severing before closing rather than after: a server's close() resolves only once every connection has ended, and a connection nobody ever answered is
      // exactly the state this has to clean up from.
      for(const socket of sockets) {

        socket.destroy();
      }

      await stopListening(server);
    },
    get accepted(): number {

      return ledger.accepted;
    },
    connection: async (index: number): Promise<AcceptedConnection> => ledger.connection(index),
    host
  };
}

/** What an https loopback peer received, how many connections carried it, and where to reach it. */
export interface HttpsLoopback extends AsyncDisposable {

  readonly accepted: number;
  hits: { body: Buffer; contentType: string }[];
  host: string;
  origin: string;
  connection(index: number): Promise<AcceptedConnection>;
}

/** An https peer on loopback that records what every request carried and answers each one however the caller says, presenting the same throwaway self-signed
 * identity the rest of these suites' real-socket tests use - which is the certificate a controller itself presents, in the one detail that matters to a verifying
 * client.
 *
 * A MockAgent replaces undici's dispatch wholesale, so everything beneath it is permanently out of a mocked test's reach: the pool's own connect options,
 * certificate verification among them, the bytes a request really put on a socket, and anything the retry interceptor does. Establishing any of those takes a real
 * peer, dialed by a transport that built its own pool.
 *
 * @param respond - What to answer a request with, given which request it is. The count is one-based, so a responder that varies its answer reads the first
 *                  request as hit one.
 *
 * @returns The recording peer. Dispose it to stop listening.
 */
export async function createHttpsLoopback(respond: (hit: number) => { body: string; contentType: string; status: number }): Promise<HttpsLoopback> {

  const hits: { body: Buffer; contentType: string }[] = [];
  const ledger = createConnectionLedger<AcceptedConnection>();
  const server = createServer({ cert: loopbackCertificateFixture, key: loopbackPrivateKeyFixture }, (request, response) => {

    const chunks: Buffer[] = [];

    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => {

      hits.push({ body: Buffer.concat(chunks), contentType: request.headers["content-type"] ?? "" });

      const answer = respond(hits.length);

      response.writeHead(answer.status, { "content-type": answer.contentType });
      response.end(answer.body);
    });
  });

  /* The accepted sockets are recorded on the server's own connection event rather than on a request, because what these tests watch is the connection's lifetime
   * and not the exchange carried over it: a keepalive socket serves several requests, and the one a release severs may be carrying none at all.
   */
  server.on("secureConnection", (socket) => ledger.record(acceptConnection(socket)));

  const host = "127.0.0.1:" + (await listenOnLoopback(server)).toString();

  return {

    [Symbol.asyncDispose]: async (): Promise<void> => {

      await stopListening(server);
    },
    get accepted(): number {

      return ledger.accepted;
    },
    connection: async (index: number): Promise<AcceptedConnection> => ledger.connection(index),
    hits,
    host,
    origin: "https://" + host
  };
}

/** One request an unanswering peer received, as a test observes it: the method and the path it carried. Each is typed as the platform's https request declares it,
 * optional because that class carries a client's responses as well, though a request a server receives always carries each.
 */
export interface UnansweredRequest {

  readonly method: string | undefined;
  readonly path: string | undefined;
}

/** An https peer on loopback that answers nothing: where to reach it, the connection at a given position in accept order, and the request at a given position in
 * arrival order.
 */
export interface UnansweringHttpsLoopback extends AsyncDisposable {

  readonly host: string;
  connection(index: number): Promise<LoopbackConnection>;
  request(index: number): Promise<UnansweredRequest>;
}

/**
 * An https peer on loopback that takes every request and answers none, over HTTP/2 or HTTP/1.1.
 *
 * A request this peer has received is in flight on an established connection for as long as a test needs it, which is the state a teardown meets once the dial
 * is over and the one neither the silent peers nor the recording responder can hold. By default it is a secure HTTP/2 server that accepts HTTP/1.1 as well, so a
 * client offering `h2` beside `http/1.1` negotiates `h2`. With `offerH2` false it is an https server instead, which speaks HTTP/1.1 alone and offers only
 * `http/1.1` in its handshake, so a client that offers `http/1.1` negotiates it, whatever else it offers - which is how a test holds a request on the protocol it
 * means to. Each connection is recorded at accept with the protocol it negotiated, and each request as it arrives, so a test can arm itself against a connection
 * or a request before the client makes it.
 *
 * @param options         - Peer options.
 * @param options.offerH2 - Whether the peer negotiates HTTP/2 with a client that offers it. Defaults to `true`.
 *
 * @returns The listening peer. Dispose it to sever every session and connection and stop listening.
 */
export async function createUnansweringHttpsLoopback({ offerH2 = true }: { offerH2?: boolean } = {}): Promise<UnansweringHttpsLoopback> {

  const connections = createConnectionLedger<LoopbackConnection>();
  const requests = createConnectionLedger<UnansweredRequest>();
  const sessions: ServerHttp2Session[] = [];
  const sockets: Socket[] = [];
  const identity = { cert: loopbackCertificateFixture, key: loopbackPrivateKeyFixture };

  // Each server hands this one handler its requests, and it reads only what the HTTP/2 server's request and the https server's request have in common.
  const onRequest = (request: Http2ServerRequest | IncomingMessage): void => requests.record({ method: request.method, path: request.url });

  /* Which server answers decides the protocol, rather than a setting on one server: the HTTP/2 server writes its own offer, with `h2` at its head, whatever list it
   * is handed, while the https server offers `http/1.1` alone. Only the HTTP/2 server opens sessions, so only it records them for the disposal to end.
   */
  const server: TlsServer = offerH2 ? createSecureServer({ ...identity, allowHTTP1: true }, onRequest).on("session", (session) => sessions.push(session)) :
    createServer(identity, onRequest);

  server.on("secureConnection", (socket) => connections.record({ alpnProtocol: socket.alpnProtocol, ...acceptConnection(socket, sockets) }));

  const host = "127.0.0.1:" + (await listenOnLoopback(server)).toString();

  return {

    [Symbol.asyncDispose]: async (): Promise<void> => {

      /* Severing before closing rather than after: a server's close() resolves only once every connection has ended, and a request nobody answers holds its
       * connection open. An HTTP/2 session is ended ahead of the socket it runs over, so no session outlives the connection under it.
       */
      for(const session of sessions) {

        session.destroy();
      }

      for(const socket of sockets) {

        socket.destroy();
      }

      await stopListening(server);
    },
    connection: async (index: number): Promise<LoopbackConnection> => connections.connection(index),
    host,
    request: async (index: number): Promise<UnansweredRequest> => requests.connection(index)
  };
}

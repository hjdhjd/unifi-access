/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * loopback.helpers.ts: The loopback peers these suites drive real sockets against - a recording https responder and a silent peer that answers nothing - plus the
 * accept-order ledger and the listen-and-stop lifecycle every loopback server here shares.
 *
 * A peer lives here when more than one suite needs it, or when its lifecycle is the plumbing rather than the point. The notification stream's hand-rolled
 * WebSocket upgrade stays beside its own tests instead: it speaks raw TLS sockets and shares no server shape with an https responder, so only its listen and stop
 * are common ground.
 */
import type { Server, Socket } from "node:net";
import { loopbackCertificateFixture, loopbackPrivateKeyFixture } from "./tls.fixtures.ts";
import { createServer } from "node:https";
import { createServer as createTcpServer } from "node:net";

/* How long a cut connection attempt may take to settle, in milliseconds, before a test calls it a failure. The measured cut of a socket held mid-handshake lands
 * at around 305 to 309 milliseconds, so this bound sits an order of magnitude above what a working cut costs and an order of magnitude below undici's own
 * ten-second connect timer - which is what a cut that silently did nothing would fall through to, and is what makes the bound tell the two apart.
 */
export const DIAL_CUT_BOUND_MS = 1000;

// Nanoseconds per millisecond, which is the unit `process.hrtime.bigint()` answers in and the one the bound above is written in.
const NANOSECONDS_PER_MILLISECOND = 1000000;

/**
 * Real elapsed milliseconds since a `process.hrtime.bigint()` reading.
 *
 * A settlement has to be bounded on real time whatever clock its subject is driven by: a virtual clock cannot tell a cut connection attempt from undici's own
 * connect timer, because the two end a request the same way and a `TestClock` reports whatever elapsed time its advance says.
 *
 * @param startedAt - The reading to measure from.
 *
 * @returns Milliseconds of real time elapsed since that reading.
 */
export function elapsedSince(startedAt: bigint): number {

  return Number(process.hrtime.bigint() - startedAt) / NANOSECONDS_PER_MILLISECOND;
}

/**
 * The accept-order bookkeeping every loopback peer here shares: connections recorded in the order they arrive, and an accessor that resolves with the one at a
 * given position whether it has already arrived or is still to come.
 *
 * Arming against a connection before the client makes it is what these tests need, because severance lands within milliseconds of a teardown and a listener
 * attached after the fact would miss the very event it exists to observe. `accepted` reads the count so far, which is how a test proves that a cut request was
 * never re-dialed.
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
 * as a test needs it - a black hole at a loopback address, with none of a routed black hole's dependence on the network. Every accepted socket is put in flowing
 * mode, because a socket that is never read may never emit `close` once its peer severs it, and `close` is the event these tests wait on.
 *
 * @returns The listening peer. Dispose it to sever every connection and stop listening.
 */
export async function createSilentLoopback(): Promise<SilentLoopback> {

  const ledger = createConnectionLedger<AcceptedConnection>();
  const sockets: Socket[] = [];
  const server = createTcpServer((socket) => {

    const closed = Promise.withResolvers<undefined>();

    sockets.push(socket);
    socket.resume();
    socket.once("close", () => closed.resolve(undefined));

    // A client severing its end of the connection is the very thing these tests arrange, so the reset it raises here is expected rather than a fault.
    socket.on("error", () => undefined);

    ledger.record({ closed: closed.promise });
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

/** Listen on an ephemeral loopback port, and report the port the operating system assigned.
 *
 * Port zero is what lets these suites run anywhere and in parallel: the kernel hands out a free port and the caller reads it back off the bound address rather
 * than trusting a constant that something else may already hold. A listening TCP server always reports an address record - the string form belongs to a pipe or a
 * domain socket - so anything else is a fault in the caller's setup rather than a condition to recover from.
 *
 * @param server - Any server that listens on a socket: the https responder below, and the TLS peer the notification-stream suite stands up.
 *
 * @returns The port the server is listening on.
 */
export async function listenOnLoopback(server: Server): Promise<number> {

  const listening = Promise.withResolvers<undefined>();

  server.listen(0, "127.0.0.1", () => listening.resolve(undefined));

  await listening.promise;

  const address = server.address();

  if((address === null) || (typeof address === "string")) {

    throw new Error("The loopback server did not report a TCP address.");
  }

  return address.port;
}

/**
 * Stop accepting, and resolve once the server has released its handle.
 *
 * @param server - The server to stop.
 */
export async function stopListening(server: Server): Promise<void> {

  const stopped = Promise.withResolvers<undefined>();

  server.close(() => stopped.resolve(undefined));

  await stopped.promise;
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
  server.on("secureConnection", (socket) => {

    const closed = Promise.withResolvers<undefined>();

    socket.once("close", () => closed.resolve(undefined));

    // A client severing its end of the connection is what the release tests arrange, so the reset it raises here is expected rather than a fault.
    socket.on("error", () => undefined);

    ledger.record({ closed: closed.promise });
  });

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

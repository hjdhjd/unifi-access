/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * loopback.helpers.ts: The loopback peers these suites drive real sockets against - a recording https responder, and the listen-and-stop lifecycle every loopback
 * server here shares.
 *
 * A peer lives here when more than one suite needs it, or when its lifecycle is the plumbing rather than the point. The notification stream's hand-rolled
 * WebSocket upgrade stays beside its own tests instead: it speaks raw TLS sockets and shares no server shape with an https responder, so only its listen and stop
 * are common ground.
 */
import { loopbackCertificateFixture, loopbackPrivateKeyFixture } from "./tls.fixtures.ts";
import type { Server } from "node:net";
import { createServer } from "node:https";

/** What an https loopback peer received, and where to reach it. */
export interface HttpsLoopback extends AsyncDisposable {

  hits: { body: Buffer; contentType: string }[];
  host: string;
  origin: string;
}

/* Listen on an ephemeral loopback port, and report the port the operating system assigned.
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

// Stop accepting, and resolve once the server has released its handle.
export async function stopListening(server: Server): Promise<void> {

  const stopped = Promise.withResolvers<undefined>();

  server.close(() => stopped.resolve(undefined));

  await stopped.promise;
}

/* An https peer on loopback that records what every request carried and answers each one however the caller says, presenting the same throwaway self-signed
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

  const host = "127.0.0.1:" + (await listenOnLoopback(server)).toString();

  return {

    [Symbol.asyncDispose]: async (): Promise<void> => {

      await stopListening(server);
    },
    hits,
    host,
    origin: "https://" + host
  };
}

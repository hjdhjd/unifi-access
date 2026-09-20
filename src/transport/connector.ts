/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * connector.ts: The connector both dialers hand undici - the one place a socket is held from the moment it is vended, so a dial still connecting can be cut.
 */
import { buildConnector, errors } from "undici";
import type { Socket } from "node:net";

/* The connector's own runtime shape. undici's types declare the call as returning `void` (node_modules/undici/types/connector.d.ts:34-36) while the
 * implementation returns the socket it just created (node_modules/undici/lib/core/connect.js:163, `return socket`), which is what lets a wrapper hold a socket
 * before any event has fired on it. Naming the runtime return here is what the cast below spends, and the connector suite's cut of a dial in flight is the proof
 * that the return is real.
 */
type DialingConnector = (options: buildConnector.Options, callback: buildConnector.Callback) => Socket;

/**
 * Construction options for {@link createOwnedConnector}.
 *
 * - `allowH2` is what the dialer would otherwise have told undici's own builder: the HTTP pool offers HTTP/2, and a WebSocket upgrade cannot use it. It has to be
 *   stated here because a function connector bypasses the forwarding a `Pool` and an `Agent` do of their own builder options
 *   (node_modules/undici/lib/dispatcher/pool.js:56-67), and the builder's own default is to allow it - so a connector that stayed silent would quietly widen the
 *   ALPN offer.
 * - `verifyTls` is the certificate-verification flag. Every caller here leaves it off by default, because a UniFi Access controller presents a self-signed
 *   certificate that no verification chain accepts.
 */
export interface OwnedConnectorOptions {

  allowH2: boolean;
  verifyTls: boolean;
}

/**
 * A connector that holds every socket it vends, and the two operations that let go of them.
 *
 * - `connect` is the connector to hand undici - a `Pool`'s or an `Agent`'s `connect` option.
 * - `cutDials(reason)` destroys every socket still connecting, with an error: `reason` itself when it is an `Error` (every `DOMException` is one), and otherwise a
 *   fresh `RequestAbortedError`, which is undici's own class for a signal aborted without a reason and what undici rejects a live-socket request with in that
 *   case. Destroying with an error is what makes undici's pending request reject with that very object - a socket destroyed with no error emits nothing the
 *   connector listens for, and the request would hang until undici's own connect timer. Sockets that have finished connecting are left alone.
 * - `lastDialFailure` is the error the most recent dial vended: `undefined` before any dial, and `undefined` again after one that succeeded, so it describes the
 *   most recent dial and nothing older. Its reader is the notification stream, whose WebSocket implementation discards the dial's error before the socket's own
 *   error event is built - which leaves this the one place the failure is still readable.
 * - `release()` destroys every socket still held: a connecting one with a fresh `ClientDestroyedError`, so a request cut this way classifies exactly as a pool
 *   reset already does, and an established one with a bare destroy, because nothing is pending on the connector's side of an established socket - a request in
 *   flight on one meets the dispatcher's own destroy instead.
 */
export interface OwnedConnector {

  readonly connect: buildConnector.connector;
  cutDials(reason: unknown): void;
  readonly lastDialFailure: Error | undefined;
  release(): void;
}

/**
 * Build a connector that tracks every socket it vends, from the moment it is vended.
 *
 * A dial is held from the vend rather than from the completed connect because nobody else can reach a socket mid-handshake: undici's client discards the
 * connector's return value and holds nothing of its own until the connect completes, so a socket that is still in its TCP or TLS handshake is reachable through
 * this helper alone. That is the whole reason the helper exists - a cancellation, a deadline, a pool reset, and a teardown all reduce to one operation, cut the
 * dials still in flight, and none of them could reach a connecting socket without it.
 *
 * The two sets are two because the operations differ: a cancellation must end a dial and must never touch a connection some other request is using, so a socket
 * moves out of the dialing set and into the established one the moment its connect completes. Neither operation clears a set itself - a destroyed dial leaves
 * through its own connector callback, and a destroyed established socket leaves through its close handler - which keeps each set the live picture of what is
 * actually held.
 *
 * @param options - Which ALPN offer to make, and whether to verify the peer's certificate.
 *
 * @returns The connector, and the operations that let its sockets go.
 */
export function createOwnedConnector(options: OwnedConnectorOptions): OwnedConnector {

  const dialing = new Set<Socket>();
  const established = new Set<Socket>();
  const dial = buildConnector({ allowH2: options.allowH2, keepAlive: true, rejectUnauthorized: options.verifyTls }) as unknown as DialingConnector;

  let lastDialFailure: Error | undefined;

  return {

    connect: (connectOptions, callback): void => {

      /* The callback fires on a socket event - `connect`, `secureConnect`, or `error` - and never synchronously inside the inner call, so the binding below is
       * assigned by the time it runs. A connect that failed vends its error and no socket, so the success arm is what the established tracking hangs off;
       * reaching for a socket on the failure arm would fault inside undici's own error path, where nothing is left to catch it.
       */
      const socket = dial(connectOptions, (...vended) => {

        const [ error, vendedSocket ] = vended;

        dialing.delete(socket);

        /* Record what this dial vended, for a reader that cannot get at it any other way. Observed on 2026-09-19: undici's WebSocket delivered an empty
         * `TypeError` for every opening-handshake failure - a self-signed peer, a hostname mismatch, and a refused port alike - while this callback received the
         * real error, with its errno, about a millisecond earlier. The record is what carries that error across to the stream's own error handling.
         */
        lastDialFailure = error ?? undefined;

        if(error === null) {

          established.add(vendedSocket);
          vendedSocket.once("close", () => established.delete(vendedSocket));
        }

        callback(...vended);
      });

      dialing.add(socket);
    },

    cutDials: (reason: unknown): void => {

      for(const socket of dialing) {

        socket.destroy((reason instanceof Error) ? reason : new errors.RequestAbortedError());
      }
    },

    get lastDialFailure(): Error | undefined {

      return lastDialFailure;
    },

    release: (): void => {

      for(const socket of dialing) {

        socket.destroy(new errors.ClientDestroyedError());
      }

      for(const socket of established) {

        socket.destroy();
      }
    }
  };
}

/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * ws.ts: The minimal WebSocket interface the realtime events transport consumes, the message-to-text normalizer it decodes every frame through, and the teardown
 * vocabulary its stream ends by - why a teardown ran, the close code that reason carries, and the line a fault is logged with.
 */
import type { AccessError } from "../errors.ts";
import type { ConnectionFaultLevel } from "./connection-fault.ts";
import type { TransportFailure } from "./failure.ts";
import { assertNever } from "../errors.ts";
import { connectionFaultLevel } from "./connection-fault.ts";

/**
 * The minimal *receive-direction* WebSocket surface the realtime events stream consumes - deliberately a small subset of the WHATWG/undici `WebSocket`, so the
 * dependency is exactly what the stream needs and nothing more. undici's `WebSocket` satisfies this structurally, so the default factory assigns to it without a
 * cast.
 *
 * It lives in its own module rather than inside the stream because it is the one definition everything that touches a socket must agree on: the stream that
 * consumes one, the test fake that implements one, and a consumer's own socket supplied through the client's `webSocket` connect option. Writing it once means
 * neither the fake nor a consumer's implementation can drift from what production actually calls.
 *
 * Registration and removal are a matched pair here because the stream detaches its own listeners: it hands back the very function it registered, so an
 * implementation that keys its bookkeeping on listener identity is all the surface needs to be.
 *
 * @category Transport
 */
export interface AccessWebSocket {

  binaryType: "arraybuffer" | "blob";
  addEventListener(type: "open", listener: () => void, options?: AccessWebSocketListenerOptions): void;
  addEventListener(type: "message", listener: (event: AccessWebSocketMessageEvent) => void, options?: AccessWebSocketListenerOptions): void;
  addEventListener(type: "close", listener: (event: AccessWebSocketCloseEvent) => void, options?: AccessWebSocketListenerOptions): void;
  addEventListener(type: "error", listener: (event: AccessWebSocketErrorEvent) => void, options?: AccessWebSocketListenerOptions): void;
  close(): void;
  removeEventListener(type: "open", listener: () => void): void;
  removeEventListener(type: "message", listener: (event: AccessWebSocketMessageEvent) => void): void;
  removeEventListener(type: "close", listener: (event: AccessWebSocketCloseEvent) => void): void;
  removeEventListener(type: "error", listener: (event: AccessWebSocketErrorEvent) => void): void;
}

/**
 * The message event delivered to a `message` listener. The notification protocol is JSON text, so a frame's `data` normally arrives as a string; we accept any
 * shape and normalize it to text before decoding.
 *
 * @category Transport
 */
export interface AccessWebSocketMessageEvent {

  data: unknown;
}

/**
 * The close event delivered to a `close` listener. Mirrors the WebSocket close frame's code and reason.
 *
 * @category Transport
 */
export interface AccessWebSocketCloseEvent {

  code: number;
  reason: string;
}

/**
 * The error event delivered to an `error` listener. `error` carries the underlying cause when the implementation provides one (undici does).
 *
 * @category Transport
 */
export interface AccessWebSocketErrorEvent {

  error?: unknown;
  message?: string;
}

/**
 * The listener-registration options the stream uses - a subset of the standard `addEventListener` options. `once` is the only one it passes, for the events a
 * socket reports a single time. Detaching is the stream's own explicit act through `removeEventListener` rather than an option handed to the registration, so
 * an implementation of this surface owes nothing beyond honoring `once`.
 *
 * @category Transport
 */
export interface AccessWebSocketListenerOptions {

  once?: boolean;
}

/**
 * Normalize a WebSocket message payload to the text the decoder reads.
 *
 * The direction here is the opposite of what a binary protocol would want, and deliberately so: the Access notification wire is JSON text, so a string is the
 * ordinary case and passes straight through untouched. Binary is the defensive case rather than the protocol - the stream still asks for `arraybuffer` framing so
 * that a controller sending a binary frame delivers something readable rather than an opaque Blob, and an `ArrayBuffer` or any view over one decodes here as UTF-8.
 * Anything else the platform might hand us is not something we can read as text, so it normalizes to `null` and the caller skips the frame.
 *
 * @param data - The raw `MessageEvent.data` value.
 *
 * @returns The frame as text, or `null` for a payload that cannot be read as text.
 *
 * @category Transport
 */
export function toText(data: unknown): string | null {

  if(typeof data === "string") {

    return data;
  }

  if(data instanceof ArrayBuffer) {

    return Buffer.from(data).toString("utf8");
  }

  if(ArrayBuffer.isView(data)) {

    return Buffer.from(data.buffer, data.byteOffset, data.byteLength).toString("utf8");
  }

  return null;
}

/**
 * The line a socket's fault is logged with: its level, its sentence, and the structured context it carries. It is built where the fault is classified and
 * written by the teardown once the connection has been released, so the line always follows the release. The context is the fault's structured detail, a socket
 * error's cause as `error` and a stall's silence as `silentForMs`, and never carries a string `reason` member, because a consumer bridging these lines into its
 * own log can lift one into the sentence its user reads.
 *
 * @internal
 */
export interface SocketFaultLine {

  readonly context: Readonly<Record<string, unknown>>;
  readonly level: "error" | "warn";
  readonly message: string;
}

/**
 * Why a socket's teardown runs, carried to it as one argument rather than kept in a field: every caller already knows which it is, and nothing reads it once the
 * teardown has returned. Every arm carries the `reason` text the close is announced with, and what else an arm carries is what its own report needs.
 *
 * - `callerSignal` is the caller's signal cancelling a connect still in flight, which settles the pending handshake as the typed abort rather than a failure.
 * - `close` is a close the stream ran for itself, an explicit close() or a dispose.
 * - `fault` is a failure the stream detected, a socket error or a watchdog stall. It carries the typed error the teardown reports, on the rail when the stream
 *   had opened and on the handshake rejection when it had not, and the line the fault is logged with, or none when it logs nothing.
 * - `peer` is the socket's own close, which the stream did not ask for, carrying the code its close frame arrived with.
 *
 * @internal
 */
export type SocketTeardown = { readonly kind: "callerSignal"; readonly reason: string } | { readonly kind: "close"; readonly reason: string } |
  { readonly error: AccessError; readonly kind: "fault"; readonly line: SocketFaultLine | null; readonly reason: string } |
  { readonly code: number; readonly kind: "peer"; readonly reason: string };

/**
 * The close code a teardown is announced with, derived from why it ran so the code and the reason can never disagree. A close the stream chose, its own or the
 * caller's cancel of a connect, is 1000, the normal closure; a fault is 1006, the code RFC 6455 designates for a connection that closed abnormally; and a peer's
 * close carries the code its own frame arrived with.
 *
 * @param why - Why the teardown ran.
 *
 * @returns The close code the teardown's `closed` event and its diagnostic carry.
 *
 * @internal
 */
export function teardownCode(why: SocketTeardown): number {

  switch(why.kind) {

    case "callerSignal":
    case "close":

      return 1000;

    case "fault":

      return 1006;

    case "peer":

      return why.code;

    default:

      // Exhaustiveness guard. A new arm joining the union without a case above stops `why` being `never` here, and this fails to compile.
      return assertNever(why);
  }
}

/**
 * The close frame in the words an error message carries it in: always the code, and what the peer said when the frame said anything at all. The frame travels in
 * the message rather than on the cause chain because the chain renderer skips a cause that is not an Error, so a reason hung off one is invisible in every
 * rendered failure a consumer logs...and the frame is the whole account a controller that went away leaves behind.
 *
 * @param code   - The close frame's code.
 * @param reason - What the close frame said, empty when it said nothing.
 *
 * @returns The frame as an error message quotes it.
 *
 * @internal
 */
export function closeFrameText(code: number, reason: string): string {

  const frame = "close code " + code.toString();

  if(reason.length === 0) {

    return frame;
  }

  return frame + ": " + reason;
}

// The level a socket's fault line is written at for each connection-fault level, and none for a fault that ends an open connection the way one ordinarily ends.
// Keyed by the whole level union, so a level joining it without an entry here fails to compile.
const FAULT_LINE_LEVELS: Readonly<Record<ConnectionFaultLevel, SocketFaultLine["level"] | null>> = { error: "error", quiet: null, warning: "warn" };

/**
 * The fault arm a socket error tears its stream down with: the typed error the stream built from its own state, the reason the close is announced with, and the
 * line the fault is logged with. It logs nothing itself, because the teardown writes the line once the connection has been released.
 *
 * The line belongs to a stream that had opened, and logs at the level the connection-fault table answers for an open connection: a reset or a network out of
 * reach is a warning, a certificate verdict or a host name that does not resolve is an error, and a hang-up with no close frame or a timeout is how an open
 * connection ordinarily ends, which logs nothing. A failure before the open reaches its caller through the handshake rejection and logs nothing, because the
 * coordinator reports it from there and a line as well would put one failure in the log twice. The cause is the line's context, so the line and the typed error
 * always name the same fault.
 *
 * @param options          - The fault as the stream read and classified it.
 * @param options.cause    - The raw failure the stream read: its connector's record of the dial, then of the established connection, then the event's own error.
 * @param options.error    - The typed error the stream built from the classified failure, which the teardown reports.
 * @param options.failure  - The cause as the transport failure classifier sorted it, which the line's level is read from.
 * @param options.open     - Whether the stream had opened, which is what lets the line log at all.
 * @param options.reason   - The text the close is announced with.
 * @param options.reported - The sentence the line reports the fault in.
 *
 * @returns The fault arm, carrying its line or none.
 *
 * @internal
 */
export function socketFault({ cause, error, failure, open, reason, reported }: { readonly cause: unknown; readonly error: AccessError;
  readonly failure: TransportFailure; readonly open: boolean; readonly reason: string; readonly reported: string; }): Extract<SocketTeardown, { kind: "fault" }> {

  const level = open ? FAULT_LINE_LEVELS[connectionFaultLevel(failure, { open: true })] : null;

  return { error, kind: "fault", line: (level === null) ? null : { context: { error: cause }, level, message: reported }, reason };
}

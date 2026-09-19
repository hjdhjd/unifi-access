/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * ws.ts: The minimal WebSocket interface the realtime events transport consumes, plus the message-to-text normalizer it decodes every frame through.
 */

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

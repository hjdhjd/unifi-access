/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * events-stream.test.ts: Tests for EventStream - the single decode site, the guard order the wire protocol dictates, the three-rail fan-out, decode-failure
 * resilience, the silence watchdog, and teardown. Driven through an injected fake WebSocket and a fake Clock, so the realtime stream is exercised
 * deterministically without a live controller.
 *
 * The frames these tests feed are text, because the Access notification wire is JSON text. That is the detail a port of a binary-protocol stream gets wrong
 * silently - a normalizer written for bytes discards every string frame and the stream simply goes quiet - so the ordinary decode cases here drive strings.
 */
import { AccessAbortedError, AccessCertificateError, AccessNetworkError, AccessProtocolError, AccessStallError, formatErrorChain } from "../errors.ts";
import type { AccessEventsClosedPayload, AccessEventsPacketPayload } from "../diagnostics.ts";
import { DIAL_CUT_BOUND_MS, createSilentLoopback, elapsedSince, listenOnLoopback, stopListening } from "./loopback.helpers.ts";
import { EventStream, HEARTBEAT_FRAME } from "./events-stream.ts";
import { FakeWebSocket, createLoopbackServer } from "./events-stream.helpers.ts";
import { TestClock, assertNoUnhandledRejections, capturingLog, settle, silentLog, waitUntil } from "homebridge-plugin-utils/testing";
import { describe, test } from "node:test";
import { settleUntil, subscribeTo } from "../testing.helpers.ts";
import { ACCESS_EVENTS_HEARTBEAT_TIMEOUT } from "../settings.ts";
import type { AccessEventPacket } from "../types/index.ts";
import type { AccessLogging } from "../logging.ts";
import type { AccessWebSocket } from "./ws.ts";
import type { AccessWireEvent } from "../protocol/events.ts";
import type { EventStreamEvents } from "./events-stream.ts";
import assert from "node:assert/strict";
import { channels } from "../diagnostics.ts";
import { createServer as createTcpServer } from "node:net";
import { findPacket } from "../protocol/capture.helpers.ts";

const HOST = "10.0.0.1";

// Serialize a packet the way the controller puts it on the wire: one JSON text frame.
function frame(packet: AccessEventPacket): string {

  return JSON.stringify(packet);
}

// Construct an open stream over a fake socket, returning the stream, the socket, and the clock. The socket does not auto-open, so each test controls the
// handshake.
async function openStream(options: { clock?: TestClock; log?: AccessLogging } = {}): Promise<{ clock: TestClock; stream: EventStream; ws: FakeWebSocket }> {

  const clock = options.clock ?? new TestClock();
  const log = options.log ?? silentLog();
  const ws = new FakeWebSocket({ autoOpen: false });
  const stream = new EventStream({ clock, host: HOST, log, webSocket: () => ws });

  ws.emitOpen();
  await stream.opened;

  return { clock, stream, ws };
}

// Collect every emission of a rail into an array, for synchronous assertions after driving the socket.
function collect<K extends keyof EventStreamEvents>(stream: EventStream, event: K): EventStreamEvents[K][] {

  const received: EventStreamEvents[K][] = [];

  stream.on(event, (...args) => received.push(args));

  return received;
}

// Record which of the fault rail and the lifecycle rail delivered first, for rows that assert the order a teardown announces them in. Separate collectors say how
// many entries each rail carried and nothing about how they interleaved, so the rail names go into one array in delivery order.
function railOrder(stream: EventStream): ("closed" | "error")[] {

  const order: ("closed" | "error")[] = [];

  stream.on("error", () => order.push("error"));
  stream.on("closed", () => order.push("closed"));

  return order;
}

// The loopback peer's address in the host:port form the stream builds its notification URL from. The port is whatever the operating system handed the server, so
// it is only knowable once it is listening.
function loopbackHost(port: number): string {

  return "127.0.0.1:" + port.toString();
}

// A loopback port nothing is listening on, obtained by binding one and letting it go: the kernel hands out a free port, and releasing it leaves an address that
// refuses at once rather than one a firewall might silently drop.
async function vacantPort(): Promise<number> {

  const server = createTcpServer();
  const port = await listenOnLoopback(server);

  await stopListening(server);

  return port;
}

// What a captured upgrade reports: the address the socket factory was given, the headers it was given alongside it, and the stream those built - which the caller
// closes, since nothing here opens the socket.
interface CapturedUpgrade {

  headers: Record<string, string>;
  stream: EventStream;
  url: string;
}

/* Construct a stream over a fake socket and report the URL and the headers the upgrade was built with.
 *
 * The socket factory is what makes those observable at all: it receives exactly what undici would have been handed, so a test reads the connection's real address
 * and its real header set rather than inferring them. The socket does not auto-open, and each caller closes the stream it gets back. Options are forwarded only
 * when supplied, so a test of the omitted case really does omit the option rather than passing it as undefined.
 */
function upgradeOf(options: { endpoint?: string; getAuthHeaders?: () => Record<string, string> } = {}): CapturedUpgrade {

  let captured: { headers: Record<string, string>; url: string } = { headers: {}, url: "" };
  const ws = new FakeWebSocket({ autoOpen: false });
  const stream = new EventStream({

    host: HOST,
    log: silentLog(),
    ...((options.endpoint !== undefined) && { endpoint: options.endpoint }),
    ...((options.getAuthHeaders !== undefined) && { getAuthHeaders: options.getAuthHeaders }),
    webSocket: (target, headers) => {

      captured = { headers, url: target };

      return ws;
    }
  });

  return { ...captured, stream };
}

// Return the first collected emission, asserting at least one exists. Keeps the index access total under noUncheckedIndexedAccess while reading as an assertion.
function first<T>(items: T[]): T {

  const [head] = items;

  assert.ok(head !== undefined, "expected at least one emission");

  return head;
}

describe("EventStream", () => {

  describe("connection handshake", () => {

    test("builds the notification URL with no query string", async () => {

      let capturedUrl = "";
      const ws = new FakeWebSocket({ autoOpen: false });

      await using stream = new EventStream({ host: HOST, log: silentLog(), webSocket: (target) => {

        capturedUrl = target;

        return ws;
      } });

      // The controller offers no replay mechanism, so there is no cursor to carry and the endpoint takes no parameters at all.
      assert.equal(capturedUrl, "wss://" + HOST + "/proxy/access/api/v2/ws/notification");
      assert.equal(capturedUrl.includes("?"), false, "the notification endpoint takes no query string");
    });

    test("connect() resolves once the socket opens", async () => {

      const ws = new FakeWebSocket();

      await using stream = await EventStream.connect({ host: HOST, log: silentLog(), webSocket: () => ws });

      assert.ok(stream instanceof EventStream, "connect() resolves to the stream");
    });

    test("opened rejects with an AccessNetworkError when the socket closes before opening", async () => {

      const ws = new FakeWebSocket({ autoOpen: false });

      await using stream = new EventStream({ host: HOST, log: silentLog(), webSocket: () => ws });
      const errors = collect(stream, "error");
      const closed = collect(stream, "closed");

      ws.emitClose(1006, "handshake failed");

      await assert.rejects(stream.opened, AccessNetworkError);

      // A peer close before the open reports on the handshake rejection alone, so it starts no recovery...and the lifecycle end is still announced, once, whatever
      // stage the connection had reached.
      assert.equal(errors.length, 0, "a peer close before the open stays off the error rail");
      assert.equal(closed.length, 1);

      /* What the wire said about the close travels in the message rather than on the cause chain. The renderer skips a cause that is not an Error, so a reason
       * hung off one is invisible in everything a consumer logs, and the frame is the only account of why a controller went away.
       */
      const rendered = formatErrorChain(await stream.opened.catch((error: unknown) => error));

      assert.ok(rendered.includes("1006"), "the rendered failure names the close code");
      assert.ok(rendered.includes("handshake failed"), "the rendered failure names what the peer said");
    });

    test("an already-aborted caller signal tears the stream down before it opens", async () => {

      const ws = new FakeWebSocket({ autoOpen: false });
      const controller = new AbortController();

      controller.abort();

      const stream = new EventStream({ host: HOST, log: silentLog(), signal: controller.signal, webSocket: () => ws });

      await assert.rejects(stream.opened, AccessAbortedError);
      assert.equal(ws.closeRequested, true);
    });

    test("aborting the caller signal after construction but before open rejects opened", async () => {

      const ws = new FakeWebSocket({ autoOpen: false });
      const controller = new AbortController();
      const stream = new EventStream({ host: HOST, log: silentLog(), signal: controller.signal, webSocket: () => ws });

      controller.abort();

      await assert.rejects(stream.opened, AccessAbortedError);
    });

    test("a stream nobody awaits does not leak an unhandled rejection when it fails to open", async () => {

      // The consumer here subscribes to the error rail and never touches `opened`, which is the shape that would otherwise raise a process-level warning when the
      // handshake promise rejects with nobody attached to it.
      await assertNoUnhandledRejections(async () => {

        const ws = new FakeWebSocket({ autoOpen: false });
        const stream = new EventStream({ host: HOST, log: silentLog(), webSocket: () => ws });
        const errors = collect(stream, "error");

        ws.emitClose(1006, "handshake failed");

        await stream.close();

        assert.equal(errors.length, 0, "a pre-open close reports through the open handshake rather than the error rail");
      });
    });
  });

  /* What the upgrade request is addressed to and what it carries. These matter beyond the stream itself: the header set is what the controller authenticates the
   * connection on, and the header names are the bytes on the wire, so a change here is a change to how every connection presents itself.
   */
  describe("the upgrade's address and credentials", () => {

    test("carries the session cookie and nothing else when a cookie closure is wired", async () => {

      const upgrade = upgradeOf({ getAuthHeaders: () => ({ Cookie: "TOKEN=abcdef" }) });

      await using stream = upgrade.stream;

      /* An exact comparison rather than a membership check, and that is the point of it. The obvious thing to wire here is the authenticated session's full header
       * set, which also carries the CSRF token - and doing so would quietly add a header to every notification connection the controller never asked for. Only an
       * exact comparison catches that.
       */
      assert.deepEqual(upgrade.headers, { Cookie: "TOKEN=abcdef" });
      assert.equal(Object.keys(upgrade.headers).length, 1);
    });

    test("carries the cookie header with an empty value when there is no session yet", async () => {

      // Absence and emptiness are different on the wire. A connect made before login completes still presents the header, so the controller sees a request with an
      // empty session rather than one that never mentioned a session at all.
      const upgrade = upgradeOf({ getAuthHeaders: () => ({ Cookie: "" }) });

      await using stream = upgrade.stream;

      assert.deepEqual(upgrade.headers, { Cookie: "" });
    });

    test("still carries the cookie header when no closure is supplied at all", async () => {

      // Construction with no session wired is not a construction that drops the header: the upgrade is defined by what it presents, and an omitted option is the
      // same situation as a session with nothing in it yet.
      const upgrade = upgradeOf();

      await using stream = upgrade.stream;

      assert.deepEqual(upgrade.headers, { Cookie: "" });
    });

    test("carries bearer credentials when a token closure is wired", async () => {

      // The official notification socket authenticates on a bearer token rather than a cookie. One closure serves both, so the stream itself knows nothing about
      // which identity it is carrying.
      const upgrade = upgradeOf({ getAuthHeaders: () => ({ authorization: "Bearer a-token" }) });

      await using stream = upgrade.stream;

      assert.deepEqual(upgrade.headers, { authorization: "Bearer a-token" });
    });

    test("addresses the derived notification URL when no endpoint is supplied", async () => {

      const upgrade = upgradeOf();

      await using stream = upgrade.stream;

      assert.equal(upgrade.url, "wss://" + HOST + "/proxy/access/api/v2/ws/notification");
    });

    test("addresses the supplied endpoint instead when one is supplied", async () => {

      // An endpoint override replaces the whole URL rather than adjusting the derived one, because the socket it names differs in port and path alike.
      const endpoint = "wss://10.0.0.1:12445/api/v1/developer/devices/notifications";
      const upgrade = upgradeOf({ endpoint });

      await using stream = upgrade.stream;

      assert.equal(upgrade.url, endpoint);
    });

    test("keeps the host as its own identity even when the endpoint names a different address", async () => {

      // The override addresses the same controller on a different port, so the host stays what this stream reports itself as - in its logs and on the close
      // channel - rather than being re-derived from a URL carrying a port the rest of the library does not address the controller by.
      const payloads: AccessEventsClosedPayload[] = [];
      const upgrade = upgradeOf({ endpoint: "wss://10.0.0.1:12445/api/v1/developer/devices/notifications" });

      using closedSub = subscribeTo(channels.eventsClosed, (message) => void payloads.push(message));

      await upgrade.stream.close();

      assert.equal(first(payloads).host, HOST);
    });
  });

  describe("decode and fan-out", () => {

    test("a JSON text frame is parsed, classified, and emitted on both the packet and raw rails", async () => {

      const opened = await openStream();

      await using stream = opened.stream;
      const { ws } = opened;
      const packets = collect(stream, "packet");
      const raw = collect(stream, "rawPacket");
      const packet = findPacket((entry) => (entry.event === "access.data.device.update") && (entry.event_object_id === "aabbcc000002"), "the legacy reader update");

      ws.emitMessage(frame(packet));

      assert.equal(packets.length, 1);
      assert.equal(raw.length, 1);

      const [event] = first(packets);

      assert.equal(event.kind, "deviceChanged");
      assert.equal((event as { id: string }).id, "aabbcc000002");
    });

    test("an activity notification is classified to its typed event", async () => {

      const opened = await openStream();

      await using stream = opened.stream;
      const { ws } = opened;
      const packets = collect(stream, "packet");
      const packet = findPacket((entry) => entry.event === "access.data.device.remote_unlock", "the historical remote unlock specimen");

      ws.emitMessage(frame(packet));

      assert.equal(packets.length, 1);
      assert.equal(first(packets)[0].kind, "unlock");
    });

    test("every well-formed frame reaches the raw rail, including the ones the classifier declines", async () => {

      const opened = await openStream();

      await using stream = opened.stream;
      const { ws } = opened;
      const packets = collect(stream, "packet");
      const raw = collect(stream, "rawPacket");
      const modeled = findPacket((entry) => entry.event === "access.data.device.update", "a legacy device update");
      const unmodeled = findPacket((entry) => entry.event === "access.data.camera.update", "an unmodeled notification");

      ws.emitMessage(frame(modeled));
      ws.emitMessage(frame(unmodeled));

      // The typed rail saw only the modeled frame; the raw rail saw both, which is what makes it the complete record.
      assert.equal(packets.length, 1);
      assert.equal(raw.length, 2);
      assert.equal(first(raw)[0].event, "access.data.device.update");
      assert.equal(raw[1]?.[0].event, "access.data.camera.update");
    });

    test("the raw rail carries the payload fields the classifier's translation drops", async () => {

      const opened = await openStream();

      await using stream = opened.stream;
      const { ws } = opened;
      const packets = collect(stream, "packet");
      const raw = collect(stream, "rawPacket");

      // A newer-dialect device update whose payload carries fields the translation allowlist deliberately excludes. The raw rail is the only place a consumer can
      // still see them, so it must deliver the payload verbatim rather than a re-serialization of what survived translation.
      const packet = findPacket((entry) => (entry.event === "access.data.v2.device.update") && (entry.meta?.id === "aabbcc000002"),
        "the v2 reader update carrying the excluded payload fields");

      ws.emitMessage(frame(packet));

      const rawData = first(raw)[0].data ?? {};

      assert.equal(rawData["name"], "Test Name 68");
      assert.equal(rawData["cap"], null);
      assert.ok(Array.isArray(rawData["settings"]), "the reduced settings projection reaches consumers on the raw rail");
      assert.notEqual(rawData["access_method"], undefined);
      assert.notEqual(rawData["direction"], undefined);

      // The same fields are absent from the classified payload, which is what makes the raw rail the one carrier for them.
      const [event] = first(packets);

      assert.equal(event.kind, "deviceChanged");
      assert.equal(Object.hasOwn((event as { payload: object }).payload, "name"), false);
      assert.equal(Object.hasOwn((event as { payload: object }).payload, "settings"), false);
    });

    test("a binary frame delivered as an ArrayBuffer is decoded as UTF-8 text", async () => {

      const opened = await openStream();

      await using stream = opened.stream;
      const { ws } = opened;
      const packets = collect(stream, "packet");
      const packet = findPacket((entry) => entry.event === "access.data.device.update", "a legacy device update");
      const bytes = Buffer.from(frame(packet), "utf8");

      // Binary is the defensive case rather than the protocol, but the stream asks for arraybuffer framing so that a frame arriving as bytes is still readable.
      ws.emitMessage(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));

      assert.equal(packets.length, 1);
      assert.equal(first(packets)[0].kind, "deviceChanged");
    });

    test("a binary frame delivered as a byte view is decoded as UTF-8 text", async () => {

      const opened = await openStream();

      await using stream = opened.stream;
      const { ws } = opened;
      const packets = collect(stream, "packet");
      const packet = findPacket((entry) => entry.event === "access.data.device.update", "a legacy device update");

      // A Buffer is a Uint8Array view over a shared allocation, and a pooled one starts at a non-zero byteOffset, which is what the view arm's offset arithmetic
      // is there to honor: reading the whole underlying buffer would hand the decoder somebody else's bytes alongside this frame's.
      ws.emitMessage(Buffer.from(frame(packet), "utf8"));

      assert.equal(packets.length, 1);
      assert.equal(first(packets)[0].kind, "deviceChanged");
    });

    test("the stream() rail delivers packets and rejects on abort", async () => {

      const opened = await openStream();

      await using stream = opened.stream;
      const { ws } = opened;
      const controller = new AbortController();
      const collected: AccessWireEvent[] = [];
      const packet = findPacket((entry) => entry.event === "access.data.device.update", "a legacy device update");
      const task = (async (): Promise<void> => {

        for await (const [event] of stream.stream("packet", { signal: controller.signal })) {

          collected.push(event);
        }
      })();

      ws.emitMessage(frame(packet));
      await settleUntil(() => collected.length === 1);

      controller.abort();

      // The raw stream rail rejects on abort (node:events' contract) - unlike the packets() sugar, which returns cleanly.
      await assert.rejects(task);
      assert.equal(collected.length, 1);
    });

    test("once() resolves with the next packet's tuple", async () => {

      const opened = await openStream();

      await using stream = opened.stream;
      const { ws } = opened;
      const pending = stream.once("packet");
      const packet = findPacket((entry) => entry.event === "access.data.device.update", "a legacy device update");

      ws.emitMessage(frame(packet));

      const [event] = await pending;

      assert.equal(event.kind, "deviceChanged");
    });

    test("packets() yields typed events and terminates on abort", async () => {

      const opened = await openStream();

      await using stream = opened.stream;
      const { ws } = opened;
      const controller = new AbortController();
      const collected: AccessWireEvent[] = [];
      const packet = findPacket((entry) => entry.event === "access.data.device.update", "a legacy device update");
      const task = (async (): Promise<void> => {

        for await (const event of stream.packets({ signal: controller.signal })) {

          collected.push(event);
        }
      })();

      ws.emitMessage(frame(packet));
      await settleUntil(() => collected.length === 1);

      controller.abort();
      await task;

      assert.equal(collected.length, 1);
      assert.equal(collected[0]?.kind, "deviceChanged");
    });

    test("packets() rethrows a failure that is not the caller's abort", async () => {

      const { stream, ws } = await openStream();
      const packet = findPacket((entry) => entry.event === "access.data.device.update", "a legacy device update");
      const iterator = stream.packets();
      const pending = iterator.next();

      ws.emitMessage(frame(packet));
      await pending;

      /* The generator is resting at its yield, so the throw lands inside its own try. The catch finds no aborted signal - this consumer passed none at all - so
       * the rethrow is what rejects the call, which is the arm that separates a consumer's abort from a genuine failure. The close is in a finally because a
       * failing assertion that skipped it would leave the notification stream holding the event loop, and the file would run to the runner's ceiling rather
       * than failing fast.
       */
      try {

        await assert.rejects(iterator.throw(new Error("injected")), { message: "injected" });
      } finally {

        await stream.close();
      }
    });
  });

  describe("the heartbeat and the frames that carry nothing", () => {

    test("the heartbeat proves liveness and reaches no rail at all", async () => {

      const clock = new TestClock();
      const opened = await openStream({ clock });

      await using stream = opened.stream;
      const { ws } = opened;
      const packets = collect(stream, "packet");
      const raw = collect(stream, "rawPacket");
      const errors = collect(stream, "error");

      clock.advance(5000);

      // The literal is imported rather than restated, so the guard and the test cannot drift apart. It is valid JSON - it would parse to the string "Hello" - so
      // being consumed before the parse is what keeps it off the rails rather than turning it into a protocol error every five seconds.
      ws.emitMessage(HEARTBEAT_FRAME);

      assert.equal(packets.length, 0);
      assert.equal(raw.length, 0);
      assert.equal(errors.length, 0);
      assert.equal(stream.lastMessageAt, 5000, "the heartbeat still stamps liveness, which is its entire purpose");
    });

    test("an empty frame is absorbed in silence", async () => {

      const clock = new TestClock();
      const log = capturingLog();
      const opened = await openStream({ clock, log });

      await using stream = opened.stream;
      const { ws } = opened;
      const packets = collect(stream, "packet");
      const raw = collect(stream, "rawPacket");
      const errors = collect(stream, "error");

      clock.advance(1000);

      // The read starts past the connect line, so everything counted after the frame is attributable to the frame alone.
      const connectLines = log.entries.length;

      ws.emitMessage("");

      // Parsing an empty frame would raise a protocol error for something the controller legitimately sends, so the guard sits ahead of the parse.
      assert.equal(packets.length, 0);
      assert.equal(raw.length, 0);
      assert.equal(errors.length, 0);
      assert.equal(log.entries.length, connectLines, "an empty frame is not worth reporting at any level");
      assert.equal(stream.lastMessageAt, 1000);
    });

    test("a frame that cannot be read as text is skipped without emitting", async () => {

      const opened = await openStream();

      await using stream = opened.stream;
      const { ws } = opened;
      const packets = collect(stream, "packet");
      const errors = collect(stream, "error");

      // A Blob-like object is the one category the normalizer cannot turn into text, so the caller skips it rather than tearing the connection down over it.
      ws.emitMessage({ size: 3, type: "text/plain" });

      assert.equal(packets.length, 0);
      assert.equal(errors.length, 0);
    });
  });

  describe("decode failure resilience", () => {

    test("a frame that is not JSON surfaces a typed error and the stream stays open", async () => {

      const clock = new TestClock();
      const opened = await openStream({ clock });

      await using stream = opened.stream;
      const { ws } = opened;
      const errors = collect(stream, "error");
      const packets = collect(stream, "packet");
      const raw = collect(stream, "rawPacket");
      const packet = findPacket((entry) => entry.event === "access.data.device.update", "a legacy device update");

      clock.advance(4321);
      ws.emitMessage("{not json");

      assert.equal(errors.length, 1);
      assert.ok(first(errors)[0] instanceof AccessProtocolError, "an unparseable frame surfaces as a protocol error");
      assert.equal(raw.length, 0, "nothing reached the raw rail, because nothing parsed");

      // Liveness comes from any frame at all, so a frame we could not read still proves the channel is carrying traffic. This is the path where that claim has
      // nothing else to stand on - no rail emission accompanies it.
      assert.equal(stream.lastMessageAt, 4321);

      // A subsequent good frame still flows - one bad frame does not desync the channel, because WebSocket frames are independently delimited.
      ws.emitMessage(frame(packet));
      assert.equal(packets.length, 1);
    });

    test("valid JSON that is not a notification reaches only the error rail", async () => {

      const clock = new TestClock();
      const opened = await openStream({ clock });

      await using stream = opened.stream;
      const { ws } = opened;
      const errors = collect(stream, "error");
      const packets = collect(stream, "packet");
      const raw = collect(stream, "rawPacket");

      clock.advance(9876);

      /* Both frames parse cleanly and neither is a notification. Asserting the envelope onto them rather than checking it would publish the first under an
       * identifier that is undefined while typed as a string, which is exactly the failure the check exists to prevent.
       */
      ws.emitMessage(JSON.stringify({ "data": null, "event": "access.data.device.update", "receiver_id": "", "save_to_history": false }));
      ws.emitMessage(JSON.stringify([ 1, 2, 3 ]));

      assert.equal(errors.length, 2);
      assert.ok(first(errors)[0] instanceof AccessProtocolError, "a frame without the notification envelope surfaces as a protocol error");
      assert.ok(errors[1]?.[0] instanceof AccessProtocolError, "and so does a frame that is not an object at all");
      assert.equal(packets.length, 0);
      assert.equal(raw.length, 0, "an unshaped value must not reach the raw rail either, which is typed as a notification");

      // Both frames were rejected, yet both still stamped liveness - a channel sending us things we decline is a channel that is very much alive, and nothing else
      // on this path records that it delivered anything.
      assert.equal(stream.lastMessageAt, 9876);
    });

    test("a decode failure does not terminate an open packets() iterator", async () => {

      const opened = await openStream();

      await using stream = opened.stream;
      const { ws } = opened;
      const controller = new AbortController();
      const collected: AccessWireEvent[] = [];
      const packet = findPacket((entry) => entry.event === "access.data.device.update", "a legacy device update");
      const task = (async (): Promise<void> => {

        for await (const event of stream.packets({ signal: controller.signal })) {

          collected.push(event);
        }
      })();

      ws.emitMessage("{not json");
      ws.emitMessage(frame(packet));
      await settleUntil(() => collected.length === 1);

      controller.abort();
      await task;

      assert.equal(collected.length, 1);
    });

    test("a socket error surfaces a typed error and closes the stream", async () => {

      const opened = await openStream();

      await using stream = opened.stream;
      const { ws } = opened;
      const errors = collect(stream, "error");
      const closed = collect(stream, "closed");
      const order = railOrder(stream);

      ws.emitError(new Error("socket reset"));

      assert.ok(errors[0]?.[0] instanceof AccessNetworkError, "a socket error surfaces as a network error");

      // The teardown the error triggers is the stream's own, so the close it runs adds nothing to the rail beside the error that started it.
      assert.equal(errors.length, 1, "a socket error puts one error on the rail and nothing beside it");
      assert.equal(closed.length, 1);
      assert.equal(ws.closeRequested, true);

      // A consumer that acts on the fault reads a stream whose lifecycle end has not been announced yet, which is what makes the fault the first thing it hears.
      assert.deepEqual(order, [ "error", "closed" ], "the fault reaches the rail ahead of the lifecycle end");
    });

    test("a socket error before the open reaches the caller on the handshake rejection alone", async () => {

      const ws = new FakeWebSocket({ autoOpen: false });
      const stream = new EventStream({ host: HOST, log: silentLog(), webSocket: () => ws });
      const errors = collect(stream, "error");
      const closed = collect(stream, "closed");
      const planted = new Error("connection refused");

      /* A socket that fails before it ever opens reports to whoever is waiting on the open, exactly as a peer close at the same stage does. The rail is where a
       * stream that opened announces what it did not ask for, and a stream still connecting has no consumer acting on it to tell.
       */
      ws.emitError(planted);

      assert.equal(errors.length, 0, "a socket error before the open stays off the error rail");
      assert.equal(closed.length, 1);

      const failure = await stream.opened.catch((error: unknown) => error);

      // The rejection is the fault itself rather than a generic pre-open failure, so the type says what happened and the socket's own error is still underneath it.
      assert.ok(failure instanceof AccessNetworkError, "a socket error surfaces as a network error whether or not the socket had opened");
      assert.equal(failure.cause, planted, "the rejection carries the socket's own error as its cause");
    });

    test("a socket error whose listener throws still leaves the socket asked to close", async () => {

      const opened = await openStream();

      await using stream = opened.stream;
      const { ws } = opened;

      stream.on("error", () => {

        throw new Error("the error listener refused the fault");
      });

      // The fake dispatches to its listeners the way the platform's socket does, so a listener's throw comes back out of the emit that raised it.
      assert.throws(() => ws.emitError(new Error("socket reset")), { message: "the error listener refused the fault" });

      /* The teardown has run to completion before the fault is announced, so a listener that refuses it cannot leave the socket unasked or the close unresolved.
       * Nothing is asserted about the closed rail: a listener's throw skips the emits behind it by the bus's contract, which is a separate subject.
       */
      assert.equal(ws.closeRequested, true);

      await stream.close();
    });

    test("an expected-disconnect socket error is not logged at error level", async () => {

      const log = capturingLog();
      const opened = await openStream({ log });

      await using stream = opened.stream;
      const { ws } = opened;

      // undici raises a TypeError from its own WebSocket teardown when a socket closes mid-frame. It is the ordinary shape of a disconnection rather than a fault
      // a consumer can act on, so it still reaches the error rail but must not be reported as an error in the log.
      ws.emitError(new TypeError("terminated"));

      assert.equal(log.entries.some((entry) => entry.level === "error"), false);
    });
  });

  describe("diagnostics channels", () => {

    test("publishes the packet payload on both arms of the notification vocabulary", async () => {

      const opened = await openStream();

      await using stream = opened.stream;
      const { ws } = opened;
      const payloads: AccessEventsPacketPayload[] = [];
      const deviceUpdate = findPacket((entry) => (entry.event === "access.data.device.update") && (entry.event_object_id === "aabbcc000002"),
        "the legacy reader update");
      const ringCancel = findPacket((entry) => entry.event === "access.remote_view.change", "a historical ring cancellation specimen");

      using packetSub = subscribeTo(channels.eventsPacket, (message) => void payloads.push(message));

      ws.emitMessage(frame(deviceUpdate));
      ws.emitMessage(frame(ringCancel));

      // A notification that names an entity carries its identifier; a ring cancellation identifies the call rather than a device, so the payload does not invent
      // one for it.
      assert.deepEqual(payloads[0], { eventName: "access.data.device.update", host: HOST, id: "aabbcc000002", kind: "deviceChanged" });
      assert.deepEqual(payloads[1], { eventName: "access.remote_view.change", host: HOST, kind: "doorbellCancel" });
    });

    test("publishes a door-state report on the identifier-free arm", async () => {

      const opened = await openStream();

      await using stream = opened.stream;
      const { ws } = opened;
      const payloads: AccessEventsPacketPayload[] = [];

      // A door-state report names each of the doors it carries rather than one subject, so it goes through the same identifier-free arm the ring cancellation does.
      const doorState = findPacket((entry) => (entry.event === "access.data.v2.location.update") && (entry.data?.["state"] !== undefined),
        "a v2 location update carrying door state");

      using packetSub = subscribeTo(channels.eventsPacket, (message) => void payloads.push(message));

      ws.emitMessage(frame(doorState));

      assert.deepEqual(payloads[0], { eventName: "access.data.v2.location.update", host: HOST, kind: "doorStateChanged" });
    });

    test("publishes nothing on the packet channel for a notification the library does not model", async () => {

      const opened = await openStream();

      await using stream = opened.stream;
      const { ws } = opened;
      const payloads: AccessEventsPacketPayload[] = [];
      const unmodeled = findPacket((entry) => entry.event === "access.data.camera.update", "an unmodeled notification");

      using packetSub = subscribeTo(channels.eventsPacket, (message) => void payloads.push(message));

      ws.emitMessage(frame(unmodeled));

      assert.equal(payloads.length, 0, "the channel measures modeled activity rather than raw wire volume");
    });

    test("publishes the close payload with the controller host", async () => {

      const opened = await openStream();

      await using stream = opened.stream;
      const { ws } = opened;
      const payloads: AccessEventsClosedPayload[] = [];

      using closedSub = subscribeTo(channels.eventsClosed, (message) => void payloads.push(message));

      ws.emitClose(1000, "going away");

      assert.deepEqual(payloads, [{ code: 1000, host: HOST, reason: "going away" }]);
    });
  });

  describe("silence watchdog", () => {

    test("a channel silent beyond the threshold emits AccessStallError and tears down", async () => {

      const clock = new TestClock();
      const { stream, ws } = await openStream({ clock });
      const errors = collect(stream, "error");
      const closed = collect(stream, "closed");
      const order = railOrder(stream);

      // No frames arrive; advance to the watchdog's deadline and let it wake.
      clock.advance(ACCESS_EVENTS_HEARTBEAT_TIMEOUT);
      await settle();

      assert.equal(errors.length, 1);

      const [stallError] = first(errors);

      assert.ok(stallError instanceof AccessStallError, "a silent socket surfaces as a stall error");
      assert.equal(stallError.silentForMs, ACCESS_EVENTS_HEARTBEAT_TIMEOUT);
      assert.equal(closed.length, 1);
      assert.equal(ws.closeRequested, true);

      // The stall is what the coordinator acts on, so it arrives ahead of the lifecycle end the same way a socket error's fault does.
      assert.deepEqual(order, [ "error", "closed" ], "the stall reaches the rail ahead of the lifecycle end");
    });

    test("the watchdog does not trip while notification frames keep arriving", async () => {

      const clock = new TestClock();
      const opened = await openStream({ clock });

      await using stream = opened.stream;
      const { ws } = opened;
      const errors = collect(stream, "error");
      const packet = findPacket((entry) => entry.event === "access.data.device.update", "a legacy device update");

      /* Liveness comes from any frame rather than the heartbeat alone, so a channel carrying a steady stream of notifications is live even if its heartbeats stop.
       * A watchdog keyed only to the heartbeat would tear this connection down while it was actively delivering data.
       */
      clock.advance(ACCESS_EVENTS_HEARTBEAT_TIMEOUT - 1);
      ws.emitMessage(frame(packet));
      clock.advance(1);
      await settle();

      assert.equal(errors.length, 0);
    });

    test("the heartbeat alone keeps the channel alive", async () => {

      const clock = new TestClock();
      const opened = await openStream({ clock });

      await using stream = opened.stream;
      const { ws } = opened;
      const errors = collect(stream, "error");

      clock.advance(ACCESS_EVENTS_HEARTBEAT_TIMEOUT - 1);
      ws.emitMessage(HEARTBEAT_FRAME);
      clock.advance(1);
      await settle();

      assert.equal(errors.length, 0, "a quiet but heartbeating channel is a live channel");
    });

    test("a tick short of the threshold does not trip the watchdog", async () => {

      const clock = new TestClock();
      const opened = await openStream({ clock });

      await using stream = opened.stream;
      const { ws } = opened;
      const errors = collect(stream, "error");

      clock.advance(1);
      ws.emitMessage(HEARTBEAT_FRAME);
      clock.advance(ACCESS_EVENTS_HEARTBEAT_TIMEOUT - 1);
      await settle();

      assert.equal(errors.length, 0, "the threshold is a floor the silence must reach, not merely approach");
    });

    test("the watchdog also bounds a connect that never completes", async () => {

      const clock = new TestClock();
      const ws = new FakeWebSocket({ autoOpen: false });
      const stream = new EventStream({ clock, host: HOST, log: silentLog(), webSocket: () => ws });

      // The watchdog arms at construction rather than at open, so a socket that never opens is torn down on the same threshold as one that opened and went quiet.
      clock.advance(ACCESS_EVENTS_HEARTBEAT_TIMEOUT);
      await settle();

      // A stream that never opened reports through its handshake, so the stall the watchdog detected is what the caller is handed rather than a generic failure.
      await assert.rejects(stream.opened, AccessStallError);
      assert.equal(ws.closeRequested, true);
    });
  });

  describe("teardown", () => {

    test("close() emits closed once, detaches listeners, and is safe to call more than once", async () => {

      const { stream, ws } = await openStream();
      const closed = collect(stream, "closed");
      const packets = collect(stream, "packet");
      const packet = findPacket((entry) => entry.event === "access.data.device.update", "a legacy device update");

      await stream.close();
      await stream.close();

      assert.equal(closed.length, 1, "closed fires exactly once across repeated close()");

      // After teardown the single AbortController has detached every socket listener, so a late frame delivers nothing.
      ws.emitMessage(frame(packet));
      assert.equal(packets.length, 0);
    });

    test("a natural socket close emits closed and settles disposal", async () => {

      const { stream, ws } = await openStream();
      const closed = collect(stream, "closed");

      ws.emitClose(1000, "going away");

      assert.deepEqual(closed[0]?.[0], { code: 1000, reason: "going away" });

      // Disposal after a natural close is a no-op and does not throw.
      await stream[Symbol.asyncDispose]();
    });

    test("an unsolicited close of a live stream surfaces a recoverable error then closed", async () => {

      const { stream, ws } = await openStream();
      const errors = collect(stream, "error");
      const closed = collect(stream, "closed");

      // The peer drops a live socket without our asking - exactly how a controller reboot arrives (a close event, no preceding socket error). This must reach the
      // error rail so the coordinator's recovery triggers on an unsolicited close just as it does on a socket error.
      ws.emitClose(1006, "");

      assert.ok(first(errors)[0] instanceof AccessNetworkError, "an unsolicited close must surface on the error rail so recovery triggers");
      assert.equal(closed.length, 1);

      // A frame with nothing to quote leaves the code standing alone, rather than an empty parenthetical where the peer's words would have gone.
      const rendered = formatErrorChain(first(errors)[0]);

      assert.ok(rendered.includes("1006"), "the rendered fault names the close code");
      assert.ok(rendered.includes("close code 1006)"), "a frame with no reason leaves no empty parenthetical behind it");

      await stream[Symbol.asyncDispose]();
    });

    test("an unsolicited close carries the frame the peer sent into the fault it raises", async () => {

      const { stream, ws } = await openStream();
      const errors = collect(stream, "error");

      // A controller going down says so on the close frame, and that text is the only account a consumer's log will ever have of why the channel went away.
      ws.emitClose(1006, "controller rebooting");

      const rendered = formatErrorChain(first(errors)[0]);

      assert.ok(rendered.includes("1006"), "the rendered fault names the close code");
      assert.ok(rendered.includes("controller rebooting"), "the rendered fault names what the peer said");

      await stream[Symbol.asyncDispose]();
    });

    test("a peer close detaches the socket's listeners, so a late frame reaches nobody", async () => {

      const { stream, ws } = await openStream();
      const packets = collect(stream, "packet");
      const packet = findPacket((entry) => entry.event === "access.data.device.update", "a legacy device update");

      /* The peer's own close listener reaches the teardown directly, without passing through the path that asks the socket to close, so this is the teardown
       * that has to take the listeners off for itself. A socket that keeps delivering after it reported a close is what tells whether it did: frame handling
       * reads no phase, so a listener left attached would decode and fan out over a stream that has already announced its end.
       */
      ws.emitClose(1006, "");
      ws.emitMessage(frame(packet));

      assert.equal(packets.length, 0, "a stream that has closed delivers nothing further, whichever teardown closed it");

      await stream[Symbol.asyncDispose]();
    });

    test("a deliberate close emits closed without an error", async () => {

      const { stream } = await openStream();
      const errors = collect(stream, "error");
      const closed = collect(stream, "closed");

      // A self-initiated close is a clean lifecycle end, not a fault - it must not trip recovery.
      await stream.close();

      assert.equal(errors.length, 0, "a self-initiated close is not a fault");
      assert.equal(closed.length, 1);
    });

    test("a caller abort after the open tears the stream down and leaves the handshake resolved", async () => {

      const controller = new AbortController();
      const ws = new FakeWebSocket({ autoOpen: false });
      const stream = new EventStream({ host: HOST, log: silentLog(), signal: controller.signal, webSocket: () => ws });

      ws.emitOpen();
      await stream.opened;

      const closed = collect(stream, "closed");
      const errors = collect(stream, "error");

      // The handshake has already settled, so the caller's signal is a teardown rather than a cancellation: what `opened` answered stands, and a teardown the
      // caller asked for is not a fault.
      controller.abort();
      await stream.opened;

      assert.equal(errors.length, 0, "a caller's abort after the open is a lifecycle end rather than a fault");
      assert.equal(closed.length, 1);
      assert.equal(ws.closeRequested, true);
    });

    test("a late open after the teardown neither reopens the stream nor tears it down a second time", async () => {

      const listeners = new Map<string, (...args: never[]) => void>();

      /* A socket that keeps every listener it is given and honors neither `once` nor a removal, against the contract AccessWebSocket states, so this row can call
       * the stream's own open listener after the teardown has already asked for it to be taken off. It is written here rather than beside the shared fakes
       * because one row needs it. The retained listener is variadic because one registration surface takes them all, and an `open` listener is the one that is
       * called with no event at all.
       */
      const ws: AccessWebSocket = {

        addEventListener: (type: string, listener: (...args: never[]) => void): void => void listeners.set(type, listener),
        binaryType: "blob",
        close: (): void => undefined,
        removeEventListener: (): void => undefined
      };
      const stream = new EventStream({ host: HOST, log: silentLog(), webSocket: () => ws });
      const closed = collect(stream, "closed");
      const errors = collect(stream, "error");

      await stream.close();

      listeners.get("open")?.();

      await stream.close();

      assert.equal(closed.length, 1, "closed fires once across a teardown, a late open, and a second close");
      assert.equal(errors.length, 0, "a teardown the caller asked for is not a fault, whatever the socket does afterwards");

      await assert.rejects(stream.opened, AccessNetworkError);
    });

    test("a close() before the open is not re-entered by a socket that reports the close from inside it", async () => {

      const ws = new FakeWebSocket({ autoOpen: false, failsOnClose: true });
      const stream = new EventStream({ host: HOST, log: silentLog(), webSocket: () => ws });
      const closed = collect(stream, "closed");
      const errors = collect(stream, "error");

      /* undici fails a socket that never finished its upgrade from underneath the close request and reports it synchronously, so the close event lands while the
       * teardown that asked for it is still running. The stream detaches its own listeners before asking, so that event reaches nothing and the handshake
       * settles as the close the caller asked for rather than as a peer that dropped a connection.
       */
      await stream.close();

      const rendered = formatErrorChain(await stream.opened.catch((error: unknown) => error));

      assert.equal(rendered.includes("close code"), false, "a close the caller asked for reports no peer's close frame");
      assert.ok(rendered.includes("closed before it finished connecting"), "the handshake carries the deliberate close's own sentence");
      assert.equal(errors.length, 0, "a close the stream itself asked for stays informational");
      assert.equal(closed.length, 1, "the lifecycle end is announced once, whatever the socket does from inside close()");
    });

    test("a close() after the open is not re-entered by a socket that reports the close from inside it", async () => {

      const ws = new FakeWebSocket({ autoOpen: false, failsOnClose: true });
      const stream = new EventStream({ host: HOST, log: silentLog(), webSocket: () => ws });

      ws.emitOpen();
      await stream.opened;

      const closed = collect(stream, "closed");
      const errors = collect(stream, "error");

      // A socket that dispatches its close from inside close() would otherwise have that close read as the peer's, which on an open stream is a fault. The
      // listeners are off before the socket is asked, so the only close the teardown sees is its own.
      await stream.close();

      assert.equal(errors.length, 0, "a close the caller asked for is not a fault, whatever the socket dispatches from inside it");
      assert.equal(closed.length, 1);
    });

    test("a caller abort before the open survives a socket that reports the close from inside it", async () => {

      const controller = new AbortController();
      const ws = new FakeWebSocket({ autoOpen: false, failsOnClose: true });
      const stream = new EventStream({ host: HOST, log: silentLog(), signal: controller.signal, webSocket: () => ws });
      const errors = collect(stream, "error");

      // The cancellation is what the caller is owed, and the CLI branches on that class to report an interrupt rather than a network failure. A close arriving
      // from inside the teardown's own request must not take that answer away.
      controller.abort();

      await assert.rejects(stream.opened, AccessAbortedError);

      assert.equal(errors.length, 0, "a caller's cancel reaches the opened handshake alone");
    });

    test("the connection lifecycle logs are debug rather than info", async () => {

      // The open line fires from openStream()'s handshake and the close line from the close below. Both are routine per-connection bookkeeping, so the layer that
      // owns recovery narration rather than the stream is what a consumer should hear from at info level.
      const log = capturingLog();
      const opened = await openStream({ log });

      await using stream = opened.stream;
      const { ws } = opened;

      ws.emitClose(1000, "going away");

      assert.ok(log.entries.some((entry) => (entry.level === "debug") && entry.message.includes("Connected to the UniFi Access realtime notification API.")),
        "the connect line must log at debug, not info");
      assert.ok(log.entries.some((entry) => (entry.level === "debug") && entry.message.includes("connection closed.")), "the close line must log at debug");
      assert.equal(log.entries.some((entry) => entry.level === "info"), false, "a per-connection lifecycle event is not an info-level event");
    });

    test("lastMessageAt reflects the clock at the most recent frame", async () => {

      const clock = new TestClock();
      const opened = await openStream({ clock });

      await using stream = opened.stream;
      const { ws } = opened;
      const packet = findPacket((entry) => entry.event === "access.data.device.update", "a legacy device update");

      clock.advance(1234);
      ws.emitMessage(frame(packet));

      assert.equal(stream.lastMessageAt, 1234);
    });
  });

  /* The disposal contract, over the socket the stream builds for itself.
   *
   * Every suite above injects a fake socket, which is the right instrument for decode, fan-out, and teardown ordering and the wrong one for this: a fake has no
   * connection to release, so nothing above the socket can tell whether the real one was let go. These tests connect to a loopback peer over the default factory
   * path instead, and the peer is deliberately unhelpful - a controller that accepts a close frame and never answers it is the shape the contract has to hold
   * under.
   */
  describe("the disposal contract over a real connection", () => {

    test("close() severs a connection the peer will not release", async () => {

      await using server = await createLoopbackServer("ignoresClose");
      const arriving = server.connection(0);
      const stream = new EventStream({ clock: new TestClock(), host: loopbackHost(server.port), log: silentLog() });

      await stream.opened;

      const connection = await arriving;

      // The peer offers h2 ahead of http/1.1, so it would negotiate h2 against a client that offered both. What it reports is therefore an assertion on the
      // client's own offer staying http/1.1-only, which is what a WebSocket upgrade requires.
      assert.equal(connection.alpnProtocol, "http/1.1");

      /* The ordering here is the whole point. The peer-side promise was armed when the connection was accepted, so it cannot be missed; close() is awaited first
       * and the severance only after. What passes is close() having already released the connection by the time it resolves, rather than the peer eventually
       * noticing on its own.
       */
      await stream.close();
      await connection.closed;

      // A second full cycle against the same peer, over its own fresh connection. Two passes through the release path is what catches state that works once.
      const arrivingAgain = server.connection(1);
      const second = new EventStream({ clock: new TestClock(), host: loopbackHost(server.port), log: silentLog() });

      await second.opened;

      const secondConnection = await arrivingAgain;

      await second.close();
      await secondConnection.closed;
    });

    test("a closed listener that throws does not leave the connection held", async () => {

      await using server = await createLoopbackServer("ignoresClose");
      const arriving = server.connection(0);
      const stream = new EventStream({ clock: new TestClock(), host: loopbackHost(server.port), log: silentLog() });

      await stream.opened;

      const connection = await arriving;
      let severed = false;

      void connection.closed.then(() => {

        severed = true;
      });

      /* The throw reaches the teardown through close() rather than through a peer close, and that is deliberate: a listener that throws inside the socket's own
       * close dispatch becomes an uncaught exception and ends the test process, so the only route that keeps the throw observable is the one the caller drives.
       */
      stream.on("closed", () => {

        throw new Error("the closed listener refused the close");
      });

      await assert.rejects(stream.close(), { message: "the closed listener refused the close" });

      /* The peer holds its own end of the connection open, so nothing but this stream's release can sever it - which makes the peer's close the one observer of
       * the release in this harness, and the reason this row cannot use the fake socket. DIAL_CUT_BOUND_MS was measured against a socket cut mid-handshake; this
       * row cuts an established one and reuses the constant as a generous ceiling.
       */
      await waitUntil(() => severed, { description: "the peer's end of the connection to be severed", timeoutMs: DIAL_CUT_BOUND_MS });
    });

    test("an error listener that throws on a stall does not leave the connection held", async () => {

      await using server = await createLoopbackServer("ignoresClose");
      const arriving = server.connection(0);
      const clock = new TestClock();
      const stream = new EventStream({ clock, host: loopbackHost(server.port), log: silentLog() });

      await stream.opened;

      const connection = await arriving;
      let severed = false;

      void connection.closed.then(() => {

        severed = true;
      });

      stream.on("error", () => {

        throw new Error("the error listener refused the stall");
      });

      /* The watchdog runs detached, so a listener that refuses the stall throws into the watchdog's own catch rather than into any caller. What the catch hides
       * has to be the listener's exception and nothing else, so the stall is driven inside a guard that would report a rejection escaping the loop.
       */
      await assertNoUnhandledRejections(async () => {

        clock.advance(ACCESS_EVENTS_HEARTBEAT_TIMEOUT);

        await settle();
      });

      /* The peer holds its own end of the connection open, so nothing but this stream's release can sever it - which makes the peer's close the one observer of
       * the release in this harness, exactly as it is for the throwing closed listener above.
       */
      await waitUntil(() => severed, { description: "the peer's end of the connection to be severed", timeoutMs: DIAL_CUT_BOUND_MS });
      await stream.close();
    });

    test("a close() re-entered from a closed listener resolves and severs the connection once", async () => {

      await using server = await createLoopbackServer("ignoresClose");
      const arriving = server.connection(0);
      const stream = new EventStream({ clock: new TestClock(), host: loopbackHost(server.port), log: silentLog() });

      await stream.opened;

      const connection = await arriving;
      const closed = collect(stream, "closed");
      const errors = collect(stream, "error");
      const reentered: Promise<void>[] = [];
      let severed = false;

      void connection.closed.then(() => {

        severed = true;
      });

      /* This row characterizes re-entry: a listener that closes the stream it is being notified by must not deadlock, announce the close twice, or leave the
       * connection held. It asserts no order between the outer close and the re-entrant one, so it does not by itself distinguish the release order...the
       * throwing-listener row above is what does that.
       */
      stream.on("closed", () => {

        reentered.push(stream.close());
      });

      await stream.close();
      await Promise.all(reentered);

      assert.equal(reentered.length, 1, "the listener's own close() ran from inside the close it was told about");
      assert.equal(closed.length, 1, "closed fires once whatever a listener does from inside it");
      assert.equal(errors.length, 0, "a teardown the caller asked for is not a fault, re-entered or not");

      await waitUntil(() => severed, { description: "the peer's end of the connection to be severed", timeoutMs: DIAL_CUT_BOUND_MS });
    });

    test("close() over a peer that answers the close frame ends without a fault", async () => {

      await using server = await createLoopbackServer("answersClose");
      const arriving = server.connection(0);
      const stream = new EventStream({ clock: new TestClock(), host: loopbackHost(server.port), log: silentLog() });

      await stream.opened;

      const connection = await arriving;
      const errors = collect(stream, "error");

      // Releasing a connection the peer is already letting go of must be harmless: the tracked set has drained itself, and a cooperative close is a clean
      // lifecycle end rather than a fault.
      await stream.close();
      await connection.closed;

      assert.equal(errors.length, 0, "a cooperative peer's close is not a fault");
    });

    test("close() before the socket opens releases the connection", async () => {

      await using server = await createLoopbackServer("neverUpgrades");
      const arriving = server.connection(0);
      const stream = new EventStream({ clock: new TestClock(), host: loopbackHost(server.port), log: silentLog() });
      const connection = await arriving;
      const closed = collect(stream, "closed");
      const errors = collect(stream, "error");

      // The peer has completed TCP and TLS and answered nothing above them, so the connect is still in flight when the teardown begins. The release has to reach
      // a connection that never became a WebSocket, and the pending handshake settles as the pre-open network failure.
      await stream.close();
      await connection.closed;
      await assert.rejects(async () => stream.opened, AccessNetworkError);

      assert.equal(errors.length, 0, "a close the stream itself asked for stays informational, whatever stage the connection had reached");
      assert.equal(closed.length, 1);
    });

    test("a caller abort during the TLS dial releases the socket at once and keeps the error rail empty", async () => {

      await using peer = await createSilentLoopback();

      const controller = new AbortController();
      const stream = new EventStream({ clock: new TestClock(), host: peer.host, log: silentLog(), signal: controller.signal });
      const arriving = peer.connection(0);
      const errors = collect(stream, "error");
      const connection = await arriving;
      const startedAt = process.hrtime.bigint();

      /* The peer accepts the connection and answers nothing, so the TLS handshake is still in flight when the caller cancels. The listeners come off before the
       * socket is asked to close, which is what keeps a teardown the stream itself ran off the error rail, where only a fault after the open is reported.
       */
      controller.abort();

      await assert.rejects(async () => stream.opened, AccessAbortedError);
      await connection.closed;

      assert.ok(elapsedSince(startedAt) < DIAL_CUT_BOUND_MS, "a cancelled connection attempt is released at once rather than lingering to undici's own timer");

      await stream.close();

      assert.equal(errors.length, 0, "a caller's cancel before open reaches the opened handshake alone");
    });

    test("a caller abort while the upgrade is pending keeps the error rail empty", async () => {

      await using server = await createLoopbackServer("neverUpgrades");

      const controller = new AbortController();
      const stream = new EventStream({ clock: new TestClock(), host: loopbackHost(server.port), log: silentLog(), signal: controller.signal });
      const arriving = server.connection(0);
      const closed = collect(stream, "closed");
      const errors = collect(stream, "error");
      const connection = await arriving;

      // One stage further along than the test above: TLS has completed and the upgrade is what goes unanswered. The teardown is the stream's own either way.
      controller.abort();

      await assert.rejects(async () => stream.opened, AccessAbortedError);
      await connection.closed;
      await stream.close();

      assert.equal(errors.length, 0, "a caller's cancel before open reaches the opened handshake alone");
      assert.deepEqual(closed, [[{ code: 1000, reason: "connection aborted by the caller's signal" }]], "the close rail names the caller's cancel");
    });

    test("the watchdog tripping a connect that never completes reaches the caller on the handshake alone", async () => {

      await using server = await createLoopbackServer("neverUpgrades");

      const clock = new TestClock();
      const stream = new EventStream({ clock, host: loopbackHost(server.port), log: silentLog() });
      const arriving = server.connection(0);
      const closed = collect(stream, "closed");
      const errors = collect(stream, "error");
      const connection = await arriving;

      /* The watchdog arms at construction, so it bounds a connect that never completes. There is no consumer acting on a stream that never opened, so the stall
       * goes to whoever is waiting on the handshake and the rail stays empty.
       */
      clock.advance(ACCESS_EVENTS_HEARTBEAT_TIMEOUT);
      await settle();

      assert.equal(errors.length, 0, "a stall before the open stays off the error rail");
      assert.equal(closed.length, 1);

      await assert.rejects(async () => stream.opened, AccessStallError);
      await connection.closed;
      await stream.close();
    });

    test("the upgrade honors the certificate-verification option in both directions", async () => {

      await using server = await createLoopbackServer("ignoresClose");
      const accepted = new EventStream({ clock: new TestClock(), host: loopbackHost(server.port), log: silentLog() });

      // The peer presents a self-signed certificate, which is what a controller presents, so the default connects to it.
      await accepted.opened;
      await accepted.close();

      const verified = new EventStream({ clock: new TestClock(), host: loopbackHost(server.port), log: silentLog(), verifyTls: true });

      /* The same peer and the same upgrade, one option apart. Asking for verification against a certificate that cannot provide it fails the connect, and the
       * pre-open failure reaches the caller on the handshake rejection exactly as every other one does - naming the listener, the address dialed, and the
       * verifier's own code, which the socket's own error event never carried at all.
       */
      const failure = await verified.opened.catch((error: unknown) => error);

      assert.ok(failure instanceof AccessCertificateError, "a certificate the verifier refused reaches the caller as the refusal it is");
      assert.equal(failure.code, "DEPTH_ZERO_SELF_SIGNED_CERT");
      assert.equal(failure.host, loopbackHost(server.port), "the address reported is the one the stream dialed");
      assert.equal(failure.identity, "credentials");

      await verified.close();
    });

    test("a stream carrying the token identity names the developer API as the listener that presented the certificate", async () => {

      await using server = await createLoopbackServer("ignoresClose");

      const endpoint = "wss://" + loopbackHost(server.port) + "/api/v1/developer/devices/notifications";
      const stream = new EventStream({ clock: new TestClock(), endpoint, host: HOST, identity: "token", log: silentLog(), verifyTls: true });

      /* The official socket answers on the developer API's own port, which an endpoint override is what names. The address reported is therefore read from the
       * endpoint rather than from `host`, which stays the controller this stream is an identity for.
       */
      const failure = await stream.opened.catch((error: unknown) => error);

      assert.ok(failure instanceof AccessCertificateError);
      assert.equal(failure.identity, "token");
      assert.equal(failure.host, loopbackHost(server.port), "the endpoint's own host and port is what was dialed");
      assert.ok(failure.message.startsWith("The UniFi Access developer API at "), "the token leg names the listener a certificate has to be installed on");

      await stream.close();
    });

    test("a dial nothing is listening for carries the platform's own errno to the caller", async () => {

      const stream = new EventStream({ clock: new TestClock(), host: loopbackHost(await vacantPort()), log: silentLog() });

      /* Every dial failure loses its errno on the way to the socket's error event, not a certificate refusal alone, so a refused port arrives as an empty failure
       * unless the connector's record is read first. This is the row that says the record serves the whole class rather than the certificate case.
       */
      const failure = await stream.opened.catch((error: unknown) => error);

      assert.ok(failure instanceof AccessNetworkError, "a refused dial is a reachability failure");
      assert.ok(!(failure instanceof AccessCertificateError), "and nothing about a certificate, since no handshake was reached to present one");
      assert.equal(failure.code, "ECONNREFUSED");

      await stream.close();
    });

    test("a failure before the open leaves no error-level line from the stream itself", async () => {

      const log = capturingLog();
      const stream = new EventStream({ clock: new TestClock(), host: loopbackHost(await vacantPort()), log });

      await assert.rejects(async () => stream.opened, AccessNetworkError);

      // A stream that never opened reports through its handshake rejection, and the coordinator waiting on that rejection logs what it got. A line here as well
      // would put one failure in the log twice.
      assert.equal(log.entries.some((entry) => entry.level === "error"), false);

      await stream.close();
    });
  });
});

/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * events-stream.test.ts: Tests for EventStream - the single decode site, the guard order the wire protocol dictates, the three-rail fan-out, decode-failure
 * resilience, the silence watchdog, and teardown. Driven through an injected fake WebSocket and a fake Clock, so the realtime stream is exercised
 * deterministically without a live controller.
 *
 * The frames these tests feed are text, because the Access notification wire is JSON text. That is the detail a port of a binary-protocol stream gets wrong
 * silently - a normalizer written for bytes discards every string frame and the stream simply goes quiet - so the ordinary decode cases here drive strings.
 */
import { AccessAbortedError, AccessNetworkError, AccessProtocolError, AccessStallError } from "../errors.ts";
import type { AccessEventsClosedPayload, AccessEventsPacketPayload } from "../diagnostics.ts";
import { EventStream, HEARTBEAT_FRAME } from "./events-stream.ts";
import { FakeWebSocket, createLoopbackServer } from "./events-stream.helpers.ts";
import { accessEventPackets2024Fixture, accessEventPacketsFixture, accessEventPacketsHistoricalFixture } from "../protocol/events.fixtures.ts";
import { assertNoUnhandledRejections, capturingLog, expectAt, fakeClock, silentLog } from "../testing.helpers.ts";
import { describe, test } from "node:test";
import { ACCESS_EVENTS_HEARTBEAT_TIMEOUT } from "../settings.ts";
import type { AccessEventPacket } from "../types/index.ts";
import type { AccessLogging } from "../logging.ts";
import type { AccessWireEvent } from "../protocol/events.ts";
import type { EventStreamEvents } from "./events-stream.ts";
import type { FakeClock } from "../testing.helpers.ts";
import assert from "node:assert/strict";
import diagnosticsChannel from "node:diagnostics_channel";

const HOST = "10.0.0.1";

// The captured specimens these tests drive, so the stream is exercised with frames the controller actually sent. They are reached through the same findPacket
// convention the classifier's own suite uses: name a packet by what it carries, and fail loudly rather than skip if the corpus stops carrying it.
const allPackets = [ ...accessEventPacketsFixture, ...accessEventPackets2024Fixture, ...accessEventPacketsHistoricalFixture ];

// Find the one captured packet a test names, failing loudly rather than silently skipping if the corpus ever stops carrying it.
function findPacket(predicate: (packet: AccessEventPacket) => boolean, description: string): AccessEventPacket {

  const packet = allPackets.find(predicate);

  assert.ok(packet, "the fixture corpus should carry " + description);

  return packet;
}

// Serialize a packet the way the controller puts it on the wire: one JSON text frame.
function frame(packet: AccessEventPacket): string {

  return JSON.stringify(packet);
}

// Construct an open stream over a fake socket, returning the stream, the socket, and the clock. The socket does not auto-open, so each test controls the
// handshake.
async function openStream(options: { clock?: FakeClock; log?: AccessLogging } = {}): Promise<{ clock: FakeClock; stream: EventStream; ws: FakeWebSocket }> {

  const clock = options.clock ?? fakeClock();
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

// The loopback peer's address in the host:port form the stream builds its notification URL from. The port is whatever the operating system handed the server, so
// it is only knowable once it is listening.
function loopbackHost(port: number): string {

  return "127.0.0.1:" + port.toString();
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
      const stream = new EventStream({ host: HOST, log: silentLog(), webSocket: (target) => {

        capturedUrl = target;

        return ws;
      } });

      // The controller offers no replay mechanism, so there is no cursor to carry and the endpoint takes no parameters at all.
      assert.equal(capturedUrl, "wss://" + HOST + "/proxy/access/api/v2/ws/notification");
      assert.equal(capturedUrl.includes("?"), false, "the notification endpoint takes no query string");

      await stream.close();
    });

    test("connect() resolves once the socket opens", async () => {

      const ws = new FakeWebSocket();

      await using stream = await EventStream.connect({ host: HOST, log: silentLog(), webSocket: () => ws });

      assert.ok(stream instanceof EventStream);
    });

    test("opened rejects with an AccessNetworkError when the socket closes before opening", async () => {

      const ws = new FakeWebSocket({ autoOpen: false });
      const stream = new EventStream({ host: HOST, log: silentLog(), webSocket: () => ws });

      ws.emitClose(1006, "handshake failed");

      await assert.rejects(stream.opened, AccessNetworkError);
      await stream.close();
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

      /* An exact comparison rather than a membership check, and that is the point of it. The obvious thing to wire here is the authenticated session's full header
       * set, which also carries the CSRF token - and doing so would quietly add a header to every notification connection the controller never asked for. Only an
       * exact comparison catches that.
       */
      assert.deepEqual(upgrade.headers, { Cookie: "TOKEN=abcdef" });
      assert.equal(Object.keys(upgrade.headers).length, 1);

      await upgrade.stream.close();
    });

    test("carries the cookie header with an empty value when there is no session yet", async () => {

      // Absence and emptiness are different on the wire. A connect made before login completes still presents the header, so the controller sees a request with an
      // empty session rather than one that never mentioned a session at all.
      const upgrade = upgradeOf({ getAuthHeaders: () => ({ Cookie: "" }) });

      assert.deepEqual(upgrade.headers, { Cookie: "" });

      await upgrade.stream.close();
    });

    test("still carries the cookie header when no closure is supplied at all", async () => {

      // Construction with no session wired is not a construction that drops the header: the upgrade is defined by what it presents, and an omitted option is the
      // same situation as a session with nothing in it yet.
      const upgrade = upgradeOf();

      assert.deepEqual(upgrade.headers, { Cookie: "" });

      await upgrade.stream.close();
    });

    test("carries bearer credentials when a token closure is wired", async () => {

      // The official notification socket authenticates on a bearer token rather than a cookie. One closure serves both, so the stream itself knows nothing about
      // which identity it is carrying.
      const upgrade = upgradeOf({ getAuthHeaders: () => ({ authorization: "Bearer a-token" }) });

      assert.deepEqual(upgrade.headers, { authorization: "Bearer a-token" });

      await upgrade.stream.close();
    });

    test("addresses the derived notification URL when no endpoint is supplied", async () => {

      const upgrade = upgradeOf();

      assert.equal(upgrade.url, "wss://" + HOST + "/proxy/access/api/v2/ws/notification");

      await upgrade.stream.close();
    });

    test("addresses the supplied endpoint instead when one is supplied", async () => {

      // An endpoint override replaces the whole URL rather than adjusting the derived one, because the socket it names differs in port and path alike.
      const endpoint = "wss://10.0.0.1:12445/api/v1/developer/devices/notifications";
      const upgrade = upgradeOf({ endpoint });

      assert.equal(upgrade.url, endpoint);

      await upgrade.stream.close();
    });

    test("keeps the host as its own identity even when the endpoint names a different address", async () => {

      // The override addresses the same controller on a different port, so the host stays what this stream reports itself as - in its logs and on the close
      // channel - rather than being re-derived from a URL carrying a port the rest of the library does not address the controller by.
      const payloads: AccessEventsClosedPayload[] = [];
      const onClosed = (message: unknown): void => void payloads.push(message as AccessEventsClosedPayload);
      const upgrade = upgradeOf({ endpoint: "wss://10.0.0.1:12445/api/v1/developer/devices/notifications" });

      diagnosticsChannel.subscribe("unifi-access:events:closed", onClosed);

      try {

        await upgrade.stream.close();
      } finally {

        diagnosticsChannel.unsubscribe("unifi-access:events:closed", onClosed);
      }

      assert.equal(first(payloads).host, HOST);
    });
  });

  describe("decode and fan-out", () => {

    test("a JSON text frame is parsed, classified, and emitted on both the packet and raw rails", async () => {

      const { stream, ws } = await openStream();
      const packets = collect(stream, "packet");
      const raw = collect(stream, "rawPacket");
      const packet = findPacket((entry) => (entry.event === "access.data.device.update") && (entry.event_object_id === "aabbcc000002"), "the legacy reader update");

      ws.emitMessage(frame(packet));

      assert.equal(packets.length, 1);
      assert.equal(raw.length, 1);

      const [event] = first(packets);

      assert.equal(event.kind, "deviceChanged");
      assert.equal((event as { id: string }).id, "aabbcc000002");

      await stream.close();
    });

    test("an activity notification is classified to its typed event", async () => {

      const { stream, ws } = await openStream();
      const packets = collect(stream, "packet");
      const packet = findPacket((entry) => entry.event === "access.data.device.remote_unlock", "the historical remote unlock specimen");

      ws.emitMessage(frame(packet));

      assert.equal(packets.length, 1);
      assert.equal(first(packets)[0].kind, "unlock");

      await stream.close();
    });

    test("every well-formed frame reaches the raw rail, including the ones the classifier declines", async () => {

      const { stream, ws } = await openStream();
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

      await stream.close();
    });

    test("the raw rail carries the payload fields the classifier's translation drops", async () => {

      const { stream, ws } = await openStream();
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

      await stream.close();
    });

    test("a binary frame delivered as an ArrayBuffer is decoded as UTF-8 text", async () => {

      const { stream, ws } = await openStream();
      const packets = collect(stream, "packet");
      const packet = findPacket((entry) => entry.event === "access.data.device.update", "a legacy device update");
      const bytes = Buffer.from(frame(packet), "utf8");

      // Binary is the defensive case rather than the protocol, but the stream asks for arraybuffer framing so that a frame arriving as bytes is still readable.
      ws.emitMessage(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));

      assert.equal(packets.length, 1);
      assert.equal(first(packets)[0].kind, "deviceChanged");

      await stream.close();
    });

    test("the stream() rail delivers packets and rejects on abort", async () => {

      const { stream, ws } = await openStream();
      const controller = new AbortController();
      const collected: AccessWireEvent[] = [];
      const packet = findPacket((entry) => entry.event === "access.data.device.update", "a legacy device update");
      const task = (async (): Promise<void> => {

        for await (const [event] of stream.stream("packet", { signal: controller.signal })) {

          collected.push(event);
        }
      })();

      ws.emitMessage(frame(packet));
      await expectAt(() => collected.length === 1);

      controller.abort();

      // The raw stream rail rejects on abort (node:events' contract) - unlike the packets() sugar, which returns cleanly.
      await assert.rejects(task);
      assert.equal(collected.length, 1);

      await stream.close();
    });

    test("once() resolves with the next packet's tuple", async () => {

      const { stream, ws } = await openStream();
      const pending = stream.once("packet");
      const packet = findPacket((entry) => entry.event === "access.data.device.update", "a legacy device update");

      ws.emitMessage(frame(packet));

      const [event] = await pending;

      assert.equal(event.kind, "deviceChanged");

      await stream.close();
    });

    test("packets() yields typed events and terminates on abort", async () => {

      const { stream, ws } = await openStream();
      const controller = new AbortController();
      const collected: AccessWireEvent[] = [];
      const packet = findPacket((entry) => entry.event === "access.data.device.update", "a legacy device update");
      const task = (async (): Promise<void> => {

        for await (const event of stream.packets({ signal: controller.signal })) {

          collected.push(event);
        }
      })();

      ws.emitMessage(frame(packet));
      await expectAt(() => collected.length === 1);

      controller.abort();
      await task;

      assert.equal(collected.length, 1);
      assert.equal(collected[0]?.kind, "deviceChanged");

      await stream.close();
    });
  });

  describe("the heartbeat and the frames that carry nothing", () => {

    test("the heartbeat proves liveness and reaches no rail at all", async () => {

      const clock = fakeClock();
      const { stream, ws } = await openStream({ clock });
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

      await stream.close();
    });

    test("an empty frame is absorbed in silence", async () => {

      const clock = fakeClock();
      const log = capturingLog();
      const { stream, ws } = await openStream({ clock, log });
      const packets = collect(stream, "packet");
      const raw = collect(stream, "rawPacket");
      const errors = collect(stream, "error");

      clock.advance(1000);

      // Discard the connect line so what remains is attributable to the frame alone.
      log.reset();
      ws.emitMessage("");

      // Parsing an empty frame would raise a protocol error for something the controller legitimately sends, so the guard sits ahead of the parse.
      assert.equal(packets.length, 0);
      assert.equal(raw.length, 0);
      assert.equal(errors.length, 0);
      assert.equal(log.entries.length, 0, "an empty frame is not worth reporting at any level");
      assert.equal(stream.lastMessageAt, 1000);

      await stream.close();
    });

    test("a frame that cannot be read as text is skipped without emitting", async () => {

      const { stream, ws } = await openStream();
      const packets = collect(stream, "packet");
      const errors = collect(stream, "error");

      // A Blob-like object is the one category the normalizer cannot turn into text, so the caller skips it rather than tearing the connection down over it.
      ws.emitMessage({ size: 3, type: "text/plain" });

      assert.equal(packets.length, 0);
      assert.equal(errors.length, 0);

      await stream.close();
    });
  });

  describe("decode failure resilience", () => {

    test("a frame that is not JSON surfaces a typed error and the stream stays open", async () => {

      const clock = fakeClock();
      const { stream, ws } = await openStream({ clock });
      const errors = collect(stream, "error");
      const packets = collect(stream, "packet");
      const raw = collect(stream, "rawPacket");
      const packet = findPacket((entry) => entry.event === "access.data.device.update", "a legacy device update");

      clock.advance(4321);
      ws.emitMessage("{not json");

      assert.equal(errors.length, 1);
      assert.ok(first(errors)[0] instanceof AccessProtocolError);
      assert.equal(raw.length, 0, "nothing reached the raw rail, because nothing parsed");

      // Liveness comes from any frame at all, so a frame we could not read still proves the channel is carrying traffic. This is the path where that claim has
      // nothing else to stand on - no rail emission accompanies it.
      assert.equal(stream.lastMessageAt, 4321);

      // A subsequent good frame still flows - one bad frame does not desync the channel, because WebSocket frames are independently delimited.
      ws.emitMessage(frame(packet));
      assert.equal(packets.length, 1);

      await stream.close();
    });

    test("valid JSON that is not a notification reaches only the error rail", async () => {

      const clock = fakeClock();
      const { stream, ws } = await openStream({ clock });
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
      assert.ok(first(errors)[0] instanceof AccessProtocolError);
      assert.ok(errors[1]?.[0] instanceof AccessProtocolError);
      assert.equal(packets.length, 0);
      assert.equal(raw.length, 0, "an unshaped value must not reach the raw rail either, which is typed as a notification");

      // Both frames were rejected, yet both still stamped liveness - a channel sending us things we decline is a channel that is very much alive, and nothing else
      // on this path records that it delivered anything.
      assert.equal(stream.lastMessageAt, 9876);

      await stream.close();
    });

    test("a decode failure does not terminate an open packets() iterator", async () => {

      const { stream, ws } = await openStream();
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
      await expectAt(() => collected.length === 1);

      controller.abort();
      await task;

      assert.equal(collected.length, 1);

      await stream.close();
    });

    test("a socket error surfaces a typed error and closes the stream", async () => {

      const { stream, ws } = await openStream();
      const errors = collect(stream, "error");
      const closed = collect(stream, "closed");

      ws.emitError(new Error("socket reset"));

      assert.ok(errors[0]?.[0] instanceof AccessNetworkError);
      assert.equal(closed.length, 1);
      assert.equal(ws.closeRequested, true);

      await stream.close();
    });

    test("an expected-disconnect socket error is not logged at error level", async () => {

      const log = capturingLog();
      const { stream, ws } = await openStream({ log });

      // undici raises a TypeError from its own WebSocket teardown when a socket closes mid-frame. It is the ordinary shape of a disconnection rather than a fault
      // a consumer can act on, so it still reaches the error rail but must not be reported as an error in the log.
      ws.emitError(new TypeError("terminated"));

      assert.equal(log.entries.some((entry) => entry.level === "error"), false);

      await stream.close();
    });
  });

  describe("diagnostics channels", () => {

    test("publishes the packet payload on both arms of the notification vocabulary", async () => {

      const { stream, ws } = await openStream();
      const payloads: AccessEventsPacketPayload[] = [];
      const onPacket = (message: unknown): void => void payloads.push(message as AccessEventsPacketPayload);
      const deviceUpdate = findPacket((entry) => (entry.event === "access.data.device.update") && (entry.event_object_id === "aabbcc000002"),
        "the legacy reader update");
      const ringCancel = findPacket((entry) => entry.event === "access.remote_view.change", "a historical ring cancellation specimen");

      diagnosticsChannel.subscribe("unifi-access:events:packet", onPacket);

      try {

        ws.emitMessage(frame(deviceUpdate));
        ws.emitMessage(frame(ringCancel));
      } finally {

        diagnosticsChannel.unsubscribe("unifi-access:events:packet", onPacket);
      }

      // A notification that names an entity carries its identifier; a ring cancellation identifies the call rather than a device, so the payload does not invent
      // one for it.
      assert.deepEqual(payloads[0], { eventName: "access.data.device.update", host: HOST, id: "aabbcc000002", kind: "deviceChanged" });
      assert.deepEqual(payloads[1], { eventName: "access.remote_view.change", host: HOST, kind: "doorbellCancel" });

      await stream.close();
    });

    test("publishes a door-state report on the identifier-free arm", async () => {

      const { stream, ws } = await openStream();
      const payloads: AccessEventsPacketPayload[] = [];
      const onPacket = (message: unknown): void => void payloads.push(message as AccessEventsPacketPayload);

      // A door-state report names each of the doors it carries rather than one subject, so it goes through the same identifier-free arm the ring cancellation does.
      const doorState = findPacket((entry) => (entry.event === "access.data.v2.location.update") && (entry.data?.["state"] !== undefined),
        "a v2 location update carrying door state");

      diagnosticsChannel.subscribe("unifi-access:events:packet", onPacket);

      try {

        ws.emitMessage(frame(doorState));
      } finally {

        diagnosticsChannel.unsubscribe("unifi-access:events:packet", onPacket);
      }

      assert.deepEqual(payloads[0], { eventName: "access.data.v2.location.update", host: HOST, kind: "doorStateChanged" });

      await stream.close();
    });

    test("publishes nothing on the packet channel for a notification the library does not model", async () => {

      const { stream, ws } = await openStream();
      const payloads: unknown[] = [];
      const onPacket = (message: unknown): void => void payloads.push(message);
      const unmodeled = findPacket((entry) => entry.event === "access.data.camera.update", "an unmodeled notification");

      diagnosticsChannel.subscribe("unifi-access:events:packet", onPacket);

      try {

        ws.emitMessage(frame(unmodeled));
      } finally {

        diagnosticsChannel.unsubscribe("unifi-access:events:packet", onPacket);
      }

      assert.equal(payloads.length, 0, "the channel measures modeled activity rather than raw wire volume");

      await stream.close();
    });

    test("publishes the close payload with the controller host", async () => {

      const { stream, ws } = await openStream();
      const payloads: AccessEventsClosedPayload[] = [];
      const onClosed = (message: unknown): void => void payloads.push(message as AccessEventsClosedPayload);

      diagnosticsChannel.subscribe("unifi-access:events:closed", onClosed);

      try {

        ws.emitClose(1000, "going away");
      } finally {

        diagnosticsChannel.unsubscribe("unifi-access:events:closed", onClosed);
      }

      assert.deepEqual(payloads, [{ code: 1000, host: HOST, reason: "going away" }]);

      await stream[Symbol.asyncDispose]();
    });
  });

  describe("silence watchdog", () => {

    test("a channel silent beyond the threshold emits AccessStallError and tears down", async () => {

      const clock = fakeClock();
      const { stream, ws } = await openStream({ clock });
      const errors = collect(stream, "error");
      const closed = collect(stream, "closed");

      // No frames arrive; advance past the watchdog window and release one watchdog tick.
      clock.advance(ACCESS_EVENTS_HEARTBEAT_TIMEOUT);
      await clock.tick();

      assert.equal(errors.length, 1);

      const [stallError] = first(errors);

      assert.ok(stallError instanceof AccessStallError);
      assert.equal(stallError.silentForMs, ACCESS_EVENTS_HEARTBEAT_TIMEOUT);
      assert.equal(closed.length, 1);
      assert.equal(ws.closeRequested, true);
    });

    test("the watchdog does not trip while notification frames keep arriving", async () => {

      const clock = fakeClock();
      const { stream, ws } = await openStream({ clock });
      const errors = collect(stream, "error");
      const packet = findPacket((entry) => entry.event === "access.data.device.update", "a legacy device update");

      /* Liveness comes from any frame rather than the heartbeat alone, so a channel carrying a steady stream of notifications is live even if its heartbeats stop.
       * A watchdog keyed only to the heartbeat would tear this connection down while it was actively delivering data.
       */
      clock.advance(ACCESS_EVENTS_HEARTBEAT_TIMEOUT - 1);
      ws.emitMessage(frame(packet));
      clock.advance(1);
      await clock.tick();

      assert.equal(errors.length, 0);

      await stream.close();
    });

    test("the heartbeat alone keeps the channel alive", async () => {

      const clock = fakeClock();
      const { stream, ws } = await openStream({ clock });
      const errors = collect(stream, "error");

      clock.advance(ACCESS_EVENTS_HEARTBEAT_TIMEOUT - 1);
      ws.emitMessage(HEARTBEAT_FRAME);
      clock.advance(1);
      await clock.tick();

      assert.equal(errors.length, 0, "a quiet but heartbeating channel is a live channel");

      await stream.close();
    });

    test("a tick short of the threshold does not trip the watchdog", async () => {

      const clock = fakeClock();
      const { stream } = await openStream({ clock });
      const errors = collect(stream, "error");

      clock.advance(ACCESS_EVENTS_HEARTBEAT_TIMEOUT - 1);
      await clock.tick();

      assert.equal(errors.length, 0, "the threshold is a floor the silence must reach, not merely approach");

      await stream.close();
    });

    test("the watchdog also bounds a connect that never completes", async () => {

      const clock = fakeClock();
      const ws = new FakeWebSocket({ autoOpen: false });
      const stream = new EventStream({ clock, host: HOST, log: silentLog(), webSocket: () => ws });

      // The watchdog arms at construction rather than at open, so a socket that never opens is torn down on the same threshold as one that opened and went quiet.
      clock.advance(ACCESS_EVENTS_HEARTBEAT_TIMEOUT);
      await clock.tick();

      await assert.rejects(stream.opened, AccessNetworkError);
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

    test("the connection lifecycle logs are debug rather than info", async () => {

      // The open line fires from openStream()'s handshake and the close line from the close below. Both are routine per-connection bookkeeping, so the layer that
      // owns recovery narration rather than the stream is what a consumer should hear from at info level.
      const log = capturingLog();
      const { stream, ws } = await openStream({ log });

      ws.emitClose(1000, "going away");

      assert.ok(log.entries.some((entry) => (entry.level === "debug") && entry.message.includes("Connected to the UniFi Access realtime notification API.")),
        "the connect line must log at debug, not info");
      assert.ok(log.entries.some((entry) => (entry.level === "debug") && entry.message.includes("connection closed.")), "the close line must log at debug");
      assert.equal(log.entries.some((entry) => entry.level === "info"), false, "a per-connection lifecycle event is not an info-level event");

      await stream[Symbol.asyncDispose]();
    });

    test("lastMessageAt reflects the clock at the most recent frame", async () => {

      const clock = fakeClock();
      const { stream, ws } = await openStream({ clock });
      const packet = findPacket((entry) => entry.event === "access.data.device.update", "a legacy device update");

      clock.advance(1234);
      ws.emitMessage(frame(packet));

      assert.equal(stream.lastMessageAt, 1234);

      await stream.close();
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
      const stream = new EventStream({ clock: fakeClock(), host: loopbackHost(server.port), log: silentLog() });

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
      const second = new EventStream({ clock: fakeClock(), host: loopbackHost(server.port), log: silentLog() });

      await second.opened;

      const secondConnection = await arrivingAgain;

      await second.close();
      await secondConnection.closed;
    });

    test("close() over a peer that answers the close frame ends without a fault", async () => {

      await using server = await createLoopbackServer("answersClose");
      const arriving = server.connection(0);
      const stream = new EventStream({ clock: fakeClock(), host: loopbackHost(server.port), log: silentLog() });

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
      const stream = new EventStream({ clock: fakeClock(), host: loopbackHost(server.port), log: silentLog() });
      const connection = await arriving;

      // The peer has completed TCP and TLS and answered nothing above them, so the connect is still in flight when the teardown begins. The release has to reach
      // a connection that never became a WebSocket, and the pending handshake settles as the pre-open network failure.
      await stream.close();
      await connection.closed;
      await assert.rejects(async () => stream.opened, AccessNetworkError);
    });

    test("the upgrade honors the certificate-verification option in both directions", async () => {

      await using server = await createLoopbackServer("ignoresClose");
      const accepted = new EventStream({ clock: fakeClock(), host: loopbackHost(server.port), log: silentLog() });

      // The peer presents a self-signed certificate, which is what a controller presents, so the default connects to it.
      await accepted.opened;
      await accepted.close();

      const verified = new EventStream({ clock: fakeClock(), host: loopbackHost(server.port), log: silentLog(), verifyTls: true });

      // The same peer and the same upgrade, one option apart. Asking for verification against a certificate that cannot provide it fails the connect, and a
      // pre-open failure reaches the caller on the handshake rejection exactly as every other one does.
      await assert.rejects(async () => verified.opened, AccessNetworkError);
      await verified.close();
    });
  });
});

/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * client-modes-shared.test.ts: Tests for what every mode has in common, and for the capability map the connect options produce.
 */
import { AccessAbortedError, AccessConfigurationError } from "../errors.ts";
import type { AccessConnectionTransitionPayload, AccessEventsClosedPayload, AccessHttpRequestStartPayload, AccessStoreDispatchPayload } from "../diagnostics.ts";
import { DEVICES_PATH, DOORS_PATH, DOOR_HUB, DOOR_MINI, HOST, READER_PRO, TOPOLOGY_PATH, connectCapturing, devicesBody, doorsBody, interceptCredentialPass,
  interceptOfficialPass, mockController, officialDoor, topologyBody } from "./client-modes.helpers.ts";
import { TestClock, capturingLog, present, settleUntil, silentLog } from "homebridge-plugin-utils/testing";
import { describe, test } from "node:test";
import { AccessClient } from "./client.ts";
import type { ConnectOptions } from "./client.ts";
import { FakeWebSocket } from "../transport/events-stream.helpers.ts";
import assert from "node:assert/strict";
import { channels } from "../diagnostics.ts";
import { subscribeTo } from "../testing.helpers.ts";

// The success envelope a device command answers with, as a live restart answered on 2026-08-16.
const COMMAND_SUCCESS = JSON.stringify({ "code": 1, "codeS": "SUCCESS", "data": {}, "error": "", "msg": "success" });

/* Connect on an address the client must refuse, and report what the attempt reached before the refusal: every request it started and every notification socket
 * its factory was asked for. The mocked controller answers on its default address and nothing is intercepted, so a request that escaped would be refused by the
 * mock as well as counted here.
 */
async function refusedConnect(host: string, identity: Partial<ConnectOptions>): Promise<{ error: unknown; sockets: number; starts: AccessHttpRequestStartPayload[] }> {

  const { agent } = mockController();
  const starts: AccessHttpRequestStartPayload[] = [];
  let sockets = 0;

  using startSub = subscribeTo(channels.httpRequestStart, (message) => void starts.push(message));

  // A connect that wrongly succeeds is disposed on its way out of the block, so the failure below leaves nothing running behind it.
  try {

    await using client = await AccessClient.connect({ dispatcher: agent, host, log: silentLog(), refreshIntervalMs: false, webSocket: () => {

      sockets++;

      return new FakeWebSocket();
    }, ...identity } as ConnectOptions);
  } catch(error) {

    return { error, sockets, starts };
  }

  return assert.fail(JSON.stringify(host) + " connected where it should have been refused");
}

describe("what every mode has in common", () => {

  test("never asks the official API about emergencies, in any mode", async () => {

    /* The site-wide emergency read is structurally unrelated to a door's own emergency member - it reports two flags for the whole controller - so folding it into
     * a per-door entry would be a category error. It stays a facade read a consumer calls deliberately, and the seed never touches it.
     */
    const { agent, official, pool } = mockController();

    interceptCredentialPass(pool);
    official.intercept({ method: "GET", path: DOORS_PATH }).reply(200, doorsBody([officialDoor({ id: DOOR_HUB, position: "open" })]));

    await using client = (await connectCapturing(agent, { password: "p", token: "t0ken", username: "u" })).client;

    // No interceptor was registered for the emergency endpoint, so a call would have failed the connect outright. Reaching here is the zero-calls proof.
    for(const [ id, entry ] of client.doorStates) {

      assert.equal(Object.hasOwn(entry, "emergency"), false, "no seeded entry for " + id + " carries an emergency member");
    }
  });

  test("tears down every mode's client, whichever transports it built", async () => {

    /* Disposal keys on which transports exist rather than on the mode, and these rows are every reachable combination of that presence - which is why there is no
     * fixture beyond them. Each asserts the observable half of teardown: the notification channel closed, and the state model gone inert.
     *
     * The pools themselves are not observable here, and deliberately so: a transport destroys only a connection pool it built, and every test in this file injects
     * one. What the composition root owns - the ORDER it tears its subsystems down in, and which transports it holds at all - is what these rows cover.
     */
    const rows: { identity: Partial<ConnectOptions>; label: string; official: boolean; withCredentials: boolean }[] = [
      { identity: { password: "p", token: "t0ken", username: "u" }, label: "dual", official: true, withCredentials: true },
      { identity: { password: "p", username: "u" }, label: "credential", official: false, withCredentials: true },
      { identity: { token: "t0ken" }, label: "token", official: true, withCredentials: false }
    ];

    for(const row of rows) {

      const { agent, official, pool } = mockController();

      if(row.withCredentials) {

        interceptCredentialPass(pool);
      }

      if(row.official) {

        official.intercept({ method: "GET", path: DOORS_PATH }).reply(200, doorsBody([officialDoor({ id: DOOR_MINI, position: "close" })]));
      }

      // Only a client with no topology reads the device listing, which is what makes the dual row's absence of this intercept an assertion in its own right.
      if(row.official && !row.withCredentials) {

        official.intercept({ method: "GET", path: DEVICES_PATH }).reply(200, devicesBody());
      }

      // eslint-disable-next-line no-await-in-loop
      const captured = await connectCapturing(agent, row.identity);

      // eslint-disable-next-line no-await-in-loop
      await using client = captured.client;
      const before = captured.client.doorStates;

      assert.equal(captured.ws.closeRequested, false, row.label + " should hold an open notification channel before disposal");

      // eslint-disable-next-line no-await-in-loop
      await client[Symbol.asyncDispose]();

      assert.equal(captured.ws.closeRequested, true, row.label + " should close its notification channel");

      // The store is torn down after the channel that feeds it, so a dispatch arriving afterward changes nothing at all.
      captured.client.state.applyDoorStateFacts([{ "dps": "open", "location_id": DOOR_MINI }]);

      assert.equal(Object.is(captured.client.doorStates, before), true, row.label + " should be inert after disposal");

      // And repeat disposal is safe, which is what makes the explicit call above compatible with the caller's own `await using`.
      // eslint-disable-next-line no-await-in-loop
      await client[Symbol.asyncDispose]();
    }
  });

  test("monitors the throttle of whichever transport backs the channel it is watching", async () => {

    /* The monitor takes a structural throttle source rather than a concrete transport, so connect wires whichever one this mode's channel and probes actually use:
     * the direct transport where there is one, the official transport otherwise. This drives the official transport's own breaker open and asserts the verdict
     * surfaces on the client's connection - which it can only do if that is the transport the monitor was handed.
     */
    const { agent, official } = mockController();

    interceptOfficialPass(official, { doors: doorsBody([]) });

    await using client = (await connectCapturing(agent, { token: "t0ken" })).client;

    assert.equal(client.connection.isThrottled, false);

    // The breaker opens on a run of consecutive failures. Each probe here is the mode's own reachability probe, which goes through the official transport.
    for(let attempt = 0; attempt < 12; attempt++) {

      official.intercept({ method: "GET", path: DOORS_PATH }).reply(500, "");
    }

    for(let attempt = 0; attempt < 12; attempt++) {

      // eslint-disable-next-line no-await-in-loop
      await client.connection.verify().catch(() => undefined);
    }

    assert.equal(client.connection.isThrottled, true, "the official transport's breaker is what this mode's connection reports");
  });

  test("holds only the transports its identities call for", async () => {

    // The presence the disposal guard keys on, read from the outside: a token-only client has no direct transport to tear down, and a credential-only client has
    // no official facade.
    const token = mockController();

    interceptOfficialPass(token.official, { doors: doorsBody([]) });

    await using tokenClient = (await connectCapturing(token.agent, { token: "t0ken" })).client;

    assert.equal(tokenClient.transport, null);
    assert.ok(tokenClient.official, "a token identity establishes the official surface");

    const credential = mockController();

    interceptCredentialPass(credential.pool);

    await using credentialClient = (await connectCapturing(credential.agent, { password: "p", username: "u" })).client;

    assert.ok(credentialClient.transport, "a credential identity establishes the direct transport");
    assert.equal(credentialClient.official, null);
  });
});

describe("the capability map and the options that produce it", () => {

  test("derives the mode from the identities supplied", async () => {

    const cases: { expected: string; identity: Partial<ConnectOptions>; official: boolean }[] = [
      { expected: "credential", identity: { password: "p", username: "u" }, official: false },
      { expected: "token", identity: { token: "t0ken" }, official: true },
      { expected: "dual", identity: { password: "p", token: "t0ken", username: "u" }, official: true }
    ];

    for(const row of cases) {

      const { agent, official, pool } = mockController();

      if(row.identity.password !== undefined) {

        interceptCredentialPass(pool);
      }

      if(row.identity.token !== undefined) {

        official.intercept({ method: "GET", path: DOORS_PATH }).reply(200, doorsBody([]));
      }

      // The device listing is a token-only read, so the dual row deliberately registers no interceptor for it.
      if((row.identity.token !== undefined) && (row.identity.password === undefined)) {

        official.intercept({ method: "GET", path: DEVICES_PATH }).reply(200, devicesBody());
      }

      // eslint-disable-next-line no-await-in-loop
      await using client = (await connectCapturing(agent, row.identity)).client;

      assert.equal(client.capabilities.mode, row.expected);
      assert.equal(client.capabilities.official, row.official);
      assert.equal(client.capabilities.override, "auto", "the default is the routing default rather than an override");
    }
  });

  test("carries the override through to the map", async () => {

    const { agent, official, pool } = mockController();

    interceptCredentialPass(pool);
    official.intercept({ method: "GET", path: DOORS_PATH }).reply(200, doorsBody([]));

    await using client = (await connectCapturing(agent, { api: "direct-only", password: "p", token: "t0ken", username: "u" })).client;

    assert.equal(client.capabilities.override, "direct-only");
  });

  test("refuses an override the supplied identities cannot honor, before anything is sent", async () => {

    /* Both contradictions, as construction-time errors rather than failures at first command. They are value-level facts - which identity was supplied paired with
     * which override - so the compiler cannot catch them and this is where they are caught instead.
     */
    const { agent } = mockController();

    await assert.rejects(async () => AccessClient.connect({ api: "direct-only", dispatcher: agent, host: HOST, log: silentLog(), token: "t0ken" }), TypeError);
    await assert.rejects(async () => AccessClient.connect({ api: "official-only", dispatcher: agent, host: HOST, log: silentLog(), password: "p",
      username: "u" }), TypeError);
  });

  test("refuses an options object with no identity at runtime as well as at compile time", async () => {

    /* The typed surface makes this unwritable, so this covers the caller that reached the runtime without the compiler - untyped JavaScript, or options parsed from
     * a configuration file. It fails as a caller's own error, before any transport is built.
     */
    const { agent } = mockController();

    await assert.rejects(async () => AccessClient.connect({ dispatcher: agent, host: HOST, log: silentLog() } as unknown as ConnectOptions), TypeError);
  });

  test("requires an identity at all, as a compile error", () => {

    // @ts-expect-error - a client with neither credentials nor a token describes no way of reaching a controller.
    const none: ConnectOptions = { host: HOST };

    // @ts-expect-error - a username with no password is not a credential pair, and the token arm's `never` members are what say so.
    const partial: ConnectOptions = { host: HOST, username: "u" };

    // @ts-expect-error - and neither is a password with no username.
    const halfPair: ConnectOptions = { host: HOST, password: "p" };

    const credentials: ConnectOptions = { host: HOST, password: "p", username: "u" };
    const token: ConnectOptions = { host: HOST, token: "t0ken" };
    const both: ConnectOptions = { host: HOST, password: "p", token: "t0ken", username: "u" };

    assert.deepEqual([ none.host, partial.host, halfPair.host, credentials.host, token.host, both.host ], Array(6).fill(HOST));
  });
});

/* Every row here connects on an address whose URL authority differs from what was typed, against a mocked controller answering on exactly the authority's
 * origins, so a URL composed from the address as typed is refused by the mock rather than passing unnoticed.
 */
describe("the controller address", () => {

  test("a dual-mode client on a bracketed literal with a port keeps that port for the console and sets the developer API's own", async () => {

    /* The one address that exercises the console's port rule and the developer API's together: the console's requests and its notification socket keep the
     * configured port, and the official seed reaches the developer API on its own port at the same host. A seed sent anywhere else fails the connect outright, so
     * the official door fact landing is the proof that it reached the developer API.
     */
    const { agent, official, pool } = mockController("[fe80::1]:7443");

    interceptCredentialPass(pool);
    official.intercept({ method: "GET", path: DOORS_PATH }).reply(200, doorsBody([officialDoor({ id: DOOR_HUB, position: "open" })]));

    const captured = await connectCapturing(agent, { password: "p", token: "t0ken", username: "u" }, { host: "[fe80::1]:7443" });

    await using client = captured.client;

    assert.equal(captured.url, "wss://[fe80::1]:7443/proxy/access/api/v2/ws/notification", "the console's socket keeps the configured port");
    assert.equal(client.capabilities.official, true, "the official path stays open");
    assert.equal(client.doorStates.get(DOOR_HUB)?.dps, "open", "the official seed reached the developer API on its own port");
    agent.assertNoPendingInterceptors();
  });

  test("a credential-only client on a bare IPv6 literal brackets it in every URL, the ones composed after connect among them", async () => {

    const { agent, pool } = mockController("[fe80::1]");

    interceptCredentialPass(pool);

    const captured = await connectCapturing(agent, { password: "p", username: "u" }, { host: "fe80::1" });

    await using client = captured.client;

    assert.equal(captured.url, "wss://[fe80::1]/proxy/access/api/v2/ws/notification");

    // The URLs a connect never composes: the on-demand topology fetch, the device commands built on the projection's context, and the recovery probe.
    pool.intercept({ method: "GET", path: TOPOLOGY_PATH }).reply(200, topologyBody());
    pool.intercept({ method: "PUT", path: "/proxy/access/api/v2/device/" + READER_PRO + "/restart" }).reply(200, COMMAND_SUCCESS);
    pool.intercept({ method: "PUT", path: "/proxy/access/api/v2/device/" + READER_PRO + "/settings" }).reply(200, COMMAND_SUCCESS);
    pool.intercept({ method: "GET", path: TOPOLOGY_PATH }).reply(200, topologyBody());

    await client.fetchBootstrap();
    await present(client.device(READER_PRO), "the reader").restart();
    await present(client.device(READER_PRO), "the reader").setAccessMethod("nfc", false);
    await client.connection.verify();

    agent.assertNoPendingInterceptors();
  });

  test("a token-only client on a bare IPv6 literal reaches the developer API on it, bracketed", async () => {

    const { agent, official } = mockController("[fe80::1]");

    interceptOfficialPass(official);

    const captured = await connectCapturing(agent, { token: "t0ken" }, { host: "fe80::1" });

    await using client = captured.client;

    assert.equal(captured.url, "wss://[fe80::1]:12445/api/v1/developer/devices/notifications");

    // The recovery probe is the one official URL a connect never composes.
    official.intercept({ method: "GET", path: DOORS_PATH }).reply(200, doorsBody([]));

    await client.connection.verify();

    agent.assertNoPendingInterceptors();
  });

  /* One row per place the derivation refuses an address it can read: the formatter's zone check, the refusal of credentials ahead of any parse, the URL parser, and the
   * check for more than a host and a port, here for a path. One row is token-only, whose connect builds no direct half at all. Each is refused before a request starts or
   * a socket is built, and each refusal names the address as it quotes it, the address as configured unless a `quoted` form says otherwise.
   */
  const refusals: { host: string; identity: Partial<ConnectOptions>; label: string; quoted?: string }[] = [
    { host: "fe80::1%en0", identity: { password: "p", username: "u" }, label: "an IPv6 zone" },
    { host: "access local", identity: { token: "t0ken" }, label: "a host the URL parser refuses, on a token-only client" },
    { host: "user@10.0.0.1", identity: { password: "p", username: "u" }, label: "credentials", quoted: "***@10.0.0.1" },
    { host: "10.0.0.1/proxy", identity: { password: "p", token: "t0ken", username: "u" }, label: "a path" }
  ];

  for(const row of refusals) {

    test("refuses an address carrying " + row.label + " with the configuration error naming it, before any request", async () => {

      const refused = await refusedConnect(row.host, row.identity);

      assert.ok(refused.error instanceof AccessConfigurationError, JSON.stringify(row.host) + " is refused with the configuration error");
      assert.ok(refused.error.message.includes("\"" + (row.quoted ?? row.host) + "\""), "the refusal names the address as it quotes it");
      assert.deepEqual(refused.starts, [], "no request was started");
      assert.equal(refused.sockets, 0, "no notification socket was built");
    });
  }

  test("refuses a missing host with the configuration error, quoting no value and with no cause, before any request", async () => {

    // A JavaScript consumer's configuration can omit the address, which the cast hands in past the type. The refusal quotes no address, so this test stands apart from
    // the table above, whose rows each find the address in their refusal.
    const refused = await refusedConnect(undefined as unknown as string, { password: "p", username: "u" });

    assert.ok(refused.error instanceof AccessConfigurationError, "a missing host is refused with the configuration error");
    assert.equal(refused.error.message, "The controller address is missing or is not text; set it to the controller's hostname or IP address.",
      "the refusal quotes no value");
    assert.equal(refused.error.cause, undefined, "the refusal carries no cause");
    assert.deepEqual(refused.starts, [], "no request was started");
    assert.equal(refused.sockets, 0, "no notification socket was built");
  });

  test("refuses an address no URL can carry ahead of a signal already aborted, because the options are read before the signal", async () => {

    const { agent } = mockController();
    const options = { dispatcher: agent, log: silentLog(), password: "p", signal: AbortSignal.abort(), username: "u" };

    await assert.rejects(async () => AccessClient.connect({ ...options, host: "fe80::1%en0" }), AccessConfigurationError);
    await assert.rejects(async () => AccessClient.connect({ ...options, host: HOST }), AccessAbortedError, "an address it can carry meets the signal instead");
  });

  test("names the controller by its address as configured on every diagnostics channel and in the sign-in log, while every URL reads its authority", async () => {

    /* A carrier that took the authority in place of the address shows on the channel it feeds: request:start from each transport, the store's dispatches, the
     * stream's close, the connection's transition, or the sign-in line. The clock is a test clock so the recovery a socket fault starts parks before its first
     * attempt, leaving the transition the fault drove as the one to read.
     */
    const { agent, official, pool } = mockController("[fe80::1]");
    const log = capturingLog();

    interceptCredentialPass(pool);
    official.intercept({ method: "GET", path: DOORS_PATH }).reply(200, doorsBody([officialDoor({ id: DOOR_HUB, position: "open" })]));

    const closes: AccessEventsClosedPayload[] = [];
    const dispatches: AccessStoreDispatchPayload[] = [];
    const starts: AccessHttpRequestStartPayload[] = [];
    const transitions: AccessConnectionTransitionPayload[] = [];

    using closedSub = subscribeTo(channels.eventsClosed, (message) => void closes.push(message));
    using dispatchSub = subscribeTo(channels.storeDispatch, (message) => void dispatches.push(message));
    using startSub = subscribeTo(channels.httpRequestStart, (message) => void starts.push(message));
    using transitionSub = subscribeTo(channels.connectionTransition, (message) => void transitions.push(message));

    const captured = await connectCapturing(agent, { clock: new TestClock(), password: "p", token: "t0ken", username: "u" }, { host: "fe80::1", log });

    await using client = captured.client;

    captured.ws.emitError(new Error("socket dropped"));

    await settleUntil(() => transitions.length > 0, { description: "the fault's transition" });

    assert.ok(starts.some((start) => start.url.startsWith("https://[fe80::1]/")), "the console's transport sent requests to the authority");
    assert.ok(starts.some((start) => start.url.startsWith("https://[fe80::1]:12445/")), "and so did the developer API's");
    assert.ok((dispatches.length > 0) && (closes.length > 0), "the store dispatched and the stream closed");

    const hosts = [ ...starts, ...dispatches, ...closes, ...transitions ].map((payload) => payload.host);

    assert.deepEqual([...new Set(hosts)], ["fe80::1"], "every payload names the address as configured");
    assert.deepEqual(present(log.entries.find((entry) => entry.message === "Authenticated with the UniFi Access controller."), "the sign-in line").params,
      [{ host: "fe80::1", username: "u" }], "and so does the sign-in line");
    assert.equal(client.capabilities.mode, "dual");
  });
});

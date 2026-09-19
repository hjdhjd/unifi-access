/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * client-modes-shared.test.ts: Tests for what every mode has in common, and for the capability map the connect options produce.
 */
import { DEVICES_PATH, DOORS_PATH, DOOR_HUB, DOOR_MINI, HOST, connectCapturing, devicesBody, doorsBody, interceptCredentialPass, interceptOfficialPass, mockController,
  officialDoor } from "./client-modes.helpers.ts";
import { describe, test } from "node:test";
import { AccessClient } from "./client.ts";
import type { ConnectOptions } from "./client.ts";
import assert from "node:assert/strict";
import { silentLog } from "homebridge-plugin-utils/testing";

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

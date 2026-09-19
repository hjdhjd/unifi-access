/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * client-modes.helpers.test.ts: Unit tests for the shared rig the client-mode suites are driven through - the mocked controller and the two addresses it answers
 * on, the two interception passes, the wire-body builders, and the capturing connect.
 *
 * The defaults are what have never been driven: the suites that care about a particular listing hand the official pass and the builders their own bodies, so a
 * default that stopped answering the captured listings would still pass every one of them. The supplied logger is the same case read from the other side - a
 * suite that passes one reads a refusal through it, and the default silent logger is what every other test in the tree already drives, so it is stated here
 * rather than asserted a second time.
 *
 * The socket guard inside the capturing connect has no failing direction to drive: every mode builds a notification socket during connect, so the assertion that
 * one was built cannot be made to fire from a test and is recorded here rather than asserted vacuously.
 *
 * No real socket anywhere in this file: net connect is disabled on every agent the rig builds, so a request that escaped the mock would fail rather than leave.
 */
import { CONTROLLER_PATH, DEVICES_PATH, DOORS_PATH, DOOR_MINI, HOST, LOGIN_PATH, SELF_PATH, TOPOLOGY_PATH, connectCapturing, connectCapturingWithDispatch,
  devicesBody, doorsBody, interceptCredentialPass, interceptOfficialPass, mockController, officialDoor } from "./client-modes.helpers.ts";
import { accessOfficialDevicesFixture, accessOfficialDoorsFixture } from "../official/devices.fixtures.ts";
import { describe, test } from "node:test";
import { FakeWebSocket } from "../transport/events-stream.helpers.ts";
import assert from "node:assert/strict";
import { capturingLog } from "homebridge-plugin-utils/testing";
import { channels } from "../diagnostics.ts";
import { request } from "undici";

// The two addresses the rig's controller answers on, spelled out here rather than imported, so a test reads the address it expects rather than the one the rig
// composed for itself.
const OFFICIAL = "https://" + HOST + ":12445";
const DIRECT = "https://" + HOST;

describe("mockController", () => {

  test("the mocked controller refuses any origin but its own two", async () => {

    const { agent, official, pool } = mockController();

    official.intercept({ method: "GET", path: "/probe" }).reply(200, "the official address");
    pool.intercept({ method: "GET", path: "/probe" }).reply(200, "the direct address");

    assert.equal(await (await request(OFFICIAL + "/probe", { dispatcher: agent })).body.text(), "the official address");
    assert.equal(await (await request(DIRECT + "/probe", { dispatcher: agent })).body.text(), "the direct address");
    agent.assertNoPendingInterceptors();

    // Net connect is off, so a request to any third origin is refused locally rather than leaving the process to find out whether anything is there.
    await assert.rejects(async () => request("https://10.9.9.8/elsewhere", { dispatcher: agent }));
  });
});

describe("the interception passes", () => {

  test("the credential pass arms the four reads a credential connect makes", async () => {

    const { agent, pool } = mockController();

    interceptCredentialPass(pool);

    const login = await request(DIRECT + LOGIN_PATH, { dispatcher: agent, method: "POST" });
    const controller = await request(DIRECT + CONTROLLER_PATH, { dispatcher: agent });
    const topology = await request(DIRECT + TOPOLOGY_PATH, { dispatcher: agent });
    const scopes = await request(DIRECT + SELF_PATH, { dispatcher: agent });

    assert.deepEqual([login.headers["set-cookie"]].flat(), ["TOKEN=abc"], "the login leg answers with the cookie the credential session reads");
    assert.deepEqual([ controller.statusCode, topology.statusCode, scopes.statusCode ], [ 200, 200, 200 ],
      "and the three reads that follow it are armed in the order the connect makes them");
    agent.assertNoPendingInterceptors();
  });

  test("the official pass answers the captured listings when no bodies are given, and the supplied bodies when they are", async () => {

    const defaulted = mockController();
    const supplied = mockController();

    interceptOfficialPass(defaulted.official);
    interceptOfficialPass(supplied.official, { doors: doorsBody([]) });

    const captured = await (await request(OFFICIAL + DOORS_PATH, { dispatcher: defaulted.agent })).body.json() as { data: unknown[] };
    const overridden = await (await request(OFFICIAL + DOORS_PATH, { dispatcher: supplied.agent })).body.json() as { data: unknown[] };

    assert.equal(captured.data.length, accessOfficialDoorsFixture.length, "the defaulted doors body is the captured listing");
    assert.deepEqual(overridden.data, [], "and a supplied body is answered in its place");

    // The devices leg of each pass is read too, so the assertions above are about the doors leg alone rather than about a pass left half-consumed.
    await request(OFFICIAL + DEVICES_PATH, { dispatcher: defaulted.agent });
    await request(OFFICIAL + DEVICES_PATH, { dispatcher: supplied.agent });
    defaulted.agent.assertNoPendingInterceptors();
    supplied.agent.assertNoPendingInterceptors();
  });
});

describe("the wire-body builders", () => {

  test("the door and device builders default to the official channel's own spellings and take a supplied one", () => {

    const defaulted = officialDoor({ id: DOOR_MINI, position: "close" });
    const supplied = officialDoor({ id: DOOR_MINI, lock: "unlock", position: "close" });

    assert.equal(defaulted["door_lock_relay_status"], "lock", "the default is the official channel's own locked spelling rather than the stream's");
    assert.equal(supplied["door_lock_relay_status"], "unlock");
    assert.deepEqual((JSON.parse(devicesBody()) as { data: unknown }).data, accessOfficialDevicesFixture, "the defaulted device listing is the captured one");
    assert.deepEqual((JSON.parse(devicesBody([])) as { data: unknown }).data, [], "and a supplied listing is answered in its place");
  });
});

describe("connectCapturing", () => {

  test("the capturing connect hands back the socket it built and carries a supplied logger", async () => {

    const { agent, official } = mockController();
    const log = capturingLog();

    official.intercept({ method: "GET", path: DOORS_PATH }).reply(200, doorsBody(accessOfficialDoorsFixture));
    official.intercept({ method: "GET", path: DEVICES_PATH }).reply(403, "");

    const captured = await connectCapturing(agent, { token: "t0ken" }, { log });

    await using client = captured.client;

    assert.ok(captured.ws instanceof FakeWebSocket, "the socket handed back is the one the injected factory built");
    assert.equal(captured.url, "wss://" + HOST + ":12445/api/v1/developer/devices/notifications");
    assert.equal(log.entries.filter((entry) => (entry.level === "warn") && entry.message.includes("refused this token the device listing")).length, 1,
      "and the refusal the client reported went to the supplied logger rather than to the silent default");
    assert.equal(client.devices.length, 0, "which is the refusal that warning describes");
  });
});

describe("connectCapturingWithDispatch", () => {

  test("the dispatch recorder collects every kind the store dispatched during connect and stops when the connect settles", async () => {

    const { agent, official } = mockController();
    const kinds: string[] = [];

    interceptOfficialPass(official);

    await using client = (await connectCapturingWithDispatch(agent, { token: "t0ken" }, kinds)).client;

    assert.deepEqual(kinds, ["censusApplied"], "one dispatch reached the recorder while the connect was running");

    /* The released direction. The recorder's subscription ends with the call that opened it, so a publication made after the connect returned reaches nobody.
     * Publishing on the channel directly rather than driving the store is what makes the release observable without a second connect.
     */
    channels.storeDispatch.publish({ host: HOST, kind: "bootstrapLoaded" });

    assert.deepEqual(kinds, ["censusApplied"], "and nothing published after it returned was recorded");
    assert.ok(client.capabilities.official, "with the client still held open, so the release is the recorder's own rather than disposal's");
  });
});

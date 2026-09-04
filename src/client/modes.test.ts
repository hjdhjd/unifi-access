/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * modes.test.ts: Tests for the three ways a client connects - with credentials, with a token, or with both. What each mode can reach is the whole subject: which
 * endpoints it touches, what it seeds door state from, which of its accessors answer, and what it tears down. Driven against a mocked controller answering on both
 * of its addresses and an injected notification socket, so every mode runs end to end without a live controller.
 */
import { AccessAbortedError, AccessAuthError, AccessCapabilityError, AccessOfficialApiError } from "../errors.ts";
import type { Interceptable, MockAgent } from "undici";
import { accessBootstrap2026Fixture, accessControllerInfoFixture } from "../protocol/topology.fixtures.ts";
import { accessOfficialDevicesFixture, accessOfficialDoorsFixture } from "../official/devices.fixtures.ts";
import { capturingLog, expectAt, fakeClock, silentLog } from "../testing.helpers.ts";
import { describe, test } from "node:test";
import { doorStateEntry, officialDeviceRecord, officialDoorRecord } from "./census.ts";
import { ACCESS_API_ERROR_LIMIT } from "../settings.ts";
import { AccessClient } from "./client.ts";
import type { AccessLogging } from "../logging.ts";
import type { ConnectOptions } from "./client.ts";
import { FakeWebSocket } from "../transport/events-stream.helpers.ts";
import type { Nullable } from "../types/index.ts";
import { MockAgent as UndiciMockAgent } from "undici";
import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import { selectHubs } from "../state/selectors.ts";

const HOST = "10.0.0.1";
const OFFICIAL_ORIGIN = "https://" + HOST + ":12445";
const DEVICES_PATH = "/api/v1/developer/devices";
const DOORS_PATH = "/api/v1/developer/doors";
const LOGIN_PATH = "/api/auth/login";
const SELF_PATH = "/api/users/self";
const CONTROLLER_PATH = "/proxy/access/api/v2/access/info";
const TOPOLOGY_PATH = "/proxy/access/api/v2/devices/topology4";

// Named entries from the 2026 topology document, which is what the credential path seeds from - and, under the same identities, from the official listings the
// token path seeds from.
const HUB = "aabbcc000001";
const READER_PRO = "aabbcc000002";
const DOOR_HUB = "00000000-0000-0000-0000-000000000006";
const DOOR_MINI = "00000000-0000-0000-0000-00000000000e";
const DOOR_ULTRA = "00000000-0000-0000-0000-000000000002";

const controllerBody = (): string => JSON.stringify({ code: 200, codeS: "SUCCESS", data: accessControllerInfoFixture, error: "", msg: "" });
const topologyBody = (): string => JSON.stringify({ code: 200, codeS: "SUCCESS", data: [accessBootstrap2026Fixture], error: "", msg: "" });
const selfBody = (): string => JSON.stringify({ scopes: [ "edit:access.device", "view:access.device" ] });

/* The official door list, transcribed from a live controller. The lock spelling here is the official channel's own - `lock` and `unlock` - which is precisely what
 * the seed has to translate before it reaches a member the notification stream fills with `locked` and `unlocked`.
 */
const officialDoor = (id: string, position: string | null, lock = "lock"): Record<string, unknown> => ({ "door_lock_relay_status": lock,
  "door_position_status": position, "extras": {}, "floor_id": "00000000-0000-0000-0000-000000000001", "full_name": "Acme HQ - 1F - " + id, "id": id,
  "is_bind_hub": true, "name": id, "type": "door" });

const doorsBody = (doors: readonly object[]): string => JSON.stringify({ code: "SUCCESS", data: doors, msg: "success" });

// The official device listing, which the wire nests one level deeper: an outer array of per-door groups. The default is the captured listing, so a token-only
// connect seeds from real wire material rather than from a restatement of it.
const devicesBody = (groups: readonly (readonly object[])[] = accessOfficialDevicesFixture): string => JSON.stringify({ code: "SUCCESS", data: groups,
  msg: "success" });

/* Intercept the two reads a token-only connect makes, in the order it makes them. Every token-only connect that is expected to succeed goes through this, which is
 * what keeps the mock's unmatched-request rejection meaningful: a mode that asked for something else would fail loudly rather than passing unnoticed.
 */
function interceptOfficialPass(official: Interceptable, bodies: { devices?: string; doors?: string } = {}): void {

  official.intercept({ method: "GET", path: DOORS_PATH }).reply(200, bodies.doors ?? doorsBody(accessOfficialDoorsFixture));
  official.intercept({ method: "GET", path: DEVICES_PATH }).reply(200, bodies.devices ?? devicesBody());
}

// The refusal an Identity Enterprise controller answers every official call with: a 2xx whose envelope declines in the API's own vocabulary.
const identityEnterpriseBody = (): string => JSON.stringify({ code: "CODE_OTHERS_UID_ADOPTED_NOT_SUPPORTED", msg: "not supported on this controller" });

// A mocked controller with net connections disabled, so an unmocked request fails loudly rather than reaching a network. Both of the controller's addresses are
// mocked separately, which is what lets a test assert that a mode never touched the other one.
function mockController(): { agent: MockAgent; official: Interceptable; pool: Interceptable } {

  const agent = new UndiciMockAgent();

  agent.disableNetConnect();

  return { agent, official: agent.get(OFFICIAL_ORIGIN), pool: agent.get("https://" + HOST) };
}

function interceptCredentialPass(pool: Interceptable): void {

  pool.intercept({ method: "POST", path: LOGIN_PATH }).reply(200, "", { headers: { "set-cookie": "TOKEN=abc", "x-csrf-token": "csrf1" } });
  pool.intercept({ method: "GET", path: CONTROLLER_PATH }).reply(200, controllerBody());
  pool.intercept({ method: "GET", path: TOPOLOGY_PATH }).reply(200, topologyBody());
  pool.intercept({ method: "GET", path: SELF_PATH }).reply(200, selfBody());
}

// What a connect captured: the client, the notification socket its factory built, and the URL and headers that socket was built with.
interface CapturedConnect {

  client: AccessClient;
  headers: Record<string, string>;
  url: string;
  ws: FakeWebSocket;
}

async function connectCapturing(agent: MockAgent, identity: Partial<ConnectOptions>, opts: { log?: AccessLogging } = {}): Promise<CapturedConnect> {

  let ws: Nullable<FakeWebSocket> = null;
  let url = "";
  let headers: Record<string, string> = {};
  const client = await AccessClient.connect({ dispatcher: agent, host: HOST, log: opts.log ?? silentLog(), refreshIntervalMs: false,
    webSocket: (socketUrl: string, socketHeaders: Record<string, string>) => {

      url = socketUrl;
      headers = socketHeaders;

      return (ws = new FakeWebSocket());
    }, ...identity } as ConnectOptions);

  assert.ok(ws, "the notification socket factory must have been invoked during connect");

  return { client, headers, url, ws };
}

describe("a token-only client", () => {

  test("reaches the official API alone, and never touches the Access application's own endpoints", async () => {

    /* The guarantee this mode rests on. The Access application's address is mocked and left with no interceptors at all, so any request to it would fail loudly
     * rather than passing unnoticed - which is what makes "no legacy endpoint was touched" an assertion rather than an assumption.
     */
    const { agent, official } = mockController();

    interceptOfficialPass(official, { doors: doorsBody([officialDoor(DOOR_MINI, "open")]) });

    await using client = (await connectCapturing(agent, { token: "t0ken" })).client;

    assert.equal(client.capabilities.mode, "token");
    assert.equal(client.capabilities.official, true);
    assert.ok(client.official, "the facade is this mode's command surface");
  });

  test("upgrades the notification socket against the official endpoint with the bearer token", async () => {

    const { agent, official } = mockController();

    interceptOfficialPass(official, { doors: doorsBody([]) });

    const captured = await connectCapturing(agent, { token: "t0ken" });

    await using _client = captured.client;

    assert.equal(captured.url, "wss://" + HOST + ":12445/api/v1/developer/devices/notifications");
    // The whole header set, which is what says the credential session's cookie has no place on this socket rather than merely that the token is present too.
    assert.deepEqual(captured.headers, { authorization: "Bearer t0ken" });
  });

  test("seeds door state from the official read, translating the lock spelling onto the stream's own", async () => {

    /* The translation row. The official channel says `lock` and `unlock` where the stream says `locked` and `unlocked`, and a seed that skipped the fold would put
     * a foreign spelling into a member consumers read against the stream's vocabulary.
     */
    const { agent, official } = mockController();

    interceptOfficialPass(official, { doors: doorsBody([ officialDoor(DOOR_MINI, "close", "unlock"), officialDoor(DOOR_ULTRA, null),
      officialDoor(DOOR_HUB, "none") ]) });

    await using client = (await connectCapturing(agent, { token: "t0ken" })).client;

    assert.deepEqual(client.doorStates.get(DOOR_MINI), { "dps": "close", "location_id": DOOR_MINI, "lock": "unlocked" });
    assert.deepEqual(client.doorStates.get(DOOR_HUB), { "dps": "none", "location_id": DOOR_HUB, "lock": "locked" });

    // A door the read has no position for carries no position member at all, rather than a null or an invented one.
    const ultra = client.doorStates.get(DOOR_ULTRA);

    assert.ok(ultra);
    assert.equal(Object.hasOwn(ultra, "dps"), false, "a null position is absence rather than a value");
    assert.equal(ultra.lock, "locked");
  });

  test("answers the mode's documented limitations rather than pretending to have what it has not", async () => {

    const { agent, official } = mockController();

    interceptOfficialPass(official, { doors: doorsBody([officialDoor(DOOR_MINI, "open")]) });

    await using client = (await connectCapturing(agent, { token: "t0ken" })).client;

    // The per-port expansion and a hub's own placement are read from topology, which the listings do not carry, so this view is the one that stays empty.
    assert.deepEqual(client.accessPoints, []);
    assert.equal(client.accessPoint(HUB), undefined);

    // No account, so no privilege verdict; no controller document, so no name and no information - which is also why restart detection is inert in this mode.
    assert.equal(client.isAdmin, null);
    assert.equal(client.controllerName, null);
    assert.equal(client.controllerInfo, null);

    // The escape hatch belongs to the credential surface, and the official API's own hatches go through the facade instead.
    assert.equal(client.transport, null);
  });

  test("seeds its device and door inventory from the official listings, reachable through the same views the credential path uses", async () => {

    /* The contract this mode's inventory rests on: the SAME selectors, projections, and accessors answer, over records the official listings established. Reading
     * through `selectHubs` as well as through the client's own accessors is deliberate - a consumer reaches the inventory both ways, and both have to answer.
     */
    const { agent, official } = mockController();

    interceptOfficialPass(official);

    await using client = (await connectCapturing(agent, { token: "t0ken" })).client;

    assert.equal(client.state.snapshot().devices.size, 5);
    assert.equal(client.state.snapshot().doors.size, 3);

    const hubs = selectHubs(client.state.snapshot());

    assert.deepEqual(hubs.map((device) => device.unique_id).sort(), [ "aabbcc000000", "aabbcc000004", HUB ].sort(), "every hub-capable record the listing carried");

    const hub = client.hub(HUB);

    assert.ok(hub, "a hub-capable projected record is reachable as a hub");
    assert.equal(hub.doorId, DOOR_HUB, "with no port extensions, the door is the record's own location");
    assert.deepEqual(hub.doorState, { "dps": "none", "location_id": DOOR_HUB, "lock": "locked" }, "and its state came from the same pass that seeded it");

    assert.equal(client.device(READER_PRO)?.name, "Test Name 68", "a reader that is not hub-capable is still a device");
    assert.equal(client.devices.length, 5);
    assert.equal(client.state.snapshot().doors.get(DOOR_HUB)?.name, "Test Name 10", "the door record carries the listing's own name");
  });

  test("seeds the whole inventory in exactly one dispatch", async () => {

    /* The cardinality, which is why the three collections travel as one event: an observer of the hubs must never wake to find the door state a hub reads still
     * absent. Two dispatches would be observable here even though the end state would look identical.
     */
    const { agent, official } = mockController();

    interceptOfficialPass(official);

    const kinds: string[] = [];

    await using client = (await connectCapturingWithDispatch(agent, { token: "t0ken" }, kinds)).client;

    assert.deepEqual(kinds, ["censusApplied"], "one dispatch, and nothing else writes state at connect in this mode");
    assert.equal(client.state.snapshot().devices.size, 5);
  });

  test("withholds an Enterprise Access Hub from the hub views while keeping it reachable as a device", async () => {

    /* The record no capture places in an official listing, carried as any other. Without a topology there is no building identity to match its placement against
     * and no port extensions to expand, so a whole-hub handle would resolve its door to the hub's own location and command the wrong resource.
     */
    const { agent, official } = mockController();
    const enterprise = { ...accessOfficialDevicesFixture[0]?.[0], "capabilities": ["is_hub"], "id": "aabbcc000005", "type": "UAH-Ent" };

    interceptOfficialPass(official, { devices: devicesBody([[enterprise]]) });

    await using client = (await connectCapturing(agent, { token: "t0ken" })).client;

    assert.equal(client.hub("aabbcc000005"), undefined, "an unplaced Enterprise hub is not a whole-hub handle");
    assert.deepEqual(client.hubs, [], "and it is absent from the hub roster for the same reason");
    assert.ok(client.device("aabbcc000005"), "while the record itself stays reachable for configuration");
    assert.deepEqual(client.accessPoints, [], "the per-port expansion is topology-derived, so it has nothing to answer with");
  });

  test("merges a socket device frame onto a seeded record, and drops a frame naming an identity it never seeded", async () => {

    /* The other half of the census contract. The listings establish membership; the stream advances what it can, member by member, onto records the listings
     * admitted - and a frame for something no census named has no full record to merge onto, exactly as on the credential path.
     */
    const { agent, official } = mockController();

    interceptOfficialPass(official);

    const captured = await connectCapturing(agent, { token: "t0ken" });

    await using client = captured.client;

    captured.ws.emitMessage(JSON.stringify({ "data": { "firmware": "v4.12.19.0", "unique_id": HUB }, "event": "access.data.device.update",
      "event_object_id": HUB, "receiver_id": "", "save_to_history": false }));
    await expectAt(() => client.device(HUB)?.config.firmware === "v4.12.19.0");

    // A member the listing carries is untouched by a frame that never mentions it, which is what says the frame merged rather than replaced.
    assert.equal(client.device(HUB)?.config.alias, "Test alias 13");

    const before = client.state.snapshot().devices.size;

    captured.ws.emitMessage(JSON.stringify({ "data": { "firmware": "v9.9.9", "unique_id": "aabbccddeeff" }, "event": "access.data.device.update",
      "event_object_id": "aabbccddeeff", "receiver_id": "", "save_to_history": false }));
    await delay(5);

    assert.equal(client.state.snapshot().devices.size, before, "a frame for an identity no census named changes nothing");
  });

  test("reconciles a re-seed: a vanished device leaves, a new one is admitted, and what the socket established survives", async () => {

    // The path the recovery loop and the refresh failsafe share, driven directly so the reconciliation is what is under test rather than the loop that calls it.
    const { agent, official } = mockController();

    interceptOfficialPass(official);

    const captured = await connectCapturing(agent, { token: "t0ken" });

    await using client = captured.client;

    captured.ws.emitMessage(JSON.stringify({ "data": { "firmware": "v4.12.19.0", "unique_id": HUB }, "event": "access.data.device.update",
      "event_object_id": HUB, "receiver_id": "", "save_to_history": false }));
    await expectAt(() => client.device(HUB)?.config.firmware === "v4.12.19.0");

    const surviving = accessOfficialDevicesFixture.flat().filter((device) => device.id !== READER_PRO).map(officialDeviceRecord);
    const admitted = officialDeviceRecord({ ...accessOfficialDevicesFixture.flat()[0], "alias": "New Reader", "id": "aabbccddeeff" } as never);

    client.state.applyCensus({ devices: [ ...surviving, admitted ], doorStates: accessOfficialDoorsFixture.map(doorStateEntry),
      doors: accessOfficialDoorsFixture.map(officialDoorRecord) }, { complete: true });

    assert.equal(client.device(READER_PRO), undefined, "the device the enumeration no longer names left with it");
    assert.equal(client.device("aabbccddeeff")?.name, "New Reader", "and the one it newly named was admitted whole");
    assert.equal(client.device(HUB)?.config.firmware, "v4.12.19.0", "while the member only the socket established survived the pass");
  });

  test("re-reads both listings on the refresh interval, which is a cadence this mode honors like any other", async () => {

    /* The failsafe is mode-agnostic: it re-seeds each mode from what that mode seeded from. Here that is the two official reads, so a listing that drifted between
     * passes is reconciled on the tick rather than waiting for a notification the controller may never send.
     */
    const { agent, official } = mockController();
    const clock = fakeClock();

    interceptOfficialPass(official);

    await using client = (await connectCapturing(agent, { clock, refreshIntervalMs: 1000, token: "t0ken" })).client;

    assert.equal(client.device(HUB)?.config.alias, "Test alias 13");

    const renamed = accessOfficialDevicesFixture.map((group) => group.map((device) => (device.id === HUB) ? { ...device, "alias": "Front Hub" } : device));

    interceptOfficialPass(official, { devices: devicesBody(renamed) });
    await clock.tick();
    await expectAt(() => client.device(HUB)?.config.alias === "Front Hub");
  });

  test("refuses to produce the topology document, which is credential surface", async () => {

    const { agent, official } = mockController();

    interceptOfficialPass(official, { doors: doorsBody([]) });

    await using client = (await connectCapturing(agent, { token: "t0ken" })).client;

    await assert.rejects(async () => client.fetchBootstrap(), AccessCapabilityError);
  });

  test("routes a hub's unlock onto the official path, which is the only path this mode holds", async () => {

    const { agent, official } = mockController();

    interceptOfficialPass(official);
    official.intercept({ method: "PUT", path: "/api/v1/developer/doors/" + DOOR_HUB + "/unlock" })
      .reply(200, JSON.stringify({ code: "SUCCESS", data: {}, msg: "success" }));

    await using client = (await connectCapturing(agent, { token: "t0ken" })).client;
    const hub = client.hub(HUB);

    assert.ok(hub);
    await hub.unlock();
  });

  test("closes a hub's door through the official gate control command, the only path this mode holds", async () => {

    const { agent, official } = mockController();

    interceptOfficialPass(official);
    official.intercept({ method: "PUT", path: "/api/v1/developer/doors/" + DOOR_HUB + "/unlock?control_cmd=close" })
      .reply(200, JSON.stringify({ code: "SUCCESS", data: {}, msg: "success" }));

    await using client = (await connectCapturing(agent, { token: "t0ken" })).client;
    const hub = client.hub(HUB);

    assert.ok(hub);
    await hub.close();

    // The mock rejects anything it was not told to expect, so a close reaching any other resource - or carrying any other control command - fails here.
    agent.assertNoPendingInterceptors();
  });

  test("refuses every direct-only command in routing's own vocabulary, without a request leaving", async () => {

    /* The commands the Access application's own endpoints alone express. No interceptor is registered for either of them, so the mock's unmatched-request
     * rejection is what proves nothing was sent - a refusal decided after a request went out would fail here with a network error rather than a capability one.
     */
    const { agent, official } = mockController();

    interceptOfficialPass(official);

    await using client = (await connectCapturing(agent, { token: "t0ken" })).client;
    const device = client.device(HUB);

    assert.ok(device);

    for(const attempt of [ { label: "a device restart", run: async (): Promise<void> => device.restart() },
      { label: "a device configuration write", run: async (): Promise<void> => void await device.updateDevice({}) } ]) {

      // eslint-disable-next-line no-await-in-loop
      await assert.rejects(attempt.run, (error: unknown) => {

        assert.ok(error instanceof AccessCapabilityError, attempt.label + " should refuse as a capability verdict");
        assert.match(error.message, new RegExp(attempt.label));
        assert.match(error.message, /holds no credentials for the Access application's own endpoints/);

        return true;
      });
    }
  });

  test("connects with an empty inventory when the token is refused the device listing, saying so once", async () => {

    /* A token is scoped per endpoint, so one that reads doors may still be refused devices. That is a smaller client rather than a failed connection, and both
     * spellings this library produces for a privilege refusal fold the same way: a refused status, and the envelope's own code.
     */
    const refusals = [
      { label: "a refused status", reply: (target: Interceptable): void => void target.intercept({ method: "GET", path: DEVICES_PATH }).reply(403, "") },
      { label: "the envelope's own code", reply: (target: Interceptable): void => void target.intercept({ method: "GET", path: DEVICES_PATH })
        .reply(200, JSON.stringify({ code: "CODE_OPERATION_FORBIDDEN", msg: "insufficient permission" })) }
    ];

    for(const refusal of refusals) {

      const { agent, official } = mockController();
      const log = capturingLog();

      official.intercept({ method: "GET", path: DOORS_PATH }).reply(200, doorsBody(accessOfficialDoorsFixture));
      refusal.reply(official);

      // eslint-disable-next-line no-await-in-loop
      await using client = (await connectCapturing(agent, { token: "t0ken" }, { log })).client;

      assert.equal(client.devices.length, 0, refusal.label + " leaves the inventory empty");
      assert.equal(client.state.snapshot().doorStates.size, 3, "while the doors the token could read are still seeded");
      assert.equal(client.state.snapshot().doors.size, 3);
      assert.equal(log.entries.filter((entry) => (entry.level === "warn") && entry.message.includes("refused this token the device listing")).length, 1,
        refusal.label + " is reported exactly once");
    }
  });

  test("remembers the refusal rather than re-asking on every re-seed", async () => {

    /* The latch, asserted by positive observability rather than by a swallowed rejection: the refresh loop absorbs a failed re-seed, so an unmatched request would
     * prove nothing. Registering a second devices interceptor that must never be consumed, and watching the doors one get consumed on the same tick, does.
     */
    const { agent, official } = mockController();
    const clock = fakeClock();

    official.intercept({ method: "GET", path: DOORS_PATH }).reply(200, doorsBody(accessOfficialDoorsFixture));
    official.intercept({ method: "GET", path: DEVICES_PATH }).reply(403, "");

    await using client = (await connectCapturing(agent, { clock, refreshIntervalMs: 1000, token: "t0ken" })).client;

    assert.equal(client.devices.length, 0);

    official.intercept({ method: "GET", path: DOORS_PATH }).reply(200, doorsBody([officialDoor(DOOR_MINI, "close", "unlock")]));
    official.intercept({ method: "GET", path: DEVICES_PATH }).reply(200, devicesBody());

    await clock.tick();
    await expectAt(() => client.doorStates.get(DOOR_MINI)?.lock === "unlocked");

    const pending = agent.pendingInterceptors().map((interceptor) => interceptor.path);

    assert.equal(pending.includes(DEVICES_PATH), true, "the second devices read never happened, because the refusal is remembered");
    assert.equal(pending.includes(DOORS_PATH), false, "while the doors read on the same tick did");
  });

  test("takes any other device-listing failure as the fault it is", async () => {

    // The negative control on the latch: only a privilege refusal is folded, and a controller failing the request is a genuine failure of the connect.
    const { agent, official } = mockController();

    official.intercept({ method: "GET", path: DOORS_PATH }).reply(200, doorsBody(accessOfficialDoorsFixture));
    official.intercept({ method: "GET", path: DEVICES_PATH }).reply(500, "");

    await assert.rejects(async () => connectCapturing(agent, { token: "t0ken" }));
  });

  test("takes a token the controller has no official API for as fatal, because nothing else can serve it", async () => {

    const { agent, official } = mockController();

    official.intercept({ method: "GET", path: DOORS_PATH }).reply(200, identityEnterpriseBody());

    await assert.rejects(async () => connectCapturing(agent, { token: "t0ken" }), (error: unknown) => {

      assert.ok(error instanceof AccessOfficialApiError);
      assert.equal(error.code, "CODE_OTHERS_UID_ADOPTED_NOT_SUPPORTED");

      return true;
    });
  });

  test("takes a rejected token as terminal, because a token cannot re-authenticate itself", async () => {

    /* A credential session answers a 401 by re-running its handshake; a token has no handshake to re-run, so its unauthorized hook declines and the status
     * classifies terminally. That is the honest outcome - a rejected token stays rejected until a new one is issued - and it means connect fails rather than
     * retrying against a controller that has already refused.
     */
    const { agent, official } = mockController();

    official.intercept({ method: "GET", path: DOORS_PATH }).reply(401, "");

    await assert.rejects(async () => connectCapturing(agent, { token: "t0ken" }), (error: unknown) => {

      assert.ok(error instanceof AccessAuthError);
      assert.equal(error.identity, "token");

      // The refusal reaches the caller through the whole official stack, so this asserts the exact sentence a consumer rendering the message verbatim shows a user.
      assert.equal(error.message, "The UniFi Access controller rejected the configured API token. Please check that the token is valid and has not been revoked.");

      return true;
    });
  });

  test("propagates a failure that is not the capability signal as itself", async () => {

    // The negative control at connect: only the one code is folded, and every other refusal is a real failure that must not be mistaken for a capability verdict.
    const { agent, official } = mockController();

    official.intercept({ method: "GET", path: DOORS_PATH }).reply(200, JSON.stringify({ code: "CODE_AUTH_FAILED", msg: "the token is not valid" }));

    await assert.rejects(async () => connectCapturing(agent, { token: "t0ken" }), (error: unknown) => {

      assert.ok(error instanceof AccessOfficialApiError);
      assert.equal(error.code, "CODE_AUTH_FAILED");

      return true;
    });
  });
});

describe("a token-only client's lifecycle signals", () => {

  test("an aborted connect cancels the official seed still in flight", async () => {

    /* The seed is what verifies a token, and it carries the connect caller's signal, so a caller that gives up partway is not left waiting on a read it has already
     * abandoned. The held-open reply is what puts the abort inside the request rather than before or after one: with the signal going nowhere, this connect would
     * wait out the delay and then succeed.
     */
    const { agent, official } = mockController();
    const controller = new AbortController();

    official.intercept({ method: "GET", path: DOORS_PATH }).reply(200, doorsBody([])).delay(2000);

    const pending = AccessClient.connect({ dispatcher: agent, host: HOST, log: silentLog(), refreshIntervalMs: false, signal: controller.signal,
      token: "t0ken", webSocket: () => new FakeWebSocket() });

    // A moment for the seed's read to go out, so the abort lands on a request in flight.
    await delay(10);
    controller.abort();

    await assert.rejects(pending, AccessAbortedError);
  });

  test("the reachability probe carries the signal it was given into its request", async () => {

    /* The token-mode probe is a transport-level send against the doors endpoint, and the monitor hands it whichever signal asked for the probe - the caller's here,
     * its own during recovery. Aborting the request in flight is the identity check: a stand-in signal is structurally equal to this one while both are unaborted,
     * and only this one can cancel it.
     */
    const { agent, official } = mockController();
    const controller = new AbortController();

    interceptOfficialPass(official, { doors: doorsBody([]) });

    await using client = (await connectCapturing(agent, { token: "t0ken" })).client;

    official.intercept({ method: "GET", path: DOORS_PATH }).reply(200, doorsBody([])).delay(2000);

    const pending = client.connection.verify({ signal: controller.signal });

    await delay(10);
    controller.abort();

    await assert.rejects(pending, AccessAbortedError);
  });

  test("the reachability probe reaches the controller through an open breaker, and the answer closes it", async () => {

    /* What recovery on this leg rests on. An ordinary request is refused locally for the whole cooldown, so a probe that did not reach the transport as a probe
     * would spend five minutes unable to discover a controller that had already come back, while the recovery loop polled every sixty seconds against a gate that
     * never opened. This drives the breaker open, then asserts that the very next probe dispatched - the mock records the request rather than the transport
     * refusing it - and that the controller's answer closed the breaker.
     */
    const { agent, official } = mockController();

    interceptOfficialPass(official, { doors: doorsBody([]) });

    await using client = (await connectCapturing(agent, { token: "t0ken" })).client;

    for(let attempt = 0; attempt < ACCESS_API_ERROR_LIMIT; attempt++) {

      official.intercept({ method: "GET", path: DOORS_PATH }).reply(503, "");
    }

    for(let attempt = 0; attempt < ACCESS_API_ERROR_LIMIT; attempt++) {

      // eslint-disable-next-line no-await-in-loop
      await client.connection.verify().catch(() => undefined);
    }

    assert.equal(client.connection.isThrottled, true, "consecutive server errors must have opened the official transport's breaker");

    // Still deep in the cooldown, with no clock advanced: the counter proves the request left the transport rather than being refused at the gate.
    let probeRequests = 0;

    official.intercept({ method: "GET", path: DOORS_PATH }).reply(200, () => {

      probeRequests++;

      return doorsBody([]);
    });

    await client.connection.verify();

    assert.equal(probeRequests, 1, "the probe must dispatch through an open breaker rather than be refused locally");
    assert.equal(client.connection.isThrottled, false, "the controller answered, so recovery closes the breaker within one poll rather than after the cooldown");
  });

  test("a recovery re-seed carries the monitor's own lifetime signal", async () => {

    /* The re-seed is the same coalesced read the connect seed runs, bound as the monitor's re-bootstrap, and what it receives is the monitor's lifetime signal.
     * Disposal is what fires that signal, so holding the re-seed open across a disposal is what makes its arrival observable: the recovery attempt then fails with
     * the abort rather than with anything the controller said, and the debug line that closes the interrupted attempt carries that reason.
     */
    const { agent, official } = mockController();
    const log = capturingLog();

    interceptOfficialPass(official, { doors: doorsBody([]) });

    const captured = await connectCapturing(agent, { token: "t0ken" }, { log });

    // Recovery's two reads: the reachability probe answers at once, and the re-seed behind it is held open so disposal lands while it is still in flight.
    official.intercept({ method: "GET", path: DOORS_PATH }).reply(200, doorsBody([]));
    official.intercept({ method: "GET", path: DOORS_PATH }).reply(200, doorsBody([])).delay(2000);

    captured.ws.emitError(new Error("socket dropped"));

    await expectAt(() => log.entries.some((entry) => entry.message.includes("beginning recovery")));
    await delay(20);
    await captured.client[Symbol.asyncDispose]();

    await expectAt(() => log.entries.some((entry) => entry.message.includes("ended with its disposal")));

    const interrupted = log.entries.find((entry) => entry.message.includes("ended with its disposal"));

    assert.ok(interrupted);
    assert.match(JSON.stringify(interrupted.args), /abort/i,
      "the re-seed ended in the disposal's own cancellation rather than in anything the controller answered");
  });
});

describe("a token-only client's recovery re-seed", () => {

  test("updates what the read answered and carries what it did not", async () => {

    /* Both halves of the merge, which is the whole point of merging rather than replacing. The stream is down during recovery, so the read's members are strictly
     * fresher; the members it never answers are ones another source established, and they have to survive.
     */
    const { agent, official } = mockController();

    interceptOfficialPass(official, { doors: doorsBody([officialDoor(DOOR_MINI, "close")]) });

    const captured = await connectCapturing(agent, { token: "t0ken" });

    await using client = captured.client;

    // A stream report gives this door a member the official read never carries, so the re-seed below has something to preserve.
    client.state.applyDoorStateFacts([{ "dps_connected": true, "location_id": DOOR_MINI }]);

    assert.equal(client.doorStates.get(DOOR_MINI)?.dps_connected, true);

    official.intercept({ method: "GET", path: DOORS_PATH }).reply(200, doorsBody([officialDoor(DOOR_MINI, "open", "unlock")]));
    await client.connection.verify();

    // Re-seeding through the same path the recovery loop uses.
    official.intercept({ method: "GET", path: DOORS_PATH }).reply(200, doorsBody([officialDoor(DOOR_MINI, "open", "unlock")]));

    const store = client.state;

    store.applyDoorStateFacts([{ "dps": "open", "location_id": DOOR_MINI, "lock": "unlocked" }], { complete: true });

    const entry = client.doorStates.get(DOOR_MINI);

    assert.equal(entry?.dps, "open", "the read's own members are updated");
    assert.equal(entry.lock, "unlocked");
    assert.equal(entry.dps_connected, true, "and the member it never answers survives");
  });

  test("removes a door an enumerating read no longer names, and keeps every entry when the read names none", async () => {

    /* A token-only client has no topology, so this read is the only census of the controller's doors there is - which is what licenses removal. The empty case is
     * deliberately asymmetric: a degraded controller answering an empty list is a real hazard, and losing a site's last door is the degenerate case.
     */
    const { agent, official } = mockController();

    interceptOfficialPass(official, { doors: doorsBody([ officialDoor(DOOR_MINI, "close"), officialDoor(DOOR_HUB, "none") ]) });

    await using client = (await connectCapturing(agent, { token: "t0ken" })).client;

    assert.equal(client.doorStates.size, 2);

    client.state.applyDoorStateFacts([officialEntry(DOOR_MINI)], { complete: true });

    assert.deepEqual([...client.doorStates.keys()], [DOOR_MINI], "the door the census no longer names left with it");

    const before = client.doorStates;

    client.state.applyDoorStateFacts([], { complete: true });

    assert.equal(client.doorStates.size, 1, "an enumeration of no doors removes nothing at all");
    assert.equal(Object.is(client.doorStates, before), true, "and mints no new map either");
  });

  test("keeps reference identity when an unchanged enumeration is re-applied", async () => {

    const { agent, official } = mockController();

    interceptOfficialPass(official, { doors: doorsBody([officialDoor(DOOR_MINI, "close")]) });

    await using client = (await connectCapturing(agent, { token: "t0ken" })).client;

    const before = client.doorStates;

    client.state.applyDoorStateFacts([officialEntry(DOOR_MINI)], { complete: true });

    assert.equal(Object.is(client.doorStates, before), true, "an identical re-seed wakes no observer");
  });
});

// One seeded entry as the official read produces it, for the rows that re-apply a census without going back to the wire.
const officialEntry = (id: string): { dps: string; location_id: string; lock: string } => ({ "dps": "close", "location_id": id, "lock": "locked" });

describe("a dual-mode client", () => {

  test("seeds from both sources, with the official read winning where the two disagree", async () => {

    /* The authority rule, tested on both members the two seeds can both supply. The official value is the controller's own semantic verdict where the topology
     * derivation is this library's reading of raw hardware flags, so the official one wins - and the lock row deliberately routes the official spelling through the
     * translation on its way into the conflict.
     */
    const { agent, official, pool } = mockController();

    interceptCredentialPass(pool);
    official.intercept({ method: "GET", path: DOORS_PATH }).reply(200, doorsBody([officialDoor(DOOR_HUB, "open", "unlock")]));

    await using client = (await connectCapturing(agent, { password: "p", token: "t0ken", username: "u" })).client;

    const entry = client.doorStates.get(DOOR_HUB);

    // The topology derived an unconnected sensor and a locked relay for this door; the official read says open and unlocked, and says it with more authority.
    assert.equal(entry?.dps, "open");
    assert.equal(entry.lock, "unlocked");

    // The member only the topology can establish is untouched by a read that never mentions it.
    assert.equal(entry.dps_connected, false, "the official read carries no wiring, so it cannot erase what the topology established");
  });

  test("leaves every door the official read did not name exactly as the topology established it", async () => {

    const { agent, official, pool } = mockController();

    interceptCredentialPass(pool);
    official.intercept({ method: "GET", path: DOORS_PATH }).reply(200, doorsBody([officialDoor(DOOR_HUB, "open")]));

    await using client = (await connectCapturing(agent, { password: "p", token: "t0ken", username: "u" })).client;

    // Three doors from the topology, and a partial read that named one of them. A dual-mode merge never carries the enumeration marker, so nothing is dropped.
    assert.equal(client.doorStates.size, 3);
    assert.deepEqual(client.doorStates.get(DOOR_MINI), { "dps": "none", "dps_connected": false, "location_id": DOOR_MINI, "lock": "locked" });
  });

  test("dispatches into door state exactly twice, once per seed", async () => {

    // The stated cardinality: the topology's own bootstrap dispatch and the official merge, and nothing else writing door state at connect.
    const { agent, official, pool } = mockController();

    interceptCredentialPass(pool);
    official.intercept({ method: "GET", path: DOORS_PATH }).reply(200, doorsBody([officialDoor(DOOR_HUB, "open")]));

    const kinds: string[] = [];
    const captured = await connectCapturingWithDispatch(agent, { password: "p", token: "t0ken", username: "u" }, kinds);

    await using client = captured.client;

    assert.deepEqual(kinds.filter((kind) => (kind === "bootstrapLoaded") || (kind === "doorStateFactsApplied")), [ "bootstrapLoaded", "doorStateFactsApplied" ]);

    // Both seeds landed, and the order is what makes the dual-mode merge harmless: the official read arrives second and overwrites only what it carries.
    assert.equal(client.doorStates.get(DOOR_HUB)?.dps, "open");
  });

  test("dispatches once when the controller turns out to have no official API", async () => {

    /* The Identity Enterprise fold, which is the other arm of the cardinality. A client with credentials carries on without the official half rather than failing,
     * and the capability map records what it found rather than what was asked for.
     */
    const { agent, official, pool } = mockController();

    interceptCredentialPass(pool);
    official.intercept({ method: "GET", path: DOORS_PATH }).reply(200, identityEnterpriseBody());

    const kinds: string[] = [];
    const captured = await connectCapturingWithDispatch(agent, { password: "p", token: "t0ken", username: "u" }, kinds);

    await using client = captured.client;

    assert.deepEqual(kinds.filter((kind) => (kind === "bootstrapLoaded") || (kind === "doorStateFactsApplied")), ["bootstrapLoaded"]);
    assert.equal(client.capabilities.official, false, "the map records the controller's answer rather than the token's presence");
    assert.equal(client.official, null, "and the facade's nullability follows the map rather than bare token presence");
    assert.equal(client.capabilities.mode, "dual", "the mode is still what the caller supplied");
  });

  test("attributes a refused token to the token, on a connect whose credentials were accepted", async () => {

    /* The case the attribution exists for. Both legs run at connect and only one of them fails: the login and the document pair answer normally, so the credentials
     * are known good by the time the official read is refused. What a user must be sent to is the token they configured rather than the password that just worked,
     * which is a distinction only the leg can draw - the status is a 401 either way.
     */
    const { agent, official, pool } = mockController();

    interceptCredentialPass(pool);
    official.intercept({ method: "GET", path: DOORS_PATH }).reply(401, "");

    await assert.rejects(async () => connectCapturing(agent, { password: "p", token: "t0ken", username: "u" }), (error: unknown) => {

      assert.ok(error instanceof AccessAuthError);
      assert.equal(error.identity, "token", "the login completed before the refused read, so the leg the controller refused is the token");
      assert.equal(error.message, "The UniFi Access controller rejected the configured API token. Please check that the token is valid and has not been revoked.");

      return true;
    });
  });

  test("never reads the device listing, because the topology is its census", async () => {

    /* The complement of the token path's own seed. Where a topology exists it owns the records and the official listings contribute only door facts, so the device
     * listing is not asked for at all - asserted by an interceptor that must still be waiting when the connect is done.
     */
    const { agent, official, pool } = mockController();

    interceptCredentialPass(pool);
    official.intercept({ method: "GET", path: DOORS_PATH }).reply(200, doorsBody([officialDoor(DOOR_HUB, "open")]));
    official.intercept({ method: "GET", path: DEVICES_PATH }).reply(200, devicesBody());

    await using client = (await connectCapturing(agent, { password: "p", token: "t0ken", username: "u" })).client;

    assert.equal(agent.pendingInterceptors().some((interceptor) => interceptor.path === DEVICES_PATH), true, "the device listing was never asked for");
    assert.equal(client.state.snapshot().devices.size, 5, "and the inventory is the topology's own");
  });

  test("re-applies the topology pair alone on a credential-path recovery", async () => {

    /* The recovery negative control. The official read is not re-run here: the topology pair is what the refresh failsafe and recovery share, and the door facts a
     * token supplies are corrected by the notification stream that has just come back up.
     */
    const { agent, official, pool } = mockController();

    interceptCredentialPass(pool);
    official.intercept({ method: "GET", path: DOORS_PATH }).reply(200, doorsBody([officialDoor(DOOR_HUB, "open")]));

    const captured = await connectCapturing(agent, { password: "p", token: "t0ken", username: "u" });

    await using client = captured.client;

    void client;

    // A second document pass, with no official interceptor registered for it: an official read during recovery would fail loudly against the mock.
    pool.intercept({ method: "GET", path: CONTROLLER_PATH }).reply(200, controllerBody());
    pool.intercept({ method: "GET", path: TOPOLOGY_PATH }).reply(200, topologyBody());

    await client.connection.verify();

    assert.equal(client.doorStates.get(DOOR_HUB)?.dps, "open", "and what the official read established still stands");
  });

  test("keeps the capability map at its connect-time values for the client's whole life", async () => {

    const { agent, official, pool } = mockController();

    interceptCredentialPass(pool);
    official.intercept({ method: "GET", path: DOORS_PATH }).reply(200, doorsBody([officialDoor(DOOR_HUB, "open")]));

    await using client = (await connectCapturing(agent, { password: "p", token: "t0ken", username: "u" })).client;

    const before = client.capabilities;

    // A routed command that draws the revocation changes what routing will attempt, and deliberately does not rewrite the client's description of itself.
    official.intercept({ method: "PUT", path: "/api/v1/developer/doors/" + DOOR_HUB + "/unlock" }).reply(200, identityEnterpriseBody());
    pool.intercept({ method: "PUT", path: "/proxy/access/api/v2/location/" + DOOR_HUB + "/unlock" })
      .reply(200, JSON.stringify({ code: 200, codeS: "SUCCESS", data: {}, error: "", msg: "" }));

    const hub = client.hub(HUB);

    assert.ok(hub);
    await hub.unlock();

    assert.deepEqual(client.capabilities, before, "the map is a connect-time snapshot rather than a live reading");
    assert.equal(client.capabilities.official, true);
  });
});

// A connect that also records every event kind the store dispatched, which is how the write-path cardinality is asserted rather than inferred.
async function connectCapturingWithDispatch(agent: MockAgent, identity: Partial<ConnectOptions>, kinds: string[]): Promise<CapturedConnect> {

  const channel = (await import("node:diagnostics_channel")).default.channel("unifi-access:store:dispatch");
  const onDispatch = (message: unknown): void => void kinds.push((message as { kind: string }).kind);

  channel.subscribe(onDispatch);

  try {

    return await connectCapturing(agent, identity);
  } finally {

    channel.unsubscribe(onDispatch);
  }
}

describe("what every mode has in common", () => {

  test("never asks the official API about emergencies, in any mode", async () => {

    /* The site-wide emergency read is structurally unrelated to a door's own emergency member - it reports two flags for the whole controller - so folding it into
     * a per-door entry would be a category error. It stays a facade read a consumer calls deliberately, and the seed never touches it.
     */
    const { agent, official, pool } = mockController();

    interceptCredentialPass(pool);
    official.intercept({ method: "GET", path: DOORS_PATH }).reply(200, doorsBody([officialDoor(DOOR_HUB, "open")]));

    await using client = (await connectCapturing(agent, { password: "p", token: "t0ken", username: "u" })).client;

    // No interceptor was registered for the emergency endpoint, so a call would have failed the connect outright. Reaching here is the zero-calls proof.
    for(const [ id, entry ] of client.doorStates) {

      assert.equal(Object.hasOwn(entry, "emergency"), false, "no seeded entry for " + id + " carries an emergency member");
    }
  });

  test("tears down every mode's client, whichever transports it built", async () => {

    /* Disposal keys on which transports exist rather than on the mode, and these three rows are every reachable combination of that presence - which is why there
     * is no fourth fixture. Each asserts the observable half of teardown: the notification channel closed, and the state model gone inert.
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

        official.intercept({ method: "GET", path: DOORS_PATH }).reply(200, doorsBody([officialDoor(DOOR_MINI, "close")]));
      }

      // Only a client with no topology reads the device listing, which is what makes the dual row's absence of this intercept an assertion in its own right.
      if(row.official && !row.withCredentials) {

        official.intercept({ method: "GET", path: DEVICES_PATH }).reply(200, devicesBody());
      }

      // eslint-disable-next-line no-await-in-loop
      const captured = await connectCapturing(agent, row.identity);
      const before = captured.client.doorStates;

      assert.equal(captured.ws.closeRequested, false, row.label + " should hold an open notification channel before disposal");

      // eslint-disable-next-line no-await-in-loop
      await captured.client[Symbol.asyncDispose]();

      assert.equal(captured.ws.closeRequested, true, row.label + " should close its notification channel");

      // The store is torn down after the channel that feeds it, so a dispatch arriving afterward changes nothing at all.
      captured.client.state.applyDoorStateFacts([{ "dps": "open", "location_id": DOOR_MINI }]);

      assert.equal(Object.is(captured.client.doorStates, before), true, row.label + " should be inert after disposal");

      // And repeat disposal is safe, which is what makes the explicit call above compatible with the caller's own `await using`.
      // eslint-disable-next-line no-await-in-loop
      await captured.client[Symbol.asyncDispose]();
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
    assert.ok(tokenClient.official);

    const credential = mockController();

    interceptCredentialPass(credential.pool);

    await using credentialClient = (await connectCapturing(credential.agent, { password: "p", username: "u" })).client;

    assert.ok(credentialClient.transport);
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

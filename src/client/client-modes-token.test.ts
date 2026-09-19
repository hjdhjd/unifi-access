/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * client-modes-token.test.ts: Tests for what a client that connects with a token alone can reach - which endpoints it touches, what it seeds door state from,
 * which of its accessors answer, and what it tears down.
 */
import { AccessApiError, AccessAuthError, AccessCapabilityError } from "../errors.ts";
import { DEVICES_PATH, DOORS_PATH, DOOR_HUB, DOOR_MINI, DOOR_ULTRA, HOST, HUB, READER_PRO, connectCapturing, connectCapturingWithDispatch, devicesBody, doorsBody,
  identityEnterpriseBody, interceptOfficialPass, mockController, officialDoor } from "./client-modes.helpers.ts";
import { TestClock, capturingLog, settle } from "homebridge-plugin-utils/testing";
import { accessOfficialDevicesFixture, accessOfficialDoorsFixture } from "../official/devices.fixtures.ts";
import { assertRejectsWith, present, settleUntil } from "../testing.helpers.ts";
import { describe, test } from "node:test";
import { doorStateEntry, officialDeviceRecord, officialDoorRecord } from "./census.ts";
import type { AccessOfficialDevice } from "../official/devices.ts";
import type { Interceptable } from "undici";
import assert from "node:assert/strict";
import { selectHubs } from "../state/selectors.ts";

describe("a token-only client", () => {

  test("reaches the official API alone, and never touches the Access application's own endpoints", async () => {

    /* The guarantee this mode rests on. The Access application's address is mocked and left with no interceptors at all, so any request to it would fail loudly
     * rather than passing unnoticed - which is what makes "no legacy endpoint was touched" an assertion rather than an assumption.
     */
    const { agent, official } = mockController();

    interceptOfficialPass(official, { doors: doorsBody([officialDoor({ id: DOOR_MINI, position: "open" })]) });

    await using client = (await connectCapturing(agent, { token: "t0ken" })).client;

    assert.equal(client.capabilities.mode, "token");
    assert.equal(client.capabilities.official, true);
    assert.ok(client.official, "the facade is this mode's command surface");
  });

  test("upgrades the notification socket against the official endpoint with the bearer token", async () => {

    const { agent, official } = mockController();

    interceptOfficialPass(official, { doors: doorsBody([]) });

    const captured = await connectCapturing(agent, { token: "t0ken" });

    await using client = captured.client;

    assert.equal(captured.url, "wss://" + HOST + ":12445/api/v1/developer/devices/notifications");
    // The whole header set, which is what says the credential session's cookie has no place on this socket rather than merely that the token is present too.
    assert.deepEqual(captured.headers, { authorization: "Bearer t0ken" });
  });

  test("seeds door state from the official read, translating the lock spelling onto the stream's own", async () => {

    /* The translation row. The official channel says `lock` and `unlock` where the stream says `locked` and `unlocked`, and a seed that skipped the fold would put
     * a foreign spelling into a member consumers read against the stream's vocabulary.
     */
    const { agent, official } = mockController();

    interceptOfficialPass(official, { doors: doorsBody([ officialDoor({ id: DOOR_MINI, lock: "unlock", position: "close" }),
      officialDoor({ id: DOOR_ULTRA, position: null }), officialDoor({ id: DOOR_HUB, position: "none" }) ]) });

    await using client = (await connectCapturing(agent, { token: "t0ken" })).client;

    assert.deepEqual(client.doorStates.get(DOOR_MINI), { "dps": "close", "location_id": DOOR_MINI, "lock": "unlocked" });
    assert.deepEqual(client.doorStates.get(DOOR_HUB), { "dps": "none", "location_id": DOOR_HUB, "lock": "locked" });

    // A door the read has no position for carries no position member at all, rather than a null or an invented one.
    const ultra = present(client.doorStates.get(DOOR_ULTRA), "the Ultra's door state");

    assert.equal(Object.hasOwn(ultra, "dps"), false, "a null position is absence rather than a value");
    assert.equal(ultra.lock, "locked");
  });

  test("answers the mode's documented limitations rather than pretending to have what it has not", async () => {

    const { agent, official } = mockController();

    interceptOfficialPass(official, { doors: doorsBody([officialDoor({ id: DOOR_MINI, position: "open" })]) });

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

    /* The cardinality, which is why every collection the census establishes travels as one event: an observer of the hubs must never wake to find the door state
     * a hub reads still absent. Two dispatches would be observable here even though the end state would look identical.
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
    await settleUntil(() => client.device(HUB)?.config.firmware === "v4.12.19.0");

    // A member the listing carries is untouched by a frame that never mentions it, which is what says the frame merged rather than replaced.
    assert.equal(client.device(HUB)?.config.alias, "Test alias 13");

    const before = client.state.snapshot().devices.size;

    captured.ws.emitMessage(JSON.stringify({ "data": { "firmware": "v9.9.9", "unique_id": "aabbccddeeff" }, "event": "access.data.device.update",
      "event_object_id": "aabbccddeeff", "receiver_id": "", "save_to_history": false }));
    await settle();

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
    await settleUntil(() => client.device(HUB)?.config.firmware === "v4.12.19.0");

    const surviving = accessOfficialDevicesFixture.flat().filter((device) => device.id !== READER_PRO).map(officialDeviceRecord);
    const admitted = officialDeviceRecord({ ...accessOfficialDevicesFixture.flat()[0], "alias": "New Reader", "id": "aabbccddeeff" } as unknown as AccessOfficialDevice);

    client.state.applyCensus({ devices: [ ...surviving, admitted ], doorStates: accessOfficialDoorsFixture.map(doorStateEntry),
      doors: accessOfficialDoorsFixture.map(officialDoorRecord) }, { complete: true });

    assert.equal(client.device(READER_PRO), undefined, "the device the enumeration no longer names left with it");
    assert.equal(client.device("aabbccddeeff")?.name, "New Reader", "and the one it newly named was admitted whole");
    assert.equal(client.device(HUB)?.config.firmware, "v4.12.19.0", "while the member only the socket established survived the pass");
  });

  test("re-reads both listings on the refresh interval, which is a cadence this mode honors like any other", async () => {

    /* The failsafe is mode-agnostic: it re-seeds each mode from what that mode seeded from. Here that is the two official reads, so a listing that drifted between
     * passes is reconciled on the wake rather than waiting for a notification the controller may never send.
     */
    const { agent, official } = mockController();
    const clock = new TestClock();

    interceptOfficialPass(official);

    await using client = (await connectCapturing(agent, { clock, refreshIntervalMs: 1000, token: "t0ken" })).client;

    assert.equal(client.device(HUB)?.config.alias, "Test alias 13");

    const renamed = accessOfficialDevicesFixture.map((group) => group.map((device) => (device.id === HUB) ? { ...device, "alias": "Front Hub" } : device));

    interceptOfficialPass(official, { devices: devicesBody(renamed) });
    clock.advance(1000);
    await settle();
    await settleUntil(() => client.device(HUB)?.config.alias === "Front Hub");
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
    const hub = present(client.hub(HUB), "the hub");

    await hub.unlock();
  });

  test("closes a hub's door through the official gate control command, the only path this mode holds", async () => {

    const { agent, official } = mockController();

    interceptOfficialPass(official);
    official.intercept({ method: "PUT", path: "/api/v1/developer/doors/" + DOOR_HUB + "/unlock?control_cmd=close" })
      .reply(200, JSON.stringify({ code: "SUCCESS", data: {}, msg: "success" }));

    await using client = (await connectCapturing(agent, { token: "t0ken" })).client;
    const hub = present(client.hub(HUB), "the hub");

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
    const device = present(client.device(HUB), "the hub");

    for(const attempt of [ { label: "a restart", run: async (): Promise<void> => device.restart() },
      { label: "a configuration write", run: async (): Promise<void> => { await device.updateDevice({}); } } ]) {

      // eslint-disable-next-line no-await-in-loop
      await assertRejectsWith(attempt.run, AccessCapabilityError, { check: (error) => {

        assert.match(error.message, new RegExp(attempt.label));
        assert.match(error.message, /holds no credentials for the Access application's own endpoints/);
      }, message: attempt.label + " should refuse as a capability verdict" });
    }
  });

  test("connects with an empty inventory when the token is refused the device listing, saying so once", async () => {

    /* A token is scoped per endpoint, so one that reads doors may still be refused devices. That is a smaller client rather than a failed connection, and every spelling
     * this library reads as a privilege refusal folds the same way. The cases below are a refused status and the envelope's own code.
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
     * prove nothing. Registering a second devices interceptor that must never be consumed, and watching the doors one get consumed on the same wake, does.
     */
    const { agent, official } = mockController();
    const clock = new TestClock();

    official.intercept({ method: "GET", path: DOORS_PATH }).reply(200, doorsBody(accessOfficialDoorsFixture));
    official.intercept({ method: "GET", path: DEVICES_PATH }).reply(403, "");

    await using client = (await connectCapturing(agent, { clock, refreshIntervalMs: 1000, token: "t0ken" })).client;

    assert.equal(client.devices.length, 0);

    official.intercept({ method: "GET", path: DOORS_PATH }).reply(200, doorsBody([officialDoor({ id: DOOR_MINI, lock: "unlock", position: "close" })]));
    official.intercept({ method: "GET", path: DEVICES_PATH }).reply(200, devicesBody());

    clock.advance(1000);
    await settle();
    await settleUntil(() => client.doorStates.get(DOOR_MINI)?.lock === "unlocked");

    const pending = agent.pendingInterceptors().map((interceptor) => interceptor.path);

    assert.equal(pending.includes(DEVICES_PATH), true, "the second devices read never happened, because the refusal is remembered");
    assert.equal(pending.includes(DOORS_PATH), false, "while the doors read on the same wake did");
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

    await assertRejectsWith(async () => connectCapturing(agent, { token: "t0ken" }), AccessApiError, { check: (error) => {

      assert.equal(error.code, "CODE_OTHERS_UID_ADOPTED_NOT_SUPPORTED");
    } });
  });

  test("takes a rejected token as terminal, because a token cannot re-authenticate itself", async () => {

    /* A credential session answers a 401 by re-running its handshake; a token has no handshake to re-run, so its unauthorized hook declines and the status
     * classifies terminally. That is the honest outcome - a rejected token stays rejected until a new one is issued - and it means connect fails rather than
     * retrying against a controller that has already refused.
     */
    const { agent, official } = mockController();

    official.intercept({ method: "GET", path: DOORS_PATH }).reply(401, "");

    await assertRejectsWith(async () => connectCapturing(agent, { token: "t0ken" }), AccessAuthError, { check: (error) => {

      assert.equal(error.identity, "token");

      // The refusal reaches the caller through the whole official stack, so this asserts the exact sentence a consumer rendering the message verbatim shows a user.
      assert.equal(error.message, "The UniFi Access controller rejected the configured API token. Please check that the token is valid and has not been revoked.");
    } });
  });

  test("propagates a failure that is not the capability signal as itself", async () => {

    // The negative control at connect: only the one code is folded, and every other refusal is a real failure that must not be mistaken for a capability verdict.
    const { agent, official } = mockController();

    official.intercept({ method: "GET", path: DOORS_PATH }).reply(200, JSON.stringify({ code: "CODE_AUTH_FAILED", msg: "the token is not valid" }));

    await assertRejectsWith(async () => connectCapturing(agent, { token: "t0ken" }), AccessApiError, { check: (error) => {

      assert.equal(error.code, "CODE_AUTH_FAILED");
    } });
  });
});

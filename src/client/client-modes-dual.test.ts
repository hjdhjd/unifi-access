/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * client-modes-dual.test.ts: Tests for what a client holding both credentials and a token can reach - which endpoints each half touches, which surface answers a
 * given read, and what it tears down.
 */
import { CONTROLLER_PATH, DEVICES_PATH, DOORS_PATH, TOPOLOGY_PATH, connectCapturing, connectCapturingWithDispatch, controllerBody, countDoorReads, devicesBody,
  doorsBody, identityEnterpriseBody, interceptCredentialPass, mockController, officialDoor, topologyBody } from "./client-modes.helpers.ts";
import { DOOR_HUB, DOOR_MINI, UAH_ID } from "../protocol/capture.helpers.ts";
import type { Interceptable, MockAgent } from "undici";
import { capturingLog, loggedAt, present } from "homebridge-plugin-utils/testing";
import { describe, test } from "node:test";
import type { AccessClient } from "./client.ts";
import { accessOfficialTokenRefusalFixture } from "../official/refusals.fixtures.ts";
import assert from "node:assert/strict";

// The transport's own sentences for a token's privilege refusal and for a refused token, which a closure's warning opens with as they stand.
const TOKEN_FORBIDDEN = "The configured API token lacks the permissions this operation requires on the UniFi Access controller.";
const TOKEN_REFUSED = "The UniFi Access controller refused the configured API token. Please check that the token is valid, has not been revoked, and is allowed to " +
  "view doors, which this library requires of every token.";

describe("a dual-mode client", () => {

  test("seeds from both sources, with the official read winning where the two disagree", async () => {

    /* The authority rule, tested on both members the two seeds can both supply. The official value is the controller's own semantic verdict where the topology
     * derivation is this library's reading of raw hardware flags, so the official one wins - and the lock row deliberately routes the official spelling through the
     * translation on its way into the conflict.
     */
    const { agent, official, pool } = mockController();

    interceptCredentialPass(pool);
    official.intercept({ method: "GET", path: DOORS_PATH }).reply(200, doorsBody([officialDoor({ id: DOOR_HUB, lock: "unlock", position: "open" })]));

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
    official.intercept({ method: "GET", path: DOORS_PATH }).reply(200, doorsBody([officialDoor({ id: DOOR_HUB, position: "open" })]));

    await using client = (await connectCapturing(agent, { password: "p", token: "t0ken", username: "u" })).client;

    // Every door from the topology, and a partial read that named one of them. A dual-mode merge never carries the enumeration marker, so nothing is dropped.
    assert.equal(client.doorStates.size, 3);
    assert.deepEqual(client.doorStates.get(DOOR_MINI), { "dps": "none", "dps_connected": false, "location_id": DOOR_MINI, "lock": "locked" });
  });

  test("dispatches into door state exactly twice, once per seed", async () => {

    // The stated cardinality: the topology's own bootstrap dispatch and the official merge, and nothing else writing door state at connect.
    const { agent, official, pool } = mockController();

    interceptCredentialPass(pool);
    official.intercept({ method: "GET", path: DOORS_PATH }).reply(200, doorsBody([officialDoor({ id: DOOR_HUB, position: "open" })]));

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

  test("says nothing when it folds the controller's report that it has no official API", async () => {

    /* The silent fold beside the one that warns. The map records the Identity Enterprise verdict and nothing on the client can change it, so the connect carries on
     * without the official half and without a warning of its own, where a refused token is said once.
     */
    const { agent, official, pool } = mockController();
    const log = capturingLog();

    interceptCredentialPass(pool);
    official.intercept({ method: "GET", path: DOORS_PATH }).reply(200, identityEnterpriseBody());

    await using client = (await connectCapturing(agent, { password: "p", token: "t0ken", username: "u" }, { log })).client;

    assert.equal(client.capabilities.official, false, "the map records the controller's answer");
    assert.deepEqual(log.entries.filter((entry) => (entry.level === "warn")), [], "and the fold logs no warning");
  });

  test("folds a refused token at connect to credentials-only, saying so once", async () => {

    /* Both legs run at connect and only the token's read is refused, in any of the spellings the controller answers a refused token in: the login and the document pair
     * answer normally, so the credentials are known good and the client holds a direct path for every command they can carry. The refusal closes the official path to
     * every command from the start, a refused permission as much as a rejected token, because the connect fold withholds the facade from the client and its routing
     * alike, and the one warning names the token as the thing to fix, which the capability map alone could not tell apart from a controller that has no official API.
     * The 401 is the captured refusal, and the door listing that settles it is refused the same way, so it reads twice and settles as the token refused.
     */
    const refusals = [

      { body: JSON.stringify(accessOfficialTokenRefusalFixture.body), context: { identity: "token", statusCode: 401 }, doorReads: 2, label: "a 401",
        sentence: TOKEN_REFUSED, status: accessOfficialTokenRefusalFixture.statusCode },
      { body: "", context: { identity: "token", statusCode: 403 }, doorReads: 1, label: "a 403", sentence: TOKEN_FORBIDDEN, status: 403 },
      { body: JSON.stringify({ code: "CODE_AUTH_FAILED", msg: "Authentication failed." }), context: { code: "CODE_AUTH_FAILED" }, doorReads: 1,
        label: "a 200 carrying CODE_AUTH_FAILED", sentence: "Authentication failed.", status: 200 }
    ];

    for(const refusal of refusals) {

      const { agent, official, pool } = mockController();
      const log = capturingLog();

      using doorReads = countDoorReads();

      interceptCredentialPass(pool);
      official.intercept({ method: "GET", path: DOORS_PATH }).reply(refusal.status, refusal.body).times(refusal.doorReads);

      // eslint-disable-next-line no-await-in-loop
      await using client = (await connectCapturing(agent, { password: "p", token: "t0ken", username: "u" }, { log })).client;

      assert.equal(doorReads.count(), refusal.doorReads, refusal.label + ": the door listing was read " + String(refusal.doorReads) + " time(s)");
      assert.equal(client.capabilities.official, false, refusal.label + ": the map records that the official path closed at connect");
      assert.equal(client.official, null, refusal.label + ": and the facade's nullability follows the map");
      assert.equal(client.capabilities.mode, "dual", refusal.label + ": the mode is still what the caller supplied");

      const warns = log.entries.filter((entry) => (entry.level === "warn"));

      assert.deepEqual(warns.map((entry) => entry.params), [[refusal.context]], refusal.label + ": the closure is reported once, carrying the refusal's context");
      assert.ok(warns[0]?.message.startsWith(refusal.sentence + " "), refusal.label + ": the report opens with the refusal's own sentence");
      assert.ok(loggedAt(warns, "warn", "This client's commands will use the Access application's own endpoints for the life of this connection."),
        refusal.label + ": and says every command takes the direct path");
    }
  });

  test("keeps a refused token as itself at connect when held to the official API, which leaves the credentials unused", async () => {

    /* The override holds every routed command to the official path, so a client whose token is refused has nothing that could carry them, and the connect fails on
     * the refusal as the same refusal on a routed command propagates. The login completed before the refused read, so the credentials are known good, and what a
     * user must be sent to is the token they configured rather than the password that just worked - a distinction only the leg can draw.
     */
    const { agent, official, pool } = mockController();

    using doorReads = countDoorReads();

    interceptCredentialPass(pool);
    official.intercept({ method: "GET", path: DOORS_PATH }).reply(401, "").times(2);

    await assert.rejects(async () => connectCapturing(agent, { api: "official-only", password: "p", token: "t0ken", username: "u" }), {

      identity: "token",
      message: TOKEN_REFUSED,
      name: "AccessAuthError"
    });

    assert.equal(doorReads.count(), 2, "the refused read, and the one listing that settled it");
  });

  test("never reads the device listing, because the topology is its census", async () => {

    /* The complement of the token path's own seed. Where a topology exists it owns the records and the official listings contribute only door facts, so the device
     * listing is not asked for at all - asserted by an interceptor that must still be waiting when the connect is done.
     */
    const { agent, official, pool } = mockController();

    interceptCredentialPass(pool);
    official.intercept({ method: "GET", path: DOORS_PATH }).reply(200, doorsBody([officialDoor({ id: DOOR_HUB, position: "open" })]));
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
    official.intercept({ method: "GET", path: DOORS_PATH }).reply(200, doorsBody([officialDoor({ id: DOOR_HUB, position: "open" })]));

    const captured = await connectCapturing(agent, { password: "p", token: "t0ken", username: "u" });

    await using client = captured.client;

    // A second document pass, with no official interceptor registered for it: an official read during recovery would fail loudly against the mock.
    pool.intercept({ method: "GET", path: CONTROLLER_PATH }).reply(200, controllerBody());
    pool.intercept({ method: "GET", path: TOPOLOGY_PATH }).reply(200, topologyBody());

    await client.connection.verify();

    assert.equal(client.doorStates.get(DOOR_HUB)?.dps, "open", "and what the official read established still stands");
  });

  test("keeps the capability map at its connect-time values for the client's whole life", async () => {

    const { agent, official, pool } = mockController();

    interceptCredentialPass(pool);
    official.intercept({ method: "GET", path: DOORS_PATH }).reply(200, doorsBody([officialDoor({ id: DOOR_HUB, position: "open" })]));

    await using client = (await connectCapturing(agent, { password: "p", token: "t0ken", username: "u" })).client;

    const before = client.capabilities;

    // A routed command that draws the revocation changes what routing will attempt, and deliberately does not rewrite the client's description of itself.
    official.intercept({ method: "PUT", path: "/api/v1/developer/doors/" + DOOR_HUB + "/unlock" }).reply(200, identityEnterpriseBody());
    pool.intercept({ method: "PUT", path: "/proxy/access/api/v2/location/" + DOOR_HUB + "/unlock" })
      .reply(200, JSON.stringify({ code: 200, codeS: "SUCCESS", data: {}, error: "", msg: "" }));

    const hub = present(client.hub(UAH_ID), "the hub");

    await hub.unlock();

    assert.deepEqual(client.capabilities, before, "the map is a connect-time snapshot rather than a live reading");
    assert.equal(client.capabilities.official, true);
  });

  describe("a routed command whose official half meets a token 401", () => {

    /* The controller answers a refused token and a token missing a permission with the same 401, so each row answers the routed command's official half with the
     * captured refusal and the settling door listing with whatever decides the row. The closure the client takes is then the one its routing already holds for that
     * verdict, reported once at warn, and the command that met it completes on the direct path or not at all as that closure says.
     */
    const OFFICIAL_UNLOCK = DOORS_PATH + "/" + DOOR_HUB + "/unlock";
    const OFFICIAL_SETTINGS = DEVICES_PATH + "/" + UAH_ID + "/settings";
    const DIRECT_UNLOCK = "/proxy/access/api/v2/location/" + DOOR_HUB + "/unlock";
    const DIRECT_SETTINGS = "/proxy/access/api/v2/device/" + UAH_ID + "/settings";
    const directSuccess = (): string => JSON.stringify({ code: 200, codeS: "SUCCESS", data: {}, error: "", msg: "" });
    const officialSuccess = (data: unknown = {}): string => JSON.stringify({ code: "SUCCESS", data, msg: "success" });

    // A dual client connected with every leg answering normally, its warnings captured, and the door listing its connect seed read already consumed.
    async function connectedDual(): Promise<{ agent: MockAgent; client: AccessClient; log: ReturnType<typeof capturingLog>; official: Interceptable;
      pool: Interceptable; }> {

      const { agent, official, pool } = mockController();
      const log = capturingLog();

      interceptCredentialPass(pool);
      official.intercept({ method: "GET", path: DOORS_PATH }).reply(200, doorsBody([officialDoor({ id: DOOR_HUB, position: "open" })]));

      const { client } = await connectCapturing(agent, { password: "p", token: "t0ken", username: "u" }, { log });

      return { agent, client, log, official, pool };
    }

    test("closes door commands alone on a door command's 401 the door listing confirms", async () => {

      // The token still reads the door listing, so the 401 refused the permission door commands need: the unlock completes on the direct path, the next one goes
      // straight there, and the access-method write keeps its official write and read-back.
      const rig = await connectedDual();

      await using client = rig.client;

      using doorReads = countDoorReads();

      rig.official.intercept({ method: "PUT", path: OFFICIAL_UNLOCK }).reply(accessOfficialTokenRefusalFixture.statusCode, accessOfficialTokenRefusalFixture.body);
      rig.official.intercept({ method: "GET", path: DOORS_PATH }).reply(200, doorsBody([officialDoor({ id: DOOR_HUB, position: "open" })]));
      rig.pool.intercept({ method: "PUT", path: DIRECT_UNLOCK }).reply(200, directSuccess()).times(2);

      const hub = present(client.hub(UAH_ID), "the hub");

      await hub.unlock();
      await hub.unlock();

      const warns = rig.log.entries.filter((entry) => (entry.level === "warn"));

      assert.equal(doorReads.count(), 1, "the 401 was settled by one door listing");
      assert.deepEqual(warns.map((entry) => entry.params), [[{ identity: "token", statusCode: 401 }]], "the closure is reported once, at the controller's status");
      assert.ok(warns[0]?.message.startsWith(TOKEN_FORBIDDEN + " "), "and opens with the token's privilege sentence");
      assert.ok(loggedAt(warns, "warn", "This client's door commands will use the Access application's own endpoints for the life of this connection."),
        "and says the door commands take the direct path");

      rig.official.intercept({ method: "PUT", path: OFFICIAL_SETTINGS }).reply(200, officialSuccess());
      rig.official.intercept({ method: "GET", path: OFFICIAL_SETTINGS })
        .reply(200, officialSuccess({ "access_methods": { nfc: { enabled: "no" } }, "device_id": UAH_ID }));

      await present(client.device(UAH_ID), "the hub").setAccessMethod("nfc", false);

      rig.agent.assertNoPendingInterceptors();
    });

    test("closes nothing on an access-method write's 401 the door listing confirms", async () => {

      // The write needs a permission no door command does, so its refusal speaks for the write alone: the write completes on its direct half as a command safe to
      // repeat, nothing is reported, and the next door command still takes the official path.
      const rig = await connectedDual();

      await using client = rig.client;

      using doorReads = countDoorReads();

      rig.official.intercept({ method: "PUT", path: OFFICIAL_SETTINGS }).reply(accessOfficialTokenRefusalFixture.statusCode, accessOfficialTokenRefusalFixture.body);
      rig.official.intercept({ method: "GET", path: DOORS_PATH }).reply(200, doorsBody([officialDoor({ id: DOOR_HUB, position: "open" })]));
      rig.pool.intercept({ method: "PUT", path: DIRECT_SETTINGS }).reply(200, "{}");

      await present(client.device(UAH_ID), "the hub").setAccessMethod("nfc", false);

      assert.equal(doorReads.count(), 1, "the 401 was settled by one door listing");
      assert.deepEqual(rig.log.entries.filter((entry) => (entry.level === "warn")), [], "and no closure was reported");

      rig.official.intercept({ method: "PUT", path: OFFICIAL_UNLOCK }).reply(200, officialSuccess("success"));

      await present(client.hub(UAH_ID), "the hub").unlock();

      rig.agent.assertNoPendingInterceptors();
    });

    test("closes every command when the door listing is refused as well", async () => {

      // A token refused the door listing every token must be allowed is the token refused: the unlock completes on the direct path, and the access-method write
      // after it goes straight there too.
      const rig = await connectedDual();

      await using client = rig.client;

      using doorReads = countDoorReads();

      rig.official.intercept({ method: "PUT", path: OFFICIAL_UNLOCK }).reply(accessOfficialTokenRefusalFixture.statusCode, accessOfficialTokenRefusalFixture.body);
      rig.official.intercept({ method: "GET", path: DOORS_PATH }).reply(accessOfficialTokenRefusalFixture.statusCode, accessOfficialTokenRefusalFixture.body);
      rig.pool.intercept({ method: "PUT", path: DIRECT_UNLOCK }).reply(200, directSuccess());
      rig.pool.intercept({ method: "PUT", path: DIRECT_SETTINGS }).reply(200, "{}");

      await present(client.hub(UAH_ID), "the hub").unlock();
      await present(client.device(UAH_ID), "the hub").setAccessMethod("nfc", false);

      const warns = rig.log.entries.filter((entry) => (entry.level === "warn"));

      assert.equal(doorReads.count(), 1, "the 401 was settled by one door listing");
      assert.deepEqual(warns.map((entry) => entry.params), [[{ identity: "token", statusCode: 401 }]], "the closure is reported once");
      assert.ok(warns[0]?.message.startsWith(TOKEN_REFUSED + " "), "and opens with the refused token's sentence");
      assert.ok(loggedAt(warns, "warn", "This client's commands will use the Access application's own endpoints for the life of this connection."),
        "and says every command takes the direct path");

      rig.agent.assertNoPendingInterceptors();
    });
  });
});

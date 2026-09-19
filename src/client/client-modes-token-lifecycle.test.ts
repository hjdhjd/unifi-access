/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * client-modes-token-lifecycle.test.ts: Tests for the lifecycle signals a token-only client raises and for the census it re-seeds from when its connection
 * recovers.
 */
import { DOORS_PATH, DOOR_HUB, DOOR_MINI, HOST, connectCapturing, doorsBody, interceptOfficialPass, mockController, officialDoor } from "./client-modes.helpers.ts";
import { capturingLog, silentLog } from "homebridge-plugin-utils/testing";
import { describe, test } from "node:test";
import { present, settleUntil, subscribeTo } from "../testing.helpers.ts";
import { ACCESS_API_ERROR_LIMIT } from "../settings.ts";
import { AccessAbortedError } from "../errors.ts";
import { AccessClient } from "./client.ts";
import { FakeWebSocket } from "../transport/events-stream.helpers.ts";
import assert from "node:assert/strict";
import { channels } from "../diagnostics.ts";

describe("a token-only client's lifecycle signals", () => {

  test("an aborted connect cancels the official seed still in flight", async () => {

    /* The seed is what verifies a token, and it carries the connect caller's signal, so a caller that gives up partway is not left waiting on a read it has already
     * abandoned. The held-open reply is what puts the abort inside the request rather than before or after one: with the signal going nowhere, this connect would
     * wait out the delay and then succeed.
     */
    const { agent, official } = mockController();
    const controller = new AbortController();

    official.intercept({ method: "GET", path: DOORS_PATH }).reply(200, doorsBody([])).delay(2000);

    /* The seed's dispatch is counted on the transport's start signal, so the abort lands on a request provably in flight rather than after an elapsed wait.
     * The held-open reply is the margin that abort lands inside.
     */
    let starts = 0;

    using startSub = subscribeTo(channels.httpRequestStart, (message) => {

      if(message.url.includes(DOORS_PATH)) {

        starts++;
      }
    });

    const pending = AccessClient.connect({ dispatcher: agent, host: HOST, log: silentLog(), refreshIntervalMs: false, signal: controller.signal,
      token: "t0ken", webSocket: () => new FakeWebSocket() });

    await settleUntil(() => starts === 1, { message: "expected the seed's read to be dispatched" });
    controller.abort();

    await assert.rejects(pending, AccessAbortedError);
  });

  test("a signal already aborted before connect rejects before any request is sent", async () => {

    /* No interceptor is armed here, because nothing should reach one: the connect is expected to refuse at its pre-flight, and the mock's disabled net connect
     * would fail loudly on anything it did dispatch. The counter is what proves nothing was dispatched, as the seed test's counter proves its read was.
     */
    const { agent } = mockController();
    const controller = new AbortController();

    controller.abort();

    let starts = 0;

    using startSub = subscribeTo(channels.httpRequestStart, () => {

      starts++;
    });

    await assert.rejects(AccessClient.connect({ dispatcher: agent, host: HOST, log: silentLog(), refreshIntervalMs: false, signal: controller.signal,
      token: "t0ken", webSocket: () => new FakeWebSocket() }), AccessAbortedError);

    assert.equal(starts, 0, "an aborted signal must not dispatch any request");
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

    /* The probe's own dispatch is counted on the transport's start signal, with the subscription placed after the connect seed so the first start it sees is
     * the probe's. That is what puts the abort inside the request; the held-open reply is the margin it lands inside.
     */
    let starts = 0;

    using startSub = subscribeTo(channels.httpRequestStart, (message) => {

      if(message.url.includes(DOORS_PATH)) {

        starts++;
      }
    });

    const pending = client.connection.verify({ signal: controller.signal });

    await settleUntil(() => starts === 1, { message: "expected the probe's read to be dispatched" });
    controller.abort();

    await assert.rejects(pending, AccessAbortedError);
  });

  test("the reachability probe reaches the controller through an open breaker, and the answer closes it", async () => {

    /* What recovery on this leg rests on. An ordinary request is refused locally for the whole `ACCESS_API_RETRY_INTERVAL` cooldown, so a probe that did not reach
     * the transport as a probe would spend that entire window unable to discover a controller that had already come back, while the recovery loop polled at its own
     * `ACCESS_RECOVERY_STEADY_INTERVAL_MS` cadence against a gate that never opened. This drives the breaker open, then asserts that the very next probe dispatched -
     * the mock records the request rather than the transport refusing it - and that the controller's answer closed the breaker.
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

    await using client = captured.client;

    // Recovery's two reads: the reachability probe answers at once, and the re-seed behind it is held open so disposal lands while it is still in flight.
    official.intercept({ method: "GET", path: DOORS_PATH }).reply(200, doorsBody([]));
    official.intercept({ method: "GET", path: DOORS_PATH }).reply(200, doorsBody([])).delay(2000);

    /* Recovery's two reads are counted on the transport's start signal rather than waited out: the probe is the first start after the socket error and the
     * re-seed is the second, so disposal is placed on a re-seed provably in flight. The held-open reply is the margin the disposal's abort lands inside.
     */
    let starts = 0;

    using startSub = subscribeTo(channels.httpRequestStart, (message) => {

      if(message.url.includes(DOORS_PATH)) {

        starts++;
      }
    });

    captured.ws.emitError(new Error("socket dropped"));

    await settleUntil(() => log.entries.some((entry) => entry.message.includes("beginning recovery")));
    await settleUntil(() => starts === 2, { message: "expected the probe and the re-seed behind it to be dispatched" });
    await client[Symbol.asyncDispose]();

    await settleUntil(() => log.entries.some((entry) => entry.message.includes("ended with its disposal")));

    const interrupted = present(log.entries.find((entry) => entry.message.includes("ended with its disposal")), "the interrupted re-seed entry");

    assert.match(JSON.stringify(interrupted.params), /abort/i,
      "the re-seed ended in the disposal's own cancellation rather than in anything the controller answered");
  });
});

// One seeded entry as the official read produces it, for the rows that re-apply a census without going back to the wire.
const officialEntry = (id: string): { dps: string; location_id: string; lock: string } => ({ "dps": "close", "location_id": id, "lock": "locked" });

describe("a token-only client's recovery re-seed", () => {

  test("updates what the read answered and carries what it did not", async () => {

    /* Both halves of the merge, which is the whole point of merging rather than replacing. The stream is down during recovery, so the read's members are strictly
     * fresher; the members it never answers are ones another source established, and they have to survive.
     */
    const { agent, official } = mockController();

    interceptOfficialPass(official, { doors: doorsBody([officialDoor({ id: DOOR_MINI, position: "close" })]) });

    const captured = await connectCapturing(agent, { token: "t0ken" });

    await using client = captured.client;

    // A stream report gives this door a member the official read never carries, so the re-seed below has something to preserve.
    client.state.applyDoorStateFacts([{ "dps_connected": true, "location_id": DOOR_MINI }]);

    assert.equal(client.doorStates.get(DOOR_MINI)?.dps_connected, true);

    official.intercept({ method: "GET", path: DOORS_PATH }).reply(200, doorsBody([officialDoor({ id: DOOR_MINI, lock: "unlock", position: "open" })]));
    await client.connection.verify();

    // Re-seeding through the same path the recovery loop uses.
    official.intercept({ method: "GET", path: DOORS_PATH }).reply(200, doorsBody([officialDoor({ id: DOOR_MINI, lock: "unlock", position: "open" })]));

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

    interceptOfficialPass(official, { doors: doorsBody([ officialDoor({ id: DOOR_MINI, position: "close" }), officialDoor({ id: DOOR_HUB, position: "none" }) ]) });

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

    interceptOfficialPass(official, { doors: doorsBody([officialDoor({ id: DOOR_MINI, position: "close" })]) });

    await using client = (await connectCapturing(agent, { token: "t0ken" })).client;

    const before = client.doorStates;

    client.state.applyDoorStateFacts([officialEntry(DOOR_MINI)], { complete: true });

    assert.equal(Object.is(client.doorStates, before), true, "an identical re-seed wakes no observer");
  });
});

/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * device.helpers.test.ts: Unit tests for the shared rig the device suites are driven through - the registry-over-a-real-store fixture, the interceptor that
 * answers one path, and the two door-state builders.
 *
 * The interceptor's defaults are what have never been driven: the suites that assert a refusal hand it a status and a body of their own, so a default that
 * stopped answering 200 with the success envelope would still pass every one of them. The packet builder's extras are the same case from the other side - the
 * suites that need a malformed member supply one, and the empty spread nothing exercises is what says the builder adds no key of its own when handed none.
 *
 * The method fallback inside the interceptor's reply callback has no absent direction to drive: undici hands that callback a method on every dispatch, so the
 * empty-string arm cannot be reached from a test and is recorded here rather than asserted vacuously.
 */
import { DOOR_HUB, HUB, REFUSED, SUCCESS, deviceFixture, doorStateEvent, intercept, wirePacket } from "./device.helpers.ts";
import { describe, test } from "node:test";
import type { AccessEventPacket } from "../types/index.ts";
import { accessBootstrap2026Fixture } from "../protocol/topology.fixtures.ts";
import assert from "node:assert/strict";
import { classifyPacket } from "../protocol/events.ts";
import { topologyDevices } from "../testing.helpers.ts";
import { url } from "../transport/mock-controller.helpers.ts";

describe("deviceFixture", () => {

  test("the fixture seeds a registry over the document it is handed", () => {

    const fixture = deviceFixture(accessBootstrap2026Fixture);

    assert.equal(fixture.store.snapshot().devices.size, topologyDevices(accessBootstrap2026Fixture).length,
      "every device the document describes reached the store the registry stands over");
    assert.ok(fixture.registry.device(HUB), "and the registry answers for one of them");
    assert.deepEqual(fixture.captured, [], "nothing has been asked of the wire yet");
    assert.equal(fixture.ctx.transport, fixture.mock.transport, "the context carries the mock's own transport rather than a second one built beside it");
  });
});

describe("intercept", () => {

  test("the interceptor answers the success envelope at 200 when no reply is given, and records the request", async () => {

    const fixture = deviceFixture(accessBootstrap2026Fixture);

    intercept(fixture, { method: "GET", path: "/probe" });

    const response = await fixture.mock.transport.send(url(fixture.mock.host, "/probe"));

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.toString("utf8"), SUCCESS, "the defaulted body is the rig's own success envelope");
    assert.deepEqual(fixture.captured, [{ body: undefined, method: "GET", path: "/probe" }], "and a request carrying no body records as one that carried none");
  });

  test("the interceptor answers the supplied status and body, and records the body bytes as delivered", async () => {

    const fixture = deviceFixture(accessBootstrap2026Fixture);
    const sent = "{\"x\":1}";

    intercept(fixture, { body: REFUSED, method: "POST", path: "/probe", status: 400 });

    const response = await fixture.mock.transport.send(url(fixture.mock.host, "/probe"), { body: sent, method: "POST" });

    assert.equal(response.statusCode, 400);
    assert.equal(response.body.toString("utf8"), REFUSED);
    assert.deepEqual(fixture.captured, [{ body: sent, method: "POST", path: "/probe" }], "the bytes recorded are the bytes the caller handed the transport");
  });
});

describe("the door-state builders", () => {

  test("the door-state builder frames a report for the hub's door", () => {

    const event = doorStateEvent(DOOR_HUB, "locked");

    assert.ok(event.kind === "doorStateChanged", "the builder produces a door-state report and nothing else");
    assert.equal(event.device?.id, HUB, "framed as the hub's own report, whichever of its doors the report names");
    assert.equal(event.states[0].location_id, DOOR_HUB);
    assert.equal(event.states[0].lock, "locked");
  });

  test("the packet builder spreads the extras over the location state and adds nothing when there are none", () => {

    const bare = wirePacket(DOOR_HUB, "locked");
    const withAlarms = wirePacket(DOOR_HUB, "locked", { "alarms": [] });

    const stateOf = (packet: AccessEventPacket): Record<string, unknown> => {

      const [state] = packet.data?.["location_states"] as Record<string, unknown>[];

      assert.ok(state, "the builder frames exactly one location state");

      return state;
    };

    assert.deepEqual(Object.keys(stateOf(bare)), [ "alarms", "dps", "dps_connected", "emergency", "is_unavailable", "location_id", "lock" ],
      "the state carries the builder's own members and nothing else when no extras are handed in");
    assert.equal(stateOf(bare)["alarms"], undefined, "with the alarms member present and empty rather than absent");
    assert.deepEqual(stateOf(withAlarms)["alarms"], [], "an extra fills the member it names");
    assert.deepEqual(Object.keys(stateOf(withAlarms)), Object.keys(stateOf(bare)), "rather than adding a key beside it");

    // Both readings go through the classifier as well, because a builder that produced a shape the admission contract rejects would still satisfy the key
    // assertions above while every suite driving state through it silently stopped seeing door-state events.
    assert.equal(classifyPacket(bare)?.kind, "doorStateChanged");
    assert.equal(classifyPacket(withAlarms)?.kind, "doorStateChanged");
  });
});

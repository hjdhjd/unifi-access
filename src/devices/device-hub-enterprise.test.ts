/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * device-hub-enterprise.test.ts: Tests for the Enterprise Access Hub port matrix - each port surfacing as its own handle while the whole-hub record stays out of
 * the hub views, the door a given port addresses, and the uplink each synthesized port and the hardware carrying it report.
 */
import { DOOR_MINI, EAH_DOOR_2, EAH_HUB, EAH_PORT_2, EAH_PORT_3, HUB, READER, deviceFixture, doorStateEvent, intercept } from "./device.helpers.ts";
import { accessBootstrap2026Fixture, accessBootstrapEahFixture } from "../protocol/topology.fixtures.ts";
import { describe, test } from "node:test";
import { present, settleUntil } from "../testing.helpers.ts";
import assert from "node:assert/strict";
import { settle } from "homebridge-plugin-utils/testing";

describe("the Enterprise Access Hub port matrix", () => {

  test("every port surfaces as its own handle while the whole-hub record is withheld from the hub views", () => {

    const { registry } = deviceFixture(accessBootstrapEahFixture);
    const points = registry.accessPoints();

    assert.equal(points.length, 8, "one handle per door-serving port");
    assert.ok(points.every((point) => point.id !== EAH_HUB), "no handle carries the whole hub's identity");

    // The two hub accessors share one predicate, so both must withhold the record - and both are asserted, because a consumer can arrive through either.
    assert.equal(registry.hub(EAH_HUB), undefined, "the whole-hub record answers no hub handle");
    assert.ok(!registry.hubs().some((hub) => hub.id === EAH_HUB), "and it is absent from the collection too");

    // It stays fully reachable for configuration, which is what makes the withholding a routing decision rather than a hidden record.
    assert.equal(registry.device(EAH_HUB)?.id, EAH_HUB);
    assert.equal(registry.device(EAH_HUB)?.config.device_type, "UAH-Ent");

    assert.equal(registry.accessPoint(EAH_PORT_2)?.id, EAH_PORT_2);
    assert.equal(registry.accessPoint("no-such-port"), undefined);
  });

  test("two ports' unlocks address two different doors", async () => {

    const fixture = deviceFixture(accessBootstrapEahFixture);
    const port2 = present(fixture.registry.accessPoint(EAH_PORT_2), "port 2");
    const port3 = present(fixture.registry.accessPoint(EAH_PORT_3), "port 3");

    const door2 = port2.config.location_id;
    const door3 = port3.config.location_id;

    assert.equal(door2, EAH_DOOR_2);
    assert.notEqual(door2, door3, "the two ports serve different doors");

    intercept(fixture, { method: "PUT", path: "/proxy/access/api/v2/location/" + door2 + "/unlock" });
    intercept(fixture, { method: "PUT", path: "/proxy/access/api/v2/location/" + door3 + "/unlock" });

    await port2.unlock();
    await port3.unlock();

    // The synthesized record carries the port's own door and no extensions, so each handle resolves to its own door by construction.
    assert.deepEqual(fixture.captured.map((request) => request.path),
      [ "/proxy/access/api/v2/location/" + door2 + "/unlock", "/proxy/access/api/v2/location/" + door3 + "/unlock" ]);
  });

  test("a port's device-scoped command keys on the port's own identity", async () => {

    const fixture = deviceFixture(accessBootstrapEahFixture);
    const port2 = present(fixture.registry.accessPoint(EAH_PORT_2), "port 2");

    assert.equal(port2.config.unique_id, EAH_PORT_2, "the handle reads the synthesized record rather than the hub's");

    intercept(fixture, { method: "PUT", path: "/proxy/access/api/v2/device/" + EAH_PORT_2 + "/lock_rule?get_result=true" });

    await port2.setLockRule({ type: "reset" });

    assert.ok(fixture.captured[0]?.path.startsWith("/proxy/access/api/v2/device/" + EAH_PORT_2 + "/"), "the lock rule is sent to the port's own device path");
  });

  test("each port handle reads its own door's state and not a sibling's", () => {

    const { registry, store } = deviceFixture(accessBootstrapEahFixture);
    const port2 = present(registry.accessPoint(EAH_PORT_2), "port 2");
    const port3 = present(registry.accessPoint(EAH_PORT_3), "port 3");

    const door2 = port2.config.location_id;
    const door3 = port3.config.location_id;

    // Two doors reporting different states, so reading one handle's state cannot accidentally satisfy the other's assertion.
    store.dispatch(doorStateEvent(door2, "unlocked"));
    store.dispatch(doorStateEvent(door3, "locked"));

    assert.equal(port2.doorState?.lock, "unlocked");
    assert.equal(port2.doorState?.location_id, door2);
    assert.equal(port3.doorState?.lock, "locked");
    assert.equal(port3.doorState?.location_id, door3);
  });

  test("a port handle observes through the expansion and survives an unrelated device's change", async () => {

    const { registry, store } = deviceFixture(accessBootstrapEahFixture);
    const port2 = present(registry.accessPoint(EAH_PORT_2), "port 2");

    const ac = new AbortController();
    const seen: string[] = [];
    const done = (async (): Promise<void> => {

      for await (const updated of port2.observe({ signal: ac.signal })) {

        seen.push(updated.config.ip ?? "");
      }
    })();

    await settle();

    // A device that is not this port's hub changes: the port's own record is rebuilt from an unchanged hub record, so its observer must stay asleep.
    store.dispatch({ eventName: "access.data.device.update", id: "aabbcc000008", kind: "deviceChanged", payload: { "ip": "172.16.9.9" } });
    await settle();
    assert.equal(seen.length, 0, "an unrelated device must not wake a port handle");

    // Its own hub changing does wake it.
    store.dispatch({ eventName: "access.data.device.update", id: EAH_HUB, kind: "deviceChanged", payload: { "ip": "172.16.9.8" } });
    await settleUntil(() => seen.length === 1);
    assert.deepEqual(seen, ["172.16.9.8"]);

    ac.abort();
    await done;
  });

  /* The uplink assertions live beside the port matrix because the port is what makes the question hard. Every other record answers it out of its own fields; a
   * synthesized port cannot, so the whole classification is asserted here against real synthesis and against the captured devices that give it its contrast.
   */
  test("a synthesized port reports no uplink, and neither does the hub whose hardware it is", () => {

    const { registry } = deviceFixture(accessBootstrapEahFixture);
    const points = registry.accessPoints();

    assert.equal(points.length, 8, "one handle per door-serving port");

    // Each port record inherits the hub's own self-referential uplink field beside an identifier of its own, so reading that field raw would report every
    // port as attached to the hub it is part of.
    assert.ok(points.every((point) => point.uplinkId === null), "a port is hub hardware wearing a port's identity, so nothing carries it");

    // The whole-hub record is the same fact from the other side: the controller writes its uplink as a reference to itself.
    assert.equal(registry.device(EAH_HUB)?.uplinkId, null);
  });

  test("a device reports the identifier of the hub that carries it", () => {

    const { registry } = deviceFixture(accessBootstrap2026Fixture);

    // Captured material rather than a constructed case - the reader on this door genuinely runs its uplink through the hub beside it.
    assert.equal(registry.device(READER)?.uplinkId, HUB);
    assert.equal(registry.device(HUB)?.uplinkId, null, "the hub connects in its own right");
  });

  test("an empty uplink field reads as a device that connects in its own right", () => {

    const bootstrap = structuredClone(accessBootstrap2026Fixture);
    const group = present(bootstrap.floors?.[0]?.doors?.[1]?.device_groups?.[0], "the second door's device group");
    const reader = present(group[1], "the reader");

    assert.equal(reader.unique_id, READER);

    // The controller spells the same thing two ways, and no capture carries the empty spelling - so this one is constructed.
    group[1] = { ...reader, "connected_uah_id": "" };

    const { registry } = deviceFixture(bootstrap);

    assert.equal(registry.device(READER)?.uplinkId, null);
  });

  test("a hub-capable device still reports the device that carries it", () => {

    const bootstrap = structuredClone(accessBootstrap2026Fixture);
    const group = present(bootstrap.floors?.[0]?.doors?.[1]?.device_groups?.[0], "the second door's device group");
    const hub = present(group[0], "the hub");

    assert.equal(hub.unique_id, HUB);
    assert.ok(hub.capabilities.includes("is_hub"), "this assertion needs a record the controller marks hub-capable");

    group[0] = { ...hub, "connected_uah_id": DOOR_MINI };

    const { registry } = deviceFixture(bootstrap);

    // Hub capability is not the question. A port is exempt because of how it came to exist, not because of what it can do, and every port inherits its hub's
    // capabilities through the expansion - so classifying on capability would pass every other assertion here and fail this one.
    assert.equal(registry.device(HUB)?.uplinkId, DOOR_MINI);
  });
});

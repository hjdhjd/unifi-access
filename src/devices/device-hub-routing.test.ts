/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * device-hub-routing.test.ts: Tests for the same door commands under the routing decision - which path each one takes, what it sends once the decision is made,
 * which commands a client held to one API refuses outright, and how a caller's abort signal reaches the official call. Every command test asserts the wire shape
 * through an intercepted request rather than through the projection's own return value, so what is being checked is what the controller would actually receive.
 */
import { AccessApiError, AccessCapabilityError } from "../errors.ts";
import { DOOR_HUB, DOOR_MINI_DOOR, HUB, deviceFixture, intercept } from "./device.helpers.ts";
import { assertRejectsWith, present } from "../testing.helpers.ts";
import { describe, test } from "node:test";
import type { AccessApiOverride } from "../client/routing.ts";
import { AccessDeviceRegistry } from "./registry.ts";
import type { AccessOfficialCallOptions } from "../official/dispatch.ts";
import type { AccessOfficialDoorUnlockOptions } from "../official/spaces.ts";
import { AccessRoutingService } from "../client/routing.ts";
import { accessBootstrap2026Fixture } from "../protocol/topology.fixtures.ts";
import assert from "node:assert/strict";

describe("the hub commands under routing", () => {

  /* What each path puts on the wire, asserted per path. The direct bodies here are the same bytes the direct-path rows above assert, which is the point: routing
   * chooses between two expressions of a command and changes neither of them.
   */
  /* The record shape carries a name of its own so that the factory below still declares its return type on one line - spelling the widened unlock options out
   * inline pushes the annotation past the arrow, which is the linebreak the arrow-linebreak rule refuses.
   */
  interface RoutedOfficialCalls {

    lockRules: { call: AccessOfficialCallOptions | undefined; id: string; rule: unknown }[];
    unlocks: { call: AccessOfficialCallOptions | undefined; id: string; opts: AccessOfficialDoorUnlockOptions | undefined }[];
  }

  const officialCalls = (): RoutedOfficialCalls => ({ lockRules: [], unlocks: [] });

  function routedFixture(options: { override?: AccessApiOverride;
    refuse?: () => Error; } = {}): ReturnType<typeof deviceFixture> & { official: ReturnType<typeof officialCalls> } {

    const fixture = deviceFixture(accessBootstrap2026Fixture);
    const calls = officialCalls();
    const routing = new AccessRoutingService({

      capabilities: { mode: "dual", official: true, override: options.override ?? "auto" },
      official: {

        spaces: {

          setLockRule: async (id: string, rule: unknown, call?: AccessOfficialCallOptions): Promise<void> => {

            if(options.refuse !== undefined) {

              throw options.refuse();
            }

            calls.lockRules.push({ call, id, rule });
          },
          unlock: async (id: string, opts?: AccessOfficialDoorUnlockOptions, call?: AccessOfficialCallOptions): Promise<void> => {

            if(options.refuse !== undefined) {

              throw options.refuse();
            }

            calls.unlocks.push({ call, id, opts });
          }
        }
      },
      store: fixture.store
    });

    return { ...fixture, ctx: { ...fixture.ctx, routing }, official: calls,
      registry: new AccessDeviceRegistry({ ...fixture.ctx, routing }) };
  }

  test("sends a plain unlock down the official path, addressed by door", async () => {

    const fixture = routedFixture();
    const hub = present(fixture.registry.hub(HUB), "the hub");

    await hub.unlock();

    assert.deepEqual(fixture.official.unlocks, [{ call: {}, id: DOOR_HUB, opts: {} }]);
    assert.equal(fixture.captured.length, 0, "nothing went out on the direct path");
  });

  test("carries an actor onto the official call", async () => {

    const fixture = routedFixture();
    const hub = present(fixture.registry.hub(HUB), "the hub");

    await hub.unlock({ actor: { id: "a1", name: "Nightly Automation" } });

    assert.deepEqual(fixture.official.unlocks, [{ call: {}, id: DOOR_HUB, opts: { actor: { id: "a1", name: "Nightly Automation" } } }]);
  });

  test("falls back to the direct path's own body when the device sits below the endpoint's firmware floor", async () => {

    /* The floor case end to end: the official path is attempted first, refused for this device, and the direct expression is what the door actually receives -
     * byte for byte the same request the direct-path row above asserts.
     */
    const fixture = routedFixture({ refuse: () => new AccessApiError("too old", { code: "CODE_DEVICE_API_NOT_SUPPORTED" }) });

    intercept(fixture, { method: "PUT", path: "/proxy/access/api/v2/location/" + DOOR_HUB + "/unlock" });

    const hub = present(fixture.registry.hub(HUB), "the hub");

    await hub.unlock();

    assert.deepEqual(fixture.official.unlocks, [], "the official attempt was refused rather than recorded");
    assert.equal(fixture.captured[0]?.method, "PUT");
    assert.equal(fixture.captured[0].path, "/proxy/access/api/v2/location/" + DOOR_HUB + "/unlock");
    assert.equal(String(fixture.captured[0].body), "{}");
  });

  test("routes each lock rule by what its own path can express", async () => {

    const fixture = routedFixture();
    const hub = present(fixture.registry.hub(HUB), "the hub");

    await hub.setLockRule({ interval: 2, type: "custom" });
    await hub.setLockRule({ type: "lock_now" });

    // Both took the official path, addressed by door, with the rule carried through unchanged in each case.
    assert.deepEqual(fixture.official.lockRules,
      [ { call: {}, id: DOOR_HUB, rule: { interval: 2, type: "custom" } }, { call: {}, id: DOOR_HUB, rule: { type: "lock_now" } } ]);
  });

  test("sends the direct lock rule's proven bytes when the official path refuses the device", async () => {

    const fixture = routedFixture({ refuse: () => new AccessApiError("too old", { code: "CODE_DEVICE_API_NOT_SUPPORTED" }) });

    intercept(fixture, { method: "PUT", path: "/proxy/access/api/v2/device/" + HUB + "/lock_rule?get_result=true" });

    const hub = present(fixture.registry.hub(HUB), "the hub");

    await hub.setLockRule({ interval: 2, type: "custom" });

    // The direct wire shape is unchanged by routing: the same device-keyed resource and the same body the direct-path rows assert.
    assert.equal(fixture.captured[0]?.path, "/proxy/access/api/v2/device/" + HUB + "/lock_rule?get_result=true");
    assert.equal(String(fixture.captured[0].body), JSON.stringify({ interval: 2, type: "custom" }));
  });

  test("refuses an official-only rule outright when the device is floor-refused and no direct expression exists", async () => {

    const fixture = routedFixture({ refuse: () => new AccessApiError("too old", { code: "CODE_DEVICE_API_NOT_SUPPORTED" }) });
    const hub = present(fixture.registry.hub(HUB), "the hub");

    await assert.rejects(async () => hub.setLockRule({ type: "lock_now" }), AccessCapabilityError);
    assert.equal(fixture.captured.length, 0, "and nothing reached the direct path, which cannot express it");
  });

  test("closes on the direct path even where the official one is preferred", async () => {

    const fixture = routedFixture();

    intercept(fixture, { method: "PUT", path: "/proxy/access/api/v2/location/" + DOOR_HUB + "/unlock?control_cmd=close" });

    const hub = present(fixture.registry.hub(HUB), "the hub");

    await hub.close();

    const captured = present(fixture.captured[0], "the captured close request");

    assert.ok(captured.path.includes("control_cmd=close"), "the close command names its control verb on the path");
    assert.equal(captured.body, undefined, "and the close command's body-absent shape is untouched by routing");
  });

  test("refuses the direct-only commands outright on a client held to the official API", async () => {

    // The override reaches the projections whole: a command that channel cannot express is refused where it is issued, before the direct transport sees it.
    const fixture = routedFixture({ override: "official-only" });
    const hub = present(fixture.registry.hub(HUB), "the hub");

    const commands: { issue: () => Promise<unknown>; operation: RegExp }[] = [
      { issue: async (): Promise<unknown> => hub.restart(), operation: /a restart for device "Test alias 13"/ },
      { issue: async (): Promise<unknown> => hub.updateDevice({}), operation: /a configuration write for device "Test alias 13"/ }
    ];

    for(const command of commands) {

      // eslint-disable-next-line no-await-in-loop
      await assertRejectsWith(command.issue, AccessCapabilityError, { check: (error) => {

        assert.match(error.message, command.operation, "the message names the operation");
        assert.match(error.message, /held to the official API/, "and the override that left it nowhere to go");
      } });
    }

    assert.equal(fixture.captured.length, 0, "nothing reached the direct transport");
  });

  test("closes through the official gate control command on a client held away from the direct path", async () => {

    // The override leaves no direct expression, and the published API's own control command is what carries the close instead.
    const fixture = routedFixture({ override: "official-only" });
    const hub = present(fixture.registry.hub(HUB), "the hub");

    await hub.close();

    assert.deepEqual(fixture.official.unlocks, [{ call: {}, id: DOOR_HUB, opts: { controlCmd: "close" } }]);
    assert.equal(fixture.captured.length, 0, "nothing went out on the direct path");
  });

  test("halts a gate with the stop control command, which has no direct expression at all", async () => {

    const fixture = routedFixture();
    const hub = present(fixture.registry.hub(HUB), "the hub");

    await hub.stop();

    assert.deepEqual(fixture.official.unlocks, [{ call: {}, id: DOOR_HUB, opts: { controlCmd: "stop" } }]);
    assert.equal(fixture.captured.length, 0, "a stop reaches the official path or nothing at all");
  });

  test("carries an entry direction onto the official call", async () => {

    const fixture = routedFixture();
    const hub = present(fixture.registry.hub(HUB), "the hub");

    await hub.unlock({ entryMethod: "out" });

    assert.deepEqual(fixture.official.unlocks, [{ call: {}, id: DOOR_HUB, opts: { entryMethod: "out" } }]);
    assert.equal(fixture.captured.length, 0, "the direct endpoint cannot say which approach was taken, so it was never offered");
  });

  test("validates a custom interval before routing decides anything", async () => {

    // The caller's own bad argument is caught ahead of the routing decision, so a malformed rule reaches neither path.
    const fixture = routedFixture();
    const hub = present(fixture.registry.hub(HUB), "the hub");

    await assert.rejects(async () => hub.setLockRule({ interval: 0.5, type: "custom" }), TypeError);

    assert.deepEqual(fixture.official.lockRules, []);
    assert.equal(fixture.captured.length, 0);
  });

  test("carries a named door onto the official call beside an actor and an entry direction", async () => {

    /* All three options travel on one unlock: the target is the door the call addresses, while the other two travel in the payload beside it. A change that
     * threaded one of them through at the cost of another shows here rather than in the rows that exercise each alone.
     */
    const fixture = routedFixture();
    const hub = present(fixture.registry.hub(HUB), "the hub");

    assert.notEqual(DOOR_MINI_DOOR, hub.doorId, "the target names a different door from the one this handle resolves for itself");
    await hub.unlock({ actor: { id: "a1", name: "Nightly Automation" }, doorId: DOOR_MINI_DOOR, entryMethod: "out" });

    assert.deepEqual(fixture.official.unlocks,
      [{ call: {}, id: DOOR_MINI_DOOR, opts: { actor: { id: "a1", name: "Nightly Automation" }, entryMethod: "out" } }]);
    assert.equal(fixture.captured.length, 0, "nothing went out on the direct path");
  });

  test("closes a named door through the official gate control command on a client with no direct path", async () => {

    const fixture = routedFixture({ override: "official-only" });
    const hub = present(fixture.registry.hub(HUB), "the hub");

    assert.notEqual(DOOR_MINI_DOOR, hub.doorId, "the target names a different door from the one this handle resolves for itself");
    await hub.close({ doorId: DOOR_MINI_DOOR });

    assert.deepEqual(fixture.official.unlocks, [{ call: {}, id: DOOR_MINI_DOOR, opts: { controlCmd: "close" } }]);
    assert.equal(fixture.captured.length, 0, "nothing went out on the direct path");
  });

  test("halts a named door's gate with the stop control command", async () => {

    const fixture = routedFixture();
    const hub = present(fixture.registry.hub(HUB), "the hub");

    assert.notEqual(DOOR_MINI_DOOR, hub.doorId, "the target names a different door from the one this handle resolves for itself");
    await hub.stop({ doorId: DOOR_MINI_DOOR });

    assert.deepEqual(fixture.official.unlocks, [{ call: {}, id: DOOR_MINI_DOOR, opts: { controlCmd: "stop" } }]);
    assert.equal(fixture.captured.length, 0, "a stop reaches the official path or nothing at all");
  });

  test("puts a lock rule aimed at another door on the official path alone, whichever verb it is", async () => {

    /* The direct rule resource addresses the device rather than the door, so a rule naming a different door has no direct expression even when its verb is one
     * the direct endpoint speaks. Both rules here take the official path, addressed by the door the caller named.
     */
    const fixture = routedFixture();
    const hub = present(fixture.registry.hub(HUB), "the hub");

    assert.notEqual(DOOR_MINI_DOOR, hub.doorId, "the target names a different door from the one this handle resolves for itself");

    await hub.setLockRule({ interval: 2, type: "custom" }, { doorId: DOOR_MINI_DOOR });
    await hub.setLockRule({ type: "lock_now" }, { doorId: DOOR_MINI_DOOR });

    assert.deepEqual(fixture.official.lockRules,
      [ { call: {}, id: DOOR_MINI_DOOR, rule: { interval: 2, type: "custom" } }, { call: {}, id: DOOR_MINI_DOOR, rule: { type: "lock_now" } } ]);
    assert.equal(fixture.captured.length, 0, "and the device-keyed direct resource was never reached");
  });

  describe("the caller's abort signal", () => {

    test("threads the caller's signal through the official unlock", async () => {

      const fixture = routedFixture();
      const hub = present(fixture.registry.hub(HUB), "the hub");
      const controller = new AbortController();

      await hub.unlock({ signal: controller.signal });

      assert.deepEqual(fixture.official.unlocks, [{ call: { signal: controller.signal }, id: DOOR_HUB, opts: {} }]);
      assert.equal(fixture.captured.length, 0, "nothing went out on the direct path");

      // Two unaborted signals compare equal under deepEqual, so the identity check is what rules out a stand-in minted somewhere along the way.
      assert.equal(fixture.official.unlocks[0]?.call?.signal, controller.signal, "and the official call holds the caller's own signal");
    });

    test("threads the caller's signal through a gate stop", async () => {

      const fixture = routedFixture();
      const hub = present(fixture.registry.hub(HUB), "the hub");
      const controller = new AbortController();

      await hub.stop({ signal: controller.signal });

      assert.deepEqual(fixture.official.unlocks, [{ call: { signal: controller.signal }, id: DOOR_HUB, opts: { controlCmd: "stop" } }]);
      assert.equal(fixture.official.unlocks[0]?.call?.signal, controller.signal, "and the official call holds the caller's own signal");
    });
  });
});

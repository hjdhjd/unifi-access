/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * device-hub-commands.test.ts: Tests for the door commands a hub drives down the direct path - unlock, close, the lock rules, and the envelope every one of them
 * reads before resolving. Every command test asserts the wire shape through an intercepted request rather than through the projection's own return value, so what
 * is being checked is what the controller would actually receive.
 */
import { AccessApiError, AccessCapabilityError, AccessProtocolError } from "../errors.ts";
import { DOOR_HUB, DOOR_MINI_DOOR, HUB, READER, REFUSED, deviceFixture, intercept } from "./device.helpers.ts";
import { assertRejectsWith, present } from "../testing.helpers.ts";
import { describe, test } from "node:test";
import { accessBootstrap2026Fixture } from "../protocol/topology.fixtures.ts";
import assert from "node:assert/strict";

describe("the hub commands", () => {

  test("unlock puts to the door's own resource with an empty object body", async () => {

    const fixture = deviceFixture(accessBootstrap2026Fixture);

    intercept(fixture, { method: "PUT", path: "/proxy/access/api/v2/location/" + DOOR_HUB + "/unlock" });

    const hub = present(fixture.registry.hub(HUB), "the hub");

    await hub.unlock();

    // The command addresses the door rather than the hardware, which is what lets one hub drive several doors independently.
    assert.equal(fixture.captured[0]?.method, "PUT");
    assert.equal(fixture.captured[0].path, "/proxy/access/api/v2/location/" + DOOR_HUB + "/unlock");
    assert.equal(String(fixture.captured[0].body), "{}");
  });

  test("close puts to the same resource with the control parameter and no body at all", async () => {

    const fixture = deviceFixture(accessBootstrap2026Fixture);

    intercept(fixture, { method: "PUT", path: "/proxy/access/api/v2/location/" + DOOR_HUB + "/unlock?control_cmd=close" });

    const hub = present(fixture.registry.hub(HUB), "the hub");

    await hub.close();

    assert.equal(fixture.captured[0]?.method, "PUT");
    assert.ok(fixture.captured[0].path.includes("control_cmd=close"), "the close command names its control verb on the path");

    // Body ABSENCE is the claim, and it is asserted directly rather than inferred from the presence of one elsewhere.
    assert.equal(fixture.captured[0].body, undefined, "the close command carries no body at all");
  });

  test("each lock rule sends its own payload to the rule resource", async () => {

    const fixture = deviceFixture(accessBootstrap2026Fixture);
    const path = "/proxy/access/api/v2/device/" + HUB + "/lock_rule?get_result=true";

    for(let i = 0; i < 3; i++) {

      intercept(fixture, { method: "PUT", path });
    }

    const hub = present(fixture.registry.hub(HUB), "the hub");

    await hub.setLockRule({ type: "reset" });
    await hub.setLockRule({ type: "keep_unlock" });

    // The valid-custom case is the validator's other polarity: a well-formed interval passes the guard and reaches the wire.
    await hub.setLockRule({ interval: 30, type: "custom" });

    assert.deepEqual(fixture.captured.map((request) => request.method), [ "PUT", "PUT", "PUT" ]);
    assert.deepEqual(fixture.captured.map((request) => String(request.body)),
      [ JSON.stringify({ type: "reset" }), JSON.stringify({ type: "keep_unlock" }), JSON.stringify({ interval: 30, type: "custom" }) ]);
  });

  test("a custom rule whose interval is not a positive whole number is refused before anything is sent", async () => {

    const fixture = deviceFixture(accessBootstrap2026Fixture);
    const hub = present(fixture.registry.hub(HUB), "the hub");

    // A caller's own bad argument is a programming error, so it raises the language's own type rather than the library's request error, which exists to carry a
    // status the controller answered with. No request is registered, so a dispatched one would fail the mock agent's own net-connect guard.
    const rejected = [ 0, -5, 1.5, Number.NaN, Number.POSITIVE_INFINITY ].map((interval) => assert.rejects(() => hub.setLockRule({ interval, type: "custom" }),
      TypeError));

    await Promise.all(rejected);

    assert.equal(fixture.captured.length, 0, "nothing reached the wire");
  });

  test("a refusal inside a 200 body throws, carrying the controller's own words", async () => {

    const fixture = deviceFixture(accessBootstrap2026Fixture);

    intercept(fixture, { body: REFUSED, method: "PUT", path: "/proxy/access/api/v2/location/" + DOOR_HUB + "/unlock" });

    const hub = present(fixture.registry.hub(HUB), "the hub");

    await assertRejectsWith(() => hub.unlock(), AccessApiError, { check: (error) => {

      /* What reaches the caller is what the controller said: its own result code as the vocabulary string rather than the number beside it, its own message with
       * the wire's trailing space removed, and the structured diagnostic it sent alongside, byte for byte.
       */
      assert.equal(error.code, "CODE_SYSTEM_ERROR");
      assert.equal(error.message, "Server system error.");
      assert.equal(error.detail, "CODE[-3];Mesg:;CauseBy:");

      // The diagnostic is a fact the controller reported rather than an exception this library caught, so the chain stays empty.
      assert.equal(error.cause, undefined);
    } });
  });

  test("a refusal that carries no message of its own falls back to the door commands' own sentence", async () => {

    const fixture = deviceFixture(accessBootstrap2026Fixture);

    // The controller declined and said nothing about why, so the sentence the caller reads is the one the command supplied, naming what was refused.
    intercept(fixture, { body: JSON.stringify({ "code": -3, "codeS": "CODE_SYSTEM_ERROR" }), method: "PUT",
      path: "/proxy/access/api/v2/location/" + DOOR_HUB + "/unlock" });

    const hub = present(fixture.registry.hub(HUB), "the hub");

    await assertRejectsWith(() => hub.unlock(), AccessApiError, { check: (error) => {

      assert.equal(error.code, "CODE_SYSTEM_ERROR");
      assert.equal(error.message, "The UniFi Access controller refused the door command.");
      assert.equal(error.detail, undefined);
    } });
  });

  test("a 200 carrying a document that is not an envelope is a protocol error rather than a refusal or a success", async () => {

    const fixture = deviceFixture(accessBootstrap2026Fixture);

    /* An empty object parses, so the decode has nothing to object to, and it carries no result code at all - so it reports neither success nor refusal. Reading it
     * either way would be inventing a verdict the controller never gave.
     */
    intercept(fixture, { body: "{}", method: "PUT", path: "/proxy/access/api/v2/location/" + DOOR_HUB + "/unlock" });

    const hub = present(fixture.registry.hub(HUB), "the hub");

    await assert.rejects(() => hub.unlock(), AccessProtocolError);
  });

  test("a refusal written in the documented dialect reads by the same rule the official surface reads it by", async () => {

    const fixture = deviceFixture(accessBootstrap2026Fixture);

    // One writer serves both of the controller's surfaces, so a direct endpoint answering in the dialect the vendor reference documents is read, not rejected.
    intercept(fixture, { body: JSON.stringify({ "code": "CODE_SYSTEM_ERROR", "msg": "Server system error." }), method: "PUT",
      path: "/proxy/access/api/v2/location/" + DOOR_HUB + "/unlock" });

    const hub = present(fixture.registry.hub(HUB), "the hub");

    await assertRejectsWith(() => hub.unlock(), AccessApiError, { check: (error) => {

      assert.equal(error.code, "CODE_SYSTEM_ERROR");
      assert.equal(error.message, "Server system error.");
    } });
  });

  test("a 200 carrying no envelope at all is a protocol error rather than a quiet success", async () => {

    const fixture = deviceFixture(accessBootstrap2026Fixture);

    /* A controller that answers a command with 200 and an empty body has reported a status and nothing about the outcome, and the one thing a door command must
     * never do is resolve on that. The envelope read is where it surfaces, as the typed protocol error the caller catches by class - and the rejection being
     * typed is also what shows nothing escaped as an unhandled one.
     */
    intercept(fixture, { body: "", method: "PUT", path: "/proxy/access/api/v2/location/" + DOOR_HUB + "/unlock" });

    const hub = present(fixture.registry.hub(HUB), "the hub");

    await assert.rejects(() => hub.unlock(), AccessProtocolError);
  });

  test("every door command reads the envelope, so a refusal inside a 200 throws whichever one drew it", async () => {

    /* The three door commands share one reading of the result envelope, and this is what that sharing is worth: a refusal is reported identically whichever
     * command met it, rather than each command having its own idea of what the controller's answer meant.
     */
    const fixture = deviceFixture(accessBootstrap2026Fixture);

    intercept(fixture, { body: REFUSED, method: "PUT", path: "/proxy/access/api/v2/location/" + DOOR_HUB + "/unlock?control_cmd=close" });
    intercept(fixture, { body: REFUSED, method: "PUT", path: "/proxy/access/api/v2/device/" + HUB + "/lock_rule?get_result=true" });

    const hub = present(fixture.registry.hub(HUB), "the hub");

    for(const command of [ (): Promise<void> => hub.close(), (): Promise<void> => hub.setLockRule({ type: "reset" }) ]) {

      // eslint-disable-next-line no-await-in-loop
      await assertRejectsWith(command, AccessApiError, { check: (error) => {

        assert.equal(error.code, "CODE_SYSTEM_ERROR");
        assert.equal(error.message, "Server system error.");
        assert.equal(error.detail, "CODE[-3];Mesg:;CauseBy:");
      } });
    }
  });

  test("a successful envelope resolves each door command quietly", async () => {

    // The other polarity of the same check: the commands are not merely throwing on everything, they are reading the verdict the envelope carries.
    const fixture = deviceFixture(accessBootstrap2026Fixture);

    intercept(fixture, { method: "PUT", path: "/proxy/access/api/v2/location/" + DOOR_HUB + "/unlock" });
    intercept(fixture, { method: "PUT", path: "/proxy/access/api/v2/location/" + DOOR_HUB + "/unlock?control_cmd=close" });
    intercept(fixture, { method: "PUT", path: "/proxy/access/api/v2/device/" + HUB + "/lock_rule?get_result=true" });

    const hub = present(fixture.registry.hub(HUB), "the hub");

    await hub.unlock();
    await hub.close();
    await hub.setLockRule({ type: "reset" });

    assert.equal(fixture.captured.length, 3);
  });

  test("updateDevice is exempt, because its endpoint answers the record rather than an envelope", async () => {

    /* The device-settings endpoint does not wrap its answer, so there is no verdict to read: what comes back is the device record itself. A body that would read
     * as a refusal anywhere else is simply not an envelope here, and it reaches the caller as the echoed record rather than throwing.
     */
    const fixture = deviceFixture(accessBootstrap2026Fixture);

    intercept(fixture, { body: REFUSED, method: "PUT", path: "/proxy/access/api/v2/device/" + HUB + "/configs" });

    const hub = present(fixture.registry.hub(HUB), "the hub");

    const echoed = await hub.updateDevice({ "alias": "Echoed" });

    assert.equal(Object.hasOwn(echoed, "codeS"), true, "whatever the endpoint answered is what the caller receives");
  });

  test("restart reads the envelope, resolving on the shape a live restart answers with", async () => {

    /* The body here is what a real device restart answered on 2026-08-16, verbatim: the same result envelope the door commands read, with a success code inside a
     * 200. That is what makes reading it correct rather than presumptuous.
     */
    const fixture = deviceFixture(accessBootstrap2026Fixture);

    intercept(fixture, { body: JSON.stringify({ "code": 1, "codeS": "SUCCESS", "data": "success", "error": "", "msg": "success" }), method: "PUT",
      path: "/proxy/access/api/v2/device/" + READER + "/restart" });

    const reader = present(fixture.registry.device(READER), "the reader");

    await reader.restart();

    assert.equal(fixture.captured[0]?.path, "/proxy/access/api/v2/device/" + READER + "/restart");
  });

  test("restart throws when the envelope refuses inside a 200, carrying the controller's own words", async () => {

    // The other polarity. A restart the controller declined is a failure the caller has to see, and a reader that took the status alone would resolve it as though
    // the device were rebooting.
    const fixture = deviceFixture(accessBootstrap2026Fixture);

    intercept(fixture, { body: REFUSED, method: "PUT", path: "/proxy/access/api/v2/device/" + READER + "/restart" });

    const reader = present(fixture.registry.device(READER), "the reader");

    await assertRejectsWith(async () => reader.restart(), AccessApiError, { check: (error) => {

      assert.equal(error.code, "CODE_SYSTEM_ERROR");
      assert.equal(error.message, "Server system error.");
      assert.equal(error.detail, "CODE[-3];Mesg:;CauseBy:");
    } });
  });

  test("a refused restart that carries no message falls back to the restart's own sentence rather than the door commands'", async () => {

    const fixture = deviceFixture(accessBootstrap2026Fixture);

    // Each command supplies its own fallback, so a silent refusal still says which operation was refused rather than reporting a generic one.
    intercept(fixture, { body: JSON.stringify({ "code": -3, "codeS": "CODE_SYSTEM_ERROR" }), method: "PUT",
      path: "/proxy/access/api/v2/device/" + READER + "/restart" });

    const reader = present(fixture.registry.device(READER), "the reader");

    await assertRejectsWith(async () => reader.restart(), AccessApiError, { check: (error) => {

      assert.equal(error.message, "The UniFi Access controller refused the device restart.");
      assert.equal(error.detail, undefined);
    } });
  });

  test("unlocks the door the caller named rather than the hub's own", async () => {

    /* The named door has to reach the URL itself, which is the half a change threading the target into the routed request alone would miss - the direct
     * expression builds its own endpoint. The id is another of the fixture's doors, so a resolution that ignored the target would address a visibly different one
     * and find no interceptor waiting.
     */
    const fixture = deviceFixture(accessBootstrap2026Fixture);

    intercept(fixture, { method: "PUT", path: "/proxy/access/api/v2/location/" + DOOR_MINI_DOOR + "/unlock" });

    const hub = present(fixture.registry.hub(HUB), "the hub");

    assert.notEqual(DOOR_MINI_DOOR, hub.doorId, "the target names a different door from the one this handle resolves for itself");
    await hub.unlock({ doorId: DOOR_MINI_DOOR });

    assert.equal(fixture.captured[0]?.path, "/proxy/access/api/v2/location/" + DOOR_MINI_DOOR + "/unlock");
    assert.equal(String(fixture.captured[0].body), "{}", "and the unlock's own body is what it always is");
  });

  test("closes the door the caller named rather than the hub's own", async () => {

    const fixture = deviceFixture(accessBootstrap2026Fixture);

    intercept(fixture, { method: "PUT", path: "/proxy/access/api/v2/location/" + DOOR_MINI_DOOR + "/unlock?control_cmd=close" });

    const hub = present(fixture.registry.hub(HUB), "the hub");

    assert.notEqual(DOOR_MINI_DOOR, hub.doorId, "the target names a different door from the one this handle resolves for itself");
    await hub.close({ doorId: DOOR_MINI_DOOR });

    assert.equal(fixture.captured[0]?.path, "/proxy/access/api/v2/location/" + DOOR_MINI_DOOR + "/unlock?control_cmd=close");
    assert.equal(fixture.captured[0].body, undefined, "and the body-absent shape of a close is untouched by naming a door");
  });

  test("sends a lock rule naming this hub's own door to the direct resource, exactly as the untargeted call does", async () => {

    /* The one row here whose target is the hub's own door, deliberately: what decides the direct path is the door the target resolves to rather than whether a
     * target was named at all, so a caller spelling out the door this handle would have chosen reaches the same device-keyed resource with the same bytes.
     */
    const fixture = deviceFixture(accessBootstrap2026Fixture);
    const path = "/proxy/access/api/v2/device/" + HUB + "/lock_rule?get_result=true";

    intercept(fixture, { method: "PUT", path });

    const hub = present(fixture.registry.hub(HUB), "the hub");

    await hub.setLockRule({ interval: 2, type: "custom" }, { doorId: hub.doorId });

    assert.equal(fixture.captured[0]?.path, path);
    assert.equal(String(fixture.captured[0].body), JSON.stringify({ interval: 2, type: "custom" }));
  });

  test("refuses a lock rule aimed at another door on a client holding no official path", async () => {

    /* The direct rule resource is keyed by the device, so it governs the door that device resolves for itself and can say nothing about any other one. A rule
     * aimed elsewhere therefore has no direct expression to fall back on, and a client holding nothing else refuses it rather than writing it to the wrong door.
     */
    const fixture = deviceFixture(accessBootstrap2026Fixture);
    const hub = present(fixture.registry.hub(HUB), "the hub");

    assert.notEqual(DOOR_MINI_DOOR, hub.doorId, "the target names a different door from the one this handle resolves for itself");
    await assertRejectsWith(async () => hub.setLockRule({ interval: 2, type: "custom" }, { doorId: DOOR_MINI_DOOR }), AccessCapabilityError, { check: (error) => {

      assert.match(error.message, /the custom lock rule for door "Test Name 23"/, "and the refusal names the door the rule was aimed at");
    } });

    assert.equal(fixture.captured.length, 0, "and nothing reached the direct transport, which could only have addressed this device's own door");
  });

  test("each door command still fails loudly on a handle whose device has left the state, named target or not", async () => {

    /* Every verb reads the handle's own door before it does anything else, and that read is what asserts the record is still there. A caller naming a target must
     * not be able to route around it, so each verb is issued with one after the device is gone.
     */
    const fixture = deviceFixture(accessBootstrap2026Fixture);
    const hub = present(fixture.registry.hub(HUB), "the hub");

    fixture.store.dispatch({ eventName: "access.data.v2.device.delete", id: HUB, kind: "deviceRemoved" });

    const commands: { issue: () => Promise<void>; verb: string }[] = [
      { issue: async (): Promise<void> => hub.unlock({ doorId: DOOR_MINI_DOOR }), verb: "unlock" },
      { issue: async (): Promise<void> => hub.close({ doorId: DOOR_MINI_DOOR }), verb: "close" },
      { issue: async (): Promise<void> => hub.stop({ doorId: DOOR_MINI_DOOR }), verb: "stop" },
      { issue: async (): Promise<void> => hub.setLockRule({ type: "reset" }, { doorId: DOOR_MINI_DOOR }), verb: "setLockRule" }
    ];

    for(const command of commands) {

      // eslint-disable-next-line no-await-in-loop
      await assert.rejects(command.issue, ReferenceError, command.verb + " reads the departed record before anything the caller supplied can matter");
    }

    // A caller's own bad argument still comes first of all, ahead of that read: a malformed interval is a TypeError whether or not the record is still there.
    await assert.rejects(async () => hub.setLockRule({ interval: 0.5, type: "custom" }, { doorId: DOOR_MINI_DOOR }), TypeError);

    assert.equal(fixture.captured.length, 0, "and none of it reached a transport");
  });
});

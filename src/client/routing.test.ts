/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * routing.test.ts: Unit tests for the routing decision. These drive the service directly against a recording official surface and a real state store, because what
 * matters here is WHICH path each command takes and what the two runtime capability verdicts do to that choice over a client's life - questions that are about the
 * decision rather than about anything on the wire.
 */
import { AccessAbortedError, AccessApiError, AccessCapabilityError } from "../errors.ts";
import type { AccessCapabilities, AccessOfficialDoorSurface } from "./routing.ts";
import { TestClock, silentLog } from "homebridge-plugin-utils/testing";
import { describe, test } from "node:test";
import type { AccessOfficialCallOptions } from "../official/dispatch.ts";
import type { AccessOfficialDoorUnlockOptions } from "../official/spaces.ts";
import { AccessRoutingService } from "./routing.ts";
import { StateStore } from "../state/store.ts";
import { accessBootstrap2026Fixture } from "../protocol/topology.fixtures.ts";
import assert from "node:assert/strict";
import { assertRejectsWith } from "../testing.helpers.ts";

const HUB = "aabbcc000001";
const DOOR_HUB = "00000000-0000-0000-0000-000000000006";

// What each side of a routed decision recorded, so a test asserts the path taken rather than inferring it.
interface RecordedCalls {

  direct: string[];
  lockRules: { call: AccessOfficialCallOptions | undefined; id: string; rule: unknown }[];
  unlocks: { call: AccessOfficialCallOptions | undefined; id: string; opts: AccessOfficialDoorUnlockOptions | undefined }[];
}

// What the official surface is being asked to do, which is what lets a refusal be scoped to one command - the granularity the floor memo files its verdicts at.
type OfficialAttempt = { method: "setLockRule"; rule: unknown } | { method: "unlock"; opts: AccessOfficialDoorUnlockOptions | undefined };

/* A recording official surface. `refuse` is consulted on every official call and, when it answers with an error, is what that call throws - which is how the two
 * capability codes and an ordinary fault are driven through the same path, and how a refusal aimed at one command alone is expressed. The difference between them
 * is exactly what the service is being tested on.
 */
function officialSurface(calls: RecordedCalls, refuse?: (attempt: OfficialAttempt) => Error | undefined): AccessOfficialDoorSurface {

  const attempt = (asked: OfficialAttempt): void => {

    const error = refuse?.(asked);

    if(error !== undefined) {

      throw error;
    }
  };

  return {

    spaces: {

      setLockRule: async (id: string, rule: unknown, call?: AccessOfficialCallOptions): Promise<void> => {

        attempt({ method: "setLockRule", rule });

        calls.lockRules.push({ call, id, rule });
      },
      unlock: async (id: string, opts?: AccessOfficialDoorUnlockOptions, call?: AccessOfficialCallOptions): Promise<void> => {

        attempt({ method: "unlock", opts });

        calls.unlocks.push({ call, id, opts });
      }
    }
  };
}

// A store holding the real 2026 topology, which is what the firmware memo reads its keys from.
function storeWith(bootstrap = accessBootstrap2026Fixture): StateStore {

  const store = new StateStore({ clock: new TestClock(), log: silentLog(),
    refresh: () => Promise.reject(new Error("the refresh callback must not be called")), refreshIntervalMs: false });

  store.dispatch({ data: JSON.parse(JSON.stringify(bootstrap)) as typeof bootstrap, kind: "bootstrapLoaded" });

  return store;
}

function makeService(options: { calls: RecordedCalls; capabilities?: Partial<AccessCapabilities>; official?: boolean;
  refuse?: (attempt: OfficialAttempt) => Error | undefined; store?: StateStore; }): { service: AccessRoutingService; store: StateStore } {

  const store = options.store ?? storeWith();
  const capabilities: AccessCapabilities = { mode: "dual", official: true, override: "auto", ...options.capabilities };
  const service = new AccessRoutingService({ capabilities,
    official: ((options.official ?? true) ? officialSurface(options.calls, options.refuse) : null), store });

  return { service, store };
}

const newCalls = (): RecordedCalls => ({ direct: [], lockRules: [], unlocks: [] });
const direct = (calls: RecordedCalls, label: string) => async (): Promise<void> => void calls.direct.push(label);

describe("the routing decision", () => {

  test("prefers the official path for a plain unlock when one is available", () => {

    const calls = newCalls();
    const { service } = makeService({ calls });

    return service.routedUnlock({ deviceId: HUB, direct: direct(calls, "unlock"), doorId: DOOR_HUB }).then(() => {

      assert.deepEqual(calls.unlocks, [{ call: {}, id: DOOR_HUB, opts: {} }]);
      assert.deepEqual(calls.direct, [], "the direct path was not taken");
    });
  });

  test("takes the direct path when no official path is available", async () => {

    const calls = newCalls();
    const { service } = makeService({ calls, capabilities: { mode: "credential", official: false }, official: false });

    await service.routedUnlock({ deviceId: HUB, direct: direct(calls, "unlock"), doorId: DOOR_HUB });

    assert.deepEqual(calls.direct, ["unlock"]);
    assert.deepEqual(calls.unlocks, []);
  });

  test("carries the actor onto the official call, and refuses an attributed unlock with no official path", async () => {

    const calls = newCalls();
    const { service } = makeService({ calls });

    await service.routedUnlock({ actor: { id: "a1", name: "Automation" }, deviceId: HUB, direct: direct(calls, "unlock"), doorId: DOOR_HUB });

    assert.deepEqual(calls.unlocks, [{ call: {}, id: DOOR_HUB, opts: { actor: { id: "a1", name: "Automation" } } }]);

    // The other polarity: attribution has no direct expression, so a client without the official path refuses rather than silently dropping the actor.
    const credentialCalls = newCalls();
    const credential = makeService({ calls: credentialCalls, capabilities: { mode: "credential", official: false }, official: false });

    await assert.rejects(async () => credential.service.routedUnlock({ actor: { id: "a1", name: "Automation" }, deviceId: HUB,
      direct: direct(credentialCalls, "unlock"), doorId: DOOR_HUB }), AccessCapabilityError);

    assert.deepEqual(credentialCalls.direct, [], "and nothing was issued on the path that cannot express it");
  });

  test("carries the entry direction onto the official call, and refuses an entry-direction unlock with no official path", async () => {

    const calls = newCalls();
    const { service } = makeService({ calls });

    await service.routedUnlock({ deviceId: HUB, direct: direct(calls, "unlock"), doorId: DOOR_HUB, entryMethod: "in" });

    assert.deepEqual(calls.unlocks, [{ call: {}, id: DOOR_HUB, opts: { entryMethod: "in" } }]);
    assert.deepEqual(calls.direct, [], "the direct endpoint cannot say which approach was taken, so it was never offered");

    // The other polarity: an entry direction has no direct expression either, so a client without the official path refuses rather than dropping it.
    const credentialCalls = newCalls();
    const credential = makeService({ calls: credentialCalls, capabilities: { mode: "credential", official: false }, official: false });

    await assertRejectsWith(async () => credential.service.routedUnlock({ deviceId: HUB, direct: direct(credentialCalls, "unlock"), doorId: DOOR_HUB,
      entryMethod: "out" }), AccessCapabilityError, { check: (error) => {

      assert.match(error.message, /an unlock carrying an entry direction/, "the refusal names the unlock by what made it official-only");
    } });

    assert.deepEqual(credentialCalls.direct, []);
  });

  test("carries an actor and an entry direction together, and names the attribution when both travel on a refused unlock", async () => {

    const calls = newCalls();
    const { service } = makeService({ calls });

    await service.routedUnlock({ actor: { id: "a1", name: "Automation" }, deviceId: HUB, direct: direct(calls, "unlock"), doorId: DOOR_HUB,
      entryMethod: "out" });

    assert.deepEqual(calls.unlocks, [{ call: {}, id: DOOR_HUB, opts: { actor: { id: "a1", name: "Automation" }, entryMethod: "out" } }]);

    // Both facts are true of the command and a refusal names one, so the more particular of the two - the attribution - is the one that speaks.
    const credentialCalls = newCalls();
    const credential = makeService({ calls: credentialCalls, capabilities: { mode: "credential", official: false }, official: false });

    await assertRejectsWith(async () => credential.service.routedUnlock({ actor: { id: "a1", name: "Automation" }, deviceId: HUB,
      direct: direct(credentialCalls, "unlock"), doorId: DOOR_HUB, entryMethod: "in" }), AccessCapabilityError, { check: (error) => {

      assert.match(error.message, /an unlock attributed to an actor/);
    } });
  });

  test("routes a direct-expressible rule to either path and an official-only rule to the official one alone", async () => {

    const calls = newCalls();
    const { service } = makeService({ calls });

    await service.routedSetLockRule({ deviceId: HUB, direct: direct(calls, "reset"), doorId: DOOR_HUB, rule: { type: "reset" } });
    await service.routedSetLockRule({ deviceId: HUB, doorId: DOOR_HUB, rule: { type: "lock_now" } });

    assert.deepEqual(calls.lockRules, [ { call: {}, id: DOOR_HUB, rule: { type: "reset" } }, { call: {}, id: DOOR_HUB, rule: { type: "lock_now" } } ]);

    // A rule with no direct expression and no official path has nowhere to go, which is the capability error rather than an approximation.
    const credentialCalls = newCalls();
    const credential = makeService({ calls: credentialCalls, capabilities: { mode: "credential", official: false }, official: false });

    await assertRejectsWith(async () => credential.service.routedSetLockRule({ deviceId: HUB, doorId: DOOR_HUB, rule: { type: "lock_now" } }),
      AccessCapabilityError, { check: (error) => {

        assert.match(error.message, /the lock_now lock rule for door "Test Name 11"/);
      } });
  });

  test("closes on the direct path wherever the client holds one, including under a direct-only override", async () => {

    const calls = newCalls();
    const { service } = makeService({ calls });

    await service.routedClose({ deviceId: HUB, direct: direct(calls, "close"), doorId: DOOR_HUB });

    assert.deepEqual(calls.direct, ["close"], "the direct close is the hardware-proven one, so a client holding that path keeps it");
    assert.deepEqual(calls.unlocks, [], "and the official rail was never reached for it");

    const pinnedCalls = newCalls();
    const pinned = makeService({ calls: pinnedCalls, capabilities: { override: "direct-only" } });

    await pinned.service.routedClose({ deviceId: HUB, direct: direct(pinnedCalls, "close"), doorId: DOOR_HUB });

    assert.deepEqual(pinnedCalls.direct, ["close"]);
    assert.deepEqual(pinnedCalls.unlocks, []);
  });

  test("closes through the official gate control command on a client with no direct path", async () => {

    // The override removes the direct expression, so the close reaches the published API's own control command rather than refusing.
    const pinnedCalls = newCalls();
    const pinned = makeService({ calls: pinnedCalls, capabilities: { override: "official-only" } });

    await pinned.service.routedClose({ deviceId: HUB, direct: direct(pinnedCalls, "close"), doorId: DOOR_HUB });

    assert.deepEqual(pinnedCalls.unlocks, [{ call: {}, id: DOOR_HUB, opts: { controlCmd: "close" } }]);
    assert.deepEqual(pinnedCalls.direct, [], "the override is what makes the direct expression unavailable rather than merely unused");

    // A token client never held a direct path at all, and reaches the same command by the same route.
    const tokenCalls = newCalls();
    const token = makeService({ calls: tokenCalls, capabilities: { mode: "token" } });

    await token.service.routedClose({ deviceId: HUB, direct: direct(tokenCalls, "close"), doorId: DOOR_HUB });

    assert.deepEqual(tokenCalls.unlocks, [{ call: {}, id: DOOR_HUB, opts: { controlCmd: "close" } }]);
    assert.deepEqual(tokenCalls.direct, []);
  });

  test("refuses a close on a client that holds neither path", async () => {

    const calls = newCalls();
    const { service } = makeService({ calls, capabilities: { mode: "token" }, official: false });

    await assertRejectsWith(async () => service.routedClose({ deviceId: HUB, direct: direct(calls, "close"), doorId: DOOR_HUB }),
      AccessCapabilityError, { check: (error) => {

        assert.match(error.message, /a close for door "Test Name 11"/, "the message names the operation and the door");
        assert.match(error.message, /holds no credentials for the Access application's own endpoints/, "and the capability that was missing");
      } });

    assert.deepEqual(calls.direct, [], "a refused close issues nothing at all");
  });

  test("honors the direct-only override by never reaching for the official path", async () => {

    const calls = newCalls();
    const { service } = makeService({ calls, capabilities: { override: "direct-only" } });

    await service.routedUnlock({ deviceId: HUB, direct: direct(calls, "unlock"), doorId: DOOR_HUB });

    assert.deepEqual(calls.direct, ["unlock"]);
    assert.deepEqual(calls.unlocks, [], "a client held to one channel does not attempt the channel it was held away from");

    // And an operation only the official path can express is refused rather than quietly demoted.
    await assert.rejects(async () => service.routedUnlock({ actor: { id: "a1", name: "Automation" }, deviceId: HUB, direct: direct(calls, "unlock"),
      doorId: DOOR_HUB }), AccessCapabilityError);
  });
});

describe("the capability error's message", () => {

  test("names the operation, the target, the capability, and the mode on every arm that can refuse", async () => {

    /* The class documents its message as carrying each of them, and a message is the whole of what this error offers a caller - so each arm is checked rather
     * than one standing in for the rest. The revoked arm is reached by tripping the latch first, which is the only way to produce it.
     */
    const attributedUnlock = async (service: AccessRoutingService, calls: RecordedCalls): Promise<void> => {

      await service.routedUnlock({ actor: { id: "a1", name: "Automation" }, deviceId: HUB, direct: direct(calls, "unlock"), doorId: DOOR_HUB });
    };
    const entryDirectionUnlock = async (service: AccessRoutingService, calls: RecordedCalls): Promise<void> => {

      await service.routedUnlock({ deviceId: HUB, direct: direct(calls, "unlock"), doorId: DOOR_HUB, entryMethod: "in" });
    };
    const arms: { capabilities: Partial<AccessCapabilities>; issue: (service: AccessRoutingService, calls: RecordedCalls) => Promise<void>; label: string;
      official: boolean; operation: RegExp; reason: RegExp; refuse?: () => Error; target: RegExp; }[] = [
      { capabilities: { mode: "credential", official: false }, issue: attributedUnlock, label: "no official path", official: false,
        operation: /an unlock attributed to an actor/, reason: /requires the official API/, target: /for door "Test Name 11"/ },
      { capabilities: { mode: "dual", override: "direct-only" }, issue: attributedUnlock, label: "held direct", official: true,
        operation: /an unlock attributed to an actor/, reason: /held to the direct API/, target: /for door "Test Name 11"/ },
      { capabilities: { mode: "dual" }, issue: attributedUnlock, label: "revoked", official: true, operation: /an unlock attributed to an actor/,
        reason: /no longer available to this session/,
        refuse: () => new AccessApiError("not supported", { code: "CODE_OTHERS_UID_ADOPTED_NOT_SUPPORTED" }), target: /for door "Test Name 11"/ },
      { capabilities: { mode: "credential", official: false }, issue: entryDirectionUnlock, label: "entry direction with no official path", official: false,
        operation: /an unlock carrying an entry direction/, reason: /requires the official API/, target: /for door "Test Name 11"/ }
    ];

    for(const arm of arms) {

      const calls = newCalls();
      const { service } = makeService({ calls, capabilities: arm.capabilities, official: arm.official,
        ...((arm.refuse !== undefined) && { refuse: arm.refuse }) });

      if(arm.refuse !== undefined) {

        // eslint-disable-next-line no-await-in-loop
        await service.routedUnlock({ deviceId: HUB, direct: direct(calls, "trip"), doorId: DOOR_HUB });
      }

      // eslint-disable-next-line no-await-in-loop
      await assertRejectsWith(async () => arm.issue(service, calls), AccessCapabilityError, { check: (error) => {

        assert.match(error.message, arm.operation, arm.label + " should name the operation");
        assert.match(error.message, arm.target, arm.label + " should name the door it addressed");
        assert.match(error.message, arm.reason, arm.label + " should name the capability that was missing");
        assert.match(error.message, /connected in (credential|dual|token) mode/, arm.label + " should name the mode");
      } });
    }
  });

  test("describes the official-only override in terms that cover a refused device as well as an inexpressible one", async () => {

    // Under this override there are two ways to end up with nothing: an operation the official API models nowhere, and one it models but refused for this device. A
    // message naming only the first would misdescribe the second.
    const calls = newCalls();
    const { service } = makeService({ calls, capabilities: { override: "official-only" } });

    await assertRejectsWith(async () => service.routedDirect({ deviceId: HUB, direct: direct(calls, "restart"), operation: "a restart" }),
      AccessCapabilityError, { check: (error) => {

        assert.match(error.message, /either cannot express that operation or refused it for this device/);
      } });
  });

  test("names a target the state does not hold by its identifier", async () => {

    /* A refusal still has to say what the command addressed when the state holds no record of the target - a door removed between the caller's read and the
     * command it was aimed at, or a device no census ever carried. The identifier is the one spelling the caller and the controller still agree on, so it stands
     * in for the name rather than the target going unnamed.
     */
    const calls = newCalls();
    const { service } = makeService({ calls, capabilities: { mode: "credential", official: false }, official: false });

    await assertRejectsWith(async () => service.routedStop({ deviceId: HUB, doorId: "00000000-0000-0000-0000-00000000ffff" }),
      AccessCapabilityError, { check: (error) => {

        assert.match(error.message, /a stop for door "00000000-0000-0000-0000-00000000ffff"/, "a door the state does not hold is named by its identifier");
      } });

    const { service: tokenOnly } = makeService({ calls, capabilities: { mode: "token" } });

    await assertRejectsWith(async () => tokenOnly.routedDirect({ deviceId: "aabbcc00ffff", direct: direct(calls, "restart"), operation: "a restart" }),
      AccessCapabilityError, { check: (error) => {

        assert.match(error.message, /a restart for device "aabbcc00ffff"/, "and so is a device it does not hold");
      } });

    assert.deepEqual(calls.direct, [], "and neither refusal issued anything at all");
  });
});

describe("the per-device firmware floor", () => {

  test("falls back after a floor refusal, having attempted the official path first", async () => {

    const calls = newCalls();
    const { service } = makeService({ calls, refuse: () => new AccessApiError("too old", { code: "CODE_DEVICE_API_NOT_SUPPORTED" }) });

    await service.routedUnlock({ deviceId: HUB, direct: direct(calls, "unlock"), doorId: DOOR_HUB });

    // The official attempt happened and was refused - the recording surface throws before recording - and the direct body is what the door actually received.
    assert.deepEqual(calls.unlocks, []);
    assert.deepEqual(calls.direct, ["unlock"]);
  });

  test("consults the memo rather than re-attempting, which is what tells a working memo from no memo at all", async () => {

    /* The steady-state row. A second command against the same device at the same firmware must route straight to the fallback: without the memo it would attempt
     * the official path again every time, which is the behavior this distinguishes.
     */
    let attempts = 0;
    const calls = newCalls();
    const { service } = makeService({ calls, refuse: () => {

      attempts++;

      return new AccessApiError("too old", { code: "CODE_DEVICE_API_NOT_SUPPORTED" });
    } });

    await service.routedUnlock({ deviceId: HUB, direct: direct(calls, "first"), doorId: DOOR_HUB });
    await service.routedUnlock({ deviceId: HUB, direct: direct(calls, "second"), doorId: DOOR_HUB });

    assert.equal(attempts, 1, "exactly one official attempt across two commands against the same device");
    assert.deepEqual(calls.direct, [ "first", "second" ]);
  });

  test("re-attempts the official path once the device's firmware moves", async () => {

    /* The memo keys on the device AND the firmware it was refused at, so an upgrade is a different key and the stale verdict is simply never consulted again. No
     * subscription and no clearing code: advancing the record is the whole of the invalidation.
     */
    let attempts = 0;
    const calls = newCalls();
    const store = storeWith();
    const { service } = makeService({ calls, refuse: () => {

      attempts++;

      return new AccessApiError("too old", { code: "CODE_DEVICE_API_NOT_SUPPORTED" });
    }, store });

    await service.routedUnlock({ deviceId: HUB, direct: direct(calls, "first"), doorId: DOOR_HUB });

    assert.equal(attempts, 1);

    const upgraded = store.snapshot().devices.get(HUB);

    assert.ok(upgraded?.firmware, "this row needs a record whose census established a firmware, since that is the key the memo moves with");
    store.dispatch({ eventName: "test", id: HUB, kind: "deviceChanged", payload: { "firmware": upgraded.firmware + ".1" } });

    await service.routedUnlock({ deviceId: HUB, direct: direct(calls, "second"), doorId: DOOR_HUB });

    assert.equal(attempts, 2, "the upgraded device is a different memo key, so the official path is tried again");
  });

  test("keeps a refusal to the command it was refused for, in both directions", async () => {

    /* A refusal proves what was asked and nothing else. One command's recorded floor must leave every other command's official path open on that same device,
     * which is what keeps a hardware-kind refusal from reading as a verdict on the whole device.
     */
    const unlockRefused = newCalls();
    const fromUnlock = makeService({ calls: unlockRefused,
      refuse: (attempt) => ((attempt.method === "unlock") ? new AccessApiError("too old", { code: "CODE_DEVICE_API_NOT_SUPPORTED" }) : undefined) });

    await fromUnlock.service.routedUnlock({ deviceId: HUB, direct: direct(unlockRefused, "unlock"), doorId: DOOR_HUB });

    assert.deepEqual(unlockRefused.direct, ["unlock"], "the refused unlock fell back to its direct expression and recorded its floor");

    await fromUnlock.service.routedSetLockRule({ deviceId: HUB, doorId: DOOR_HUB, rule: { type: "lock_now" } });

    assert.deepEqual(unlockRefused.lockRules, [{ call: {}, id: DOOR_HUB, rule: { type: "lock_now" } }],
      "and the lock rule still reached the official path on that same device");

    // The other direction, which is the same claim with the commands exchanged.
    const ruleRefused = newCalls();
    const fromRule = makeService({ calls: ruleRefused,
      refuse: (attempt) => ((attempt.method === "setLockRule") ? new AccessApiError("too old", { code: "CODE_DEVICE_API_NOT_SUPPORTED" }) : undefined) });

    await fromRule.service.routedSetLockRule({ deviceId: HUB, direct: direct(ruleRefused, "reset"), doorId: DOOR_HUB, rule: { type: "reset" } });

    assert.deepEqual(ruleRefused.direct, ["reset"]);

    await fromRule.service.routedUnlock({ deviceId: HUB, direct: direct(ruleRefused, "unlock"), doorId: DOOR_HUB });

    assert.deepEqual(ruleRefused.unlocks, [{ call: {}, id: DOOR_HUB, opts: {} }], "the unlock's official path was never suppressed by the rule's refusal");
  });

  test("keeps a refused gate command to itself, leaving the door's other commands their own official attempt", async () => {

    /* The hardware-kind refusal the gate vocabulary introduces: an ordinary door hub declines a stop with the same code a version floor uses. On a token client
     * there is no direct path to fall back to, so a device-wide memo would silently strand every other official command on that device.
     */
    const stopRefused = newCalls();
    const fromStop = makeService({ calls: stopRefused, capabilities: { mode: "token" },
      refuse: (attempt) => (((attempt.method === "unlock") && (attempt.opts?.controlCmd === "stop")) ?
        new AccessApiError("not a gate", { code: "CODE_DEVICE_API_NOT_SUPPORTED" }) : undefined) });

    await assert.rejects(async () => fromStop.service.routedStop({ deviceId: HUB, doorId: DOOR_HUB }), AccessCapabilityError);

    await fromStop.service.routedClose({ deviceId: HUB, direct: direct(stopRefused, "close"), doorId: DOOR_HUB });

    assert.deepEqual(stopRefused.unlocks, [{ call: {}, id: DOOR_HUB, opts: { controlCmd: "close" } }], "the stop's refusal says nothing about the close");

    // And a refused close leaves the plain unlock the same client depends on entirely untouched.
    const closeRefused = newCalls();
    const fromClose = makeService({ calls: closeRefused, capabilities: { mode: "token" },
      refuse: (attempt) => (((attempt.method === "unlock") && (attempt.opts?.controlCmd === "close")) ?
        new AccessApiError("not a gate", { code: "CODE_DEVICE_API_NOT_SUPPORTED" }) : undefined) });

    await assert.rejects(async () => fromClose.service.routedClose({ deviceId: HUB, direct: direct(closeRefused, "close"), doorId: DOOR_HUB }),
      AccessCapabilityError);

    await fromClose.service.routedUnlock({ deviceId: HUB, direct: direct(closeRefused, "unlock"), doorId: DOOR_HUB });

    assert.deepEqual(closeRefused.unlocks, [{ call: {}, id: DOOR_HUB, opts: {} }], "the close's refusal left the unlock officially served");
    assert.deepEqual(closeRefused.direct, [], "and a token client has no direct path that could have served it instead");
  });

  test("consults the memo for a refused close rather than re-attempting it", async () => {

    // The steady-state row for a new kind: the second close must route straight to the refusal rather than asking the controller again.
    let attempts = 0;
    const calls = newCalls();
    const { service } = makeService({ calls, capabilities: { mode: "token" }, refuse: () => {

      attempts++;

      return new AccessApiError("not a gate", { code: "CODE_DEVICE_API_NOT_SUPPORTED" });
    } });

    await assert.rejects(async () => service.routedClose({ deviceId: HUB, direct: direct(calls, "first"), doorId: DOOR_HUB }), AccessCapabilityError);
    await assert.rejects(async () => service.routedClose({ deviceId: HUB, direct: direct(calls, "second"), doorId: DOOR_HUB }), AccessCapabilityError);

    assert.equal(attempts, 1, "exactly one official attempt across two closes against the same device");
  });

  test("keeps the refusal to the device it was refused for", async () => {

    let attempts = 0;
    const calls = newCalls();
    const { service } = makeService({ calls, refuse: () => {

      attempts++;

      return new AccessApiError("too old", { code: "CODE_DEVICE_API_NOT_SUPPORTED" });
    } });

    await service.routedUnlock({ deviceId: HUB, direct: direct(calls, "hub"), doorId: DOOR_HUB });
    await service.routedUnlock({ deviceId: "aabbcc000004", direct: direct(calls, "mini"), doorId: "00000000-0000-0000-0000-00000000000e" });

    assert.equal(attempts, 2, "one device's floor says nothing about another's");
  });
});

describe("the gate stop", () => {

  test("issues the stop control command on the official path", async () => {

    const calls = newCalls();
    const { service } = makeService({ calls });

    await service.routedStop({ deviceId: HUB, doorId: DOOR_HUB });

    assert.deepEqual(calls.unlocks, [{ call: {}, id: DOOR_HUB, opts: { controlCmd: "stop" } }]);
    assert.deepEqual(calls.direct, [], "a stop carries no direct expression to take");
  });

  test("refuses in routing's own vocabulary on a client with no official path", async () => {

    const calls = newCalls();
    const { service } = makeService({ calls, capabilities: { mode: "credential", official: false }, official: false });

    await assertRejectsWith(async () => service.routedStop({ deviceId: HUB, doorId: DOOR_HUB }), AccessCapabilityError, { check: (error) => {

      assert.match(error.message, /a stop for door "Test Name 11"/, "the message names the operation and the door");
      assert.match(error.message, /requires the official API/, "and the capability that was missing");
    } });
  });

  test("refuses once the revocation latch has tripped", async () => {

    const calls = newCalls();
    const { service } = makeService({ calls, refuse: () => new AccessApiError("not supported", { code: "CODE_OTHERS_UID_ADOPTED_NOT_SUPPORTED" }) });

    // The first routed unlock is what teaches the service the session is revoked; the stop that follows has nothing left to take.
    await service.routedUnlock({ deviceId: HUB, direct: direct(calls, "unlock"), doorId: DOOR_HUB });

    await assertRejectsWith(async () => service.routedStop({ deviceId: HUB, doorId: DOOR_HUB }), AccessCapabilityError, { check: (error) => {

      assert.match(error.message, /no longer available to this session/);
    } });
  });
});

describe("the session revocation latch", () => {

  test("latches on the Identity Enterprise refusal and skips the official path thereafter", async () => {

    let attempts = 0;
    const calls = newCalls();
    const { service } = makeService({ calls, refuse: () => {

      attempts++;

      return new AccessApiError("not supported", { code: "CODE_OTHERS_UID_ADOPTED_NOT_SUPPORTED" });
    } });

    await service.routedUnlock({ deviceId: HUB, direct: direct(calls, "first"), doorId: DOOR_HUB });
    await service.routedUnlock({ deviceId: "aabbcc000004", direct: direct(calls, "second"), doorId: "00000000-0000-0000-0000-00000000000e" });

    // Unlike the floor, this is about the session rather than a device, so it holds for every device from the moment it is seen.
    assert.equal(attempts, 1);
    assert.deepEqual(calls.direct, [ "first", "second" ]);
  });

  test("refuses an operation with no fallback once the latch has tripped", async () => {

    const calls = newCalls();
    const { service } = makeService({ calls, refuse: () => new AccessApiError("not supported", { code: "CODE_OTHERS_UID_ADOPTED_NOT_SUPPORTED" }) });

    await service.routedUnlock({ deviceId: HUB, direct: direct(calls, "unlock"), doorId: DOOR_HUB });

    await assert.rejects(async () => service.routedUnlock({ actor: { id: "a1", name: "Automation" }, deviceId: HUB, direct: direct(calls, "unlock"),
      doorId: DOOR_HUB }), AccessCapabilityError);
  });
});

describe("what is not a capability verdict", () => {

  test("propagates an ordinary official refusal as itself rather than falling back", async () => {

    /* The negative control, and the one that matters most: only the two capability codes are folded. Anything else is a genuine statement about this request, and
     * swallowing it into a silent retry on the other path would hide a real failure and issue the command twice.
     */
    const calls = newCalls();
    const { service } = makeService({ calls, refuse: () => new AccessApiError("the door is busy", { code: "CODE_DEVICE_DEVICE_BUSY" }) });

    await assertRejectsWith(async () => service.routedUnlock({ deviceId: HUB, direct: direct(calls, "unlock"), doorId: DOOR_HUB }),
      AccessApiError, { check: (error) => {

        assert.equal(error.code, "CODE_DEVICE_DEVICE_BUSY");
      } });

    assert.deepEqual(calls.direct, [], "a real failure does not become a second attempt on the other path");
  });

  test("propagates a transport-level failure as itself", async () => {

    const calls = newCalls();
    const { service } = makeService({ calls, refuse: () => new Error("the socket closed") });

    await assert.rejects(async () => service.routedUnlock({ deviceId: HUB, direct: direct(calls, "unlock"), doorId: DOOR_HUB }), /the socket closed/);
    assert.deepEqual(calls.direct, []);
  });

  test("never lets a raw capability code reach the caller in auto mode", async () => {

    // The ruled contract: the codes are routing signals, so what a consumer sees is either a completed command or the library's own capability error.
    for(const code of [ "CODE_DEVICE_API_NOT_SUPPORTED", "CODE_OTHERS_UID_ADOPTED_NOT_SUPPORTED" ]) {

      const calls = newCalls();
      const { service } = makeService({ calls, refuse: () => new AccessApiError("refused", { code }) });

      // eslint-disable-next-line no-await-in-loop
      await assertRejectsWith(async () => service.routedSetLockRule({ deviceId: HUB, doorId: DOOR_HUB, rule: { type: "lock_now" } }),
        AccessCapabilityError, { check: (error) => {

          assert.ok(!(error instanceof AccessApiError), "the refusal reaches the caller as a capability error rather than as the raw official error");
        }, message: code + " should reach the caller as a capability error" });
    }
  });
});

describe("a command only the direct path can carry", () => {

  test("runs the direct expression on a client that holds credentials", async () => {

    for(const mode of [ "credential", "dual" ] as const) {

      const calls = newCalls();
      const { service } = makeService({ calls, capabilities: { mode }, official: (mode === "dual") });

      // eslint-disable-next-line no-await-in-loop
      await service.routedDirect({ deviceId: HUB, direct: direct(calls, "restart"), operation: "a restart" });

      assert.deepEqual(calls.direct, ["restart"], mode + " holds a direct path, so the command takes it");
    }
  });

  test("refuses it on a client held to the official API, which cannot express it", async () => {

    // The override means one channel, whatever identities the client holds and however the command is spelled: what that channel cannot carry, the client refuses.
    for(const mode of [ "dual", "token" ] as const) {

      const calls = newCalls();
      const { service } = makeService({ calls, capabilities: { mode, override: "official-only" } });

      for(const operation of [ "a restart", "a configuration write" ]) {

        // eslint-disable-next-line no-await-in-loop
        await assertRejectsWith(async () => service.routedDirect({ deviceId: HUB, direct: direct(calls, operation), operation }),
          AccessCapabilityError, { check: (error) => {

            assert.match(error.message, new RegExp(operation), "the message names the operation");
            assert.match(error.message, /for device "Test alias 13"/, "and the device it addressed");
            assert.match(error.message, /held to the official API/, "and the override that left it nowhere to go");
            assert.match(error.message, new RegExp("\\(connected in " + mode + " mode\\)"), "and the mode");
          } });
      }

      assert.deepEqual(calls.direct, [], "no direct expression ran on a client held to one channel in " + mode + " mode");
    }
  });

  test("refuses on a client with no credentials, without ever invoking the expression", async () => {

    // A restart and a configuration write are one refusal here, because a client that holds no direct path has nowhere to take either of them.
    const calls = newCalls();
    const { service } = makeService({ calls, capabilities: { mode: "token" } });

    for(const operation of [ "a restart", "a configuration write" ]) {

      // eslint-disable-next-line no-await-in-loop
      await assertRejectsWith(async () => service.routedDirect({ deviceId: HUB, direct: direct(calls, operation), operation }),
        AccessCapabilityError, { check: (error) => {

          assert.match(error.message, new RegExp(operation), "the message names the operation");
          assert.match(error.message, /for device "Test alias 13"/, "and the device it addressed");
          assert.match(error.message, /holds no credentials for the Access application's own endpoints/, "and the capability that was missing");
          assert.match(error.message, /\(connected in token mode\)/, "and the mode");
        } });
    }

    assert.deepEqual(calls.direct, [], "a refused command issues nothing at all");
  });

  test("a revoked official path is the more specific reason, and wins over the missing credentials", async () => {

    /* The specificity order. A token-only client whose session the controller revoked has two true things to say, and the revocation is the particular one: it is
     * a verdict the controller handed down, where holding no credentials is merely what this client always was.
     */
    const calls = newCalls();
    const { service } = makeService({ calls, capabilities: { mode: "token" },
      refuse: () => new AccessApiError("refused", { code: "CODE_OTHERS_UID_ADOPTED_NOT_SUPPORTED" }) });

    // The first routed unlock is what teaches the service the session is revoked; its own refusal is not what this row is about.
    await assert.rejects(async () => service.routedUnlock({ deviceId: HUB, direct: direct(calls, "unlock"), doorId: DOOR_HUB }), AccessCapabilityError);

    await assertRejectsWith(async () => service.routedUnlock({ deviceId: HUB, direct: direct(calls, "unlock"), doorId: DOOR_HUB }),
      AccessCapabilityError, { check: (error) => {

        assert.match(error.message, /no longer available to this session on this controller/, "the revoked arm is the one that speaks");
        assert.equal(error.message.includes("holds no credentials"), false, "and the general arm stays quiet behind it");
      } });

    // The latch speaks for a command with no official half too: refused for the revocation, the more particular reason, rather than for credentials it never held.
    await assertRejectsWith(async () => service.routedDirect({ deviceId: HUB, direct: direct(calls, "restart"), operation: "a restart" }),
      AccessCapabilityError, { check: (error) => {

        assert.match(error.message, /no longer available to this session on this controller/);
      } });

    assert.deepEqual(calls.direct, [], "and no direct path was taken on any attempt");
  });
});

describe("the caller's abort signal", () => {

  /* Every forwarding row here pairs its shape assertion with an identity check. `deepEqual` compares two unaborted signals as equal, so the shape alone would
   * pass on a freshly minted signal forwarded in place of the caller's own - the identity line is what tells those apart.
   */
  test("a routed unlock hands the caller's signal to the official surface as its call options", async () => {

    const calls = newCalls();
    const { service } = makeService({ calls });
    const controller = new AbortController();

    await service.routedUnlock({ deviceId: HUB, direct: direct(calls, "unlock"), doorId: DOOR_HUB, signal: controller.signal });

    assert.deepEqual(calls.unlocks, [{ call: { signal: controller.signal }, id: DOOR_HUB, opts: {} }]);
    assert.deepEqual(calls.direct, [], "the official path served, so the direct expression was not taken");
    assert.equal(calls.unlocks[0]?.call?.signal, controller.signal, "and what it carries is the caller's own signal rather than a stand-in");
  });

  test("a signal alone does not make an unlock official-only", async () => {

    /* The predicate deciding official-only must not flip on the signal. A cancellation is something both paths can honor, so an unlock carrying nothing else
     * keeps the direct fallback it would have had without one - on a client that holds no official path at all, that fallback is the whole of the command.
     */
    const calls = newCalls();
    const { service } = makeService({ calls, capabilities: { mode: "credential", official: false }, official: false });
    const controller = new AbortController();

    await service.routedUnlock({ deviceId: HUB, direct: direct(calls, "unlock"), doorId: DOOR_HUB, signal: controller.signal });

    assert.deepEqual(calls.direct, ["unlock"], "the direct path served rather than the unlock refusing for want of an official one");
    assert.deepEqual(calls.unlocks, []);
  });

  test("a routed close's official half carries the signal with the control command", async () => {

    const calls = newCalls();
    const { service } = makeService({ calls, capabilities: { mode: "token" } });
    const controller = new AbortController();

    await service.routedClose({ deviceId: HUB, direct: direct(calls, "close"), doorId: DOOR_HUB, signal: controller.signal });

    assert.deepEqual(calls.unlocks, [{ call: { signal: controller.signal }, id: DOOR_HUB, opts: { controlCmd: "close" } }]);
    assert.deepEqual(calls.direct, [], "a token client holds no direct path for the close to take");
    assert.equal(calls.unlocks[0]?.call?.signal, controller.signal, "and the signal is the caller's own");
  });

  test("a routed stop carries the signal with the control command", async () => {

    const calls = newCalls();
    const { service } = makeService({ calls });
    const controller = new AbortController();

    await service.routedStop({ deviceId: HUB, doorId: DOOR_HUB, signal: controller.signal });

    assert.deepEqual(calls.unlocks, [{ call: { signal: controller.signal }, id: DOOR_HUB, opts: { controlCmd: "stop" } }]);
    assert.equal(calls.unlocks[0]?.call?.signal, controller.signal, "and the signal is the caller's own");
  });

  test("a routed lock rule hands the signal to the official surface as its call options", async () => {

    const calls = newCalls();
    const { service } = makeService({ calls });
    const controller = new AbortController();

    await service.routedSetLockRule({ deviceId: HUB, doorId: DOOR_HUB, rule: { type: "lock_now" }, signal: controller.signal });

    assert.deepEqual(calls.lockRules, [{ call: { signal: controller.signal }, id: DOOR_HUB, rule: { type: "lock_now" } }]);
    assert.equal(calls.lockRules[0]?.call?.signal, controller.signal, "and the signal is the caller's own");
  });

  test("an abort from the official half propagates as itself and teaches the memo nothing", async () => {

    /* A cancelled request is not a capability verdict. Only the two capability codes fold, so the abort reaches the caller as itself; the direct path is not
     * tried, because issuing the command anyway is the one thing the caller just asked not to happen; and the memo files nothing, because an abort says
     * something about the caller rather than about the device or the session.
     */
    let attempts = 0;
    const calls = newCalls();
    const { service } = makeService({ calls, refuse: () => {

      attempts++;

      return (attempts === 1) ? new AccessAbortedError("The request was aborted by the caller's signal.") : undefined;
    } });
    const controller = new AbortController();

    await assert.rejects(async () => service.routedUnlock({ deviceId: HUB, direct: direct(calls, "unlock"), doorId: DOOR_HUB, signal: controller.signal }),
      AccessAbortedError);

    assert.deepEqual(calls.direct, [], "the caller cancelled, so there is no fallback to take");

    // A second, unrefused command is what proves nothing was recorded: a memo entry would send this one straight to the direct path instead.
    await service.routedUnlock({ deviceId: HUB, direct: direct(calls, "unlock"), doorId: DOOR_HUB });

    assert.deepEqual(calls.unlocks, [{ call: {}, id: DOOR_HUB, opts: {} }], "the official path served the second command");
    assert.deepEqual(calls.direct, []);
  });
});

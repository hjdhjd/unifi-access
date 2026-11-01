/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * routing.test.ts: Unit tests for the routing decision. These drive the service directly against a recording official surface and a real state store, because what
 * matters here is WHICH path each command takes and what the two runtime capability verdicts do to that choice over a client's life - questions that are about the
 * decision rather than about anything on the wire.
 */
import { AccessAbortedError, AccessApiError, AccessAuthError, AccessAuthorizationError, AccessCapabilityError, AccessDeclinedError, AccessNetworkError,
  AccessRequestError, AccessThrottledError, AccessTimeoutError, formatErrorChain } from "../errors.ts";
import type { AccessCapabilities, AccessOfficialRoutingSurface } from "./routing.ts";
import type { AccessOfficialAccessMethods, AccessOfficialDeviceSettings, AccessOfficialDeviceSettingsUpdate } from "../official/devices.ts";
import type { CapturingLog, TestLogEntry } from "homebridge-plugin-utils/testing";
import { HOST, officialPath } from "../official/domain.helpers.ts";
import { TestClock, capturingLog, loggedAt, silentLog } from "homebridge-plugin-utils/testing";
import { describe, test } from "node:test";
import { officialEndpoint, officialHost } from "../official/endpoints.ts";
import type { AccessLogging } from "../logging.ts";
import type { AccessOfficialCallOptions } from "../official/dispatch.ts";
import type { AccessOfficialDoorUnlockOptions } from "../official/spaces.ts";
import { AccessRoutingService } from "./routing.ts";
import { OfficialDispatch } from "../official/dispatch.ts";
import { StateStore } from "../state/store.ts";
import { accessBootstrap2026Fixture } from "../protocol/topology.fixtures.ts";
import assert from "node:assert/strict";
import { makeMockTransport } from "../transport/mock-controller.helpers.ts";
import { refuseRefresh } from "../testing.helpers.ts";

const HUB = "aabbcc000001";
const DOOR_HUB = "00000000-0000-0000-0000-000000000006";

// The transport's own sentence for each refusal of the token, which the closure's warning carries as it stands.
const TOKEN_REJECTED = "The UniFi Access controller rejected the configured API token. Please check that the token is valid and has not been revoked.";
const TOKEN_FORBIDDEN = "The configured API token lacks the permissions this operation requires on the UniFi Access controller.";

// The controller's own sentence for a refusal it answers inside a successful response. The closure's warning carries it as it stands, as it does the transport's.
const ENVELOPE_REFUSAL = "The controller declined the request.";

// The result codes the vendor's reference documents for a refused identity, spelled here independently of the library's own list.
const IDENTITY_REFUSAL_CODES = [ "CODE_ACCESS_TOKEN_INVALID", "CODE_AUTH_FAILED", "CODE_UNAUTHORIZED" ] as const;

// What each side of a routed decision recorded, so a test asserts the path taken rather than inferring it.
interface RecordedCalls {

  direct: string[];
  lockRules: { call: AccessOfficialCallOptions | undefined; id: string; rule: unknown }[];
  settingsReads: { call: AccessOfficialCallOptions | undefined; id: string }[];
  settingsWrites: { call: AccessOfficialCallOptions | undefined; id: string; opts: AccessOfficialDeviceSettingsUpdate }[];
  unlocks: { call: AccessOfficialCallOptions | undefined; id: string; opts: AccessOfficialDoorUnlockOptions | undefined }[];
}

// What the official surface is being asked to do, which is what lets a refusal be scoped to one command - the granularity the floor memo files its verdicts at.
type OfficialAttempt = { method: "fetchSettings" } | { method: "setLockRule"; rule: unknown } | { method: "unlock"; opts: AccessOfficialDoorUnlockOptions | undefined } |
  { method: "updateSettings"; opts: AccessOfficialDeviceSettingsUpdate };

// The official keys every access method spans, each switched off: a device listing every method the vocabulary names, which is the default the fake controller holds.
const EVERY_METHOD_OFF: AccessOfficialAccessMethods = { "bt_button": { enabled: "no" }, "bt_tap": { enabled: "no" }, face: { enabled: "no" }, nfc: { enabled: "no" },
  "pin_code": { enabled: "no", "pin_code_shuffle": "no" }, "qr_code": { enabled: "no" }, "touch_pass": { enabled: "no" }, wave: { enabled: "no" } };

/* What the fake controller holds for a device's official settings, and how it answers a write. A write applies to every key the device lists and to nothing else,
 * which is the documented no-effect for a method the hardware does not offer; a declining controller applies nothing at all, which is the silent decline a
 * read-back exists to catch.
 */
interface FakeSettings {

  declines?: boolean;
  listed?: AccessOfficialAccessMethods;
}

/* A recording official surface. `refuse` is consulted on every official call and, when it answers with an error, is what that call throws - which is how the two
 * capability codes and an ordinary fault are driven through the same path, and how a refusal aimed at one command alone is expressed. The difference between them
 * is exactly what the service is being tested on. `settings` is what the fake controller holds for a device's access methods, and how it answers a write.
 */
function officialSurface(calls: RecordedCalls, refuse?: (attempt: OfficialAttempt) => Error | undefined, settings: FakeSettings = {}): AccessOfficialRoutingSurface {

  const attempt = (asked: OfficialAttempt): void => {

    const error = refuse?.(asked);

    if(error !== undefined) {

      throw error;
    }
  };

  const held: Record<string, object> = structuredClone({ ...(settings.listed ?? EVERY_METHOD_OFF) });

  return {

    devices: {

      fetchSettings: async (id: string, call?: AccessOfficialCallOptions): Promise<AccessOfficialDeviceSettings> => {

        attempt({ method: "fetchSettings" });

        calls.settingsReads.push({ call, id });

        // The held map is the listing the device was seeded with as the writes have left it, so it answers in the shape it was seeded from.
        return { "access_methods": structuredClone(held), "device_id": id };
      },
      updateSettings: async (id: string, opts: AccessOfficialDeviceSettingsUpdate, call?: AccessOfficialCallOptions): Promise<void> => {

        attempt({ method: "updateSettings", opts });

        calls.settingsWrites.push({ call, id, opts });

        for(const key of Object.keys(held)) {

          const value = opts.access_methods[key as keyof AccessOfficialDeviceSettingsUpdate["access_methods"]];

          if((settings.declines !== true) && (value !== undefined)) {

            held[key] = { ...held[key], ...value };
          }
        }
      }
    },
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

  const store = new StateStore({ clock: new TestClock(), log: silentLog(), refresh: refuseRefresh, refreshIntervalMs: false });

  store.dispatch({ data: JSON.parse(JSON.stringify(bootstrap)) as typeof bootstrap, kind: "bootstrapLoaded" });

  return store;
}

function makeService(options: { calls: RecordedCalls; capabilities?: Partial<AccessCapabilities>; log?: AccessLogging; official?: boolean;
  refuse?: (attempt: OfficialAttempt) => Error | undefined; settings?: FakeSettings; store?: StateStore; }): { service: AccessRoutingService; store: StateStore } {

  const store = options.store ?? storeWith();
  const capabilities: AccessCapabilities = { mode: "dual", official: true, override: "auto", ...options.capabilities };
  const service = new AccessRoutingService({ capabilities, log: options.log ?? silentLog(),
    official: ((options.official ?? true) ? officialSurface(options.calls, options.refuse, options.settings) : null), store });

  return { service, store };
}

const newCalls = (): RecordedCalls => ({ direct: [], lockRules: [], settingsReads: [], settingsWrites: [], unlocks: [] });
const direct = (calls: RecordedCalls, label: string) => async (): Promise<void> => void calls.direct.push(label);
const warnings = (log: CapturingLog): TestLogEntry[] => log.entries.filter((entry) => (entry.level === "warn"));

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

    // The refusal names the unlock by what made it official-only.
    await assert.rejects(async () => credential.service.routedUnlock({ deviceId: HUB, direct: direct(credentialCalls, "unlock"), doorId: DOOR_HUB,
      entryMethod: "out" }), { message: /an unlock carrying an entry direction/, name: "AccessCapabilityError" });

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

    await assert.rejects(async () => credential.service.routedUnlock({ actor: { id: "a1", name: "Automation" }, deviceId: HUB,
      direct: direct(credentialCalls, "unlock"), doorId: DOOR_HUB, entryMethod: "in" }), { message: /an unlock attributed to an actor/, name: "AccessCapabilityError" });
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

    await assert.rejects(async () => credential.service.routedSetLockRule({ deviceId: HUB, doorId: DOOR_HUB, rule: { type: "lock_now" } }), {

      message: /the lock_now lock rule for door "Test Name 11"/,
      name: "AccessCapabilityError"
    });
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

    await assert.rejects(async () => service.routedClose({ deviceId: HUB, direct: direct(calls, "close"), doorId: DOOR_HUB }), (error: unknown) => {

      assert.ok(error instanceof AccessCapabilityError);
      assert.match(error.message, /a close for door "Test Name 11"/, "the message names the operation and the door");
      assert.match(error.message, /holds no credentials for the Access application's own endpoints/, "and the capability that was missing");

      return true;
    });

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

    /* The class documents its message as carrying each of them, and a message is the whole of what this error offers a caller - so each arm is checked rather than one
     * standing in for the rest. Each revoked arm is reached by tripping the latch first, which is the only way to produce it: the Identity Enterprise code closes the
     * official path to every command, and a refused door permission closes it to door commands.
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
      { capabilities: { mode: "dual" }, issue: attributedUnlock, label: "door commands closed", official: true, operation: /an unlock attributed to an actor/,
        reason: /door commands/, refuse: () => new AccessAuthorizationError(TOKEN_FORBIDDEN, { identity: "token", statusCode: 403 }), target: /for door "Test Name 11"/ },
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
      await assert.rejects(async () => arm.issue(service, calls), (error: unknown) => {

        assert.ok(error instanceof AccessCapabilityError);
        assert.match(error.message, arm.operation, arm.label + " should name the operation");
        assert.match(error.message, arm.target, arm.label + " should name the door it addressed");
        assert.match(error.message, arm.reason, arm.label + " should name the capability that was missing");
        assert.match(error.message, /connected in (credential|dual|token) mode/, arm.label + " should name the mode");

        return true;
      });
    }
  });

  test("describes the official-only override in terms that cover a refused device as well as an inexpressible one", async () => {

    // Under this override there are two ways to end up with nothing: an operation the official API models nowhere, and one it models but refused for this device. A
    // message naming only the first would misdescribe the second.
    const calls = newCalls();
    const { service } = makeService({ calls, capabilities: { override: "official-only" } });

    await assert.rejects(async () => service.routedDirect({ deviceId: HUB, direct: direct(calls, "restart"), operation: "a restart" }), {

      message: /either cannot express that operation or refused it for this device/,
      name: "AccessCapabilityError"
    });
  });

  test("names a target the state does not hold by its identifier", async () => {

    /* A refusal still has to say what the command addressed when the state holds no record of the target - a door removed between the caller's read and the
     * command it was aimed at, or a device no census ever carried. The identifier is the one spelling the caller and the controller still agree on, so it stands
     * in for the name rather than the target going unnamed.
     */
    const calls = newCalls();
    const { service } = makeService({ calls, capabilities: { mode: "credential", official: false }, official: false });

    await assert.rejects(async () => service.routedStop({ deviceId: HUB, doorId: "00000000-0000-0000-0000-00000000ffff" }), {

      message: /a stop for door "00000000-0000-0000-0000-00000000ffff"/,
      name: "AccessCapabilityError"
    });

    const { service: tokenOnly } = makeService({ calls, capabilities: { mode: "token" } });

    await assert.rejects(async () => tokenOnly.routedDirect({ deviceId: "aabbcc00ffff", direct: direct(calls, "restart"), operation: "a restart" }), {

      message: /a restart for device "aabbcc00ffff"/,
      name: "AccessCapabilityError"
    });

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

  test("falls back after a floor refusal the controller answers at a 400, as the official dispatch reads one", async () => {

    /* The official surface reads a refusal the controller answers at a 4xx in its own vocabulary as that refusal, so the error routing meets here is the one the
     * dispatch itself produces over a mocked controller rather than one built by hand. The routing decision is then the same one a 2xx refusal reaches.
     */
    const { pool, transport } = makeMockTransport({ host: officialHost(HOST) });
    const dispatch = new OfficialDispatch({ transport });

    pool.intercept({ method: "PUT", path: officialPath("/doors/" + DOOR_HUB + "/unlock") })
      .reply(400, { "code": "CODE_DEVICE_API_NOT_SUPPORTED", "msg": "The device does not support this API." });

    const refusal: unknown = await dispatch.command(officialEndpoint(HOST, "/doors/" + DOOR_HUB + "/unlock"), { method: "PUT" }).catch((error: unknown) => error);

    assert.ok(refusal instanceof AccessApiError, "the dispatch reads the 400's envelope as the controller's refusal");

    const calls = newCalls();
    const { service } = makeService({ calls, refuse: () => refusal });

    await service.routedUnlock({ deviceId: HUB, direct: direct(calls, "unlock"), doorId: DOOR_HUB });

    assert.deepEqual(calls.unlocks, [], "the official attempt was refused");
    assert.deepEqual(calls.direct, ["unlock"], "and the door was unlocked over the direct path instead");
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

    await assert.rejects(async () => service.routedStop({ deviceId: HUB, doorId: DOOR_HUB }), (error: unknown) => {

      assert.ok(error instanceof AccessCapabilityError);
      assert.match(error.message, /a stop for door "Test Name 11"/, "the message names the operation and the door");
      assert.match(error.message, /requires the official API/, "and the capability that was missing");

      return true;
    });
  });

  test("refuses once the revocation latch has tripped", async () => {

    const calls = newCalls();
    const { service } = makeService({ calls, refuse: () => new AccessApiError("not supported", { code: "CODE_OTHERS_UID_ADOPTED_NOT_SUPPORTED" }) });

    // The first routed unlock is what teaches the service the session is revoked; the stop that follows has nothing left to take.
    await service.routedUnlock({ deviceId: HUB, direct: direct(calls, "unlock"), doorId: DOOR_HUB });

    await assert.rejects(async () => service.routedStop({ deviceId: HUB, doorId: DOOR_HUB }), {

      message: /no longer available to this session/,
      name: "AccessCapabilityError"
    });
  });
});

describe("the session revocation latch", () => {

  test("latches on the Identity Enterprise refusal, reports it once, and skips the official path thereafter", async () => {

    let attempts = 0;
    const calls = newCalls();
    const log = capturingLog();
    const { service } = makeService({ calls, log, refuse: () => {

      attempts++;

      return new AccessApiError("not supported", { code: "CODE_OTHERS_UID_ADOPTED_NOT_SUPPORTED" });
    } });

    await service.routedUnlock({ deviceId: HUB, direct: direct(calls, "first"), doorId: DOOR_HUB });
    await service.routedUnlock({ deviceId: "aabbcc000004", direct: direct(calls, "second"), doorId: "00000000-0000-0000-0000-00000000000e" });

    // Unlike the floor, this is about the session rather than a device, so it holds for every device from the moment it is seen.
    assert.equal(attempts, 1);
    assert.deepEqual(calls.direct, [ "first", "second" ]);
    assert.deepEqual(warnings(log).map((entry) => entry.params), [[{ code: "CODE_OTHERS_UID_ADOPTED_NOT_SUPPORTED" }]],
      "the closure is reported once, carrying the code, however many commands follow it");
    assert.ok(loggedAt(log.entries, "warn", "own endpoints"), "and the report tells the reader the commands take the direct path");
  });

  test("latches on a rejected token where the direct path can carry the command, and reports it once", async () => {

    /* The token passed the read that verified it at connect and is rejected on the command itself, which is a verdict on the token rather than on the request. A
     * client holding credentials has somewhere else to go, so the command completes there, and every command after it goes straight there on every device.
     */
    let attempts = 0;
    const calls = newCalls();
    const log = capturingLog();
    const { service } = makeService({ calls, log, refuse: () => {

      attempts++;

      return new AccessAuthError(TOKEN_REJECTED, { identity: "token", statusCode: 401 });
    } });

    await service.routedUnlock({ deviceId: HUB, direct: direct(calls, "first"), doorId: DOOR_HUB });
    await service.routedUnlock({ deviceId: "aabbcc000004", direct: direct(calls, "second"), doorId: "00000000-0000-0000-0000-00000000000e" });

    assert.equal(attempts, 1, "the rejected token is asked once, and the latch answers every command after it");
    assert.deepEqual(calls.direct, [ "first", "second" ], "each unlock completed on the direct path");
    assert.deepEqual(warnings(log).map((entry) => entry.params), [[{ identity: "token", statusCode: 401 }]],
      "the closure is reported once, however many commands follow it");
    assert.ok(loggedAt(log.entries, "warn", "rejected the configured API token"), "the report carries the transport's own sentence, which sends the reader to the token");
    assert.ok(loggedAt(log.entries, "warn", "own endpoints"), "and tells the reader the commands take the direct path");
  });

  test("latches on a token refused a permission where the direct path can carry the command, and reports it once", async () => {

    /* The token authenticated and was refused this operation. Its permissions were fixed when it was issued, so the refusal is a fact about this client rather than about
     * the moment it asked, and a client holding credentials takes the direct path for this command and every door command after it.
     */
    let attempts = 0;
    const calls = newCalls();
    const log = capturingLog();
    const { service } = makeService({ calls, log, refuse: () => {

      attempts++;

      return new AccessAuthorizationError(TOKEN_FORBIDDEN, { identity: "token", statusCode: 403 });
    } });

    await service.routedUnlock({ deviceId: HUB, direct: direct(calls, "first"), doorId: DOOR_HUB });
    await service.routedUnlock({ deviceId: "aabbcc000004", direct: direct(calls, "second"), doorId: "00000000-0000-0000-0000-00000000000e" });

    assert.equal(attempts, 1, "the refused permission is asked once, and the latch answers every door command after it");
    assert.deepEqual(calls.direct, [ "first", "second" ], "each unlock completed on the direct path");
    assert.deepEqual(warnings(log).map((entry) => entry.params), [[{ identity: "token", statusCode: 403 }]],
      "the closure is reported once, however many commands follow it");
    assert.ok(loggedAt(log.entries, "warn", "lacks the permissions"), "the report carries the transport's own sentence for the refused permission");
    assert.ok(loggedAt(log.entries, "warn", "own endpoints"), "and tells the reader the commands take the direct path");
  });

  test("latches on each identity refusal code answered inside a successful response where the direct path can carry the command, and reports it once", async () => {

    /* The controller's own spellings of a rejected token: a 2xx whose result code refuses the identity, reaching the fold as an API error rather than as the
     * transport's classification of a status. Each is the same verdict on the token, so each closes the path the same way, and the report carries the code.
     */
    for(const code of IDENTITY_REFUSAL_CODES) {

      let attempts = 0;
      const calls = newCalls();
      const log = capturingLog();
      const { service } = makeService({ calls, log, refuse: () => {

        attempts++;

        return new AccessApiError(ENVELOPE_REFUSAL, { code });
      } });

      // eslint-disable-next-line no-await-in-loop
      await service.routedUnlock({ deviceId: HUB, direct: direct(calls, "first"), doorId: DOOR_HUB });
      // eslint-disable-next-line no-await-in-loop
      await service.routedUnlock({ deviceId: "aabbcc000004", direct: direct(calls, "second"), doorId: "00000000-0000-0000-0000-00000000000e" });

      assert.equal(attempts, 1, code + ": the refused token is asked once, and the latch answers every command after it");
      assert.deepEqual(calls.direct, [ "first", "second" ], code + ": each unlock completed on the direct path");
      assert.deepEqual(warnings(log).map((entry) => entry.params), [[{ code }]], code + ": the closure is reported once, carrying the code");
      assert.ok(loggedAt(log.entries, "warn", ENVELOPE_REFUSAL), code + ": the report carries the controller's own sentence");
      assert.ok(loggedAt(log.entries, "warn", "own endpoints"), code + ": and tells the reader the commands take the direct path");
    }
  });

  test("latches on the privilege refusal code answered inside a successful response where the direct path can carry the command, and reports it once", async () => {

    // The controller's own spelling of a token refused a permission, which folds exactly as the transport's classification of a 403 does.
    let attempts = 0;
    const calls = newCalls();
    const log = capturingLog();
    const { service } = makeService({ calls, log, refuse: () => {

      attempts++;

      return new AccessApiError(ENVELOPE_REFUSAL, { code: "CODE_OPERATION_FORBIDDEN" });
    } });

    await service.routedUnlock({ deviceId: HUB, direct: direct(calls, "first"), doorId: DOOR_HUB });
    await service.routedUnlock({ deviceId: "aabbcc000004", direct: direct(calls, "second"), doorId: "00000000-0000-0000-0000-00000000000e" });

    assert.equal(attempts, 1, "the refused permission is asked once, and the latch answers every door command after it");
    assert.deepEqual(calls.direct, [ "first", "second" ], "each unlock completed on the direct path");
    assert.deepEqual(warnings(log).map((entry) => entry.params), [[{ code: "CODE_OPERATION_FORBIDDEN" }]], "the closure is reported once, carrying the code");
    assert.ok(loggedAt(log.entries, "warn", ENVELOPE_REFUSAL), "the report carries the controller's own sentence");
    assert.ok(loggedAt(log.entries, "warn", "own endpoints"), "and tells the reader the commands take the direct path");
  });

  test("reports the closure once when commands already in flight are refused together", async () => {

    /* Routed commands issued together each take the official path before any refusal arrives, so each refusal reaches the closure. The latch records that the
     * closure was reported, so the first refusal to arrive is the one that speaks and the rest close nothing new.
     */
    const refusals = [ { error: new AccessAuthError(TOKEN_REJECTED, { identity: "token", statusCode: 401 }), label: "a rejected token" },
      { error: new AccessApiError("not supported", { code: "CODE_OTHERS_UID_ADOPTED_NOT_SUPPORTED" }), label: "the Identity Enterprise code" } ];

    for(const refusal of refusals) {

      let attempts = 0;
      const calls = newCalls();
      const log = capturingLog();
      const { service } = makeService({ calls, log, refuse: () => {

        attempts++;

        return refusal.error;
      } });

      // eslint-disable-next-line no-await-in-loop
      await Promise.all([ service.routedUnlock({ deviceId: HUB, direct: direct(calls, "first"), doorId: DOOR_HUB }),
        service.routedUnlock({ deviceId: "aabbcc000004", direct: direct(calls, "second"), doorId: "00000000-0000-0000-0000-00000000000e" }) ]);

      assert.equal(attempts, 2, refusal.label + ": each command reached the official path before any refusal arrived");
      assert.deepEqual(calls.direct, [ "first", "second" ], refusal.label + ": each command completed on the direct path");
      assert.equal(warnings(log).length, 1, refusal.label + ": the closure is reported once");
    }
  });

  test("reports a closure of door commands once, naming them, when door commands already in flight are refused a permission together", async () => {

    /* Once a refused door permission has closed the official path to door commands, no door command reaches that path again, so only door commands already in flight
     * can meet the refusal twice. Each spelling of the refusal closes the same reach, and the second refusal to arrive finds it already closed.
     */
    for(const refusal of [ new AccessAuthorizationError(TOKEN_FORBIDDEN, { identity: "token", statusCode: 403 }),
      new AccessApiError(ENVELOPE_REFUSAL, { code: "CODE_OPERATION_FORBIDDEN" }) ]) {

      let attempts = 0;
      const calls = newCalls();
      const log = capturingLog();
      const { service } = makeService({ calls, log, refuse: () => {

        attempts++;

        return refusal;
      } });

      // eslint-disable-next-line no-await-in-loop
      await Promise.all([ service.routedUnlock({ deviceId: HUB, direct: direct(calls, "first"), doorId: DOOR_HUB }),
        service.routedUnlock({ deviceId: "aabbcc000004", direct: direct(calls, "second"), doorId: "00000000-0000-0000-0000-00000000000e" }) ]);

      assert.equal(attempts, 2, refusal.name + ": each command reached the official path before any refusal arrived");
      assert.deepEqual(calls.direct, [ "first", "second" ], refusal.name + ": each command completed on the direct path");
      assert.equal(warnings(log).length, 1, refusal.name + ": the closure is reported once");
      assert.ok(loggedAt(log.entries, "warn", "This client's door commands will use the Access application's own endpoints"), refusal.name + ": naming door commands");
    }
  });

  test("keeps a rejected token as itself on every call from a client with no direct path", async () => {

    /* With nowhere else to go, the token is the one thing to fix, and the authentication error is what says so. Latching here would turn every call after the first
     * into a capability error that does not name the token.
     */
    let attempts = 0;
    const calls = newCalls();
    const log = capturingLog();
    const { service } = makeService({ calls, capabilities: { mode: "token" }, log, refuse: () => {

      attempts++;

      return new AccessAuthError("rejected", { identity: "token", statusCode: 401 });
    } });

    await assert.rejects(async () => service.routedUnlock({ deviceId: HUB, direct: direct(calls, "first"), doorId: DOOR_HUB }), AccessAuthError);
    await assert.rejects(async () => service.routedUnlock({ deviceId: HUB, direct: direct(calls, "second"), doorId: DOOR_HUB }), AccessAuthError);

    assert.equal(attempts, 2, "nothing was latched, so the second call asked the controller again");
    assert.deepEqual(calls.direct, [], "a token client holds no direct path to take");
    assert.deepEqual(warnings(log), [], "and nothing was closed, so nothing was reported");
  });

  test("keeps a token refused a permission as itself on every call from a client with no direct path", async () => {

    // The same reasoning for the other refusal of the token: the privilege error names the permission to reissue the token with, where a capability error would not.
    let attempts = 0;
    const calls = newCalls();
    const log = capturingLog();
    const { service } = makeService({ calls, capabilities: { mode: "token" }, log, refuse: () => {

      attempts++;

      return new AccessAuthorizationError("forbidden", { identity: "token", statusCode: 403 });
    } });

    await assert.rejects(async () => service.routedUnlock({ deviceId: HUB, direct: direct(calls, "first"), doorId: DOOR_HUB }), AccessAuthorizationError);
    await assert.rejects(async () => service.routedUnlock({ deviceId: HUB, direct: direct(calls, "second"), doorId: DOOR_HUB }), AccessAuthorizationError);

    assert.equal(attempts, 2, "nothing was latched, so the second call asked the controller again");
    assert.deepEqual(calls.direct, [], "a token client holds no direct path to take");
    assert.deepEqual(warnings(log), [], "and nothing was closed, so nothing was reported");
  });

  test("keeps each refusal code answered inside a successful response as itself on every call from a client with no direct path", async () => {

    // The controller's own spellings on a client with nowhere else to go: each stays the API error it arrived as, whose code names what to fix in the token.
    for(const code of [ ...IDENTITY_REFUSAL_CODES, "CODE_OPERATION_FORBIDDEN" ]) {

      let attempts = 0;
      const calls = newCalls();
      const log = capturingLog();
      const { service } = makeService({ calls, capabilities: { mode: "token" }, log, refuse: () => {

        attempts++;

        return new AccessApiError(ENVELOPE_REFUSAL, { code });
      } });

      for(const label of [ "first", "second" ]) {

        // eslint-disable-next-line no-await-in-loop
        await assert.rejects(async () => service.routedUnlock({ deviceId: HUB, direct: direct(calls, label), doorId: DOOR_HUB }), (error: unknown) => {

          assert.ok(error instanceof AccessApiError);
          assert.equal(error.code, code, code + ": the " + label + " call reaches the caller as the refusal it arrived as");

          return true;
        });
      }

      assert.equal(attempts, 2, code + ": nothing was latched, so the second call asked the controller again");
      assert.deepEqual(calls.direct, [], code + ": a token client holds no direct path to take");
      assert.deepEqual(warnings(log), [], code + ": and nothing was closed, so nothing was reported");
    }
  });

  test("keeps a rejected token as itself on a client held to the official API", async () => {

    const calls = newCalls();
    const log = capturingLog();
    const { service } = makeService({ calls, capabilities: { override: "official-only" }, log,
      refuse: () => new AccessAuthError("rejected", { identity: "token", statusCode: 401 }) });

    await assert.rejects(async () => service.routedUnlock({ deviceId: HUB, direct: direct(calls, "unlock"), doorId: DOOR_HUB }), {

      identity: "token",
      name: "AccessAuthError"
    });

    assert.deepEqual(calls.direct, [], "the override is what leaves the credentials unused");
    assert.deepEqual(warnings(log), [], "and nothing was closed, so nothing was reported");
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

    /* The negative control, and the one that matters most: only the capability codes and a refused token are folded. Anything else is a genuine statement about this
     * request, and swallowing it into a silent retry on the other path would hide a real failure and issue the command twice.
     */
    const calls = newCalls();
    const { service } = makeService({ calls, refuse: () => new AccessApiError("the door is busy", { code: "CODE_DEVICE_DEVICE_BUSY" }) });

    await assert.rejects(async () => service.routedUnlock({ deviceId: HUB, direct: direct(calls, "unlock"), doorId: DOOR_HUB }), {

      code: "CODE_DEVICE_DEVICE_BUSY",
      name: "AccessApiError"
    });

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
      await assert.rejects(async () => service.routedSetLockRule({ deviceId: HUB, doorId: DOOR_HUB, rule: { type: "lock_now" } }), (error: unknown) => {

        assert.ok(error instanceof AccessCapabilityError, code + " should reach the caller as a capability error");
        assert.ok(!(error instanceof AccessApiError), "the refusal reaches the caller as a capability error rather than as the raw official error");

        return true;
      }, code + " should reach the caller as a capability error");
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
        await assert.rejects(async () => service.routedDirect({ deviceId: HUB, direct: direct(calls, operation), operation }), (error: unknown) => {

          assert.ok(error instanceof AccessCapabilityError);
          assert.match(error.message, new RegExp(operation), "the message names the operation");
          assert.match(error.message, /for device "Test alias 13"/, "and the device it addressed");
          assert.match(error.message, /held to the official API/, "and the override that left it nowhere to go");
          assert.match(error.message, new RegExp("\\(connected in " + mode + " mode\\)"), "and the mode");

          return true;
        });
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
      await assert.rejects(async () => service.routedDirect({ deviceId: HUB, direct: direct(calls, operation), operation }), (error: unknown) => {

        assert.ok(error instanceof AccessCapabilityError);
        assert.match(error.message, new RegExp(operation), "the message names the operation");
        assert.match(error.message, /for device "Test alias 13"/, "and the device it addressed");
        assert.match(error.message, /holds no credentials for the Access application's own endpoints/, "and the capability that was missing");
        assert.match(error.message, /\(connected in token mode\)/, "and the mode");

        return true;
      });
    }

    assert.deepEqual(calls.direct, [], "a refused command issues nothing at all");
  });

  test("a revoked official path is the more specific reason, and wins over the missing credentials", async () => {

    /* The specificity order. A token-only client whose session the controller revoked has two true things to say, and the revocation is the particular one: it is
     * a verdict the controller handed down, where holding no credentials is merely what this client always was.
     */
    const calls = newCalls();
    const log = capturingLog();
    const { service } = makeService({ calls, capabilities: { mode: "token" }, log,
      refuse: () => new AccessApiError("refused", { code: "CODE_OTHERS_UID_ADOPTED_NOT_SUPPORTED" }) });

    // The first routed unlock is what teaches the service the session is revoked; its own refusal is not what this row is about.
    await assert.rejects(async () => service.routedUnlock({ deviceId: HUB, direct: direct(calls, "unlock"), doorId: DOOR_HUB }), AccessCapabilityError);

    // The closure's warning states what closing means for a client with no direct path: the commands only the official API carries are refused.
    assert.ok(loggedAt(log.entries, "warn", "will be refused for the life of this connection"), "the warning names the refusal that follows");
    assert.equal(loggedAt(log.entries, "warn", "own endpoints"), false, "and promises no direct path this client does not hold");

    await assert.rejects(async () => service.routedUnlock({ deviceId: HUB, direct: direct(calls, "unlock"), doorId: DOOR_HUB }), (error: unknown) => {

      assert.ok(error instanceof AccessCapabilityError);
      assert.match(error.message, /no longer available to this session on this controller/, "the revoked arm is the one that speaks");
      assert.equal(error.message.includes("holds no credentials"), false, "and the general arm stays quiet behind it");

      return true;
    });

    // The latch speaks for a command with no official half too: refused for the revocation, the more particular reason, rather than for credentials it never held.
    await assert.rejects(async () => service.routedDirect({ deviceId: HUB, direct: direct(calls, "restart"), operation: "a restart" }), {

      message: /no longer available to this session on this controller/,
      name: "AccessCapabilityError"
    });

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
    assert.equal(calls.unlocks[0]?.call.signal, controller.signal, "and what it carries is the caller's own signal rather than a stand-in");
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
    assert.equal(calls.unlocks[0]?.call.signal, controller.signal, "and the signal is the caller's own");
  });

  test("a routed stop carries the signal with the control command", async () => {

    const calls = newCalls();
    const { service } = makeService({ calls });
    const controller = new AbortController();

    await service.routedStop({ deviceId: HUB, doorId: DOOR_HUB, signal: controller.signal });

    assert.deepEqual(calls.unlocks, [{ call: { signal: controller.signal }, id: DOOR_HUB, opts: { controlCmd: "stop" } }]);
    assert.equal(calls.unlocks[0]?.call.signal, controller.signal, "and the signal is the caller's own");
  });

  test("a routed lock rule hands the signal to the official surface as its call options", async () => {

    const calls = newCalls();
    const { service } = makeService({ calls });
    const controller = new AbortController();

    await service.routedSetLockRule({ deviceId: HUB, doorId: DOOR_HUB, rule: { type: "lock_now" }, signal: controller.signal });

    assert.deepEqual(calls.lockRules, [{ call: { signal: controller.signal }, id: DOOR_HUB, rule: { type: "lock_now" } }]);
    assert.equal(calls.lockRules[0]?.call.signal, controller.signal, "and the signal is the caller's own");
  });

  test("an abort from the official half propagates as itself and teaches the memo nothing", async () => {

    /* A cancelled request is not a capability verdict. Only the capability codes and a refused token fold, so the abort reaches the caller as itself; the direct
     * path is not tried, because issuing the command anyway is the one thing the caller just asked not to happen; and the memo files nothing, because an abort says
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

describe("the access-method write", () => {

  // The debug entries a log captured, which is where the write records an official failure it swallowed on its way to the direct path.
  const debugs = (log: CapturingLog): TestLogEntry[] => log.entries.filter((entry) => (entry.level === "debug"));

  // One routed write of a method switching it on, with its direct expression recorded under the method's own name.
  interface WriteOptions {

    deviceId?: string;
    method?: "mobile" | "nfc";
    signal?: AbortSignal;
  }

  async function write(service: AccessRoutingService, calls: RecordedCalls, options: WriteOptions = {}): Promise<void> {

    await service.routedAccessMethod({ deviceId: options.deviceId ?? HUB, direct: direct(calls, options.method ?? "nfc"), enabled: true,
      method: options.method ?? "nfc", ...((options.signal !== undefined) && { signal: options.signal }) });
  }

  test("goes official first, writing the state to every official key the method spans and then reading the settings back", async () => {

    const calls = newCalls();
    const { service } = makeService({ calls });

    await write(service, calls, { method: "mobile" });

    assert.deepEqual(calls.settingsWrites, [{ call: {}, id: HUB, opts: { "access_methods": { "bt_button": { enabled: "yes" }, "bt_tap": { enabled: "yes" } } } }]);
    assert.deepEqual(calls.settingsReads, [{ call: {}, id: HUB }], "the read-back followed the write");
    assert.deepEqual(calls.direct, [], "the method held, so the direct path was not taken");
  });

  test("takes the direct path when the device's official settings do not list the method", async () => {

    // The hub's own captured specimen lists nothing, so the read-back carries no entry for the method and the write goes on to the endpoint that can reach it.
    const calls = newCalls();
    const { service } = makeService({ calls, settings: { listed: {} } });

    await write(service, calls);

    assert.equal(calls.settingsWrites.length, 1, "the official write was attempted first");
    assert.equal(calls.settingsReads.length, 1);
    assert.deepEqual(calls.direct, ["nfc"]);
  });

  test("takes the direct path when the read-back reports the method outside the yes-or-no pair", async () => {

    /* The read-back is judged through the settings reading, which gives a value outside the pair no entry, so the method reads as unlisted rather than as the
     * controller's decline. The fake applies nothing, which keeps that value in place for the read-back to find; the cast is how a value the type does not admit
     * reaches a fake whose type is the wire's.
     */
    const calls = newCalls();
    const { service } = makeService({ calls, settings: { declines: true, listed: { nfc: { enabled: "true" } } as unknown as AccessOfficialAccessMethods } });

    await write(service, calls);

    assert.equal(calls.settingsReads.length, 1, "the read-back ran");
    assert.deepEqual(calls.direct, ["nfc"], "and found no reading to judge, so the write went on to the path that can reach the method");
  });

  test("throws the controller's decline, naming the method and the device, and never tries the direct path", async () => {

    const calls = newCalls();
    const { service } = makeService({ calls, settings: { declines: true } });

    await assert.rejects(async () => write(service, calls), (error: unknown) => {

      assert.ok(error instanceof AccessDeclinedError);
      assert.match(error.message, /declined to enable the nfc access method for device "Test alias 13"/,
        "the message names the method and the device's display name");
      assert.ok(error.message.endsWith("."), "and reads as a sentence");
      assert.equal(error.method, "nfc");
      assert.equal(error.reported, false, "the read-back reports the method still off");

      return true;
    });

    assert.deepEqual(calls.direct, [], "the controller answered and refused, so the other path is not asked to second-guess it");
  });

  test("falls back to the direct path on every official failure that is no verdict, logging what it swallowed", async () => {

    /* Switching a method sets a state, so a write whose official attempt failed with its effect unknown is safe to make again on the other path. Each failure is
     * thrown from the write or from the read-back after it, and each is recorded at debug before the direct attempt, so a write that keeps falling back leaves a
     * trace and the official failure is not lost behind the direct one.
     */
    const failures: { at: OfficialAttempt["method"]; error: Error; label: string }[] = [
      { at: "updateSettings", error: new AccessTimeoutError("The request timed out.", { elapsedMs: 3500 }), label: "a timeout" },
      { at: "updateSettings", error: new AccessRequestError("The controller answered 503.", { statusCode: 503 }), label: "a 5xx" },
      { at: "updateSettings", error: new AccessThrottledError("The client is throttled.", { cooldownMs: 1000 }), label: "the official transport's throttle" },
      { at: "fetchSettings", error: new AccessNetworkError("The read-back could not reach the controller.", { code: "ECONNRESET" }), label: "a read-back failure" }
    ];

    for(const failure of failures) {

      const calls = newCalls();
      const log = capturingLog();
      const { service } = makeService({ calls, log, refuse: (attempt) => ((attempt.method === failure.at) ? failure.error : undefined) });

      // eslint-disable-next-line no-await-in-loop
      await write(service, calls);

      assert.deepEqual(calls.direct, ["nfc"], failure.label + " sends the write to the direct path");
      assert.deepEqual(debugs(log).map((entry) => entry.params), [[{ deviceId: HUB, error: failure.error.message.replace(/\.$/, ""),
        operation: "the nfc access method write" }]], failure.label + " is logged at debug with the operation, the device, and the error");
      assert.deepEqual(warnings(log), [], failure.label + " closes nothing, so nothing is reported at warn");
    }
  });

  test("falls back on a controller limiting requests and on a refusal it answers at a 400, as the official dispatch reads each", async () => {

    /* The official dispatch reads a controller limiting requests as the status error it answered with, and a refusal at a 4xx in the controller's own vocabulary as
     * that refusal, carrying the status error as its cause. Neither is a verdict, so each sends the write to its direct half with the debug line, and a client with no
     * direct path keeps the limiting answer as itself. The errors are the ones the dispatch produces over a mocked controller rather than ones built by hand.
     */
    const dispatched = async (status: number, body: string): Promise<unknown> => {

      const { pool, transport } = makeMockTransport({ host: officialHost(HOST) });
      const dispatch = new OfficialDispatch({ transport });

      pool.intercept({ method: "PUT", path: officialPath("/devices/" + HUB + "/settings") }).reply(status, body);

      return dispatch.command(officialEndpoint(HOST, "/devices/" + HUB + "/settings"), { json: { "access_methods": {} }, method: "PUT" })
        .catch((error: unknown) => error);
    };
    const limited = await dispatched(429, "");
    const refused = await dispatched(400, JSON.stringify({ code: "CODE_PARAMS_INVALID", msg: "Invalid parameters." }));

    assert.ok((limited instanceof AccessRequestError) && (limited.statusCode === 429), "the dispatch reads the 429 as the status error it answered with");
    assert.ok((refused instanceof AccessApiError) && (refused.code === "CODE_PARAMS_INVALID") && (refused.cause instanceof AccessRequestError),
      "and the 400's envelope as the controller's refusal, carrying the status error as its cause");

    for(const refusal of [ limited, refused ]) {

      const calls = newCalls();
      const log = capturingLog();
      const { service } = makeService({ calls, log, refuse: (attempt) => ((attempt.method === "updateSettings") ? refusal : undefined) });

      // eslint-disable-next-line no-await-in-loop
      await write(service, calls);

      assert.deepEqual(calls.direct, ["nfc"], refusal.name + " sends the write to the direct path");
      assert.ok(loggedAt(log.entries, "debug", "safe to repeat"), refusal.name + " is logged at debug on its way there");
      assert.deepEqual(debugs(log).map((entry) => entry.params), [[{ deviceId: HUB, error: formatErrorChain(refusal), operation: "the nfc access method write" }]],
        refusal.name + " is logged with the operation, the device, and the whole error chain");
      assert.deepEqual(warnings(log), [], refusal.name + " closes nothing, so nothing is reported at warn");
    }

    const calls = newCalls();
    const { service } = makeService({ calls, capabilities: { mode: "token" }, refuse: (attempt) => ((attempt.method === "updateSettings") ? limited : undefined) });

    await assert.rejects(async () => write(service, calls), (error: unknown) => {

      assert.ok(error instanceof AccessRequestError, "a token client keeps the limiting answer as itself");
      assert.equal(error.statusCode, 429);

      return true;
    });

    assert.deepEqual(calls.direct, [], "a token client holds no direct path to take");
  });

  test("never falls back on the caller's abort", async () => {

    const calls = newCalls();
    const { service } = makeService({ calls,
      refuse: (attempt) => ((attempt.method === "updateSettings") ? new AccessAbortedError("The request was aborted by the caller's signal.") : undefined) });

    await assert.rejects(async () => write(service, calls, { signal: new AbortController().signal }), AccessAbortedError);

    assert.deepEqual(calls.direct, [], "the caller cancelled, so issuing the write on the other path is the one thing it asked not to happen");
  });

  test("refuses a method the device's official settings do not list on a client with no direct path, naming that as the reason", async () => {

    for(const capabilities of [ { mode: "token" }, { mode: "dual", override: "official-only" } ] as const) {

      const calls = newCalls();
      const { service } = makeService({ calls, capabilities, settings: { listed: {} } });

      // eslint-disable-next-line no-await-in-loop
      await assert.rejects(async () => write(service, calls), (error: unknown) => {

        assert.ok(error instanceof AccessCapabilityError, capabilities.mode + " refuses as a capability verdict");
        assert.match(error.message, /the nfc access method write for device "Test alias 13"/, "the message names the operation and the device");
        assert.match(error.message, /because this device's official settings report no enabled or disabled state for that method/,
          "and the reason the controller itself gave");
        assert.equal(/holds no credentials|held to the official API/.test(error.message), false, "ahead of what the client's own shape would say");

        return true;
      });

      assert.deepEqual(calls.direct, [], capabilities.mode + " holds no direct path to take");
    }
  });

  test("files a floor refusal against the write on that device alone, whether the write or the read-back answered it", async () => {

    for(const at of [ "updateSettings", "fetchSettings" ] as const) {

      let attempts = 0;
      const calls = newCalls();

      // Only the first official call of the refused kind is refused, so a later official attempt on the same device would be recorded rather than refused.
      const { service } = makeService({ calls, refuse: (attempt) => {

        if((attempt.method !== at) || (attempts > 0)) {

          return undefined;
        }

        attempts++;

        return new AccessApiError("too old", { code: "CODE_DEVICE_API_NOT_SUPPORTED" });
      } });

      // eslint-disable-next-line no-await-in-loop
      await write(service, calls);

      const writesAfterFirst = calls.settingsWrites.length;

      // eslint-disable-next-line no-await-in-loop
      await write(service, calls);

      assert.equal(calls.settingsWrites.length, writesAfterFirst, at + ": the second write consulted the memo rather than asking again");
      assert.deepEqual(calls.direct, [ "nfc", "nfc" ], at + ": each write completed on the direct path");

      // The memo files the write against the command and the device, so a door command on the same device and the same write on another device stay official.
      // eslint-disable-next-line no-await-in-loop
      await service.routedUnlock({ deviceId: HUB, direct: direct(calls, "unlock"), doorId: DOOR_HUB });
      // eslint-disable-next-line no-await-in-loop
      await write(service, calls, { deviceId: "aabbcc000004" });

      assert.deepEqual(calls.unlocks, [{ call: {}, id: DOOR_HUB, opts: {} }], at + ": the unlock on the same device still went official");
      assert.equal(calls.settingsWrites.at(-1)?.id, "aabbcc000004", at + ": and another device's write still reached the official path");
      assert.deepEqual(calls.direct, [ "nfc", "nfc" ], at + ": neither of them took the direct path");
    }
  });

  test("keeps every official failure as itself on a client with no direct path to take instead", async () => {

    /* With nowhere else to go, the failure is the one thing that says why the write did not happen: a timeout reads as a timeout, a 5xx as the controller's own
     * answer, and a rejected token as the token to fix, where a capability error would name a missing capability that is not what went wrong.
     */
    const failures = [ new AccessTimeoutError("The request timed out.", { elapsedMs: 3500 }), new AccessRequestError("The controller answered 500.", { statusCode: 500 }),
      new AccessAuthError("The token was rejected.", { identity: "token", statusCode: 401 }) ];

    for(const capabilities of [ { mode: "token" }, { mode: "dual", override: "official-only" } ] as const) {

      for(const failure of failures) {

        const calls = newCalls();
        const log = capturingLog();
        const { service } = makeService({ calls, capabilities, log, refuse: (attempt) => ((attempt.method === "updateSettings") ? failure : undefined) });

        // eslint-disable-next-line no-await-in-loop
        await assert.rejects(async () => write(service, calls), (error: unknown) => {

          assert.equal(error, failure, capabilities.mode + ": " + failure.name + " reaches the caller as itself");

          return true;
        });

        assert.deepEqual(calls.direct, [], capabilities.mode + ": no direct path was taken");
        assert.deepEqual(warnings(log), [], capabilities.mode + ": and nothing was closed, so nothing was reported");
      }
    }
  });

  test("falls back on a permission refused to the settings write, closing nothing, so a door command after it still goes official", async () => {

    /* The settings write needs a permission the door commands do not, so a token refused it may still carry every door command. The refusal speaks for the write
     * alone: the write takes the direct path, and an attributed unlock - which only the official API can carry - still reaches the official path after it.
     */
    for(const refusal of [ new AccessAuthorizationError(TOKEN_FORBIDDEN, { identity: "token", statusCode: 403 }),
      new AccessApiError(ENVELOPE_REFUSAL, { code: "CODE_OPERATION_FORBIDDEN" }) ]) {

      const calls = newCalls();
      const log = capturingLog();
      const { service } = makeService({ calls, log, refuse: (attempt) => ((attempt.method === "updateSettings") ? refusal : undefined) });

      // eslint-disable-next-line no-await-in-loop
      await write(service, calls);

      assert.deepEqual(calls.direct, ["nfc"], refusal.name + ": the write completed on the direct path");
      assert.deepEqual(warnings(log), [], refusal.name + ": and nothing closed the official path");

      // eslint-disable-next-line no-await-in-loop
      await service.routedUnlock({ actor: { id: "a1", name: "Automation" }, deviceId: HUB, direct: direct(calls, "unlock"), doorId: DOOR_HUB });

      assert.deepEqual(calls.unlocks, [{ call: {}, id: DOOR_HUB, opts: { actor: { id: "a1", name: "Automation" } } }],
        refusal.name + ": the attributed unlock went official");
    }
  });

  test("closes the official path on a rejected token, as a door command does", async () => {

    // A rejected token is refused whatever it asks, so the write's refusal speaks for every routed command after it.
    const calls = newCalls();
    const log = capturingLog();
    const { service } = makeService({ calls, log, refuse: () => new AccessAuthError(TOKEN_REJECTED, { identity: "token", statusCode: 401 }) });

    await write(service, calls);

    assert.deepEqual(calls.direct, ["nfc"], "the write completed on the direct path");
    assert.deepEqual(warnings(log).map((entry) => entry.params), [[{ identity: "token", statusCode: 401 }]], "and the closure was reported once");

    await assert.rejects(async () => service.routedUnlock({ actor: { id: "a1", name: "Automation" }, deviceId: HUB, direct: direct(calls, "unlock"),
      doorId: DOOR_HUB }), { message: /no longer available to this session/, name: "AccessCapabilityError" });
  });

  test("keeps its official write and read-back after a refused door permission closes the official path to door commands", async () => {

    /* A refused door permission speaks for the door commands, which all need it, and says nothing about the settings write, which needs a permission of its own. The
     * write still goes official after it, so the read-back only that path takes still catches a decline the settings write answered success for.
     */
    const calls = newCalls();
    const log = capturingLog();
    const { service } = makeService({ calls, log,
      refuse: (attempt) => ((attempt.method === "unlock") ? new AccessAuthorizationError(TOKEN_FORBIDDEN, { identity: "token", statusCode: 403 }) : undefined),
      settings: { declines: true } });

    await service.routedUnlock({ deviceId: HUB, direct: direct(calls, "unlock"), doorId: DOOR_HUB });
    await assert.rejects(async () => write(service, calls), AccessDeclinedError);

    assert.equal(calls.settingsWrites.length, 1, "the write went official");
    assert.equal(calls.settingsReads.length, 1, "and read the settings back");
    assert.deepEqual(calls.direct, ["unlock"], "only the refused unlock took the direct path, and the decline reached the caller as itself");
    assert.equal(warnings(log).length, 1, "the closure of door commands is the one report");
  });

  test("widens a closure of door commands to every command on a rejected token, reporting the widening", async () => {

    /* A refused door permission closes the door commands alone, so the write after it still asks the official path. A rejected token is refused whatever it asks, so
     * the write's refusal widens the closure to every command, and the write after that never reaches the official path at all. Each closure is reported once.
     */
    let settingsAttempts = 0;
    const calls = newCalls();
    const log = capturingLog();
    const { service } = makeService({ calls, log, refuse: (attempt) => {

      if(attempt.method === "unlock") {

        return new AccessAuthorizationError(TOKEN_FORBIDDEN, { identity: "token", statusCode: 403 });
      }

      if(attempt.method === "updateSettings") {

        settingsAttempts++;

        return new AccessAuthError(TOKEN_REJECTED, { identity: "token", statusCode: 401 });
      }

      return undefined;
    } });

    await service.routedUnlock({ deviceId: HUB, direct: direct(calls, "unlock"), doorId: DOOR_HUB });
    await write(service, calls);
    await write(service, calls);

    assert.equal(settingsAttempts, 1, "only the first write asked the official path");
    assert.deepEqual(calls.direct, [ "unlock", "nfc", "nfc" ], "each command completed on the direct path");
    assert.deepEqual(warnings(log).map((entry) => entry.params), [ [{ identity: "token", statusCode: 403 }], [{ identity: "token", statusCode: 401 }] ],
      "each closure is reported once, in the order it widened");
    assert.match(warnings(log)[0]?.message ?? "", /This client's door commands will use/, "the first report names the door commands");
    assert.match(warnings(log)[1]?.message ?? "", /This client's commands will use/, "and the widening names every command");
  });

  test("falls back on each permission refused to the settings write after a closure of door commands, widening nothing", async () => {

    /* A token refused the door permission and the device permission alike. The door command's refusal closes the door commands; each write after it still asks the
     * official path, is refused for the write alone, and falls back, so each write pays one official attempt and the closure is reported once.
     */
    let settingsAttempts = 0;
    const calls = newCalls();
    const log = capturingLog();
    const { service } = makeService({ calls, log, refuse: (attempt) => {

      if(attempt.method === "updateSettings") {

        settingsAttempts++;
      }

      return [ "unlock", "updateSettings" ].includes(attempt.method) ? new AccessAuthorizationError(TOKEN_FORBIDDEN, { identity: "token", statusCode: 403 }) : undefined;
    } });

    await service.routedUnlock({ deviceId: HUB, direct: direct(calls, "unlock"), doorId: DOOR_HUB });
    await write(service, calls);
    await write(service, calls);

    assert.equal(settingsAttempts, 2, "each write asked the official path once");
    assert.deepEqual(calls.direct, [ "unlock", "nfc", "nfc" ], "each command completed on the direct path");
    assert.equal(debugs(log).length, 2, "each write's refusal is logged at debug on its way there");
    assert.equal(warnings(log).length, 1, "and the closure of door commands is the one report");
  });

  test("keeps a closure of every command when a door command's refused permission arrives after it", async () => {

    /* An unlock that took the official path before a rejected token closed it to every command can still be refused a permission afterward. That refusal reaches no
     * further than the closure already in force, so it narrows nothing: the write after it never reaches the official path, and nothing more is reported.
     */
    let settingsAttempts = 0;
    const calls = newCalls();
    const log = capturingLog();
    const recording = officialSurface(calls, (attempt) => {

      if(attempt.method !== "updateSettings") {

        return undefined;
      }

      settingsAttempts++;

      return new AccessAuthError(TOKEN_REJECTED, { identity: "token", statusCode: 401 });
    });

    // The unlock is held until the write's rejected token has closed the path, and only then answers with its own refusal.
    const { promise: held, resolve: release }: PromiseWithResolvers<void> = Promise.withResolvers();
    const official: AccessOfficialRoutingSurface = { devices: recording.devices, spaces: { ...recording.spaces, unlock: async (): Promise<void> => {

      await held;

      throw new AccessAuthorizationError(TOKEN_FORBIDDEN, { identity: "token", statusCode: 403 });
    } } };
    const service = new AccessRoutingService({ capabilities: { mode: "dual", official: true, override: "auto" }, log, official, store: storeWith() });
    const unlock = service.routedUnlock({ deviceId: HUB, direct: direct(calls, "unlock"), doorId: DOOR_HUB });

    await write(service, calls);
    release();
    await unlock;
    await write(service, calls);

    assert.equal(settingsAttempts, 1, "only the first write asked the official path");
    assert.deepEqual(calls.direct, [ "nfc", "unlock", "nfc" ], "each command completed on the direct path");
    assert.deepEqual(warnings(log).map((entry) => entry.params), [[{ identity: "token", statusCode: 401 }]], "and only the closure of every command is reported");
  });

  test("never reaches for the official path on a client held to the direct API", async () => {

    const calls = newCalls();
    const { service } = makeService({ calls, capabilities: { override: "direct-only" } });

    await write(service, calls);

    assert.deepEqual(calls.direct, ["nfc"]);
    assert.deepEqual(calls.settingsWrites, [], "a client held to one channel does not attempt the channel it was held away from");
  });

  test("hands the caller's signal to the settings write and to its read-back", async () => {

    const calls = newCalls();
    const { service } = makeService({ calls });
    const controller = new AbortController();

    await write(service, calls, { signal: controller.signal });

    assert.equal(calls.settingsWrites[0]?.call?.signal, controller.signal, "the write carries the caller's own signal");
    assert.equal(calls.settingsReads[0]?.call?.signal, controller.signal, "and so does the read-back");
  });
});

/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * store.test.ts: Unit tests for the observable StateStore - the snapshot, the observe and dedup contract, the single dispatch chokepoint and the two independent
 * layers that keep it quiet, the refresh failsafe, and the teardown guarantees. Driven entirely through a fake clock and a fake refresh callback, so there is no
 * network and no real timer anywhere in this file.
 */
import type { AccessBootstrapConfig, AccessControllerConfig, AccessDeviceConfig, Nullable } from "../types/index.ts";
import type { AccessRefreshDocuments, StateStoreOptions } from "./store.ts";
import { StateStore, createStateStore } from "./store.ts";
import { accessBootstrap2026Fixture, accessControllerInfoFixture } from "../protocol/topology.fixtures.ts";
import { capturingLog, expectAt, fakeClock, silentLog, topologyDevices } from "../testing.helpers.ts";
import { describe, test } from "node:test";
import type { AccessState } from "../protocol/reducer.ts";
import type { AccessStateDevice } from "../protocol/reducer.ts";
import type { AccessTypedEvent } from "../protocol/events.ts";
import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import { selectHubs } from "./selectors.ts";

// Named entries from the 2026 topology document, so an assertion cites a specific record rather than a number re-derived from the same fixture.
const DOOR_HUB = "00000000-0000-0000-0000-000000000006";
const HUB_2026 = "aabbcc000001";
const DEVICE_COUNT_2026 = 5;

// The identity carried by the record that arrives without a capabilities array. No captured document holds a record in that shape, so it is synthesized below under
// an identity of its own, where it can never be confused with a device the document supplied.
const CAPABILITY_LESS_ID = "02ffee00b001";

/* A fresh parse of the topology document on every call. Two parses of the same document are structurally equal and share no references, which is what makes a
 * "refresh that found no drift" test honest: the reducer has to reconcile the fresh records down to the stored ones rather than being handed the very objects it
 * already holds.
 */
const topologyDocument = (): AccessBootstrapConfig => JSON.parse(JSON.stringify(accessBootstrap2026Fixture)) as AccessBootstrapConfig;

// One refresh pass's pair, on the same fresh-parse discipline. The controller half is optional so a test can express a topology-only pass, which is a shape the
// refresh contract admits.
const refreshDocuments = (controller: Nullable<AccessControllerConfig> = null): AccessRefreshDocuments => ({ controller, topology: topologyDocument() });

const controllerDocument = (): AccessControllerConfig => JSON.parse(JSON.stringify(accessControllerInfoFixture)) as AccessControllerConfig;

/* The topology document with one record more: a clone of its UA Ultra under an identity of its own, arriving without the capabilities array at all - a shape the
 * field has produced. The member is excluded by naming it in the rest destructure, so the binding exists to be discarded rather than read and the underscore prefix
 * says so, and the downcast admits the result as a device record because the rest type is missing a member the record type requires. It is attached at root level, as
 * hardware the building hosts directly.
 */
const capabilityLessTopology = (): AccessBootstrapConfig => {

  const bootstrap = topologyDocument();
  const template = bootstrap.floors?.[0]?.doors?.[0]?.device_groups?.[0]?.[0];

  assert.ok(template, "the topology document should carry a device record to clone");

  const { capabilities: _stripped, ...bare } = { ...template, "unique_id": CAPABILITY_LESS_ID };

  return { ...bootstrap, "device_groups": [[bare as AccessDeviceConfig]] };
};

const bootstrapEvent = (bootstrap: AccessBootstrapConfig): AccessTypedEvent => ({ data: bootstrap, kind: "bootstrapLoaded" });

// Renaming a door: a real state change that touches the doors map and leaves the devices map alone.
const renameDoor = (name: string): AccessTypedEvent => ({ eventName: "access.data.location.update", id: DOOR_HUB, kind: "locationChanged",
  payload: { name } });

// An activity signal, which the reducer returns the state unchanged for - the no-op dispatch every dedup assertion needs.
const activitySignal = (): AccessTypedEvent => ({ eventName: "access.door.unlock", id: DOOR_HUB, kind: "unlock" });

// Drive an observer in the background, collecting every yielded value. Returns the array plus the iteration's completion promise, so a test can end the iteration
// and await a clean teardown. Callers await a scheduler tick after calling this, so the async-generator body registers the observer before any dispatch.
function collect<T>(iterable: AsyncIterable<T>): { done: Promise<void>; values: T[] } {

  const values: T[] = [];
  const done = (async (): Promise<void> => {

    for await (const value of iterable) {

      values.push(value);
    }
  })();

  return { done, values };
}

/* A store whose refresh callback re-seeds it the way a composition root's does: the callback reads its documents and applies them through the store's own method,
 * which is exactly the contract the failsafe takes. Every test here that resolves documents from its refresh uses this one shape, so the callback's own bookkeeping
 * - a counter, a rejection on the first attempt - stays in the caller's `documents` closure where the test can read it.
 *
 * Reading the binding inside the closure is safe by construction: it is assigned before the store is returned, and nothing can tick the loop before then.
 */
function refreshingStore(options: Omit<StateStoreOptions, "refresh"> & { documents: () => Promise<AccessRefreshDocuments> }): StateStore {

  const { documents, ...rest } = options;
  const store: StateStore = new StateStore({ ...rest, refresh: async (): Promise<void> => store.applyRefreshDocuments(await documents()) });

  return store;
}

// A store with the refresh failsafe disabled - the shape for tests that exercise dispatch and observe in isolation. The refresh callback rejects, so an accidental
// invocation is loud rather than silent.
function plainStore(): StateStore {

  return new StateStore({ clock: fakeClock(), log: silentLog(),
    refresh: () => Promise.reject(new Error("the refresh callback must not be called when the failsafe is disabled")), refreshIntervalMs: false });
}

describe("StateStore", () => {

  describe("snapshot and dispatch", () => {

    test("starts from the empty initial state", () => {

      const snapshot = plainStore().snapshot();

      assert.equal(snapshot.devices.size, 0);
      assert.equal(snapshot.doors.size, 0);
      assert.equal(snapshot.floors.size, 0);
      assert.equal(snapshot.root, null);
    });

    test("applies its own defaults for the clock, the logger, and the initial state", async () => {

      // Every option but the refresh callback left out, so the constructor takes its default branches. A fake clock is not supplied here, which means the failsafe
      // arms against the real clock at the default interval - disposal below is what keeps that timer from outliving the test.
      const store = refreshingStore({ documents: () => Promise.resolve(refreshDocuments()) });

      assert.equal(store.snapshot().devices.size, 0, "the default initial state is the empty one");

      await store[Symbol.asyncDispose]();
    });

    test("a bootstrap advances the state and flattens the document into the devices map", () => {

      const store = plainStore();

      store.dispatch(bootstrapEvent(topologyDocument()));

      assert.equal(store.snapshot().devices.size, DEVICE_COUNT_2026);
      assert.equal(store.snapshot().doors.size, 3);
    });

    test("an event the reducer returns unchanged leaves the state reference alone", () => {

      const store = plainStore();
      const before = store.snapshot();

      store.dispatch(activitySignal());

      assert.ok(Object.is(before, store.snapshot()), "a no-op dispatch must not replace the state reference");
    });
  });

  describe("observe", () => {

    test("registers nothing until iteration begins, and never yields a state older than that moment", async () => {

      const store = plainStore();
      const initial = store.snapshot();

      // A dispatch that lands before anyone iterates. An un-iterated observe registers no observer, so there is nothing to queue this into.
      store.dispatch(bootstrapEvent(topologyDocument()));

      const afterFirst = store.snapshot();
      const ac = new AbortController();
      const { done, values } = collect(store.observe((state) => state, { signal: ac.signal }));

      // Let the async-generator body run: this is the point at which the observer registers and reads its baseline.
      await delay(0);
      assert.equal(values.length, 0, "iteration seeds a baseline rather than re-emitting the current value");

      store.dispatch(renameDoor("Renamed"));
      await expectAt(() => values.length === 1);

      const afterSecond = store.snapshot();

      assert.equal(values.filter((value) => Object.is(value, afterSecond)).length, 1, "the state after the second dispatch is delivered exactly once");
      assert.ok(!values.some((value) => Object.is(value, initial)), "the pre-dispatch state is never yielded");
      assert.ok(!values.some((value) => Object.is(value, afterFirst)), "the state that predates iteration is never yielded");

      ac.abort();
      await done;
    });

    test("wakes on a real change and stays asleep on a dispatch that changed nothing", async () => {

      const store = plainStore();

      store.dispatch(bootstrapEvent(topologyDocument()));

      const ac = new AbortController();
      const { done, values } = collect(store.observe((state) => state.doors, { signal: ac.signal }));

      await delay(0);
      store.dispatch(activitySignal());
      await delay(5);
      assert.equal(values.length, 0, "an activity signal changes no state, so no observer wakes");

      store.dispatch(renameDoor("Renamed"));
      await expectAt(() => values.length === 1);
      assert.equal(values[0]?.get(DOOR_HUB)?.name, "Renamed");

      ac.abort();
      await done;
    });

    test("stays asleep on a notification that restates a device's address in the other case", async () => {

      // The controller re-cases an address between reads, and a consumer keyed on the address observes the devices for changes that matter. A re-cased address is
      // not one: it is folded at admission before the merge decides anything, so the reducer hands back the same state and the gate absorbs it outright.
      const store = plainStore();

      store.dispatch(bootstrapEvent(topologyDocument()));

      const stored = store.snapshot().devices.get(HUB_2026);

      assert.ok(stored);
      assert.equal(stored.mac, "AABBCC000001");
      // The premise for the second dispatch below, asserted so it cannot be a no-op on a value the record already holds.
      assert.notEqual(stored.firmware, "v9.9.9");

      const ac = new AbortController();
      const { done, values } = collect(store.observe((state) => state.devices, { signal: ac.signal }));

      await delay(0);
      store.dispatch({ eventName: "access.data.device.update", id: HUB_2026, kind: "deviceChanged", payload: { "mac": "AA:BB:CC:00:00:01" } });
      await delay(5);
      assert.equal(values.length, 0, "a re-cased address changes no state, so no observer wakes");

      // The same observer wakes on a real change to the same record, which is what shows the silence above was the fold's doing rather than a dead observer.
      store.dispatch({ eventName: "access.data.device.update", id: HUB_2026, kind: "deviceChanged", payload: { "firmware": "v9.9.9" } });
      await expectAt(() => values.length === 1);
      assert.equal(values[0]?.get(HUB_2026)?.mac, "AABBCC000001");

      ac.abort();
      await done;
    });

    test("the dispatch gate and the observer dedup are independent layers, and each suppresses on its own", async () => {

      const store = plainStore();

      store.dispatch(bootstrapEvent(topologyDocument()));

      // A counting selector is what tells the two layers apart: the gate suppresses before any selector runs, while the observer's dedup suppresses after one has.
      let evaluations = 0;
      const countingDevices = (state: AccessState): ReadonlyMap<string, AccessStateDevice> => {

        evaluations += 1;

        return state.devices;
      };

      const ac = new AbortController();
      const { done, values } = collect(store.observe(countingDevices, { signal: ac.signal }));

      await delay(0);

      const atRegistration = evaluations;
      const before = store.snapshot();

      // A second parse of the same document reconciles to the identical state reference, so the gate absorbs it outright.
      store.dispatch(bootstrapEvent(topologyDocument()));
      await delay(5);

      assert.equal(evaluations, atRegistration, "a drift-free bootstrap is suppressed at the gate, before any observer evaluates");
      assert.ok(Object.is(before, store.snapshot()), "a drift-free bootstrap leaves the state reference alone");
      assert.equal(values.length, 0);

      // A real change to a collection this selection does not read: the state reference advances, the observer runs, and its own comparison is what keeps it quiet.
      store.dispatch(renameDoor("Renamed"));
      await expectAt(() => evaluations > atRegistration);
      await delay(5);

      assert.ok(!Object.is(before, store.snapshot()), "a door rename is a real state change");
      assert.equal(values.length, 0, "the observer evaluated and found its own selection unchanged, so it yielded nothing");

      ac.abort();
      await done;
    });

    test("a bootstrap that drifted wakes observers", async () => {

      const store = plainStore();

      store.dispatch(bootstrapEvent(topologyDocument()));

      const ac = new AbortController();
      const { done, values } = collect(store.observe((state) => state.devices, { signal: ac.signal }));

      await delay(0);

      const drifted = topologyDocument();
      const device = drifted.floors?.[0]?.doors?.[0]?.device_groups?.[0]?.[0];

      assert.ok(device, "the document should carry a device to drift");
      device.alias = "Renamed Hardware";

      store.dispatch(bootstrapEvent(drifted));
      await expectAt(() => values.length === 1);
      assert.equal(store.snapshot().devices.size, DEVICE_COUNT_2026);

      ac.abort();
      await done;
    });

    test("an already-aborted signal yields nothing and completes", async () => {

      const store = plainStore();
      const ac = new AbortController();

      ac.abort();

      const { done, values } = collect(store.observe((state) => state.devices, { signal: ac.signal }));

      await done;
      assert.equal(values.length, 0);
    });

    test("aborting the signal ends an active iteration", async () => {

      const store = plainStore();
      const ac = new AbortController();
      const { done, values } = collect(store.observe((state) => state, { signal: ac.signal }));

      await delay(0);
      store.dispatch(bootstrapEvent(topologyDocument()));
      await expectAt(() => values.length === 1);

      ac.abort();

      // The iteration completes once aborted - no hang, no leak.
      await done;
    });

    test("closing drains what is already queued before the iteration ends", async () => {

      const store = plainStore();
      const { promise: consumerGate, resolve: releaseConsumer } = Promise.withResolvers<undefined>();
      const values: AccessState[] = [];

      // A deliberately slow consumer: it parks on the first value it receives, so everything dispatched while it is parked accumulates in its queue.
      const done = (async (): Promise<void> => {

        for await (const value of store.observe((state) => state)) {

          values.push(value);

          if(values.length === 1) {

            await consumerGate;
          }
        }
      })();

      await delay(0);
      store.dispatch(bootstrapEvent(topologyDocument()));
      await expectAt(() => values.length === 1);

      // Two further changes land behind the parked consumer.
      store.dispatch(renameDoor("Second"));
      store.dispatch(renameDoor("Third"));

      // Closing while the consumer is still parked: the queued values must survive it.
      await store[Symbol.asyncDispose]();
      releaseConsumer(undefined);
      await done;

      assert.equal(values.length, 3, "both values queued behind the slow consumer were delivered before the iteration ended");
      assert.equal(values[1]?.doors.get(DOOR_HUB)?.name, "Second");
      assert.equal(values[2]?.doors.get(DOOR_HUB)?.name, "Third");
    });
  });

  describe("refresh failsafe", () => {

    test("runs no failsafe at all when there is nothing to refresh from", async () => {

      /* A store built with no refresh callback is one whose composer has no document source to offer - a client whose identity cannot reach those endpoints. The
       * failsafe then does not exist rather than existing with nothing to call, so no amount of clock advancing produces a tick, and the store is otherwise a
       * perfectly ordinary store.
       */
      const clock = fakeClock();
      const store = new StateStore({ clock, refreshIntervalMs: 1000 });

      await clock.tick();
      await clock.tick();

      assert.equal(store.snapshot().devices.size, 0, "no refresh ran, so nothing was applied");

      // And dispatch still works, which is what says this is a store without a failsafe rather than a store that is inert.
      store.dispatch({ data: topologyDocument(), kind: "bootstrapLoaded" });

      assert.equal(store.snapshot().devices.size, DEVICE_COUNT_2026);

      await store[Symbol.asyncDispose]();
    });

    test("fires on the clock and dispatches what the refresh returned", async () => {

      const clock = fakeClock();
      let refreshes = 0;
      const store = refreshingStore({ clock, documents: () => {

        refreshes += 1;

        return Promise.resolve(refreshDocuments());
      }, refreshIntervalMs: 1000 });

      await clock.tick();
      await expectAt(() => store.snapshot().devices.size === DEVICE_COUNT_2026);
      assert.equal(refreshes, 1);

      await store[Symbol.asyncDispose]();
    });

    test("contains a refresh failure and recovers on the next tick", async () => {

      const clock = fakeClock();
      const log = capturingLog();
      let attempt = 0;
      const documents = (): Promise<AccessRefreshDocuments> => {

        attempt += 1;

        return (attempt === 1) ? Promise.reject(new Error("transient")) : Promise.resolve(refreshDocuments());
      };
      const store = refreshingStore({ clock, documents, log, refreshIntervalMs: 1000 });

      // The first tick fails: the loop logs at debug and stays alive.
      await clock.tick();
      await expectAt(() => log.entries.some((entry) => (entry.level === "debug") && entry.message.includes("Bootstrap refresh failed")));
      assert.equal(store.snapshot().devices.size, 0);

      // The second tick succeeds, and the failsafe applies the document as if nothing had gone wrong.
      await clock.tick();
      await expectAt(() => store.snapshot().devices.size === DEVICE_COUNT_2026);

      await store[Symbol.asyncDispose]();
    });

    test("stops on disposal", async () => {

      const clock = fakeClock();
      let refreshes = 0;
      const store = refreshingStore({ clock, documents: () => {

        refreshes += 1;

        return Promise.resolve(refreshDocuments());
      }, refreshIntervalMs: 1000 });

      await clock.tick();
      await expectAt(() => refreshes === 1);

      await store[Symbol.asyncDispose]();

      // With the loop's controller aborted there is no interval consumer left, so a tick releases nothing.
      await clock.tick();
      await delay(5);
      assert.equal(refreshes, 1, "disposal ended the refresh loop");
    });

    test("hands every refresh the one signal the loop lives by, and fires it on disposal", async () => {

      /* The signal a refresh receives is the loop's own lifetime signal rather than one minted per tick, which is what lets a read in flight be released when the
       * store goes away. Two ticks are taken because that is what tells the two apart: a per-tick controller would hand out a different object each time, and both
       * would compare equal to each other by shape while unaborted.
       */
      const clock = fakeClock();
      const seen: (AbortSignal | undefined)[] = [];
      const store = new StateStore({ clock, refresh: (signal?: AbortSignal): Promise<void> => {

        seen.push(signal);

        return Promise.resolve();
      }, refreshIntervalMs: 1000 });

      await clock.tick();
      await expectAt(() => seen.length === 1);
      await clock.tick();
      await expectAt(() => seen.length === 2);

      assert.ok(seen[0]);
      assert.equal(seen[0], seen[1], "one signal across both ticks, so it belongs to the loop rather than to a tick");
      assert.equal(seen[0].aborted, false, "and it has not fired while the store is alive");

      await store[Symbol.asyncDispose]();

      assert.equal(seen[0].aborted, true, "disposal is what fires it");
    });

    test("stays silent about a retry when the refresh it cancelled was cancelled by disposal", async () => {

      /* A read still in flight at disposal rejects because the store aborted it, which is the shutdown path rather than a refresh that went wrong. Announcing a
       * retry on the next interval would promise an interval the disposal has already ended, so this failure is the one the loop passes over without a word.
       */
      const clock = fakeClock();
      const log = capturingLog();
      let released = false;
      const store = new StateStore({ clock, log, refresh: async (signal?: AbortSignal): Promise<void> => {

        await new Promise<void>((_resolve, reject) => signal?.addEventListener("abort", () => {

          released = true;

          reject(new Error("the read was released when the store was disposed"));
        }));
      }, refreshIntervalMs: 1000 });

      // The tick starts a read that never answers on its own, so it is still in flight when disposal arrives.
      await clock.tick();
      await delay(5);
      await store[Symbol.asyncDispose]();
      await expectAt(() => released);
      await delay(5);

      assert.ok(!log.entries.some((entry) => entry.message.includes("Bootstrap refresh failed")), "the shutdown path logged no retry promise");
    });

    test("never arms when the interval is false, and never arms on a non-positive interval", async () => {

      const clock = fakeClock();
      let refreshes = 0;
      const documents = (): Promise<AccessRefreshDocuments> => {

        refreshes += 1;

        return Promise.resolve(refreshDocuments());
      };

      const disabled = refreshingStore({ clock, documents, refreshIntervalMs: false });
      const nonPositive = refreshingStore({ clock, documents, refreshIntervalMs: 0 });

      await clock.tick();
      await delay(5);
      assert.equal(refreshes, 0, "neither store armed the loop, so a tick releases nothing");

      await disabled[Symbol.asyncDispose]();
      await nonPositive[Symbol.asyncDispose]();
    });
  });

  describe("applyRefreshDocuments", () => {

    test("dispatches the controller document before the topology", () => {

      const store = plainStore();

      store.applyRefreshDocuments({ controller: controllerDocument(), topology: topologyDocument() });

      // Both documents landed, which is the half of the contract a caller sees directly; the order they landed in is asserted by the test below.
      assert.equal(store.snapshot().controller?.host.hostname, "host-2.test.local");
      assert.equal(store.snapshot().devices.size, DEVICE_COUNT_2026);
    });

    test("the observed order is controller first, then topology", async () => {

      const store = new StateStore({ clock: fakeClock(), log: silentLog(), onDispatch: (event) => void seen.push(event.kind),
        refresh: () => Promise.reject(new Error("the refresh callback must not be called")), refreshIntervalMs: false });
      const seen: string[] = [];

      store.applyRefreshDocuments({ controller: controllerDocument(), topology: topologyDocument() });

      assert.deepEqual(seen, [ "controllerChanged", "bootstrapLoaded" ]);

      await store[Symbol.asyncDispose]();
    });

    test("a pair that only re-spells its addresses leaves the state reference alone", () => {

      // The refresh failsafe and a recovery re-seed both land here, and the controller re-cases addresses between reads. A pair that differs from the held documents
      // only in how it spells an address is the no-op the failsafe promises, all the way up to the state reference.
      const store = plainStore();

      store.applyRefreshDocuments({ controller: controllerDocument(), topology: topologyDocument() });

      const before = store.snapshot();
      const recasedController = controllerDocument();
      const recasedTopology = topologyDocument();
      const original = topologyDevices(topologyDocument()).map((device) => device.mac);

      recasedController.host.mac = "AA:BB:CC:00:00:0F";

      for(const device of topologyDevices(recasedTopology)) {

        device.mac = (device.mac === device.mac.toUpperCase()) ? device.mac.toLowerCase() : device.mac.toUpperCase();
      }

      assert.notDeepEqual(topologyDevices(recasedTopology).map((device) => device.mac), original, "the re-spelled pair really does differ from the held documents");
      store.applyRefreshDocuments({ controller: recasedController, topology: recasedTopology });

      assert.ok(Object.is(before, store.snapshot()), "a refresh that only re-spelled addresses must not replace the state reference");
    });

    test("a topology-only pair dispatches the topology alone", () => {

      const seen: string[] = [];
      const store = new StateStore({ clock: fakeClock(), log: silentLog(), onDispatch: (event) => void seen.push(event.kind),
        refresh: () => Promise.reject(new Error("the refresh callback must not be called")), refreshIntervalMs: false });

      store.applyRefreshDocuments(refreshDocuments());

      assert.deepEqual(seen, ["bootstrapLoaded"], "a pair carrying no controller document dispatches nothing for it");
      assert.equal(store.snapshot().controller, null);
      assert.equal(store.snapshot().devices.size, DEVICE_COUNT_2026);
    });

    test("a topology carrying a record with no capabilities lands, and the hub view answers over it", () => {

      const store = plainStore();

      store.applyRefreshDocuments({ controller: null, topology: capabilityLessTopology() });

      const snapshot = store.snapshot();

      assert.equal(snapshot.devices.size, DEVICE_COUNT_2026 + 1, "the record reaches the store alongside the document's own hardware");

      // The hub view reads the member off every record it scans, so a record admitted without one is what would take this whole projection down. Reaching an answer
      // at all is the assertion here; the membership check is what that answer has to say.
      assert.equal(selectHubs(snapshot).some((device) => device.unique_id === CAPABILITY_LESS_ID), false, "a record with no capabilities is no hub");
      assert.deepEqual(snapshot.devices.get(CAPABILITY_LESS_ID)?.capabilities, [], "what makes that answer possible is the array admission supplied");
    });

    test("applyCensus dispatches one census event carrying every collection it was given", async () => {

      /* The store's own contract for the census: one dispatch, the three collections carried through, and `complete` off unless a caller says otherwise - the same
       * default the door facts take, because only an enumerating read may say a record is gone.
       */
      const seen: AccessTypedEvent[] = [];
      const store = new StateStore({ clock: fakeClock(), log: silentLog(), onDispatch: (event) => void seen.push(event),
        refresh: () => Promise.reject(new Error("the refresh callback must not be called")), refreshIntervalMs: false });
      const devices = [{ "alias": "Test alias 13", "capabilities": ["is_hub"], "connected_uah_id": "", "device_type": "UAH", "is_adopted": true, "is_connected": true,
        "is_managed": true, "is_online": true, "location_id": DOOR_HUB, "name": "Test Name 76", "unique_id": "aabbcc000001" }];
      const doors = [{ "full_name": "Test Name 11", "location_type": "door", "name": "Test Name 10", "unique_id": DOOR_HUB,
        "up_id": "00000000-0000-0000-0000-000000000001" }];

      store.applyCensus({ devices, doorStates: [{ "location_id": DOOR_HUB, "lock": "locked" }], doors });

      assert.equal(seen.length, 1, "the three collections travel as one dispatch");
      assert.deepEqual(seen[0], { complete: false, devices, doorStates: [{ "location_id": DOOR_HUB, "lock": "locked" }], doors, kind: "censusApplied" });
      assert.equal(store.snapshot().devices.size, 1);
      assert.equal(store.snapshot().doors.size, 1);
      assert.equal(store.snapshot().doorStates.size, 1);

      await store[Symbol.asyncDispose]();
    });

    test("applyCensus carries the enumeration license when a caller passes it", async () => {

      const seen: AccessTypedEvent[] = [];
      const store = new StateStore({ clock: fakeClock(), log: silentLog(), onDispatch: (event) => void seen.push(event), refreshIntervalMs: false });

      store.dispatch(bootstrapEvent(topologyDocument()));

      // A complete census naming one door is what licenses the removal of the other two, which is how the flag's effect is observed rather than merely asserted on.
      store.applyCensus({ devices: [], doorStates: [], doors: [{ "full_name": "Test Name 11", "location_type": "door", "name": "Test Name 10",
        "unique_id": DOOR_HUB, "up_id": "00000000-0000-0000-0000-000000000001" }] }, { complete: true });

      assert.equal(seen.at(-1)?.kind, "censusApplied");
      assert.equal((seen.at(-1) as { complete: boolean }).complete, true);
      assert.deepEqual([...store.snapshot().doors.keys()], [DOOR_HUB], "the doors the enumeration did not name left with it");
      assert.equal(store.snapshot().devices.size, DEVICE_COUNT_2026, "and the collection it named nothing in kept every record");

      await store[Symbol.asyncDispose]();
    });

    test("the refresh failsafe applies its pair through the same method", async () => {

      const clock = fakeClock();
      const seen: string[] = [];
      const store = refreshingStore({ clock, documents: () => Promise.resolve(refreshDocuments(controllerDocument())),
        onDispatch: (event) => void seen.push(event.kind), refreshIntervalMs: 1000 });

      await clock.tick();
      await expectAt(() => store.snapshot().devices.size === DEVICE_COUNT_2026);

      assert.deepEqual(seen, [ "controllerChanged", "bootstrapLoaded" ], "the failsafe seeds in the order the store owns rather than one of its own");

      await store[Symbol.asyncDispose]();
    });
  });

  describe("the dispatch hook", () => {

    test("fires for each committed dispatch and stays silent for one the reducer absorbed", () => {

      const seen: string[] = [];
      const store = new StateStore({ clock: fakeClock(), log: silentLog(), onDispatch: (event) => void seen.push(event.kind),
        refresh: () => Promise.reject(new Error("the refresh callback must not be called")), refreshIntervalMs: false });

      store.dispatch(bootstrapEvent(topologyDocument()));
      assert.deepEqual(seen, ["bootstrapLoaded"]);

      // An activity signal changes no state, so the commit gate absorbs it before the hook is reached: the channel measures state flow, not traffic.
      store.dispatch(activitySignal());
      assert.deepEqual(seen, ["bootstrapLoaded"], "a dispatch the reducer returned unchanged is not reported");

      // A drift-free re-application is absorbed at the same gate.
      store.dispatch(bootstrapEvent(topologyDocument()));
      assert.deepEqual(seen, ["bootstrapLoaded"], "a refresh that found no drift is not reported either");

      store.dispatch(renameDoor("Renamed"));
      assert.deepEqual(seen, [ "bootstrapLoaded", "locationChanged" ]);
    });

    test("runs before observers, so a hook reading the store sees the committed state", async () => {

      const order: string[] = [];
      const store = new StateStore({ clock: fakeClock(), log: silentLog(),
        onDispatch: () => order.push("hook:" + String(store.snapshot().doors.get(DOOR_HUB)?.name)),
        refresh: () => Promise.reject(new Error("the refresh callback must not be called")), refreshIntervalMs: false });

      store.dispatch(bootstrapEvent(topologyDocument()));

      const ac = new AbortController();
      const done = (async (): Promise<void> => {

        for await (const _doors of store.observe((state) => state.doors, { signal: ac.signal })) {

          order.push("observer");
        }
      })();

      await delay(0);
      store.dispatch(renameDoor("Renamed"));
      await expectAt(() => order.includes("observer"));

      assert.deepEqual(order.slice(-2), [ "hook:Renamed", "observer" ], "the hook sees the committed state and runs ahead of the observers");

      ac.abort();
      await done;
    });

    test("is construction-bound and ends with disposal", async () => {

      const seen: string[] = [];
      const store = new StateStore({ clock: fakeClock(), log: silentLog(), onDispatch: (event) => void seen.push(event.kind),
        refresh: () => Promise.reject(new Error("the refresh callback must not be called")), refreshIntervalMs: false });

      store.dispatch(bootstrapEvent(topologyDocument()));
      assert.equal(seen.length, 1);

      await store[Symbol.asyncDispose]();

      // Disposal is terminal for the chokepoint, and the hook lives behind it: there is no reset path because there is nothing the hook outlives.
      store.dispatch(renameDoor("Renamed"));
      assert.equal(seen.length, 1, "a dispatch after disposal reaches neither the reducer nor the hook");
    });

    test("a store built without one dispatches exactly as before", () => {

      const store = plainStore();

      store.dispatch(bootstrapEvent(topologyDocument()));

      assert.equal(store.snapshot().devices.size, DEVICE_COUNT_2026, "the hook is optional and its absence changes nothing");
    });
  });

  describe("disposal", () => {

    test("closes every live observer", async () => {

      const store = plainStore();
      const first = collect(store.observe((state) => state.devices));
      const second = collect(store.observe((state) => state.doors));

      await delay(0);
      await store[Symbol.asyncDispose]();

      // Both iterations complete, and neither yielded anything.
      await first.done;
      await second.done;
      assert.equal(first.values.length, 0);
      assert.equal(second.values.length, 0);
    });

    test("is safe to call more than once", async () => {

      const store = plainStore();

      await store[Symbol.asyncDispose]();
      await store[Symbol.asyncDispose]();
    });

    test("a dispatch after disposal changes nothing", async () => {

      const store = plainStore();

      await store[Symbol.asyncDispose]();

      const before = store.snapshot();

      // A document that would populate five devices on a live store. The chokepoint guard is what keeps the fold from running at all.
      store.dispatch(bootstrapEvent(topologyDocument()));

      assert.ok(Object.is(before, store.snapshot()), "the state reference is untouched after disposal");
      assert.equal(store.snapshot().devices.size, 0, "no fold ran");
    });

    test("a refresh still in flight at disposal dispatches nothing when it settles", async () => {

      const clock = fakeClock();
      const { promise, resolve } = Promise.withResolvers<AccessRefreshDocuments>();
      let refreshes = 0;
      const store = refreshingStore({ clock, documents: () => {

        refreshes += 1;

        return promise;
      }, refreshIntervalMs: 1000 });

      // Tick the loop into the refresh and leave it parked there.
      await clock.tick();
      await expectAt(() => refreshes === 1);

      const before = store.snapshot();

      await store[Symbol.asyncDispose]();

      // The refresh settles after disposal, and its dispatch meets the chokepoint guard.
      resolve(refreshDocuments());
      await promise;
      await delay(5);

      assert.ok(Object.is(before, store.snapshot()), "a late-settling refresh dispatches nothing into a disposed store");
      assert.equal(store.snapshot().devices.size, 0);
    });

    test("an observation begun after disposal completes immediately rather than parking forever", async () => {

      const store = plainStore();

      await store[Symbol.asyncDispose]();

      const { done, values } = collect(store.observe((state) => state.devices));
      const completed = await Promise.race([ done.then(() => true), delay(50).then(() => false) ]);

      assert.ok(completed, "an observation of a disposed store must complete rather than hang its consumer");
      assert.equal(values.length, 0);
    });
  });
});

describe("createStateStore", () => {

  test("constructs the real engine: an observer wakes on the selected change and stays asleep on an unrelated one", async () => {

    const store = createStateStore({ clock: fakeClock(),
      refresh: () => Promise.reject(new Error("the refresh callback must not be called")), refreshIntervalMs: false });

    store.dispatch(bootstrapEvent(topologyDocument()));

    const ac = new AbortController();
    const { done, values } = collect(store.observe((state) => state.devices, { signal: ac.signal }));

    await delay(0);

    // A door rename must not wake an observer watching devices, while a device rename must - which proves the factory built the genuine engine rather than a stub.
    store.dispatch(renameDoor("Renamed"));
    await delay(5);
    assert.equal(values.length, 0, "an unrelated change is deduped");

    const drifted = topologyDocument();
    const device = drifted.floors?.[0]?.doors?.[0]?.device_groups?.[0]?.[0];

    assert.ok(device, "the document should carry a device to drift");
    device.alias = "Renamed Hardware";

    store.dispatch(bootstrapEvent(drifted));
    await expectAt(() => values.length === 1);

    ac.abort();
    await done;
  });

  test("passes its options through: a supplied initial state is the new store's starting snapshot", () => {

    // Build a populated snapshot through a throwaway store, then prove a fresh store starts from exactly that state.
    const seed = plainStore();

    seed.dispatch(bootstrapEvent(topologyDocument()));

    const store = createStateStore({ initialState: seed.snapshot(),
      refresh: () => Promise.reject(new Error("the refresh callback must not be called")), refreshIntervalMs: false });

    assert.ok(Object.is(seed.snapshot(), store.snapshot()), "the supplied initial state reached the new store");
    assert.equal(store.snapshot().devices.size, DEVICE_COUNT_2026);
  });
});

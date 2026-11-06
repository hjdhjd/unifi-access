/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * device.helpers.ts: The shared rig the device suites are driven through - the named entries of the topology documents, the captured camera-class record seated
 * in one of them, the controller's success and refusal envelopes, the registry-over-a-real-store fixture with the requests it captured, the interceptor that
 * answers one path, and the door-state builders.
 *
 * One copy exists because every device suite asks the same three things of its arrangement: a registry standing over a real store seeded from a real topology
 * document, a transport whose requests can be read back as the controller would have received them, and a way to put a door's live state into the store without a
 * wire round trip. Writing that once here is what keeps each suite down to the concern its name states.
 */
import type { AccessBootstrapConfig, AccessDeviceConfig, AccessEventPacket } from "../types/index.ts";
import { DOORBELL_ID, UAH_ID } from "../protocol/capture.helpers.ts";
import { TestClock, present, silentLog } from "homebridge-plugin-utils/testing";
import type { AccessDeviceContext } from "./context.ts";
import { AccessDeviceRegistry } from "./registry.ts";
import { AccessRoutingService } from "../client/routing.ts";
import type { AccessTypedEvent } from "../protocol/events.ts";
import type { MockTransport } from "../transport/mock-controller.helpers.ts";
import { StateStore } from "../state/store.ts";
import { accessBootstrap2026Fixture } from "../protocol/topology.fixtures.ts";
import { accessEventPacketsFixture } from "../protocol/events.fixtures.ts";
import { makeMockTransport } from "../transport/mock-controller.helpers.ts";
import { refuseRefresh } from "../testing.helpers.ts";

/* The 2026 document with the captured camera-class record added. No captured topology holds camera-class hardware - the record survives only in the device-update
 * packets the corpus caught - and the store admits only devices a topology document gave it, so the packet's record is seated at root level, as hardware the
 * building hosts directly, which keeps the document one key different from the real one. The record is the packet's own rather than a template re-spelled, so its
 * camera flag, its capabilities and its model all arrive as the controller sent them. The downcast admits the packet's open record as a device record: the wire
 * sends nulls where the type declares values, which is the capture's truth rather than a defect to correct here.
 */
export function cameraBootstrap(): AccessBootstrapConfig {

  const packet = present(accessEventPacketsFixture.find((candidate) => (candidate.event === "access.data.device.update") &&
    (candidate.data?.["unique_id"] === DOORBELL_ID)), "the camera-class record's device-update packet");
  const record = present(structuredClone(packet.data), "the camera-class record");

  return { ...structuredClone(accessBootstrap2026Fixture), "device_groups": [[record as AccessDeviceConfig]] };
}

/* The controller's own envelopes, taken from the live capture of 2026-09-16: a success as its information endpoint answered one, with the document reduced to an
 * empty object because nothing here reads it, and the refusal a door hub answered a close command with. The refusal carries no `data` member at all, which is what
 * a refusal from this controller actually looks like.
 */
export const SUCCESS = JSON.stringify({ "code": 1, "codeS": "SUCCESS", "data": {}, "error": "", "msg": "success" });
export const REFUSED = JSON.stringify({ "cloud_code": "", "code": -3, "codeS": "CODE_SYSTEM_ERROR", "error": "CODE[-3];Mesg:;CauseBy:",
  "msg": "Server system error. " });

/* One request as the controller would have received it. The interceptor's reply callback is what makes this possible: it runs with the dispatch options in hand, so
 * a test can assert on the method and the exact body bytes - including their absence, which no assertion on the projection's return value could show.
 */
interface CapturedRequest {

  body: unknown;
  method: string;
  path: string;
}

// Build a registry over a real store seeded with a real topology document, and a mocked transport whose requests are captured. The refresh failsafe is disabled:
// these tests advance state by explicit dispatch, so an unexpected refresh would be noise rather than signal.
interface DeviceFixture {

  captured: CapturedRequest[];
  ctx: AccessDeviceContext;
  mock: MockTransport;
  registry: AccessDeviceRegistry;
  store: StateStore;
}

export function deviceFixture(bootstrap: AccessBootstrapConfig): DeviceFixture {

  const mock = makeMockTransport();
  const store = new StateStore({ clock: new TestClock(), log: silentLog(), refresh: refuseRefresh, refreshIntervalMs: false });

  store.dispatch({ data: structuredClone(bootstrap), kind: "bootstrapLoaded" });

  /* The real routing service rather than a stand-in, configured as a credential-only client: no official surface, so every routed command falls through to the
   * direct path these tests are about. That means the direct-path assertions below run through the genuine routing decision rather than around it, and a routing
   * change that broke the fallback would fail here rather than only in the routed suites.
   */
  const routing = new AccessRoutingService({ capabilities: { mode: "credential", official: false, override: "auto" }, log: silentLog(), official: null, store });
  const ctx: AccessDeviceContext = { host: mock.host, log: silentLog(), routing, store, transport: mock.transport };

  return { captured: [], ctx, mock, registry: new AccessDeviceRegistry(ctx), store };
}

// Intercept one request on a path, record what arrived, and answer with the given body. The recorded `body` is the raw value undici was handed, so an absent body
// records as undefined and a present one as its exact bytes.
interface InterceptOptions {

  body?: string;
  method: string;
  path: string;
  status?: number;
}

export function intercept(fixture: DeviceFixture, options: InterceptOptions): void {

  fixture.mock.pool.intercept({ method: options.method, path: options.path }).reply(options.status ?? 200, (opts): string => {

    fixture.captured.push({ body: opts.body, method: opts.method, path: opts.path });

    return options.body ?? SUCCESS;
  });
}

// A door-state report, so a test can put a door's live state into the store without a wire round trip.
export const doorStateEvent = (locationId: string, lock: string): AccessTypedEvent => ({ device: { id: UAH_ID, payload: {} },
  eventName: "access.data.v2.device.update", kind: "doorStateChanged",
  states: [{ "dps": "close", "dps_connected": true, "emergency": { "hardware": "none", "software": "none" }, "is_unavailable": false,
    "location_id": locationId, "lock": lock }] });

// The same report as the controller would have framed it, for the cases that need to go through the classifier's admission contract rather than around it.
export const wirePacket = (locationId: string, lock: string, extra: Record<string, unknown> = {}): AccessEventPacket => ({

  "data": { "id": UAH_ID, "location_states": [{ "alarms": undefined, "dps": "close", "dps_connected": true,
    "emergency": { "hardware": "none", "software": "none" }, "is_unavailable": false, "location_id": locationId, "lock": lock, ...extra }] },
  "event": "access.data.v2.device.update",
  "event_object_id": "00000000-0000-4000-8000-000000000000",
  "meta": { "all_field": false, "id": UAH_ID, "object_type": "device", "source": "", "target_field": ["location_states"] },
  "receiver_id": "",
  "save_to_history": false
});

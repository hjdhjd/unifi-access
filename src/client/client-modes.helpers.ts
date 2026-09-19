/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * client-modes.helpers.ts: The shared rig the client-mode suites are driven through - the two addresses the mocked controller answers on, the wire bodies of both
 * of its channels, the interception of the reads each mode's connect makes, and the capturing connect that hands back the notification socket it built.
 *
 * A mocked controller answering on both of its addresses and an injected notification socket are what let every mode run end to end without a live controller.
 * One copy exists because the two addresses have to be mocked separately for a test to assert that a mode never touched the other one, and that arrangement is
 * the same whichever mode is under test.
 */
import type { Interceptable, MockAgent } from "undici";
import { accessBootstrap2026Fixture, accessControllerInfoFixture } from "../protocol/topology.fixtures.ts";
import { accessOfficialDevicesFixture, accessOfficialDoorsFixture } from "../official/devices.fixtures.ts";
import { AccessClient } from "./client.ts";
import type { AccessLogging } from "../logging.ts";
import type { ConnectOptions } from "./client.ts";
import { FakeWebSocket } from "../transport/events-stream.helpers.ts";
import type { Nullable } from "../types/index.ts";
import { MockAgent as UndiciMockAgent } from "undici";
import assert from "node:assert/strict";
import { channels } from "../diagnostics.ts";
import { silentLog } from "homebridge-plugin-utils/testing";
import { subscribeTo } from "../testing.helpers.ts";

export const HOST = "10.0.0.1";
export const OFFICIAL_ORIGIN = "https://" + HOST + ":12445";
export const DEVICES_PATH = "/api/v1/developer/devices";
export const DOORS_PATH = "/api/v1/developer/doors";
export const LOGIN_PATH = "/api/auth/login";
export const SELF_PATH = "/api/users/self";
export const CONTROLLER_PATH = "/proxy/access/api/v2/access/info";
export const TOPOLOGY_PATH = "/proxy/access/api/v2/devices/topology4";

// Named entries from the 2026 topology document, which is what the credential path seeds from - and, under the same identities, from the official listings the
// token path seeds from.
export const HUB = "aabbcc000001";
export const READER_PRO = "aabbcc000002";
export const DOOR_HUB = "00000000-0000-0000-0000-000000000006";
export const DOOR_MINI = "00000000-0000-0000-0000-00000000000e";
export const DOOR_ULTRA = "00000000-0000-0000-0000-000000000002";

export const controllerBody = (): string => JSON.stringify({ code: 200, codeS: "SUCCESS", data: accessControllerInfoFixture, error: "", msg: "" });
export const topologyBody = (): string => JSON.stringify({ code: 200, codeS: "SUCCESS", data: [accessBootstrap2026Fixture], error: "", msg: "" });
export const selfBody = (): string => JSON.stringify({ scopes: [ "edit:access.device", "view:access.device" ] });

/* The official door list, transcribed from a live controller. The lock spelling here is the official channel's own - `lock` and `unlock` - which is precisely what
 * the seed has to translate before it reaches a member the notification stream fills with `locked` and `unlocked`.
 */
export const officialDoor = (options: { id: string; lock?: string; position: string | null }): Record<string, unknown> => ({

  "door_lock_relay_status": options.lock ?? "lock", "door_position_status": options.position, "extras": {}, "floor_id": "00000000-0000-0000-0000-000000000001",
  "full_name": "Acme HQ - 1F - " + options.id, "id": options.id, "is_bind_hub": true, "name": options.id, "type": "door"
});

export const doorsBody = (doors: readonly object[]): string => JSON.stringify({ code: "SUCCESS", data: doors, msg: "success" });

// The official device listing, which the wire nests one level deeper: an outer array of per-door groups. The default is the captured listing, so a token-only
// connect seeds from real wire material rather than from a restatement of it.
export const devicesBody = (groups: readonly (readonly object[])[] = accessOfficialDevicesFixture): string => JSON.stringify({ code: "SUCCESS", data: groups,
  msg: "success" });

/* Intercept the reads a token-only connect makes, in the order it makes them. Every token-only connect that is expected to succeed goes through this, which is
 * what keeps the mock's unmatched-request rejection meaningful: a mode that asked for something else would fail loudly rather than passing unnoticed.
 */
export function interceptOfficialPass(official: Interceptable, bodies: { devices?: string; doors?: string } = {}): void {

  official.intercept({ method: "GET", path: DOORS_PATH }).reply(200, bodies.doors ?? doorsBody(accessOfficialDoorsFixture));
  official.intercept({ method: "GET", path: DEVICES_PATH }).reply(200, bodies.devices ?? devicesBody());
}

// The refusal an Identity Enterprise controller answers every official call with: a 2xx whose envelope declines in the API's own vocabulary.
export const identityEnterpriseBody = (): string => JSON.stringify({ code: "CODE_OTHERS_UID_ADOPTED_NOT_SUPPORTED", msg: "not supported on this controller" });

// A mocked controller with net connections disabled, so an unmocked request fails loudly rather than reaching a network. Both of the controller's addresses are
// mocked separately, which is what lets a test assert that a mode never touched the other one.
export function mockController(): { agent: MockAgent; official: Interceptable; pool: Interceptable } {

  const agent = new UndiciMockAgent();

  agent.disableNetConnect();

  return { agent, official: agent.get(OFFICIAL_ORIGIN), pool: agent.get("https://" + HOST) };
}

export function interceptCredentialPass(pool: Interceptable): void {

  pool.intercept({ method: "POST", path: LOGIN_PATH }).reply(200, "", { headers: { "set-cookie": "TOKEN=abc", "x-csrf-token": "csrf1" } });
  pool.intercept({ method: "GET", path: CONTROLLER_PATH }).reply(200, controllerBody());
  pool.intercept({ method: "GET", path: TOPOLOGY_PATH }).reply(200, topologyBody());
  pool.intercept({ method: "GET", path: SELF_PATH }).reply(200, selfBody());
}

// What a connect captured: the client, the notification socket its factory built, and the URL and headers that socket was built with.
export interface CapturedConnect {

  client: AccessClient;
  headers: Record<string, string>;
  url: string;
  ws: FakeWebSocket;
}

export async function connectCapturing(agent: MockAgent, identity: Partial<ConnectOptions>, opts: { log?: AccessLogging } = {}): Promise<CapturedConnect> {

  let ws: Nullable<FakeWebSocket> = null;
  let url = "";
  let headers: Record<string, string> = {};
  const client = await AccessClient.connect({ dispatcher: agent, host: HOST, log: opts.log ?? silentLog(), refreshIntervalMs: false,
    webSocket: (socketUrl: string, socketHeaders: Record<string, string>) => {

      url = socketUrl;
      headers = socketHeaders;

      return (ws = new FakeWebSocket());
    }, ...identity } as ConnectOptions);

  assert.ok(ws, "the notification socket factory must have been invoked during connect");

  return { client, headers, url, ws };
}

// A connect that also records every event kind the store dispatched, which is how the write-path cardinality is asserted rather than inferred.
export async function connectCapturingWithDispatch(agent: MockAgent, identity: Partial<ConnectOptions>, kinds: string[]): Promise<CapturedConnect> {

  using dispatchSub = subscribeTo(channels.storeDispatch, (message) => void kinds.push(message.kind));

  /* The await belongs here rather than being dropped for a bare return of the promise. A `using` disposal runs at scope exit, so returning the promise itself
   * would take the subscription off before the connect has dispatched anything at all, and the recorder would answer empty.
   */
  return await connectCapturing(agent, identity);
}

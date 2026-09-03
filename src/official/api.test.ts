/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * api.test.ts: Unit tests for the official API facade. The domains are composed here rather than constructed by a consumer, so what these pin is that every member
 * is wired to its own class over the one shared request path, and that the three escape hatches address the same prefix the typed methods do.
 */
import { HOST, officialPath } from "./domain.helpers.ts";
import type { Interceptable, MockAgent } from "undici";
import { describe, test } from "node:test";
import { OfficialApi } from "./api.ts";
import assert from "node:assert/strict";
import { makeMockTransport } from "../transport/mock-controller.helpers.ts";
import { officialHost } from "./endpoints.ts";

// Build the facade over a mocked official controller, exactly as the composition root will: a transport bound to the official address, and everything official
// composed on top of it.
function facadeRig(): { agent: MockAgent; api: OfficialApi; pool: Interceptable } {

  const { agent, pool, transport } = makeMockTransport({ host: officialHost(HOST) });

  return { agent, api: new OfficialApi({ host: HOST, transport }), pool };
}

const SUCCESS = { "code": "SUCCESS", "data": [], "msg": "success" };

describe("OfficialApi", () => {

  /* One representative call per domain member. Reaching the interception at all is the pin: it establishes that the member exists, that it was constructed with
   * the shared dispatch and the right host, and that its methods address the official prefix - a member wired to nothing would leave its interception pending.
   */
  const reachable: readonly [ string, string, (api: OfficialApi) => Promise<unknown> ][] = [

    [ "credentials", "/credentials/touch_passes/assignable", async (api) => api.credentials.fetchAssignableTouchPasses() ],
    [ "devices", "/devices", async (api) => api.devices.fetchAll() ],
    [ "identity", "/users/identity/assignments", async (api) => api.identity.fetchAvailableResources() ],
    [ "logs", "/system/logs/resource/r-1", async (api) => api.logs.fetchResource("r-1") ],
    [ "policies", "/access_policies", async (api) => api.policies.fetchAll() ],
    [ "server", "/api_server/certificates", async (api) => api.server.deleteCertificate() ],
    [ "spaces", "/doors", async (api) => api.spaces.fetchAll() ],
    [ "users", "/user_groups", async (api) => api.users.fetchAllGroups() ],
    [ "visitors", "/visitors/v-1", async (api) => api.visitors.fetch("v-1") ],
    [ "webhooks", "/webhooks/endpoints", async (api) => api.webhooks.fetchAllEndpoints() ]
  ];

  for(const [ member, path, call ] of reachable) {

    test("the " + member + " domain is composed and addresses the official prefix", async () => {

      const rig = facadeRig();

      rig.pool.intercept({ method: (member === "server") ? "DELETE" : "GET", path: officialPath(path) }).reply(200, SUCCESS);

      await call(rig.api);

      rig.agent.assertNoPendingInterceptors();
    });
  }

  test("every domain member is present and distinct", () => {

    const api = facadeRig().api;
    const members = [ api.credentials, api.devices, api.identity, api.logs, api.policies, api.server, api.spaces, api.users, api.visitors, api.webhooks ];

    assert.equal(members.length, 10);
    assert.equal(new Set(members).size, 10, "each member is its own domain rather than one class handed out twice");
  });

  test("the request hatch joins a path below the application prefix", async () => {

    const rig = facadeRig();

    rig.pool.intercept({ method: "GET", path: officialPath("/doors") }).reply(200, { "code": "SUCCESS", "data": [{ "id": "d-1" }], "msg": "success" });

    const result = await rig.api.request<{ id: string }[]>("/doors");

    assert.deepEqual(result.data, [{ id: "d-1" }]);
  });

  test("the command hatch joins a path below the application prefix and reads no payload", async () => {

    const rig = facadeRig();

    // The data-less success envelope, which is what makes this the void arm rather than the typed read.
    rig.pool.intercept({ method: "POST", path: officialPath("/something/undocumented") }).reply(200, { "code": "SUCCESS", "msg": "success" });

    await rig.api.command("/something/undocumented", { json: { note: "hello" }, method: "POST" });
  });

  test("the download hatch joins a path below the application prefix and answers bytes", async () => {

    const rig = facadeRig();

    rig.pool.intercept({ method: "GET", path: officialPath("/system/static/avatar/a.png") }).reply(200, Buffer.from("PNGBYTES"),
      { headers: { "content-type": "image/png" } });

    assert.deepEqual(await rig.api.download("/system/static/avatar/a.png"), Buffer.from("PNGBYTES"));
  });

  test("one transport serves every domain, so the breaker models the controller rather than any one domain", async () => {

    const { pool, transport } = makeMockTransport({ host: officialHost(HOST) });
    const api = new OfficialApi({ host: HOST, transport });

    pool.intercept({ method: "GET", path: officialPath("/doors") }).reply(200, SUCCESS);
    pool.intercept({ method: "GET", path: officialPath("/user_groups") }).reply(200, SUCCESS);

    // Two domains, one mocked origin: reaching both interceptions is what establishes they share the transport the facade was handed rather than each building
    // one of their own.
    await api.spaces.fetchAll();
    await api.users.fetchAllGroups();
  });
});

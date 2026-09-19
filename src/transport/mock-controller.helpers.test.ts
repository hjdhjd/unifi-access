/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * mock-controller.helpers.test.ts: Unit tests for the mocked-controller factory the transport, auth, and official suites are driven through - the agent and pool
 * it wires a Transport to, the conditional forwarding of each optional injection, the reply a test holds open until it releases it, and the URL composer.
 *
 * The forwarding arms are what have never been driven: every consumer supplies the injections it means to use, so a factory that had stopped forwarding one
 * would pass every test that merely built a transport. Each is therefore observed on the wire the mock saw, in both directions - supplied and absent.
 *
 * No real socket anywhere in this file: net connect is disabled on every agent built here, so a request that escaped the mock would fail rather than leave.
 */
import { describe, test } from "node:test";
import { heldReply, makeMockTransport, url } from "./mock-controller.helpers.ts";
import assert from "node:assert/strict";
import { settle } from "homebridge-plugin-utils/testing";

describe("makeMockTransport", () => {

  test("makeMockTransport disables net connect and scopes the pool to the host", async () => {

    const mock = makeMockTransport({ host: "10.9.9.9" });

    mock.pool.intercept({ method: "GET", path: "/scoped" }).reply(200, { ok: true });

    assert.equal(mock.host, "10.9.9.9");
    assert.equal((await mock.transport.send(url(mock.host, "/scoped"))).statusCode, 200, "the pool the factory hands back is the one the transport dials");
    mock.agent.assertNoPendingInterceptors();

    // Net connect is off, so a request to any other origin is refused locally rather than leaving the process to find out whether anything is there.
    await assert.rejects(async () => mock.transport.send(url("10.9.9.8", "/elsewhere")));
  });

  test("makeMockTransport forwards an auth-header hook only when supplied", async () => {

    const hooked = makeMockTransport({ getAuthHeaders: () => ({ "x-access-auth": "stamped" }) });
    const bare = makeMockTransport();

    let hookedHeader: string | undefined;
    let bareHeader: string | undefined;

    hooked.pool.intercept({ method: "GET", path: "/hooked" }).reply((request) => {

      hookedHeader = (request.headers as Record<string, string>)["x-access-auth"];

      return { data: { ok: true }, statusCode: 200 };
    });

    bare.pool.intercept({ method: "GET", path: "/bare" }).reply((request) => {

      bareHeader = (request.headers as Record<string, string>)["x-access-auth"];

      return { data: { ok: true }, statusCode: 200 };
    });

    await hooked.transport.send(url(hooked.host, "/hooked"));
    await bare.transport.send(url(bare.host, "/bare"));

    assert.equal(hookedHeader, "stamped", "the hook's header is on the wire the mock saw, so the injection reached the transport");
    assert.equal(bareHeader, undefined, "a transport built without the hook sends none, which is what keeps the transport's own defaulting reads honest");
  });
});

describe("heldReply", () => {

  test("heldReply answers only after release", async () => {

    const mock = makeMockTransport();
    const held = heldReply(202, { released: true });

    mock.pool.intercept({ method: "GET", path: "/held" }).reply(held.reply);

    let settled = false;

    const pending = mock.transport.send(url(mock.host, "/held")).then((response) => {

      settled = true;

      return response;
    });

    await settle();

    assert.equal(settled, false, "the reply is held, so the request is provably still in flight at a point the test chose rather than at one it guessed");

    held.release();

    const response = await pending;

    assert.equal(response.statusCode, 202);
    assert.deepEqual(response.json(), { released: true });
  });

  test("heldReply forwards response options only when supplied", async () => {

    const mock = makeMockTransport();
    const dressed = heldReply(200, { kind: "dressed" }, { headers: { "x-kind": "dressed" } });
    const bare = heldReply(200, { kind: "bare" });

    mock.pool.intercept({ method: "GET", path: "/dressed" }).reply(dressed.reply);
    mock.pool.intercept({ method: "GET", path: "/bare" }).reply(bare.reply);
    dressed.release();
    bare.release();

    const withOptions = await mock.transport.send(url(mock.host, "/dressed"));
    const withoutOptions = await mock.transport.send(url(mock.host, "/bare"));

    assert.equal(withOptions.header("x-kind"), "dressed", "the response options a caller supplied reach the answer");
    assert.equal(withoutOptions.header("x-kind"), null, "and a reply built without them answers with none");
  });
});

describe("url", () => {

  test("url composes the https origin and the path", () => {

    assert.equal(url("10.0.0.1", "/api/v1/devices"), "https://10.0.0.1/api/v1/devices");
    assert.equal(url("10.0.0.1:12445", "/api/v1/developer/doors"), "https://10.0.0.1:12445/api/v1/developer/doors");
  });
});

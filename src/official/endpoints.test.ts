/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * endpoints.test.ts: Unit tests for the official API's address construction. Everything official is addressed through one host derivation, so these tests pin the
 * shape that derivation produces and pin that every builder above it composes from that one shape rather than from a second copy of it.
 */
import { ACCESS_OFFICIAL_API_PATH_PREFIX, ACCESS_OFFICIAL_API_PORT } from "../settings.ts";
import { describe, test } from "node:test";
import { officialEndpoint, officialHost, officialNotificationUrl, officialPageQuery } from "./endpoints.ts";
import assert from "node:assert/strict";

const HOST = "10.0.0.1";

describe("official endpoints", () => {

  test("officialHost appends the official API's dedicated port to the bare controller address", () => {

    assert.equal(officialHost(HOST), "10.0.0.1:12445");
    assert.equal(officialHost("access.example.test"), "access.example.test:12445");
  });

  test("officialHost is built from the port constant rather than from a second copy of it", () => {

    // A literal in the assertion above and a literal in the source would agree until one of them changed. Composing the expectation from the constant is what makes
    // this a check on the derivation rather than on a number written twice.
    assert.equal(officialHost(HOST), HOST + ":" + ACCESS_OFFICIAL_API_PORT.toString());
  });

  test("officialEndpoint composes the scheme, the ported host, the application prefix, and the path", () => {

    assert.equal(officialEndpoint(HOST, "/doors"), "https://10.0.0.1:12445/api/v1/developer/doors");
    assert.equal(officialEndpoint(HOST, "/doors/abc/unlock"), "https://10.0.0.1:12445/api/v1/developer/doors/abc/unlock");
  });

  test("officialNotificationUrl addresses the socket on the same host, port, and prefix as the REST surface", () => {

    assert.equal(officialNotificationUrl(HOST), "wss://10.0.0.1:12445/api/v1/developer/devices/notifications");
  });

  test("every builder addresses the same host, so the ported-versus-bare shape cannot fork between them", () => {

    // The point of the single derivation: whatever officialHost produces is what each builder carries. A builder that took the bare host, or appended the port a
    // second time, would fail here rather than routing requests to an origin no official endpoint answers on.
    const derived = officialHost(HOST);

    assert.equal(officialEndpoint(HOST, "/doors"), "https://" + derived + ACCESS_OFFICIAL_API_PATH_PREFIX + "/doors");
    assert.equal(officialNotificationUrl(HOST), "wss://" + derived + ACCESS_OFFICIAL_API_PATH_PREFIX + "/devices/notifications");
  });

  test("the builders never double the port when handed a host that already carries one", () => {

    /* Every function here takes the bare host, which is the same contract the Access application's own endpoint builders keep. A caller that hands one an already
     * ported address gets a visibly wrong result rather than a quietly wrong one, which is what makes the contract enforceable by inspection.
     */
    assert.equal(officialHost("10.0.0.1:12445"), "10.0.0.1:12445:12445");
  });
});

describe("the official query join", () => {

  test("appends one entry per element of an array member, under the one key", () => {

    // The reference's repeated-key idiom. The bracket is part of the documented parameter name, so the caller spells it and this join does not invent it.
    assert.equal(officialEndpoint(HOST, "/users", { "expand[]": [ "access_policy", "resource" ] }),
      "https://10.0.0.1:12445/api/v1/developer/users?expand%5B%5D=access_policy&expand%5B%5D=resource");
  });

  test("stringifies numbers and booleans", () => {

    assert.equal(officialEndpoint(HOST, "/devices", { "page_num": 2, "refresh": true }),
      "https://10.0.0.1:12445/api/v1/developer/devices?page_num=2&refresh=true");
  });

  test("drops an absent member rather than sending it empty", () => {

    // A parameter the caller did not supply is not the same as one supplied empty, so it falls away before anything is serialized.
    assert.equal(officialEndpoint(HOST, "/users", { "keyword": undefined, "page_num": 1 }),
      "https://10.0.0.1:12445/api/v1/developer/users?page_num=1");
  });

  test("produces no query string at all when every member is absent", () => {

    // The drop happens before the emptiness test, so a record of nothing but absent members leaves the URL exactly as it would be with no query at all - rather
    // than trailing a bare question mark a controller would have to tolerate.
    assert.equal(officialEndpoint(HOST, "/users", { "keyword": undefined, "page_num": undefined }), "https://10.0.0.1:12445/api/v1/developer/users");
    assert.equal(officialEndpoint(HOST, "/users", {}), "https://10.0.0.1:12445/api/v1/developer/users");
  });

  test("escapes a value that would otherwise alter the query's own structure", () => {

    assert.equal(officialEndpoint(HOST, "/users/search", { "keyword": "a&b=c" }),
      "https://10.0.0.1:12445/api/v1/developer/users/search?keyword=a%26b%3Dc");
  });

  test("officialPageQuery renames the page members to the wire's own spelling", () => {

    assert.deepEqual(officialPageQuery({ pageNum: 2, pageSize: 50 }), { "page_num": 2, "page_size": 50 });
  });

  test("officialPageQuery leaves an absent page member absent rather than defaulting it", () => {

    // Defaulting here would ask for page one on every call that did not name a page, which is a different request from the one the caller made.
    assert.deepEqual(officialPageQuery({ pageSize: 50 }), { "page_num": undefined, "page_size": 50 });
    assert.equal(officialEndpoint(HOST, "/users", officialPageQuery()), "https://10.0.0.1:12445/api/v1/developer/users");
  });
});

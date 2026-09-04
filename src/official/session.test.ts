/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * session.test.ts: Unit tests for the official API's token session. The session's whole surface is the closures a transport is wired with, so these tests assert
 * what each of them produces - the exact header the controller authenticates on, and the answer that makes a token's 401 terminal.
 */
import { describe, test } from "node:test";
import { TokenSession } from "./session.ts";
import assert from "node:assert/strict";

const TOKEN = "a-token-the-controller-minted";

describe("TokenSession", () => {

  test("stamps the bearer authorization header and nothing else", () => {

    const session = new TokenSession({ token: TOKEN });

    // An exact comparison rather than a membership check: the official API authenticates on this header alone, and anything else traveling along would be this
    // library adding to a request the controller never asked for.
    assert.deepEqual(session.authHeaders(), { authorization: "Bearer " + TOKEN });
  });

  test("carries the token verbatim, with the scheme prefixed exactly once", () => {

    const session = new TokenSession({ token: "abc.def.ghi" });

    assert.equal(session.authHeaders()["authorization"], "Bearer abc.def.ghi");
  });

  test("produces the same headers on every call, because the identity does not change", () => {

    const session = new TokenSession({ token: TOKEN });

    assert.deepEqual(session.authHeaders(), session.authHeaders());
  });

  test("returns a fresh header record each time, so a caller that mutates one does not alter the session", () => {

    const session = new TokenSession({ token: TOKEN });
    const headers = session.authHeaders();

    headers["authorization"] = "Bearer something-else";

    assert.equal(session.authHeaders()["authorization"], "Bearer " + TOKEN);
  });

  test("reports that a 401 cannot be recovered from", async () => {

    /* This is what makes an official 401 terminal. The transport retries a 401 once when its relogin hook reports success, and a token has no handshake to re-run -
     * so the honest answer is that there is nothing to attempt, and the rejection reaches the caller as the fatal it is rather than after a retry that could only
     * fail the same way.
     */
    const session = new TokenSession({ token: TOKEN });

    assert.equal(await session.unauthorized(), false);
    assert.equal(await session.unauthorized(), false, "the answer does not change with attempts, because nothing about the token changed");
  });
});

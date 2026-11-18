/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * session.test.ts: Unit tests for the official API's token session. The session's whole surface is the closures a transport is wired with, so these tests assert
 * what each of them produces - the exact header the controller authenticates on, and the verdict the door listing settles a token's 401 with.
 */
import { describe, test } from "node:test";
import { AccessNetworkError } from "../errors.ts";
import { AccessResponse } from "../transport/http.ts";
import { TokenSession } from "./session.ts";
import assert from "node:assert/strict";

const TOKEN = "a-token-the-controller-minted";

// A door listing answered with the given status, as the transport hands one back whatever its status.
function listing(statusCode: number): AccessResponse {

  return new AccessResponse({ body: Buffer.from(""), headers: {}, identity: "token", statusCode });
}

/* A session over a fake send of the door listing, which records the mark each listing was handed and answers as the row says. The fake stands where the composition
 * root's send stands, so what these rows assert is the session's reading of whatever the listing answered, and the mark it forwards.
 */
function makeSession(answer: () => Promise<AccessResponse>): { sends: { probe: boolean }[]; session: TokenSession } {

  const sends: { probe: boolean }[] = [];
  const session = new TokenSession({ sendDoorListing: async (opts): Promise<AccessResponse> => {

    sends.push(opts);

    return answer();
  }, token: TOKEN });

  return { sends, session };
}

// A session whose listing is never expected to be sent, for the rows about the headers alone.
const headerSession = (token = TOKEN): TokenSession => new TokenSession({ sendDoorListing: async () => Promise.reject(new Error("No listing was expected.")), token });

describe("TokenSession", () => {

  test("stamps the bearer authorization header and nothing else", () => {

    const session = headerSession();

    // An exact comparison rather than a membership check: the official API authenticates on this header alone, and anything else traveling along would be this
    // library adding to a request the controller never asked for.
    assert.deepEqual(session.authHeaders(), { authorization: "Bearer " + TOKEN });
  });

  test("carries the token verbatim, with the scheme prefixed exactly once", () => {

    const session = headerSession("abc.def.ghi");

    assert.equal(session.authHeaders()["authorization"], "Bearer abc.def.ghi");
  });

  test("produces the same headers on every call, because the identity does not change", () => {

    const session = headerSession();

    assert.deepEqual(session.authHeaders(), session.authHeaders());
  });

  test("returns a fresh header record each time, so a caller that mutates one does not alter the session", () => {

    const session = headerSession();
    const headers = session.authHeaders();

    headers["authorization"] = "Bearer something-else";

    assert.equal(session.authHeaders()["authorization"], "Bearer " + TOKEN);
  });

  test("settles a 401 by the door listing: a listing served is the token holding, and a listing refused is the token refused", async () => {

    /* The controller answers a refused token and a missing permission with the same 401, so the listing every token must be allowed is what tells them apart. Neither
     * verdict asks for a retry, because a token has nothing to re-establish: the transport hands the 401 back, classified by the verdict.
     */
    for(const [ statusCode, verdict ] of [ [ 200, "authenticated" ], [ 401, "refused" ] ] as const) {

      const { session } = makeSession(async () => listing(statusCode));

      // eslint-disable-next-line no-await-in-loop
      assert.equal(await session.unauthorized({ probe: false }), verdict, "a listing answered " + String(statusCode) + " settles as " + verdict);
    }
  });

  test("hands the listing the mark the 401 carried", async () => {

    // A recovery probe's 401 sends its listing as a probe, so the listing reaches the controller through an open breaker as the probe did, and an ordinary request's
    // 401 sends an ordinary listing that the breaker still gates.
    const { sends, session } = makeSession(async () => listing(200));

    await session.unauthorized({ probe: true });
    await session.unauthorized({ probe: false });

    assert.deepEqual(sends, [ { probe: true }, { probe: false } ]);
  });

  test("sends one listing for overlapping 401s, every caller sharing its verdict and the first caller's mark", async () => {

    const held = Promise.withResolvers<AccessResponse>();
    const { sends, session } = makeSession(async () => held.promise);

    const first = session.unauthorized({ probe: false });
    const second = session.unauthorized({ probe: true });

    held.resolve(listing(200));

    assert.deepEqual(await Promise.all([ first, second ]), [ "authenticated", "authenticated" ], "each 401 reads the one listing's verdict");
    assert.deepEqual(sends, [{ probe: false }], "one listing went out, carrying the mark of the 401 that started it");

    // The gate retains nothing once its listing settles, so a 401 arriving afterward sends a listing of its own.
    await session.unauthorized({ probe: true });

    assert.deepEqual(sends, [ { probe: false }, { probe: true } ]);
  });

  test("rejects with the listing's own failure when the listing says nothing about the token", async () => {

    // A status other than a 2xx or a 401 is the status error it classifies as, and a send that fails is that failure. Each is what the refused request then throws.
    const { session: unavailable } = makeSession(async () => listing(503));

    await assert.rejects(unavailable.unauthorized({ probe: false }), { name: "AccessRequestError", statusCode: 503 });

    const failure = new AccessNetworkError("A network error occurred communicating with the UniFi Access controller.", { cause: new Error("ECONNRESET") });
    const { session: unreachable } = makeSession(async () => Promise.reject(failure));

    await assert.rejects(unreachable.unauthorized({ probe: false }), (error: unknown) => error === failure);
  });
});

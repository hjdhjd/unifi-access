/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * session.ts: The official-API token session - the bearer identity behind the same injected-closure boundary the credential session uses.
 */
import type { AccessResponse, IdentityVerdict } from "../transport/http.ts";
import { singleFlight } from "../single-flight.ts";

/**
 * Construction options for {@link TokenSession}: the token, which is the whole of the session's identity, and the send of the door listing the session settles a
 * refused request by.
 *
 * - `sendDoorListing` sends `GET /doors` and returns the response whatever its status, carrying the mark it is handed onto the request. The composition root
 *   supplies it, sent with the transport's 401 hook disabled, so the listing's own 401 comes back as an answer rather than re-entering the session.
 * - `token` is the bearer token minted on the controller.
 */
export interface TokenSessionOptions {

  sendDoorListing: (opts: { probe: boolean }) => Promise<AccessResponse>;
  token: string;
}

/**
 * Owns the official API's identity: a bearer token minted on the controller and presented on every official request.
 *
 * This is the sibling of the credential session, and it sits behind the identical boundary. It exposes the functions the composition root wires into a
 * transport - {@link TokenSession.authHeaders} as the `getAuthHeaders` hook and {@link TokenSession.unauthorized} as the `onUnauthorized` hook - and the transport
 * invokes them through injected function references, so the transport never imports a session and the dependency flows one way. Wiring official identity and
 * credential identity through the same hooks is what lets one transport serve both worlds without knowing which one it is carrying.
 *
 * The session holds no identity state beyond the token, and that is the design rather than an omission. A credential session holds state because a login produces
 * state that expires, rotates, and can be re-established; a token holds none of that, because the identity *is* the token. There is no handshake to run, no cookie
 * to track, and no rotation to follow, so a session that stored more of the identity would be storing a copy of something the controller alone is authoritative
 * about. For the same reason there is no local token validation and no expiry tracking: a token's standing is the controller's verdict, delivered as a response,
 * and a local check could only disagree with it.
 *
 * What the session does own is how a refused request is read. The controller answers a token it refuses and a token missing the permission an endpoint requires
 * with the same 401 and the same body, so the 401 alone cannot say which happened, and a token cannot re-authenticate itself the way a credential session re-runs its
 * handshake. The session asks the controller instead, by sending the door listing this library requires every token to be allowed: a listing the controller serves
 * shows the token holding, so the refused request was a missing permission, and a listing it refuses shows the token itself refused. A door read that is refused
 * therefore costs a second, identical listing, which is one more read on a path that already ends in a refusal.
 *
 * The session has no ended state. A 401 that lands after the client is disposed still sends its listing, which fails at once on the transport's released pool, and
 * on an injected dispatcher goes out as one read bounded by the request deadline.
 */
export class TokenSession {

  readonly #sendDoorListing: (opts: { probe: boolean }) => Promise<AccessResponse>;
  readonly #token: string;

  /* The coalescing gate, built once over the single listing it guards. Every 401 that arrives while a listing is in flight shares that listing and its verdict, which
   * is right whichever endpoints they came from, because the verdict is about the token rather than about any one request. A joiner shares the first caller's fate
   * and its mark: a recovery trial joining a listing an ordinary request started is refused by an open breaker as that request is, and the recovery loop's next
   * attempt corrects it, the trade the credential session's relogin gate accepts as well.
   */
  readonly #unauthorizedGate = singleFlight((opts: { probe: boolean }): Promise<IdentityVerdict> => this.#unauthorizedOnce(opts));

  constructor(options: TokenSessionOptions) {

    this.#sendDoorListing = options.sendDoorListing;
    this.#token = options.token;
  }

  /**
   * The headers to stamp on every official request: the bearer token, and nothing else. Wired into the transport as its `getAuthHeaders` hook, and into the
   * notification stream as the same hook, so one closure authenticates both the REST surface and the socket upgrade.
   *
   * @returns The authorization header.
   */
  authHeaders(): Record<string, string> {

    return { authorization: "Bearer " + this.#token };
  }

  /**
   * Settle what a 401 refused, by sending the door listing. Wired into the transport as its `onUnauthorized` hook. It never answers that the identity recovered,
   * because a token has nothing to re-establish, so the transport retries nothing and classifies the 401 by the verdict this reaches.
   *
   * Concurrent calls coalesce into one listing through the gate this delegates to, and a call that joins a listing already in flight shares its fate and its mark.
   *
   * @param opts - Whether the request that met the 401 was the connection-recovery probe. The listing carries the probe's mark, so it reaches the controller through
   *   an open breaker as the probe itself did, and books what the controller answered.
   *
   * @returns `"authenticated"` when the controller serves the listing, so the 401 refused a permission the token lacks, and `"refused"` when it answers the listing
   *   with a 401 as well, so the token itself is refused.
   *
   * @throws The status error the listing classifies as when it is answered with anything else, or the transport-level `AccessError` its send failed with.
   */
  async unauthorized(opts: { probe: boolean }): Promise<IdentityVerdict> {

    return this.#unauthorizedGate(opts);
  }

  // One listing, shared by every caller that arrived while it was in flight, read as the verdict on the token.
  async #unauthorizedOnce(opts: { probe: boolean }): Promise<IdentityVerdict> {

    const response = await this.#sendDoorListing(opts);

    if(response.statusCode === 401) {

      return "refused";
    }

    // Any other answer that is not a 2xx says nothing about the token, so it throws the status error it classifies as, and the refused request throws it in turn.
    response.ensureOk();

    return "authenticated";
  }
}

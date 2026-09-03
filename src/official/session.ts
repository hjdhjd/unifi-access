/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * session.ts: The official-API token session - the bearer identity behind the same injected-closure boundary the credential session uses.
 */

/**
 * Construction options for {@link TokenSession}. The token is the whole of the session's identity, so it is the whole of its construction.
 */
export interface TokenSessionOptions {

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
 * The class is nearly stateless, and that is the design rather than an omission. A credential session holds state because a login produces state that expires,
 * rotates, and can be re-established; a token holds none of that, because the identity *is* the token. There is no handshake to run, no cookie to track, and no
 * rotation to follow, so a session that stored anything beyond the token would be storing a copy of something the controller alone is authoritative about. The
 * class exists so that the composition root wires official and credential identity identically, not because there is state here to manage.
 *
 * For the same reason there is no token validation and no expiry tracking. A token's standing is the controller's verdict, delivered as a response, and the error
 * vocabulary reports that verdict; a local check would only be able to disagree with it.
 */
export class TokenSession {

  readonly #token: string;

  constructor(options: TokenSessionOptions) {

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
   * Report whether a 401 can be recovered from. Wired into the transport as its `onUnauthorized` hook, and always `false`: a token cannot re-authenticate itself
   * the way a credential session re-runs its handshake, so there is nothing to attempt. The transport therefore retries nothing and the 401 classifies terminally,
   * which is the honest outcome - a rejected token stays rejected until a new one is issued.
   *
   * @returns `false`, always.
   */
  async unauthorized(): Promise<boolean> {

    return false;
  }
}

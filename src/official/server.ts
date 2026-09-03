/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * server.ts: The official API's own TLS listener - the certificate it presents on the developer port.
 */
import type { AccessOfficialCallOptions, AccessOfficialFileUpload, OfficialDispatch, OfficialDomainOptions } from "./dispatch.ts";
import { officialEndpoint } from "./endpoints.ts";

/**
 * The certificate and private key to install on the official API's TLS listener.
 *
 * Both are files the caller read and names: the reference's own sample calls them `server.crt` and `server.key`, but the filenames sent are whatever the caller
 * supplies, because they belong to the caller's own key material rather than to this library.
 *
 * @category Official
 */
export interface AccessOfficialCertificateUpload {

  cert: AccessOfficialFileUpload;
  key: AccessOfficialFileUpload;
}

/**
 * The official API's own server domain: the TLS certificate the developer port presents.
 *
 * Both endpoints are documentation-derived. Neither has been exercised against a live controller, because each rewrites durable controller configuration.
 */
export class OfficialApiServer {

  readonly #dispatch: OfficialDispatch;
  readonly #host: string;

  constructor(options: OfficialDomainOptions) {

    this.#dispatch = options.dispatch;
    this.#host = options.host;
  }

  /**
   * Install a certificate on the official API's TLS listener. `POST /api_server/certificates`, permission `edit:api_server`. Requires UniFi Access 2.2.10 or
   * later.
   *
   * This applies to the developer port alone, and the Access application must be restarted before the new certificate is presented. That restart takes down the
   * very port every official request rides, so a caller should expect requests to fail for the length of the restart - and repeated failures across that window
   * trip the transport's throttle cooldown exactly as any other stretch of an unreachable controller does.
   *
   * A key that does not match its certificate is refused as a parameter error.
   *
   * Documentation-derived.
   *
   * @param opts - The certificate and its private key.
   * @param call - The per-call options - an optional abort signal.
   */
  async uploadCertificate(opts: AccessOfficialCertificateUpload, call: AccessOfficialCallOptions = {}): Promise<void> {

    await this.#dispatch.command(officialEndpoint(this.#host, "/api_server/certificates"), { form: [
      { data: opts.key.data, field: "key", filename: opts.key.filename },
      { data: opts.cert.data, field: "cert", filename: opts.cert.filename }
    ], method: "POST" }, call);
  }

  /**
   * Remove the installed certificate, returning the listener to the one it ships with. `DELETE /api_server/certificates`, permission `edit:api_server`. Requires
   * UniFi Access 2.2.10 or later.
   *
   * Documentation-derived.
   *
   * @param call - The per-call options - an optional abort signal.
   */
  async deleteCertificate(call: AccessOfficialCallOptions = {}): Promise<void> {

    await this.#dispatch.command(officialEndpoint(this.#host, "/api_server/certificates"), { method: "DELETE" }, call);
  }
}

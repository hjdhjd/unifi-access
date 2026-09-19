/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * api.ts: The official API facade - the typed domains composed over one request path, and the escape hatches for everything the reference does not document.
 */
import type { AccessOfficialRequestOptions, AccessOfficialResult } from "./dispatch.ts";
import { OfficialAccessPolicies } from "./policies.ts";
import { OfficialApiServer } from "./server.ts";
import { OfficialCredentials } from "./credentials.ts";
import { OfficialDevices } from "./devices.ts";
import { OfficialDispatch } from "./dispatch.ts";
import { OfficialIdentity } from "./identity.ts";
import { OfficialSpaces } from "./spaces.ts";
import { OfficialSystemLogs } from "./logs.ts";
import { OfficialUsers } from "./users.ts";
import { OfficialVisitors } from "./visitors.ts";
import { OfficialWebhooks } from "./webhooks.ts";
import type { Transport } from "../transport/http.ts";
import { officialEndpoint } from "./endpoints.ts";

/**
 * Construction options for {@link OfficialApi}: the controller address, and a transport already built against it.
 *
 * The transport arrives built rather than being constructed here, because binding it to the official address and wiring the token session's closures into it is
 * the composition root's job - and a pool takes its origin from the address it was built with, so a transport built against the bare host would pool against an
 * origin no official request ever reaches.
 */
export interface OfficialApiOptions {

  host: string;
  transport: Transport;
}

/**
 * The official UniFi Access API, as typed domains over one request path.
 *
 * Every endpoint the reference publishes is a typed method on one of the domain members below, organized the way the reference organizes them. What the reference
 * does not publish goes through the hatches - `request`, `command`, and `download` - which take a path below the application prefix and give a caller the same
 * envelope handling, error classification, and encoding the typed methods get. So an undocumented endpoint is reachable without waiting for a library release, and
 * without a second way of talking to the controller growing up beside this one.
 *
 * One transport serves every domain, which is deliberate: the throttle breaker it carries then models the controller's health as a whole, rather than any single
 * domain's. An official refusal arrives under a success status inside the envelope and never books a breaker failure - only genuine reachability faults do - so a
 * breaker that opens is saying the controller is unreachable, and throttling every domain at that point is the breaker doing its job.
 */
export class OfficialApi {

  /** Credentials: PIN codes, NFC cards and their enrollment sessions, Touch Passes, and visitor QR codes. */
  readonly credentials: OfficialCredentials;

  /** Devices: the adopted inventory, per-device access-method settings, and the doorbell trigger. */
  readonly devices: OfficialDevices;

  /** UniFi Identity: invitations, and the Identity resources assigned to users and groups. */
  readonly identity: OfficialIdentity;

  /** System logs: the searchable activity record, its CSV export, and the media entries point at. */
  readonly logs: OfficialSystemLogs;

  /** Access policies: the policies themselves, holiday groups, and schedules. */
  readonly policies: OfficialAccessPolicies;

  /** The API server itself: the TLS certificate the developer port presents. */
  readonly server: OfficialApiServer;

  /** Spaces: the door topology, door groups, and the unlock, lock-rule, and emergency controls. */
  readonly spaces: OfficialSpaces;

  /** Users: local accounts, the user-group hierarchy, and the credentials and policies attached to both. */
  readonly users: OfficialUsers;

  /** Visitors: time-bounded guests, their visit scheduling, and the credentials issued to them. */
  readonly visitors: OfficialVisitors;

  /** Webhooks: the endpoints the controller delivers to. */
  readonly webhooks: OfficialWebhooks;

  readonly #dispatch: OfficialDispatch;
  readonly #host: string;

  constructor(options: OfficialApiOptions) {

    this.#dispatch = new OfficialDispatch({ transport: options.transport });
    this.#host = options.host;

    const domain = { dispatch: this.#dispatch, host: this.#host };

    this.credentials = new OfficialCredentials(domain);
    this.devices = new OfficialDevices(domain);
    this.identity = new OfficialIdentity(domain);
    this.logs = new OfficialSystemLogs(domain);
    this.policies = new OfficialAccessPolicies(domain);
    this.server = new OfficialApiServer(domain);
    this.spaces = new OfficialSpaces(domain);
    this.users = new OfficialUsers(domain);
    this.visitors = new OfficialVisitors(domain);
    this.webhooks = new OfficialWebhooks(domain);
  }

  /**
   * Send a request to an official endpoint this library does not model, and unwrap its result envelope.
   *
   * @typeParam T - The payload shape the endpoint returns. The caller asserts it, exactly as it does on the typed domain methods.
   *
   * @param path - The endpoint path below the application prefix, with its leading slash.
   * @param opts - Per-request options, encoded and threaded exactly as they are for a typed method.
   *
   * @returns The endpoint's payload, and its pagination when it paginates.
   */
  async request<T>(path: string, opts: AccessOfficialRequestOptions = {}): Promise<AccessOfficialResult<T>> {

    return this.#dispatch.request<T>(officialEndpoint(this.#host, path), opts);
  }

  /**
   * Send a mutation to an official endpoint this library does not model, where success carries no payload worth reading.
   *
   * @param path - The endpoint path below the application prefix, with its leading slash.
   * @param opts - Per-request options, encoded and threaded exactly as they are for a typed method.
   */
  async command(path: string, opts: AccessOfficialRequestOptions = {}): Promise<void> {

    await this.#dispatch.command(officialEndpoint(this.#host, path), opts);
  }

  /**
   * Fetch raw bytes from an official endpoint this library does not model.
   *
   * @param path - The endpoint path below the application prefix, with its leading slash.
   * @param opts - Per-request options, encoded and threaded exactly as they are for a typed method.
   *
   * @returns The response body as raw bytes.
   */
  async download(path: string, opts: AccessOfficialRequestOptions = {}): Promise<Buffer> {

    return this.#dispatch.download(officialEndpoint(this.#host, path), opts);
  }
}

/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * identity.ts: The official API's UniFi Identity domain - invitations, and the Identity resources assigned to users and user groups.
 */
import type { AccessOfficialCallOptions, OfficialDispatch, OfficialDomainOptions } from "./dispatch.ts";
import type { AccessKnownJsonValue } from "../types/index.ts";
import { officialEndpoint } from "./endpoints.ts";

/**
 * A UniFi Identity resource - an EV station, a VPN, a Wi-Fi network, or a camera.
 *
 * Documentation-derived: no capture in hand exercises any of this domain, because it needs a controller joined to UniFi Identity.
 *
 * @category Official
 */
export interface AccessOfficialIdentityResource {

  readonly deleted: boolean;
  readonly id: string;
  readonly metadata?: Readonly<Record<string, AccessKnownJsonValue>>;
  readonly name: string;
  readonly short_name?: string;
}

/**
 * Identity resources grouped by resource type.
 *
 * The observed keys are `camera`, `ev_station`, `vpn`, and `wifi` - one more than the query parameter's own documented vocabulary, which omits `camera` - so this
 * is keyed by string rather than closed over the query's set.
 *
 * Documentation-derived.
 *
 * @category Official
 */
export type AccessOfficialIdentityResourceMap = Readonly<Record<string, readonly AccessOfficialIdentityResource[]>>;

/**
 * One invitation that could not be sent. The controller reports the request as a success even when individual invitations fail, so this array is where a partial
 * failure is visible - an empty one means every invitation went out.
 *
 * Documentation-derived.
 *
 * @category Official
 */
export interface AccessOfficialIdentityInvitationFailure {

  readonly error_code: string;
  readonly error_msg: string;
  readonly user_email: string;
  readonly user_id: string;
}

/**
 * One UniFi Identity invitation. Supplying `email` updates the user's recorded address as the invitation goes out.
 *
 * @category Official
 */
export interface AccessOfficialIdentityInvitation {

  email?: string;
  user_id: string;
}

/**
 * The resource types the availability query accepts. Closed over the documented query vocabulary; leaving it out returns every type, `camera` included.
 *
 * @category Official
 */
export type AccessOfficialIdentityResourceType = "ev_station" | "vpn" | "wifi";

/**
 * Read the Identity resources available to assign.
 *
 * @category Official
 */
export interface AccessOfficialIdentityResourceOptions {

  resource_type?: AccessOfficialIdentityResourceType;
}

/**
 * Assign Identity resources of one type.
 *
 * @category Official
 */
export interface AccessOfficialIdentityAssignment {

  resource_ids: readonly string[];
  resource_type: AccessOfficialIdentityResourceType;
}

/**
 * The official API's UniFi Identity domain: invitations, and the Identity resources assigned to users and user groups.
 *
 * Every type and method here is documentation-derived. The endpoints need a controller joined to UniFi Identity, and a controller upgraded to Identity Enterprise
 * withdraws the official API altogether - which it signals with the `CODE_OTHERS_UID_ADOPTED_NOT_SUPPORTED` result code rather than through any version check a
 * caller could make in advance.
 */
export class OfficialIdentity {

  readonly #dispatch: OfficialDispatch;
  readonly #host: string;

  constructor(options: OfficialDomainOptions) {

    this.#dispatch = options.dispatch;
    this.#host = options.host;
  }

  /**
   * Send UniFi Identity invitations. `POST /users/identity/invitations`, permission `edit:user`. Requires UniFi Access 1.24.6 or later.
   *
   * The body is the bare array of invitations, with no wrapper member around it. The envelope reports success even when individual invitations fail, so the
   * returned array is what says whether they all went out.
   *
   * Documentation-derived.
   *
   * @param invitations - The invitations to send.
   * @param call        - The per-call options - an optional abort signal.
   *
   * @returns One entry per invitation that failed; empty when every one was sent.
   */
  async sendInvitations(invitations: readonly AccessOfficialIdentityInvitation[],
    call: AccessOfficialCallOptions = {}): Promise<AccessOfficialIdentityInvitationFailure[]> {

    return (await this.#dispatch.request<AccessOfficialIdentityInvitationFailure[]>(officialEndpoint(this.#host, "/users/identity/invitations"),
      { json: invitations, method: "POST" }, call)).data;
  }

  /**
   * Read the Identity resources available to assign. `GET /users/identity/assignments`, permission `view:user`. Requires UniFi Access 1.24.6 or later.
   *
   * Documentation-derived.
   *
   * @param opts - The resource type to narrow to; omitting it returns every type.
   * @param call - The per-call options - an optional abort signal.
   *
   * @returns The available resources, grouped by type.
   */
  async fetchAvailableResources(opts: AccessOfficialIdentityResourceOptions = {}, call: AccessOfficialCallOptions = {}): Promise<AccessOfficialIdentityResourceMap> {

    return (await this.#dispatch.request<AccessOfficialIdentityResourceMap>(officialEndpoint(this.#host, "/users/identity/assignments",
      { "resource_type": opts.resource_type }), {}, call)).data;
  }

  /**
   * Assign Identity resources to a user. `POST /users/:id/identity/assignments`, permission `edit:user`. Requires UniFi Access 1.24.6 or later.
   *
   * Documentation-derived.
   *
   * @param id   - The user's identifier.
   * @param opts - The resource type and the resources of it to assign.
   * @param call - The per-call options - an optional abort signal.
   */
  async assignUserResources(id: string, opts: AccessOfficialIdentityAssignment, call: AccessOfficialCallOptions = {}): Promise<void> {

    await this.#dispatch.command(officialEndpoint(this.#host, "/users/" + encodeURIComponent(id) + "/identity/assignments"), { json: opts, method: "POST" }, call);
  }

  /**
   * Read the Identity resources assigned to a user. `GET /users/:id/identity/assignments`, permission `view:user`. Requires UniFi Access 1.24.6 or later.
   *
   * Documentation-derived.
   *
   * @param id   - The user's identifier.
   * @param call - The per-call options - an optional abort signal.
   *
   * @returns The user's resources, grouped by type.
   */
  async fetchUserResources(id: string, call: AccessOfficialCallOptions = {}): Promise<AccessOfficialIdentityResourceMap> {

    return (await this.#dispatch.request<AccessOfficialIdentityResourceMap>(officialEndpoint(this.#host,
      "/users/" + encodeURIComponent(id) + "/identity/assignments"), {}, call)).data;
  }

  /**
   * Assign Identity resources to a user group. `POST /user_groups/:id/identity/assignments`, permission `edit:user`. Requires UniFi Access 2.2.0 or later.
   *
   * Documentation-derived.
   *
   * @param id   - The group's identifier.
   * @param opts - The resource type and the resources of it to assign.
   * @param call - The per-call options - an optional abort signal.
   */
  async assignGroupResources(id: string, opts: AccessOfficialIdentityAssignment, call: AccessOfficialCallOptions = {}): Promise<void> {

    await this.#dispatch.command(officialEndpoint(this.#host, "/user_groups/" + encodeURIComponent(id) + "/identity/assignments"),
      { json: opts, method: "POST" }, call);
  }

  /**
   * Read the Identity resources assigned to a user group. `GET /user_groups/:id/identity/assignments`, permission `view:user`. Requires UniFi Access 2.2.0 or
   * later.
   *
   * Documentation-derived.
   *
   * @param id   - The group's identifier.
   * @param call - The per-call options - an optional abort signal.
   *
   * @returns The group's resources, grouped by type.
   */
  async fetchGroupResources(id: string, call: AccessOfficialCallOptions = {}): Promise<AccessOfficialIdentityResourceMap> {

    return (await this.#dispatch.request<AccessOfficialIdentityResourceMap>(officialEndpoint(this.#host,
      "/user_groups/" + encodeURIComponent(id) + "/identity/assignments"), {}, call)).data;
  }
}

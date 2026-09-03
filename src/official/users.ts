/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * users.ts: The official API's user domain - local accounts, the user-group hierarchy, and the credentials and policies attached to both.
 */
import type { AccessOfficialCallOptions, AccessOfficialFileUpload, AccessOfficialResult, OfficialDispatch, OfficialDomainOptions } from "./dispatch.ts";
import type { AccessOfficialLicensePlate, AccessOfficialNfcCardRef, AccessOfficialPinCodeRef, AccessOfficialTouchPass } from "./credentials.ts";
import { officialEndpoint, officialPageQuery } from "./endpoints.ts";
import type { AccessOfficialAccessPolicy } from "./policies.ts";
import type { AccessOfficialPageOptions } from "./endpoints.ts";
import type { Nullable } from "../types/index.ts";

/**
 * A user account on the controller.
 *
 * `access_policies`, `access_policy_ids`, and `license_plates` are optional because the plain list and fetch responses omit them - they arrive when the request
 * expands them, and a caller reading them off an unexpanded record gets `undefined` rather than an empty set it might mistake for "none assigned".
 *
 * `touch_pass` is documented as an array in the schema table and spelled with object members in the reference's own detail sample; the wire returns `null` for an
 * unassigned user. The sample is transcribed here, because on this reference the sample has repeatedly proved to be the accurate half.
 *
 * Live-verified.
 *
 * @category Official
 */
export interface AccessOfficialUser {

  readonly access_policies?: readonly AccessOfficialAccessPolicy[];
  readonly access_policy_ids?: readonly string[];
  readonly alias: string;
  readonly avatar_relative_path: string;
  readonly email: string;
  readonly email_status: string;
  readonly employee_number: string;
  readonly first_name: string;
  readonly full_name: string;
  readonly id: string;
  readonly last_name: string;
  readonly license_plates?: readonly AccessOfficialLicensePlate[];
  readonly nfc_cards: readonly AccessOfficialNfcCardRef[];
  readonly onboard_time: number;
  readonly phone: string;
  readonly pin_code: Nullable<AccessOfficialPinCodeRef>;
  readonly status: "ACTIVE" | "DEACTIVATED" | "PENDING" | (string & {});
  readonly touch_pass: Nullable<AccessOfficialTouchPass>;
  readonly user_email: string;
  readonly username: string;
}

/**
 * What the registration endpoint echoes back.
 *
 * Against a live controller the echo carries the complete account record, not the four members the reference describes - which makes this another place the
 * documented response understates what the wire sends. The four documented members are required here because the reference claims them and the wire confirms
 * them; the rest are live-verified and optional, pending more specimens than the one this rests on.
 *
 * This is one account shape observed through two endpoints with different confidence rather than two shapes, so it is derived from {@link
 * AccessOfficialUserGroupMember} rather than restating the same member names beside it. The derivation is what carries the difference: the four the reference
 * documents stay required, and the rest become optional, so each endpoint's own observed confidence is expressed while the names and their types live in one
 * place and cannot drift apart.
 *
 * Live-verified.
 *
 * @category Official
 */
export type AccessOfficialUserCreated = Pick<AccessOfficialUserGroupMember, "first_name" | "id" | "last_name" | "user_email"> &
  Partial<Omit<AccessOfficialUserGroupMember, "first_name" | "id" | "last_name" | "user_email">>;

/**
 * A user as a group's membership list names them - the account fields, without the credentials or policies a full user record carries.
 *
 * Documentation-derived.
 *
 * @category Official
 */
export interface AccessOfficialUserGroupMember {

  readonly alias: string;
  readonly avatar_relative_path: string;
  readonly email: string;
  readonly email_status: string;
  readonly employee_number: string;
  readonly first_name: string;
  readonly full_name: string;
  readonly id: string;
  readonly last_name: string;
  readonly onboard_time: number;
  readonly phone: string;
  readonly status: "ACTIVE" | "DEACTIVATED" | "PENDING" | (string & {});
  readonly user_email: string;
  readonly username: string;
}

/**
 * A user as the search endpoint returns them: the group-member fields plus the two credential members search adds.
 *
 * Documentation-derived.
 *
 * @category Official
 */
export interface AccessOfficialUserSearchResult extends AccessOfficialUserGroupMember {

  readonly nfc_cards: readonly AccessOfficialNfcCardRef[];
  readonly pin_code: Nullable<AccessOfficialPinCodeRef>;
}

/**
 * A user group. `up_id` names the parent group and `up_ids` the whole ancestry, so a caller can place a group in the hierarchy without walking it.
 *
 * Documentation-derived.
 *
 * @category Official
 */
export interface AccessOfficialUserGroup {

  readonly full_name: string;
  readonly id: string;
  readonly name: string;
  readonly up_id: string;
  readonly up_ids: readonly string[];
}

/**
 * Where a user's uploaded profile picture now lives.
 *
 * Documentation-derived.
 *
 * @category Official
 */
export interface AccessOfficialUserAvatar {

  readonly avatar_url: string;
}

/**
 * The expansions a user read accepts. The reference's field table labels this a boolean flag, but its own sample sends `expand[]=access_policy` and the visitor
 * sibling documents the same parameter as a string vocabulary - a boolean would serialize as `expand[]=true` and silently return an unexpanded record.
 *
 * @category Official
 */
export type AccessOfficialUserExpand = "access_policy";

/**
 * Register a user. `user_email` requires UniFi Access 1.22.16 or later.
 *
 * @category Official
 */
export interface AccessOfficialUserCreate {

  employee_number?: string;
  first_name: string;
  last_name: string;
  onboard_time?: number;
  user_email?: string;
}

/**
 * Update a user. Every member is optional - the endpoint is a partial update, and an omitted member is left as it stands.
 *
 * @category Official
 */
export interface AccessOfficialUserUpdate {

  employee_number?: string;
  first_name?: string;
  last_name?: string;
  onboard_time?: number;
  status?: "ACTIVE" | "DEACTIVATED";
  user_email?: string;
}

/**
 * Read one user, optionally expanded.
 *
 * @category Official
 */
export interface AccessOfficialUserFetchOptions {

  expand?: readonly AccessOfficialUserExpand[];
}

/**
 * List users: a page, optionally expanded.
 *
 * @category Official
 */
export interface AccessOfficialUserListOptions extends AccessOfficialPageOptions {

  expand?: readonly AccessOfficialUserExpand[];
}

/**
 * Search users. `status` and `userId` are repeatable - each entry is sent under its own key, which is how the endpoint takes more than one.
 *
 * @category Official
 */
export interface AccessOfficialUserSearchOptions extends AccessOfficialPageOptions {

  keyword?: string;
  onlyAdmin?: boolean;
  status?: readonly ("ACTIVE" | "DEACTIVATED" | "PENDING")[];
  userId?: readonly string[];
}

/**
 * Read the policies assigned to a user. With `only_user_policies` set, the policies inherited from the user's groups are left out.
 *
 * @category Official
 */
export interface AccessOfficialUserAccessPolicyOptions {

  only_user_policies?: boolean;
}

/**
 * Assign an NFC card to a user. `force_add` takes the card from whoever currently holds it.
 *
 * @category Official
 */
export interface AccessOfficialUserNfcCardAssign {

  force_add?: boolean;
  token: string;
}

/**
 * Create a user group. `up_id` places it under an existing group.
 *
 * @category Official
 */
export interface AccessOfficialUserGroupCreate {

  name: string;
  up_id?: string;
}

/**
 * Update a user group. Every member is optional - the endpoint is a partial update.
 *
 * @category Official
 */
export interface AccessOfficialUserGroupUpdate {

  name?: string;
  up_id?: string;
}

/**
 * Assign Touch Passes to several users at once. `emails` is keyed by user identifier.
 *
 * @category Official
 */
export interface AccessOfficialTouchPassBatchAssign {

  emails?: Readonly<Record<string, string>>;
  ids: readonly string[];
}

/**
 * The official API's user domain: local accounts, the user-group hierarchy, and the credentials and access policies attached to either.
 */
export class OfficialUsers {

  readonly #dispatch: OfficialDispatch;
  readonly #host: string;

  constructor(options: OfficialDomainOptions) {

    this.#dispatch = options.dispatch;
    this.#host = options.host;
  }

  /**
   * Register a user. `POST /users`, permission `edit:user`.
   *
   * Live-verified.
   *
   * @param opts - The user to register.
   * @param call - The per-call options - an optional abort signal.
   *
   * @returns The identifier the controller minted, with the names it recorded.
   */
  async create(opts: AccessOfficialUserCreate, call: AccessOfficialCallOptions = {}): Promise<AccessOfficialUserCreated> {

    return (await this.#dispatch.request<AccessOfficialUserCreated>(officialEndpoint(this.#host, "/users"), { json: opts, method: "POST" }, call)).data;
  }

  /**
   * Update a user. `PUT /users/:id`, permission `edit:user`.
   *
   * Live-verified.
   *
   * @param id   - The user's identifier.
   * @param opts - The members to change; anything omitted is left as it stands.
   * @param call - The per-call options - an optional abort signal.
   */
  async update(id: string, opts: AccessOfficialUserUpdate, call: AccessOfficialCallOptions = {}): Promise<void> {

    await this.#dispatch.command(officialEndpoint(this.#host, "/users/" + encodeURIComponent(id)), { json: opts, method: "PUT" }, call);
  }

  /**
   * Fetch one user. `GET /users/:id`, permission `view:user`.
   *
   * Live-verified.
   *
   * @param id   - The user's identifier.
   * @param opts - The expansions to request.
   * @param call - The per-call options - an optional abort signal.
   *
   * @returns The user.
   */
  async fetch(id: string, opts: AccessOfficialUserFetchOptions = {}, call: AccessOfficialCallOptions = {}): Promise<AccessOfficialUser> {

    return (await this.#dispatch.request<AccessOfficialUser>(officialEndpoint(this.#host, "/users/" + encodeURIComponent(id),
      { "expand[]": opts.expand }), {}, call)).data;
  }

  /**
   * Fetch a page of users. `GET /users`, permission `view:user`.
   *
   * Live-verified.
   *
   * @param opts - The page to fetch, and the expansions to request.
   * @param call - The per-call options - an optional abort signal.
   *
   * @returns The page of users, and the pagination describing it.
   */
  async fetchAll(opts: AccessOfficialUserListOptions = {}, call: AccessOfficialCallOptions = {}): Promise<AccessOfficialResult<AccessOfficialUser[]>> {

    return this.#dispatch.request<AccessOfficialUser[]>(officialEndpoint(this.#host, "/users", { ...officialPageQuery(opts), "expand[]": opts.expand }), {}, call);
  }

  /**
   * Set the access policies assigned directly to a user. `PUT /users/:id/access_policies`, permission `edit:user`.
   *
   * The set is replaced rather than added to, so an empty array removes every policy assigned directly to the user.
   *
   * Documentation-derived.
   *
   * @param id        - The user's identifier.
   * @param policyIds - The policies to assign.
   * @param call      - The per-call options - an optional abort signal.
   */
  async assignAccessPolicies(id: string, policyIds: readonly string[], call: AccessOfficialCallOptions = {}): Promise<void> {

    await this.#dispatch.command(officialEndpoint(this.#host, "/users/" + encodeURIComponent(id) + "/access_policies"),
      { json: { "access_policy_ids": policyIds }, method: "PUT" }, call);
  }

  /**
   * Assign an NFC card to a user. `PUT /users/:id/nfc_cards`, permission `edit:user`.
   *
   * Documentation-derived.
   *
   * @param id   - The user's identifier.
   * @param opts - The card's token, and whether to take it from its current holder.
   * @param call - The per-call options - an optional abort signal.
   */
  async assignNfcCard(id: string, opts: AccessOfficialUserNfcCardAssign, call: AccessOfficialCallOptions = {}): Promise<void> {

    await this.#dispatch.command(officialEndpoint(this.#host, "/users/" + encodeURIComponent(id) + "/nfc_cards"), { json: opts, method: "PUT" }, call);
  }

  /**
   * Unassign an NFC card from a user. `PUT /users/:id/nfc_cards/delete`, permission `edit:user`.
   *
   * The verb is the documented one. The reference's own sample for this endpoint sends `DELETE` against the same URL, but its visitor counterpart documents the
   * same operation as `PUT` without contradicting itself, and the `/delete` path suffix is how this API tunnels a delete through a verb that carries a body.
   *
   * Documentation-derived.
   *
   * @param id    - The user's identifier.
   * @param token - The card's token.
   * @param call  - The per-call options - an optional abort signal.
   */
  async unassignNfcCard(id: string, token: string, call: AccessOfficialCallOptions = {}): Promise<void> {

    await this.#dispatch.command(officialEndpoint(this.#host, "/users/" + encodeURIComponent(id) + "/nfc_cards/delete"), { json: { token }, method: "PUT" }, call);
  }

  /**
   * Assign a PIN code to a user. `PUT /users/:id/pin_codes`, permission `edit:user`.
   *
   * Live-verified.
   *
   * @param id      - The user's identifier.
   * @param pinCode - The code, minted through the credentials domain.
   * @param call    - The per-call options - an optional abort signal.
   */
  async assignPinCode(id: string, pinCode: string, call: AccessOfficialCallOptions = {}): Promise<void> {

    await this.#dispatch.command(officialEndpoint(this.#host, "/users/" + encodeURIComponent(id) + "/pin_codes"),
      { json: { "pin_code": pinCode }, method: "PUT" }, call);
  }

  /**
   * Unassign a user's PIN code. `DELETE /users/:id/pin_codes`, permission `edit:user`.
   *
   * Live-verified.
   *
   * @param id   - The user's identifier.
   * @param call - The per-call options - an optional abort signal.
   */
  async unassignPinCode(id: string, call: AccessOfficialCallOptions = {}): Promise<void> {

    await this.#dispatch.command(officialEndpoint(this.#host, "/users/" + encodeURIComponent(id) + "/pin_codes"), { method: "DELETE" }, call);
  }

  /**
   * Create a user group. `POST /user_groups`, permission `edit:user`. Requires UniFi Access 2.2.6 or later.
   *
   * Documentation-derived.
   *
   * @param opts - The group to create.
   * @param call - The per-call options - an optional abort signal.
   */
  async createGroup(opts: AccessOfficialUserGroupCreate, call: AccessOfficialCallOptions = {}): Promise<void> {

    await this.#dispatch.command(officialEndpoint(this.#host, "/user_groups"), { json: opts, method: "POST" }, call);
  }

  /**
   * Fetch every user group. `GET /user_groups`, permission `view:user`. Requires UniFi Access 2.2.6 or later.
   *
   * Documentation-derived.
   *
   * @param call - The per-call options - an optional abort signal.
   *
   * @returns Every group on the controller.
   */
  async fetchAllGroups(call: AccessOfficialCallOptions = {}): Promise<AccessOfficialUserGroup[]> {

    return (await this.#dispatch.request<AccessOfficialUserGroup[]>(officialEndpoint(this.#host, "/user_groups"), {}, call)).data;
  }

  /**
   * Fetch one user group. `GET /user_groups/:id`, permission `view:user`. Requires UniFi Access 2.2.6 or later.
   *
   * Documentation-derived.
   *
   * @param id   - The group's identifier.
   * @param call - The per-call options - an optional abort signal.
   *
   * @returns The group.
   */
  async fetchGroup(id: string, call: AccessOfficialCallOptions = {}): Promise<AccessOfficialUserGroup> {

    return (await this.#dispatch.request<AccessOfficialUserGroup>(officialEndpoint(this.#host, "/user_groups/" + encodeURIComponent(id)), {}, call)).data;
  }

  /**
   * Update a user group. `PUT /user_groups/:id`, permission `edit:user`. Requires UniFi Access 2.2.6 or later.
   *
   * Documentation-derived.
   *
   * @param id   - The group's identifier.
   * @param opts - The members to change; anything omitted is left as it stands.
   * @param call - The per-call options - an optional abort signal.
   */
  async updateGroup(id: string, opts: AccessOfficialUserGroupUpdate, call: AccessOfficialCallOptions = {}): Promise<void> {

    await this.#dispatch.command(officialEndpoint(this.#host, "/user_groups/" + encodeURIComponent(id)), { json: opts, method: "PUT" }, call);
  }

  /**
   * Delete a user group. `DELETE /user_groups/:id`, permission `edit:user`. Requires UniFi Access 2.2.6 or later.
   *
   * Documentation-derived.
   *
   * @param id   - The group's identifier.
   * @param call - The per-call options - an optional abort signal.
   */
  async deleteGroup(id: string, call: AccessOfficialCallOptions = {}): Promise<void> {

    await this.#dispatch.command(officialEndpoint(this.#host, "/user_groups/" + encodeURIComponent(id)), { method: "DELETE" }, call);
  }

  /**
   * Add users to a group. `POST /user_groups/:id/users`, permission `edit:user`. Requires UniFi Access 2.2.6 or later.
   *
   * The body is the bare array of identifiers, with no wrapper member around it - the endpoint reads the whole document as the list.
   *
   * Documentation-derived.
   *
   * @param id      - The group's identifier.
   * @param userIds - The users to add.
   * @param call    - The per-call options - an optional abort signal.
   */
  async assignToGroup(id: string, userIds: readonly string[], call: AccessOfficialCallOptions = {}): Promise<void> {

    await this.#dispatch.command(officialEndpoint(this.#host, "/user_groups/" + encodeURIComponent(id) + "/users"), { json: userIds, method: "POST" }, call);
  }

  /**
   * Remove users from a group. `POST /user_groups/:id/users/delete`, permission `edit:user`. Requires UniFi Access 2.2.6 or later.
   *
   * The body is the bare array of identifiers, exactly as on the assignment endpoint.
   *
   * Documentation-derived.
   *
   * @param id      - The group's identifier.
   * @param userIds - The users to remove.
   * @param call    - The per-call options - an optional abort signal.
   */
  async unassignFromGroup(id: string, userIds: readonly string[], call: AccessOfficialCallOptions = {}): Promise<void> {

    await this.#dispatch.command(officialEndpoint(this.#host, "/user_groups/" + encodeURIComponent(id) + "/users/delete"), { json: userIds, method: "POST" }, call);
  }

  /**
   * Fetch the users in a group, excluding its subgroups. `GET /user_groups/:id/users`, permission `view:user`. Requires UniFi Access 2.2.6 or later.
   *
   * Documentation-derived.
   *
   * @param id   - The group's identifier.
   * @param call - The per-call options - an optional abort signal.
   *
   * @returns The group's own members.
   */
  async fetchGroupUsers(id: string, call: AccessOfficialCallOptions = {}): Promise<AccessOfficialUserGroupMember[]> {

    return (await this.#dispatch.request<AccessOfficialUserGroupMember[]>(officialEndpoint(this.#host,
      "/user_groups/" + encodeURIComponent(id) + "/users"), {}, call)).data;
  }

  /**
   * Fetch the users in a group and every subgroup below it. `GET /user_groups/:id/users/all`, permission `view:user`. Requires UniFi Access 2.2.6 or later.
   *
   * Documentation-derived.
   *
   * @param id   - The group's identifier.
   * @param call - The per-call options - an optional abort signal.
   *
   * @returns The group's members, subgroups included.
   */
  async fetchAllGroupUsers(id: string, call: AccessOfficialCallOptions = {}): Promise<AccessOfficialUserGroupMember[]> {

    return (await this.#dispatch.request<AccessOfficialUserGroupMember[]>(officialEndpoint(this.#host,
      "/user_groups/" + encodeURIComponent(id) + "/users/all"), {}, call)).data;
  }

  /**
   * Fetch the access policies a user holds. `GET /users/:id/access_policies`, permission `view:user`. Requires UniFi Access 2.2.6 or later.
   *
   * Documentation-derived.
   *
   * @param id   - The user's identifier.
   * @param opts - Whether to report only the policies assigned directly to the user rather than those inherited from their groups.
   * @param call - The per-call options - an optional abort signal.
   *
   * @returns The policies.
   */
  async fetchAccessPolicies(id: string, opts: AccessOfficialUserAccessPolicyOptions = {}, call: AccessOfficialCallOptions = {}): Promise<AccessOfficialAccessPolicy[]> {

    return (await this.#dispatch.request<AccessOfficialAccessPolicy[]>(officialEndpoint(this.#host, "/users/" + encodeURIComponent(id) + "/access_policies",
      { "only_user_policies": opts.only_user_policies }), {}, call)).data;
  }

  /**
   * Set the access policies assigned to a user group. `PUT /user_groups/:id/access_policies`, permission `edit:user`. Requires UniFi Access 2.2.6 or later.
   *
   * Documentation-derived.
   *
   * @param id        - The group's identifier.
   * @param policyIds - The policies to assign.
   * @param call      - The per-call options - an optional abort signal.
   */
  async assignAccessPoliciesToGroup(id: string, policyIds: readonly string[], call: AccessOfficialCallOptions = {}): Promise<void> {

    await this.#dispatch.command(officialEndpoint(this.#host, "/user_groups/" + encodeURIComponent(id) + "/access_policies"),
      { json: { "access_policy_ids": policyIds }, method: "PUT" }, call);
  }

  /**
   * Fetch the access policies a user group holds. `GET /user_groups/:id/access_policies`, permission `view:user`. Requires UniFi Access 2.2.6 or later.
   *
   * Documentation-derived.
   *
   * @param id   - The group's identifier.
   * @param call - The per-call options - an optional abort signal.
   *
   * @returns The policies.
   */
  async fetchGroupAccessPolicies(id: string, call: AccessOfficialCallOptions = {}): Promise<AccessOfficialAccessPolicy[]> {

    return (await this.#dispatch.request<AccessOfficialAccessPolicy[]>(officialEndpoint(this.#host,
      "/user_groups/" + encodeURIComponent(id) + "/access_policies"), {}, call)).data;
  }

  /**
   * Delete a user. `DELETE /users/:id`, permission `edit:user`. Requires UniFi Access 3.1.30 or later.
   *
   * Only a user already in the disabled status can be deleted, so an active account is deactivated first.
   *
   * Live-verified.
   *
   * @param id   - The user's identifier.
   * @param call - The per-call options - an optional abort signal.
   */
  async delete(id: string, call: AccessOfficialCallOptions = {}): Promise<void> {

    await this.#dispatch.command(officialEndpoint(this.#host, "/users/" + encodeURIComponent(id)), { method: "DELETE" }, call);
  }

  /**
   * Search users. `GET /users/search`, permission `view:user`. Requires UniFi Access 3.1.30 or later.
   *
   * Documentation-derived.
   *
   * @param opts - The search terms and the page to fetch.
   * @param call - The per-call options - an optional abort signal.
   *
   * @returns The page of matches, and the pagination describing it.
   */
  async search(opts: AccessOfficialUserSearchOptions = {}, call: AccessOfficialCallOptions = {}): Promise<AccessOfficialResult<AccessOfficialUserSearchResult[]>> {

    return this.#dispatch.request<AccessOfficialUserSearchResult[]>(officialEndpoint(this.#host, "/users/search", { ...officialPageQuery(opts),
      "keyword": opts.keyword, "only_admin": opts.onlyAdmin, "status": opts.status, "user_id": opts.userId }), {}, call);
  }

  /**
   * Assign a Touch Pass to a user. `PUT /users/:user_id/touch_passes/:touch_pass_id`, permission `edit:user`. Requires UniFi Access 3.2.20 or later.
   *
   * Documentation-derived.
   *
   * @param userId      - The user's identifier.
   * @param touchPassId - The pass's identifier, from the assignable list.
   * @param call        - The per-call options - an optional abort signal.
   *
   * @returns The pass, now assigned.
   */
  async assignTouchPass(userId: string, touchPassId: string, call: AccessOfficialCallOptions = {}): Promise<AccessOfficialTouchPass> {

    return (await this.#dispatch.request<AccessOfficialTouchPass>(officialEndpoint(this.#host, "/users/" + encodeURIComponent(userId) + "/touch_passes/" +
      encodeURIComponent(touchPassId)), { method: "PUT" }, call)).data;
  }

  /**
   * Unassign a Touch Pass from a user. `DELETE /users/:user_id/touch_passes/:touch_pass_id`, permission `edit:user`. Requires UniFi Access 3.2.20 or later.
   *
   * Documentation-derived.
   *
   * @param userId      - The user's identifier.
   * @param touchPassId - The pass's identifier.
   * @param call        - The per-call options - an optional abort signal.
   *
   * @returns The pass, now unassigned - its `user_*` members emptied.
   */
  async unassignTouchPass(userId: string, touchPassId: string, call: AccessOfficialCallOptions = {}): Promise<AccessOfficialTouchPass> {

    return (await this.#dispatch.request<AccessOfficialTouchPass>(officialEndpoint(this.#host, "/users/" + encodeURIComponent(userId) + "/touch_passes/" +
      encodeURIComponent(touchPassId)), { method: "DELETE" }, call)).data;
  }

  /**
   * Assign Touch Passes to several users at once. `PUT /users/touch_passes/assign`, permission `edit:user`. Requires UniFi Access 3.2.20 or later.
   *
   * Documentation-derived.
   *
   * @param opts - The users to assign to, and the email addresses to record against them.
   * @param call - The per-call options - an optional abort signal.
   *
   * @returns One pass per user assigned.
   */
  async batchAssignTouchPasses(opts: AccessOfficialTouchPassBatchAssign, call: AccessOfficialCallOptions = {}): Promise<AccessOfficialTouchPass[]> {

    return (await this.#dispatch.request<AccessOfficialTouchPass[]>(officialEndpoint(this.#host, "/users/touch_passes/assign"),
      { json: opts, method: "PUT" }, call)).data;
  }

  /**
   * Set the license plates registered to a user. `PUT /users/:id/license_plates`, permission `edit:user`. Requires UniFi Access 3.3.10 or later.
   *
   * The body is the bare array of plate numbers, with no wrapper member around it.
   *
   * Documentation-derived.
   *
   * @param id     - The user's identifier.
   * @param plates - The plate numbers to register.
   * @param call   - The per-call options - an optional abort signal.
   */
  async assignLicensePlates(id: string, plates: readonly string[], call: AccessOfficialCallOptions = {}): Promise<void> {

    await this.#dispatch.command(officialEndpoint(this.#host, "/users/" + encodeURIComponent(id) + "/license_plates"), { json: plates, method: "PUT" }, call);
  }

  /**
   * Unregister one license plate from a user. `DELETE /users/:user_id/license_plates/:license_plate_id`, permission `edit:user`. Requires UniFi Access 3.3.10 or
   * later.
   *
   * Documentation-derived.
   *
   * @param userId         - The user's identifier.
   * @param licensePlateId - The plate's identifier, from the user's own record.
   * @param call           - The per-call options - an optional abort signal.
   */
  async unassignLicensePlate(userId: string, licensePlateId: string, call: AccessOfficialCallOptions = {}): Promise<void> {

    await this.#dispatch.command(officialEndpoint(this.#host, "/users/" + encodeURIComponent(userId) + "/license_plates/" +
      encodeURIComponent(licensePlateId)), { method: "DELETE" }, call);
  }

  /**
   * Upload a user's profile picture. `POST /users/:id/avatar`, permission `edit:user`. Requires UniFi Access 3.3.10 or later.
   *
   * Supported for local users only - an account backed by a UI account updates its picture through the UI account interface instead.
   *
   * Documentation-derived.
   *
   * @param id   - The user's identifier.
   * @param opts - The image bytes and the name to send them under.
   * @param call - The per-call options - an optional abort signal.
   *
   * @returns Where the picture now lives.
   */
  async uploadAvatar(id: string, opts: AccessOfficialFileUpload, call: AccessOfficialCallOptions = {}): Promise<AccessOfficialUserAvatar> {

    return (await this.#dispatch.request<AccessOfficialUserAvatar>(officialEndpoint(this.#host, "/users/" + encodeURIComponent(id) + "/avatar"),
      { form: [{ data: opts.data, field: "file", filename: opts.filename }], method: "POST" }, call)).data;
  }
}

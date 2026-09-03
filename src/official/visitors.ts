/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * visitors.ts: The official API's visitor domain - time-bounded guests, their visit scheduling, and the credentials issued to them.
 */
import type { AccessOfficialCallOptions, AccessOfficialResult, OfficialDispatch, OfficialDomainOptions } from "./dispatch.ts";
import type { AccessOfficialLicensePlate, AccessOfficialNfcCardRef, AccessOfficialPinCodeRef } from "./credentials.ts";
import { officialEndpoint, officialPageQuery } from "./endpoints.ts";
import type { AccessOfficialPageOptions } from "./endpoints.ts";
import type { AccessOfficialWeekSchedule } from "./policies.ts";
import type { Nullable } from "../types/index.ts";

/**
 * A door or door group a visitor may enter, as their record names it.
 *
 * The response carries the resource's name alongside its identifier, which the request form does not - so a caller reading a visitor back learns where they may go
 * without a second lookup.
 *
 * Documentation-derived.
 *
 * @category Official
 */
export interface AccessOfficialVisitorResource {

  readonly id: string;
  readonly name: string;
  readonly type: "door" | "door_group" | (string & {});
}

/**
 * The recurring visit schedule attached to a visitor.
 *
 * `weekly` is null on a one-time visit, which is the wire's way of saying the visit has no recurring pattern rather than that it has an empty one. The member is
 * spelled `weekly` on every response sample, where the request that sets it is spelled `week_schedule` - the two spellings are the reference's own, transcribed
 * rather than reconciled.
 *
 * Documentation-derived.
 *
 * @category Official
 */
export interface AccessOfficialVisitorSchedule {

  readonly id?: string;
  readonly is_default?: boolean;
  readonly name: string;
  readonly type: "access" | (string & {});
  readonly weekly: Nullable<AccessOfficialWeekSchedule>;
}

/**
 * A visitor: a guest granted access between a start and an end time.
 *
 * `status` is the wire's integer code - 1 upcoming, 2 visited, 3 visiting, 4 cancelled, 5 no-visit, 6 active - widened with the open arm, because the reference's
 * published vocabularies have repeatedly understated the wire.
 *
 * `schedule` is present when the visit recurs and absent when it is a one-time visit, which is the distinction the reference draws.
 *
 * `avatar`, `create_time`, `has_qr_code`, `location_id`, and `timezone` are live-verified members present on every capture in hand, and the reference documents
 * none of them. They are optional rather than required because this API varies what a record carries by which endpoint returned it - the schedule list drops three
 * members the detail read sends - so a member observed on one view is not yet a member every view carries.
 *
 * Live-verified.
 *
 * @category Official
 */
export interface AccessOfficialVisitor {

  readonly avatar?: string;
  readonly create_time?: number;
  readonly email: string;
  readonly end_time: number;
  readonly first_name: string;
  readonly has_qr_code?: boolean;
  readonly id: string;
  readonly inviter_id: string;
  readonly inviter_name: string;
  readonly last_name: string;
  readonly license_plates?: readonly AccessOfficialLicensePlate[];
  readonly location_id?: string;
  readonly mobile_phone: string;
  readonly nfc_cards: readonly AccessOfficialNfcCardRef[];
  readonly pin_code: Nullable<AccessOfficialPinCodeRef>;
  readonly remarks: string;
  readonly resources?: readonly AccessOfficialVisitorResource[];
  readonly schedule?: AccessOfficialVisitorSchedule;
  readonly schedule_id: string;
  readonly start_time: number;
  readonly status: 1 | 2 | 3 | 4 | 5 | 6 | (number & {});
  readonly timezone?: string;
  readonly visit_reason: "Business" | "Cooperation" | "Interview" | "Others" | (string & {});
  readonly visitor_company: string;
}

/**
 * A door or door group a visitor request grants. Closed over the documented pair: a caller composes a request from the documented set, so a misspelling is a
 * compile error rather than a request the controller silently refuses.
 *
 * @category Official
 */
export interface AccessOfficialVisitorResourceRef {

  id: string;
  type: "door" | "door_group";
}

/**
 * Invite a visitor. `week_schedule` makes the visit recurring; omitting it makes it a one-time visit between the start and end times.
 *
 * @category Official
 */
export interface AccessOfficialVisitorCreate {

  email?: string;
  end_time: number;
  first_name: string;
  last_name: string;
  mobile_phone?: string;
  remarks?: string;
  resources?: readonly AccessOfficialVisitorResourceRef[];
  start_time: number;
  visit_reason: "Business" | "Cooperation" | "Interview" | "Others";
  visitor_company?: string;
  week_schedule?: AccessOfficialWeekSchedule;
}

/**
 * Update a visitor. Every member is optional - the endpoint is a partial update, and an omitted member is left as it stands. A visitor's status cannot be changed
 * through this endpoint.
 *
 * @category Official
 */
export interface AccessOfficialVisitorUpdate {

  email?: string;
  end_time?: number;
  first_name?: string;
  last_name?: string;
  mobile_phone?: string;
  remarks?: string;
  resources?: readonly AccessOfficialVisitorResourceRef[];
  start_time?: number;
  visit_reason?: "Business" | "Cooperation" | "Interview" | "Others";
  visitor_company?: string;
  week_schedule?: AccessOfficialWeekSchedule;
}

/**
 * The expansions a visitor list accepts. Requires UniFi Access 1.22.16 or later.
 *
 * @category Official
 */
export type AccessOfficialVisitorExpand = "access_policy" | "nfc_card" | "none" | "pin_code" | "resource" | "schedule";

/**
 * List visitors. A `keyword` prefix-matches the first and last name, and disables the status filter while it is present.
 *
 * @category Official
 */
export interface AccessOfficialVisitorListOptions extends AccessOfficialPageOptions {

  expand?: readonly AccessOfficialVisitorExpand[];
  keyword?: string;
  status?: 1 | 2 | 3 | 4 | 5 | 6;
}

/**
 * Delete a visitor. Without `is_force` the visitor is moved to the cancelled status; with it, the record is removed outright.
 *
 * @category Official
 */
export interface AccessOfficialVisitorDeleteOptions {

  is_force?: boolean;
}

/**
 * Assign an NFC card to a visitor. `force_add` takes the card from whoever currently holds it.
 *
 * @category Official
 */
export interface AccessOfficialVisitorNfcCardAssign {

  force_add?: boolean;
  token: string;
}

/**
 * The official API's visitor domain: time-bounded guests, the schedule governing when they may enter, and the credentials issued to them for the visit.
 */
export class OfficialVisitors {

  readonly #dispatch: OfficialDispatch;
  readonly #host: string;

  constructor(options: OfficialDomainOptions) {

    this.#dispatch = options.dispatch;
    this.#host = options.host;
  }

  /**
   * Invite a visitor. `POST /visitors`, permission `edit:visitor`.
   *
   * Live-verified.
   *
   * @param opts - The visitor to invite.
   * @param call - The per-call options - an optional abort signal.
   *
   * @returns The created visitor, with their resources expanded and their schedule resolved.
   */
  async create(opts: AccessOfficialVisitorCreate, call: AccessOfficialCallOptions = {}): Promise<AccessOfficialVisitor> {

    return (await this.#dispatch.request<AccessOfficialVisitor>(officialEndpoint(this.#host, "/visitors"), { json: opts, method: "POST" }, call)).data;
  }

  /**
   * Fetch one visitor. `GET /visitors/:id`, permission `view:visitor`.
   *
   * Live-verified.
   *
   * @param id   - The visitor's identifier.
   * @param call - The per-call options - an optional abort signal.
   *
   * @returns The visitor.
   */
  async fetch(id: string, call: AccessOfficialCallOptions = {}): Promise<AccessOfficialVisitor> {

    return (await this.#dispatch.request<AccessOfficialVisitor>(officialEndpoint(this.#host, "/visitors/" + encodeURIComponent(id)), {}, call)).data;
  }

  /**
   * Fetch a page of visitors. `GET /visitors`, permission `view:visitor`. License plates on the returned records require UniFi Access 3.3.10 or later.
   *
   * Live-verified.
   *
   * @param opts - The page to fetch, the status to narrow to, and the expansions to request.
   * @param call - The per-call options - an optional abort signal.
   *
   * @returns The page of visitors, and the pagination describing it.
   */
  async fetchAll(opts: AccessOfficialVisitorListOptions = {}, call: AccessOfficialCallOptions = {}): Promise<AccessOfficialResult<AccessOfficialVisitor[]>> {

    return this.#dispatch.request<AccessOfficialVisitor[]>(officialEndpoint(this.#host, "/visitors", { ...officialPageQuery(opts), "expand[]": opts.expand,
      "keyword": opts.keyword, "status": opts.status }), {}, call);
  }

  /**
   * Update a visitor. `PUT /visitors/:id`, permission `edit:visitor`.
   *
   * Documentation-derived.
   *
   * @param id   - The visitor's identifier.
   * @param opts - The members to change; anything omitted is left as it stands.
   * @param call - The per-call options - an optional abort signal.
   *
   * @returns The updated visitor.
   */
  async update(id: string, opts: AccessOfficialVisitorUpdate, call: AccessOfficialCallOptions = {}): Promise<AccessOfficialVisitor> {

    return (await this.#dispatch.request<AccessOfficialVisitor>(officialEndpoint(this.#host, "/visitors/" + encodeURIComponent(id)),
      { json: opts, method: "PUT" }, call)).data;
  }

  /**
   * Cancel or remove a visitor. `DELETE /visitors/:id`, permission `edit:visitor`.
   *
   * The default is a cancellation: the visitor is moved to the cancelled status and their record stays, which is what keeps the visit in the controller's own
   * history. Passing `is_force` removes the record outright instead.
   *
   * Live-verified.
   *
   * @param id   - The visitor's identifier.
   * @param opts - Whether to remove the record rather than cancel the visit.
   * @param call - The per-call options - an optional abort signal.
   */
  async delete(id: string, opts: AccessOfficialVisitorDeleteOptions = {}, call: AccessOfficialCallOptions = {}): Promise<void> {

    await this.#dispatch.command(officialEndpoint(this.#host, "/visitors/" + encodeURIComponent(id), { "is_force": opts.is_force }), { method: "DELETE" }, call);
  }

  /**
   * Assign an NFC card to a visitor. `PUT /visitors/:id/nfc_cards`, permission `edit:visitor`.
   *
   * Documentation-derived.
   *
   * @param id   - The visitor's identifier.
   * @param opts - The card's token, and whether to take it from its current holder.
   * @param call - The per-call options - an optional abort signal.
   */
  async assignNfcCard(id: string, opts: AccessOfficialVisitorNfcCardAssign, call: AccessOfficialCallOptions = {}): Promise<void> {

    await this.#dispatch.command(officialEndpoint(this.#host, "/visitors/" + encodeURIComponent(id) + "/nfc_cards"), { json: opts, method: "PUT" }, call);
  }

  /**
   * Unassign an NFC card from a visitor. `PUT /visitors/:id/nfc_cards/delete`, permission `edit:visitor`.
   *
   * Documentation-derived.
   *
   * @param id    - The visitor's identifier.
   * @param token - The card's token.
   * @param call  - The per-call options - an optional abort signal.
   */
  async unassignNfcCard(id: string, token: string, call: AccessOfficialCallOptions = {}): Promise<void> {

    await this.#dispatch.command(officialEndpoint(this.#host, "/visitors/" + encodeURIComponent(id) + "/nfc_cards/delete"), { json: { token }, method: "PUT" }, call);
  }

  /**
   * Assign a PIN code to a visitor. `PUT /visitors/:id/pin_codes`, permission `edit:visitor`.
   *
   * Documentation-derived.
   *
   * @param id      - The visitor's identifier.
   * @param pinCode - The code, minted through the credentials domain.
   * @param call    - The per-call options - an optional abort signal.
   */
  async assignPinCode(id: string, pinCode: string, call: AccessOfficialCallOptions = {}): Promise<void> {

    await this.#dispatch.command(officialEndpoint(this.#host, "/visitors/" + encodeURIComponent(id) + "/pin_codes"),
      { json: { "pin_code": pinCode }, method: "PUT" }, call);
  }

  /**
   * Unassign a visitor's PIN code. `DELETE /visitors/:id/pin_codes`, permission `edit:visitor`.
   *
   * Documentation-derived.
   *
   * @param id   - The visitor's identifier.
   * @param call - The per-call options - an optional abort signal.
   */
  async unassignPinCode(id: string, call: AccessOfficialCallOptions = {}): Promise<void> {

    await this.#dispatch.command(officialEndpoint(this.#host, "/visitors/" + encodeURIComponent(id) + "/pin_codes"), { method: "DELETE" }, call);
  }

  /**
   * Issue a QR code to a visitor. `PUT /visitors/:id/qr_codes`, permission `edit:visitor`. Requires UniFi Access 3.3.10 or later.
   *
   * The endpoint takes no body - the visitor named in the path is the whole request. Download the resulting image through the credentials domain.
   *
   * Documentation-derived.
   *
   * @param id   - The visitor's identifier.
   * @param call - The per-call options - an optional abort signal.
   */
  async assignQrCode(id: string, call: AccessOfficialCallOptions = {}): Promise<void> {

    await this.#dispatch.command(officialEndpoint(this.#host, "/visitors/" + encodeURIComponent(id) + "/qr_codes"), { method: "PUT" }, call);
  }

  /**
   * Revoke a visitor's QR code. `DELETE /visitors/:id/qr_codes`, permission `edit:visitor`. Requires UniFi Access 3.3.10 or later.
   *
   * Documentation-derived.
   *
   * @param id   - The visitor's identifier.
   * @param call - The per-call options - an optional abort signal.
   */
  async unassignQrCode(id: string, call: AccessOfficialCallOptions = {}): Promise<void> {

    await this.#dispatch.command(officialEndpoint(this.#host, "/visitors/" + encodeURIComponent(id) + "/qr_codes"), { method: "DELETE" }, call);
  }

  /**
   * Set the license plates registered to a visitor. `PUT /visitors/:id/license_plates`, permission `edit:visitor`. Requires UniFi Access 3.3.10 or later.
   *
   * The body is the bare array of plate numbers, with no wrapper member around it.
   *
   * Documentation-derived.
   *
   * @param id     - The visitor's identifier.
   * @param plates - The plate numbers to register.
   * @param call   - The per-call options - an optional abort signal.
   */
  async assignLicensePlates(id: string, plates: readonly string[], call: AccessOfficialCallOptions = {}): Promise<void> {

    await this.#dispatch.command(officialEndpoint(this.#host, "/visitors/" + encodeURIComponent(id) + "/license_plates"), { json: plates, method: "PUT" }, call);
  }

  /**
   * Unregister one license plate from a visitor. `DELETE /visitors/:visitor_id/license_plates/:license_plate_id`, permission `edit:visitor`. Requires UniFi Access
   * 3.3.10 or later.
   *
   * Documentation-derived.
   *
   * @param visitorId      - The visitor's identifier.
   * @param licensePlateId - The plate's identifier, from the visitor's own record.
   * @param call           - The per-call options - an optional abort signal.
   */
  async unassignLicensePlate(visitorId: string, licensePlateId: string, call: AccessOfficialCallOptions = {}): Promise<void> {

    await this.#dispatch.command(officialEndpoint(this.#host, "/visitors/" + encodeURIComponent(visitorId) + "/license_plates/" +
      encodeURIComponent(licensePlateId)), { method: "DELETE" }, call);
  }
}

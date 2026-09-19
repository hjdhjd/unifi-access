/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * credentials.ts: The official API's credential domain - PIN codes, NFC cards and their enrollment sessions, Touch Passes, and visitor QR codes.
 */
import type { AccessOfficialCallOptions, AccessOfficialFileUpload, AccessOfficialResult, OfficialDispatch, OfficialDomainOptions } from "./dispatch.ts";
import { officialEndpoint, officialPageQuery } from "./endpoints.ts";
import type { AccessOfficialPageOptions } from "./endpoints.ts";
import type { Nullable } from "../types/index.ts";
import { officialPages } from "./pages.ts";

/**
 * A license plate registered as a credential.
 *
 * This is the one declaration of the shape in the library: users and visitors both carry it, and both type-import it from here because a license plate is a
 * credential rather than a property of whoever holds it.
 *
 * Documentation-derived.
 *
 * @category Official
 */
export interface AccessOfficialLicensePlate {

  readonly credential: string;
  readonly credential_status: "active" | "deactivate" | (string & {});
  readonly credential_type: "license" | (string & {});
  readonly id: string;
}

/**
 * An NFC card as a holder's own record names it - the handle and the card type, rather than the full card record.
 *
 * Users and visitors both carry this, and both type-import it from here, because a card is a credential rather than a property of whoever holds it.
 *
 * Live-verified.
 *
 * @category Official
 */
export interface AccessOfficialNfcCardRef {

  readonly id: string;
  readonly token: string;
  readonly type: "ua_card" | (string & {});
}

/**
 * The PIN code assigned to a holder, as their record names it. The code itself is never echoed - only the token that stands for it.
 *
 * Documentation-derived.
 *
 * @category Official
 */
export interface AccessOfficialPinCodeRef {

  readonly token: string;
}

/**
 * Whoever an NFC card is assigned to, as the card record names them.
 *
 * Live-verified.
 *
 * @category Official
 */
export interface AccessOfficialNfcCardUser {

  readonly avatar: string;
  readonly first_name: string;
  readonly id: string;
  readonly last_name: string;
  readonly name: string;
}

/**
 * An NFC card known to the controller.
 *
 * Live-verified. `nfc_id` and `note` are on the wire and in no documented schema for this record - `nfc_id` is the card's own printed identifier, where `token` is
 * the controller's handle for it and the value every assignment endpoint takes.
 *
 * @category Official
 */
export interface AccessOfficialNfcCard {

  readonly alias: string;
  readonly card_type: string;
  readonly display_id: string;
  readonly nfc_id: string;
  readonly note: string;
  readonly status: "assigned" | "deleted" | "disable" | "loss" | "pending" | (string & {});
  readonly token: string;
  readonly user: AccessOfficialNfcCardUser;
  readonly user_id: string;
  readonly user_type: "USER" | "VISITOR" | (string & {});
}

/**
 * The reader session opened to enroll an NFC card.
 *
 * Documentation-derived.
 *
 * @category Official
 */
export interface AccessOfficialNfcEnrollmentSession {

  readonly session_id: string;
}

/**
 * What a reader has read so far in an enrollment session. The token is what the assignment endpoints take once a card has been presented.
 *
 * Documentation-derived.
 *
 * @category Official
 */
export interface AccessOfficialNfcEnrollmentStatus {

  readonly card_id: string;
  readonly token: string;
}

/**
 * One device a Touch Pass has been provisioned onto.
 *
 * Documentation-derived.
 *
 * @category Official
 */
export interface AccessOfficialTouchPassBundle {

  readonly bundle_id: string;
  readonly bundle_status: "ACTIVE" | "SUSPENDED" | (string & {});
  readonly device_id: string;
  readonly device_name: string;
  readonly device_type: number;
  readonly source: "apple" | "google" | (string & {});
}

/**
 * A Touch Pass: a credential provisioned onto a phone or watch rather than carried as a card.
 *
 * The `user_*` members are empty strings when the pass is unassigned, which is the wire's own way of saying so - they are carried exactly as sent rather than
 * translated to `null`, because a consumer reaching past this library to the same endpoint would see the empty strings and expect them to agree.
 *
 * `activated_at` and `expired_at` are optional because the list endpoint omits them; the detail endpoint reports them. Live-verified.
 *
 * @category Official
 */
export interface AccessOfficialTouchPass {

  readonly activated_at?: unknown;
  readonly bundles: readonly AccessOfficialTouchPassBundle[];
  readonly card_id: string;
  readonly card_name: string;
  readonly expired_at?: unknown;
  readonly id: string;
  readonly last_activity: Nullable<string>;
  readonly status: "ACTIVE" | "EXPIRED" | "INACTIVE" | "PENDING" | "SUSPENDED" | (string & {});
  readonly user_avatar: string;
  readonly user_email: string;
  readonly user_id: string;
  readonly user_name: string;
  readonly user_status: "ACTIVE" | "PENDING" | "UNLINK" | (string & {});
}

/**
 * The outcome of one row of an NFC card import.
 *
 * An empty `token` is the wire's own marker that this row failed - the controller reports the whole import as a success and marks the individual rows, so a caller
 * that only checked the envelope would believe every row landed. The value is carried as the wire sent it rather than translated into an error.
 *
 * Documentation-derived.
 *
 * @category Official
 */
export interface AccessOfficialNfcCardImportResult {

  readonly alias: string;
  readonly nfc_id: string;
  readonly token: string;
}

/**
 * Open an NFC enrollment session on a reader.
 *
 * @category Official
 */
export interface AccessOfficialNfcCardEnroll {

  device_id: string;
  reset_ua_card?: boolean;
}

/**
 * Update an NFC card's alias.
 *
 * @category Official
 */
export interface AccessOfficialNfcCardUpdate {

  alias?: string;
}

/**
 * Detach one device from a Touch Pass.
 *
 * @category Official
 */
export interface AccessOfficialTouchPassBundleUpdate {

  bundle_id: string;
  bundle_status: "DISABLED";
}

/**
 * Update a Touch Pass: rename it, change its status, or unbundle devices from it.
 *
 * @category Official
 */
export interface AccessOfficialTouchPassUpdate {

  bundles?: readonly AccessOfficialTouchPassBundleUpdate[];
  card_name?: string;
  status?: "ACTIVE" | "SUSPENDED";
}

/**
 * List Touch Passes, optionally narrowed to one status.
 *
 * @category Official
 */
export interface AccessOfficialTouchPassListOptions extends AccessOfficialPageOptions {

  status?: "ACTIVE" | "INACTIVE" | "PENDING" | "SUSPENDED";
}

/**
 * The official API's credential domain: PIN codes, NFC cards and the reader sessions that enroll them, Touch Passes, and visitor QR codes.
 */
export class OfficialCredentials {

  readonly #dispatch: OfficialDispatch;
  readonly #host: string;

  constructor(options: OfficialDomainOptions) {

    this.#dispatch = options.dispatch;
    this.#host = options.host;
  }

  /**
   * Mint a PIN code. `POST /credentials/pin_codes`, permission `view:credential`.
   *
   * The code is minted, not assigned - hand it to a user or visitor through their own PIN assignment endpoint to put it into service.
   *
   * Live-verified.
   *
   * @param call - The per-call options - an optional abort signal.
   *
   * @returns The minted PIN code.
   */
  async generatePinCode(call: AccessOfficialCallOptions = {}): Promise<string> {

    return (await this.#dispatch.request<string>(officialEndpoint(this.#host, "/credentials/pin_codes"), { method: "POST" }, call)).data;
  }

  /**
   * Wake a reader and open a session to enroll an NFC card. `POST /credentials/nfc_cards/sessions`, permission `edit:credential`.
   *
   * The session identifier is the caller's to hold: it is the only handle to the reader session, so losing it leaves the session to expire on the controller's own
   * terms rather than being releasable. {@link OfficialCredentials.cancelNfcEnrollment} is the clean release.
   *
   * Documentation-derived.
   *
   * @param opts - The reader to wake, and whether to reset a card already enrolled at another site.
   * @param call - The per-call options - an optional abort signal.
   *
   * @returns The session identifier.
   */
  async enrollNfcCard(opts: AccessOfficialNfcCardEnroll, call: AccessOfficialCallOptions = {}): Promise<AccessOfficialNfcEnrollmentSession> {

    return (await this.#dispatch.request<AccessOfficialNfcEnrollmentSession>(officialEndpoint(this.#host, "/credentials/nfc_cards/sessions"),
      { json: opts, method: "POST" }, call)).data;
  }

  /**
   * Read what a reader has captured in an enrollment session. `GET /credentials/nfc_cards/sessions/:id`, permission `edit:credential`.
   *
   * Documentation-derived.
   *
   * @param sessionId - The session identifier.
   * @param call      - The per-call options - an optional abort signal.
   *
   * @returns The card's token and identifier.
   */
  async fetchNfcEnrollmentStatus(sessionId: string, call: AccessOfficialCallOptions = {}): Promise<AccessOfficialNfcEnrollmentStatus> {

    return (await this.#dispatch.request<AccessOfficialNfcEnrollmentStatus>(officialEndpoint(this.#host,
      "/credentials/nfc_cards/sessions/" + encodeURIComponent(sessionId)), {}, call)).data;
  }

  /**
   * Close an NFC enrollment session. `DELETE /credentials/nfc_cards/sessions/:id`, permission `edit:credential`.
   *
   * Documentation-derived.
   *
   * @param sessionId - The session identifier.
   * @param call      - The per-call options - an optional abort signal.
   */
  async cancelNfcEnrollment(sessionId: string, call: AccessOfficialCallOptions = {}): Promise<void> {

    await this.#dispatch.command(officialEndpoint(this.#host, "/credentials/nfc_cards/sessions/" + encodeURIComponent(sessionId)), { method: "DELETE" }, call);
  }

  /**
   * Fetch one NFC card. `GET /credentials/nfc_cards/tokens/:token`, permission `view:credential`. Requires UniFi Access 1.22.16 or later.
   *
   * Documentation-derived.
   *
   * @param token - The card's token.
   * @param call  - The per-call options - an optional abort signal.
   *
   * @returns The card.
   */
  async fetchNfcCard(token: string, call: AccessOfficialCallOptions = {}): Promise<AccessOfficialNfcCard> {

    return (await this.#dispatch.request<AccessOfficialNfcCard>(officialEndpoint(this.#host,
      "/credentials/nfc_cards/tokens/" + encodeURIComponent(token)), {}, call)).data;
  }

  /**
   * Fetch a page of NFC cards. `GET /credentials/nfc_cards/tokens`, permission `view:credential`. Requires UniFi Access 1.22.16 or later.
   *
   * Live-verified.
   *
   * @param opts - The page to fetch.
   * @param call - The per-call options - an optional abort signal.
   *
   * @returns The page of cards, and the pagination describing it.
   */
  async fetchAllNfcCards(opts: AccessOfficialPageOptions = {}, call: AccessOfficialCallOptions = {}): Promise<AccessOfficialResult<AccessOfficialNfcCard[]>> {

    return this.#dispatch.request<AccessOfficialNfcCard[]>(officialEndpoint(this.#host, "/credentials/nfc_cards/tokens", officialPageQuery(opts)), {}, call);
  }

  /**
   * Iterate every NFC card, walking the listing to its end. `GET /credentials/nfc_cards/tokens`, permission `view:credential`. Requires UniFi Access 1.22.16 or
   * later.
   *
   * Composed over {@link OfficialCredentials.fetchAllNfcCards}; the endpoint is live-verified.
   *
   * @param opts - The page size to walk the listing in.
   * @param call - The per-call options - an optional abort signal.
   *
   * @returns Every card the listing reports, in the order its pages carry them.
   */
  async *iterateNfcCards(opts: AccessOfficialPageOptions = {}, call: AccessOfficialCallOptions = {}): AsyncGenerator<AccessOfficialNfcCard> {

    yield* officialPages((page) => this.fetchAllNfcCards(page, call), opts);
  }

  /**
   * Delete an NFC card. `DELETE /credentials/nfc_cards/tokens/:token`, permission `edit:credential`. Requires UniFi Access 1.22.16 or later.
   *
   * Documentation-derived.
   *
   * @param token - The card's token.
   * @param call  - The per-call options - an optional abort signal.
   */
  async deleteNfcCard(token: string, call: AccessOfficialCallOptions = {}): Promise<void> {

    await this.#dispatch.command(officialEndpoint(this.#host, "/credentials/nfc_cards/tokens/" + encodeURIComponent(token)), { method: "DELETE" }, call);
  }

  /**
   * Rename an NFC card. `PUT /credentials/nfc_cards/tokens/:token`, permission `edit:credential`. Requires UniFi Access 3.1.30 or later.
   *
   * Documentation-derived.
   *
   * @param token - The card's token.
   * @param opts  - The members to change.
   * @param call  - The per-call options - an optional abort signal.
   */
  async updateNfcCard(token: string, opts: AccessOfficialNfcCardUpdate, call: AccessOfficialCallOptions = {}): Promise<void> {

    await this.#dispatch.command(officialEndpoint(this.#host, "/credentials/nfc_cards/tokens/" + encodeURIComponent(token)), { json: opts, method: "PUT" }, call);
  }

  /**
   * Fetch a page of Touch Passes. `GET /credentials/touch_passes`, permission `view:credential`. Requires UniFi Access 3.2.20 or later.
   *
   * Live-verified.
   *
   * @param opts - The page to fetch, and the status to narrow to.
   * @param call - The per-call options - an optional abort signal.
   *
   * @returns The page of passes, and the pagination describing it.
   */
  async fetchAllTouchPasses(opts: AccessOfficialTouchPassListOptions = {},
    call: AccessOfficialCallOptions = {}): Promise<AccessOfficialResult<AccessOfficialTouchPass[]>> {

    return this.#dispatch.request<AccessOfficialTouchPass[]>(officialEndpoint(this.#host, "/credentials/touch_passes",
      { ...officialPageQuery(opts), "status": opts.status }), {}, call);
  }

  /**
   * Iterate every Touch Pass, walking the listing to its end. `GET /credentials/touch_passes`, permission `view:credential`. Requires UniFi Access 3.2.20 or later.
   *
   * Composed over {@link OfficialCredentials.fetchAllTouchPasses}; the endpoint is live-verified.
   *
   * @param opts - The status to narrow to, and the page size to walk the listing in.
   * @param call - The per-call options - an optional abort signal.
   *
   * @returns Every pass the listing reports, in the order its pages carry them.
   */
  async *iterateTouchPasses(opts: AccessOfficialTouchPassListOptions = {}, call: AccessOfficialCallOptions = {}): AsyncGenerator<AccessOfficialTouchPass> {

    yield* officialPages((page) => this.fetchAllTouchPasses({ ...opts, ...page }, call), opts);
  }

  /**
   * Search Touch Passes by card identifier or holder name. `GET /credentials/touch_passes/search`, permission `view:credential`. Requires UniFi Access 3.2.20 or
   * later.
   *
   * Documentation-derived.
   *
   * @param condition - The card identifier or user name to match.
   * @param call      - The per-call options - an optional abort signal.
   *
   * @returns The matching passes.
   */
  async searchTouchPasses(condition: string, call: AccessOfficialCallOptions = {}): Promise<AccessOfficialTouchPass[]> {

    return (await this.#dispatch.request<AccessOfficialTouchPass[]>(officialEndpoint(this.#host, "/credentials/touch_passes/search", { condition }), {}, call)).data;
  }

  /**
   * Fetch every Touch Pass that can be reassigned - the suspended and inactive ones. `GET /credentials/touch_passes/assignable`, permission `view:credential`.
   * Requires UniFi Access 3.2.20 or later.
   *
   * Documentation-derived.
   *
   * @param call - The per-call options - an optional abort signal.
   *
   * @returns The assignable passes.
   */
  async fetchAssignableTouchPasses(call: AccessOfficialCallOptions = {}): Promise<AccessOfficialTouchPass[]> {

    return (await this.#dispatch.request<AccessOfficialTouchPass[]>(officialEndpoint(this.#host, "/credentials/touch_passes/assignable"), {}, call)).data;
  }

  /**
   * Update a Touch Pass. `PUT /credentials/touch_passes/:id`, permission `edit:credential`. Requires UniFi Access 3.2.20 or later.
   *
   * Documentation-derived.
   *
   * @param id   - The pass's identifier.
   * @param opts - The members to change.
   * @param call - The per-call options - an optional abort signal.
   *
   * @returns The updated pass.
   */
  async updateTouchPass(id: string, opts: AccessOfficialTouchPassUpdate, call: AccessOfficialCallOptions = {}): Promise<AccessOfficialTouchPass> {

    return (await this.#dispatch.request<AccessOfficialTouchPass>(officialEndpoint(this.#host, "/credentials/touch_passes/" + encodeURIComponent(id)),
      { json: opts, method: "PUT" }, call)).data;
  }

  /**
   * Fetch one Touch Pass in full. `GET /credentials/touch_passes/:id`, permission `view:credential`. Requires UniFi Access 3.2.20 or later.
   *
   * Documentation-derived.
   *
   * @param id   - The pass's identifier.
   * @param call - The per-call options - an optional abort signal.
   *
   * @returns The pass.
   */
  async fetchTouchPass(id: string, call: AccessOfficialCallOptions = {}): Promise<AccessOfficialTouchPass> {

    return (await this.#dispatch.request<AccessOfficialTouchPass>(officialEndpoint(this.#host, "/credentials/touch_passes/" + encodeURIComponent(id)), {}, call)).data;
  }

  /**
   * Purchase Touch Passes. `POST /credentials/touch_passes`, permission `edit:credential`. Requires UniFi Access 3.2.20 or later.
   *
   * This spends money: the controller requires a payment method configured in the Access web application before it will accept the request.
   *
   * Documentation-derived, and deliberately never exercised against a live controller for the reason above - so the shape here is the reference's, unconfirmed by
   * any capture.
   *
   * @param count - How many passes to purchase.
   * @param call  - The per-call options - an optional abort signal.
   *
   * @returns The purchased pass.
   */
  async purchaseTouchPasses(count: number, call: AccessOfficialCallOptions = {}): Promise<AccessOfficialTouchPass> {

    return (await this.#dispatch.request<AccessOfficialTouchPass>(officialEndpoint(this.#host, "/credentials/touch_passes"),
      { json: { count }, method: "POST" }, call)).data;
  }

  /**
   * Download a visitor's QR code as an image. `GET /credentials/qr_codes/download/:visitor_id`, permission `view:credential`. Requires UniFi Access 3.3.10 or
   * later.
   *
   * Documentation-derived.
   *
   * @param visitorId - The visitor whose code to download.
   * @param call      - The per-call options - an optional abort signal.
   *
   * @returns The image bytes.
   */
  async downloadQrCode(visitorId: string, call: AccessOfficialCallOptions = {}): Promise<Buffer> {

    return this.#dispatch.download(officialEndpoint(this.#host, "/credentials/qr_codes/download/" + encodeURIComponent(visitorId)), {}, call);
  }

  /**
   * Import third-party NFC cards from a CSV. `POST /credentials/nfc_cards/import`, permission `edit:credential`. Requires UniFi Access 3.3.10 or later.
   *
   * The file is a CSV of `NFC_ID,alias` rows, where the identifiers are uppercase hex and each alias must be unique - a duplicate alias fails that row. The
   * envelope reports the import as a success either way, and each returned row carries an empty `token` when that row failed.
   *
   * Documentation-derived.
   *
   * @param opts - The CSV bytes and the name to send them under.
   * @param call - The per-call options - an optional abort signal.
   *
   * @returns One result per row of the file.
   */
  async importNfcCards(opts: AccessOfficialFileUpload, call: AccessOfficialCallOptions = {}): Promise<AccessOfficialNfcCardImportResult[]> {

    return (await this.#dispatch.request<AccessOfficialNfcCardImportResult[]>(officialEndpoint(this.#host, "/credentials/nfc_cards/import"),
      { form: [{ data: opts.data, field: "file", filename: opts.filename }], method: "POST" }, call)).data;
  }
}

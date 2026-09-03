/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * logs.ts: The official API's system-log domain - the searchable activity record, its CSV export, and the media each entry can point at.
 */
import type { AccessOfficialCallOptions, AccessOfficialResult, OfficialDispatch, OfficialDomainOptions } from "./dispatch.ts";
import { officialEndpoint, officialPageQuery } from "./endpoints.ts";
import type { AccessOfficialPageOptions } from "./endpoints.ts";
import type { Nullable } from "../types/index.ts";

/**
 * The activity categories a log query can ask for.
 *
 * @category Official
 */
export type AccessOfficialSystemLogTopic = "admin_activity" | "critical" | "device_events" | "door_openings" | "updates" | "visitor";

/**
 * Who a log entry attributes its event to.
 *
 * Live-verified.
 *
 * @category Official
 */
export interface AccessOfficialSystemLogActor {

  readonly alternate_id: string;
  readonly alternate_name: string;
  readonly display_name: string;
  readonly id: string;
  readonly type: string;
}

/**
 * How the credential behind a log entry was presented. Null on an entry that involved no authentication at all, such as a device reboot.
 *
 * `credential_provider` speaks the same vocabulary an unlock's authentication type does and reads through {@link ACCESS_AUTHENTICATION_TYPES} when the value is
 * being shown to a person. This channel delivers the uppercase spelling, so the lookup needs no case folding.
 *
 * Live-verified.
 *
 * @category Official
 */
export interface AccessOfficialSystemLogAuthentication {

  readonly credential_provider: string;
  readonly issuer: string;
}

/**
 * What happened, as a log entry describes it.
 *
 * `log_key` is the finest-grained name for the event - `access.door.unlock.success.remote.user` where `type` says only `access.door.unlock` - so it is what to
 * branch on when the outcome matters. Both it and `log_category` are on the wire and in no documented schema.
 *
 * Live-verified.
 *
 * @category Official
 */
export interface AccessOfficialSystemLogEvent {

  readonly display_message: string;
  readonly event: string;
  readonly level: number;
  readonly log_category: string;
  readonly log_key: string;
  readonly published: number;
  readonly reason: string;
  readonly result: string;
  readonly type: string;
}

/**
 * One thing a log entry concerns - a device, a door, a floor, a building, or a piece of the request's own context.
 *
 * The `type` vocabulary is wider than the reference's examples: the wire also sends entries typed `reason_code`, `three_button_method`, `user_status`, and
 * `device_config`, which are request context rather than physical things, so a consumer selects the entry it wants by `type` rather than by position.
 *
 * Live-verified.
 *
 * @category Official
 */
export interface AccessOfficialSystemLogTarget {

  readonly alternate_id: string;
  readonly alternate_name: string;
  readonly display_name: string;
  readonly id: string;
  readonly type: string;
}

/**
 * The body of one log entry.
 *
 * Live-verified.
 *
 * @category Official
 */
export interface AccessOfficialSystemLogSource {

  readonly actor: AccessOfficialSystemLogActor;
  readonly authentication: Nullable<AccessOfficialSystemLogAuthentication>;
  readonly event: AccessOfficialSystemLogEvent;
  readonly target: readonly AccessOfficialSystemLogTarget[];
}

/**
 * One log entry, in the search-result envelope the controller wraps each in.
 *
 * Live-verified.
 *
 * @category Official
 */
export interface AccessOfficialSystemLogHit {

  readonly "@timestamp": string;
  readonly _id: string;
  readonly _source: AccessOfficialSystemLogSource;
  readonly tag: string;
}

/**
 * A page of log entries.
 *
 * The pagination is NOT in here - it rides at the top level of the envelope, exactly as it does on every other paginated endpoint, and reaches the caller beside
 * this payload. The reference documents page counters inside the payload instead, which the wire does not do.
 *
 * Live-verified.
 *
 * @category Official
 */
export interface AccessOfficialSystemLogHits {

  readonly hits: readonly AccessOfficialSystemLogHit[];
}

/**
 * A media resource a log entry points at.
 *
 * Documentation-derived, and unexercised: no capture in hand contains one, so the member types here follow the reference's naming and this API's own conventions
 * rather than an observation.
 *
 * @category Official
 */
export interface AccessOfficialSystemLogResource {

  readonly created_at: number;
  readonly updated_at: number;
  readonly video_record: string;
  readonly video_record_thumbnail: string;
}

/**
 * Query the system log. `since` and `until` are unix epoch seconds.
 *
 * @category Official
 */
export interface AccessOfficialSystemLogFetchOptions extends AccessOfficialPageOptions {

  actor_id?: string;
  since?: number;
  topic: AccessOfficialSystemLogTopic;
  until?: number;
}

/**
 * Export the system log as CSV. The window between `since` and `until` cannot exceed one month, and `timezone` is an IANA zone name such as `America/New_York`.
 *
 * @category Official
 */
export interface AccessOfficialSystemLogExportOptions {

  actor_id?: string;
  since: number;
  timezone: string;
  topic: AccessOfficialSystemLogTopic;
  until: number;
}

/**
 * The official API's system-log domain: the searchable activity record, its CSV export, and the media entries can point at.
 */
export class OfficialSystemLogs {

  readonly #dispatch: OfficialDispatch;
  readonly #host: string;

  constructor(options: OfficialDomainOptions) {

    this.#dispatch = options.dispatch;
    this.#host = options.host;
  }

  /**
   * Fetch a page of log entries. `POST /system/logs`, permission `view:system_log`.
   *
   * The verb is POST because the query rides a body, but this is a read: repeating it returns the same page rather than doing anything twice, so it opts back in
   * to the transparent retry that the surface's genuinely-minting POSTs opt out of.
   *
   * The pagination rides the query string while the filter rides the body, which is the endpoint's own split rather than this library's.
   *
   * Live-verified.
   *
   * @param opts - The topic to query, the window to query it over, and the page to fetch.
   * @param call - The per-call options - an optional abort signal.
   *
   * @returns The page of entries, and the pagination describing it.
   */
  async fetch(opts: AccessOfficialSystemLogFetchOptions, call: AccessOfficialCallOptions = {}): Promise<AccessOfficialResult<AccessOfficialSystemLogHits>> {

    return this.#dispatch.request<AccessOfficialSystemLogHits>(officialEndpoint(this.#host, "/system/logs", officialPageQuery(opts)),
      { json: { "actor_id": opts.actor_id, "since": opts.since, "topic": opts.topic, "until": opts.until }, method: "POST", retry: true }, call);
  }

  /**
   * Export log entries as CSV. `POST /system/logs/export`, permission `view:system_log`. Requires UniFi Access 1.20.11 or later.
   *
   * Documentation-derived.
   *
   * @param opts - The topic, the window, and the timezone to render timestamps in.
   * @param call - The per-call options - an optional abort signal.
   *
   * @returns The CSV bytes.
   */
  async export(opts: AccessOfficialSystemLogExportOptions, call: AccessOfficialCallOptions = {}): Promise<Buffer> {

    return this.#dispatch.download(officialEndpoint(this.#host, "/system/logs/export"), { json: opts, method: "POST" }, call);
  }

  /**
   * Fetch the media a log entry points at. `GET /system/logs/resource/:id`, permission `view:system_log`. Requires UniFi Access 1.24.6 or later.
   *
   * The identifier comes from a log entry's target typed `activities_resource`.
   *
   * Documentation-derived.
   *
   * @param id   - The resource's identifier.
   * @param call - The per-call options - an optional abort signal.
   *
   * @returns Where the recording and its thumbnail live.
   */
  async fetchResource(id: string, call: AccessOfficialCallOptions = {}): Promise<AccessOfficialSystemLogResource> {

    return (await this.#dispatch.request<AccessOfficialSystemLogResource>(officialEndpoint(this.#host,
      "/system/logs/resource/" + encodeURIComponent(id)), {}, call)).data;
  }

  /**
   * Fetch a static resource by its own path. `GET /system/static/:path`, permission `view:system_log`. Requires UniFi Access 1.24.6 or later.
   *
   * The parameter is a wire path rather than an identifier - `avatar/<id>`, `activities_resource/video/<file>.jpg` - taken verbatim from a log record. It is
   * therefore interpolated without escaping, because its slashes are path structure the controller expects, not characters to encode.
   *
   * Documentation-derived.
   *
   * @param path - The resource path, exactly as a log record spelled it.
   * @param call - The per-call options - an optional abort signal.
   *
   * @returns The resource bytes.
   */
  async fetchStaticResource(path: string, call: AccessOfficialCallOptions = {}): Promise<Buffer> {

    return this.#dispatch.download(officialEndpoint(this.#host, "/system/static/" + path), {}, call);
  }
}

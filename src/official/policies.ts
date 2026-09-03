/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * policies.ts: The official API's access policies, holiday groups, and schedules - the three resources that compose a door-access grant.
 */
import type { AccessOfficialCallOptions, OfficialDispatch, OfficialDomainOptions } from "./dispatch.ts";
import { officialEndpoint } from "./endpoints.ts";

/**
 * One access window within a day: the wire's `HH:MM:SS` strings, inclusive of the start and exclusive of nothing the reference documents.
 *
 * Documentation-derived: the reference's own schedule samples spell these as plain time strings rather than timestamps.
 *
 * @category Official
 */
export interface AccessOfficialScheduleWindow {

  readonly end_time: string;
  readonly start_time: string;
}

/**
 * The weekly access pattern, keyed by the lowercase English day names the wire spells.
 *
 * A day's empty array means no access that day, which is why every day is present rather than optional: an absent key and a closed day would otherwise be the same
 * document, and the reference's samples spell all seven.
 *
 * The wire requires all seven too. A map naming only some of the days is refused outright with the controller's own system-error code rather than being read as a
 * schedule with the unnamed days closed, so the seven required members here are what the endpoint actually accepts rather than a convention this library imposes.
 *
 * This is the one declaration of the weekday map in the library - the visitor schedule carries the identical shape and type-imports it rather than restating it.
 *
 * Live-verified.
 *
 * @category Official
 */
export interface AccessOfficialWeekSchedule {

  readonly friday: readonly AccessOfficialScheduleWindow[];
  readonly monday: readonly AccessOfficialScheduleWindow[];
  readonly saturday: readonly AccessOfficialScheduleWindow[];
  readonly sunday: readonly AccessOfficialScheduleWindow[];
  readonly thursday: readonly AccessOfficialScheduleWindow[];
  readonly tuesday: readonly AccessOfficialScheduleWindow[];
  readonly wednesday: readonly AccessOfficialScheduleWindow[];
}

/**
 * A door or door group an access policy grants entry to.
 *
 * `type` carries the documented pair widened with the open arm, because the reference's published vocabularies have repeatedly understated the wire - a value this
 * library has not seen reaches the caller intact rather than becoming unrepresentable.
 *
 * Live-verified.
 *
 * @category Official
 */
export interface AccessOfficialAccessPolicyResource {

  readonly id: string;
  readonly type: "door" | "door_group" | (string & {});
}

/**
 * An access policy: a named grant joining a set of door resources to a schedule.
 *
 * Live-verified.
 *
 * @category Official
 */
export interface AccessOfficialAccessPolicy {

  readonly id: string;
  readonly name: string;
  readonly resources: readonly AccessOfficialAccessPolicyResource[];
  readonly schedule_id: string;
}

/**
 * The resource reference a policy request names. Closed over the documented pair: a caller composes a request from the documented set, so a misspelling is a
 * compile error rather than a request the controller silently refuses.
 *
 * @category Official
 */
export interface AccessOfficialAccessPolicyResourceRef {

  id: string;
  type: "door" | "door_group";
}

/**
 * Create an access policy.
 *
 * The wire member is the singular `resource` even though it carries an array, which is the reference's own spelling rather than a transcription slip.
 *
 * @category Official
 */
export interface AccessOfficialAccessPolicyCreate {

  name: string;
  resource?: readonly AccessOfficialAccessPolicyResourceRef[];
  schedule_id: string;
}

/**
 * Update an access policy. Every member is optional - the endpoint is a partial update, and an omitted member is left as it stands.
 *
 * @category Official
 */
export interface AccessOfficialAccessPolicyUpdate {

  name?: string;
  resource?: readonly AccessOfficialAccessPolicyResourceRef[];
  schedule_id?: string;
}

/**
 * One holiday within a holiday group.
 *
 * The timestamps are RFC3339 in requests and render without the `T` separator in responses (`2023-08-26 00:00:00Z`), so they are carried as plain strings rather
 * than as a format this library would have to normalize in one direction and un-normalize in the other.
 *
 * Documentation-derived.
 *
 * @category Official
 */
export interface AccessOfficialHoliday {

  readonly description: string;
  readonly end_time: string;
  readonly id: string;
  readonly is_template?: boolean;
  readonly name: string;
  readonly repeat: boolean;
  readonly start_time: string;
}

/**
 * A holiday group in full, as the detail and write endpoints return it.
 *
 * The list endpoint answers a different, narrower shape - see {@link AccessOfficialHolidayGroupSummary} - so the two are distinct types rather than one type with
 * everything optional, which would let a caller read a member the endpoint it called never sends.
 *
 * Documentation-derived.
 *
 * @category Official
 */
export interface AccessOfficialHolidayGroup {

  readonly description: string;
  readonly holidays: readonly AccessOfficialHoliday[];
  readonly id: string;
  readonly is_default: boolean;
  readonly name: string;
  readonly template_name?: string;
}

/**
 * A holiday group as the list endpoint summarizes it: the holiday count in place of the holidays themselves.
 *
 * Live-verified. `is_private` is on the wire and in no documented schema for this endpoint.
 *
 * @category Official
 */
export interface AccessOfficialHolidayGroupSummary {

  readonly count: number;
  readonly description: string;
  readonly id: string;
  readonly is_default: boolean;
  readonly is_private: boolean;
  readonly name: string;
}

/**
 * One holiday as a write request names it. An entry carrying no `id` is added; an entry carrying one updates the holiday it names.
 *
 * @category Official
 */
export interface AccessOfficialHolidayCreate {

  description?: string;
  end_time: string;
  id?: string;
  is_template?: boolean;
  name: string;
  repeat?: boolean;
  start_time: string;
}

/**
 * Create a holiday group.
 *
 * @category Official
 */
export interface AccessOfficialHolidayGroupCreate {

  description?: string;
  holidays?: readonly AccessOfficialHolidayCreate[];
  name: string;
}

/**
 * Update a holiday group. `holidays` is omitted when the set is not being changed.
 *
 * @category Official
 */
export interface AccessOfficialHolidayGroupUpdate {

  description?: string;
  holidays?: readonly AccessOfficialHolidayCreate[];
  name: string;
}

/**
 * A schedule: the weekly access pattern a policy grants on, plus the holiday handling that overrides it.
 *
 * Only the six members the live list endpoint returns are unconditional. `weekly`, `holiday_group`, and `holiday_schedule` are optional because the list view is a
 * summary projection that omits all three - a caller reading them off a list entry gets `undefined` rather than a value the endpoint never sent.
 *
 * Live-verified. `status` is on the wire and in no documented schema.
 *
 * @category Official
 */
export interface AccessOfficialSchedule {

  readonly holiday_group?: AccessOfficialHolidayGroup;
  readonly holiday_group_id: string;
  readonly holiday_schedule?: readonly AccessOfficialScheduleWindow[];
  readonly id: string;
  readonly is_default: boolean;
  readonly name: string;
  readonly status: number;
  readonly type: "access" | (string & {});
  readonly weekly?: AccessOfficialWeekSchedule;
}

/**
 * Create a schedule. The name must be unique across the controller.
 *
 * @category Official
 */
export interface AccessOfficialScheduleCreate {

  holiday_group_id?: string;
  holiday_schedule?: readonly AccessOfficialScheduleWindow[];
  name: string;
  week_schedule: AccessOfficialWeekSchedule;
}

/**
 * Update a schedule. Every member is optional - the endpoint is a partial update.
 *
 * @category Official
 */
export interface AccessOfficialScheduleUpdate {

  holiday_group_id?: string;
  holiday_schedule?: readonly AccessOfficialScheduleWindow[];
  name?: string;
  week_schedule?: AccessOfficialWeekSchedule;
}

/**
 * The official API's access-policy domain: the policies themselves, the holiday groups a schedule observes, and the schedules a policy grants on.
 */
export class OfficialAccessPolicies {

  readonly #dispatch: OfficialDispatch;
  readonly #host: string;

  constructor(options: OfficialDomainOptions) {

    this.#dispatch = options.dispatch;
    this.#host = options.host;
  }

  /**
   * Create an access policy. `POST /access_policies`, permission `edit:policy`.
   *
   * Live-verified.
   *
   * @param opts - The policy to create.
   * @param call - The per-call options - an optional abort signal.
   *
   * @returns The created policy.
   */
  async create(opts: AccessOfficialAccessPolicyCreate, call: AccessOfficialCallOptions = {}): Promise<AccessOfficialAccessPolicy> {

    return (await this.#dispatch.request<AccessOfficialAccessPolicy>(officialEndpoint(this.#host, "/access_policies"), { json: opts, method: "POST" }, call)).data;
  }

  /**
   * Update an access policy. `PUT /access_policies/:id`, permission `edit:policy`.
   *
   * Documentation-derived.
   *
   * @param id   - The policy's identifier.
   * @param opts - The members to change; anything omitted is left as it stands.
   * @param call - The per-call options - an optional abort signal.
   *
   * @returns The updated policy.
   */
  async update(id: string, opts: AccessOfficialAccessPolicyUpdate, call: AccessOfficialCallOptions = {}): Promise<AccessOfficialAccessPolicy> {

    return (await this.#dispatch.request<AccessOfficialAccessPolicy>(officialEndpoint(this.#host, "/access_policies/" + encodeURIComponent(id)),
      { json: opts, method: "PUT" }, call)).data;
  }

  /**
   * Delete an access policy. `DELETE /access_policies/:id`, permission `edit:policy`.
   *
   * Live-verified.
   *
   * @param id   - The policy's identifier.
   * @param call - The per-call options - an optional abort signal.
   */
  async delete(id: string, call: AccessOfficialCallOptions = {}): Promise<void> {

    await this.#dispatch.command(officialEndpoint(this.#host, "/access_policies/" + encodeURIComponent(id)), { method: "DELETE" }, call);
  }

  /**
   * Fetch one access policy. `GET /access_policies/:id`, permission `view:policy`.
   *
   * Live-verified.
   *
   * @param id   - The policy's identifier.
   * @param call - The per-call options - an optional abort signal.
   *
   * @returns The policy.
   */
  async fetch(id: string, call: AccessOfficialCallOptions = {}): Promise<AccessOfficialAccessPolicy> {

    return (await this.#dispatch.request<AccessOfficialAccessPolicy>(officialEndpoint(this.#host, "/access_policies/" + encodeURIComponent(id)), {}, call)).data;
  }

  /**
   * Fetch every access policy. `GET /access_policies`, permission `view:policy`.
   *
   * Live-verified.
   *
   * @param call - The per-call options - an optional abort signal.
   *
   * @returns Every policy on the controller.
   */
  async fetchAll(call: AccessOfficialCallOptions = {}): Promise<AccessOfficialAccessPolicy[]> {

    return (await this.#dispatch.request<AccessOfficialAccessPolicy[]>(officialEndpoint(this.#host, "/access_policies"), {}, call)).data;
  }

  /**
   * Create a holiday group. `POST /access_policies/holiday_groups`, permission `edit:policy`.
   *
   * Documentation-derived.
   *
   * @param opts - The group to create.
   * @param call - The per-call options - an optional abort signal.
   *
   * @returns The created group.
   */
  async createHolidayGroup(opts: AccessOfficialHolidayGroupCreate, call: AccessOfficialCallOptions = {}): Promise<AccessOfficialHolidayGroup> {

    return (await this.#dispatch.request<AccessOfficialHolidayGroup>(officialEndpoint(this.#host, "/access_policies/holiday_groups"),
      { json: opts, method: "POST" }, call)).data;
  }

  /**
   * Update a holiday group. `PUT /access_policies/holiday_groups/:id`, permission `edit:policy`.
   *
   * Documentation-derived.
   *
   * @param id   - The group's identifier.
   * @param opts - The members to change. Omitting `holidays` leaves the group's holidays as they stand.
   * @param call - The per-call options - an optional abort signal.
   *
   * @returns The updated group.
   */
  async updateHolidayGroup(id: string, opts: AccessOfficialHolidayGroupUpdate, call: AccessOfficialCallOptions = {}): Promise<AccessOfficialHolidayGroup> {

    return (await this.#dispatch.request<AccessOfficialHolidayGroup>(officialEndpoint(this.#host,
      "/access_policies/holiday_groups/" + encodeURIComponent(id)), { json: opts, method: "PUT" }, call)).data;
  }

  /**
   * Delete a holiday group. `DELETE /access_policies/holiday_groups/:id`, permission `edit:policy`.
   *
   * Documentation-derived.
   *
   * @param id   - The group's identifier.
   * @param call - The per-call options - an optional abort signal.
   */
  async deleteHolidayGroup(id: string, call: AccessOfficialCallOptions = {}): Promise<void> {

    await this.#dispatch.command(officialEndpoint(this.#host, "/access_policies/holiday_groups/" + encodeURIComponent(id)), { method: "DELETE" }, call);
  }

  /**
   * Fetch one holiday group in full. `GET /access_policies/holiday_groups/:id`, permission `view:policy`.
   *
   * Documentation-derived.
   *
   * @param id   - The group's identifier.
   * @param call - The per-call options - an optional abort signal.
   *
   * @returns The group, with its holidays.
   */
  async fetchHolidayGroup(id: string, call: AccessOfficialCallOptions = {}): Promise<AccessOfficialHolidayGroup> {

    return (await this.#dispatch.request<AccessOfficialHolidayGroup>(officialEndpoint(this.#host,
      "/access_policies/holiday_groups/" + encodeURIComponent(id)), {}, call)).data;
  }

  /**
   * Fetch every holiday group, as summaries. `GET /access_policies/holiday_groups`, permission `view:policy`.
   *
   * The list view reports each group's holiday count rather than its holidays; {@link OfficialAccessPolicies.fetchHolidayGroup} returns them.
   *
   * Live-verified.
   *
   * @param call - The per-call options - an optional abort signal.
   *
   * @returns Every holiday group on the controller.
   */
  async fetchAllHolidayGroups(call: AccessOfficialCallOptions = {}): Promise<AccessOfficialHolidayGroupSummary[]> {

    return (await this.#dispatch.request<AccessOfficialHolidayGroupSummary[]>(officialEndpoint(this.#host, "/access_policies/holiday_groups"), {}, call)).data;
  }

  /**
   * Create a schedule. `POST /access_policies/schedules`, permission `edit:policy`. The nested `holiday_schedule` member requires UniFi Access 1.20.11 or later.
   *
   * The week schedule must name all seven days. A map carrying only some of them is refused with the controller's own system-error code rather than being taken as
   * a schedule with the rest closed, which is why {@link AccessOfficialWeekSchedule} requires every day and an unwanted day is sent as an empty array.
   *
   * Live-verified.
   *
   * @param opts - The schedule to create.
   * @param call - The per-call options - an optional abort signal.
   *
   * @returns The created schedule.
   */
  async createSchedule(opts: AccessOfficialScheduleCreate, call: AccessOfficialCallOptions = {}): Promise<AccessOfficialSchedule> {

    return (await this.#dispatch.request<AccessOfficialSchedule>(officialEndpoint(this.#host, "/access_policies/schedules"),
      { json: opts, method: "POST" }, call)).data;
  }

  /**
   * Update a schedule. `PUT /access_policies/schedules/:id`, permission `edit:policy`.
   *
   * Documentation-derived.
   *
   * @param id   - The schedule's identifier.
   * @param opts - The members to change; anything omitted is left as it stands.
   * @param call - The per-call options - an optional abort signal.
   */
  async updateSchedule(id: string, opts: AccessOfficialScheduleUpdate, call: AccessOfficialCallOptions = {}): Promise<void> {

    await this.#dispatch.command(officialEndpoint(this.#host, "/access_policies/schedules/" + encodeURIComponent(id)), { json: opts, method: "PUT" }, call);
  }

  /**
   * Fetch one schedule. `GET /access_policies/schedules/:id`, permission `view:policy`.
   *
   * Live-verified.
   *
   * @param id   - The schedule's identifier.
   * @param call - The per-call options - an optional abort signal.
   *
   * @returns The schedule.
   */
  async fetchSchedule(id: string, call: AccessOfficialCallOptions = {}): Promise<AccessOfficialSchedule> {

    return (await this.#dispatch.request<AccessOfficialSchedule>(officialEndpoint(this.#host, "/access_policies/schedules/" + encodeURIComponent(id)), {}, call)).data;
  }

  /**
   * Fetch every schedule. `GET /access_policies/schedules`, permission `view:policy`.
   *
   * The list view is a summary projection: it omits `weekly`, `holiday_group`, and `holiday_schedule` on every entry.
   *
   * Live-verified.
   *
   * @param call - The per-call options - an optional abort signal.
   *
   * @returns Every schedule on the controller.
   */
  async fetchAllSchedules(call: AccessOfficialCallOptions = {}): Promise<AccessOfficialSchedule[]> {

    return (await this.#dispatch.request<AccessOfficialSchedule[]>(officialEndpoint(this.#host, "/access_policies/schedules"), {}, call)).data;
  }

  /**
   * Delete a schedule. `DELETE /access_policies/schedules/:id`, permission `edit:policy`.
   *
   * Live-verified.
   *
   * @param id   - The schedule's identifier.
   * @param call - The per-call options - an optional abort signal.
   */
  async deleteSchedule(id: string, call: AccessOfficialCallOptions = {}): Promise<void> {

    await this.#dispatch.command(officialEndpoint(this.#host, "/access_policies/schedules/" + encodeURIComponent(id)), { method: "DELETE" }, call);
  }
}

/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * spaces.ts: The official API's spaces domain - the door topology, door groups, and the unlock, lock-rule, and emergency controls on the doors themselves.
 */
import type { AccessOfficialCallOptions, OfficialDispatch, OfficialDomainOptions } from "./dispatch.ts";
import type { AccessKnownJsonValue } from "../types/index.ts";
import { officialEndpoint } from "./endpoints.ts";

/**
 * A door within the topology, as the floor above it lists it.
 *
 * Live-verified.
 *
 * @category Official
 */
export interface AccessOfficialTopologyResource {

  readonly id: string;
  readonly is_bind_hub?: boolean;
  readonly name: string;
  readonly type: "door" | (string & {});
}

/**
 * A floor within the topology, and the doors on it.
 *
 * Live-verified.
 *
 * @category Official
 */
export interface AccessOfficialResourceTopology {

  readonly id: string;
  readonly is_bind_hub?: boolean;
  readonly name: string;
  readonly resources: readonly AccessOfficialTopologyResource[];
  readonly type: "floor" | (string & {});
}

/**
 * A door group as the topology describes it, with the floors and doors beneath it.
 *
 * The `building` group is the controller's own all-doors group; an `access` group is one somebody created.
 *
 * Live-verified.
 *
 * @category Official
 */
export interface AccessOfficialDoorGroupTopology {

  readonly id?: string;
  readonly name: string;
  readonly resource_topologies: readonly AccessOfficialResourceTopology[];
  readonly type: "access" | "building" | (string & {});
}

/**
 * A door within a door group. The group's detail read names each door; its list and write reads report only the identifier and kind.
 *
 * Documentation-derived.
 *
 * @category Official
 */
export interface AccessOfficialDoorGroupResource {

  readonly id: string;
  readonly name?: string;
  readonly type: "door" | "door_group" | (string & {});
}

/**
 * A door group: a named set of doors an access policy can grant against as a unit.
 *
 * `type` is reported by the read endpoints and omitted by the write ones, which echo only what they changed.
 *
 * Live-verified.
 *
 * @category Official
 */
export interface AccessOfficialDoorGroup {

  readonly id: string;
  readonly name: string;
  readonly resources: readonly AccessOfficialDoorGroupResource[];
  readonly type?: "access" | "building" | (string & {});
}

/**
 * A door.
 *
 * `door_position_status` reports whether the door is physically open. Its vocabulary has already grown once past what the reference publishes - the wire answers
 * the string `"none"` on a hub whose position sensor is not wired, where the documentation describes `null` for that case - so both are carried, alongside the open
 * arm.
 *
 * `extras` is where a UA Hub reports its door's position, under the `uah-input_state_dps` and `uah-wiring_state_dps` members. It is optional because the carriers
 * differ: a UA Hub populates it, a UA Hub Door Mini and a UA Ultra send an empty object, and some responses omit it entirely. An empty or absent `extras`
 * therefore says nothing about whether the door has a position sensor - a UA Hub Door Mini reports the same condition on its device record instead.
 *
 * Live-verified.
 *
 * @category Official
 */
export interface AccessOfficialDoor {

  readonly door_lock_relay_status: "lock" | "unlock" | (string & {});
  readonly door_position_status: "close" | "none" | "open" | (string & {}) | null;
  readonly extras?: Readonly<Record<string, AccessKnownJsonValue>>;
  readonly floor_id: string;
  readonly full_name: string;
  readonly id: string;
  readonly is_bind_hub: boolean;
  readonly name: string;
  readonly type: "door" | (string & {});
}

/**
 * The temporary locking rule in force on a door, and when it ends.
 *
 * An idle door answers with an empty `type` and an `ended_time` of zero. That state names no rule and appears in no documented vocabulary, so it is carried
 * explicitly: a caller testing for it reads the empty string rather than inferring it from a value the reference never described.
 *
 * Live-verified.
 *
 * @category Official
 */
export interface AccessOfficialLockRule {

  readonly ended_time: number;
  readonly type: "" | "custom" | "keep_lock" | "keep_unlock" | "lock_early" | "schedule" | (string & {});
}

/**
 * Which site-wide emergency modes are in force.
 *
 * The read shape is the wire's own pair of flags. Whether a controller can report both at once is not something the documentation settles, so the read transcribes
 * what arrives rather than foreclosing a state it might send - the write side is where the contradiction is made unrepresentable.
 *
 * Live-verified.
 *
 * @category Official
 */
export interface AccessOfficialEmergencyStatus {

  readonly evacuation: boolean;
  readonly lockdown: boolean;
}

/**
 * Create a door group. The name must be unique across the controller, and the resources are door identifiers from the topology.
 *
 * @category Official
 */
export interface AccessOfficialDoorGroupCreate {

  group_name: string;
  resources: readonly string[];
}

/**
 * Update a door group. Every member is optional - the endpoint is a partial update. An empty `resources` array empties the group.
 *
 * @category Official
 */
export interface AccessOfficialDoorGroupUpdate {

  group_name?: string;
  resources?: readonly string[];
}

/**
 * Who to attribute an unlock to. Both members are required together: the reference documents each as required whenever the other is supplied, so pairing them in
 * one object makes that structural rather than a rule a caller has to remember.
 *
 * @category Official
 */
export interface AccessOfficialDoorUnlockActor {

  id: string;
  name: string;
}

/**
 * Which direction a driveway gate is being entered, for a double-driveway gate that reads its two approaches separately. `in` is the approach toward the property
 * and `out` is the approach away from it.
 *
 * @category Official
 */
export type AccessOfficialDoorEntryMethod = "in" | "out";

/**
 * Unlock a door.
 *
 * With no actor supplied the controller attributes the unlock to the API token's own name, so supplying one is what makes an automation legible in the logs and
 * webhook deliveries as the automation rather than as the account it authenticated with. `extra` is echoed back verbatim on the webhook delivery.
 *
 * `controlCmd` applies to a UA Hub Gate in three-button mode and `entryMethod` to a double-driveway gate; both require UniFi Access 4.2.16 or later, and the actor
 * and extra members require 3.3.21 or later.
 *
 * @category Official
 */
export interface AccessOfficialDoorUnlockOptions {

  actor?: AccessOfficialDoorUnlockActor;
  controlCmd?: "close" | "open" | "stop";
  entryMethod?: AccessOfficialDoorEntryMethod;
  extra?: Readonly<Record<string, AccessKnownJsonValue>>;
  readerId?: string;
}

/**
 * The temporary locking rule to put on a door.
 *
 * `interval` belongs to the `custom` rule alone, which is why this is a union rather than one shape with an optional member: a duration on any other rule would be
 * silently ignored, and here it cannot be written at all.
 *
 * @category Official
 */
export type AccessOfficialLockRuleSet = { interval: number; type: "custom" } | { type: "keep_lock" | "keep_unlock" | "lock_early" | "lock_now" | "reset" };

/**
 * Which site-wide emergency mode to put in force. `normal` restores both flags to off.
 *
 * @category Official
 */
export type AccessOfficialEmergencyState = "evacuation" | "lockdown" | "normal";

/**
 * The official API's spaces domain: the door topology, the door groups composed from it, and the unlock, lock-rule, and emergency controls on the doors.
 */
export class OfficialSpaces {

  readonly #dispatch: OfficialDispatch;
  readonly #host: string;

  constructor(options: OfficialDomainOptions) {

    this.#dispatch = options.dispatch;
    this.#host = options.host;
  }

  /**
   * Fetch the whole door topology - every group, the floors beneath it, and the doors on each. `GET /door_groups/topology`, permission `view:space`.
   *
   * Live-verified.
   *
   * @param call - The per-call options - an optional abort signal.
   *
   * @returns The topology.
   */
  async fetchTopology(call: AccessOfficialCallOptions = {}): Promise<AccessOfficialDoorGroupTopology[]> {

    return (await this.#dispatch.request<AccessOfficialDoorGroupTopology[]>(officialEndpoint(this.#host, "/door_groups/topology"), {}, call)).data;
  }

  /**
   * Create a door group. `POST /door_groups`, permission `edit:space`.
   *
   * Live-verified.
   *
   * @param opts - The group to create.
   * @param call - The per-call options - an optional abort signal.
   *
   * @returns The created group.
   */
  async createDoorGroup(opts: AccessOfficialDoorGroupCreate, call: AccessOfficialCallOptions = {}): Promise<AccessOfficialDoorGroup> {

    return (await this.#dispatch.request<AccessOfficialDoorGroup>(officialEndpoint(this.#host, "/door_groups"), { json: opts, method: "POST" }, call)).data;
  }

  /**
   * Fetch one door group. `GET /door_groups/:id`, permission `view:space`.
   *
   * Live-verified.
   *
   * @param id   - The group's identifier.
   * @param call - The per-call options - an optional abort signal.
   *
   * @returns The group, with each door named.
   */
  async fetchDoorGroup(id: string, call: AccessOfficialCallOptions = {}): Promise<AccessOfficialDoorGroup> {

    return (await this.#dispatch.request<AccessOfficialDoorGroup>(officialEndpoint(this.#host, "/door_groups/" + encodeURIComponent(id)), {}, call)).data;
  }

  /**
   * Update a door group. `PUT /door_groups/:id`, permission `edit:space`.
   *
   * Documentation-derived.
   *
   * @param id   - The group's identifier.
   * @param opts - The members to change. An empty `resources` array empties the group.
   * @param call - The per-call options - an optional abort signal.
   *
   * @returns The updated group.
   */
  async updateDoorGroup(id: string, opts: AccessOfficialDoorGroupUpdate, call: AccessOfficialCallOptions = {}): Promise<AccessOfficialDoorGroup> {

    return (await this.#dispatch.request<AccessOfficialDoorGroup>(officialEndpoint(this.#host, "/door_groups/" + encodeURIComponent(id)),
      { json: opts, method: "PUT" }, call)).data;
  }

  /**
   * Fetch every door group. `GET /door_groups`, permission `view:space`.
   *
   * The controller's own all-doors `building` group never appears here - the documentation says so and the wire agrees. Read it from the topology instead.
   *
   * Live-verified.
   *
   * @param call - The per-call options - an optional abort signal.
   *
   * @returns Every created door group.
   */
  async fetchAllDoorGroups(call: AccessOfficialCallOptions = {}): Promise<AccessOfficialDoorGroup[]> {

    return (await this.#dispatch.request<AccessOfficialDoorGroup[]>(officialEndpoint(this.#host, "/door_groups"), {}, call)).data;
  }

  /**
   * Delete a door group. `DELETE /door_groups/:id`, permission `edit:space`.
   *
   * Live-verified.
   *
   * @param id   - The group's identifier.
   * @param call - The per-call options - an optional abort signal.
   */
  async deleteDoorGroup(id: string, call: AccessOfficialCallOptions = {}): Promise<void> {

    await this.#dispatch.command(officialEndpoint(this.#host, "/door_groups/" + encodeURIComponent(id)), { method: "DELETE" }, call);
  }

  /**
   * Fetch one door. `GET /doors/:id`, permission `view:space`.
   *
   * Live-verified.
   *
   * @param id   - The door's identifier.
   * @param call - The per-call options - an optional abort signal.
   *
   * @returns The door.
   */
  async fetch(id: string, call: AccessOfficialCallOptions = {}): Promise<AccessOfficialDoor> {

    return (await this.#dispatch.request<AccessOfficialDoor>(officialEndpoint(this.#host, "/doors/" + encodeURIComponent(id)), {}, call)).data;
  }

  /**
   * Fetch every door. `GET /doors`, permission `view:space`.
   *
   * Live-verified.
   *
   * @param call - The per-call options - an optional abort signal.
   *
   * @returns Every door on the controller.
   */
  async fetchAll(call: AccessOfficialCallOptions = {}): Promise<AccessOfficialDoor[]> {

    return (await this.#dispatch.request<AccessOfficialDoor[]>(officialEndpoint(this.#host, "/doors"), {}, call)).data;
  }

  /**
   * Unlock a door. `PUT /doors/:id/unlock`, permission `edit:space`.
   *
   * This request is never retried. It fires a relay once rather than asserting a state, so a transparent re-send after a transient status could re-open a door
   * somebody had already closed behind them - and the caller seeing the transient error is the safer outcome.
   *
   * Live-verified.
   *
   * @param id   - The door's identifier.
   * @param opts - Who to attribute the unlock to, what to echo onto the webhook delivery, and the gate-specific controls.
   * @param call - The per-call options - an optional abort signal.
   */
  async unlock(id: string, opts: AccessOfficialDoorUnlockOptions = {}, call: AccessOfficialCallOptions = {}): Promise<void> {

    await this.#dispatch.command(officialEndpoint(this.#host, "/doors/" + encodeURIComponent(id) + "/unlock", { "control_cmd": opts.controlCmd,
      "entry_method": opts.entryMethod, "reader_id": opts.readerId }), { json: { ...((opts.actor !== undefined) && { "actor_id": opts.actor.id,
      "actor_name": opts.actor.name }), ...((opts.extra !== undefined) && { "extra": opts.extra }) }, method: "PUT", retry: false }, call);
  }

  /**
   * Put a temporary locking rule on a door. `PUT /doors/:id/lock_rule`, permission `edit:space`. Requires UniFi Access 1.24.6 or later.
   *
   * A `custom` rule's `interval` is in MINUTES, which is the unit both the wire and the reference speak - a value of 2 holds the relay for two minutes. `reset`
   * restores an unlock schedule to its original state, `lock_early` locks before a scheduled unlock window ends, and `lock_now` ends the schedule and any
   * temporary unlock together.
   *
   * Documentation-derived.
   *
   * @param id   - The door's identifier.
   * @param rule - The rule to put in force.
   * @param call - The per-call options - an optional abort signal.
   */
  async setLockRule(id: string, rule: AccessOfficialLockRuleSet, call: AccessOfficialCallOptions = {}): Promise<void> {

    await this.#dispatch.command(officialEndpoint(this.#host, "/doors/" + encodeURIComponent(id) + "/lock_rule"), { json: rule, method: "PUT" }, call);
  }

  /**
   * Read the temporary locking rule in force on a door. `GET /doors/:id/lock_rule`, permission `view:space`. Requires UniFi Access 1.24.6 or later.
   *
   * Live-verified.
   *
   * @param id   - The door's identifier.
   * @param call - The per-call options - an optional abort signal.
   *
   * @returns The rule, or the idle state's empty `type` with a zero `ended_time`.
   */
  async fetchLockRule(id: string, call: AccessOfficialCallOptions = {}): Promise<AccessOfficialLockRule> {

    return (await this.#dispatch.request<AccessOfficialLockRule>(officialEndpoint(this.#host, "/doors/" + encodeURIComponent(id) + "/lock_rule"), {}, call)).data;
  }

  /**
   * Put a site-wide emergency mode in force. `PUT /doors/settings/emergency`, permission `edit:space`. Requires UniFi Access 1.24.6 or later.
   *
   * This applies to every door at once, not to one. Every state maps onto the wire's two flags, and both flags are always sent: sending only the one that changed would
   * leave the other's prior value ambiguous, and taking one state rather than two flags makes the contradictory both-in-force request impossible to compose.
   *
   * Documentation-derived.
   *
   * @param state - The mode to put in force; `normal` clears both.
   * @param call  - The per-call options - an optional abort signal.
   */
  async setEmergency(state: AccessOfficialEmergencyState, call: AccessOfficialCallOptions = {}): Promise<void> {

    await this.#dispatch.command(officialEndpoint(this.#host, "/doors/settings/emergency"),
      { json: { "evacuation": state === "evacuation", "lockdown": state === "lockdown" }, method: "PUT" }, call);
  }

  /**
   * Read which site-wide emergency modes are in force. `GET /doors/settings/emergency`, permission `view:space`. Requires UniFi Access 1.24.6 or later.
   *
   * Live-verified.
   *
   * @param call - The per-call options - an optional abort signal.
   *
   * @returns The emergency flags.
   */
  async fetchEmergency(call: AccessOfficialCallOptions = {}): Promise<AccessOfficialEmergencyStatus> {

    return (await this.#dispatch.request<AccessOfficialEmergencyStatus>(officialEndpoint(this.#host, "/doors/settings/emergency"), {}, call)).data;
  }
}

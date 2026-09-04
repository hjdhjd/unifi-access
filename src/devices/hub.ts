/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * hub.ts: The hub projection - the door commands a hub-capable device drives, and the door state it reports.
 */
import type { AccessOfficialDoorEntryMethod, AccessOfficialDoorUnlockActor, AccessOfficialLockRuleSet } from "../official/spaces.ts";
import { locationUnlockEndpoint, lockRuleEndpoint } from "./endpoints.ts";
import { AccessDevice } from "./device.ts";
import type { AccessDoorStateEntry } from "../types/index.ts";
import type { AccessStateDoor } from "../protocol/reducer.ts";
import { selectDoorStates } from "../state/selectors.ts";

// The extension that binds a hub port to the door it drives. A hub records which door each of its ports serves under this name, and the door identity is the
// extension's target.
const PORT_EXTENSION = "port_setting";

// What a refused door command says. The three commands share it because they share the check that raises it, and a refusal reads the same whichever of them drew it.
const DOOR_COMMAND_REFUSED = "The UniFi Access controller refused the door command.";

// The lock rules the Access application's own endpoint can express. The rest of the vocabulary is reachable only through the official API, so a rule outside this
// set has no direct-path fallback to offer the routing decision.
const DIRECT_LOCK_RULES = new Set([ "custom", "keep_unlock", "reset" ]);

/**
 * The rule that governs how a door's lock behaves until something changes it.
 *
 * There is one lock-rule vocabulary on this controller and both of the library's channels speak it, so this names the official surface's own union rather than
 * restating it - two hand-maintained spellings of one wire vocabulary would drift the first time the controller gained a verb. Which verbs each path can carry
 * differs even though the vocabulary does not: `reset`, `keep_unlock`, and `custom` are expressible on the direct path, while `keep_lock`, `lock_early`, and
 * `lock_now` are reachable only through the official API.
 *
 * A `custom` rule's interval is in whole MINUTES, which is what both the wire and the reference speak - a value of 2 holds the door unlocked for two minutes. As a
 * union rather than one shape with a nullable duration, the combinations that have no meaning cannot be written at all: there is no way to ask for a `reset` with
 * an interval, and no way to reach the custom rule without supplying one.
 *
 * @category Devices
 */
export type AccessLockRule = AccessOfficialLockRuleSet;

/**
 * A hub-capable device, as a live projection carrying the commands that act on the door it drives.
 *
 * The distinction from {@link AccessDevice} is what the commands address. A device command targets the hardware; a hub's unlock and close target the *door*, which
 * is a separate resource on the controller. That is what lets one multi-port hub drive several doors independently: each port is bound to its own door, and the
 * registry mints a handle per port whose commands resolve to that port's door.
 *
 * Every command here is write-through, like every other command in the tier: the controller acts, and the projection reflects it once the realtime stream reports
 * the change.
 *
 * @category Devices
 */
export class AccessHub extends AccessDevice {

  /**
   * The door record this hub drives, as the census of the controller's doors carried it - its names above all, which is what a consumer naming this door in its own
   * output reads rather than reaching around the projection into the state snapshot for it. Reading it through the hub keeps a consumer from re-deriving which
   * door this hardware acts on, exactly as {@link AccessHub.doorState} does, and both getters resolve that door the same way - through {@link AccessHub.doorId},
   * which on hardware driving several doors answers with the first port binding its record carries.
   *
   * It is `undefined` where the state holds no record for the door, which is what a census that never carried the door looks like from here.
   *
   * @throws {ReferenceError} If the device is no longer present in the controller state.
   */
  get door(): AccessStateDoor | undefined {

    return this.ctx.store.snapshot().doors.get(this.doorId);
  }

  /**
   * The door's live state: what it last reported, or what its serving hardware was read to establish before it had reported anything.
   *
   * A door reached this way is `undefined` only when neither source had anything to say about it. The members are individually optional for the same reason, so a
   * reading established from hardware flags states what those flags proved and stays silent on the rest. Reading it through the hub is what keeps a consumer from
   * having to re-derive which door this hardware drives, which is a resolution the hub already owns.
   *
   * @throws {ReferenceError} If the device is no longer present in the controller state.
   */
  get doorState(): AccessDoorStateEntry | undefined {

    return selectDoorStates(this.ctx.store.snapshot()).get(this.doorId);
  }

  /**
   * Unlock the door this hub drives.
   *
   * **Which API carries this depends on the client and on what is asked.** A plain unlock takes the official path where one is available and the direct path otherwise,
   * which is the routing default; on a client holding both identities that means the controller attributes the unlock to the token's own identity rather than to the
   * credential account. Set `api` at connect to hold it to one channel.
   *
   * Supplying `actor` is what makes an automation legible in the controller's logs and webhook deliveries as the automation rather than as whatever it
   * authenticated with, and `entryMethod` is which of a double-driveway gate's two approaches the unlock is for. Only the official API can express either one, so
   * an unlock carrying one has no direct-path fallback and a client without a working official path refuses it rather than quietly dropping what it cannot say.
   *
   * On a token-only client this projection exists over the official inventory, and this unlock takes the official path - the only path such a client holds. So does its
   * `close`, which reaches that path as the gate control command.
   *
   * `doorId` is which door to unlock where the hardware drives more than one, and it defaults to the door this handle resolves for itself. Both paths address the
   * door rather than the hardware, so the target holds whichever one carries the unlock, and the id travels as given: the controller is the authority on what a
   * door id names, and nothing here checks it against the state first.
   *
   * @param opts - Who to attribute the unlock to, which door to unlock, which approach of a driveway gate it is for, and an optional abort signal.
   *
   * @throws {@link AccessCapabilityError} when no available path can carry the unlock as asked, {@link AccessRequestError} when the controller accepts the request
   *   but reports the unlock unsuccessful, the classified `FatalError` on a non-2xx, or a transport-level `AccessError` on failure.
   */
  async unlock(opts: { actor?: AccessOfficialDoorUnlockActor; doorId?: string; entryMethod?: AccessOfficialDoorEntryMethod; signal?: AbortSignal } = {}): Promise<void> {

    /* Every door-addressed command here resolves its target once and both expressions of that command read the one local: the routed request's door field and the
     * direct path's own URL. The handle's own door is read unconditionally because that read is the liveness check - a departed record fails loudly through it -
     * and a caller-supplied target must not be able to skip it.
     */
    const ownDoor = this.doorId;
    const doorId = opts.doorId ?? ownDoor;

    await this.ctx.routing.routedUnlock({

      ...((opts.actor !== undefined) && { actor: opts.actor }),
      deviceId: this.id,
      direct: async (): Promise<void> => this.#directUnlock(doorId, opts),
      doorId,
      ...((opts.entryMethod !== undefined) && { entryMethod: opts.entryMethod }),
      ...((opts.signal !== undefined) && { signal: opts.signal })
    });
  }

  /**
   * Close the door this hub drives, ending an unlock that is holding it open. This is the other half of the two-button surface a gate or a door with a held-open
   * unlock presents: `unlock` begins, this ends.
   *
   * The request deliberately carries no body at all, which is the field-proven shape for this command - the controller reads the command from the query parameter, and a
   * body is what distinguishes an unlock from a close on the same resource. The wire shape is proven from hardware rather than from a capture, so no recorded specimen
   * confirms it.
   *
   * **Which API carries this depends on the client.** Every client holding a direct path takes the hardware-proven command above. A client with none - one holding only
   * a token, or one held to the official API - reaches the published API's gate control command instead, which the reference documents for UA Hub Gate hardware in
   * three-button mode on UniFi Access 4.2.16 or later and no capture confirms on other door families.
   *
   * **Close belongs to gate hardware.** A door hub refuses the command on both APIs - field-verified against live hardware - which fits the functional split:
   * a gate has a close motion to command, and a door's lock does not. Ending a held-open unlock on a door hub is {@link AccessHub.setLockRule} with the
   * `reset` rule, which restores the door's own schedule.
   *
   * The door closed is this handle's own unless `doorId` names another, which is how the second door of a gate driving two is reached. Both paths take the target
   * as given - the direct command's own door resource and the official control command's door argument alike - because which doors exist is the controller's to
   * say rather than this library's.
   *
   * @param opts - Which door to close, and an optional abort signal.
   *
   * @throws {@link AccessCapabilityError} when the client holds no direct path and its official rail is absent, revoked, or refused for this device,
   *   {@link AccessRequestError} when the controller accepts the request but reports the close unsuccessful, the classified `FatalError` on a non-2xx, or a
   *   transport-level `AccessError` on failure.
   */
  async close(opts: { doorId?: string; signal?: AbortSignal } = {}): Promise<void> {

    const ownDoor = this.doorId;
    const doorId = opts.doorId ?? ownDoor;

    await this.ctx.routing.routedClose({

      deviceId: this.id,
      direct: async (): Promise<void> => {

        const response = await this.dispatch(locationUnlockEndpoint(this.ctx.host, doorId, "close"),
          { body: null, method: "PUT", ...((opts.signal !== undefined) && { signal: opts.signal }) });

        this.requireDomainSuccess(response, DOOR_COMMAND_REFUSED);
      },
      doorId,
      ...((opts.signal !== undefined) && { signal: opts.signal })
    });
  }

  /**
   * Halt this hub's gate mid-transition, leaving it where it stands rather than completing the travel it is running.
   *
   * The reference documents this command for UA Hub Gate hardware in three-button mode on UniFi Access 4.2.16 or later, and no capture confirms it, so what other
   * hardware makes of it is what field reports will establish. It is official-only: the Access application's own resource has no proven stop spelling, and this library
   * does not invent direct-API behavior, so a client with no working official path refuses rather than approximating.
   *
   * Which gate is halted is this handle's own door unless `doorId` picks out another of the doors the hardware drives.
   *
   * @param opts - Which door to halt, and an optional abort signal.
   *
   * @throws {@link AccessCapabilityError} when no available path can carry the stop, {@link AccessOfficialApiError} when the controller refuses it in its own
   *   vocabulary, the classified `FatalError` on a non-2xx, or a transport-level `AccessError` on failure.
   */
  async stop(opts: { doorId?: string; signal?: AbortSignal } = {}): Promise<void> {

    const ownDoor = this.doorId;
    const doorId = opts.doorId ?? ownDoor;

    await this.ctx.routing.routedStop({ deviceId: this.id, doorId, ...((opts.signal !== undefined) && { signal: opts.signal }) });
  }

  /**
   * Set the rule governing this hub's lock.
   *
   * **Which API carries this depends on the rule.** The official path serves every verb where one is available; the direct path serves the three the Access
   * application's own endpoint can express - `reset`, `keep_unlock`, and `custom`. The other three are official-only, so a client with no working official path
   * refuses them rather than approximating.
   *
   * **A rule can name the door it governs.** `doorId` defaults to this handle's own door, and a rule targeting any other door takes the official path alone: the Access
   * application's own rule resource is keyed by the device rather than by the door, so it can only ever govern the door that device resolves for itself. A client with
   * no working official path refuses such a rule rather than writing it to a door the caller did not ask for. A target that resolves to this handle's own door is the
   * same write the default is, and takes the direct path exactly as the default does.
   *
   * @param rule - The rule to establish. A `custom` rule's interval is a positive whole number of minutes.
   * @param opts - Which door the rule governs, and an optional abort signal.
   *
   * @throws {TypeError} If a custom rule's interval is not a positive whole number - caller misuse, raised before anything is sent.
   * @throws {@link AccessCapabilityError} when no available path can carry the rule, {@link AccessRequestError} when the controller accepts the request but reports
   *   the rule unsuccessful, the classified `FatalError` on a non-2xx, or a transport-level `AccessError` on failure.
   */
  async setLockRule(rule: AccessLockRule, opts: { doorId?: string; signal?: AbortSignal } = {}): Promise<void> {

    /* A caller's own bad argument is a programming error rather than anything the controller said, so it raises the language's own error type. The library's
     * request error is not appropriate here: it carries the status code the controller answered with, and there is no controller in this story - nothing has been
     * sent yet.
     */
    if((rule.type === "custom") && (!Number.isInteger(rule.interval) || (rule.interval <= 0))) {

      throw new TypeError("A custom lock rule's interval must be a positive whole number of minutes.");
    }

    const ownDoor = this.doorId;
    const doorId = opts.doorId ?? ownDoor;

    /* Whether the rule has a direct-path expression at all is decided here, where the direct endpoint's vocabulary is known, and carried to the routing decision as
     * the presence or absence of a fallback rather than as a flag it would have to interpret. The door the rule governs is the other half of that decision: the
     * direct rule resource is keyed by the device, so it governs the door that device resolves for itself and can say nothing about any other one. What is
     * compared is therefore the resolved doors rather than whether a target was supplied - a rule naming this handle's own door asks for exactly what the default
     * asks for and keeps its direct expression, while a rule naming a different door has no direct expression to offer.
     */
    const directExpressible = DIRECT_LOCK_RULES.has(rule.type) && (doorId === ownDoor);

    await this.ctx.routing.routedSetLockRule({

      deviceId: this.id,
      ...(directExpressible && { direct: async (): Promise<void> => {

        const response = await this.dispatch(lockRuleEndpoint(this.ctx.host, this.id),
          { body: rule, method: "PUT", ...((opts.signal !== undefined) && { signal: opts.signal }) });

        this.requireDomainSuccess(response, DOOR_COMMAND_REFUSED);
      } }),
      doorId,
      rule,
      ...((opts.signal !== undefined) && { signal: opts.signal })
    });
  }

  /**
   * The door this handle acts on - the identity its commands address and its {@link AccessHub.doorState} reads: the door bound to the hub's port when the record
   * carries that binding, and the device's own location otherwise.
   *
   * The two arms are the same rule seen from two directions. A whole multi-port hub records each port's door in its extensions, so the binding is where the door
   * identity lives. A synthesized per-port handle already *is* one port: the registry gives it that port's own location and no extensions at all, so the fallback
   * resolves it to its own door by construction rather than by a special case. Single-door hardware takes the same fallback for the same reason - its location is
   * its door. Publishing the resolution keeps it single-sourced: a consumer matching a topology door to the handle that drives it reads this rather than restating
   * the port-extension rule.
   *
   * Where a record carries several port bindings, the first of them as the controller delivered them is what this answers with. That ordering is the controller's
   * own and nothing here promises it will hold, so commanding a particular door of hardware that drives more than one is what the door commands' `doorId` target
   * is for.
   *
   * @throws {ReferenceError} If the device is no longer present in the controller state.
   */
  get doorId(): string {

    const config = this.config;

    return config.extensions?.find((extension) => extension.extension_name === PORT_EXTENSION)?.target_value ?? config.location_id;
  }

  // The unlock as the Access application's own endpoint expresses it, handed to the routing decision as the fallback it may or may not take. It lives here rather
  // than inline so that the routed method above reads as the routing it is. The door arrives as an argument because the verb resolves its target once for both
  // paths, and this is where the direct path spends that resolution.
  async #directUnlock(doorId: string, opts: { signal?: AbortSignal }): Promise<void> {

    const response = await this.dispatch(locationUnlockEndpoint(this.ctx.host, doorId),
      { method: "PUT", ...((opts.signal !== undefined) && { signal: opts.signal }) });

    this.requireDomainSuccess(response, DOOR_COMMAND_REFUSED);
  }

}

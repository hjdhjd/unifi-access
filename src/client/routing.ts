/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * routing.ts: The capability map a client derives at connect, and the routing service that decides which API carries each command.
 */

/**
 * Which of the controller's two APIs carries a given command, decided in one place.
 *
 * The library speaks to a controller two ways - the Access application's own endpoints behind a credential session, and the published API behind a bearer token -
 * and most door operations are expressible on either. Which one a command should take is not a question a command should answer for itself: the answer depends on
 * what this client was built with, on what the controller has since refused, and on the firmware of the device being addressed, and a per-command answer would
 * scatter all three across the surface and let them drift.
 *
 * So the decision lives here, split into the two things it actually is. The CAPABILITY MAP is a connect-time snapshot of what this client can do at all, published
 * to consumers as {@link AccessClient.capabilities}. The ROUTING SERVICE is the live decision, and it owns the two verdicts that can only be learned by trying: the
 * per-device firmware floor, and the session revocation that closes the official path the first time a routed command draws an Identity Enterprise controller's
 * report that it has no official API or, on a client with a direct path to fall back to, the token rejected or refused a permission. Keeping the snapshot and the
 * live verdicts apart is what lets the map be a stable, readable statement of the client's shape rather than something that mutates underfoot.
 *
 * @module AccessRouting
 */
import { AccessApiError, AccessCapabilityError, isIdentityRefusal, isPrivilegeRefusal } from "../errors.ts";
import type { AccessOfficialDoorEntryMethod, AccessOfficialDoorUnlockActor, AccessOfficialDoorUnlockOptions,
  AccessOfficialLockRuleSet } from "../official/spaces.ts";
import type { AccessLogging } from "../logging.ts";
import type { AccessOfficialCallOptions } from "../official/dispatch.ts";
import type { Nullable } from "../types/index.ts";
import type { StateReader } from "../devices/context.ts";
import { deviceDisplayName } from "../state/selectors.ts";

/* The official result codes that are capability verdicts rather than faults. Both arrive as ordinary refusals on the request path, and what makes them different is
 * that they describe what this controller or this device can do rather than what went wrong with the call - so they are caught here and folded into the routing
 * decision instead of reaching a consumer.
 */
const CODE_SESSION_REVOKED = "CODE_OTHERS_UID_ADOPTED_NOT_SUPPORTED";
const CODE_DEVICE_FLOOR = "CODE_DEVICE_API_NOT_SUPPORTED";

// What a type guard narrows its argument to, read off the guard itself, so a reading composed from other readings narrows to exactly what they do with nothing
// spelled a second time.
type NarrowedBy<Guard> = Guard extends (error: unknown) => error is infer Narrowed ? Narrowed : never;

/**
 * Whether a failure is the Identity Enterprise verdict: the controller answering that it has no official API at all. It is a fact about the controller rather than
 * about the request or the token, so the connect seed and the routing service both read it as the official path being unavailable for the client's life.
 *
 * @param error - The error value to classify.
 *
 * @returns `true` when the controller reported that it has no official API, narrowed to the error carrying that code; `false` for anything else.
 *
 * @category Client
 */
export function isOfficialApiAbsent(error: unknown): error is AccessApiError & { readonly code: typeof CODE_SESSION_REVOKED } {

  return (error instanceof AccessApiError) && (error.code === CODE_SESSION_REVOKED);
}

/**
 * Whether a failure the official surface answered is the controller refusing the token, in any spelling: rejecting it outright, or authenticating it and refusing
 * it a permission.
 *
 * Either class is read as a refusal of the token without asking which identity it names, because the official surface is assembled over the token session at the
 * composition root, so every refusal it answers is of the token. A token keeps the permissions it was issued with for its life, which makes a refused permission as
 * much a fact about the client as a rejected token is, and is why both readings fold the same way.
 *
 * @param error - The error value to classify.
 *
 * @returns `true` when the failure refuses the token, narrowed to what either reading narrows to; `false` for anything else.
 *
 * @category Client
 */
export function isTokenRefusal(error: unknown): error is NarrowedBy<typeof isIdentityRefusal> | NarrowedBy<typeof isPrivilegeRefusal> {

  return isIdentityRefusal(error) || isPrivilegeRefusal(error);
}

/**
 * Whether the Access application's own endpoints can carry a command for a client: it holds credentials, and it is not held to the official API. Each is a
 * connect-time fact, so the answer holds for the client's life, and reading it from one place is what keeps the connect seed, a close's choice of path, the routing
 * decision's fallback, and the fold of a refused token from disagreeing about whether a direct path exists.
 *
 * @param capabilities - The identities the client holds and the override in force.
 *
 * @returns `true` when the client has a direct path to take; `false` when it holds no credentials or is held to the official API.
 *
 * @category Client
 */
export function directPathServes(capabilities: Pick<AccessCapabilities, "mode" | "override">): boolean {

  return (capabilities.mode !== "token") && (capabilities.override !== "official-only");
}

/**
 * The warning that reports the official path closing: the refusal that closed it, as its caller words it, followed by what closing means for the client. A client
 * whose direct path serves takes that path for its commands; a client whose direct path does not has the commands only the official API can carry refused. Composing
 * both halves here is what lets the connect seed and the routing service report a closure in the same words.
 *
 * @param refusal      - The refusal that closed the path, as a complete sentence.
 * @param directServes - Whether the client's direct path can carry its commands.
 *
 * @returns The refusal followed by its consequence, as one message.
 *
 * @category Client
 */
export function officialPathClosureSentence(refusal: string, directServes: boolean): string {

  return refusal + " " + (directServes ? "This client's commands will use the Access application's own endpoints for the life of this connection." :
    "The commands only the official API can carry will be refused for the life of this connection.");
}

/**
 * Which identities a client holds, and therefore which of the controller's APIs it can reach.
 *
 * `credential` is a username and password alone, `token` is a bearer token alone, and `dual` is both. The mode follows from what was supplied at connect and never
 * changes for the life of the client.
 *
 * @category Client
 */
export type AccessApiMode = "credential" | "dual" | "token";

/**
 * Which API a routed command should prefer.
 *
 * `auto` is the default and the ordinary case: the official path where it is available and capable, the direct path otherwise. The two overrides exist for a consumer
 * that needs to know exactly which channel its commands take - to hold attribution to one identity, or to stay off a channel entirely - and they hold the client to a
 * channel rather than merely preferring one, so an operation that channel cannot express fails rather than quietly taking the other one.
 *
 * @category Client
 */
export type AccessApiOverride = "auto" | "direct-only" | "official-only";

/**
 * What a client can do, as established at connect.
 *
 * This is a SNAPSHOT rather than a live reading, and the distinction matters. `official` says the official path was present and working when the client connected -
 * a token was supplied, and the read that verifies it succeeded. It reads `false` on a client with no token, and on one whose connect folded that read's failure: a
 * client holding credentials whose controller answered as an Identity Enterprise deployment does, that it has no official API, or a client whose direct path can
 * serve and whose token the controller refused. It deliberately does not move afterward: an official path closed mid-life, whether by an Identity Enterprise
 * controller's report or by the token rejected or refused a permission on a client that can fall back to its credentials, or a device found to sit below a firmware
 * floor, changes what the routing service will attempt without rewriting the client's own description of itself. A consumer reading this is asking what kind of
 * client it holds, which is a question with a stable answer.
 *
 * @category Client
 */
export interface AccessCapabilities {

  readonly mode: AccessApiMode;
  readonly official: boolean;
  readonly override: AccessApiOverride;
}

/**
 * The operations a device projection may route, and the whole of what the devices tier can see of routing.
 *
 * The tier receives this rather than the official facade for the same reason it receives a read-only slice of the store: what it cannot reach, it cannot misuse.
 * A projection that held the facade could issue an official call outside the routing decision, and a projection that held the routing service could write to the
 * verdicts it keeps. This exposes the commands that route and nothing else.
 *
 * Each request carries its own direct-path expression as a callback, because the direct wire shape belongs to the devices tier that owns it - the service decides
 * WHICH path a command takes and never learns what the direct one puts on the wire.
 *
 * @category Client
 */
export interface AccessRoutingView {

  routedClose(request: AccessRoutedCloseRequest): Promise<void>;
  routedDirect(request: AccessRoutedDirectRequest): Promise<void>;
  routedSetLockRule(request: AccessRoutedLockRuleRequest): Promise<void>;
  routedStop(request: AccessRoutedStopRequest): Promise<void>;
  routedUnlock(request: AccessRoutedUnlockRequest): Promise<void>;
}

/**
 * One routed command that the Access application's own endpoints alone can carry: the device it addresses, how to issue it directly, and what to call it in a
 * refusal. A device restart and a device configuration write are each this shape - the published API models neither.
 *
 * Routing a command with exactly one path is the same decision every routed command faces: a client held to the official API refuses what that channel cannot carry, a
 * client holding no credentials has no direct path to take at all, and both are the one refusal every unroutable command gets, spoken in one vocabulary.
 *
 * @category Client
 */
export interface AccessRoutedDirectRequest {

  deviceId: string;
  direct: () => Promise<void>;
  operation: string;
  signal?: AbortSignal;
}

/**
 * One routed close: the door to close, the device that drives it, and how to close it directly.
 *
 * Which paths a close can take is the service's own knowledge rather than the caller's, so the shape carries only what the devices tier owns: the door, the device
 * driving it, and the direct expression of the command.
 *
 * @category Client
 */
export interface AccessRoutedCloseRequest {

  deviceId: string;
  direct: () => Promise<void>;
  doorId: string;
  signal?: AbortSignal;
}

/**
 * One routed stop: the mid-transition halt of a three-button gate, and the device driving the door it halts.
 *
 * There is no direct member because the direct resource has no proven stop spelling and this library never invents direct-API behavior.
 *
 * @category Client
 */
export interface AccessRoutedStopRequest {

  deviceId: string;
  doorId: string;
  signal?: AbortSignal;
}

/**
 * One routed unlock: the door to open, the device that drives it, and how to do it directly if that is the path chosen.
 *
 * `actor` is what makes an unlock legible in the controller's logs as the automation that acted rather than as the account it authenticated with. `entryMethod` is
 * the double-driveway gate's entry direction - which of two approaches this unlock is for. Only the official path can express either one, so supplying either is
 * what turns an ordinary unlock into one that requires that path.
 *
 * @category Client
 */
export interface AccessRoutedUnlockRequest {

  actor?: AccessOfficialDoorUnlockActor;
  deviceId: string;
  direct: () => Promise<void>;
  doorId: string;
  entryMethod?: AccessOfficialDoorEntryMethod;
  signal?: AbortSignal;
}

/**
 * One routed lock rule: the rule to put in force, the door it governs, the device that drives that door, and the direct-path expression when the rule has one.
 *
 * `direct` is optional because the rule vocabulary is wider than the direct path can express. The verbs the direct endpoint accepts supply a callback; the rest,
 * which only the official API carries, supply none, which is what makes "there is no direct fallback for this rule" a fact the type states rather than one the
 * service has to be told.
 *
 * @category Client
 */
export interface AccessRoutedLockRuleRequest {

  deviceId: string;
  direct?: () => Promise<void>;
  doorId: string;
  rule: AccessOfficialLockRuleSet;
  signal?: AbortSignal;
}

/**
 * The official surface the routing decision reaches: the two door commands it can route onto, and nothing else.
 *
 * Declared structurally rather than as the facade itself, on the same reasoning as every other narrow dependency in this library. The service cannot reach an
 * official endpoint it was not given a name for, so the type is what bounds what routing can do rather than a convention a reviewer has to check. The real facade
 * satisfies it as it stands.
 *
 * @category Client
 */
export interface AccessOfficialDoorSurface {

  readonly spaces: {

    setLockRule(id: string, rule: AccessOfficialLockRuleSet, call?: AccessOfficialCallOptions): Promise<void>;
    unlock(id: string, opts?: AccessOfficialDoorUnlockOptions, call?: AccessOfficialCallOptions): Promise<void>;
  };
}

/**
 * Construction options for {@link AccessRoutingService}: the connect-time map, the logger that reports the official path closing, the official surface when there
 * is one, and the state to read device firmware from.
 */
export interface AccessRoutingServiceOptions {

  capabilities: AccessCapabilities;
  log: AccessLogging;
  official: Nullable<AccessOfficialDoorSurface>;
  store: StateReader;
}

/* Which command a routing decision carries, as the floor memo files it. The memo remembers a refusal against the command as well as the device, so this is the
 * name a recorded refusal is filed under.
 */
type RoutedCommandKind = "close" | "lockRule" | "stop" | "unlock";

/* A command with no official half: it carries its direct expression and neither an official one nor a kind to file a refusal under. The door is the one a door
 * command addressed and is absent for a device command, which is how a refusal knows whether to name a door or the device.
 */
interface RoutedDirectOperation {

  deviceId: string;
  direct: () => Promise<void>;
  doorId?: string;
  kind?: undefined;
  official?: undefined;
  operation: string;
}

/* A command with an official half: it carries that half and, required beside it, the kind a refusal is remembered against. Pairing the two in one shape is what
 * makes an official half supplied without its kind fail to compile rather than reach the memo as a blank key. The door is required on the same terms: every
 * command with an official half is a door command, and a refusal names the door it was aimed at, so a half supplied without its door fails to compile rather
 * than refuse without naming a target.
 */
interface RoutedOfficialOperation {

  deviceId: string;
  direct?: () => Promise<void>;
  doorId: string;
  kind: RoutedCommandKind;
  official: (official: AccessOfficialDoorSurface) => Promise<void>;
  operation: string;
}

/* One routing decision, in either shape a command can have: with an official half offered, or without. */
type RoutedOperation = RoutedDirectOperation | RoutedOfficialOperation;

/**
 * The live routing decision, built once at the composition root.
 *
 * Two verdicts can only be learned by trying, and both live here because here is where the refusals that teach them are caught.
 *
 * **The per-command firmware floor.** Some official endpoints require firmware newer than a given device runs, and some are for hardware a given device is not -
 * a gate control command reaching an ordinary door hub - and the controller reports both the same way, by refusing the call. A refusal is therefore remembered
 * against the command, the device id, AND the firmware that device was running when it was refused, because a refusal proves exactly what was asked and nothing
 * more: a gate command one hub declines says nothing about that hub's unlocks. An upgraded device is a different key and its stale verdict is simply never
 * consulted again, so there is no subscription to firmware changes and no code that clears anything: the memo invalidates itself by construction, and it dies
 * with the client. A device the state holds no firmware for keys on the empty string, which never matches a real firmware string - so on a token client, whose
 * projections carry no firmware at all, a recorded refusal holds for that client's life and a fresh connect is what re-derives it.
 *
 * **The session revocation.** An Identity Enterprise controller has no official API at all, and reports that as a refusal on the first routed call that reaches it.
 * A controller can also refuse the token on a routed call after accepting it at connect, rejecting it outright or refusing it a permission, and on a client with a
 * direct path to fall back to, either refusal closes the official path the same way; a client with nowhere else to go keeps the refusal as the error it arrived as,
 * because the token is then the one thing to fix. Once seen, it holds for this client's life - a revocation does not un-revoke partway through - so it is latched
 * rather than re-probed on every command, and a fresh connect is what re-derives it.
 *
 * Both verdicts govern ROUTED commands only. A consumer calling the facade directly gets that channel's own typed errors, which is that channel's contract and not
 * something this should reach into.
 *
 * @category Client
 */
export class AccessRoutingService implements AccessRoutingView {

  readonly #capabilities: AccessCapabilities;
  // A command and device that were floor-refused, keyed as the command's kind and the device id together, mapped to the firmware that device was running at the
  // refusal. Filing it against the command as well is what keeps one command's refusal from speaking for another's, and a device whose current firmware differs
  // from its recorded one is not refused, so an upgrade re-opens the official path with no invalidation step of its own. The key ends at the device because that is
  // as far as the refusals themselves reach: a code such as `CODE_DEVICE_API_NOT_SUPPORTED` speaks about the device and names no door, so filing one by door would
  // claim a distinction the wire never drew.
  readonly #floorRefusals = new Map<string, string>();
  readonly #log: AccessLogging;
  readonly #official: Nullable<AccessOfficialDoorSurface>;
  // Latched on the first Identity Enterprise refusal, or the first time the token is rejected or refused a permission where the direct path can carry the command
  // instead, and never cleared, because nothing within one client's life makes it false again.
  #revoked = false;
  readonly #store: StateReader;

  constructor(options: AccessRoutingServiceOptions) {

    this.#capabilities = options.capabilities;
    this.#log = options.log;
    this.#official = options.official;
    this.#store = options.store;
  }

  /**
   * Unlock a door on whichever path can carry it.
   *
   * An unlock carrying an actor or an entry direction is official-only, because the direct endpoint can say neither who acted nor which approach of a driveway gate
   * was taken. A plain unlock takes the official path when one is available and falls back to the direct path when it is not.
   *
   * @param request - The door, the device driving it, the optional actor and entry direction, and the direct-path expression.
   *
   * @throws {@link AccessCapabilityError} when no available path can carry the unlock.
   */
  async routedUnlock(request: AccessRoutedUnlockRequest): Promise<void> {

    /* The options only the official path can express, enumerated exactly once. The same object decides whether a direct half is offered at all and is what the
     * official call sends, so there is no way for the gate and the payload to disagree about which options make an unlock official-only. The abort signal
     * never appears here at all: a cancellation is a per-call concern, carried by the separate call options every official method takes last, so it cannot
     * cost an unlock its direct fallback.
     */
    const officialExtras: AccessOfficialDoorUnlockOptions = { ...((request.actor !== undefined) && { actor: request.actor }),
      ...((request.entryMethod !== undefined) && { entryMethod: request.entryMethod }) };
    const officialOnly = Object.keys(officialExtras).length > 0;

    await this.#route({

      deviceId: request.deviceId,
      direct: officialOnly ? undefined : request.direct,
      doorId: request.doorId,
      kind: "unlock",
      official: async (official: AccessOfficialDoorSurface): Promise<void> => official.spaces.unlock(request.doorId, officialExtras,
        { ...((request.signal !== undefined) && { signal: request.signal }) }),

      // Both official-only options can travel on one unlock, and the attribution is the more particular fact about the command, so its arm speaks first.
      operation: (request.actor !== undefined) ? "an unlock attributed to an actor" :
        ((request.entryMethod !== undefined) ? "an unlock carrying an entry direction" : "an unlock")
    });
  }

  /**
   * Close a door on whichever path can carry it.
   *
   * The Access application's own close command is proven against the hardware, so it keeps serving every client that holds a direct path, byte for byte. The official
   * half is the published API's gate control command - documented for UA Hub Gate hardware in three-button mode on UniFi Access 4.2.16 or later, with no capture
   * confirming it on other door families - and it is what makes a close reachable at all on a client that holds no direct path. Composing that half only where the
   * direct one cannot serve is the same conditional-half idiom an attributed unlock and a direct-inexpressible lock rule use.
   *
   * @param request - The door, the device driving it, and the direct-path expression.
   *
   * @throws {@link AccessCapabilityError} when no available path can carry the close.
   */
  async routedClose(request: AccessRoutedCloseRequest): Promise<void> {

    if(this.#directServes) {

      await this.#route({ deviceId: request.deviceId, direct: request.direct, doorId: request.doorId, operation: "a close" });

      return;
    }

    await this.#route({

      deviceId: request.deviceId,
      direct: request.direct,
      doorId: request.doorId,
      kind: "close",
      official: async (official: AccessOfficialDoorSurface): Promise<void> => official.spaces.unlock(request.doorId, { controlCmd: "close" },
        { ...((request.signal !== undefined) && { signal: request.signal }) }),
      operation: "a close"
    });
  }

  /**
   * Halt a gate mid-transition, on the one path that carries it.
   *
   * A stop exists only where the official path serves. The direct resource has no proven stop spelling, so a client with no official path refuses in routing's own
   * vocabulary rather than reaching for a direct expression this library will not invent.
   *
   * @param request - The door to halt and the device driving it.
   *
   * @throws {@link AccessCapabilityError} when no available path can carry the stop.
   */
  async routedStop(request: AccessRoutedStopRequest): Promise<void> {

    await this.#route({

      deviceId: request.deviceId,
      doorId: request.doorId,
      kind: "stop",
      official: async (official: AccessOfficialDoorSurface): Promise<void> => official.spaces.unlock(request.doorId, { controlCmd: "stop" },
        { ...((request.signal !== undefined) && { signal: request.signal }) }),
      operation: "a stop"
    });
  }

  /**
   * Put a lock rule in force on whichever path can carry it.
   *
   * @param request - The rule, the door it governs, the device driving that door, and the direct-path expression when the rule has one.
   *
   * @throws {@link AccessCapabilityError} when no available path can carry the rule.
   */
  async routedSetLockRule(request: AccessRoutedLockRuleRequest): Promise<void> {

    await this.#route({

      deviceId: request.deviceId,
      ...((request.direct !== undefined) && { direct: request.direct }),
      doorId: request.doorId,
      kind: "lockRule",
      official: async (official: AccessOfficialDoorSurface): Promise<void> => official.spaces.setLockRule(request.doorId, request.rule,
        { ...((request.signal !== undefined) && { signal: request.signal }) }),
      operation: "the " + request.rule.type + " lock rule"
    });
  }

  /**
   * Issue a command the Access application's own endpoints alone can carry, on a client that has a path to them.
   *
   * This is the routing decision with no official half. The command reaches its direct expression on a client that holds credentials and is not held away from them,
   * and the capability error otherwise. The override means one channel here as it does everywhere else: a client told to speak only the official API does not quietly
   * speak the other one for the commands that channel cannot express.
   *
   * @param request - The device, the direct-path expression, and what to call the operation in a refusal.
   *
   * @throws {@link AccessCapabilityError} when the client is held to the official API, which cannot carry this command, or holds no credentials, and therefore has no
   *   path this command could take.
   */
  async routedDirect(request: AccessRoutedDirectRequest): Promise<void> {

    await this.#route({ deviceId: request.deviceId, direct: request.direct, operation: request.operation });
  }

  /* The one routing decision every routed command passes through.
   *
   * Official first where the map, the latch, the override, and the floor recorded for this command on this device all allow it; the direct path where the command has
   * one and the client is not held away from it; and the capability error where neither is left. The capability refusals are caught here and nowhere else, and so is
   * the token rejected or refused a permission on a client the direct path can serve, which keeps a raw result code from ever reaching a consumer as the answer to a
   * routed call, and a refused token from failing a command the credentials could have carried - any other official failure is a genuine fault about this request and
   * propagates as itself.
   *
   * An operation reaching here with no official half is not a special case, merely one whose official half is absent for this client: it reaches the direct path
   * or the capability error by the same two steps everything else does.
   */
  async #route(operation: RoutedOperation): Promise<void> {

    const official = (operation.official === undefined) ? null : this.#officialFor(operation.deviceId, operation.kind);

    if((official !== null) && (operation.official !== undefined)) {

      try {

        await operation.official(official);

        return;
      } catch(error) {

        if(!this.#foldCapabilitySignal(error, operation.deviceId, operation.kind)) {

          throw error;
        }
      }
    }

    /* Holding the client to one channel is what makes the fallback unavailable rather than merely unused: a client told to speak only the official API does not
     * quietly speak the other one. The mode gate beside it says something stronger: a client with no credentials holds no direct path, so a direct closure it was
     * handed expresses a path that does not exist, and declining to call it is what keeps the refusal's reason the routing decision's own rather than whatever the
     * transport would have said.
     */
    if((operation.direct !== undefined) && this.#directServes) {

      await operation.direct();

      return;
    }

    /* The message composes the operation, the target it addressed, the capability that was missing, and the mode, so every arm carries all of them. The target and
     * the mode are composed here rather than woven into each arm's wording, so every arm carries both and no arm can be written without them - which is also what
     * lets each operation name itself once, without restating the kind of thing it acts on.
     */
    throw new AccessCapabilityError("This UniFi Access client cannot carry " + operation.operation + " for " + this.#targetOf(operation) + ", because " +
      this.#absenceReason() + " (connected in " + this.#capabilities.mode + " mode).");
  }

  /* The facade to use for this command on this device, or null when the official path is not available to it. Every gate that can close the official path is read
   * here, in the order that costs least: the connect-time map and the override are constants, the latch is a field, and only the floor memo needs a state read.
   */
  #officialFor(deviceId: string, kind: RoutedCommandKind): Nullable<AccessOfficialDoorSurface> {

    if((this.#official === null) || !this.#capabilities.official || this.#revoked || (this.#capabilities.override === "direct-only")) {

      return null;
    }

    return (this.#floorRefusals.get(kind + ":" + deviceId) === this.#firmwareOf(deviceId)) ? null : this.#official;
  }

  // Whether the Access application's own endpoints can carry a command for this client, read through the one answer the connect seed reads too.
  get #directServes(): boolean {

    return directPathServes(this.#capabilities);
  }

  /* Fold an official refusal that is a capability verdict, reporting whether it was one. An Identity Enterprise refusal, or the token rejected or refused a
   * permission on a client the direct path can serve, closes the official path for the client's life; a floor refusal is recorded against the command that drew it,
   * the device, and the firmware that device is running now, so the entry speaks for that one command and stops matching the moment the device is upgraded.
   */
  #foldCapabilitySignal(error: unknown, deviceId: string, kind: RoutedCommandKind): boolean {

    /* The readings run from the widest verdict to the narrowest. The Identity Enterprise verdict comes first and closes the official path on any client, because it
     * is a fact about the controller that every later official call would meet again.
     *
     * Either refusal of the token comes next, and is a verdict learned by trying on the official path: the controller rejecting the token outright, or authenticating
     * it and refusing it this operation, in whichever spelling it answered. A token is granted its permissions when it is issued and keeps them for its life, so either
     * refusal is a fact about this client rather than about the moment it asked. The official surface is assembled over the token session at the composition root,
     * so every refusal it answers is of the token and no identity check is needed. On a client that holds another path, this command and every routed command after
     * it take that path. The latch closes the whole official path rather than the one endpoint a refusal spoke about, because the direct path carries every routed
     * command that has a direct expression, so what a dual client gives up is only what the official API alone can express - an attributed unlock, an entry
     * direction, a gate stop - and because one latch is the single record of the path being closed, where a per-endpoint memo would be another mechanism recording
     * the same verdict. A client with nowhere else to go keeps the refusal as the error it arrived as, which points at the token as the thing to fix, rather than
     * reading a capability error on every call after it.
     *
     * The firmware floor comes last, and speaks for one command on one device rather than for the path.
     */
    if(isOfficialApiAbsent(error)) {

      this.#closeOfficialPath("The UniFi Access controller reports that the official API is not available on this controller.", { code: error.code });

      return true;
    }

    if(isTokenRefusal(error) && this.#directServes) {

      this.#closeOfficialPath(error.message, (error instanceof AccessApiError) ? { code: error.code } : { identity: error.identity, statusCode: error.statusCode });

      return true;
    }

    if((error instanceof AccessApiError) && (error.code === CODE_DEVICE_FLOOR)) {

      this.#floorRefusals.set(kind + ":" + deviceId, this.#firmwareOf(deviceId));

      return true;
    }

    return false;
  }

  /* Close the official path for the rest of this client's life, and say so once at warn, because a consumer whose commands keep succeeding has no other way to learn
   * they are taking the other channel. Commands already in flight when the path closes each took the facade before it closed, so each can reach this; the latch is
   * what records that the closure was reported, and the first refusal to arrive is the one that speaks. The warning is the refusal as the caller words it, followed
   * by what closing means for this client as `#directServes` answers it, composed by the same function the connect seed reports a refused token through, so every
   * cause states its consequence in the same words wherever the closure is learned.
   */
  #closeOfficialPath(refusal: string, context: Record<string, unknown>): void {

    if(this.#revoked) {

      return;
    }

    this.#revoked = true;

    this.#log.warn(officialPathClosureSentence(refusal, this.#directServes), context);
  }

  /* The firmware a device is running right now, read through the state rather than captured anywhere, which is what makes the memo key move when the device is
   * upgraded. A device the state does not hold reads as the empty string, which is a key like any other and simply never matches a real firmware string.
   */
  #firmwareOf(deviceId: string): string {

    return this.#store.snapshot().devices.get(deviceId)?.firmware ?? "";
  }

  /* What the refused command addressed, in the words the capability error reports: the door a door command was aimed at, or the device a device command was
   * aimed at. Each is named as the state names it - a door by its full name, a device by the display name its projection answers with - which is the name the
   * caller resolved it by, and by its identifier where the state holds no record, the one spelling the caller and the controller still agree on. Reading the
   * name here rather than taking it from each caller is what keeps every arm naming its target the same way.
   */
  #targetOf(operation: RoutedOperation): string {

    const state = this.#store.snapshot();

    if(operation.doorId !== undefined) {

      return "door \"" + (state.doors.get(operation.doorId)?.full_name ?? operation.doorId) + "\"";
    }

    const device = state.devices.get(operation.deviceId);

    return "device \"" + ((device === undefined) ? operation.deviceId : deviceDisplayName(device)) + "\"";
  }

  /* Why no path was left, in the words the capability error reports. The overrides are named ahead of everything else because a client held to one channel is refusing
   * something it could otherwise do, which is a different thing for a consumer to read than a client that never had the channel at all.
   *
   * The official-only arm is worded to cover both ways that choice leaves nothing: an operation the official API models nowhere, and one it models perfectly well but
   * refused for the addressed device. Naming only the first would misdescribe the second, where the API can express the operation and simply would not.
   */
  #absenceReason(): string {

    switch(this.#capabilities.override) {

      case "direct-only":

        return "it is held to the direct API, which cannot carry that operation";

      case "official-only":

        return "it is held to the official API, which either cannot express that operation or refused it for this device";

      default:

        // Ordered by what is most specific about this client. A revoked session is a verdict the controller handed down and is the most particular thing to say; a
        // client with no credentials at all is the next; and the generic arm covers a client that simply never had a working official path.
        if(this.#revoked) {

          return "the official API is no longer available to this session on this controller";
        }

        return (this.#capabilities.mode === "token") ? "it holds no credentials for the Access application's own endpoints, which that operation requires" :
          "that operation requires the official API, which this client has no working path to";
    }
  }
}

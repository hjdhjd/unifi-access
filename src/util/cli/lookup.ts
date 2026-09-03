/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * lookup.ts: Finding things in a connected client by what the operator typed - the one home for resolving a device, a door, or an official record by id or name.
 */
import type { AccessClient, AccessDevice, AccessHub, AccessStateDoor } from "../../index.ts";
import { CliError } from "./shared.ts";

/**
 * A name-resolution snapshot, taken once at the start of an invocation and read from there on. The filter engine holds one so that matching a packet against a device
 * name costs a map read rather than a walk of the device inventory, and so that every packet in a run is matched against one consistent view of the controller.
 *
 * @category CLI
 */
export interface DeviceResolution {

  /** The display name of the device with this identifier, or `undefined` when the snapshot holds no such device. */
  name(id: string): string | undefined;

  /** The identifier the operator's token names - the token itself when it is already an identifier, the named device's identifier when it is a name, `undefined`
   * when it is neither.
   */
  resolve(token: string): string | undefined;
}

/**
 * Every device the CLI can address, as live handles: the modeled devices plus each Enterprise Access Hub port.
 *
 * The union is what makes the whole inventory reachable. A multi-door Enterprise hub appears in the device collection as one record, but each of its ports drives its
 * own door and carries its own identity and name, so a CLI that offered only the device collection could name the hub and never the doors it actually opens. Listing,
 * resolution, and commands all draw from this one set, so a device that can be named can also be commanded.
 *
 * @param client - The connected client.
 *
 * @returns Every addressable device handle.
 *
 * @category CLI
 */
export function allTargets(client: AccessClient): readonly AccessDevice[] {

  return [ ...client.devices, ...client.accessPoints ];
}

/**
 * Build the {@link DeviceResolution} snapshot for this invocation from the client's current inventory. Names are indexed case-insensitively, and a device whose display
 * name is empty is indexed by identifier alone - there is no name to match it by.
 *
 * The display name comes from each handle's own `name` getter rather than from a rule restated here, so the CLI and the library agree on which of a device's two name
 * fields wins.
 *
 * @param client - The connected client.
 *
 * @returns The resolution snapshot.
 *
 * @category CLI
 */
export function buildDeviceResolution(client: AccessClient): DeviceResolution {

  const namesById = new Map<string, string>();
  const idsByName = new Map<string, string>();

  for(const device of allTargets(client)) {

    const name = device.name;

    namesById.set(device.id, name);

    if(name.length > 0) {

      idsByName.set(name.toLowerCase(), device.id);
    }
  }

  return {

    name: (id: string): string | undefined => namesById.get(id),
    resolve: (token: string): string | undefined => namesById.has(token) ? token : idsByName.get(token.toLowerCase())
  };
}

// The matching rule the DEVICE resolvers share: an exact identifier first, then a case-insensitive exact name match. Matching the whole name rather than a
// substring is deliberate - resolution feeds commands that act on hardware, so a forgiving match risks unlocking the wrong door and disambiguation stays the
// operator's job. A door is named more than one way, so the door arm spells its own phased rule where it lives. Non-throwing, because one caller answers a miss
// with an error and another probes on to its next resolution arm.
function scanTargets(targets: readonly AccessDevice[], token: string): AccessDevice | undefined {

  const byId = targets.find((device) => device.id === token);

  if(byId !== undefined) {

    return byId;
  }

  const lowered = token.toLowerCase();

  return targets.find((device) => device.name.toLowerCase() === lowered);
}

// The not-found listing, part of the error because the next thing the operator needs is the spelling we did know. Each line renders through the same name getter
// resolution uses, so a name shown here is a name that resolves.
function deviceListing(targets: readonly AccessDevice[]): string[] {

  const listing = targets.map((device) => "  " + device.name + " => " + device.id);

  return (listing.length > 0) ? [ "", "Devices:", ...listing ] : [];
}

/**
 * Resolve the operator's token to exactly one device, by the shared matching rule.
 *
 * @param client - The connected client.
 * @param token  - The device id or name as typed.
 *
 * @returns The matching device handle.
 *
 * @throws {@link CliError} listing the addressable devices when nothing matches.
 *
 * @category CLI
 */
export function findTarget(client: AccessClient, token: string): AccessDevice {

  const targets = allTargets(client);
  const matched = scanTargets(targets, token);

  if(matched !== undefined) {

    return matched;
  }

  throw new CliError([ "No device matches \"" + token + "\" by id or name.", ...deviceListing(targets) ].join("\n"));
}

/**
 * What a door command acts through, once the operator's token has been resolved to exactly one door. The arms are the realities a connected client can be in
 * about any given door.
 *
 * `hub` is a door driven by a handle the client holds, which is every door on a client that read the topology and most doors on one seeded from the official
 * listings: the projection's own routed commands act on it. `door` is a door the state knows and no handle drives - an Enterprise Access Hub withheld from the hub
 * views for want of a topology to place it, or a controller that refused the device listing and censused the doors alone - so only the published API's
 * door-addressed surface can reach it.
 *
 * @category CLI
 */
export type DoorTarget = { hub: AccessHub; kind: "hub" } | { door: AccessStateDoor; doorId: string; kind: "door" };

/* The door match, phased: an exact identifier over the doors map, then a case-insensitive exact `name` across every door, then the same across every `full_name`.
 * The short name is tried first because it is what an operator types, and the fuller spelling is what tells one floor's "Loading Dock" from another's.
 *
 * Each phase collects every door it matched rather than taking the first, and a phase that matched more than one refuses with both spellings rather than choosing.
 * Two doors can genuinely share a short name, and picking one of them by the order the map happens to hold them in is the outcome the fuller spelling exists to
 * prevent - the operator is the one who knows which door was meant.
 */
function matchDoor(doors: ReadonlyMap<string, AccessStateDoor>, token: string): [ string, AccessStateDoor ] | undefined {

  const byId = doors.get(token);

  if(byId !== undefined) {

    return [ token, byId ];
  }

  const entries = [...doors.entries()];
  const lowered = token.toLowerCase();

  for(const spelling of [ "name", "full_name" ] as const) {

    const matched = entries.filter(([ , door ]) => door[spelling].toLowerCase() === lowered);
    const [ first, second ] = matched;

    if(second !== undefined) {

      throw new CliError([ "More than one door matches \"" + token + "\" - name the one to command:",
        ...matched.map(([ id, door ]) => "  " + door.full_name + " => " + id) ].join("\n"));
    }

    if(first !== undefined) {

      return first;
    }
  }

  return undefined;
}

/**
 * Resolve the operator's token to the door a command should act on. A door can be named two ways, and both resolve here: by the hub or port that drives it (the
 * device union, by the shared matching rule), or by the topology's own door id, name, or full name. The arms are probed in order, and only the end of the sequence
 * throws - a door-name token must fall through a failed device match rather than die on it.
 *
 * The answer is a {@link DoorTarget} rather than a handle, because a door the state knows is not always a door the client holds a handle for. Whether the arm that
 * has no handle can be served is a question about the client's paths, which is the command's to ask and answer.
 *
 * @param client - The connected client.
 * @param token  - The device, port, or door - an id or a name, as typed.
 *
 * @returns The driving hub where one exists, and the door record itself where none does.
 *
 * @throws {@link CliError} when the token names a device that drives no door, when one spelling matches more than one door or more than one handle drives the
 *   named door (disambiguation stays the operator's job), or when nothing matches - the last listing both the devices and the topology's door names.
 *
 * @category CLI
 */
export function findDoorTarget(client: AccessClient, token: string): DoorTarget {

  // First, the device union: a matched device narrows to its hub-capable handle, and a device that exists but has no door to drive is worth saying plainly rather
  // than reporting as not-found.
  const device = scanTargets(allTargets(client), token);

  if(device !== undefined) {

    const hub = client.hub(device.id) ?? client.accessPoint(device.id);

    if(hub === undefined) {

      throw new CliError("\"" + device.name + "\" is not a hub, so it drives no door.");
    }

    return { hub, kind: "hub" };
  }

  // Second, the state's own doors, by the phased rule above. The handle scan is the hub-typed collections rather than the whole device union, because only a
  // hub-capable handle has a door - and a door no handle drives answers as itself, for the command to serve on the surface that addresses doors directly.
  const doors = client.state.snapshot().doors;
  const doorEntry = matchDoor(doors, token);

  if(doorEntry !== undefined) {

    const [ doorId, door ] = doorEntry;
    const candidates = [ ...client.hubs, ...client.accessPoints ].filter((hub) => hub.doorId === doorId);
    const [ first, second ] = candidates;

    if(second !== undefined) {

      throw new CliError([ "More than one device drives the door \"" + door.full_name + "\" - name the one to command:",
        ...candidates.map((hub) => "  " + hub.name + " => " + hub.id) ].join("\n"));
    }

    return (first !== undefined) ? { hub: first, kind: "hub" } : { door, doorId, kind: "door" };
  }

  // Nothing matched, so the listing carries both vocabularies: the devices and the topology's doors.
  const doorListing = [...doors.values()].map((door) => "  " + door.full_name + " => " + door.unique_id);

  throw new CliError([ "No device or door matches \"" + token + "\" by id or name.", ...deviceListing(allTargets(client)),
    ...((doorListing.length > 0) ? [ "", "Doors:", ...doorListing ] : []) ].join("\n"));
}

/**
 * How a door command names the door it acted on. The command addresses a door rather than the hardware in front of it, so the confirmation names the door: its
 * full name and the identity the command sent, whichever arm carried it.
 *
 * The hub arm falls back to naming the hardware when the state holds no record for the door it drives, which keeps the line truthful for a client whose census
 * seeded a handle and not the door behind it. Callers capture the label BEFORE issuing the command, so a record leaving controller state while the command is in
 * flight cannot crash a confirmation for a command that already succeeded.
 *
 * @param target - The resolved door target.
 *
 * @returns The confirmation's leading spelling of the door.
 *
 * @category CLI
 */
export function doorLabel(target: DoorTarget): string {

  if(target.kind === "door") {

    return target.door.full_name + " (" + target.doorId + ")";
  }

  const hub = target.hub;
  const door = hub.door;

  return (door !== undefined) ? (door.full_name + " (" + hub.doorId + ")") : (hub.name + " (" + hub.id + ")");
}

/**
 * Resolve the operator's token to one official record, by the shared matching rule: an exact id first, then a case-insensitive exact match on the record's display
 * name. The one resolver behind every official listing the CLI addresses by name - users, visitors, webhook endpoints, and the token-mode device inventory - so what
 * "resolve by id or name" means is written once, and each caller supplies only what a name is for its record kind.
 *
 * @typeParam T - The record type, carrying its own `id`.
 *
 * @param records - The official records, as the listing endpoint answered.
 * @param token   - The id or name as typed.
 * @param opts    - The record kind for diagnostics, and how a record spells its display name.
 *
 * @returns The matching record.
 *
 * @throws {@link CliError} listing the records when nothing matches.
 *
 * @category CLI
 */
export function findOfficialRecord<T extends { id: string }>(records: readonly T[], token: string, opts: { kind: string; name: (record: T) => string }): T {

  const byId = records.find((record) => record.id === token);

  if(byId !== undefined) {

    return byId;
  }

  const lowered = token.toLowerCase();
  const byName = records.find((record) => opts.name(record).toLowerCase() === lowered);

  if(byName !== undefined) {

    return byName;
  }

  const listing = records.map((record) => "  " + opts.name(record) + " => " + record.id);
  const plural = opts.kind + "s";
  const heading = plural.charAt(0).toUpperCase() + plural.slice(1) + ":";

  throw new CliError([ "No " + opts.kind + " matches \"" + token + "\" by id or name.", ...((listing.length > 0) ? [ "", heading, ...listing ] : []) ].join("\n"));
}

/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * device.ts: `ufa device <restart|settings|state|update>` - the device command group: the fleet restart policy, per-device access methods, the readings listing,
 * and the direct config write.
 */
import { ACCESS_TERMINAL_INPUTS, AccessAbortedError, formatErrorChain } from "../../../index.ts";
import type { AccessDevice, AccessDeviceConfigPayload, AccessHub, AccessOfficialAccessMethodValue, AccessOfficialAccessMethodsUpdate, AccessPortBinding,
  AccessTerminalInput, AccessTerminalInputFacts } from "../../../index.ts";
import { COMMON_OPTIONS, CliError, SCRUB_OPTION, commandList, createDocumentScrubber, groupCommand, isMember, refuseDocumentFlags } from "../shared.ts";
import type { CommandContext, CommandHandler, CommandSpec } from "../shared.ts";
import { alignedList, renderDocument } from "../output/format.ts";
import { allTargets, findTarget, hubHandle } from "../lookup.ts";
import { requireOfficial, requireSurface } from "../client.ts";
import { parseArgs } from "node:util";

const RESTART_USAGE = [

  "Usage: ufa device restart <all | DEVICE_NAME_OR_ID> [--debug]",
  "",
  "Restart devices. The controller drops each one and re-adopts it, so it is unreachable for a short while afterwards.",
  "",
  "Targets:",
  "  all                  Restart every connected device.",
  "  DEVICE_NAME_OR_ID    Restart one device, named by its display name or its id.",
  "",
  "A device that is already rebooting, or that the controller reports as disconnected, is skipped with a note rather than commanded.",
  "Attached devices are restarted before the hubs that carry them, so every restart command is delivered while its carrier is still up.",
  "",
  "Options:",
  "  --debug     Emit the library's debug logging to stderr.",
  "  -h, --help  Show this help.",
  "",
  "Examples:",
  "  ufa device restart \"Loading Dock\" # one device",
  "  ufa device restart all              # every connected device"
].join("\n");

/* One target as the loop sees it: the handle to command, plus its identity and gate readings taken as plain values at the moment of the gating pass.
 *
 * The readings are copied rather than read live because a projection reads through to controller state, and a record that leaves state mid-run makes every further
 * read of that handle throw. Copying them means the run's own output lines and skip decisions describe the inventory as it was when the run began, and a device that
 * disappears underneath the loop fails its own restart with a reported error instead of taking the whole command down.
 */
interface RestartTarget {

  device: AccessDevice;
  id: string;
  isConnected: boolean;
  isRebooting: boolean;
  name: string;
  uplinkId: string | null;
}

// Take the plain-value snapshot of one device handle.
function snapshotTarget(device: AccessDevice): RestartTarget {

  const config = device.config;

  return { device, id: device.id, isConnected: config.is_connected, isRebooting: config.is_rebooting === true, name: device.name,
    uplinkId: device.uplinkId };
}

/**
 * `ufa device restart`. Resolves the target - the `all` keyword for every device, or one named device - snapshots the inventory, skips what cannot usefully be
 * restarted, and then commands the rest one at a time.
 *
 * Sequential is deliberate rather than accidental serialization: it keeps the per-device output ordered and the cadence polite to a controller that may be juggling
 * its own work. A device whose restart is refused is reported and the run continues, because one unreachable device should not stop the operator from restarting the
 * others; a Ctrl-C is the one failure that stops the run, since continuing to command hardware after the operator asked to stop is the opposite of what they asked
 * for.
 *
 * @category CLI
 */
const restartHandler = async (ctx: CommandContext): Promise<void> => {

  const { positionals, values } = parseArgs({ allowPositionals: true, args: ctx.args, options: { ...COMMON_OPTIONS }, strict: true });

  if(values.help === true) {

    ctx.output.line(RESTART_USAGE);

    return;
  }

  const [target] = positionals;

  if((target === undefined) || (positionals.length > 1)) {

    throw new CliError("Specify \"all\" or one device by name or id. Run \"ufa device restart --help\" for usage.", { exitCode: 2 });
  }

  const credentials = await ctx.loadCredentials();

  requireSurface(credentials, "credential", "device restart command");

  // A one-shot action, so the periodic bootstrap-refresh failsafe is switched off: we connect, issue the restarts, and exit.
  await using client = await ctx.openClient({ credentials, debug: values.debug === true, refreshIntervalMs: false, signal: ctx.signal });

  // The keyword is tested before name resolution, which is the shipped CLI's own precedence.
  const snapshots = ((target === "all") ? allTargets(client) : [findTarget(client, target)]).map(snapshotTarget);
  const restartable: RestartTarget[] = [];

  for(const candidate of snapshots) {

    if(candidate.isRebooting) {

      ctx.output.line(candidate.name + " (" + candidate.id + ") - skipped, it is already rebooting.");

      continue;
    }

    if(!candidate.isConnected) {

      ctx.output.line(candidate.name + " (" + candidate.id + ") - skipped, it is not connected.");

      continue;
    }

    restartable.push(candidate);
  }

  if(restartable.length === 0) {

    ctx.output.line("No connected devices to restart.");

    return;
  }

  /* A restart command reaches an attached device through the device that carries it, so commanding a carrier first strands everything behind it: the carrier goes
   * down, and the commands still to come cannot be delivered. Taking the attached devices first keeps every command deliverable while its carrier is still up.
   *
   * The partition is stable on both sides, so within each tier the run follows the order the inventory reported. It governs the order commands are issued in and
   * nothing else: the gating pass above reports what it skipped in inventory order, so an operator's notes line up with the listing they just looked at.
   */
  const sequenced = [ ...restartable.filter((candidate) => candidate.uplinkId !== null), ...restartable.filter((candidate) => candidate.uplinkId === null) ];

  for(const candidate of sequenced) {

    try {

      // Sequential await is intentional - see the handler comment. Parallelizing would interleave the per-device output and burst the controller with every restart
      // at once.
      // eslint-disable-next-line no-await-in-loop
      await candidate.device.restart({ signal: ctx.signal });

      ctx.output.line(candidate.name + " (" + candidate.id + ") - restarting.");
    } catch(error) {

      // A Ctrl-C surfaces as the restart throwing the library's abort error, and that ends the whole command through the entry point's cascade. Every other failure
      // is this device's own, so it is reported and the run continues. We key off the error type rather than the signal flag, which the compiler narrows across the
      // await.
      if(error instanceof AccessAbortedError) {

        throw error;
      }

      ctx.output.line(candidate.name + " (" + candidate.id + ") - failed: " + formatErrorChain(error));
    }
  }
};

const SETTINGS_USAGE = [

  "Usage: ufa device settings <DEVICE> [--enable METHOD]... [--disable METHOD]... [--json] [--scrub] [--debug]",
  "",
  "Read or change a device's access-method settings, through the official API. With no flags, the settings are read and printed; with them, each named",
  "method is switched and the settings are read back, because unsupported hardware answers a settings write with success and changes nothing - the",
  "read-back is what tells a toggle that held from one the device declined. If the read-back is cancelled or fails after the write was accepted, the",
  "command says so rather than leaving the change looking failed.",
  "",
  "Methods: bt_button, bt_shake, bt_tap, face, mobile_wave, nfc, pin_code, qr_code, touch_pass, wave.",
  "A device reports only the methods its hardware class offers, so an absent method reads as unavailable rather than disabled.",
  "",
  "Options:",
  "  --enable METHOD   Switch a method on. Repeatable.",
  "  --disable METHOD  Switch a method off. Repeatable.",
  "  --json            Emit the settings read as a single line of JSON, field order preserved.",
  "  --scrub           Pseudonymize identifying values in the settings read so it can be shared - one value reads as one stand-in throughout a run.",
  "  --debug           Emit the library's debug logging to stderr.",
  "  -h, --help        Show this help.",
  "",
  "Examples:",
  "  ufa device settings \"Front Reader\"                # read the settings",
  "  ufa device settings \"Front Reader\" --enable nfc   # switch NFC on and report whether it held"
].join("\n");

// The documented access methods - the update type's own member names, satisfies-linked so a library rename breaks the compile instead of drifting this copy.
const ACCESS_METHODS = [ "bt_button", "bt_shake", "bt_tap", "face", "mobile_wave", "nfc", "pin_code", "qr_code", "touch_pass",
  "wave" ] as const satisfies readonly (keyof AccessOfficialAccessMethodsUpdate)[];

// Validate one --enable/--disable value against the documented method set.
function parseMethod(value: string, flag: string): (typeof ACCESS_METHODS)[number] {

  if(!isMember(ACCESS_METHODS, value)) {

    throw new CliError("The " + flag + " value must be one of: " + ACCESS_METHODS.join(", ") + ", but received \"" + value + "\".", { exitCode: 2 });
  }

  return value;
}

/**
 * `ufa device settings`. With no flags, reads and prints the device's access-method settings; with them, composes the sparse update the wire takes - each method's
 * primary `enabled` member, in the controller's own `"yes"`/`"no"` vocabulary - writes it, awaits the write, and then reads back sequentially to report which toggles
 * held. The read-back is the point rather than a nicety: unsupported hardware answers the write with success and changes nothing, and surfacing that decline
 * per-method is the honest report. A read-back that does not complete after the write was accepted is reported as a lost confirmation rather than a lost change,
 * and the failure then propagates as itself.
 *
 * @category CLI
 */
const settingsHandler = async (ctx: CommandContext): Promise<void> => {

  const { positionals, values } = parseArgs({ allowPositionals: true, args: ctx.args,
    options: { ...COMMON_OPTIONS, ...SCRUB_OPTION, disable: { multiple: true, type: "string" }, enable: { multiple: true, type: "string" },
      json: { type: "boolean" } }, strict: true });

  if(values.help === true) {

    ctx.output.line(SETTINGS_USAGE);

    return;
  }

  const [target] = positionals;

  if((target === undefined) || (positionals.length > 1)) {

    throw new CliError("Specify one device by name or id. Run \"ufa device settings --help\" for usage.", { exitCode: 2 });
  }

  const enables = (values.enable ?? []).map((method) => parseMethod(method, "--enable"));
  const disables = (values.disable ?? []).map((method) => parseMethod(method, "--disable"));
  const contradiction = enables.find((method) => disables.includes(method));

  if(contradiction !== undefined) {

    throw new CliError("The method \"" + contradiction + "\" cannot be both enabled and disabled in one invocation.", { exitCode: 2 });
  }

  // The change arm prints per-method confirmations composed here rather than a document, so the document-only flags are refused before anything connects.
  refuseDocumentFlags(values, { changing: (enables.length > 0) || (disables.length > 0),
    prints: "A settings change reports each method rather than printing a document", read: "settings read" });

  const credentials = await ctx.loadCredentials();

  requireSurface(credentials, "official", "device settings command");

  await using client = await ctx.openClient({ credentials, debug: values.debug === true, refreshIntervalMs: false, signal: ctx.signal });

  const officialDevices = requireOfficial(client, "device settings command").devices;

  // One resolution for every identity the CLI can connect with: the device union answers, and hardware a census seeded is as addressable there as hardware a
  // topology did.
  const deviceId = findTarget(client, target).id;

  if((enables.length === 0) && (disables.length === 0)) {

    const settings = createDocumentScrubber(values.scrub === true)(await officialDevices.fetchSettings(deviceId, { signal: ctx.signal }));

    renderDocument(ctx.output, settings, (values.json === true) ? "json" : "default");

    return;
  }

  // Compose the sparse update: each requested method's primary enabled member, and nothing else.
  const update: AccessOfficialAccessMethodsUpdate = {};
  const requested = new Map<(typeof ACCESS_METHODS)[number], AccessOfficialAccessMethodValue>();

  for(const method of enables) {

    requested.set(method, "yes");
    update[method] = { enabled: "yes" };
  }

  for(const method of disables) {

    requested.set(method, "no");
    update[method] = { enabled: "no" };
  }

  // The write completes before the read-back begins - a read that raced the write could report the settings as they were, not as they held.
  await officialDevices.updateSettings(deviceId, { "access_methods": update }, { signal: ctx.signal });

  // Once the controller has accepted the write, a read-back that does not complete - a Ctrl-C landing between the two calls, or the read failing on its own - is a
  // lost confirmation rather than a lost change, and the command says so before the failure propagates, because a silent exit or a bare error here reads as the
  // change having failed. The failure still travels as itself, so an abort exits 130 through the entry point's cascade like every other abort. An abort landing on
  // the write is not reported here: whether an interrupted request reached the controller is the ambiguity every write in the CLI shares, not this command's own.
  const after = await officialDevices.fetchSettings(deviceId, { signal: ctx.signal }).catch((error: unknown): never => {

    ctx.output.line("The settings change was accepted, but the read-back that reports whether each method held did not complete.");

    throw error;
  });

  for(const [ method, value ] of requested) {

    const held = after.access_methods[method]?.enabled;

    if(held === value) {

      ctx.output.line(method + " - " + ((value === "yes") ? "enabled" : "disabled") + ".");

      continue;
    }

    ctx.output.line(method + " - declined: the device reports " + ((held === undefined) ? "no such method" : ("it as \"" + held + "\"")) +
      ", so the change did not hold.");
  }
};

const UPDATE_USAGE = [

  "Usage: ufa device update <DEVICE> --json <PAYLOAD> [--dry-run] [--scrub] [--debug]",
  "",
  "Apply a configuration change to a device through the Access application's own settings endpoint, and print the record the controller echoes back.",
  "The payload is a JSON object of the fields to change; the controller validates it and is the authority on what the write means.",
  "",
  "Options:",
  "  --json PAYLOAD  The configuration fields to apply, as a JSON object.",
  "  --dry-run       Print the target and the payload without sending anything.",
  "  --scrub         Pseudonymize identifying values in the echoed record so it can be shared - one value reads as one stand-in throughout a run.",
  "  --debug         Emit the library's debug logging to stderr.",
  "  -h, --help      Show this help.",
  "",
  "Examples:",
  "  ufa device update \"Front Reader\" --json '{\"name\": \"Lobby Reader\"}'             # rename a device",
  "  ufa device update \"Front Reader\" --json '{\"name\": \"Lobby Reader\"}' --dry-run   # show what would be sent"
].join("\n");

/**
 * `ufa device update`. Parses the payload, resolves the target, and either previews (--dry-run) or sends the write and renders the echoed record. The parsed object
 * crosses into the library's payload type by the one documented cast at this boundary: the payload is a deep wire partial no runtime validator can honestly narrow,
 * and the controller is the validator of record.
 *
 * @category CLI
 */
const updateHandler = async (ctx: CommandContext): Promise<void> => {

  const { positionals, values } = parseArgs({ allowPositionals: true, args: ctx.args,
    options: { ...COMMON_OPTIONS, ...SCRUB_OPTION, "dry-run": { type: "boolean" }, json: { type: "string" } }, strict: true });

  if(values.help === true) {

    ctx.output.line(UPDATE_USAGE);

    return;
  }

  const [target] = positionals;

  if((target === undefined) || (positionals.length > 1)) {

    throw new CliError("Specify one device by name or id. Run \"ufa device update --help\" for usage.", { exitCode: 2 });
  }

  if(values.json === undefined) {

    throw new CliError("Specify the configuration to apply with --json. Run \"ufa device update --help\" for usage.", { exitCode: 2 });
  }

  let parsed: unknown;

  try {

    parsed = JSON.parse(values.json);
  } catch(error) {

    throw new CliError("The --json payload is not valid JSON.", { cause: error, exitCode: 2 });
  }

  if((typeof parsed !== "object") || (parsed === null) || Array.isArray(parsed)) {

    throw new CliError("The --json payload must be a JSON object.", { exitCode: 2 });
  }

  // Refused here with the rest of the argument checks rather than beside the dry-run branch below, so the combination is rejected before anything connects - a
  // usage error should not cost the operator a login.
  if((values.scrub === true) && (values["dry-run"] === true)) {

    throw new CliError("A dry run prints the payload you supplied rather than a controller document, so --scrub has nothing to act on.", { exitCode: 2 });
  }

  // The one documented cast: the payload type is a deep wire partial, and the controller validates the write.
  const payload = parsed as AccessDeviceConfigPayload;
  const credentials = await ctx.loadCredentials();

  requireSurface(credentials, "credential", "device update command");

  await using client = await ctx.openClient({ credentials, debug: values.debug === true, refreshIntervalMs: false, signal: ctx.signal });

  const device = findTarget(client, target);

  if(values["dry-run"] === true) {

    ctx.output.line(device.name + " (" + device.id + ") - dry run, nothing sent. The payload:");
    ctx.output.line(JSON.stringify(payload));

    return;
  }

  // The scrub reaches the record the controller echoed back, never the dry-run preview above: that preview is the operator's own payload rather than a document the
  // controller sent.
  const echoed = createDocumentScrubber(values.scrub === true)(await device.updateDevice(payload, { signal: ctx.signal }));

  renderDocument(ctx.output, echoed, "default");
};

const STATE_USAGE = [

  "Usage: ufa device state [all | DEVICE_NAME_OR_ID] [--json] [--debug]",
  "",
  "Print what the controller currently reports about each device: whether it is online, what carries it, for hardware that detects tampering what its",
  "tamper reading says, and, for a hub, what each of the terminals on its back reads and which door each of its ports is bound to.",
  "",
  "Targets:",
  "  all                  Report every addressable device. This is what a bare invocation does.",
  "  DEVICE_NAME_OR_ID    Report one device, named by its display name or its id.",
  "",
  "A tamper reading of \"unreported\" means nothing has established one - a client holding only a token reads every device that way, because the official",
  "census carries no configuration rows, and a device whose tampering alert is switched off in the Access console reads that way too, because its hardware",
  "then reports no tamper input. A device whose hardware cannot detect tampering carries no tamper reading at all.",
  "",
  "A hub's terminals are listed by name - dps, rel, ren, rex, and side dps - each reading \"on\" or \"off\" where the hardware reports something wired to it and",
  "a reading established, \"unreported\" where it reports something wired but no reading has been established, and \"unwired\" where it reports nothing wired.",
  "A terminal the hardware says nothing about at all is not listed, and a device that is not a hub lists none.",
  "",
  "A hub's port bindings follow its terminals, each as the bound door's name (or its id where the controller gave no name) and the port where the record",
  "names one. A hub whose ports bind no door lists none.",
  "",
  "Options:",
  "  --json      Emit one JSON object keyed by device id.",
  "  --debug     Emit the library's debug logging to stderr.",
  "  -h, --help  Show this help.",
  "",
  "Examples:",
  "  ufa device state                # every device",
  "  ufa device state \"Front Reader\" # one device"
].join("\n");

/* One device's readings as plain values, taken before anything is rendered.
 *
 * They are copied for the reason the restart's own snapshot copies its gate readings: a projection reads through to controller state, so a record that leaves
 * state part way through makes every further read of that handle throw. Taking them all up front means a handle whose record has gone fails once, at the
 * snapshot, rather than half way down a listing that has already been written.
 */
interface DeviceReadings {

  /* The bindings as the library hands them over, in the controller's own delivery order, present for a hub handle and absent for anything else. An empty list is a
   * hub whose ports bind no door, which is a different statement from a device that has no ports to bind.
   */
  bindings?: readonly AccessPortBinding[];
  id: string;
  isOnline: boolean;
  isTamperCapable: boolean;
  name: string;
  tamperState: boolean | undefined;
  /* A reading list rather than a map, because the vocabulary's own order is the order the listing renders them in and a map would leave that ordering to whoever
   * walked it. It is present for a hub handle and absent for anything else, and an empty list is a hub with nothing to report.
   */
  terminals?: readonly EstablishedTerminal[];
  uplinkId: string | null;
}

// One terminal a listing carries, and the verdict behind it. The facts are narrowed to the two arms a hub established, because a terminal the hardware said
// nothing about is left out of the listing rather than rendered as an empty reading.
type EstablishedFacts = Exclude<AccessTerminalInputFacts, { wired?: undefined }>;
type EstablishedTerminal = readonly [ AccessTerminalInput, EstablishedFacts ];

// Take the plain-value snapshot of one device handle. Every value comes off the handle's own getters, so this listing reads the devices tier exactly as the
// sibling leaves do and never reaches past it into the state model. The hub handle arrives as an argument because resolving it is the one thing this cannot do
// from a device handle alone, and a device that drives no door has none.
function snapshotReadings(device: AccessDevice, hub: AccessHub | undefined): DeviceReadings {

  return { bindings: hub?.portBindings, id: device.id, isOnline: device.isOnline, isTamperCapable: device.isTamperCapable,
    name: device.name, tamperState: device.tamperState,
    terminals: (hub === undefined) ? undefined : ACCESS_TERMINAL_INPUTS.map((input) => [ input, hub.terminalInput(input) ] as const).filter(established),
    uplinkId: device.uplinkId };
}

// Which of a hub's terminals the listing carries: the ones it established a verdict for. Narrowing the pair here is what lets the renderers read that verdict
// without asking again whether there is one.
function established(entry: readonly [ AccessTerminalInput, AccessTerminalInputFacts ]): entry is EstablishedTerminal {

  return entry[1].wired !== undefined;
}

// How a tamper reading reads on the default form. The unestablished case is spelled out rather than left blank, because "nothing has said" is a different answer
// from "nothing is wrong" and a blank would read as the second.
function describeTamper(state: boolean | undefined): string {

  switch(state) {

    case true:

      return "detected";

    case false:

      return "clear";

    default:

      return "unreported";
  }
}

// How each terminal is named on the default form. The spellings are the operator's rather than the vocabulary's, which is why the side door's position sensor
// reads as two words where the library's own name for it is one.
const TERMINAL_LABELS = { dps: "dps", rel: "rel", ren: "ren", rex: "rex", sideDps: "side dps" } satisfies Record<AccessTerminalInput, string>;

// How one terminal reads on the default form. A terminal in service whose reading has not been established is spelled out for the reason the tamper reading's
// own unestablished case is: "nothing has said" is a different answer from "nothing is there", and a blank would read as the second.
function describeTerminal(facts: EstablishedFacts): string {

  if(!facts.wired) {

    return "unwired";
  }

  switch(facts.state) {

    case true:

      return "on";

    case false:

      return "off";

    default:

      return "unreported";
  }
}

// How one port binding reads on the default form. The bound door's name stands in for its identity wherever the controller gave one, because a person reading a
// listing knows a door by its name and not by its uuid; the JSON form carries the identity instead, which is what a caller matching the door against the
// controller's own records needs. The port is named only where the record names one.
function describeBinding(binding: AccessPortBinding): string {

  return "door " + (binding.name ?? binding.doorId) + ((binding.port !== undefined) ? " on " + binding.port : "");
}

// One device's readings as the aligned form's description: the readings a device can always answer, the tamper reading only where the hardware produces one, one
// segment per terminal a hub established a verdict for, and one per door a hub's port is bound to.
function describeReadings(readings: DeviceReadings): string {

  return [ "online " + (readings.isOnline ? "yes" : "no"), "uplink " + (readings.uplinkId ?? "none"),
    ...(readings.isTamperCapable ? ["tamper " + describeTamper(readings.tamperState)] : []),
    ...(readings.terminals ?? []).map(([ input, facts ]) => TERMINAL_LABELS[input] + " " + describeTerminal(facts)),
    ...(readings.bindings ?? []).map(describeBinding) ].join(", ");
}

/* One device's readings as the JSON form carries them, members in alphabetical order.
 *
 * The tamper member is present only where the hardware can report one, and an unestablished reading is translated to null rather than left undefined, because
 * JSON.stringify drops an undefined member: without the translation a capable device that has reported nothing would be indistinguishable from a device that
 * cannot report at all, which is precisely the difference the reading exists to state.
 *
 * The terminals member is present only for a hub, keyed by the library's own terminal names, and a wired terminal whose reading is unestablished carries a null
 * state for exactly the same reason: stringify would drop it, and a terminal in service that has reported nothing would then be indistinguishable from one the
 * hardware says nothing is wired to.
 *
 * The bindings member is present only for a hub as well, carried as the library's own record shape rather than reshaped here, so a caller reads the same members
 * the state tier answers with. It needs no null translation, because an absent member here means exactly what it says: this device has no ports to bind.
 */
function jsonReadings(readings: DeviceReadings): Record<string, unknown> {

  return { ...((readings.bindings !== undefined) && { bindings: readings.bindings }), online: readings.isOnline,
    ...(readings.isTamperCapable && { tamper: readings.tamperState ?? null }),
    ...((readings.terminals !== undefined) && { terminals: Object.fromEntries(readings.terminals.map(([ input, facts ]) => [ input, jsonTerminal(facts) ])) }),
    uplink: readings.uplinkId };
}

// One terminal as the JSON form carries it, with the null translation the member's own comment above explains.
function jsonTerminal(facts: EstablishedFacts): Record<string, unknown> {

  return facts.wired ? { state: facts.state ?? null, wired: true } : { wired: false };
}

/**
 * `ufa device state`. Resolves the target - the `all` keyword or a bare invocation for every device, or one named device - snapshots each handle's readings, and
 * renders them.
 *
 * It reads in whichever mode the client connected in, which is why it gates on nothing: the liveness and uplink readings are established by either census, and
 * the tamper reading answers honestly as unestablished where the census that seeded the client never carried it.
 *
 * @category CLI
 */
const stateHandler: CommandHandler = async (ctx: CommandContext) => {

  const { positionals, values } = parseArgs({ allowPositionals: true, args: ctx.args, options: { ...COMMON_OPTIONS, json: { type: "boolean" } }, strict: true });

  if(values.help === true) {

    ctx.output.line(STATE_USAGE);

    return;
  }

  const [target] = positionals;

  if(positionals.length > 1) {

    throw new CliError("Specify \"all\", one device by name or id, or nothing at all. Run \"ufa device state --help\" for usage.", { exitCode: 2 });
  }

  // A read-and-exit invocation, so the periodic bootstrap-refresh failsafe is switched off: there is no long-lived session for it to guard.
  await using client = await ctx.openClient({ debug: values.debug === true, refreshIntervalMs: false, signal: ctx.signal });

  // The keyword is tested before name resolution, which is the group's own precedence, and a bare invocation reads as the whole inventory.
  const readings = (((target === undefined) || (target === "all")) ? allTargets(client) : [findTarget(client, target)])
    .map((device) => snapshotReadings(device, hubHandle(client, device.id)));

  if(values.json === true) {

    ctx.output.line(JSON.stringify(Object.fromEntries(readings.map((entry) => [ entry.id, jsonReadings(entry) ]))));

    return;
  }

  for(const line of alignedList(readings.map((entry) => [ entry.name, describeReadings(entry) ] as const))) {

    ctx.output.line(line);
  }
};

// The device subcommand table. The dispatcher, the usage text, and the unknown-subcommand diagnostic all derive from it through the shared group composer.
const SUBCOMMANDS: Record<string, CommandSpec> = {

  restart: { run: restartHandler, summary: "Restart every connected device, or one named device." },
  settings: { run: settingsHandler, summary: "Read or change a device's access-method settings." },
  state: { run: stateHandler, summary: "Print what the controller reports about each device, tamper readings included." },
  update: { run: updateHandler, summary: "Apply a configuration change and print the echoed record." }
};

const USAGE = [

  "Usage: ufa device <subcommand> [options]",
  "",
  "Subcommands:",
  ...commandList(SUBCOMMANDS),
  "",
  "Run \"ufa device <subcommand> --help\" for subcommand options."
].join("\n");

/** `ufa device`. The device command group, composed through the shared group dispatcher. */
export const device: CommandSpec = groupCommand({ commands: SUBCOMMANDS, group: "device", summary: "Restart devices and manage their settings.", usage: USAGE });

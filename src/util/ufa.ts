#!/usr/bin/env node
/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * ufa.ts: UniFi Access API command line utility.
 */
import type { AccessBootstrapConfig, AccessEventPacket, Nullable } from "../index.js";
import { existsSync, readFileSync } from "fs";
import { AccessApi } from "../index.js";
import { homedir } from "os";
import util from "util";

// Credentials configuration interface.
interface UfaConfig {

  controller: string;
  password: string;
  username: string;
}

// Parsed command line options.
interface ParsedOptions {

  args: string[];
  command: string;
  debug: boolean;
  filters: EventFilter[];
  help: boolean;
  maxEvents: number;
  outputFields: string[];
  outputFormat: OutputFormat;
  statsMode: boolean;
  timeout: number;
}

// Output format types.
type OutputFormat = "default" | "compact" | "json";

// Event statistics tracker.
interface EventStats {

  byEvent: Record<string, number>;
  total: number;
}

// Filter operator types.
type FilterOperator = "!=" | "!~" | "<" | "<=" | "==" | ">" | ">=" | "~";

// Base interface for event filters. This is the extensible foundation for the filtering system.
interface EventFilter {

  // Human-readable description of the filter.
  describe(): string;

  // Returns true if the event matches this filter.
  matches(packet: AccessEventPacket, context: FilterContext): boolean;
}

// Context passed to filters, providing access to bootstrap data and utilities.
interface FilterContext {

  // Access to the bootstrap data.
  bootstrap: Nullable<AccessBootstrapConfig>;

  // Get device name by ID.
  getDeviceName(id: string): string | null;

  // Resolve a device name to its ID. Returns the ID if found, null otherwise.
  resolveDeviceName(name: string): string | null;
}

// Property filter for matching event properties.
class PropertyFilter implements EventFilter {

  private readonly negate: boolean;
  private readonly operator: FilterOperator;
  private readonly path: string;
  private readonly regex: RegExp | null;
  private readonly value: string;

  constructor(path: string, operator: FilterOperator, value: string) {

    this.path = path;
    this.operator = operator;
    this.value = value;
    this.negate = (operator === "!=") || (operator === "!~");

    // Check if value is a regex pattern (delimited by /).
    if(((operator === "~") || (operator === "!~")) && value.startsWith("/") && (value.lastIndexOf("/") > 0)) {

      const lastSlash = value.lastIndexOf("/");
      const pattern = value.substring(1, lastSlash);
      const flags = value.substring(lastSlash + 1);

      this.regex = new RegExp(pattern, flags);
    } else if((operator === "~") || (operator === "!~")) {

      // Treat as glob pattern - convert to regex.
      const regexPattern = value.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".");

      this.regex = new RegExp("^" + regexPattern + "$", "i");
    } else {

      this.regex = null;
    }
  }

  public describe(): string {

    return this.path + " " + this.operator + " " + this.value;
  }

  public matches(packet: AccessEventPacket, context: FilterContext): boolean {

    // Special handling for "device" filter - resolve name to ID.
    if(this.path === "device") {

      const resolvedId = context.resolveDeviceName(this.value);

      if(resolvedId) {

        const actualValue = String(packet.event_object_id);

        return this.negate ? actualValue.toLowerCase() !== resolvedId.toLowerCase() : actualValue.toLowerCase() === resolvedId.toLowerCase();
      }

      // If we can't resolve the name, try matching against the ID directly.
      const actualValue = String(packet.event_object_id);
      const matches = actualValue.toLowerCase() === this.value.toLowerCase();

      return this.negate ? !matches : matches;
    }

    // Get the value at the specified path.
    const actualValue = this.getValueAtPath(packet, this.path);

    if(actualValue === undefined) {

      return this.negate;
    }

    return this.compareValues(String(actualValue));
  }

  private compareValues(actualValue: string): boolean {

    const normalizedActual = actualValue.toLowerCase();
    const normalizedExpected = this.value.toLowerCase();

    switch(this.operator) {

      case "!=":

        return normalizedActual !== normalizedExpected;

      case "!~":

        return this.regex ? !this.regex.test(actualValue) : !normalizedActual.includes(normalizedExpected);

      case "<":

        return Number(actualValue) < Number(this.value);

      case "<=":

        return Number(actualValue) <= Number(this.value);

      case "==":

        return normalizedActual === normalizedExpected;

      case ">":

        return Number(actualValue) > Number(this.value);

      case ">=":

        return Number(actualValue) >= Number(this.value);

      case "~":

        return this.regex ? this.regex.test(actualValue) : normalizedActual.includes(normalizedExpected);

      default:

        return false;
    }
  }

  private getValueAtPath(packet: AccessEventPacket, path: string): unknown {

    const parts = path.split(".");
    let current: unknown = packet;

    // Check if path starts with "data", otherwise search at the top level first.
    if(parts[0] === "data") {

      current = packet.data;
      parts.shift();
    } else if(parts[0] === "meta") {

      current = packet.meta;
      parts.shift();
    }

    for(const part of parts) {

      if((current === null) || (current === undefined)) {

        return undefined;
      }

      if(typeof current === "object") {

        current = (current as Record<string, unknown>)[part];
      } else {

        return undefined;
      }
    }

    return current;
  }
}

// Device type filter for matching Access device types (UAH, UAH-Door, etc.).
class DeviceTypeFilter implements EventFilter {

  private readonly deviceType: string;
  private readonly negate: boolean;

  constructor(deviceType: string, negate: boolean = false) {

    this.deviceType = deviceType;
    this.negate = negate;
  }

  public describe(): string {

    return (this.negate ? "not " : "") + "device_type=" + this.deviceType;
  }

  public matches(packet: AccessEventPacket): boolean {

    const data = packet.data as Record<string, unknown> | null;

    if(!data || (typeof data !== "object")) {

      return this.negate;
    }

    const deviceType = data.device_type as string | undefined;

    if(!deviceType) {

      return this.negate;
    }

    const matches = deviceType.toLowerCase() === this.deviceType.toLowerCase();

    return this.negate ? !matches : matches;
  }
}

// Composite filter for combining multiple filters with AND/OR logic.
class CompositeFilter implements EventFilter {

  private readonly filters: EventFilter[];
  private readonly operator: "and" | "or";

  constructor(filters: EventFilter[], operator: "and" | "or" = "and") {

    this.filters = filters;
    this.operator = operator;
  }

  public describe(): string {

    const descriptions = this.filters.map(f => f.describe());

    return "(" + descriptions.join(" " + this.operator.toUpperCase() + " ") + ")";
  }

  public matches(packet: AccessEventPacket, context: FilterContext): boolean {

    if(this.filters.length === 0) {

      return true;
    }

    if(this.operator === "and") {

      return this.filters.every(filter => filter.matches(packet, context));
    }

    return this.filters.some(filter => filter.matches(packet, context));
  }
}

// Doorbell ring event filter.
class DoorbellRingFilter implements EventFilter {

  public describe(): string {

    return "doorbell ring events";
  }

  public matches(packet: AccessEventPacket): boolean {

    return packet.event === "access.remote_view";
  }
}

// Door unlock event filter.
class UnlockFilter implements EventFilter {

  public describe(): string {

    return "unlock events";
  }

  public matches(packet: AccessEventPacket): boolean {

    return packet.event === "access.door.unlock";
  }
}

// Output formatter interface.
interface OutputFormatter {

  format(packet: AccessEventPacket, context: FilterContext): string;
}

// Default output formatter with colors and full depth.
class DefaultFormatter implements OutputFormatter {

  public format(packet: AccessEventPacket): string {

    return util.inspect(packet, { colors: true, depth: null, sorted: true });
  }
}

// JSON output formatter - one line per event, no colors.
class JsonFormatter implements OutputFormatter {

  public format(packet: AccessEventPacket): string {

    return JSON.stringify(packet);
  }
}

// Compact output formatter - event summary only.
class CompactFormatter implements OutputFormatter {

  public format(packet: AccessEventPacket, context: FilterContext): string {

    const deviceName = context.getDeviceName(packet.event_object_id) ?? packet.event_object_id;

    return "[" + packet.event + "] " + deviceName;
  }
}

// Fields output formatter - specific fields only.
class FieldsFormatter implements OutputFormatter {

  private readonly fields: string[];

  constructor(fields: string[]) {

    this.fields = fields;
  }

  public format(packet: AccessEventPacket): string {

    const result: Record<string, unknown> = {};

    for(const field of this.fields) {

      const value = this.getValueAtPath(packet, field);

      if(value !== undefined) {

        result[field] = value;
      }
    }

    return JSON.stringify(result);
  }

  private getValueAtPath(packet: AccessEventPacket, path: string): unknown {

    const parts = path.split(".");
    let current: unknown = packet;

    if(parts[0] === "data") {

      current = packet.data;
      parts.shift();
    } else if(parts[0] === "meta") {

      current = packet.meta;
      parts.shift();
    }

    for(const part of parts) {

      if((current === null) || (current === undefined)) {

        return undefined;
      }

      if(typeof current === "object") {

        current = (current as Record<string, unknown>)[part];
      } else {

        return undefined;
      }
    }

    return current;
  }
}

// Create a new Access API instance.
const ufa = new AccessApi();

// Debug mode flag.
let debugEnabled = false;

// Log utilities.
const log = {

  /* eslint-disable no-console */
  debug: (message: string, ...parameters: unknown[]): void => {

    if(debugEnabled) {

      console.error("[DEBUG] " + util.format(message, ...parameters));
    }
  },
  error: (message: string, ...parameters: unknown[]): void => console.error(util.format(message, ...parameters)),
  info: (message: string, ...parameters: unknown[]): void => console.log(util.format(message, ...parameters)),
  warn: (message: string, ...parameters: unknown[]): void => console.log(util.format(message, ...parameters))
  /* eslint-enable no-console */
};

// Parse command line arguments into structured options.
function parseArguments(argv: string[]): ParsedOptions {

  const options: ParsedOptions = {

    args: [],
    command: "",
    debug: false,
    filters: [],
    help: false,
    maxEvents: 0,
    outputFields: [],
    outputFormat: "default",
    statsMode: false,
    timeout: 0
  };

  const args = argv.slice(2);
  let i = 0;

  while(i < args.length) {

    const arg = args[i];

    // Global flags.
    if((arg === "--help") || (arg === "-h")) {

      options.help = true;
      i++;

      continue;
    }

    if((arg === "--debug") || (arg === "-d")) {

      options.debug = true;
      i++;

      continue;
    }

    // Output format flags.
    if(arg === "--json") {

      options.outputFormat = "json";
      i++;

      continue;
    }

    if(arg === "--compact") {

      options.outputFormat = "compact";
      i++;

      continue;
    }

    if(arg.startsWith("--fields=")) {

      options.outputFormat = "default";
      options.outputFields = arg.substring(9).split(",").map(f => f.trim());
      i++;

      continue;
    }

    // Event control flags.
    if(arg.startsWith("--timeout=")) {

      options.timeout = Number(arg.substring(10)) * 1000;
      i++;

      continue;
    }

    if(arg.startsWith("--count=")) {

      options.maxEvents = Number(arg.substring(8));
      i++;

      continue;
    }

    if(arg === "--stats") {

      options.statsMode = true;
      i++;

      continue;
    }

    // Device type shortcuts.
    if(arg === "--hubs") {

      options.filters.push(new DeviceTypeFilter("UAH"));
      i++;

      continue;
    }

    if(arg === "--readers") {

      options.filters.push(new DeviceTypeFilter("UA-Reader"));
      i++;

      continue;
    }

    // Special event type filters.
    if(arg === "--ring") {

      options.filters.push(new DoorbellRingFilter());
      i++;

      continue;
    }

    if(arg === "--unlock") {

      options.filters.push(new UnlockFilter());
      i++;

      continue;
    }

    // Device filter shortcut.
    if(arg.startsWith("--device=")) {

      options.filters.push(new PropertyFilter("device", "==", arg.substring(9)));
      i++;

      continue;
    }

    // Property filters in the form property=value, property!=value, property~value, etc.
    const filterMatch = arg.match(/^([a-zA-Z0-9_.]+)(==|!=|~|!~|>=|<=|>|<|=)(.+)$/);

    if(filterMatch) {

      const [ , path, op, value ] = filterMatch;
      const operator = (op === "=") ? "==" : op as FilterOperator;

      options.filters.push(new PropertyFilter(path, operator, value));
      i++;

      continue;
    }

    // First non-flag argument is the command.
    if(!options.command) {

      options.command = arg.toLowerCase();
      i++;

      continue;
    }

    // Remaining arguments are passed to the command.
    options.args.push(arg);
    i++;
  }

  return options;
}

// Create the filter context for resolving device names and accessing bootstrap data.
function createFilterContext(): FilterContext {

  const deviceIdMap = new Map<string, string>();
  const deviceNameMap = new Map<string, string>();

  // Build device name to ID mapping from bootstrap.
  if(ufa.devices) {

    for(const device of ufa.devices) {

      // We use || instead of ?? intentionally - we want to skip empty strings, not just null/undefined.
      // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
      const name = device.alias || device.name || "";

      if(name) {

        deviceNameMap.set(name.toLowerCase(), device.unique_id);
        deviceIdMap.set(device.unique_id, name);
      }
    }
  }

  return {

    bootstrap: ufa.bootstrap,

    getDeviceName: (id: string): string | null => deviceIdMap.get(id) ?? null,

    resolveDeviceName: (name: string): string | null => {

      // First check if it's already an ID.
      if(deviceIdMap.has(name)) {

        return name;
      }

      // Try to find by name (case-insensitive).
      return deviceNameMap.get(name.toLowerCase()) ?? null;
    }
  };
}

// Create the appropriate output formatter based on options.
function createFormatter(options: ParsedOptions): OutputFormatter {

  if(options.outputFields.length > 0) {

    return new FieldsFormatter(options.outputFields);
  }

  switch(options.outputFormat) {

    case "compact":

      return new CompactFormatter();

    case "json":

      return new JsonFormatter();

    default:

      return new DefaultFormatter();
  }
}

// Command handler type. Handlers may be sync or async depending on whether they need to await API calls.
type CommandHandler = (options: ParsedOptions) => Promise<void> | void;

// Bootstrap command - output the controller bootstrap data.
function handleBootstrap(options: ParsedOptions): void {

  if(options.help) {

    log.error("Usage: ufa bootstrap");
    log.error("");
    log.error("Output the complete bootstrap data from the Access controller.");
    log.error("");
    log.error("Options:");
    log.error("  --json     Output as JSON (no colors)");

    process.exit(0);
  }

  const output = (options.outputFormat === "json") ? JSON.stringify(ufa.bootstrap) : util.inspect(ufa.bootstrap, { colors: true, depth: null, sorted: true });

  process.stdout.write(output + "\n", () => process.exit(0));
}

// Controller command - output the controller configuration.
function handleController(options: ParsedOptions): void {

  if(options.help) {

    log.error("Usage: ufa controller");
    log.error("");
    log.error("Output the controller configuration from the Access controller.");
    log.error("");
    log.error("Options:");
    log.error("  --json     Output as JSON (no colors)");

    process.exit(0);
  }

  const output = (options.outputFormat === "json") ? JSON.stringify(ufa.controller) : util.inspect(ufa.controller, { colors: true, depth: null, sorted: true });

  process.stdout.write(output + "\n", () => process.exit(0));
}

// Devices command - output all devices.
function handleDevices(options: ParsedOptions): void {

  if(options.help) {

    log.error("Usage: ufa devices");
    log.error("");
    log.error("Output all devices from the Access controller.");
    log.error("");
    log.error("Options:");
    log.error("  --json     Output as JSON (no colors)");

    process.exit(0);
  }

  const output = (options.outputFormat === "json") ? JSON.stringify(ufa.devices) : util.inspect(ufa.devices, { colors: true, depth: null, sorted: true });

  process.stdout.write(output + "\n", () => process.exit(0));
}

// Doors command - output all doors.
function handleDoors(options: ParsedOptions): void {

  if(options.help) {

    log.error("Usage: ufa doors");
    log.error("");
    log.error("Output all doors from the Access controller.");
    log.error("");
    log.error("Options:");
    log.error("  --json     Output as JSON (no colors)");

    process.exit(0);
  }

  const output = (options.outputFormat === "json") ? JSON.stringify(ufa.doors) : util.inspect(ufa.doors, { colors: true, depth: null, sorted: true });

  process.stdout.write(output + "\n", () => process.exit(0));
}

// Floors command - output all floors.
function handleFloors(options: ParsedOptions): void {

  if(options.help) {

    log.error("Usage: ufa floors");
    log.error("");
    log.error("Output all floors from the Access controller.");
    log.error("");
    log.error("Options:");
    log.error("  --json     Output as JSON (no colors)");

    process.exit(0);
  }

  const output = (options.outputFormat === "json") ? JSON.stringify(ufa.floors) : util.inspect(ufa.floors, { colors: true, depth: null, sorted: true });

  process.stdout.write(output + "\n", () => process.exit(0));
}

// Events command - listen for and display realtime events.
function handleEvents(options: ParsedOptions): void {

  if(options.help) {

    log.error("Usage: ufa events [filters...] [options]");
    log.error("");
    log.error("Listen for realtime events from the Access controller.");
    log.error("");
    log.error("Filter Syntax:");
    log.error("  property=value      Match property equals value (case-insensitive)");
    log.error("  property!=value     Match property not equals value");
    log.error("  property~pattern    Match property contains/matches pattern");
    log.error("  property!~pattern   Match property does not contain/match pattern");
    log.error("  property>/</>=/<=/value  Numeric comparisons");
    log.error("");
    log.error("  Patterns can be:");
    log.error("    - Simple text (contains match)");
    log.error("    - Glob patterns with * and ? wildcards");
    log.error("    - Regex patterns delimited by / (e.g., /^access\\.door/i)");
    log.error("");
    log.error("  Property paths:");
    log.error("    - Top-level properties: event, event_object_id, receiver_id");
    log.error("    - Data properties: data.device_type, data.name");
    log.error("    - Meta properties: meta.source, meta.object_type");
    log.error("");
    log.error("Device Shortcuts:");
    log.error("  --device=NAME       Filter by device name (resolved to ID)");
    log.error("  --hubs              Filter for hub events only");
    log.error("  --readers           Filter for reader events only");
    log.error("");
    log.error("Event Type Shortcuts:");
    log.error("  --ring              Filter for doorbell ring events");
    log.error("  --unlock            Filter for door unlock events");
    log.error("");
    log.error("Output Options:");
    log.error("  --json              Output as JSON (one event per line, no colors)");
    log.error("  --compact           Output compact format (event summary only)");
    log.error("  --fields=a,b,c      Output specific fields only as JSON");
    log.error("");
    log.error("Control Options:");
    log.error("  --timeout=SECONDS   Exit after specified seconds");
    log.error("  --count=N           Exit after N events");
    log.error("  --stats             Show event statistics instead of raw events");
    log.error("");
    log.error("Examples:");
    log.error("  ufa events                                    # All events");
    log.error("  ufa events --hubs                             # Hub events only");
    log.error("  ufa events --device=\"Test Name 37\"              # Events for specific device");
    log.error("  ufa events event=access.door.unlock           # Unlock events");
    log.error("  ufa events event~\"/^access\\.door/\"            # Regex filter");
    log.error("  ufa events --json --count=10                  # 10 events as JSON");

    process.exit(0);
  }

  // Legacy support: if we have exactly 2 positional args, treat as property=value filter.
  if((options.args.length === 2) && (options.filters.length === 0)) {

    options.filters.push(new PropertyFilter(options.args[0], "==", options.args[1]));
  }

  const compositeFilter = new CompositeFilter(options.filters, "and");
  const context = createFilterContext();
  const formatter = createFormatter(options);
  const stats: EventStats = { byEvent: {}, total: 0 };

  let eventCount = 0;
  let timeoutHandle: NodeJS.Timeout | null = null;

  // Graceful shutdown handler.
  const shutdown = (): void => {

    if(options.statsMode) {

      log.info("");
      log.info("Event Statistics:");
      log.info("  Total events: %d", stats.total);
      log.info("");
      log.info("  By Event Type:");

      for(const [ key, count ] of Object.entries(stats.byEvent).sort((a, b) => b[1] - a[1])) {

        log.info("    %s: %d", key, count);
      }
    }

    if(timeoutHandle) {

      clearTimeout(timeoutHandle);
    }

    process.exit(0);
  };

  // Set up signal handlers for graceful shutdown.
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  // Set up timeout if specified.
  if(options.timeout > 0) {

    timeoutHandle = setTimeout(shutdown, options.timeout);
  }

  // Listen for events.
  ufa.on("message", (packet: AccessEventPacket) => {

    // Apply filters.
    if(!compositeFilter.matches(packet, context)) {

      return;
    }

    eventCount++;

    if(options.statsMode) {

      // Update statistics.
      stats.total++;
      stats.byEvent[packet.event] = (stats.byEvent[packet.event] ?? 0) + 1;
    } else {

      // Output the event.
      log.info(formatter.format(packet, context));
    }

    // Check event count limit.
    if((options.maxEvents > 0) && (eventCount >= options.maxEvents)) {

      shutdown();
    }
  });

  log.debug("Listening for events with %d filters.", options.filters.length);

  if(options.filters.length > 0) {

    log.debug("Filters: %s", compositeFilter.describe());
  }
}

// Restart command - restart devices.
async function handleRestart(options: ParsedOptions): Promise<void> {

  if(options.help) {

    log.error("Usage: ufa restart devices");
    log.error("");
    log.error("Restart all connected devices that are not currently rebooting.");

    process.exit(0);
  }

  if((options.args.length !== 1) || (options.args[0] !== "devices")) {

    log.error("Usage: ufa restart devices");

    process.exit(1);
  }

  for(const device of ufa.devices?.filter(x => !x.is_rebooting && x.is_connected) ?? []) {

    // eslint-disable-next-line no-await-in-loop
    const response = await ufa.retrieve(ufa.getApiEndpoint("device") + "/" + device.unique_id + "/restart", { body: JSON.stringify({}), method: "PUT" });

    if(!ufa.responseOk(response?.statusCode)) {

      log.error("%s: unable to reboot: %s", ufa.getDeviceName(device), response);

      break;
    }

    log.info("%s: restarted.", ufa.getDeviceName(device));
  }

  process.exit(0);
}

// Unlock command - unlock a door.
async function handleUnlock(options: ParsedOptions): Promise<void> {

  if(options.help) {

    log.error("Usage: ufa unlock DEVICE_NAME [DURATION]");
    log.error("");
    log.error("Unlock a door.");
    log.error("");
    log.error("Arguments:");
    log.error("  DEVICE_NAME    Name of the device to unlock");
    log.error("  DURATION       Optional unlock duration in seconds (default: controller default)");

    process.exit(0);
  }

  if((options.args.length < 1) || (options.args.length > 2)) {

    log.error("Usage: ufa unlock DEVICE_NAME [DURATION]");

    process.exit(1);
  }

  const deviceName = options.args[0];
  const device = ufa.devices?.find(dev => {

    // We use || instead of ?? intentionally - we want to skip empty strings, not just null/undefined.
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    const name = dev.alias || dev.name || "";

    return name.toLowerCase() === deviceName.toLowerCase();
  });

  if(!device) {

    log.error("Device not found: %s", deviceName);
    listDevices();

    process.exit(1);
  }

  let duration: number | undefined;

  if(options.args.length === 2) {

    duration = Number(options.args[1]);

    if(Number.isNaN(duration) || (duration <= 0)) {

      log.error("Duration must be a positive number.");

      process.exit(1);
    }
  }

  const success = await ufa.unlock(device, duration);

  if(!success) {

    log.error("%s: unable to unlock.", ufa.getDeviceName(device));

    process.exit(1);
  }

  log.info("%s: unlocked%s.", ufa.getDeviceName(device), duration ? " for " + duration + " seconds" : "");

  process.exit(0);
}

// Command registry.
const commands: Partial<Record<string, CommandHandler>> = {

  bootstrap: handleBootstrap,
  controller: handleController,
  devices: handleDevices,
  doors: handleDoors,
  events: handleEvents,
  floors: handleFloors,
  restart: handleRestart,
  unlock: handleUnlock
};

// List devices helper function.
function listDevices(): void {

  if(!ufa.devices?.length) {

    return;
  }

  log.error("");
  log.error("Devices:");

  for(const device of ufa.devices) {

    log.error("  %s => %s", (device.alias ?? device.name) ?? device.display_model, device.unique_id);
  }
}

// Show usage information.
function usage(): never {

  log.error("Usage: ufa [--debug] [--help] COMMAND [options]");
  log.error("");
  log.error("Commands:");
  log.error("  bootstrap    Output the controller bootstrap data");
  log.error("  controller   Output the controller configuration");
  log.error("  devices      Output all devices");
  log.error("  doors        Output all doors");
  log.error("  events       Listen for realtime events");
  log.error("  floors       Output all floors");
  log.error("  restart      Restart devices");
  log.error("  unlock       Unlock a door");
  log.error("");
  log.error("Global Options:");
  log.error("  --debug, -d  Enable debug output");
  log.error("  --help, -h   Show help for a command");
  log.error("");
  log.error("Run 'ufa COMMAND --help' for more information on a command.");

  listDevices();

  process.exit(1);
}

// Load configuration.
function loadConfig(): UfaConfig {

  const configFile = [ "ufa.json", homedir() + "/.ufa.json" ].find(path => existsSync(path));

  if(!configFile) {

    log.error("No credentials found in ./ufa.json or ~/.ufa.json.");
    log.error("Credentials must be in JSON form with properties: controller, username, password");

    process.exit(1);
  }

  let config: UfaConfig;

  try {

    config = JSON.parse(readFileSync(configFile, "utf8")) as UfaConfig;
  } catch(error) {

    log.error("Failed to parse configuration file: %s", configFile);
    log.error("Ensure the file contains valid JSON.");

    process.exit(1);
  }

  if(!config.controller || !config.username || !config.password) {

    log.error("Configuration file is missing required properties.");
    log.error("Required: controller, username, password");

    process.exit(1);
  }

  return config;
}

// Main execution.
async function main(): Promise<void> {

  const options = parseArguments(process.argv);

  debugEnabled = options.debug;

  // Show general help if requested without a command.
  if(options.help && !options.command) {

    usage();
  }

  // Require a command.
  if(!options.command) {

    usage();
  }

  // Check if the command exists.
  const handler = commands[options.command];

  if(!handler) {

    log.error("Unknown command: %s", options.command);
    usage();
  }

  // Load configuration and connect.
  const config = loadConfig();

  log.debug("Connecting to %s", config.controller);

  if(!(await ufa.login(config.controller, config.username, config.password))) {

    log.error("Invalid login credentials.");

    process.exit(1);
  }

  log.debug("Logged in successfully.");

  if(!(await ufa.getBootstrap())) {

    log.error("Unable to bootstrap the Access controller.");

    process.exit(1);
  }

  log.debug("Bootstrap complete. Found %d devices.", ufa.devices?.length ?? 0);

  // Silently exit on pipe errors but still process other errors.
  process.stdout.on("error", (err) => {

    if((err instanceof Error) && ("code" in err) && (typeof (err as NodeJS.ErrnoException).code === "string") && (err.code === "EPIPE")) {

      process.exit(0);
    } else {

      throw err;
    }
  });

  // Execute the command.
  await handler(options);
}

// Run main.
main().catch((error) => {

  log.error("Fatal error: %s", error);

  process.exit(1);
});

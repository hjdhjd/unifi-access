/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * client.ts: How the CLI connects - credential-to-client assembly, the surface-gating policy, and the stderr-routed logger every command shares.
 */
import type { AccessApiOverride, AccessLogging } from "../../index.ts";
import type { LoadCredentialsOptions, UfaCredentials } from "./credentials.ts";
import { AccessClient } from "../../index.ts";
import { CliError } from "./shared.ts";
import type { CommandContext } from "./shared.ts";
import type { OutputStream } from "./output/format.ts";
import { inspect } from "node:util";
import { loadCredentials } from "./credentials.ts";

/**
 * Options for {@link openClient}. `api` pins the routed door commands to one of the controller's APIs; `credentials` is a pre-loaded identity from
 * {@link loadUfaIdentity}, which a mode-gated command supplies so the file is read exactly once per invocation; `cwd`/`home` are forwarded to credential discovery
 * (tests point them at a fixture); `log` is the logger the library emits through; `debug` turns on verbose logging in the default stderr logger and has no effect when
 * the caller supplies its own `log`; `refreshIntervalMs` overrides the bootstrap-refresh failsafe cadence (a one-shot command passes `false` to skip the failsafe
 * entirely); `signal` is the Ctrl-C lifetime.
 *
 * @category CLI
 */
export interface OpenClientOptions {

  api?: AccessApiOverride;
  credentials?: UfaCredentials;
  cwd?: string;
  debug?: boolean;
  home?: string;
  log?: AccessLogging;
  refreshIntervalMs?: number | false;
  signal?: AbortSignal;
}

// Render a log line's trailing context. Library calls pass structured context (`log.warn("...", { reason })`) or an error; we inspect non-string parameters so an
// object or Error prints legibly on stderr rather than as "[object Object]" or an empty "{}". Colors are off - log noise should not compete with the command's own
// output.
function renderParameters(parameters: unknown[]): string {

  if(parameters.length === 0) {

    return "";
  }

  // We set `depth` to 4 rather than Node's default of 2 so a nested context object - an outer bag holding an error or a device detail a level or two down - renders in
  // full instead of collapsing its inner levels to "[Object]".
  return " " + parameters.map((parameter) => (typeof parameter === "string") ? parameter : inspect(parameter, { colors: false, depth: 4 })).join(" ");
}

/**
 * Build the CLI's {@link AccessLogging} adapter. Every library log line is routed to stderr, never stdout, so a command's payload is never interleaved with
 * diagnostics. Warnings and errors always print - a throttle, a stall, a reconnect is something the operator wants told - while the lower-volume `info` lifecycle
 * lines and `debug` detail print only with `--debug`, so a plain command emits just its own output on stdout and nothing on stderr unless something went wrong. Each
 * line is tagged with its level so a human reading stderr can tell a warning from an error at a glance. The library's own messages are complete sentences already, so
 * nothing here rewrites them.
 *
 * @param opts - Whether debug is enabled, and the stream to write to (defaults to stderr).
 *
 * @returns An `AccessLogging` implementation.
 *
 * @category CLI
 */
export function createCliLogger(opts: { debug?: boolean; stream?: OutputStream } = {}): AccessLogging {

  const stream = opts.stream ?? process.stderr;
  const debugEnabled = opts.debug ?? false;
  const emit = (level: string, message: string, parameters: unknown[]): void => void stream.write("[" + level + "] " + message + renderParameters(parameters) + "\n");

  return {

    debug: (message: string, ...parameters: unknown[]): void => {

      if(debugEnabled) {

        emit("debug", message, parameters);
      }
    },
    error: (message: string, ...parameters: unknown[]): void => emit("error", message, parameters),
    info: (message: string, ...parameters: unknown[]): void => {

      if(debugEnabled) {

        emit("info", message, parameters);
      }
    },
    warn: (message: string, ...parameters: unknown[]): void => emit("warn", message, parameters)
  };
}

/**
 * Load the CLI's identity file once for this invocation. A mode-gated command calls this before connecting - the loaded value answers what the file's identities can
 * reach (see {@link requireSurface}) and is then handed to {@link openClient}, so the file is read exactly once and there is no read-then-read-again window for it to
 * change under the invocation.
 *
 * @param opts - Optional discovery overrides, forwarded to the loader.
 *
 * @returns The normalized credentials, identity union included.
 *
 * @throws {@link CliError} when no configuration is found or the one found is unusable.
 *
 * @category CLI
 */
export async function loadUfaIdentity(opts: LoadCredentialsOptions = {}): Promise<UfaCredentials> {

  return loadCredentials(opts);
}

/**
 * Refuse an operation the supplied identities cannot reach, before anything connects. The one home for the CLI's surface-gating policy: the credential arm guards the
 * Access application's own endpoints (the topology, the device projections), the official arm guards the published API - and the official arm also honors an
 * `--api direct-only` pin, because the pin means "stay off the official channel" and an operation with no direct expression cannot honor it. Commands never restate
 * this refusal wording anywhere; they name their operation and let the message compose here.
 *
 * The presence checks read the identity union's own shape, so the union stays the single model with no parallel booleans maintained beside it.
 *
 * @param credentials - The loaded identity file.
 * @param surface     - Which of the controller's APIs the operation rides.
 * @param operation   - The operation, as the refusal names it (e.g. "info command").
 * @param apiOverride - The `--api` pin in force, when the command accepts one.
 *
 * @throws {@link CliError} when the identities cannot reach the surface (exit 1), or when a pin contradicts it (exit 2).
 *
 * @category CLI
 */
export function requireSurface(credentials: UfaCredentials, surface: "credential" | "official", operation: string, apiOverride?: AccessApiOverride): void {

  if(surface === "credential") {

    if(!("username" in credentials.identity)) {

      throw new CliError("The " + operation + " rides the Access application's own endpoints, which require credentials the ufa.json configuration does not " +
        "carry. A token-only configuration acts through the door group and the api hatch.");
    }

    return;
  }

  if(apiOverride === "direct-only") {

    throw new CliError("The " + operation + " rides the official API alone, so it cannot run with --api direct-only.", { exitCode: 2 });
  }

  if(!("token" in credentials.identity)) {

    throw new CliError("The " + operation + " rides the official API, which requires a token the ufa.json configuration does not carry.");
  }
}

/**
 * Refuse an operation whose official path folded away at connect. The post-connect half of the gate {@link requireSurface} opens: a configuration can carry a token
 * and still connect without a working official path - an Identity Enterprise controller refuses the token as unsupported - so the runtime verdict is honored here
 * rather than assumed from the file's shape.
 *
 * @param client    - The connected client.
 * @param operation - The operation, as the refusal names it.
 *
 * @returns The official facade, non-null.
 *
 * @throws {@link CliError} when the client has no working official path.
 *
 * @category CLI
 */
export function requireOfficial(client: AccessClient, operation: string): NonNullable<AccessClient["official"]> {

  const official = client.official;

  if(official === null) {

    throw new CliError("The " + operation + " rides the official API, which this controller did not offer the client's token.");
  }

  return official;
}

/**
 * Load the identity file, gate it on the official surface, and connect - the one connect path every official-consumer command shares, so the gate order (load once,
 * refuse calmly, then connect with the failsafe off) is stated here rather than restated per command. The caller still holds the client with `await using` at its own
 * call site, and still asks {@link requireOfficial} for the facade, because the capability verdict is the connected client's to give.
 *
 * @param ctx       - The command context's injected hooks and lifetime signal.
 * @param operation - The operation, as a refusal names it.
 * @param opts      - The api pin and debug flag to thread through.
 *
 * @returns A connected client.
 *
 * @throws {@link CliError} when the identity file cannot serve the official surface, or whatever the connect itself throws.
 *
 * @category CLI
 */
export async function openOfficialClient(ctx: Pick<CommandContext, "loadCredentials" | "openClient" | "signal">, operation: string,
  opts: { api?: AccessApiOverride; debug?: boolean } = {}): Promise<AccessClient> {

  const credentials = await ctx.loadCredentials();

  requireSurface(credentials, "official", operation, opts.api);

  return ctx.openClient({ ...((opts.api !== undefined) && { api: opts.api }), credentials, debug: opts.debug === true, refreshIntervalMs: false,
    signal: ctx.signal });
}

/**
 * Load credentials and connect a ready {@link AccessClient}. The single home for "how the ufa CLI connects" - commands reach it through the injected `ctx.openClient`
 * hook (`await using client = await ctx.openClient({ debug, signal })`, never by importing this opener directly), so the `await using` lifetime is visible at each call
 * site while the credential loading and connect assembly live in exactly one place. A caller that already loaded the identity file (through {@link loadUfaIdentity},
 * to gate on it) passes it in `credentials` and the load is skipped.
 *
 * An `api` pin the identities cannot honor is refused here as a calm usage error, before anything is sent - the library raises the same contradiction as a
 * `TypeError`, which is its correct answer to a programming error, but an operator's typo deserves a usage error rather than a stack. The two rails serve different
 * audiences by design.
 *
 * @param opts - The api pin, pre-loaded credentials or discovery overrides, logger, refresh cadence, and the Ctrl-C signal.
 *
 * @returns A connected client.
 *
 * @throws {@link CliError} when credentials cannot be loaded or contradict the api pin, or the typed `FatalError` the library throws on a failed connect.
 *
 * @category CLI
 */
export async function openClient(opts: OpenClientOptions = {}): Promise<AccessClient> {

  const credentials = opts.credentials ??
    await loadCredentials({ ...((opts.cwd !== undefined) && { cwd: opts.cwd }), ...((opts.home !== undefined) && { home: opts.home }) });

  if((opts.api === "direct-only") && !("username" in credentials.identity)) {

    throw new CliError("The --api direct-only pin requires credentials, and the ufa.json configuration carries only a token.", { exitCode: 2 });
  }

  if((opts.api === "official-only") && !("token" in credentials.identity)) {

    throw new CliError("The --api official-only pin requires a token, and the ufa.json configuration carries only credentials.", { exitCode: 2 });
  }

  // Use the caller's logger if it supplied one; otherwise build the standard stderr logger, honoring --debug. Either way the library logs land on stderr, never stdout.
  const log = opts.log ?? createCliLogger({ debug: opts.debug ?? false });

  return AccessClient.connect({

    ...credentials.identity,
    ...((opts.api !== undefined) && { api: opts.api }),
    host: credentials.host,
    log,
    ...((opts.refreshIntervalMs !== undefined) && { refreshIntervalMs: opts.refreshIntervalMs }),
    ...((opts.signal !== undefined) && { signal: opts.signal }),
    ...((credentials.verifyTls !== undefined) && { verifyTls: credentials.verifyTls })
  });
}

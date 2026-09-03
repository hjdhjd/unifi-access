/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * doctor.ts: `ufa doctor` - a structured, per-subsystem health check exercising every public surface the client's mode offers. The canonical "is my install
 * healthy?" command.
 */
import { AccessAbortedError, AccessClient, channels, selectControllerUptime } from "../../../index.ts";
import type { CommandHandler, CommandSpec } from "../shared.ts";
import type { AccessEventPacket } from "../../../index.ts";
import { COMMON_OPTIONS } from "../shared.ts";
import type { Output } from "../output/format.ts";
import { formatDuration } from "../output/format.ts";
import { parseArgs } from "node:util";

const USAGE = [

  "Usage: ufa doctor [--json] [--debug]",
  "",
  "Run a structured health check of every library subsystem against the controller and report pass/fail per check.",
  "The check set follows the client's mode: the derived-state check runs where credentials establish a topology, and the official facade check",
  "runs where a token establishes the official path. Exits non-zero if any check fails, so it is usable as a monitoring probe.",
  "It reads and observes only - no door is ever commanded.",
  "",
  "Options:",
  "  --json      Emit the results as a JSON object instead of a report.",
  "  --debug     Emit the library's debug logging to stderr.",
  "  -h, --help  Show this help.",
  "",
  "Examples:",
  "  ufa doctor                       # human-readable pass/fail report",
  "  ufa doctor --json || echo failed # machine-readable; non-zero exit on any failure"
].join("\n");

/* How long to watch the notification stream for a sign of life. An Access site is quiet by nature - it speaks when someone opens a door, not on a timer - so this is
 * long enough to catch an ordinary site's background chatter without making a health check feel stalled. A window that closes empty is reported as a warning rather
 * than a failure for that same reason: silence here is normal, and it is the connection monitor that knows whether the channel is actually up.
 */
const DOCTOR_EVENT_WAIT_MS = 8000;

// The channels whose traffic proves the run reached the controller at all. Read off the roster rather than spelled out, so the channel names live in exactly one
// place - the library's own declaration - and this check cannot drift from a rename.
const REQUIRED_CHANNELS = [ channels.httpRequestEnd, channels.httpRequestStart ];

// A single check's verdict. `pass` is healthy, `warn` is a non-fatal observation worth flagging, `fail` is a real problem and fails the exit code.
type CheckStatus = "fail" | "pass" | "warn";

interface CheckResult {

  detail?: string;
  name: string;
  status: CheckStatus;
}

// Render a status as a fixed-width, colored tag so the report reads as an aligned column.
function statusTag(output: Output, status: CheckStatus): string {

  switch(status) {

    case "pass": {

      return output.colors.green("PASS");
    }

    case "warn": {

      return output.colors.yellow("WARN");
    }

    default: {

      return output.colors.red("FAIL");
    }
  }
}

// Render the report as an aligned list of checks plus a summary, returning whether every check passed (for the exit code).
function renderReport(output: Output, results: CheckResult[]): boolean {

  for(const result of results) {

    const detail = (result.detail !== undefined) ? ("  " + output.colors.dim(result.detail)) : "";

    output.line(statusTag(output, result.status) + "  " + output.colors.bold(result.name) + detail);
  }

  const passed = results.filter((result) => result.status === "pass").length;
  const warned = results.filter((result) => result.status === "warn").length;
  const failed = results.filter((result) => result.status === "fail").length;

  output.line();
  output.line(output.colors.bold(passed.toString() + " passed, " + warned.toString() + " warnings, " + failed.toString() + " failed."));

  return failed === 0;
}

// Watch the notification stream for the first packet, or until the window closes. The iteration ends at whichever comes first, so a healthy busy site answers
// immediately and a quiet one costs exactly the window.
async function observeFirstPacket(client: AccessClient, signal: AbortSignal): Promise<AccessEventPacket | null> {

  const deadline = AbortSignal.any([ signal, AbortSignal.timeout(DOCTOR_EVENT_WAIT_MS) ]);

  for await (const packet of client.rawPackets({ signal: deadline })) {

    return packet;
  }

  return null;
}

/**
 * `ufa doctor`. Connects once and exercises the subsystems the client's mode offers, each as a discrete check: the connect handshake and the capability map every
 * mode carries, the inventory every census establishes, the derived selectors where credentials establish a topology, the door-state rail, the official facade where
 * a token establishes the official path, the realtime firehose and what the classifier makes of what it carried, the connection monitor, and the diagnostics
 * channels asserted to have fired during the run. A check whose subject does not exist in the client's mode is absent from the results rather than failed - a
 * token-only client has no topology to judge, and reporting one as broken would be a fabrication. Designed as a permanent health probe: it exits non-zero if any
 * check fails.
 *
 * A Ctrl-C anywhere in the run ends it through the entry point's cascade rather than being folded into a check verdict. An operator who stops a health check has not
 * discovered a failure, and a report that said so would be a fabrication.
 *
 * @category CLI
 */
const doctorHandler: CommandHandler = async (ctx) => {

  const { values } = parseArgs({ allowPositionals: true, args: ctx.args, options: { ...COMMON_OPTIONS, json: { type: "boolean" } }, strict: true });

  if(values.help === true) {

    ctx.output.line(USAGE);

    return;
  }

  const results: CheckResult[] = [];

  /* Every check runs through this single chokepoint. It turns an unexpected thrown error into a `fail` result, so one probe's crash demotes to a failed check rather
   * than taking the remaining checks down with it, and it re-raises a caller abort on both sides of the await - before the check runs and after it throws - so a
   * Ctrl-C ends the run instead of being recorded as though the subsystem had failed.
   */
  const check = async (name: string, run: () => Promise<Omit<CheckResult, "name">>): Promise<void> => {

    if(ctx.signal.aborted) {

      throw new AccessAbortedError("The health check was stopped by the caller's signal.");
    }

    try {

      results.push({ name, ...(await run()) });
    } catch(error) {

      if(error instanceof AccessAbortedError) {

        throw error;
      }

      results.push({ detail: (error instanceof Error) ? error.message : String(error), name, status: "fail" });
    }
  };

  // Observe which diagnostics channels fire during the run by subscribing before we connect, so the connect handshake's own traffic is counted.
  const fired = new Set<string>();
  const subscriptions = Object.values(channels).map((channel) => {

    const name = String(channel.name);
    const handler = (): void => void fired.add(name);

    channel.subscribe(handler);

    return { channel, handler };
  });

  let client: AccessClient | undefined;

  try {

    // The connect itself is the first check; a failure here aborts the rest, because there is nothing to test without a client.
    try {

      client = await ctx.openClient({ debug: values.debug === true, signal: ctx.signal });

      const caps = client.capabilities;
      const pinned = (caps.override !== "auto") ? (", pinned to " + caps.override) : "";

      results.push({ detail: "connected to " + (client.controllerName ?? "the controller") + " in " + caps.mode + " mode" + pinned,
        name: "Connect and authenticate", status: "pass" });
    } catch(error) {

      if(error instanceof AccessAbortedError) {

        throw error;
      }

      results.push({ detail: (error instanceof Error) ? error.message : String(error), name: "Connect and authenticate", status: "fail" });

      const ok = (values.json === true) ? false : renderReport(ctx.output, results);

      if(values.json === true) {

        ctx.output.jsonPretty({ ok, results });
      }

      process.exitCode = 1;

      return;
    }

    const connected = client;
    const capabilities = connected.capabilities;
    const snapshot = connected.state.snapshot();
    const official = connected.official;
    const hasTopology = capabilities.mode !== "token";

    // The operator's one-glance answer to "what kind of client is this": informational by design, never a verdict.
    await check("Capabilities", () => Promise.resolve({

      detail: "mode=" + capabilities.mode + ", official=" + capabilities.official.toString() + ", override=" + capabilities.override,
      status: "pass"
    }));

    /* What the client's own census of the controller established, whichever census that was. The counts report an inventory rather than judge one: a client with no
     * topology has no root document to hold against, and an empty count is itself the diagnosis an operator came here for.
     */
    await check("State and inventory", () => Promise.resolve({

      detail: [ connected.devices.length.toString() + " devices", connected.hubs.length.toString() + " hubs",
        connected.accessPoints.length.toString() + " access points", snapshot.floors.size.toString() + " floors",
        snapshot.doors.size.toString() + " doors" ].join(", "),
      status: (!hasTopology || (snapshot.root !== null)) ? "pass" : "fail"
    }));

    // The selector check runs where its subject exists: a token-only client has no topology document and no privileged account, so judging either would fabricate
    // a failure about a surface the mode does not carry.
    if(hasTopology) {

      await check("Derived state (selectors)", () => {

        const uptime = selectControllerUptime(snapshot);

        return Promise.resolve({

          detail: "controllerName=" + (connected.controllerName ?? "null") + ", isAdmin=" + String(connected.isAdmin) + ", uptime " +
            ((uptime !== null) ? formatDuration(uptime * 1000) : "unknown"),
          status: (connected.controllerName !== null) ? "pass" : "fail"
        });
      });
    }

    await check("Door states", () => Promise.resolve({

      // Door state is seeded at connect from what the mode's own read establishes - the topology's hardware readings, the official doors read - and corrected live
      // by the stream, so the count reports what those sources had to say. It is reported and never judged.
      detail: connected.doorStates.size.toString() + " doors carry established state",
      status: "pass"
    }));

    // The official facade check runs where the official path exists, and stands in as token mode's read probe: a working token answers the doors read.
    if(official !== null) {

      await check("Official API facade", async () => {

        const doors = await official.spaces.fetchAll({ signal: ctx.signal });

        return { detail: doors.length.toString() + " doors visible through the official API", status: "pass" };
      });
    }

    /* The stream window runs once, here, and feeds two checks: whether anything arrived, and what the classifier made of it. It is a plain step rather than a check
     * of its own because one observation cannot be made twice - a second window would either wait all over again or report on a different packet.
     */
    let observed: AccessEventPacket | null = null;
    let windowFailure: string | undefined;

    try {

      observed = await observeFirstPacket(connected, ctx.signal);
    } catch(error) {

      // A caller abort leaves the observation empty and is handled where every other abort is - at the next check, which re-raises it. Anything else is a genuine
      // stream failure and belongs to the firehose check below, which is the one that owns stream health.
      if(!(error instanceof AccessAbortedError)) {

        windowFailure = (error instanceof Error) ? error.message : String(error);
      }
    }

    await check("Realtime event firehose", () => Promise.resolve({

      detail: windowFailure ?? ((observed !== null) ? ("first packet: " + observed.event) :
        ("no packet within " + (DOCTOR_EVENT_WAIT_MS / 1000).toString() + "s, which is normal on a quiet site")),
      status: (windowFailure !== undefined) ? "fail" : ((observed !== null) ? "pass" : "warn")
    }));

    await check("Event classification", () => {

      // Informational by design: one packet is a sample, not a survey, and plenty of the controller's notifications are deliberately unmodeled. The row reports what
      // the sample was so an unfamiliar name is visible in a support log, and never fails on it.
      const classified = (observed !== null) ? AccessClient.classifyPacket(observed) : null;

      return Promise.resolve({

        detail: (observed === null) ? "no packet observed to classify" : ((classified !== null) ?
          ("the observed packet classified as " + classified.kind + " (a one-packet sample)") :
          ("the observed packet (" + observed.event + ") is not modeled (a one-packet sample)")),
        status: "pass"
      });
    });

    await check("Connection monitor", () => Promise.resolve({

      detail: "state=" + connected.connection.state + ", throttled=" + connected.connection.isThrottled.toString(),
      status: connected.connection.isHealthy ? "pass" : "fail"
    }));

    await check("Diagnostics channels", () => Promise.resolve({

      detail: fired.size.toString() + " of " + Object.keys(channels).length.toString() + " channels fired during the run",
      status: REQUIRED_CHANNELS.every((channel) => fired.has(String(channel.name))) ? "pass" : "warn"
    }));

    const ok = (values.json === true) ? (results.every((result) => result.status !== "fail")) : renderReport(ctx.output, results);

    if(values.json === true) {

      ctx.output.jsonPretty({ ok, results });
    }

    process.exitCode = ok ? 0 : 1;
  } finally {

    for(const { channel, handler } of subscriptions) {

      channel.unsubscribe(handler);
    }

    if(client !== undefined) {

      await client[Symbol.asyncDispose]();
    }
  }
};

// The command descriptor: the handler above plus the one-line summary the usage screen lists it by, so the listing derives from the same object that dispatches.
export const doctor: CommandSpec = {

  run: doctorHandler,
  summary: "Run a per-subsystem health check against the controller and report pass/fail."
};

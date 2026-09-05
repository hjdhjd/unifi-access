/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * cli.helpers.ts: The offline test rig for the ufa CLI - the structural fake client, the capturing command context, and the capture-corpus specimens.
 *
 * Everything here serves the suite's one discipline: commands reach the controller only through the injected hooks, so a structural fake stands in for a connected
 * client and the assertions are about what each command reads, writes, and commands - never about a live controller. The fake implements only what the command
 * modules actually consume, which is what keeps it honest: a command that starts reading something new fails here rather than silently passing against a mock that
 * answered everything. The single cast to the client type is at the fake's return, marked, and is the one place in the suite where the structural stand-in is
 * asserted to be a client.
 */
import type { AccessApiOverride, AccessCapabilities, AccessDoorStateEntry, AccessEventPacket, AccessLockRule, AccessOfficialDoorUnlockActor,
  AccessStateDevice } from "../../index.ts";
import type { CommandContext, LoadCredentials, OpenClient } from "./shared.ts";
import { isTamperCapable as readTamperCapability, tamperState as readTamperState } from "../../index.ts";
import { Output } from "./output/format.ts";
import type { UfaCredentials } from "./credentials.ts";
import { setTimeout as delay } from "node:timers/promises";

/**
 * Pull one specimen out of a capture corpus by the notification name it arrived under, so a test names the packet it means rather than an index that a corpus edit
 * could quietly repoint at a different packet.
 */
export function specimen(corpus: AccessEventPacket[], event: string): AccessEventPacket {

  const packet = corpus.find((candidate) => candidate.event === event);

  if(packet === undefined) {

    throw new Error("The capture corpus carries no \"" + event + "\" specimen.");
  }

  return packet;
}

/** The identities every test can connect with: a dual file passes both surface gates, and the narrower two exercise the refusals. */
export const CREDENTIALS_DUAL: UfaCredentials = { host: "Test Name 1", identity: { password: "p", token: "t", username: "u" } };

/** A credential-pair-only identity file. */
export const CREDENTIALS_PAIR: UfaCredentials = { host: "Test Name 1", identity: { password: "p", username: "u" } };

/** A token-only identity file. */
export const CREDENTIALS_TOKEN: UfaCredentials = { host: "Test Name 1", identity: { token: "t" } };

/**
 * Every method the fake official facade answers, spelled as the call record carries it. The record is typed by this rather than by `string` so that a test naming a
 * method the facade does not have, or misspelling one it does, fails to compile instead of quietly asserting against a filter that matches nothing.
 */
export type FakeOfficialMethod = "command" | "devices.fetchAll" | "devices.fetchSettings" | "devices.updateSettings" | "download" | "logs.export" | "logs.fetch" |
  "request" | "spaces.fetchAll" | "spaces.fetchEmergency" | "spaces.fetchLockRule" | "spaces.setEmergency" | "spaces.setLockRule" | "spaces.unlock" |
  "users.fetch" | "users.fetchAll" | "users.uploadAvatar" | "visitors.fetch" | "visitors.fetchAll" | "webhooks.createEndpoint" | "webhooks.deleteEndpoint" |
  "webhooks.fetchAllEndpoints";

/**
 * What a fake's commands recorded, by verb. Asserting on these is what establishes the wire shape a command chose, rather than on whatever it printed afterwards.
 */
export interface FakeCalls {

  closes: string[];
  consumed: string[];
  disposals: number;
  lockRules: { id: string; rule: AccessLockRule }[];
  official: { args: unknown[]; method: FakeOfficialMethod }[];
  opens: { api?: AccessApiOverride; credentials?: UfaCredentials; debug?: boolean; refreshIntervalMs?: number | false }[];
  restarts: string[];
  unlocks: { actor?: AccessOfficialDoorUnlockActor; id: string }[];
  updates: { id: string; payload: unknown }[];
}

/**
 * One door in a fake state snapshot. The identity and both names are required because every door-naming line in the CLI reads one of them, so a fixture that omits
 * one cannot compile rather than rendering an empty spelling. Anything else a test wants a door record to carry sits alongside.
 */
export interface FakeDoorSpec {

  [member: string]: unknown;
  full_name: string;
  name: string;
  unique_id: string;
}

/**
 * One device in a fake inventory. `present` is what a vanished record looks like from a command's point of view: reading the record throws, exactly as a live
 * projection does once its record leaves controller state. `doorId` is the door the handle drives, defaulting to the handle's own id. `beforeRestart` and
 * `beforeUnlock` fire inside the command they name, which is how a test arranges for controller state to change while a command is in flight.
 */
export interface FakeDeviceSpec {

  beforeRestart?: () => void;
  beforeUnlock?: () => void;
  config?: Record<string, unknown>;
  doorId?: string;
  id: string;
  lockRuleError?: Error;
  name: string;
  present?: boolean;
  restartError?: Error;
  uplinkId?: string | null;
}

/** How the fake official facade answers. Everything is optional, so each test states only what it is about. */
export interface FakeOfficialSpec {

  avatar?: Record<string, unknown>;
  createdEndpoint?: Record<string, unknown>;
  deviceGroups?: Record<string, unknown>[][];
  doors?: Record<string, unknown>[];
  doorsError?: Error;
  downloadBytes?: Buffer;
  emergency?: Record<string, unknown>;
  exportBytes?: Buffer;
  hits?: Record<string, unknown>[];
  lockRule?: Record<string, unknown>;
  requestResult?: { data: unknown; pagination?: Record<string, unknown> };
  settings?: Record<string, unknown>;
  updateError?: Error;
  users?: Record<string, unknown>[];
  visitors?: Record<string, unknown>[];
  webhookEndpoints?: Record<string, unknown>[];
}

/** How a fake client answers. Everything is optional, so each test states only what it is about. */
export interface FakeClientSpec {

  accessPoints?: FakeDeviceSpec[];
  capabilities?: AccessCapabilities;
  connection?: { isHealthy?: boolean; isThrottled?: boolean; state?: string };
  controllerInfo?: unknown;
  controllerName?: string | null;
  devices?: FakeDeviceSpec[];
  document?: unknown;
  doorStates?: Map<string, AccessDoorStateEntry>;
  doorStatesError?: Error;
  fetchError?: Error;
  hubIds?: string[];
  isAdmin?: boolean | null;
  observations?: ReadonlyMap<string, AccessDoorStateEntry>[];
  official?: FakeOfficialSpec;
  onStream?: (signal: AbortSignal | undefined) => void;
  packetDelayMs?: number;
  packets?: AccessEventPacket[];
  snapshot?: { controller?: unknown; doors?: Map<string, FakeDoorSpec>; floors?: Map<string, unknown>; root?: unknown };
  streamError?: Error;
}

function makeCalls(): FakeCalls {

  return { closes: [], consumed: [], disposals: 0, lockRules: [], official: [], opens: [], restarts: [], unlocks: [], updates: [] };
}

// Build one fake device handle: a record, an identity, a name, the door it drives and that door's own record, and the commands a command module can issue against
// it. The doors map is the same one the fake's state snapshot answers with, so a handle and the snapshot cannot disagree about the door behind it.
function makeFakeDevice(calls: FakeCalls, spec: FakeDeviceSpec, doors: ReadonlyMap<string, FakeDoorSpec>): Record<string, unknown> {

  const state = { present: spec.present ?? true };
  /* The base record carries the capability set and the configuration rows the real record type requires, because the library's own predicates read them: a fake
   * that omitted them would lie about the shape those predicates take, and a sparse fixture would throw inside one rather than answering.
   */
  const config = { "alias": "", "capabilities": [], "configs": [], "is_connected": true, "is_online": true, "is_rebooting": false, "name": spec.name,
    "unique_id": spec.id, ...spec.config };
  const record = (): Record<string, unknown> => {

    if(!state.present) {

      throw new ReferenceError("The device " + spec.id + " is no longer present in the controller state.");
    }

    return config;
  };

  /* The fake's record read as the state record the library's own tamper functions take. The fake supplies the members they read and nothing obliges it to carry
   * the rest, so this states what the structural stand-in is standing in for. Delegating to the library rather than re-implementing the readings here is what
   * keeps the fake's answers from drifting away from the semantics the commands are being tested against.
   */
  const stateRecord = (): AccessStateDevice => record() as unknown as AccessStateDevice;

  return {

    close: async (): Promise<void> => {

      calls.closes.push(spec.id);

      return Promise.resolve();
    },
    get config(): Record<string, unknown> {

      return record();
    },
    get door(): FakeDoorSpec | undefined {

      // The real getter reaches the door through the device record, so a handle whose record has left controller state throws here exactly as it does there.
      record();

      return doors.get(spec.doorId ?? spec.id);
    },
    doorId: spec.doorId ?? spec.id,
    id: spec.id,
    get isOnline(): boolean {

      return record()["is_online"] as boolean;
    },
    get isTamperCapable(): boolean {

      return readTamperCapability(stateRecord());
    },
    markAbsent: (): void => { state.present = false; },
    get name(): string {

      const current = record();

      return ((current["alias"] as string) || (current["name"] as string));
    },
    restart: async (): Promise<void> => {

      spec.beforeRestart?.();

      record();

      calls.restarts.push(spec.id);

      if(spec.restartError !== undefined) {

        return Promise.reject(spec.restartError);
      }

      return Promise.resolve();
    },
    setLockRule: async (rule: AccessLockRule): Promise<void> => {

      // A configured refusal stands in for the routing service's own capability verdict, raised before anything records - nothing was sent.
      if(spec.lockRuleError !== undefined) {

        return Promise.reject(spec.lockRuleError);
      }

      calls.lockRules.push({ id: spec.id, rule });

      return Promise.resolve();
    },
    get tamperState(): boolean | undefined {

      return readTamperState(stateRecord());
    },
    unlock: async (opts: { actor?: AccessOfficialDoorUnlockActor } = {}): Promise<void> => {

      spec.beforeUnlock?.();

      calls.unlocks.push({ ...((opts.actor !== undefined) && { actor: opts.actor }), id: spec.id });

      return Promise.resolve();
    },
    updateDevice: async (payload: unknown): Promise<unknown> => {

      record();

      calls.updates.push({ id: spec.id, payload });

      // The echoed record: the device as it stands with the write folded in, which is what the real endpoint answers.
      return Promise.resolve({ ...config, ...(payload as Record<string, unknown>) });
    },

    // A device connects in its own right unless a spec says otherwise, which is what the great majority of hardware does and what every fixture that does not
    // care about topology should therefore report.
    uplinkId: spec.uplinkId ?? null
  };
}

// Build the fake official facade: exactly the domain methods the commands consume, each recording its invocation - method name and arguments, in call order - into
// the shared call record before answering from the spec. Every method takes its arguments as one rest list, so the record is written the same way everywhere and a
// change to the real facade's parameters touches no signature here.
function makeFakeOfficial(calls: FakeCalls, spec: FakeOfficialSpec): Record<string, unknown> {

  const record = (method: FakeOfficialMethod, ...args: unknown[]): void => void calls.official.push({ args, method });

  return {

    command: async (...args: unknown[]): Promise<void> => {

      record("command", ...args);

      return Promise.resolve();
    },
    devices: {

      fetchAll: async (...args: unknown[]): Promise<unknown> => {

        record("devices.fetchAll", ...args);

        return Promise.resolve(spec.deviceGroups ?? []);
      },
      fetchSettings: async (...args: unknown[]): Promise<unknown> => {

        record("devices.fetchSettings", ...args);

        // The facade puts the device identifier first, so the default answer echoes that position back the way a real settings document carries it.
        return Promise.resolve(spec.settings ?? { "access_methods": {}, "device_id": args[0] });
      },
      updateSettings: async (...args: unknown[]): Promise<void> => {

        record("devices.updateSettings", ...args);

        if(spec.updateError !== undefined) {

          return Promise.reject(spec.updateError);
        }

        return Promise.resolve();
      }
    },
    download: async (...args: unknown[]): Promise<Buffer> => {

      record("download", ...args);

      return Promise.resolve(spec.downloadBytes ?? Buffer.from("bytes"));
    },
    logs: {

      export: async (...args: unknown[]): Promise<Buffer> => {

        record("logs.export", ...args);

        return Promise.resolve(spec.exportBytes ?? Buffer.from("csv"));
      },
      fetch: async (...args: unknown[]): Promise<unknown> => {

        record("logs.fetch", ...args);

        return Promise.resolve({ data: { hits: spec.hits ?? [] } });
      }
    },
    request: async (...args: unknown[]): Promise<unknown> => {

      record("request", ...args);

      return Promise.resolve(spec.requestResult ?? { data: null });
    },
    spaces: {

      fetchAll: async (...args: unknown[]): Promise<unknown> => {

        record("spaces.fetchAll", ...args);

        if(spec.doorsError !== undefined) {

          return Promise.reject(spec.doorsError);
        }

        return Promise.resolve(spec.doors ?? []);
      },
      fetchEmergency: async (...args: unknown[]): Promise<unknown> => {

        record("spaces.fetchEmergency", ...args);

        return Promise.resolve(spec.emergency ?? { "evacuation": false, "lockdown": false });
      },
      fetchLockRule: async (...args: unknown[]): Promise<unknown> => {

        record("spaces.fetchLockRule", ...args);

        return Promise.resolve(spec.lockRule ?? { "ended_time": 0, "type": "" });
      },
      setEmergency: async (...args: unknown[]): Promise<void> => {

        record("spaces.setEmergency", ...args);

        return Promise.resolve();
      },
      setLockRule: async (...args: unknown[]): Promise<void> => {

        record("spaces.setLockRule", ...args);

        return Promise.resolve();
      },
      unlock: async (...args: unknown[]): Promise<void> => {

        record("spaces.unlock", ...args);

        return Promise.resolve();
      }
    },
    users: {

      fetch: async (...args: unknown[]): Promise<unknown> => {

        record("users.fetch", ...args);

        // The facade puts the user identifier first, so that position is what the spec's roster is searched by.
        return Promise.resolve((spec.users ?? []).find((user) => user["id"] === args[0]) ?? { "id": args[0] });
      },
      fetchAll: async (...args: unknown[]): Promise<unknown> => {

        record("users.fetchAll", ...args);

        return Promise.resolve({ data: spec.users ?? [] });
      },
      uploadAvatar: async (...args: unknown[]): Promise<unknown> => {

        record("users.uploadAvatar", ...args);

        // The facade puts the user identifier first, so the minted avatar path is built from that position.
        return Promise.resolve(spec.avatar ?? { "avatar_url": "/avatar/" + String(args[0]) });
      }
    },
    visitors: {

      fetch: async (...args: unknown[]): Promise<unknown> => {

        record("visitors.fetch", ...args);

        // The facade puts the visitor identifier first, so that position is what the spec's roster is searched by.
        return Promise.resolve((spec.visitors ?? []).find((visitor) => visitor["id"] === args[0]) ?? { "id": args[0] });
      },
      fetchAll: async (...args: unknown[]): Promise<unknown> => {

        record("visitors.fetchAll", ...args);

        return Promise.resolve({ data: spec.visitors ?? [] });
      }
    },
    webhooks: {

      createEndpoint: async (...args: unknown[]): Promise<unknown> => {

        record("webhooks.createEndpoint", ...args);

        // The facade puts the endpoint payload first, and the default answer echoes it back with the identifier and secret a controller mints.
        return Promise.resolve(spec.createdEndpoint ?? { ...(args[0] as Record<string, unknown>), "id": "wh-1", "secret": "minted-secret" });
      },
      deleteEndpoint: async (...args: unknown[]): Promise<void> => {

        record("webhooks.deleteEndpoint", ...args);

        return Promise.resolve();
      },
      fetchAllEndpoints: async (...args: unknown[]): Promise<unknown> => {

        record("webhooks.fetchAllEndpoints", ...args);

        return Promise.resolve(spec.webhookEndpoints ?? []);
      }
    }
  };
}

/**
 * Build a fake client and the call record its commands write into.
 *
 * The capability map defaults from the spec's own shape: an official spec makes a dual-mode client with the official path up, and nothing makes a credential-only
 * one; a test states `capabilities` itself to establish any other combination, the folded-official dual client included. Device handles are built from the spec
 * whatever the mode, mirroring the library's own contract: a token client's inventory is seeded from the official listings and answers through the same projections
 * a topology-seeded one does.
 */
export function makeFakeClient(spec: FakeClientSpec = {}): { calls: FakeCalls; client: Record<string, unknown> } {

  const calls = makeCalls();
  const capabilities: AccessCapabilities = spec.capabilities ??
    ((spec.official !== undefined) ? { mode: "dual", official: true, override: "auto" } : { mode: "credential", official: false, override: "auto" });
  const doors = spec.snapshot?.doors ?? new Map<string, FakeDoorSpec>();
  const tokenMode = capabilities.mode === "token";
  const deviceHandles = (spec.devices ?? []).map((device) => makeFakeDevice(calls, device, doors));
  const accessPointHandles = (spec.accessPoints ?? []).map((device) => makeFakeDevice(calls, device, doors));
  const hubIds = new Set(spec.hubIds ?? []);
  const doorStates = spec.doorStates ?? new Map<string, AccessDoorStateEntry>();
  const snapshot = { controller: spec.snapshot?.controller ?? null, doorStates, doors, floors: spec.snapshot?.floors ?? new Map(),
    root: spec.snapshot?.root ?? null };
  const official = ((spec.official !== undefined) && capabilities.official) ? makeFakeOfficial(calls, spec.official) : null;

  const client: Record<string, unknown> = {

    accessPoint: (id: string): unknown => accessPointHandles.find((device) => device["id"] === id),
    accessPoints: accessPointHandles,
    capabilities,
    connection: { isHealthy: spec.connection?.isHealthy ?? true, isThrottled: spec.connection?.isThrottled ?? false, state: spec.connection?.state ?? "connected" },
    controllerInfo: spec.controllerInfo ?? null,
    /* The two verdicts a token-only client genuinely has none of: no controller document, so no name, and no account, so no privilege verdict. The fake answers
     * null for both in that mode because the library does, and an explicit null a test states on purpose (a controller whose name has not been established) must
     * survive rather than fall to the default.
     */
    controllerName: (spec.controllerName === undefined) ? (tokenMode ? null : "Test Name 1") : spec.controllerName,
    devices: deviceHandles,
    get doorStates(): unknown {

      // A subsystem that throws when read is what proves the health check's per-check containment, so the fake can be told to be one.
      if(spec.doorStatesError !== undefined) {

        throw spec.doorStatesError;
      }

      return doorStates;
    },
    fetchBootstrap: async (): Promise<unknown> => {

      if(spec.fetchError !== undefined) {

        return Promise.reject(spec.fetchError);
      }

      return Promise.resolve(spec.document);
    },
    hub: (id: string): unknown => (hubIds.has(id) ? deviceHandles.find((device) => device["id"] === id) : undefined),
    hubs: deviceHandles.filter((device) => hubIds.has(device["id"] as string)),
    isAdmin: tokenMode ? null : (spec.isAdmin ?? true),
    official,
    rawPackets: async function *(opts: { signal?: AbortSignal } = {}): AsyncGenerator<AccessEventPacket> {

      spec.onStream?.(opts.signal);

      if(spec.streamError !== undefined) {

        throw spec.streamError;
      }

      for(const packet of spec.packets ?? []) {

        if(spec.packetDelayMs !== undefined) {

          // Sequential by intent: the delay is per packet, which is what lets a test place a bound between two of them.
          // eslint-disable-next-line no-await-in-loop
          await delay(spec.packetDelayMs);
        }

        // A real stream ends when its signal fires rather than yielding into an aborted consumer, so the fake stops here too - which is what lets a test tell an
        // armed bound from an unarmed one by counting what arrived.
        if(opts.signal?.aborted === true) {

          return;
        }

        calls.consumed.push(packet.event);

        yield packet;
      }
    },
    state: {

      observe: async function *(_selector: unknown, opts: { signal?: AbortSignal } = {}): AsyncGenerator {

        for(const value of spec.observations ?? []) {

          if(opts.signal?.aborted === true) {

            return;
          }

          yield value;
        }
      },
      snapshot: (): unknown => snapshot
    },
    [Symbol.asyncDispose]: async (): Promise<void> => {

      calls.disposals += 1;

      return Promise.resolve();
    }
  };

  return { calls, client };
}

/**
 * A command context wired to a capturing output, an injected credential loader, and a fake client. `lines` holds what the command wrote, one entry per write. The
 * loader answers the dual identity unless a test narrows it, so both surface gates pass by default and each refusal is a deliberate act of the test that asserts
 * it.
 */
export function makeCommandContext(opts: { args?: string[]; client?: Record<string, unknown>; calls?: FakeCalls; credentials?: UfaCredentials;
  loadCredentials?: LoadCredentials; openClient?: OpenClient; signal?: AbortSignal; } = {}): { ctx: CommandContext; lines: string[] } {

  const lines: string[] = [];
  const output = new Output({ colorize: false, env: {}, stream: { write: (chunk: string | Uint8Array): boolean => {

    lines.push(String(chunk));

    return true;
  } } });

  const openClient: OpenClient = opts.openClient ?? (async (openOpts = {}) => {

    opts.calls?.opens.push(openOpts);

    // The one cast: the structural fake stands in for a connected client, which is what makes every command offline-testable.
    return Promise.resolve(opts.client as unknown as Awaited<ReturnType<OpenClient>>);
  });

  const loadCredentials: LoadCredentials = opts.loadCredentials ?? (async (): Promise<UfaCredentials> => Promise.resolve(opts.credentials ?? CREDENTIALS_DUAL));

  return { ctx: { args: opts.args ?? [], env: {}, loadCredentials, openClient, output, signal: opts.signal ?? new AbortController().signal }, lines };
}

/** The text a command wrote, as trimmed lines. */
export function rendered(lines: string[]): string[] {

  return lines.join("").split("\n").filter((line) => line.length > 0);
}

/** Save and restore the process exit code around a test that sets it, so a command's exit code never becomes the test run's. */
export async function withExitCode(run: () => Promise<void>): Promise<typeof process.exitCode> {

  const previous = process.exitCode;

  try {

    await run();

    return process.exitCode;
  } finally {

    process.exitCode = previous ?? undefined;
  }
}

/** Capture stderr around a call, restoring both the stream and the exit code. */
export async function withStderr(run: () => Promise<void> | void): Promise<{ code: typeof process.exitCode; text: string }> {

  const previous = process.exitCode;
  const write = process.stderr.write.bind(process.stderr);
  const captured: string[] = [];

  process.stderr.write = ((chunk: string | Uint8Array): boolean => {

    captured.push(String(chunk));

    return true;
  });

  try {

    await run();

    return { code: process.exitCode, text: captured.join("") };
  } finally {

    process.stderr.write = write;
    process.exitCode = previous ?? undefined;
  }
}

/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * cli.helpers.ts: The offline test rig for the ufa CLI - the structural fake client, the capturing command context, and the identity files the surface gates are
 * driven with.
 *
 * Everything here serves the suite's one discipline: commands reach the controller only through the injected hooks, so a structural fake stands in for a
 * connected client and the assertions are about what each command reads, writes, and commands - never about a live controller. The fake implements only
 * what the command modules actually consume, which is what keeps it honest: a command that starts reading something new fails here rather than silently
 * passing against a mock that answered everything. The rig's one cast to the client type lives in `asAccessClient`, shared by the context's opener and the
 * tests that hand the fake straight to a library function typed for a real client.
 */
import { AccessApiError, portBindings as readPortBindings, isTamperCapable as readTamperCapability, tamperState as readTamperState,
  terminalInput as readTerminalInput } from "../../index.ts";
import type { AccessApiOverride, AccessCapabilities, AccessClient, AccessDoorStateEntry, AccessEventPacket, AccessLockRule, AccessOfficialDoorUnlockActor,
  AccessPortBinding, AccessStateDevice, AccessTerminalInput, AccessTerminalInputFacts } from "../../index.ts";
import type { CommandContext, LoadCredentials, OpenClient } from "./shared.ts";
import { Output } from "./output/format.ts";
import type { UfaCredentials } from "./credentials.ts";
import assert from "node:assert/strict";

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
  "logs.iterate" | "request" | "spaces.fetchAll" | "spaces.fetchEmergency" | "spaces.fetchLockRule" | "spaces.setEmergency" | "spaces.setLockRule" | "spaces.unlock" |
  "users.fetch" | "users.fetchAll" | "users.iterateAll" | "users.iterateSearch" | "users.uploadAvatar" | "visitors.fetch" | "visitors.fetchAll" |
  "visitors.iterateAll" | "webhooks.createEndpoint" | "webhooks.deleteEndpoint" | "webhooks.fetchAllEndpoints";

/**
 * What a fake's commands recorded, by verb. Asserting on these is what establishes the wire shape a command chose, rather than on whatever it printed afterwards.
 * The record also counts how many times the context's credential loader was called, so a refusal test proves whether the identity file was read - zero, or exactly
 * once for a refusal thrown from the loaded identity - beside proving nothing connected.
 */
export interface FakeCalls {

  closes: string[];
  consumed: string[];
  credentialLoads: number;
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

  /** What the `users.fetch` and `visitors.fetch` arms throw in place of answering, so a test can prove a failure that is not a refusal surfaces. */
  fetchError?: Error;
  hits?: Record<string, unknown>[];

  /** What the `logs.iterate` arm throws once every hit has been yielded, so a test proves a bounded read stopped before the walk was asked for more. */
  iterateError?: Error;
  lockRule?: Record<string, unknown>;
  requestResult?: { data: unknown; pagination?: Record<string, unknown> };
  settings?: Record<string, unknown>;
  settingsError?: Error;
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
  /** The stream yields nothing until the signal it was handed aborts, which is how a test proves a bound ended the stream without depending on when it fires. */
  holdUntilAborted?: boolean;
  hubIds?: string[];
  isAdmin?: boolean | null;
  observations?: ReadonlyMap<string, AccessDoorStateEntry>[];
  official?: FakeOfficialSpec;
  onStream?: (signal: AbortSignal | undefined) => void;
  packets?: AccessEventPacket[];
  snapshot?: { controller?: unknown; doors?: Map<string, FakeDoorSpec>; floors?: Map<string, unknown>; root?: unknown };
  streamError?: Error;
}

function makeCalls(): FakeCalls {

  return { closes: [], consumed: [], credentialLoads: 0, disposals: 0, lockRules: [], official: [], opens: [], restarts: [], unlocks: [], updates: [] };
}

// Build one fake device handle: a record, an identity, a name, the door it drives and that door's own record, and the commands a command module can issue against
// it. The doors map is the same one the fake's state snapshot answers with, so a handle and the snapshot cannot disagree about the door behind it. The control
// that marks the record absent comes back beside the handle rather than on it, so a test reaches it through the fake client and no command can.
function makeFakeDevice(calls: FakeCalls, spec: FakeDeviceSpec, doors: ReadonlyMap<string, FakeDoorSpec>): { handle: Record<string, unknown>; markAbsent: () => void } {

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

  const handle: Record<string, unknown> = {

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
    get name(): string {

      const current = record();

      return ((current["alias"] as string) || (current["name"] as string));
    },
    get portBindings(): readonly AccessPortBinding[] {

      return readPortBindings(stateRecord());
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
    terminalInput: (input: AccessTerminalInput): AccessTerminalInputFacts => readTerminalInput(stateRecord(), input),
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

  const markAbsent = (): void => {

    state.present = false;
  };

  return { handle, markAbsent };
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

        if(spec.settingsError !== undefined) {

          return Promise.reject(spec.settingsError);
        }

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
      },
      iterate: async function *(...args: unknown[]): AsyncGenerator {

        record("logs.iterate", ...args);

        yield* spec.hits ?? [];

        /* The hits are one page, which is how a walk over this fake reaches its end. A consumer that stopped at its own bound never resumes the generator past
         * the hit it stopped on, so this throw is reached only by a read that asked for more once the whole walk had been handed over.
         */
        if(spec.iterateError !== undefined) {

          throw spec.iterateError;
        }
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

        if(spec.fetchError !== undefined) {

          throw spec.fetchError;
        }

        // The facade puts the user identifier first, so that position is what the spec's roster is searched by. An identifier the roster does not hold draws the
        // message and code the controller answered on 2026-09-07, for a uuid-shaped and a garbage identifier alike.
        const found = (spec.users ?? []).find((user) => user["id"] === args[0]);

        if(found === undefined) {

          throw new AccessApiError("Account not found.", { code: "CODE_USER_ACCOUNT_NOT_EXIST" });
        }

        return Promise.resolve(found);
      },
      fetchAll: async (...args: unknown[]): Promise<unknown> => {

        record("users.fetchAll", ...args);

        return Promise.resolve({ data: spec.users ?? [] });
      },
      iterateAll: async function *(...args: unknown[]): AsyncGenerator {

        record("users.iterateAll", ...args);

        yield* spec.users ?? [];
      },
      iterateSearch: async function *(...args: unknown[]): AsyncGenerator {

        record("users.iterateSearch", ...args);

        // The keyword matches case-insensitively as a substring of the first name, the last name, and the full name, which is the rule the controller answered to
        // on 2026-09-07. No resolution rests on it: a keyword that misses here falls through to the walk, which sees every record.
        const options = args[0];
        const keyword = (((typeof options === "object") && (options !== null) && ("keyword" in options) && (typeof options.keyword === "string")) ?
          options.keyword : "").toLowerCase();

        for(const user of spec.users ?? []) {

          const spellings = [ user["first_name"], user["full_name"], user["last_name"] ];

          if(spellings.some((spelling) => (typeof spelling === "string") && spelling.toLowerCase().includes(keyword))) {

            yield user;
          }
        }
      },
      uploadAvatar: async (...args: unknown[]): Promise<unknown> => {

        record("users.uploadAvatar", ...args);

        // The facade puts the user identifier first, so the minted avatar path is built from that position.
        return Promise.resolve(spec.avatar ?? { "url": "/avatar/" + String(args[0]) });
      }
    },
    visitors: {

      fetch: async (...args: unknown[]): Promise<unknown> => {

        record("visitors.fetch", ...args);

        if(spec.fetchError !== undefined) {

          throw spec.fetchError;
        }

        // The facade puts the visitor identifier first, so that position is what the spec's roster is searched by. An identifier the roster does not hold draws the
        // message and code the controller answered on 2026-09-07, for a uuid-shaped and a garbage identifier alike.
        const found = (spec.visitors ?? []).find((visitor) => visitor["id"] === args[0]);

        if(found === undefined) {

          throw new AccessApiError("User not found.", { code: "CODE_USER_WORKER_NOT_EXISTS" });
        }

        return Promise.resolve(found);
      },
      fetchAll: async (...args: unknown[]): Promise<unknown> => {

        record("visitors.fetchAll", ...args);

        return Promise.resolve({ data: spec.visitors ?? [] });
      },
      iterateAll: async function *(...args: unknown[]): AsyncGenerator {

        record("visitors.iterateAll", ...args);

        yield* spec.visitors ?? [];
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
export function makeFakeClient(spec: FakeClientSpec = {}): { calls: FakeCalls; client: Record<string, unknown>; markAbsent: (id: string) => void } {

  const calls = makeCalls();
  const capabilities: AccessCapabilities = spec.capabilities ??
    ((spec.official !== undefined) ? { mode: "dual", official: true, override: "auto" } : { mode: "credential", official: false, override: "auto" });
  const doors = spec.snapshot?.doors ?? new Map<string, FakeDoorSpec>();
  const tokenMode = capabilities.mode === "token";
  const deviceFakes = (spec.devices ?? []).map((device) => makeFakeDevice(calls, device, doors));
  const accessPointFakes = (spec.accessPoints ?? []).map((device) => makeFakeDevice(calls, device, doors));
  const deviceHandles = deviceFakes.map((fake) => fake.handle);
  const accessPointHandles = accessPointFakes.map((fake) => fake.handle);
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
    /* The two verdicts a token-only client genuinely has none of: no controller document, so no name, and no account, so no privilege verdict. The fake
     * enforces null for controllerName and isAdmin in that mode because the library does, and an explicit null a test states on purpose (a controller whose
     * name has not been established) must survive rather than fall to the default. controllerInfo above defaults from the spec regardless of mode, so a
     * token-mode spec must not also pass a non-null controllerInfo - the fake does not enforce that null the way it enforces the other two.
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

      /* A stream held until its bound fires. The fake yields nothing while it waits, so a test establishes that a bound ended the stream without depending on
       * when the bound's own timer fires. The loop's abort check below is what then ends the stream with nothing yielded.
       */
      if(spec.holdUntilAborted === true) {

        const signal = opts.signal;

        if(signal === undefined) {

          throw new Error("A held stream needs the signal the command runs under, but the caller passed none.");
        }

        await (signal.aborted ? Promise.resolve() : new Promise<void>((resolve) => signal.addEventListener("abort", () => resolve(), { once: true })));
      }

      for(const packet of spec.packets ?? []) {

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

  // A record leaves controller state by the identity of the handle built for it, among the devices and the access points alike. An identity the spec built no
  // handle for is a mistake in the test rather than a record that vanished, so it is refused by name instead of marking nothing.
  const markAbsent = (id: string): void => {

    const fake = [ ...deviceFakes, ...accessPointFakes ].find((candidate) => candidate.handle["id"] === id);

    if(fake === undefined) {

      throw new Error("The fake client built no handle for " + id + ".");
    }

    fake.markAbsent();
  };

  return { calls, client, markAbsent };
}

/**
 * The rig's one cast to the client type: the structural fake stands in for a connected client, which is what makes every command offline-testable. Every site that hands
 * the fake to code typed for a real client goes through here - the context's opener, and the tests that pass the fake straight to a library function - so the cast is
 * stated once rather than at each of them.
 */
export function asAccessClient(client: Record<string, unknown>): AccessClient {

  return client as unknown as AccessClient;
}

/**
 * A command context wired to a capturing output, an injected credential loader, and a fake client. `lines` holds what the command wrote, one entry per write. The
 * loader answers the dual identity unless a test narrows it, so both surface gates pass by default and each refusal is a deliberate act of the test that asserts
 * it. The loader counts every call into the record, which is what lets a refusal test read whether the identity file was touched.
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

    // The real opener answers a client or rejects, so a context built without one refuses to open rather than resolving a stand-in a command would then misread.
    if(opts.client === undefined) {

      throw new Error("The command context was built without a client to open.");
    }

    return Promise.resolve(asAccessClient(opts.client));
  });

  const underlyingLoader: LoadCredentials = opts.loadCredentials ?? (async (): Promise<UfaCredentials> => Promise.resolve(opts.credentials ?? CREDENTIALS_DUAL));

  // The count lands before the underlying loader runs, so a loader that throws is recorded as a read all the same...what a refusal test reads is whether the
  // identity file was reached for, not whether it answered.
  const loadCredentials: LoadCredentials = async (): Promise<UfaCredentials> => {

    if(opts.calls !== undefined) {

      opts.calls.credentialLoads += 1;
    }

    const credentials = await underlyingLoader();

    return credentials;
  };

  return { ctx: { args: opts.args ?? [], env: {}, loadCredentials, openClient, output, signal: opts.signal ?? new AbortController().signal }, lines };
}

/** The text a command wrote, as non-blank lines. */
export function rendered(lines: string[]): string[] {

  return lines.join("").split("\n").filter((line) => line.length > 0);
}

/**
 * The one JSON document a command wrote, parsed whole. Joining the written lines reads either rendering alike: the single line a document read writes, and the
 * indented document a report writes.
 */
// The type parameter carries the caller's own assertion of the document's shape to the call site, so its appearing only in the return position is the intent, not
// an oversight (the same idiom the transport's own `json()` decode point uses).
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
export function parsedJson<T>(lines: string[]): T {

  return JSON.parse(rendered(lines).join("")) as T;
}

/** The signal an official facade call carried. The facade's third argument is the call options, which is where a command threads its own lifetime signal. */
export function officialCallSignal(call: FakeCalls["official"][number] | undefined): AbortSignal | undefined {

  return (call?.args[2] as { signal?: AbortSignal } | undefined)?.signal;
}

/** Assert that no value a fixture planted survives in what a command wrote, each failure naming the run and the value that leaked through it. */
export function assertNothingPlantedSurvives(lines: string[], planted: readonly string[], label: string): void {

  const text = lines.join("");

  for(const value of planted) {

    assert.ok(!text.includes(value), label + " carries no \"" + value + "\"");
  }
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

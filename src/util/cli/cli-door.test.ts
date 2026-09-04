/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * cli-door.test.ts: Tests for the ufa door group and the door resolution behind it - the device arm, the phased door arm, the two-arm target, and the commands
 * each arm carries. Every test runs offline against the structural fake.
 */
import { CREDENTIALS_PAIR, CREDENTIALS_TOKEN, makeCommandContext, makeFakeClient, rendered } from "./cli.helpers.ts";
import { describe, test } from "node:test";
import { AccessCapabilityError } from "../../index.ts";
import { CliError } from "./shared.ts";
import type { DoorTarget } from "./lookup.ts";
import type { FakeDoorSpec } from "./cli.helpers.ts";
import assert from "node:assert/strict";
import { door } from "./commands/door.ts";
import { findDoorTarget } from "./lookup.ts";

/* A fixture with a topology behind it: two hubs driving their own doors, a reader that drives none, and the state's own door records.
 *
 * Each door's full name is deliberately unlike its short name, unlike the name of the hub that drives it, and - for the second door - not even a superstring of
 * its own short name. A confirmation line or a listing that fell back to any shorter spelling therefore cannot satisfy the anchored assertions below.
 */
const HUB_SPEC = {

  devices: [ { doorId: "door-1", id: "hub-1", name: "Acme Name 6" }, { doorId: "door-2", id: "hub-2", name: "Side Hub" }, { id: "reader-1", name: "Reader" } ],
  hubIds: [ "hub-1", "hub-2" ],
  snapshot: { doors: new Map<string, FakeDoorSpec>([ [ "door-1", { "full_name": "1F - Loading Dock", "name": "Acme Name 13", "unique_id": "door-1" } ],
    [ "door-2", { "full_name": "2F - Loading Bay", "name": "Side Door", "unique_id": "door-2" } ] ]) }
};

// The same doors, plus one no handle drives at all - what a withheld Enterprise Access Hub leaves behind, and the fixture every door-arm row reaches through.
const DOORS_WITH_ORPHAN = new Map<string, FakeDoorSpec>([ ...HUB_SPEC.snapshot.doors,
  [ "door-9", { "full_name": "B1 - Service Entrance", "name": "Orphan", "unique_id": "door-9" } ] ]);

// A token-mode fixture as the census leaves it: the official listings seeded both the hardware and the doors, so the projections answer here exactly as they do
// behind a topology, and a door a handle drives takes the same routed verbs.
const TOKEN_SPEC = {

  capabilities: { mode: "token", official: true, override: "auto" } as const,
  devices: [{ doorId: "od-1", id: "hub-1", name: "Acme Name 6" }],
  hubIds: ["hub-1"],
  official: {},
  snapshot: { doors: new Map<string, FakeDoorSpec>([[ "od-1", { "full_name": "1F - Loading Dock", "name": "Acme Name 13", "unique_id": "od-1" } ]]) }
};

// The other token state: a controller that refused the device listing, so the census seeded the doors and no hardware at all. Nothing here drives a door, which
// makes every command against this fixture a door-arm command.
const TOKEN_DOORS_ONLY = {

  capabilities: { mode: "token", official: true, override: "auto" } as const,
  official: {},
  snapshot: { doors: new Map<string, FakeDoorSpec>([[ "od-9", { "full_name": "B1 - Service Entrance", "name": "Service Door", "unique_id": "od-9" } ]]) }
};

// A dual client holding the same handle-less door, and the clients that cannot serve it: one held off the only channel that reaches it, one holding no official
// path at all.
const DUAL_ORPHAN_SPEC = { ...HUB_SPEC, capabilities: { mode: "dual", official: true, override: "auto" } as const, official: {},
  snapshot: { doors: DOORS_WITH_ORPHAN } };
const PINNED_ORPHAN_SPEC = { ...DUAL_ORPHAN_SPEC, capabilities: { mode: "dual", official: true, override: "direct-only" } as const };
const CREDENTIAL_ORPHAN_SPEC = { ...HUB_SPEC, capabilities: { mode: "credential", official: false, override: "auto" } as const,
  snapshot: { doors: DOORS_WITH_ORPHAN } };

// What a resolved target amounts to for an assertion: which arm answered, and the identity that arm carries. Asserting both together is what keeps an arm
// regression from passing on a matching identity alone.
function resolved(target: DoorTarget): { id: string; kind: string } {

  return (target.kind === "hub") ? { id: target.hub.id, kind: "hub" } : { id: target.doorId, kind: "door" };
}

describe("door resolution", () => {

  test("a device token resolves to its hub handle by name or id", () => {

    const { client } = makeFakeClient(HUB_SPEC);

    assert.deepEqual(resolved(findDoorTarget(client as never, "Acme Name 6")), { id: "hub-1", kind: "hub" });
    assert.deepEqual(resolved(findDoorTarget(client as never, "hub-2")), { id: "hub-2", kind: "hub" });
  });

  test("a resolvable device that drives no door earns its own distinct error", () => {

    const { client } = makeFakeClient(HUB_SPEC);

    assert.throws(() => findDoorTarget(client as never, "Reader"),
      (error: unknown) => (error instanceof CliError) && error.message.includes("is not a hub, so it drives no door"));
  });

  test("a door resolves by id, then by name, then by full name, each case-insensitively", () => {

    const { client } = makeFakeClient(HUB_SPEC);

    assert.deepEqual(resolved(findDoorTarget(client as never, "door-2")), { id: "hub-2", kind: "hub" }, "the identifier phase");
    assert.deepEqual(resolved(findDoorTarget(client as never, "acme name 13")), { id: "hub-1", kind: "hub" }, "the name phase");
    assert.deepEqual(resolved(findDoorTarget(client as never, "2f - loading bay")), { id: "hub-2", kind: "hub" }, "the full-name phase");
  });

  test("a token that is one door's name and another's full name resolves the name match", () => {

    const { client } = makeFakeClient({ ...HUB_SPEC,
      snapshot: { doors: new Map<string, FakeDoorSpec>([ [ "door-1", { "full_name": "1F - Annex", "name": "Annex", "unique_id": "door-1" } ],
        [ "door-2", { "full_name": "Annex", "name": "Side Door", "unique_id": "door-2" } ] ]) } });

    // The name phase runs first and matches exactly one door, so the full-name phase that would have matched the other is never reached.
    assert.deepEqual(resolved(findDoorTarget(client as never, "annex")), { id: "hub-1", kind: "hub" });
  });

  test("two doors sharing a name refuse the phase and list both full spellings", () => {

    const { client } = makeFakeClient({ ...HUB_SPEC,
      snapshot: { doors: new Map<string, FakeDoorSpec>([ [ "door-1", { "full_name": "1F - Loading Dock", "name": "Acme Name 13", "unique_id": "door-1" } ],
        [ "door-2", { "full_name": "2F - Loading Dock", "name": "Acme Name 13", "unique_id": "door-2" } ] ]) } });

    assert.throws(() => findDoorTarget(client as never, "Acme Name 13"),
      (error: unknown) => (error instanceof CliError) && error.message.includes("More than one door matches") &&
        error.message.includes("1F - Loading Dock => door-1") && error.message.includes("2F - Loading Dock => door-2"));
  });

  test("a door driven by more than one handle names the ambiguity and the candidates", () => {

    const { client } = makeFakeClient({ ...HUB_SPEC,
      devices: [ { doorId: "door-1", id: "hub-1", name: "Acme Name 6" }, { doorId: "door-1", id: "hub-2", name: "Side Hub" } ] });

    assert.throws(() => findDoorTarget(client as never, "Acme Name 13"),
      (error: unknown) => (error instanceof CliError) && error.message.includes("More than one device") && error.message.includes("1F - Loading Dock") &&
        error.message.includes("Acme Name 6") && error.message.includes("Side Hub"));
  });

  test("a door no handle drives answers as the door itself, for the command to serve on the surface that addresses doors", () => {

    const { client } = makeFakeClient({ ...HUB_SPEC, snapshot: { doors: DOORS_WITH_ORPHAN } });

    assert.deepEqual(resolved(findDoorTarget(client as never, "Orphan")), { id: "door-9", kind: "door" });
  });

  test("a token-mode operator naming the driving device resolves through the device union, exactly as any other identity does", () => {

    const { client } = makeFakeClient(TOKEN_SPEC);

    assert.deepEqual(resolved(findDoorTarget(client as never, "Acme Name 6")), { id: "hub-1", kind: "hub" });
  });

  test("an unmatched token lists the devices and the doors by their full spellings", () => {

    const { client } = makeFakeClient(HUB_SPEC);

    assert.throws(() => findDoorTarget(client as never, "Nothing"),
      (error: unknown) => (error instanceof CliError) && error.message.includes("Acme Name 6 => hub-1") && error.message.includes("2F - Loading Bay => door-2") &&
        !error.message.includes("Side Door => door-2"));
  });
});

describe("the door unlock command", () => {

  test("a bare unlock calls the hub's own unlock and confirms with the door", async () => {

    const { calls, client } = makeFakeClient(HUB_SPEC);
    const { ctx, lines } = makeCommandContext({ args: [ "unlock", "Acme Name 13" ], calls, client });

    await door.run(ctx);

    assert.deepEqual(calls.unlocks, [{ id: "hub-1" }]);
    assert.deepEqual(calls.lockRules, []);
    assert.match(rendered(lines)[0] ?? "", /^1F - Loading Dock \(door-1\) - unlocked\.$/);
  });

  test("a duration establishes a custom rule in whole minutes, converted at the CLI boundary", async () => {

    const table: [ string, number ][] = [ [ "30m", 30 ], [ "1h", 60 ], [ "120s", 2 ] ];

    for(const [ value, minutes ] of table) {

      const { calls, client } = makeFakeClient(HUB_SPEC);
      const { ctx, lines } = makeCommandContext({ args: [ "unlock", "Acme Name 6", "--duration", value ], calls, client });

      // Sequential by intent: each conversion is asserted on its own invocation.
      // eslint-disable-next-line no-await-in-loop
      await door.run(ctx);

      assert.deepEqual(calls.lockRules, [{ id: "hub-1", rule: { interval: minutes, type: "custom" } }], value);
      assert.deepEqual(calls.unlocks, [], value);
      assert.match(rendered(lines)[0] ?? "",
        new RegExp("^1F - Loading Dock \\(door-1\\) - unlocked for " + minutes.toString() + " minutes\\.$"), value);
    }
  });

  test("a duration that is not a whole number of minutes is refused before anything connects", async () => {

    const { calls, client } = makeFakeClient(HUB_SPEC);
    const { ctx } = makeCommandContext({ args: [ "unlock", "Acme Name 6", "--duration", "90s" ], calls, client });

    await assert.rejects(async () => door.run(ctx),
      (error: unknown) => (error instanceof CliError) && (error.exitCode === 2) && error.message.includes("whole-minute"));

    assert.equal(calls.opens.length, 0);
  });

  test("the hold flag establishes the keep-unlock rule", async () => {

    const { calls, client } = makeFakeClient(HUB_SPEC);
    const { ctx, lines } = makeCommandContext({ args: [ "unlock", "Acme Name 6", "--hold" ], calls, client });

    await door.run(ctx);

    assert.deepEqual(calls.lockRules, [{ id: "hub-1", rule: { type: "keep_unlock" } }]);
    assert.match(rendered(lines)[0] ?? "", /^1F - Loading Dock \(door-1\) - unlocked until reset\.$/);
  });

  test("a duration and a hold together are refused", async () => {

    const { calls, client } = makeFakeClient(HUB_SPEC);
    const { ctx } = makeCommandContext({ args: [ "unlock", "Acme Name 6", "--duration", "5m", "--hold" ], calls, client });

    await assert.rejects(async () => door.run(ctx), (error: unknown) => (error instanceof CliError) && (error.exitCode === 2));

    assert.equal(calls.opens.length, 0);
  });

  test("an actor threads through the hub unlock as the attribution pair", async () => {

    const { calls, client } = makeFakeClient(HUB_SPEC);
    const { ctx } = makeCommandContext({ args: [ "unlock", "Acme Name 6", "--actor", "Night Automation:auto-1" ], calls, client });

    await door.run(ctx);

    assert.deepEqual(calls.unlocks, [{ actor: { id: "auto-1", name: "Night Automation" }, id: "hub-1" }]);
  });

  test("an actor splits on the last colon, and a missing half is refused", async () => {

    const { calls, client } = makeFakeClient(HUB_SPEC);
    const good = makeCommandContext({ args: [ "unlock", "Acme Name 6", "--actor", "Crew: Night:auto-1" ], calls, client });

    await door.run(good.ctx);

    assert.deepEqual(calls.unlocks, [{ actor: { id: "auto-1", name: "Crew: Night" }, id: "hub-1" }]);

    for(const value of [ "no-id", ":id-only", "name-only:" ]) {

      const bad = makeCommandContext({ args: [ "unlock", "Acme Name 6", "--actor", value ], calls, client });

      // Sequential by intent: each malformed actor is asserted on its own invocation.
      // eslint-disable-next-line no-await-in-loop
      await assert.rejects(async () => door.run(bad.ctx), (error: unknown) => (error instanceof CliError) && (error.exitCode === 2), value);
    }
  });

  test("an actor cannot join a rule, in either combination", async () => {

    for(const extra of [ [ "--duration", "5m" ], ["--hold"] ]) {

      const { calls, client } = makeFakeClient(HUB_SPEC);
      const { ctx } = makeCommandContext({ args: [ "unlock", "Acme Name 6", "--actor", "A:1", ...extra ], calls, client });

      // Sequential by intent: each combination is asserted on its own invocation.
      // eslint-disable-next-line no-await-in-loop
      await assert.rejects(async () => door.run(ctx),
        (error: unknown) => (error instanceof CliError) && (error.exitCode === 2) && error.message.includes("attributed unlock"), extra.join(" "));

      assert.equal(calls.opens.length, 0);
    }
  });

  test("an unknown api value is refused naming the three spellings, before anything connects", async () => {

    const { calls, client } = makeFakeClient(HUB_SPEC);
    const { ctx } = makeCommandContext({ args: [ "unlock", "Acme Name 6", "--api", "official" ], calls, client });

    await assert.rejects(async () => door.run(ctx),
      (error: unknown) => (error instanceof CliError) && (error.exitCode === 2) && error.message.includes("auto, direct-only, official-only"));

    assert.equal(calls.opens.length, 0);
  });

  test("the api override threads through to the opener verbatim", async () => {

    const { calls, client } = makeFakeClient(HUB_SPEC);
    const { ctx } = makeCommandContext({ args: [ "unlock", "Acme Name 6", "--api", "official-only" ], calls, client });

    await door.run(ctx);

    assert.equal(calls.opens[0]?.api, "official-only");
  });

  test("a one-shot door command disables the refresh failsafe", async () => {

    const { calls, client } = makeFakeClient(HUB_SPEC);
    const { ctx } = makeCommandContext({ args: [ "unlock", "Acme Name 6" ], calls, client });

    await door.run(ctx);

    assert.equal(calls.opens[0]?.refreshIntervalMs, false);
  });

  test("a token-mode door a handle drives is unlocked through that handle, not the facade", async () => {

    const { calls, client } = makeFakeClient(TOKEN_SPEC);
    const { ctx, lines } = makeCommandContext({ args: [ "unlock", "Acme Name 13" ], calls, client, credentials: CREDENTIALS_TOKEN });

    await door.run(ctx);

    assert.deepEqual(calls.unlocks, [{ id: "hub-1" }]);
    assert.deepEqual(calls.official, [], "the projection's own routing decides the path, so the command never reaches around it");
    assert.match(rendered(lines)[0] ?? "", /^1F - Loading Dock \(od-1\) - unlocked\.$/);
  });

  test("a token-mode duration reaches the same handle's lock rule", async () => {

    const { calls, client } = makeFakeClient(TOKEN_SPEC);
    const { ctx } = makeCommandContext({ args: [ "unlock", "Acme Name 13", "--duration", "5m" ], calls, client, credentials: CREDENTIALS_TOKEN });

    await door.run(ctx);

    assert.deepEqual(calls.lockRules, [{ id: "hub-1", rule: { interval: 5, type: "custom" } }]);
    assert.deepEqual(calls.official, []);
  });
});

describe("the door arm - a door no handle drives", () => {

  test("a bare unlock reaches the official facade by door id", async () => {

    const { calls, client } = makeFakeClient(TOKEN_DOORS_ONLY);
    const { ctx, lines } = makeCommandContext({ args: [ "unlock", "Service Door" ], calls, client, credentials: CREDENTIALS_TOKEN });

    await door.run(ctx);

    assert.deepEqual(calls.official, [{ args: [ "od-9", {}, { signal: ctx.signal } ], method: "spaces.unlock" }]);

    /* The shape assertion above cannot tell the command's own lifetime signal from any other unaborted one, because `deepEqual` compares two of those as equal.
     * Each facade row here follows it with an identity check, which is what establishes the signal threaded is the one Ctrl-C actually fires.
     */
    assert.equal((calls.official[0]?.args[2] as { signal?: AbortSignal } | undefined)?.signal, ctx.signal);
    assert.deepEqual(calls.unlocks, [], "there is no handle to have issued it");
    assert.match(rendered(lines)[0] ?? "", /^B1 - Service Entrance \(od-9\) - unlocked\.$/);
  });

  test("an actor reaches the facade unlock as the attribution pair", async () => {

    const { calls, client } = makeFakeClient(TOKEN_DOORS_ONLY);
    const { ctx } = makeCommandContext({ args: [ "unlock", "od-9", "--actor", "Night Automation:auto-1" ], calls, client, credentials: CREDENTIALS_TOKEN });

    await door.run(ctx);

    assert.deepEqual(calls.official,
      [{ args: [ "od-9", { actor: { id: "auto-1", name: "Night Automation" } }, { signal: ctx.signal } ], method: "spaces.unlock" }]);
    assert.equal((calls.official[0]?.args[2] as { signal?: AbortSignal } | undefined)?.signal, ctx.signal);
  });

  test("a duration reaches the facade as the custom rule", async () => {

    const { calls, client } = makeFakeClient(TOKEN_DOORS_ONLY);
    const { ctx, lines } = makeCommandContext({ args: [ "unlock", "Service Door", "--duration", "5m" ], calls, client, credentials: CREDENTIALS_TOKEN });

    await door.run(ctx);

    assert.deepEqual(calls.official, [{ args: [ "od-9", { interval: 5, type: "custom" }, { signal: ctx.signal } ], method: "spaces.setLockRule" }]);
    assert.equal((calls.official[0]?.args[2] as { signal?: AbortSignal } | undefined)?.signal, ctx.signal);
    assert.deepEqual(calls.lockRules, []);
    assert.match(rendered(lines)[0] ?? "", /^B1 - Service Entrance \(od-9\) - unlocked for 5 minutes\.$/);
  });

  test("a hold reaches the facade as the keep-unlock rule", async () => {

    const { calls, client } = makeFakeClient(TOKEN_DOORS_ONLY);
    const { ctx, lines } = makeCommandContext({ args: [ "unlock", "Service Door", "--hold" ], calls, client, credentials: CREDENTIALS_TOKEN });

    await door.run(ctx);

    assert.deepEqual(calls.official, [{ args: [ "od-9", { type: "keep_unlock" }, { signal: ctx.signal } ], method: "spaces.setLockRule" }]);
    assert.equal((calls.official[0]?.args[2] as { signal?: AbortSignal } | undefined)?.signal, ctx.signal);
    assert.match(rendered(lines)[0] ?? "", /^B1 - Service Entrance \(od-9\) - unlocked until reset\.$/);
  });

  test("the lock-rule read asks the facade for the door's own rule", async () => {

    const { calls, client } = makeFakeClient(TOKEN_DOORS_ONLY);
    const { ctx } = makeCommandContext({ args: [ "lock-rule", "Service Door", "--json" ], calls, client, credentials: CREDENTIALS_TOKEN });

    await door.run(ctx);

    assert.deepEqual(calls.official, [{ args: [ "od-9", { signal: ctx.signal } ], method: "spaces.fetchLockRule" }]);
  });

  test("the lock-rule set reaches the facade against the same door id", async () => {

    const { calls, client } = makeFakeClient(TOKEN_DOORS_ONLY);
    const { ctx, lines } = makeCommandContext({ args: [ "lock-rule", "Service Door", "keep-unlock" ], calls, client, credentials: CREDENTIALS_TOKEN });

    await door.run(ctx);

    assert.deepEqual(calls.official, [{ args: [ "od-9", { type: "keep_unlock" }, { signal: ctx.signal } ], method: "spaces.setLockRule" }]);
    assert.equal((calls.official[0]?.args[2] as { signal?: AbortSignal } | undefined)?.signal, ctx.signal);
    assert.deepEqual(calls.lockRules, []);
    assert.match(rendered(lines)[0] ?? "", /^B1 - Service Entrance \(od-9\) - lock rule set to keep-unlock\.$/);
  });

  test("close reaches the facade's gate control command", async () => {

    const { calls, client } = makeFakeClient(TOKEN_DOORS_ONLY);
    const { ctx, lines } = makeCommandContext({ args: [ "close", "Service Door" ], calls, client, credentials: CREDENTIALS_TOKEN });

    await door.run(ctx);

    assert.deepEqual(calls.official, [{ args: [ "od-9", { controlCmd: "close" }, { signal: ctx.signal } ], method: "spaces.unlock" }]);
    assert.equal((calls.official[0]?.args[2] as { signal?: AbortSignal } | undefined)?.signal, ctx.signal);
    assert.deepEqual(calls.closes, []);
    assert.match(rendered(lines)[0] ?? "", /^B1 - Service Entrance \(od-9\) - closed\.$/);
  });

  test("a dual client holding the official path serves the door on it, like every other client that holds it", async () => {

    const { calls, client } = makeFakeClient(DUAL_ORPHAN_SPEC);
    const { ctx, lines } = makeCommandContext({ args: [ "unlock", "Orphan" ], calls, client });

    await door.run(ctx);

    assert.deepEqual(calls.official, [{ args: [ "door-9", {}, { signal: ctx.signal } ], method: "spaces.unlock" }]);
    assert.equal((calls.official[0]?.args[2] as { signal?: AbortSignal } | undefined)?.signal, ctx.signal);
    assert.deepEqual(calls.unlocks, []);
    assert.match(rendered(lines)[0] ?? "", /^B1 - Service Entrance \(door-9\) - unlocked\.$/);
  });

  test("a direct-only override refuses the same door, because it excludes the one path that reaches it", async () => {

    const { calls, client } = makeFakeClient(PINNED_ORPHAN_SPEC);
    const { ctx } = makeCommandContext({ args: [ "unlock", "Orphan", "--api", "direct-only" ], calls, client });

    await assert.rejects(async () => door.run(ctx),
      (error: unknown) => (error instanceof CliError) &&
        (error.message === "The door \"B1 - Service Entrance\" is in the topology, but no hub handle drives it."));

    assert.deepEqual(calls.official, []);
    assert.deepEqual(calls.unlocks, []);
  });

  test("a client with no official path at all gets the same refusal", async () => {

    const { calls, client } = makeFakeClient(CREDENTIAL_ORPHAN_SPEC);
    const { ctx } = makeCommandContext({ args: [ "unlock", "Orphan" ], calls, client, credentials: CREDENTIALS_PAIR });

    await assert.rejects(async () => door.run(ctx),
      (error: unknown) => (error instanceof CliError) &&
        (error.message === "The door \"B1 - Service Entrance\" is in the topology, but no hub handle drives it."));

    assert.deepEqual(calls.unlocks, []);
  });
});

describe("the confirmation label", () => {

  test("a hub whose door the census never carried is named by the hardware instead", async () => {

    const { calls, client } = makeFakeClient({ ...HUB_SPEC,
      devices: [ ...HUB_SPEC.devices, { doorId: "door-404", id: "hub-3", name: "Ghost Hub" } ], hubIds: [ ...HUB_SPEC.hubIds, "hub-3" ] });
    const { ctx, lines } = makeCommandContext({ args: [ "unlock", "Ghost Hub" ], calls, client });

    await door.run(ctx);

    assert.deepEqual(calls.unlocks, [{ id: "hub-3" }]);
    assert.match(rendered(lines)[0] ?? "", /^Ghost Hub \(hub-3\) - unlocked\.$/, "the line stays truthful rather than naming a door the state has no record of");
  });

  test("a record that leaves controller state mid-command still confirms, because the label was captured before the command ran", async () => {

    const handles: Record<string, unknown>[] = [];
    const { calls, client } = makeFakeClient({ ...HUB_SPEC, devices: [ { beforeUnlock: (): void => {

      // The handle's record leaves controller state while its own unlock is in flight.
      (handles[0]?.["markAbsent"] as () => void)();
    }, doorId: "door-1", id: "hub-1", name: "Acme Name 6" }, { doorId: "door-2", id: "hub-2", name: "Side Hub" } ] });

    handles.push(...(client["devices"] as Record<string, unknown>[]));

    const { ctx, lines } = makeCommandContext({ args: [ "unlock", "Acme Name 13" ], calls, client });

    await door.run(ctx);

    assert.deepEqual(calls.unlocks, [{ id: "hub-1" }]);
    assert.match(rendered(lines)[0] ?? "", /^1F - Loading Dock \(door-1\) - unlocked\.$/);
    assert.throws(() => handles[0]?.["door"], ReferenceError, "reading the door after the command would have thrown, which is what the capture avoids");
  });
});

describe("the door close command", () => {

  test("close calls the hub's own close", async () => {

    const { calls, client } = makeFakeClient(HUB_SPEC);
    const { ctx, lines } = makeCommandContext({ args: [ "close", "Acme Name 13" ], calls, client });

    await door.run(ctx);

    assert.deepEqual(calls.closes, ["hub-1"]);
    assert.match(rendered(lines)[0] ?? "", /^1F - Loading Dock \(door-1\) - closed\.$/);
  });

  test("a token-mode door a handle drives is closed through that handle", async () => {

    const { calls, client } = makeFakeClient(TOKEN_SPEC);
    const { ctx, lines } = makeCommandContext({ args: [ "close", "Acme Name 13" ], calls, client, credentials: CREDENTIALS_TOKEN });

    await door.run(ctx);

    assert.deepEqual(calls.closes, ["hub-1"]);
    assert.deepEqual(calls.official, []);
    assert.match(rendered(lines)[0] ?? "", /^1F - Loading Dock \(od-1\) - closed\.$/);
  });
});

describe("the door lock-rule command", () => {

  test("the read renders the official rule for the resolved door", async () => {

    const { calls, client } = makeFakeClient({ ...HUB_SPEC, capabilities: { mode: "dual", official: true, override: "auto" },
      official: { lockRule: { "ended_time": 1755300000, "type": "keep_unlock" } } });
    const { ctx, lines } = makeCommandContext({ args: [ "lock-rule", "Acme Name 13", "--json" ], calls, client });

    await door.run(ctx);

    // The read resolves the door through the hub's own doorId, then asks the official surface - the one channel that can answer.
    assert.deepEqual(calls.official.filter((call) => call.method === "spaces.fetchLockRule").map((call) => call.args[0]), ["door-1"]);
    assert.equal(rendered(lines)[0], JSON.stringify({ "ended_time": 1755300000, "type": "keep_unlock" }));
  });

  test("the read refuses a credential-only identity, naming the official API", async () => {

    const { calls, client } = makeFakeClient(HUB_SPEC);
    const { ctx } = makeCommandContext({ args: [ "lock-rule", "Acme Name 13" ], calls, client, credentials: CREDENTIALS_PAIR });

    await assert.rejects(async () => door.run(ctx),
      (error: unknown) => (error instanceof CliError) && error.message.includes("lock-rule read") && error.message.includes("official API"));

    assert.equal(calls.opens.length, 0);
  });

  test("the read refuses a direct-only override as a usage error, before anything connects", async () => {

    const { calls, client } = makeFakeClient(HUB_SPEC);
    const { ctx } = makeCommandContext({ args: [ "lock-rule", "Acme Name 13", "--api", "direct-only" ], calls, client });

    await assert.rejects(async () => door.run(ctx), (error: unknown) => (error instanceof CliError) && (error.exitCode === 2));

    assert.equal(calls.opens.length, 0);
  });

  test("each kebab verb maps onto its wire spelling through the hub", async () => {

    const table: [ string, string ][] = [ [ "keep-lock", "keep_lock" ], [ "keep-unlock", "keep_unlock" ], [ "lock-early", "lock_early" ],
      [ "lock-now", "lock_now" ], [ "reset", "reset" ] ];

    for(const [ kebab, wire ] of table) {

      const { calls, client } = makeFakeClient(HUB_SPEC);
      const { ctx } = makeCommandContext({ args: [ "lock-rule", "Acme Name 6", kebab ], calls, client });

      // Sequential by intent: each verb is asserted on its own invocation.
      // eslint-disable-next-line no-await-in-loop
      await door.run(ctx);

      assert.deepEqual(calls.lockRules, [{ id: "hub-1", rule: { type: wire } }], kebab);
    }
  });

  test("a duration argument maps to the custom rule", async () => {

    const { calls, client } = makeFakeClient(HUB_SPEC);
    const { ctx, lines } = makeCommandContext({ args: [ "lock-rule", "Acme Name 6", "45m" ], calls, client });

    await door.run(ctx);

    assert.deepEqual(calls.lockRules, [{ id: "hub-1", rule: { interval: 45, type: "custom" } }]);
    assert.match(rendered(lines)[0] ?? "", /^1F - Loading Dock \(door-1\) - lock rule set to a 45 minute custom hold\.$/);
  });

  test("a token that is neither a verb nor a duration names both forms", async () => {

    const { calls, client } = makeFakeClient(HUB_SPEC);
    const { ctx } = makeCommandContext({ args: [ "lock-rule", "Acme Name 6", "sideways" ], calls, client });

    await assert.rejects(async () => door.run(ctx),
      (error: unknown) => (error instanceof CliError) && (error.exitCode === 2) && error.message.includes("keep-lock") && error.message.includes("30m"));

    assert.equal(calls.opens.length, 0);
  });

  test("each official-only verb surfaces the routing service's own capability refusal on a credential-only client", async () => {

    for(const verb of [ "keep-lock", "lock-early", "lock-now" ]) {

      const refusal = new AccessCapabilityError("This UniFi Access client cannot set the lock rule, because the rule requires the official API.");
      const { calls, client } = makeFakeClient({ ...HUB_SPEC,
        devices: [{ doorId: "door-1", id: "hub-1", lockRuleError: refusal, name: "Acme Name 6" }] });
      const { ctx } = makeCommandContext({ args: [ "lock-rule", "Acme Name 6", verb ], calls, client, credentials: CREDENTIALS_PAIR });

      // The CLI surfaces the library's verdict rather than restating it: the typed error propagates untouched to the entry point's calm cascade.
      // Sequential by intent: each verb is asserted on its own invocation.
      // eslint-disable-next-line no-await-in-loop
      await assert.rejects(async () => door.run(ctx), AccessCapabilityError, verb);

      assert.deepEqual(calls.lockRules, [], verb);
    }
  });

  test("a token-mode set on a door a handle drives goes through that handle", async () => {

    const { calls, client } = makeFakeClient(TOKEN_SPEC);
    const { ctx } = makeCommandContext({ args: [ "lock-rule", "Acme Name 13", "keep-unlock" ], calls, client, credentials: CREDENTIALS_TOKEN });

    await door.run(ctx);

    assert.deepEqual(calls.lockRules, [{ id: "hub-1", rule: { type: "keep_unlock" } }]);
    assert.deepEqual(calls.official, []);
  });
});

describe("the door emergency command", () => {

  const officialSpec = { ...HUB_SPEC, capabilities: { mode: "dual", official: true, override: "auto" } as const,
    official: { emergency: { "evacuation": false, "lockdown": true } } };

  test("the read renders both status flags", async () => {

    const { calls, client } = makeFakeClient(officialSpec);
    const { ctx, lines } = makeCommandContext({ args: [ "emergency", "--json" ], calls, client });

    await door.run(ctx);

    assert.equal(rendered(lines)[0], JSON.stringify({ "evacuation": false, "lockdown": true }));
  });

  test("each of the three states dispatches the single-verb set", async () => {

    for(const verb of [ "evacuation", "lockdown", "normal" ]) {

      const { calls, client } = makeFakeClient(officialSpec);
      const { ctx, lines } = makeCommandContext({ args: [ "emergency", verb ], calls, client });

      // Sequential by intent: each state is asserted on its own invocation.
      // eslint-disable-next-line no-await-in-loop
      await door.run(ctx);

      assert.deepEqual(calls.official.filter((call) => call.method === "spaces.setEmergency").map((call) => call.args),
        [[ verb, { signal: ctx.signal } ]], verb);
      assert.match(rendered(lines)[0] ?? "", new RegExp("^The site-wide emergency state is now " + verb + "\\.$"), verb);
    }
  });

  test("an unknown state is refused naming the three, before anything connects", async () => {

    const { calls, client } = makeFakeClient(officialSpec);
    const { ctx } = makeCommandContext({ args: [ "emergency", "panic" ], calls, client });

    await assert.rejects(async () => door.run(ctx),
      (error: unknown) => (error instanceof CliError) && (error.exitCode === 2) && error.message.includes("evacuation, lockdown, normal"));

    assert.equal(calls.opens.length, 0);
  });

  test("a credential-only identity is refused, and a direct-only pin is a usage error", async () => {

    const { calls, client } = makeFakeClient(officialSpec);
    const refused = makeCommandContext({ args: [ "emergency", "lockdown" ], calls, client, credentials: CREDENTIALS_PAIR });

    await assert.rejects(async () => door.run(refused.ctx),
      (error: unknown) => (error instanceof CliError) && error.message.includes("emergency command") && error.message.includes("official API"));

    const pinned = makeCommandContext({ args: [ "emergency", "lockdown", "--api", "direct-only" ], calls, client });

    await assert.rejects(async () => door.run(pinned.ctx), (error: unknown) => (error instanceof CliError) && (error.exitCode === 2));

    assert.equal(calls.opens.length, 0);
  });

  test("a dual client whose official capability folded away gets the calm post-connect refusal", async () => {

    const { calls, client } = makeFakeClient({ ...HUB_SPEC, capabilities: { mode: "dual", official: false, override: "auto" } });
    const { ctx } = makeCommandContext({ args: [ "emergency", "lockdown" ], calls, client });

    await assert.rejects(async () => door.run(ctx),
      (error: unknown) => (error instanceof CliError) && error.message.includes("official API"));

    assert.equal(calls.opens.length, 1, "the refusal is the connected client's own capability verdict");
  });
});

describe("the door capture scrub", () => {

  const OFFICIAL_SPEC = { ...HUB_SPEC, capabilities: { mode: "dual", official: true, override: "auto" } as const };

  test("the lock-rule read is scrubbed while the rule vocabulary survives", async () => {

    const lockRule = { "actor_name": "Dr. Jane Smith", "ended_time": 1755300000, "type": "keep_unlock" };
    const spec = { ...OFFICIAL_SPEC, official: { lockRule } };

    const plain = makeFakeClient(spec);
    const plainRun = makeCommandContext({ args: [ "lock-rule", "Acme Name 13", "--json" ], calls: plain.calls, client: plain.client });

    await door.run(plainRun.ctx);

    assert.equal(rendered(plainRun.lines)[0], JSON.stringify(lockRule), "without the flag the read is byte-identical to what the controller answered");

    const scrubbed = makeFakeClient(spec);
    const scrubbedRun = makeCommandContext({ args: [ "lock-rule", "Acme Name 13", "--json", "--scrub" ], calls: scrubbed.calls, client: scrubbed.client });

    await door.run(scrubbedRun.ctx);

    const text = rendered(scrubbedRun.lines)[0] ?? "";

    assert.ok(!text.includes("Dr. Jane Smith"));
    assert.ok(text.includes("keep_unlock"), "the rule vocabulary is evidence and survives");
    assert.ok(text.includes("1755300000"), "and so does the time the rule ends");
  });

  test("the emergency read is scrubbed while both status flags survive", async () => {

    const emergency = { "actor_name": "Dr. Jane Smith", "evacuation": false, "lockdown": true };
    const { calls, client } = makeFakeClient({ ...OFFICIAL_SPEC, official: { emergency } });
    const { ctx, lines } = makeCommandContext({ args: [ "emergency", "--json", "--scrub" ], calls, client });

    await door.run(ctx);

    const text = rendered(lines)[0] ?? "";
    const printed = JSON.parse(text) as { evacuation: boolean; lockdown: boolean };

    assert.ok(!text.includes("Dr. Jane Smith"));
    assert.equal(printed.lockdown, true, "the state in force is the point of the read and survives");
    assert.equal(printed.evacuation, false);
  });

  test("a rule change asked to scrub is refused before anything connects", async () => {

    const { calls, client } = makeFakeClient(OFFICIAL_SPEC);
    const { ctx } = makeCommandContext({ args: [ "lock-rule", "Acme Name 13", "keep-unlock", "--scrub" ], calls, client });

    await assert.rejects(async () => door.run(ctx), (error: unknown) => (error instanceof CliError) && (error.exitCode === 2) &&
      (error.message === "A rule change prints a confirmation rather than a document, so --scrub applies to the rule read only."));

    assert.equal(calls.opens.length, 0);
  });

  test("a state change asked to scrub is refused before anything connects", async () => {

    const { calls, client } = makeFakeClient(OFFICIAL_SPEC);
    const { ctx } = makeCommandContext({ args: [ "emergency", "lockdown", "--scrub" ], calls, client });

    await assert.rejects(async () => door.run(ctx), (error: unknown) => (error instanceof CliError) && (error.exitCode === 2) &&
      (error.message === "A state change prints a confirmation rather than a document, so --scrub applies to the state read only."));

    assert.equal(calls.opens.length, 0);
  });
});

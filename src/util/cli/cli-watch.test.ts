/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * cli-watch.test.ts: Tests for the ufa watch group - the compiled filter engine over the capture corpus, the events grammar, the raw capture rail, and the
 * door-state rail. Every test runs offline against the structural fake; the filter tests run against the committed capture corpus rather than hand-written packets,
 * so what they pin is the wire as it actually arrived.
 */
import type { AccessDoorStateEntry, AccessEventPacket } from "../../index.ts";
import { CliError, compileEventFilters, packetSubjectId } from "./shared.ts";
import type { FakeClientSpec, FakeDoorSpec } from "./cli.helpers.ts";
import { accessEventPacketsDoorStateFixture, accessEventPacketsInteractiveFixture } from "../../protocol/events.fixtures.ts";
import { describe, test } from "node:test";
import { makeCommandContext, makeFakeClient, rendered, specimen } from "./cli.helpers.ts";
import assert from "node:assert/strict";
import { buildDeviceResolution } from "./lookup.ts";
import { watch } from "./commands/watch.ts";
import { watchEvents } from "./commands/watch-events.ts";
import { watchRaw } from "./commands/watch-raw.ts";
import { watchState } from "./commands/watch-state.ts";

// Named specimens from the committed corpus, each chosen for what it proves about attribution.
const RING = specimen(accessEventPacketsInteractiveFixture, "access.remote_view");
const LOG_ADD = specimen(accessEventPacketsInteractiveFixture, "access.logs.add");
const CANCEL = specimen(accessEventPacketsInteractiveFixture, "access.remote_view.change");
const REMOTE_UNLOCK = specimen(accessEventPacketsInteractiveFixture, "access.data.device.remote_unlock");
const DOOR_STATE_DEVICE = specimen(accessEventPacketsDoorStateFixture, "access.data.v2.device.update");
const DOOR_STATE_LOCATION = specimen(accessEventPacketsDoorStateFixture, "access.data.v2.location.update");

// The identities those specimens carry, read off the corpus: the reader that rang, the hub that unlocked, the door hub that reported its state, and the door itself.
const READER_ID = "aabbcc000002";
const HUB_ID = "aabbcc000001";
const DOOR_MINI_ID = "aabbcc000004";
const DOOR_MINI_DOOR_ID = "00000000-0000-0000-0000-00000000000e";

/* The one wire name in the unlock vocabulary that no capture in hand contains. The library's own classifier models it because earlier consumers filtered on it, and
 * its own suite pins it with a synthetic packet for exactly this reason (src/protocol/events.test.ts). We follow that precedent here: the captured remote-unlock
 * specimen carries the shortcut's positive case, and this stands in for the second name the same classified kind admits.
 */
const SYNTHETIC_DOOR_UNLOCK: AccessEventPacket = {

  "data": null,
  "event": "access.door.unlock",
  "event_object_id": DOOR_MINI_DOOR_ID,
  "receiver_id": "",
  "save_to_history": true
};

// Run the watch events command over a fixed packet set and return the lines it rendered.
async function runEvents(args: string[], packets: AccessEventPacket[], spec: FakeClientSpec = {}): Promise<string[]> {

  const { calls, client } = makeFakeClient({ packets, ...spec });
  const { ctx, lines } = makeCommandContext({ args, calls, client });

  await watchEvents.run(ctx);

  return rendered(lines);
}

// Which of the given specimens survive a filter expression, by event name. The single helper behind the operator matrix.
async function matched(args: string[], packets: AccessEventPacket[], spec: FakeClientSpec = {}): Promise<number> {

  return (await runEvents([ "--json", ...args ], packets, spec)).length;
}

describe("the filter engine", () => {

  const corpus = [ RING, CANCEL, REMOTE_UNLOCK, LOG_ADD, DOOR_STATE_DEVICE, DOOR_STATE_LOCATION ];

  test("the property operators match and decline in both directions", async () => {

    // Each row is an operator with one expression that must match its specimen and one that must not, so an always-true predicate fails half the table.
    const table: [ string, string, AccessEventPacket ][] = [
      [ "event==access.remote_view", "event==access.door.unlock", RING ],
      [ "event!=access.door.unlock", "event!=access.remote_view", RING ],
      [ "event~remote", "event~nothinghere", RING ],
      [ "event!~nothinghere", "event!~remote", RING ],
      [ "data.reason_code>100", "data.reason_code>200", CANCEL ],
      [ "data.reason_code>=105", "data.reason_code>=106", CANCEL ],
      [ "data.reason_code<200", "data.reason_code<100", CANCEL ],
      [ "data.reason_code<=105", "data.reason_code<=104", CANCEL ]
    ];

    for(const [ matching, declining, packet ] of table) {

      // Sequential by intent: each row runs its own two invocations against its own specimen.
      /* eslint-disable no-await-in-loop */
      assert.equal(await matched([matching], [packet]), 1, matching + " must match");
      assert.equal(await matched([declining], [packet]), 0, declining + " must not match");
      /* eslint-enable no-await-in-loop */
    }
  });

  test("a bare = is the equality operator", async () => {

    assert.equal(await matched(["event=access.remote_view"], [RING]), 1);
  });

  test("equality is case-insensitive", async () => {

    assert.equal(await matched(["event==ACCESS.REMOTE_VIEW"], [RING]), 1);
  });

  test("a plain pattern term matches anywhere in the value", async () => {

    // The documented grammar's "contains" rule: the term is not the whole value, and it still matches.
    assert.equal(await matched(["data.device_name~Name 68"], [RING]), 1);
    assert.equal(await matched(["data.device_name~Name 86"], [RING]), 0);
  });

  test("a wildcard term is anchored", async () => {

    assert.equal(await matched(["event~access.*view"], [RING]), 1);
    assert.equal(await matched(["event~access.*door"], [RING]), 0);
    assert.equal(await matched(["event~access.remote_vie?"], [RING]), 1);
  });

  test("a slash-delimited term is a regular expression with its own flags", async () => {

    assert.equal(await matched(["event~/^access\\.remote/"], [RING]), 1);
    assert.equal(await matched(["event~/^ACCESS\\.REMOTE/i"], [RING]), 1);
    assert.equal(await matched(["event~/^nope/"], [RING]), 0);
  });

  test("a malformed slash-delimited pattern is a calm usage error naming the pattern", async () => {

    const { calls, client } = makeFakeClient({ packets: [RING] });
    const { ctx } = makeCommandContext({ args: ["event~/[/"], calls, client });

    await assert.rejects(async () => watchEvents.run(ctx),
      (error: unknown) => (error instanceof CliError) && (error.exitCode === 2) && error.message.includes("/[/") &&
        error.message.includes("regular expression"));
  });

  test("a path the packet does not carry matches only the negated operators", async () => {

    assert.equal(await matched(["data.nothing==x"], [RING]), 0);
    assert.equal(await matched(["data.nothing!=x"], [RING]), 1);
  });

  test("every filter must match, so two contradictory terms match nothing", async () => {

    assert.equal(await matched([ "event==access.remote_view", "event==access.door.unlock" ], [RING]), 0);
  });

  test("the legacy two-token form is one equality filter", async () => {

    assert.equal(await matched([ "event", "access.remote_view" ], corpus), 1);
    assert.equal(await matched([ "event", "access.nothing" ], corpus), 0);
  });

  test("the hub and reader shortcuts match by device type in both directions", async () => {

    assert.equal(await matched(["--readers"], [RING]), 0);
    assert.equal(await matched(["--hubs"], [DOOR_STATE_DEVICE]), 0);
    assert.equal(await matched(["--readers"], [{ ...RING, data: { ...RING.data, "device_type": "UA-Reader" } }]), 1);
    assert.equal(await matched(["--hubs"], [{ ...RING, data: { ...RING.data, "device_type": "UAH" } }]), 1);
  });

  test("the ring shortcut matches rings and nothing else", async () => {

    assert.equal(await matched(["--ring"], corpus), 1);
    assert.equal(await matched(["--ring"], [ CANCEL, REMOTE_UNLOCK, LOG_ADD ]), 0);
  });

  test("the unlock shortcut matches both wire names the classifier admits", async () => {

    assert.equal(await matched(["--unlock"], [REMOTE_UNLOCK]), 1);
    assert.equal(await matched(["--unlock"], [SYNTHETIC_DOOR_UNLOCK]), 1);
    assert.equal(await matched(["--unlock"], [ RING, CANCEL, LOG_ADD ]), 0);
  });

  test("a device filter resolves a name through the shared snapshot in both the flag and the bare form", async () => {

    const spec: FakeClientSpec = { devices: [{ id: READER_ID, name: "Front Reader" }] };

    assert.equal(await matched(["--device=Front Reader"], [RING], spec), 1);
    assert.equal(await matched(["device=Front Reader"], [RING], spec), 1);
    assert.equal(await matched(["--device=Back Reader"], [RING], spec), 0);
  });

  test("a device filter falls back to comparing the term as an identifier", async () => {

    assert.equal(await matched(["--device=" + READER_ID], [RING]), 1);
    assert.equal(await matched(["--device=nobody"], [RING]), 0);
  });

  test("two different device values match nothing, because every filter must match", async () => {

    assert.equal(await matched([ "--device=" + READER_ID, "--device=" + HUB_ID ], [ RING, REMOTE_UNLOCK ]), 0);
  });

  test("a ring is attributed to the device in its payload rather than to its envelope", async () => {

    // The envelope identifier on a ring is a per-notification value, so keying on it could never match the reader that rang.
    assert.notEqual(RING.event_object_id, READER_ID);
    assert.equal(packetSubjectId(RING), READER_ID);

    const lines = await runEvents([ "--compact", "--device=Front Reader" ], [RING], { devices: [{ id: READER_ID, name: "Front Reader" }] });

    assert.deepEqual(lines, ["[access.remote_view] Front Reader"]);
  });

  test("a door-state report is attributed through whichever facet carried it", async () => {

    // The device carrier names the device; the location carrier names the door. Both envelopes are per-notification identifiers, so neither attribution can come
    // from there.
    assert.notEqual(DOOR_STATE_DEVICE.event_object_id, DOOR_MINI_ID);
    assert.equal(packetSubjectId(DOOR_STATE_DEVICE), DOOR_MINI_ID);
    assert.notEqual(DOOR_STATE_LOCATION.event_object_id, DOOR_MINI_DOOR_ID);
    assert.equal(packetSubjectId(DOOR_STATE_LOCATION), DOOR_MINI_DOOR_ID);

    assert.equal(await matched(["--device=" + DOOR_MINI_ID], [DOOR_STATE_DEVICE]), 1);
    assert.equal(await matched(["--device=" + DOOR_MINI_DOOR_ID], [DOOR_STATE_LOCATION]), 1);
  });

  test("a cancellation and an unmodeled packet fall back to the envelope identifier", async () => {

    // Neither carries device attribution of its own, so the envelope is all there is.
    assert.equal(packetSubjectId(CANCEL), CANCEL.event_object_id);
    assert.equal(packetSubjectId(LOG_ADD), LOG_ADD.event_object_id);
    assert.equal(await matched(["--device=" + LOG_ADD.event_object_id], [LOG_ADD]), 1);
  });

  test("a null payload compares as the word null", async () => {

    // A deletion notification carries `data: null`, and matching that is something the grammar can express.
    assert.equal(await matched(["data==null"], [SYNTHETIC_DOOR_UNLOCK]), 1);
    assert.equal(await matched(["data==null"], [RING]), 0);
  });

  test("a value with no meaningful text form matches only the negated operators", async () => {

    // The payload object itself has no text form worth comparing against, so it answers exactly as an absent path does.
    assert.equal(await matched(["data==anything"], [RING]), 0);
    assert.equal(await matched(["data!=anything"], [RING]), 1);
  });

  test("a path that descends through a non-object resolves to nothing", async () => {

    // "event" is a string, so "event.nested" has nowhere to go - and an unresolvable path answers only the negated operators.
    assert.equal(await matched(["event.nested==x"], [RING]), 0);
    assert.equal(await matched(["event.nested!=x"], [RING]), 1);
  });

  test("the compiled predicate list is built once and reads the snapshot per packet", async () => {

    // The resolution snapshot is taken before the stream opens, so a name resolves the same way for every packet in a run.
    const { client } = makeFakeClient({ devices: [{ id: READER_ID, name: "Front Reader" }] });
    const resolve = buildDeviceResolution(client as never);
    const filters = compileEventFilters({ resolve, shortcuts: { device: ["Front Reader"] }, tokens: [] });

    assert.equal(filters.length, 1);
    assert.equal(filters[0]?.(RING), true);
    assert.equal(filters[0]?.(CANCEL), false);
  });
});

describe("the watch events command", () => {

  test("the compact rendering names the event and the device", async () => {

    const lines = await runEvents(["--compact"], [ RING, CANCEL ], { devices: [{ id: READER_ID, name: "Front Reader" }] });

    assert.deepEqual(lines, [ "[access.remote_view] Front Reader", "[access.remote_view.change] " + CANCEL.event_object_id ]);
  });

  test("the fields rendering projects the paths it was given", async () => {

    const lines = await runEvents(["--fields=event,data.device_id,data.nothing"], [RING]);

    assert.deepEqual(lines, ["{\"event\":\"access.remote_view\",\"data.device_id\":\"" + READER_ID + "\"}"]);
  });

  test("the JSON rendering preserves each packet's own field order", async () => {

    const lines = await runEvents(["--json"], [RING]);

    assert.equal(lines[0], JSON.stringify(RING));
  });

  test("the output flags cannot be combined", async () => {

    const pairs = [ [ "--json", "--compact" ], [ "--json", "--fields=event" ], [ "--compact", "--fields=event" ] ];

    for(const args of pairs) {

      const { client } = makeFakeClient({ packets: [RING] });
      const { ctx } = makeCommandContext({ args, client });

      // Sequential by intent: each pair is asserted on its own invocation.
      // eslint-disable-next-line no-await-in-loop
      await assert.rejects(async () => watchEvents.run(ctx), (error: unknown) => (error instanceof CliError) && (error.exitCode === 2), args.join(" "));
    }
  });

  test("a count bounds the run and zero means no bound", async () => {

    assert.equal((await runEvents([ "--json", "--count=1" ], [ RING, CANCEL, REMOTE_UNLOCK ])).length, 1);
    assert.equal((await runEvents([ "--json", "--count=0" ], [ RING, CANCEL, REMOTE_UNLOCK ])).length, 3);
  });

  test("a negative count is refused", async () => {

    const { client } = makeFakeClient({ packets: [RING] });
    const { ctx } = makeCommandContext({ args: ["--count=-1"], client });

    await assert.rejects(async () => watchEvents.run(ctx), CliError);
  });

  test("an omitted duration means no bound", async () => {

    // With no bound armed, every packet arrives despite the per-packet delay a zero-milliseconds timer would have cut short.
    const lines = await runEvents(["--json"], [ RING, CANCEL ], { packetDelayMs: 30 });

    assert.equal(lines.length, 2);
  });

  test("a sub-second duration arms the bound, preserving the fractional-second capability", async () => {

    // A 20ms bound closes the stream before the first packet lands behind its 120ms delay - the ms unit is what expresses a bound finer than one second.
    const lines = await runEvents([ "--json", "--duration=20ms" ], [ RING, CANCEL ], { packetDelayMs: 120 });

    assert.equal(lines.length, 0);
  });

  test("a generous duration is accepted and the stream completes beneath it", async () => {

    const lines = await runEvents([ "--json", "--duration=1500ms" ], [ RING, CANCEL ], { packetDelayMs: 5 });

    assert.equal(lines.length, 2);
  });

  test("a zero-valued duration is refused by the grammar itself", async () => {

    const { calls, client } = makeFakeClient({ packets: [RING] });
    const { ctx } = makeCommandContext({ args: ["--duration=0s"], calls, client });

    await assert.rejects(async () => watchEvents.run(ctx), (error: unknown) => (error instanceof CliError) && (error.exitCode === 2));

    assert.equal(calls.opens.length, 0, "the refusal happens before anything connects");
  });

  test("a bare-number or malformed duration is refused", async () => {

    for(const value of [ "--duration=30", "--duration=soon" ]) {

      const { client } = makeFakeClient({ packets: [RING] });
      const { ctx } = makeCommandContext({ args: [value], client });

      // Sequential by intent: each value is asserted on its own invocation.
      // eslint-disable-next-line no-await-in-loop
      await assert.rejects(async () => watchEvents.run(ctx), (error: unknown) => (error instanceof CliError) && (error.exitCode === 2), value);
    }
  });

  test("stats counts by event name, most frequent first, and renders no per-event lines", async () => {

    const lines = await runEvents([ "--stats", "--json" ], [ RING, CANCEL, CANCEL ]);

    // The format flag is inert under stats rather than in conflict with it, so the pin is that no packet was rendered at all.
    assert.equal(lines.filter((line) => line.trim().startsWith("{")).length, 0);

    // The tally itself, in full: the order is by count descending, so the two-count name precedes the one-count name.
    assert.deepEqual(lines.map((line) => line.trim()),
      [ "Event Statistics:", "Total events: 3", "By Event Type:", "access.remote_view.change: 2", "access.remote_view: 1" ]);
  });

  test("a debug invocation wires the library's debug logging", async () => {

    const { calls, client } = makeFakeClient({ packets: [] });
    const { ctx } = makeCommandContext({ args: ["-d"], calls, client });

    await watchEvents.run(ctx);

    assert.equal(calls.opens[0]?.debug, true);
  });

  test("a streaming command keeps the refresh failsafe, the one-shot convention's negative control", async () => {

    const { calls, client } = makeFakeClient({ packets: [] });
    const { ctx } = makeCommandContext({ calls, client });

    await watchEvents.run(ctx);

    assert.equal(calls.opens[0]?.refreshIntervalMs, undefined);
  });
});

describe("the watch capture scrub", () => {

  // The reader's own record spells its name and its address, and the corpus carries both in the ring's payload - so both are what an unscrubbed capture leaks.
  const READER_NAME = "Test Name 68";
  const READER_SPEC = { devices: [{ id: READER_ID, name: "Front Reader" }] };

  /* The arms that assert an identity is ABSENT from scrubbed output run over an invented ring rather than the corpus's own. The committed corpus is itself
   * pseudonymized, so the identities it carries are drawn from the very vocabulary the scrub mints at run time, and whether one of them appeared in the output would
   * turn on how the two numberings happened to line up rather than on what the scrub did. An invented identity is outside that vocabulary and can never be minted,
   * so its absence is the scrub's doing and nothing else.
   */
  const SCRUBBED_ID = "02FFEE00A001";
  const SCRUBBED_NAME = "Acme Front Reader";
  const SCRUBBED_RING: AccessEventPacket = { ...RING, "data": { ...RING.data, "device_id": SCRUBBED_ID, "device_name": SCRUBBED_NAME } };
  const SCRUBBED_SPEC = { devices: [{ id: SCRUBBED_ID, name: "Front Reader" }] };

  /* Two packets naming one device, its address spelled one way in each. The second packet introduces a second address ahead of the shared one, so a run holding one
   * context and a run building a fresh context per packet answer differently: with one context the shared address keeps the stand-in it was first given, and with a
   * fresh context per packet it would be minted again at that packet's own numbering.
   */
  const SHARED_FIRST: AccessEventPacket = {

    "data": { "mac": "02FFEE000002" },
    "event": "access.data.device.update",
    "event_object_id": "packet-1",
    "receiver_id": "",
    "save_to_history": false
  };

  const SHARED_SECOND: AccessEventPacket = {

    "data": { "host_device_mac": "02FFEE000004", "mac": "02:ff:ee:00:00:02" },
    "event": "access.data.device.update",
    "event_object_id": "packet-2",
    "receiver_id": "",
    "save_to_history": false
  };

  test("without the flag every format is byte-identical to what it always printed", async () => {

    assert.equal((await runEvents(["--json"], [RING]))[0], JSON.stringify(RING));
    assert.deepEqual(await runEvents(["--compact"], [RING], READER_SPEC), ["[access.remote_view] Front Reader"]);
    assert.deepEqual(await runEvents(["--fields=data.device_id"], [RING]), ["{\"data.device_id\":\"" + READER_ID + "\"}"]);
    assert.ok((await runEvents([], [RING])).join("").includes(READER_NAME), "the default rendering prints the payload as it arrived");
  });

  test("every events format reads the scrubbed packet", async () => {

    // The composition point is the packet rather than the view, which is what makes the flag mean the same thing on the hand-rolled renderings as it does on the
    // whole-document ones. A design that wrapped the JSON path alone would pass the first of these and fail the rest.
    const formats: string[][] = [ ["--scrub"], [ "--json", "--scrub" ], [ "--compact", "--scrub" ], [ "--fields=data.device_id,data.device_name", "--scrub" ] ];

    for(const args of formats) {

      // Sequential by intent: each format is asserted on its own invocation, against its own fake.
      // eslint-disable-next-line no-await-in-loop
      const text = (await runEvents(args, [SCRUBBED_RING], SCRUBBED_SPEC)).join("");

      assert.ok(!text.includes(SCRUBBED_ID), args.join(" ") + " carries no real device identifier");
      assert.ok(!text.includes(SCRUBBED_NAME), args.join(" ") + " carries no real device name");
      assert.ok(!text.includes("Front Reader"), args.join(" ") + " carries no resolved device name");
      assert.ok(text.length > 0, args.join(" ") + " still prints the packet");
    }
  });

  test("one context spans the stream, so a device spelled two ways is still one device", async () => {

    const lines = await runEvents([ "--json", "--scrub" ], [ SHARED_FIRST, SHARED_SECOND ]);
    const first = JSON.parse(lines[0] ?? "{}") as { data: { mac: string } };
    const second = JSON.parse(lines[1] ?? "{}") as { data: { host_device_mac: string; mac: string } };

    assert.match(first.data.mac, /^[0-9A-F]{12}$/, "the first occurrence is bare and uppercase, as it arrived");
    assert.match(second.data.mac, /^([0-9a-f]{2}:){5}[0-9a-f]{2}$/, "the second occurrence keeps its own separators and case");
    assert.equal(second.data.mac.replaceAll(":", "").toUpperCase(), first.data.mac, "both spellings resolve to one stand-in across the two packets");
    assert.notEqual(second.data.host_device_mac, first.data.mac, "a genuinely different address is still a different stand-in");
    assert.ok(!lines.join("").includes("02FFEE000002") && !lines.join("").includes("02:ff:ee:00:00:02"));
  });

  test("the raw rail prints packets verbatim without the flag and pseudonymized with it", async () => {

    const plain = makeFakeClient({ packets: [ RING, LOG_ADD ] });
    const plainRun = makeCommandContext({ calls: plain.calls, client: plain.client });

    await watchRaw.run(plainRun.ctx);

    assert.deepEqual(rendered(plainRun.lines), [ JSON.stringify(RING), JSON.stringify(LOG_ADD) ]);

    const scrubbed = makeFakeClient({ packets: [ SCRUBBED_RING, LOG_ADD ] });
    const scrubbedRun = makeCommandContext({ args: ["--scrub"], calls: scrubbed.calls, client: scrubbed.client });

    await watchRaw.run(scrubbedRun.ctx);

    const text = rendered(scrubbedRun.lines).join("");

    assert.equal(rendered(scrubbedRun.lines).length, 2, "every packet still arrives");
    assert.ok(!text.includes(SCRUBBED_ID));
    assert.ok(!text.includes(SCRUBBED_NAME));
    assert.ok(text.includes("access.remote_view"), "the notification names are protocol vocabulary and survive");
  });

  test("a stats tally asked to scrub is refused before anything connects", async () => {

    const { calls, client } = makeFakeClient({ packets: [RING] });
    const { ctx } = makeCommandContext({ args: [ "--stats", "--scrub" ], calls, client });

    await assert.rejects(async () => watchEvents.run(ctx), (error: unknown) => (error instanceof CliError) && (error.exitCode === 2) &&
      (error.message === "The --stats tally counts event names rather than printing packets, so --scrub has nothing to act on."));

    assert.equal(calls.opens.length, 0);
  });
});

describe("the watch raw command", () => {

  test("every packet renders verbatim as one NDJSON line, unfiltered", async () => {

    const { calls, client } = makeFakeClient({ packets: [ RING, LOG_ADD, CANCEL ] });
    const { ctx, lines } = makeCommandContext({ calls, client });

    await watchRaw.run(ctx);

    assert.deepEqual(rendered(lines), [ JSON.stringify(RING), JSON.stringify(LOG_ADD), JSON.stringify(CANCEL) ]);
  });

  test("a count bounds the capture and zero means no bound", async () => {

    const { calls, client } = makeFakeClient({ packets: [ RING, CANCEL, REMOTE_UNLOCK ] });
    const bounded = makeCommandContext({ args: ["--count=2"], calls, client });

    await watchRaw.run(bounded.ctx);

    assert.equal(rendered(bounded.lines).length, 2);

    const unbounded = makeCommandContext({ args: ["--count=0"], calls, client });

    await watchRaw.run(unbounded.ctx);

    assert.equal(rendered(unbounded.lines).length, 3);
  });

  test("a malformed count is refused with the usage exit code, the parser contract all three watch leaves share", async () => {

    const { calls, client } = makeFakeClient({ packets: [RING] });
    const { ctx } = makeCommandContext({ args: ["--count=x"], calls, client });

    await assert.rejects(async () => watchRaw.run(ctx), (error: unknown) => (error instanceof CliError) && (error.exitCode === 2) &&
      (error.message === "The --count value must be a non-negative integer, but received \"x\"."));

    assert.equal(calls.opens.length, 0, "the refusal happens before anything connects");
  });

  test("a duration bounds the capture", async () => {

    const { calls, client } = makeFakeClient({ packetDelayMs: 120, packets: [ RING, CANCEL ] });
    const { ctx, lines } = makeCommandContext({ args: ["--duration=20ms"], calls, client });

    await watchRaw.run(ctx);

    assert.equal(rendered(lines).length, 0);
  });
});

describe("the watch state command", () => {

  // One established entry and one sparser sibling, keyed by door identity, with the topology carrying the door names the rows render by. The full names are
  // deliberately unlike the short ones, so a row rendered by the wrong spelling cannot satisfy the assertions below.
  const seeded = new Map<string, AccessDoorStateEntry>([
    [ "door-1", { "dps": "close", "dps_connected": true, "location_id": "door-1", "lock": "locked" } ],
    [ "door-2", { "location_id": "door-2" } ]
  ]);
  const doors = new Map<string, FakeDoorSpec>([ [ "door-1", { "full_name": "1F - Loading Dock", "name": "Acme Name 13", "unique_id": "door-1" } ],
    [ "door-2", { "full_name": "2F - Loading Bay", "name": "Warehouse", "unique_id": "door-2" } ] ]);
  const changed = new Map<string, AccessDoorStateEntry>([
    [ "door-1", { "dps": "open", "dps_connected": true, "location_id": "door-1", "lock": "unlocked" } ],
    [ "door-2", { "location_id": "door-2" } ]
  ]);

  test("the seeded snapshot renders before any change, named through the topology's own doors", async () => {

    const { calls, client } = makeFakeClient({ doorStates: seeded, snapshot: { doors } });
    const { ctx, lines } = makeCommandContext({ calls, client });

    await watchState.run(ctx);

    const output = rendered(lines);

    // The content is asserted, never a bare count: the door's name, its position, lock, and wiring all come from the seeded entry.
    assert.match(output[0] ?? "", /^ {2}1F - Loading Dock +position close, lock locked, wired yes$/);
    assert.match(output[1] ?? "", /^ {2}2F - Loading Bay +no established state$/);
  });

  test("each observed change renders through the same renderer as the snapshot", async () => {

    const { calls, client } = makeFakeClient({ doorStates: seeded, observations: [changed], snapshot: { doors } });
    const { ctx, lines } = makeCommandContext({ calls, client });

    await watchState.run(ctx);

    const output = rendered(lines);

    assert.equal(output.length, 4, "the snapshot and one change, two doors each");
    assert.match(output[2] ?? "", /^ {2}1F - Loading Dock +position open, lock unlocked, wired yes$/);
    assert.match(output[3] ?? "", /^ {2}2F - Loading Bay +no established state$/);
  });

  test("a count bounds the change yields and the initial render is not a count draw", async () => {

    const { calls, client } = makeFakeClient({ doorStates: seeded, observations: [ changed, seeded, changed ], snapshot: { doors } });
    const { ctx, lines } = makeCommandContext({ args: ["--count=1"], calls, client });

    await watchState.run(ctx);

    // Two doors render for the snapshot and two for the single counted change; the remaining observations never draw.
    assert.equal(rendered(lines).length, 4);
  });

  test("the JSON form emits one object per emission, keyed by door id", async () => {

    const { calls, client } = makeFakeClient({ doorStates: seeded, observations: [changed], snapshot: { doors } });
    const { ctx, lines } = makeCommandContext({ args: ["--json"], calls, client });

    await watchState.run(ctx);

    const output = rendered(lines);

    assert.equal(output.length, 2);
    assert.deepEqual(JSON.parse(output[0] ?? "{}"), Object.fromEntries(seeded));
    assert.deepEqual(JSON.parse(output[1] ?? "{}"), Object.fromEntries(changed));
  });

  test("the state command keeps the refresh failsafe, the one-shot convention's negative control", async () => {

    const { calls, client } = makeFakeClient({ doorStates: seeded, snapshot: { doors } });
    const { ctx } = makeCommandContext({ calls, client });

    await watchState.run(ctx);

    assert.equal(calls.opens[0]?.refreshIntervalMs, undefined);
  });
});

describe("the watch group", () => {

  test("the group usage lists every subcommand from the table", async () => {

    const { ctx, lines } = makeCommandContext({ args: [] });

    await watch.run(ctx);

    const text = lines.join("");

    for(const name of [ "events", "raw", "state" ]) {

      assert.match(text, new RegExp("\\n {2}" + name + " +\\S"), name + " is listed");
    }
  });

  test("an unknown subcommand names the valid set", async () => {

    const { ctx } = makeCommandContext({ args: ["firehose"] });

    await assert.rejects(async () => watch.run(ctx),
      (error: unknown) => (error instanceof CliError) && (error.exitCode === 2) && error.message.includes("events, raw, state"));
  });
});

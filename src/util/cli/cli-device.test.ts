/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * cli-device.test.ts: Tests for the ufa device group - the fleet restart policy under the `all` keyword, the access-method settings read and switched by name,
 * and the direct configuration write. Every test runs offline against the structural fake.
 */
import { AccessAbortedError, AccessCapabilityError, AccessDeclinedError } from "../../index.ts";
import { CREDENTIALS_PAIR, CREDENTIALS_TOKEN, makeCommandContext, makeFakeClient, parsedJson, rendered } from "./cli.helpers.ts";
import { describe, test } from "node:test";
import { CliError } from "./shared.ts";
import assert from "node:assert/strict";
import { device } from "./commands/device.ts";

const HUB_ID = "02ffee000000";
const READER_ID = "02ffee000002";
const ULTRA_ID = "02ffee000004";

describe("the device restart command", () => {

  test("the all keyword restarts every device in the union and reports each one", async () => {

    const { calls, client } = makeFakeClient({ accessPoints: [{ id: "port-1", name: "EAH Port 1" }],
      devices: [{ id: HUB_ID, name: "Acme Name 6" }] });
    const { ctx, lines } = makeCommandContext({ args: [ "restart", "all" ], calls, client });

    await device.run(ctx);

    assert.deepEqual(calls.restarts, [ HUB_ID, "port-1" ]);
    assert.equal(rendered(lines).length, 2);
    assert.match(rendered(lines)[0] ?? "", /Acme Name 6 .* - restarting\./);
  });

  test("the keyword is tested before name resolution, so a device named all cannot shadow it", async () => {

    const { calls, client } = makeFakeClient({ devices: [ { id: "dev-all", name: "all" }, { id: HUB_ID, name: "Acme Name 6" } ] });
    const { ctx } = makeCommandContext({ args: [ "restart", "all" ], calls, client });

    await device.run(ctx);

    assert.deepEqual(calls.restarts, [ "dev-all", HUB_ID ], "the keyword commands the fleet, never one device");
  });

  test("attached devices are restarted before the hubs that carry them", async () => {

    // The inventory deliberately reports each carrier ahead of the device it carries, which is the order that strands a reader mid-run when it is followed.
    const { calls, client } = makeFakeClient({ devices: [ { id: "hub-1", name: "Hub One" }, { id: "reader-a", name: "Reader A", uplinkId: "hub-1" },
      { id: "standalone", name: "Standalone" }, { id: "hub-2", name: "Hub Two" }, { id: "reader-b", name: "Reader B", uplinkId: "hub-2" } ] });
    const { ctx } = makeCommandContext({ args: [ "restart", "all" ], calls, client });

    await device.run(ctx);

    // Every device is still commanded exactly once: the attached ones first, then everything that connects in its own right, each side in the order the
    // inventory reported it.
    assert.deepEqual(calls.restarts, [ "reader-a", "reader-b", "hub-1", "standalone", "hub-2" ]);
  });

  test("the skip notes stay in inventory order when an attached device is not connected", async () => {

    const { calls, client } = makeFakeClient({ devices: [ { config: { "is_connected": false }, id: "reader-a", name: "Reader A", uplinkId: "hub-1" },
      { id: "hub-1", name: "Hub One" }, { config: { "is_connected": false }, id: "reader-b", name: "Reader B", uplinkId: "hub-1" } ] });
    const { ctx, lines } = makeCommandContext({ args: [ "restart", "all" ], calls, client });

    await device.run(ctx);

    // Only the command order is partitioned. What the gating pass reports it skipped still reads in the order the inventory arrived in, so an operator's notes
    // line up with the listing they just looked at.
    assert.match(rendered(lines)[0] ?? "", /Reader A .* not connected/);
    assert.match(rendered(lines)[1] ?? "", /Reader B .* not connected/);
    assert.deepEqual(calls.restarts, ["hub-1"]);
  });

  test("it restarts one named target", async () => {

    const { calls, client } = makeFakeClient({ devices: [ { id: HUB_ID, name: "Acme Name 6" }, { id: READER_ID, name: "Reader" } ] });
    const { ctx } = makeCommandContext({ args: [ "restart", "Acme Name 6" ], calls, client });

    await device.run(ctx);

    assert.deepEqual(calls.restarts, [HUB_ID]);
  });

  test("it skips a device that is already rebooting or not connected", async () => {

    const { calls, client } = makeFakeClient({ devices: [ { config: { "is_rebooting": true }, id: HUB_ID, name: "Acme Name 6" },
      { config: { "is_connected": false }, id: READER_ID, name: "Reader" } ] });
    const { ctx, lines } = makeCommandContext({ args: [ "restart", "all" ], calls, client });

    await device.run(ctx);

    assert.deepEqual(calls.restarts, []);
    assert.match(rendered(lines)[0] ?? "", /already rebooting/);
    assert.match(rendered(lines)[1] ?? "", /not connected/);
    assert.match(rendered(lines)[2] ?? "", /No connected devices to restart\./);
  });

  test("an unmatched name lists what the controller does have", async () => {

    const { calls, client } = makeFakeClient({ devices: [{ id: HUB_ID, name: "Acme Name 6" }] });
    const { ctx } = makeCommandContext({ args: [ "restart", "Nothing" ], calls, client });

    await assert.rejects(async () => device.run(ctx), (error: unknown) => {

      assert.ok(error instanceof CliError);
      assert.ok(error.message.includes("Acme Name 6 => " + HUB_ID));

      return true;
    });
  });

  test("a failed restart is reported and the run continues", async () => {

    const { calls, client } = makeFakeClient({ devices: [ { id: HUB_ID, name: "Acme Name 6", restartError: new Error("the controller refused") },
      { id: READER_ID, name: "Reader" } ] });
    const { ctx, lines } = makeCommandContext({ args: [ "restart", "all" ], calls, client });

    await device.run(ctx);

    assert.deepEqual(calls.restarts, [ HUB_ID, READER_ID ]);
    assert.match(rendered(lines)[0] ?? "", /failed: the controller refused/);
    assert.match(rendered(lines)[1] ?? "", /Reader .* - restarting\./);
  });

  test("a failed restart's line carries the diagnosis its cause held", async () => {

    const { calls, client } = makeFakeClient({ devices: [{ id: HUB_ID, name: "Acme Name 6",
      restartError: new Error("The controller refused the restart.", { cause: new Error("the device is mid-upgrade") }) }] });
    const { ctx, lines } = makeCommandContext({ args: [ "restart", "all" ], calls, client });

    await device.run(ctx);

    assert.equal(rendered(lines)[0], "Acme Name 6 (" + HUB_ID + ") - failed: The controller refused the restart: the device is mid-upgrade",
      "the bulk line carries the wrapper's sentence and the cause's words below it");
  });

  test("an abort mid-loop stops the run before the next device is commanded", async () => {

    const { calls, client } = makeFakeClient({ devices: [ { id: HUB_ID, name: "Acme Name 6", restartError: new AccessAbortedError("stopped") },
      { id: READER_ID, name: "Reader" } ] });
    const { ctx } = makeCommandContext({ args: [ "restart", "all" ], calls, client });

    await assert.rejects(async () => device.run(ctx), AccessAbortedError);

    assert.deepEqual(calls.restarts, [HUB_ID], "the second device is never commanded");
  });

  test("a record that vanishes mid-run fails its own restart and does not break the loop", async () => {

    const fake = makeFakeClient({ devices: [ { beforeRestart: (): void => {

      // The second device's record leaves controller state while the first is being restarted.
      fake.markAbsent(READER_ID);
    }, id: HUB_ID, name: "Acme Name 6" }, { id: READER_ID, name: "Reader" } ] });
    const { ctx, lines } = makeCommandContext({ args: [ "restart", "all" ], calls: fake.calls, client: fake.client });

    await device.run(ctx);

    // The line still names the device, because the run reads its own snapshot rather than a record that is no longer there.
    assert.match(rendered(lines)[1] ?? "", /^Reader \(.*\) - failed: /);
    assert.deepEqual(fake.calls.restarts, [HUB_ID]);
  });

  test("a target can be named by its identifier", async () => {

    const { calls, client } = makeFakeClient({ devices: [ { id: HUB_ID, name: "Acme Name 6" }, { id: READER_ID, name: "Reader" } ] });
    const { ctx } = makeCommandContext({ args: [ "restart", HUB_ID ], calls, client });

    await device.run(ctx);

    assert.deepEqual(calls.restarts, [HUB_ID]);
  });

  test("it requires exactly one target", async () => {

    const { client } = makeFakeClient({ devices: [] });
    const { ctx } = makeCommandContext({ args: ["restart"], client });

    await assert.rejects(async () => device.run(ctx), { exitCode: 2, name: "CliError" });
  });

  test("a token-only identity is refused before anything connects, and the one-shot convention holds", async () => {

    const { calls, client } = makeFakeClient({ devices: [{ id: HUB_ID, name: "Acme Name 6" }] });
    const refused = makeCommandContext({ args: [ "restart", "all" ], calls, client, credentials: CREDENTIALS_TOKEN });

    await assert.rejects(async () => device.run(refused.ctx), { message: /device restart command/, name: "CliError" });

    assert.equal(calls.opens.length, 0);
    assert.equal(calls.credentialLoads, 1);

    const allowed = makeCommandContext({ args: [ "restart", "all" ], calls, client });

    await device.run(allowed.ctx);

    assert.equal(calls.opens[0]?.refreshIntervalMs, false);
  });

  test("the device group does not accept the --api flag", async () => {

    // The routing override belongs to the door group alone - no device command routes - so the strict parser refuses the flag here rather than carrying it inert.
    const { calls, client } = makeFakeClient({ devices: [{ id: HUB_ID, name: "Acme Name 6" }] });
    const { ctx } = makeCommandContext({ args: [ "restart", "all", "--api", "auto" ], calls, client });

    await assert.rejects(async () => device.run(ctx), { code: "ERR_PARSE_ARGS_UNKNOWN_OPTION" });

    assert.equal(calls.opens.length, 0);
    assert.equal(calls.credentialLoads, 0);
  });
});

describe("the device state command", () => {

  // A tamper-capable device, spelled the way the controller does: the capability on the record, the reading on its own configuration row, and, where the caller
  // asks for one, the tampering-alert setting that qualifies it on the row beside it.
  const capable = (options: { alert?: string; value?: string } = {}): Record<string, unknown> => ({ "capabilities": ["tamper_proofing"],
    "configs": [ ...((options.value === undefined) ? [] : [{ "device_id": ULTRA_ID, "key": "tamper_event", "tag": "input_state", "value": options.value }]),
      ...((options.alert === undefined) ? [] : [{ "device_id": ULTRA_ID, "key": "tampering", "tag": "uah_config", "value": options.alert }]) ] });

  test("it renders each device's readings, and the tamper reading only where the hardware produces one", async () => {

    const { calls, client } = makeFakeClient({ devices: [ { config: capable({ value: "true" }), id: ULTRA_ID, name: "Front Ultra" },
      { config: { "is_online": false }, id: READER_ID, name: "Back Reader", uplinkId: HUB_ID } ] });
    const { ctx, lines } = makeCommandContext({ args: ["state"], calls, client });

    await device.run(ctx);

    const text = rendered(lines);

    assert.equal(text.length, 2);
    assert.match(text[0] ?? "", /^ +Front Ultra +online yes, uplink none, tamper detected$/);
    assert.match(text[1] ?? "", /^ +Back Reader +online no, uplink 02ffee000000$/, "a device that cannot detect tampering carries no tamper reading at all");
  });

  test("a capable device that has reported nothing reads as unreported rather than as clear", async () => {

    // The three-way answer is the whole point of the reading: a token-only client sees this for every device until an original-dialect device update delivers its
    // rows, because its census carries none.
    const { calls, client } = makeFakeClient({ devices: [ { config: capable(), id: ULTRA_ID, name: "Front Ultra" },
      { config: capable({ value: "false" }), id: READER_ID, name: "Back Reader" } ] });
    const { ctx, lines } = makeCommandContext({ args: [ "state", "all" ], calls, client });

    await device.run(ctx);

    assert.match(rendered(lines)[0] ?? "", /tamper unreported$/);
    assert.match(rendered(lines)[1] ?? "", /tamper clear$/);
  });

  test("the JSON form keys by device id, orders its members, and tells an unreported reading from an absent one", async () => {

    const { calls, client } = makeFakeClient({ devices: [ { config: capable({ value: "false" }), id: ULTRA_ID, name: "Front Ultra" },
      { config: capable(), id: HUB_ID, name: "The Hub" }, { id: READER_ID, name: "Back Reader", uplinkId: HUB_ID } ] });
    const { ctx, lines } = makeCommandContext({ args: [ "state", "--json" ], calls, client });

    await device.run(ctx);

    const parsed = parsedJson<Record<string, Record<string, unknown>>>(lines);

    // A genuine false has to survive the JSON boundary as false: a truthiness coalesce would emit null here and report a quiet device as one that never reported.
    assert.deepEqual(parsed[ULTRA_ID], { online: true, tamper: false, uplink: null });
    assert.deepEqual(parsed[HUB_ID], { online: true, tamper: null, uplink: null }, "an unestablished reading crosses as null, because stringify drops undefined");
    assert.deepEqual(parsed[READER_ID], { online: true, uplink: HUB_ID });
    assert.equal("tamper" in (parsed[READER_ID] ?? {}), false, "a device that cannot report carries no member, which is what null would have hidden");
    assert.deepEqual(Object.keys(parsed[ULTRA_ID] ?? {}), [ "online", "tamper", "uplink" ]);
  });

  test("a capable device whose tampering alert is off reads as unreported however its input row reads", async () => {

    // Both devices carry a raised input row, and only the one whose alert setting is on has a reading its hardware still stands behind.
    const { calls, client } = makeFakeClient({ devices: [ { config: capable({ alert: "false", value: "true" }), id: ULTRA_ID, name: "Front Ultra" },
      { config: capable({ alert: "true", value: "true" }), id: READER_ID, name: "Back Reader" } ] });
    const { ctx, lines } = makeCommandContext({ args: [ "state", "--json" ], calls, client });

    await device.run(ctx);

    const parsed = parsedJson<Record<string, Record<string, unknown>>>(lines);

    assert.equal(parsed[ULTRA_ID]?.["tamper"], null, "the alert is switched off, so nothing establishes a reading whatever the input row says");
    assert.equal(parsed[READER_ID]?.["tamper"], true, "and the device whose alert is on reads exactly what its input row reports");
  });

  /* A hub, spelled the way the controller does: a tamper-capable record with its alert on and clear, the terminal rows a caller wants under it, and the port
   * extension where one is asked for. Every terminal reading the listing shows comes off the library's own read of these rows rather than off a parallel copy.
   */
  const hub = (options: { extensions?: Record<string, unknown>[]; flags: Record<string, string> }): Record<string, unknown> => ({

    "capabilities": [ "tamper_proofing", "is_hub" ],
    "configs": [ { "device_id": HUB_ID, "key": "tamper_event", "tag": "input_state", "value": "false" },
      { "device_id": HUB_ID, "key": "tampering", "tag": "uah_config", "value": "true" },
      ...Object.entries(options.flags).map(([ key, value ]) => ({ "device_id": HUB_ID, key, "tag": "hub_action", value })) ],
    ...((options.extensions !== undefined) && { "extensions": options.extensions })
  });

  // A UA Hub reporting a request to exit in service and reading on, and a remote release with nothing wired to it.
  const UAH_ROWS = { "input_state_rel": "off", "input_state_rex": "on", "wiring_state_rel-neg": "off", "wiring_state_rel-pos": "off",
    "wiring_state_rex-neg": "on", "wiring_state_rex-pos": "on" };

  test("it lists each terminal a hub has evidence for, in the vocabulary's own order", async () => {

    // The terminals the hub said nothing about are absent from the line rather than rendered as empty readings, and the two it did report arrive in the order the
    // vocabulary declares them rather than the order the rows happened to arrive in.
    const { calls, client } = makeFakeClient({ devices: [{ config: hub({ flags: UAH_ROWS }), id: HUB_ID, name: "The Hub" }], hubIds: [HUB_ID] });
    const { ctx, lines } = makeCommandContext({ args: ["state"], calls, client });

    await device.run(ctx);

    assert.match(rendered(lines)[0] ?? "", /online yes, uplink none, tamper clear, rel unwired, rex on$/);
  });

  test("the JSON form carries a terminals member keyed by the library's own names", async () => {

    const { calls, client } = makeFakeClient({ devices: [{ config: hub({ flags: UAH_ROWS }), id: HUB_ID, name: "The Hub" }], hubIds: [HUB_ID] });
    const { ctx, lines } = makeCommandContext({ args: [ "state", "--json" ], calls, client });

    await device.run(ctx);

    const parsed = parsedJson<Record<string, Record<string, unknown>>>(lines);

    assert.deepEqual(parsed[HUB_ID]?.["terminals"], { "rel": { "wired": false }, "rex": { "state": true, "wired": true } });
    assert.deepEqual(parsed[HUB_ID]["bindings"], [], "a hub carrying no extensions binds no door, which is a list rather than an absent member");
    assert.deepEqual(Object.keys(parsed[HUB_ID]), [ "bindings", "online", "tamper", "terminals", "uplink" ]);
  });

  test("a terminal in service with no reading established renders unreported and crosses JSON as null", async () => {

    /* The three-way answer again, one level down: a terminal the hardware says something is wired to, whose reading is a value outside the vocabulary the
     * controller writes. A null state is what tells that apart from a terminal with nothing wired, which stringify would otherwise collapse together.
     */
    const rows = { "input_state_rex": "yes", "wiring_state_rex-neg": "on", "wiring_state_rex-pos": "on" };
    const { calls, client } = makeFakeClient({ devices: [{ config: hub({ flags: rows }), id: HUB_ID, name: "The Hub" }], hubIds: [HUB_ID] });
    const { ctx, lines } = makeCommandContext({ args: ["state"], calls, client });

    await device.run(ctx);

    assert.match(rendered(lines)[0] ?? "", /rex unreported$/);

    const json = makeFakeClient({ devices: [{ config: hub({ flags: rows }), id: HUB_ID, name: "The Hub" }], hubIds: [HUB_ID] });
    const rig = makeCommandContext({ args: [ "state", "--json" ], calls: json.calls, client: json.client });

    await device.run(rig.ctx);

    const parsed = parsedJson<Record<string, Record<string, unknown>>>(rig.lines);

    assert.deepEqual(parsed[HUB_ID]?.["terminals"], { "rex": { "state": null, "wired": true } });
  });

  test("a device that is not a hub lists no terminals at all, whatever rows it carries", async () => {

    // The same rows on a device the registry mints no hub handle for. Terminals are hub hardware, so the listing says nothing about them rather than reading the
    // rows off a device that has no terminals to report.
    const { calls, client } = makeFakeClient({ devices: [{ config: hub({ flags: UAH_ROWS }), id: READER_ID, name: "Back Reader" }] });
    const { ctx, lines } = makeCommandContext({ args: [ "state", "--json" ], calls, client });

    await device.run(ctx);

    const parsed = parsedJson<Record<string, Record<string, unknown>>>(lines);

    assert.equal("terminals" in (parsed[READER_ID] ?? {}), false);
    assert.deepEqual(Object.keys(parsed[READER_ID] ?? {}), [ "online", "tamper", "uplink" ]);

    const plain = makeFakeClient({ devices: [{ config: hub({ flags: UAH_ROWS }), id: READER_ID, name: "Back Reader" }] });
    const rig = makeCommandContext({ args: ["state"], calls: plain.calls, client: plain.client });

    await device.run(rig.ctx);

    assert.match(rendered(rig.lines)[0] ?? "", /tamper clear$/, "the line ends at the tamper segment");
  });

  test("renders a hub whose terminals are qualified by a port setting rather than by wiring", async () => {

    // A UA Ultra: no wiring pair anywhere, one input terminal, and a port setting assigning it to door-position duty. That assignment is what puts the position
    // sensor in service and leaves the request to exit reporting nothing wired.
    const rows = { "input_d1_button": "off", "input_d1_dps": "off" };
    const extensions = [{ "extension_name": "port_setting", "target_config": [{ "config_key": "rex_button_mode", "config_value": "dps" }] }];
    const { calls, client } = makeFakeClient({ devices: [{ config: hub({ extensions, flags: rows }), id: HUB_ID, name: "The Ultra" }], hubIds: [HUB_ID] });
    const { ctx, lines } = makeCommandContext({ args: ["state"], calls, client });

    await device.run(ctx);

    assert.match(rendered(lines)[0] ?? "", /tamper clear, dps off, rex unwired$/);
  });

  // A hub whose port binds a door, spelled as the controller writes one, and the same binding with everything but the door identity taken away.
  const BOUND_PORT = [{ "extension_name": "port_setting", "source_id": "port1", "target_config": [], "target_name": "Front Door", "target_value": "d-1" }];
  const BARE_PORT = [{ "extension_name": "port_setting", "target_config": [], "target_value": "d-2" }];

  test("it lists a hub's port bindings after its terminals, naming the bound door as the controller named it", async () => {

    // The door's name stands in for its identity on the default form, because a person reading a listing knows a door by its name. The segments follow the
    // terminal segments rather than interleaving with them, which is what the anchored match holds.
    const { calls, client } = makeFakeClient({ devices: [{ config: hub({ extensions: BOUND_PORT, flags: UAH_ROWS }), id: HUB_ID, name: "The Hub" }], hubIds: [HUB_ID] });
    const { ctx, lines } = makeCommandContext({ args: ["state"], calls, client });

    await device.run(ctx);

    assert.match(rendered(lines)[0] ?? "", /, rex on, door Front Door on port1$/);

    // A binding the controller wrote no name beside falls back on the door's identity, and one belonging to no named port says nothing about a port.
    const bare = makeFakeClient({ devices: [{ config: hub({ extensions: BARE_PORT, flags: UAH_ROWS }), id: HUB_ID, name: "The Hub" }], hubIds: [HUB_ID] });
    const rig = makeCommandContext({ args: ["state"], calls: bare.calls, client: bare.client });

    await device.run(rig.ctx);

    assert.match(rendered(rig.lines)[0] ?? "", /door d-2$/);
  });

  test("the JSON form carries the bindings as the library's own record shape, keyed by the door identity", async () => {

    // The identity is what crosses JSON, where the default form shows the name: a caller matching a binding against the controller's own door records needs the
    // identity, and it is carried without reshaping so the member names are the ones the library answers with everywhere else.
    const { calls, client } = makeFakeClient({ devices: [{ config: hub({ extensions: BOUND_PORT, flags: UAH_ROWS }), id: HUB_ID, name: "The Hub" }], hubIds: [HUB_ID] });
    const { ctx, lines } = makeCommandContext({ args: [ "state", "--json" ], calls, client });

    await device.run(ctx);

    const parsed = parsedJson<Record<string, Record<string, unknown>>>(lines);

    assert.deepEqual(parsed[HUB_ID]?.["bindings"], [{ "doorId": "d-1", "name": "Front Door", "port": "port1" }]);
    assert.deepEqual(Object.keys(parsed[HUB_ID]), [ "bindings", "online", "tamper", "terminals", "uplink" ]);
  });

  /* A reader's access-method rows, filed the way the controller files them: one row per key under the access-method tag. The rows below carry a mobile key the
   * read does not judge, and a pin row holding the placeholder the captures scrub it to, which is outside the pair and so establishes nothing.
   */
  const READER_ROWS = { "apple_pass": "no", "bt": "yes", "bt_button": "yes", "nfc": "yes", "pin_code": "REDACTED-00000008-", "qr_code": "yes" };
  const methodRows = (rows: Record<string, string>): Record<string, unknown> => ({

    "configs": Object.entries(rows).map(([ key, value ]) => ({ "device_id": READER_ID, key, "tag": "open_door_mode", value }))
  });

  test("it lists each access method a device's rows establish on a line of its own, under the device and in the vocabulary's own order", async () => {

    const { calls, client } = makeFakeClient({ devices: [ { config: methodRows(READER_ROWS), id: READER_ID, name: "Front Reader" },
      { id: HUB_ID, name: "The Hub" } ] });
    const { ctx, lines } = makeCommandContext({ args: ["state"], calls, client });

    await device.run(ctx);

    const text = rendered(lines);

    assert.equal(text.length, 6, "the reader's line, a line per method its rows establish, and the hub's line");
    assert.match(text[0] ?? "", /^ +Front Reader +online yes, uplink none$/, "the readings line itself is unchanged");
    assert.deepEqual(text.slice(1, 5).map((line) => line.trim()), [ "mobile enabled", "nfc enabled", "qr enabled", "touchPass disabled" ]);
    assert.equal(text[1]?.indexOf("mobile"), text[0]?.indexOf("online"), "a method line sits in the description column, under the readings it belongs to");
    assert.match(text[5] ?? "", /^ +The Hub +online yes, uplink none$/, "and a device whose rows establish no method lists none");
  });

  test("the JSON form carries the established methods keyed by name, and no member where the rows establish none", async () => {

    const { calls, client } = makeFakeClient({ devices: [ { config: methodRows(READER_ROWS), id: READER_ID, name: "Front Reader" },
      { id: HUB_ID, name: "The Hub" } ] });
    const { ctx, lines } = makeCommandContext({ args: [ "state", "--json" ], calls, client });

    await device.run(ctx);

    const parsed = parsedJson<Record<string, Record<string, unknown>>>(lines);

    assert.deepEqual(parsed[READER_ID], { accessMethods: { mobile: true, nfc: true, qr: true, touchPass: false }, online: true, uplink: null });
    assert.deepEqual(Object.keys(parsed[READER_ID] ?? {}), [ "accessMethods", "online", "uplink" ]);
    assert.equal("accessMethods" in (parsed[HUB_ID] ?? {}), false, "a device whose rows establish no method carries no member");
  });

  test("it reports one named device, and lists what the controller has when nothing matches", async () => {

    const { calls, client } = makeFakeClient({ devices: [ { config: capable({ value: "true" }), id: ULTRA_ID, name: "Front Ultra" },
      { id: READER_ID, name: "Back Reader" } ] });
    const { ctx, lines } = makeCommandContext({ args: [ "state", "Front Ultra" ], calls, client });

    await device.run(ctx);

    assert.equal(rendered(lines).length, 1);
    assert.match(rendered(lines)[0] ?? "", /Front Ultra +online yes, uplink none, tamper detected/);

    const { ctx: missing } = makeCommandContext({ args: [ "state", "Nothing" ], calls, client });

    await assert.rejects(async () => device.run(missing), (error: unknown) => {

      assert.ok(error instanceof CliError);
      assert.ok(error.message.includes("Front Ultra => " + ULTRA_ID));

      return true;
    });
  });

  test("it prints its own usage on request, and refuses more than one target before connecting", async () => {

    const { calls, client } = makeFakeClient({ devices: [{ id: HUB_ID, name: "The Hub" }] });
    const { ctx, lines } = makeCommandContext({ args: [ "state", "--help" ], calls, client });

    await device.run(ctx);

    assert.match(rendered(lines).join("\n"), /Usage: ufa device state/);
    assert.equal(calls.opens.length, 0, "the usage screen answers without a controller");
    assert.equal(calls.credentialLoads, 0, "the usage screen answers without reading the identity file");

    const { ctx: tooMany } = makeCommandContext({ args: [ "state", "One", "Two" ], calls, client });

    await assert.rejects(async () => device.run(tooMany), { exitCode: 2, name: "CliError" });
    assert.equal(calls.opens.length, 0);
    assert.equal(calls.credentialLoads, 0);
  });

  test("the readings are snapshotted before anything is rendered, so a departed record fails the whole listing", async () => {

    /* The reason the leaf copies its readings rather than reading them live: a handle whose record has left controller state throws on every read, and taking
     * them all up front means that failure arrives before a line has been written rather than half way down one.
     */
    const { calls, client } = makeFakeClient({ devices: [ { id: HUB_ID, name: "The Hub" }, { id: READER_ID, name: "Back Reader", present: false } ] });
    const { ctx, lines } = makeCommandContext({ args: ["state"], calls, client });

    await assert.rejects(async () => device.run(ctx), ReferenceError);
    assert.deepEqual(rendered(lines), []);
  });
});

describe("the device settings command", () => {

  const officialSpec = { capabilities: { mode: "dual", official: true, override: "auto" } as const, devices: [{ id: READER_ID, name: "Front Reader" }],
    official: { settings: { "access_methods": { "face": { "enabled": "no" }, "nfc": { "enabled": "yes" } }, "device_id": READER_ID } } };

  test("the settings command requires exactly one device", async () => {

    const { client } = makeFakeClient({ devices: [] });
    const { ctx } = makeCommandContext({ args: ["settings"], client });

    await assert.rejects(async () => device.run(ctx), {

      exitCode: 2,
      message: "Specify one device by name or id. Run \"ufa device settings --help\" for usage.",
      name: "CliError"
    });
  });

  test("with no flags the settings read renders", async () => {

    const { calls, client } = makeFakeClient(officialSpec);
    const { ctx, lines } = makeCommandContext({ args: [ "settings", "Front Reader", "--json" ], calls, client });

    await device.run(ctx);

    assert.deepEqual(calls.official.map((call) => call.method), ["devices.fetchSettings"]);
    assert.equal(rendered(lines)[0], JSON.stringify(officialSpec.official.settings));
  });

  test("a toggle switches the method through the device's routed write and reports it by name", async () => {

    const { calls, client } = makeFakeClient(officialSpec);
    const { ctx, lines } = makeCommandContext({ args: [ "settings", "Front Reader", "--enable", "nfc" ], calls, client });

    await device.run(ctx);

    // The command composes no official call of its own: the library's routed write carries the change, the read-back with it.
    assert.deepEqual(calls.accessMethods, [{ enabled: true, id: READER_ID, method: "nfc", signal: ctx.signal }]);
    assert.deepEqual(calls.official, [], "the command itself asked the official surface for nothing");
    assert.deepEqual(rendered(lines), ["nfc - enabled."]);
    assert.equal(calls.opens[0]?.refreshIntervalMs, false);
  });

  test("a decline is reported on its method's line in the library's own sentence, and the run goes on to the next method", async () => {

    const declined = new AccessDeclinedError("The UniFi Access controller declined to enable the face access method for device \"Front Reader\": the settings write " +
      "answered success, and the method still reads disabled.", { method: "face", reported: false });
    const { calls, client } = makeFakeClient({ ...officialSpec, devices: [{ accessMethodErrors: { face: declined }, id: READER_ID, name: "Front Reader" }] });
    const { ctx, lines } = makeCommandContext({ args: [ "settings", "Front Reader", "--enable", "face", "--disable", "nfc" ], calls, client });

    await device.run(ctx);

    assert.deepEqual(calls.accessMethods.map((call) => [ call.method, call.enabled ]), [ [ "face", true ], [ "nfc", false ] ], "the enables go first, in order");
    assert.deepEqual(rendered(lines), [ "face - declined: " + declined.message, "nfc - disabled." ]);
  });

  test("a switch that fails for any other reason is reported on its method's line, and the run continues", async () => {

    // A method the device cannot switch on any path this client holds is the library's capability refusal, which reads on the line as the library wrote it.
    const refused = new AccessCapabilityError("This UniFi Access client cannot carry the wave access method write for device \"Front Reader\", because this device's " +
      "official settings report no enabled or disabled state for that method (connected in token mode).");
    const { calls, client } = makeFakeClient({ ...officialSpec, devices: [{ accessMethodErrors: { wave: refused }, id: READER_ID, name: "Front Reader" }] });
    const { ctx, lines } = makeCommandContext({ args: [ "settings", "Front Reader", "--enable", "wave", "--enable", "nfc" ], calls, client });

    await device.run(ctx);

    assert.deepEqual(rendered(lines), [ "wave - failed: " + refused.message.replace(/\.$/, ""), "nfc - enabled." ]);
  });

  test("an abort on the first method ends the run with nothing reported and no later method switched", async () => {

    const { calls, client } = makeFakeClient({ ...officialSpec,
      devices: [{ accessMethodErrors: { nfc: new AccessAbortedError("stopped") }, id: READER_ID, name: "Front Reader" }] });
    const { ctx, lines } = makeCommandContext({ args: [ "settings", "Front Reader", "--enable", "nfc", "--enable", "face" ], calls, client });

    await assert.rejects(async () => device.run(ctx), AccessAbortedError);

    assert.deepEqual(calls.accessMethods.map((call) => call.method), ["nfc"], "the abort stopped the run before face was asked for");
    assert.deepEqual(rendered(lines), []);
  });

  test("--api holds a change to one API, whichever identity the file carries", async () => {

    const { calls, client } = makeFakeClient(officialSpec);
    const { ctx, lines } = makeCommandContext({ args: [ "settings", "Front Reader", "--disable", "pin", "--api", "direct-only" ], calls, client });

    await device.run(ctx);

    assert.equal(calls.opens[0]?.api, "direct-only", "the client opened held to the direct API");
    assert.deepEqual(calls.accessMethods.map((call) => [ call.method, call.enabled ]), [[ "pin", false ]]);
    assert.deepEqual(rendered(lines), ["pin - disabled."]);

    // An unknown spelling is the shared parse's own usage error, refused before anything connects.
    const unknown = makeCommandContext({ args: [ "settings", "Front Reader", "--disable", "pin", "--api", "sideways" ], calls, client });

    await assert.rejects(async () => device.run(unknown.ctx), { exitCode: 2, message: /--api value must be one of: auto, direct-only, official-only/, name: "CliError" });
    assert.equal(calls.opens.length, 1, "the refused invocation opened nothing");
  });

  test("an abort on a later method ends the run after the lines already reported", async () => {

    const { calls, client } = makeFakeClient({ ...officialSpec,
      devices: [{ accessMethodErrors: { face: new AccessAbortedError("stopped") }, id: READER_ID, name: "Front Reader" }] });
    const { ctx, lines } = makeCommandContext({ args: [ "settings", "Front Reader", "--enable", "nfc", "--enable", "face", "--enable", "qr" ], calls, client });

    await assert.rejects(async () => device.run(ctx), AccessAbortedError);

    assert.deepEqual(calls.accessMethods.map((call) => call.method), [ "nfc", "face" ]);
    assert.deepEqual(rendered(lines), ["nfc - enabled."], "the method switched before the abort is still reported");
  });

  test("a settings read that fails with no change requested reports nothing, because no write preceded it", async () => {

    const { calls, client } = makeFakeClient({ ...officialSpec, official: { settingsError: new AccessAbortedError("stopped") } });
    const { ctx, lines } = makeCommandContext({ args: [ "settings", "Front Reader" ], calls, client });

    await assert.rejects(async () => device.run(ctx), AccessAbortedError);

    assert.deepEqual(calls.official.map((call) => call.method), ["devices.fetchSettings"]);
    assert.deepEqual(rendered(lines), []);
  });

  test("an unknown method, an official key spelled in its place, and a contradictory pair are refused before anything connects", async () => {

    const { calls, client } = makeFakeClient(officialSpec);
    const unknown = makeCommandContext({ args: [ "settings", "Front Reader", "--enable", "telepathy" ], calls, client });

    await assert.rejects(async () => device.run(unknown.ctx), { exitCode: 2, message: /must be one of: face, mobile, nfc, pin, qr, touchPass, wave,/, name: "CliError" });

    // The official keys are the wire's spelling rather than the library's names, so bt_button and the keys no name maps are refused the same way.
    for(const key of [ "bt_button", "bt_shake", "mobile_wave", "pin_code" ]) {

      const official = makeCommandContext({ args: [ "settings", "Front Reader", "--disable", key ], calls, client });

      // eslint-disable-next-line no-await-in-loop
      await assert.rejects(async () => device.run(official.ctx), { exitCode: 2, message: new RegExp("received \"" + key + "\""), name: "CliError" });
    }

    const contradiction = makeCommandContext({ args: [ "settings", "Front Reader", "--enable", "nfc", "--disable", "nfc" ], calls, client });

    await assert.rejects(async () => device.run(contradiction.ctx), { exitCode: 2, message: /nfc/, name: "CliError" });

    assert.equal(calls.opens.length, 0);
    assert.equal(calls.credentialLoads, 0);
  });

  test("a credential-only identity switches a method, and is refused only the read, naming the official API", async () => {

    const { calls, client } = makeFakeClient({ capabilities: { mode: "credential", official: false, override: "auto" },
      devices: [{ id: READER_ID, name: "Front Reader" }] });
    const change = makeCommandContext({ args: [ "settings", "Front Reader", "--disable", "pin" ], calls, client, credentials: CREDENTIALS_PAIR });

    await device.run(change.ctx);

    assert.deepEqual(calls.accessMethods.map((call) => [ call.method, call.enabled ]), [[ "pin", false ]], "the change gates on no surface");
    assert.deepEqual(rendered(change.lines), ["pin - disabled."]);

    const { ctx } = makeCommandContext({ args: [ "settings", "Front Reader" ], calls, client, credentials: CREDENTIALS_PAIR });

    await assert.rejects(async () => device.run(ctx), (error: unknown) => {

      assert.ok(error instanceof CliError);
      assert.match(error.message, /device settings read/);
      assert.match(error.message, /official API/);

      return true;
    });

    assert.equal(calls.opens.length, 1, "only the change connected");
    assert.equal(calls.credentialLoads, 2);
  });

  test("the read lists every method by name in the library's order, over a reader's captured settings", async () => {

    // The Ultra's own specimen: mobile unlock read from bt_button, TouchPass from touch_pass, and no face, PIN, QR, or wave reader to report.
    const { calls, client } = makeFakeClient({ ...officialSpec, official: { settings: { "access_methods": { "bt_button": { "enabled": "yes" },
      "bt_tap": { "enabled": "yes" }, "nfc": { "enabled": "yes" }, "touch_pass": { "enabled": "no" } }, "device_id": READER_ID } } });
    const { ctx, lines } = makeCommandContext({ args: [ "settings", "Front Reader" ], calls, client });

    await device.run(ctx);

    assert.deepEqual(rendered(lines), [ "face - not available on this device.", "mobile - enabled.", "nfc - enabled.", "pin - not available on this device.",
      "qr - not available on this device.", "touchPass - disabled.", "wave - not available on this device." ]);
    assert.deepEqual(calls.official.map((call) => call.method), ["devices.fetchSettings"]);
  });

  test("the read lists every method as not available over a hub's empty settings", async () => {

    const { calls, client } = makeFakeClient({ ...officialSpec, official: { settings: { "access_methods": {}, "device_id": READER_ID } } });
    const { ctx, lines } = makeCommandContext({ args: [ "settings", "Front Reader" ], calls, client });

    await device.run(ctx);

    assert.deepEqual(rendered(lines), [ "face", "mobile", "nfc", "pin", "qr", "touchPass", "wave" ].map((method) => method + " - not available on this device."));
  });

  test("--scrub pseudonymizes the --json document, and changes nothing on the per-name lines", async () => {

    const { calls, client } = makeFakeClient(officialSpec);
    const plain = makeCommandContext({ args: [ "settings", "Front Reader", "--json" ], calls, client });
    const scrubbed = makeCommandContext({ args: [ "settings", "Front Reader", "--json", "--scrub" ], calls, client });

    await device.run(plain.ctx);
    await device.run(scrubbed.ctx);

    const document = parsedJson<{ "access_methods": unknown; "device_id": string }>(scrubbed.lines);

    assert.match(plain.lines.join(""), new RegExp(READER_ID), "the unscrubbed document carries the device's identifier");
    assert.equal(scrubbed.lines.join("").includes(READER_ID), false, "and the scrubbed one carries a stand-in in its place");
    assert.deepEqual(document.access_methods, officialSpec.official.settings.access_methods, "the methods' own states read as the controller sent them");

    const lines = makeCommandContext({ args: [ "settings", "Front Reader" ], calls, client });
    const scrubbedLines = makeCommandContext({ args: [ "settings", "Front Reader", "--scrub" ], calls, client });

    await device.run(lines.ctx);
    await device.run(scrubbedLines.ctx);

    assert.deepEqual(rendered(scrubbedLines.lines), rendered(lines.lines), "the per-name lines carry no identifying value for the scrub to change");
  });

  test("the usage names the methods, the read and the change forms, and the --api choice", async () => {

    const { calls, client } = makeFakeClient(officialSpec);
    const { ctx, lines } = makeCommandContext({ args: [ "settings", "--help" ], calls, client });

    await device.run(ctx);

    const usage = rendered(lines).join("\n");

    assert.match(usage, /Methods: face, mobile, nfc, pin, qr, touchPass, wave\./);
    assert.match(usage, /--enable METHOD/);
    assert.match(usage, /--disable METHOD/);
    assert.match(usage, /--api VALUE/);
    assert.equal(calls.opens.length, 0, "the usage screen answers without a controller");
  });

  test("token mode resolves the device through the same projections every other identity resolves through", async () => {

    const { calls, client } = makeFakeClient({ capabilities: { mode: "token", official: true, override: "auto" },
      devices: [ { id: READER_ID, name: "Front Reader" }, { id: HUB_ID, name: "Acme Name 6" } ],
      official: { settings: { "access_methods": {}, "device_id": READER_ID } } });
    const { ctx } = makeCommandContext({ args: [ "settings", "Front Reader" ], calls, client, credentials: CREDENTIALS_TOKEN });

    await device.run(ctx);

    // The inventory the census seeded answers the name, so the settings read is the only thing the official surface is asked for.
    assert.deepEqual(calls.official.map((call) => call.method), ["devices.fetchSettings"]);
    assert.equal(calls.official[0]?.args[0], READER_ID);
  });
});

describe("the device update command", () => {

  const spec = { devices: [{ id: READER_ID, name: "Front Reader" }] };

  test("the send path writes the payload and renders the echoed record", async () => {

    const { calls, client } = makeFakeClient(spec);
    const { ctx, lines } = makeCommandContext({ args: [ "update", "Front Reader", "--json", "{\"name\": \"Lobby Reader\"}" ], calls, client });

    await device.run(ctx);

    assert.deepEqual(calls.updates, [{ id: READER_ID, payload: { name: "Lobby Reader" } }]);
    assert.match(lines.join(""), /Lobby Reader/, "the echoed record renders");
    assert.equal(calls.opens[0]?.refreshIntervalMs, false);
  });

  test("a dry run prints the target and the payload and sends nothing", async () => {

    const { calls, client } = makeFakeClient(spec);
    const { ctx, lines } = makeCommandContext({ args: [ "update", "Front Reader", "--json", "{\"name\": \"Lobby Reader\"}", "--dry-run" ], calls, client });

    await device.run(ctx);

    assert.deepEqual(calls.updates, []);
    assert.match(rendered(lines)[0] ?? "", /dry run, nothing sent/);
    assert.equal(rendered(lines)[1], "{\"name\":\"Lobby Reader\"}");
  });

  test("the update command requires exactly one device", async () => {

    const { client } = makeFakeClient({ devices: [] });
    const { ctx } = makeCommandContext({ args: ["update"], client });

    await assert.rejects(async () => device.run(ctx), {

      exitCode: 2,
      message: "Specify one device by name or id. Run \"ufa device update --help\" for usage.",
      name: "CliError"
    });
  });

  test("a missing, malformed, or non-object payload is refused before anything connects", async () => {

    const cases: string[][] = [ [ "update", "Front Reader" ], [ "update", "Front Reader", "--json", "{nope" ], [ "update", "Front Reader", "--json", "[1]" ] ];

    for(const args of cases) {

      const { calls, client } = makeFakeClient(spec);
      const { ctx } = makeCommandContext({ args, calls, client });

      // Sequential by intent: each payload shape is asserted on its own invocation.
      // eslint-disable-next-line no-await-in-loop
      await assert.rejects(async () => device.run(ctx), (error: unknown) => {

        assert.ok(error instanceof CliError, args.join(" "));
        assert.equal(error.exitCode, 2, args.join(" "));

        return true;
      }, args.join(" "));

      assert.equal(calls.opens.length, 0, args.join(" "));
      assert.equal(calls.credentialLoads, 0, args.join(" "));
    }
  });

  test("a token-only identity is refused before anything connects", async () => {

    const { calls, client } = makeFakeClient(spec);
    const { ctx } = makeCommandContext({ args: [ "update", "Front Reader", "--json", "{}" ], calls, client, credentials: CREDENTIALS_TOKEN });

    await assert.rejects(async () => device.run(ctx), { message: /device update command/, name: "CliError" });

    assert.equal(calls.opens.length, 0);
    assert.equal(calls.credentialLoads, 1);
  });
});

describe("the device capture scrub", () => {

  test("the settings read is scrubbed while the access-method vocabulary survives", async () => {

    // The settings document names the device it belongs to and the methods its hardware offers. The identity goes; the method names and their yes/no readings are
    // exactly what a reader diagnoses with, and stay.
    const settings = { "access_methods": { "nfc": { "enabled": "yes" } }, "device_id": READER_ID, "device_name": "Front Reader" };
    const spec = { capabilities: { mode: "dual", official: true, override: "auto" } as const, devices: [{ id: READER_ID, name: "Front Reader" }],
      official: { settings } };

    const plain = makeFakeClient(spec);
    const plainRun = makeCommandContext({ args: [ "settings", "Front Reader", "--json" ], calls: plain.calls, client: plain.client });

    await device.run(plainRun.ctx);

    assert.equal(rendered(plainRun.lines)[0], JSON.stringify(settings), "without the flag the read is byte-identical to what the controller answered");

    const scrubbed = makeFakeClient(spec);
    const scrubbedRun = makeCommandContext({ args: [ "settings", "Front Reader", "--json", "--scrub" ], calls: scrubbed.calls, client: scrubbed.client });

    await device.run(scrubbedRun.ctx);

    const text = rendered(scrubbedRun.lines)[0] ?? "";

    assert.ok(!text.includes(READER_ID), "the reader's identifier does not survive the scrub");
    assert.ok(!text.includes("Front Reader"), "the reader's name does not survive the scrub");
    assert.ok(text.includes("\"nfc\""), "the access-method vocabulary survives");
    assert.ok(text.includes("\"yes\""), "and so does its reading");
  });

  test("the echoed record from a write is scrubbed", async () => {

    const { calls, client } = makeFakeClient({ devices: [{ id: READER_ID, name: "Front Reader" }] });
    const { ctx, lines } = makeCommandContext({ args: [ "update", "Front Reader", "--json", "{\"name\": \"Lobby Reader\"}", "--scrub" ], calls, client });

    await device.run(ctx);

    const text = lines.join("");

    assert.deepEqual(calls.updates, [{ id: READER_ID, payload: { name: "Lobby Reader" } }], "the write itself carries the operator's own payload, unscrubbed");
    assert.ok(!text.includes("Lobby Reader"), "the record the controller echoed back is what the flag reaches");
    assert.match(text, /Test Name \d+/);
  });

  test("a settings change asked to scrub is refused before anything connects", async () => {

    const { calls, client } = makeFakeClient({ devices: [{ id: READER_ID, name: "Front Reader" }] });
    const { ctx } = makeCommandContext({ args: [ "settings", "Front Reader", "--enable", "nfc", "--scrub" ], calls, client });

    await assert.rejects(async () => device.run(ctx), {

      exitCode: 2,
      message: "A settings change reports each method rather than printing a document, so --scrub applies to the settings read only.",
      name: "CliError"
    });

    assert.equal(calls.opens.length, 0);
    assert.equal(calls.credentialLoads, 0);
  });

  test("a settings change asked for JSON is refused before anything connects, the way the scrub is", async () => {

    const { calls, client } = makeFakeClient({ devices: [{ id: READER_ID, name: "Front Reader" }] });
    const { ctx } = makeCommandContext({ args: [ "settings", "Front Reader", "--enable", "nfc", "--json" ], calls, client });

    await assert.rejects(async () => device.run(ctx), {

      exitCode: 2,
      message: "A settings change reports each method rather than printing a document, so --json applies to the settings read only.",
      name: "CliError"
    });

    assert.equal(calls.opens.length, 0);
    assert.equal(calls.credentialLoads, 0);
  });

  test("a dry run asked to scrub is refused before anything connects", async () => {

    const { calls, client } = makeFakeClient({ devices: [{ id: READER_ID, name: "Front Reader" }] });
    const { ctx } = makeCommandContext({ args: [ "update", "Front Reader", "--json", "{\"name\": \"Lobby Reader\"}", "--dry-run", "--scrub" ], calls, client });

    await assert.rejects(async () => device.run(ctx), {

      exitCode: 2,
      message: "A dry run prints the payload you supplied rather than a controller document, so --scrub has nothing to act on.",
      name: "CliError"
    });

    assert.equal(calls.opens.length, 0);
    assert.equal(calls.credentialLoads, 0);
  });
});

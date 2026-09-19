/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * diagnostics.test.ts: Unit tests for the published channel roster. The wire names are the contract a consumer subscribing through the platform's own
 * diagnostics surface addresses, rather than through the roster, so what a member is spelled as on the wire is as much a published surface as the member itself.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { channels } from "./diagnostics.ts";

describe("channels", () => {

  /* The expected map is spelled out here rather than derived from the roster, because a map read off its own subject would agree with whatever the subject said.
   * A member added to the roster fails this until its documented name is added here, which is the point: a name reaching consumers unannounced is the case this
   * exists to catch.
   */
  test("every roster member publishes under its documented name", () => {

    assert.deepEqual(Object.fromEntries(Object.entries(channels).map(([ member, channel ]) => [ member, channel.name ])), {

      authRelogin: "unifi-access:auth:relogin",
      connectionTransition: "unifi-access:connection:transition",
      eventsClosed: "unifi-access:events:closed",
      eventsPacket: "unifi-access:events:packet",
      httpRequestEnd: "unifi-access:http:request:end",
      httpRequestStart: "unifi-access:http:request:start",
      httpThrottleEntered: "unifi-access:http:throttle:entered",
      httpThrottleExited: "unifi-access:http:throttle:exited",
      storeDispatch: "unifi-access:store:dispatch"
    });
  });
});

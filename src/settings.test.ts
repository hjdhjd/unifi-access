/* Copyright(C) 2017-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * settings.test.ts: Unit tests for the project-wide constants in settings.ts. The constants are externally observable behavior - the error limit and retry interval
 * govern how aggressively the client retries against a controller, the API timeout bounds each request, and the heartbeat timeout governs how quickly a silent
 * realtime channel is declared dead. Asserting them prevents an accidental edit (a misplaced zero, a unit confusion) from silently changing behavior on every
 * consumer.
 */
import { ACCESS_API_ERROR_LIMIT, ACCESS_API_RETRY_INTERVAL, ACCESS_API_TIMEOUT, ACCESS_BOOTSTRAP_REFRESH_INTERVAL, ACCESS_EVENTS_HEARTBEAT_TIMEOUT,
  ACCESS_OFFICIAL_API_PATH_PREFIX, ACCESS_OFFICIAL_API_PORT } from "./settings.ts";
import { describe, test } from "node:test";
import assert from "node:assert/strict";

describe("settings", () => {

  // The error limit and retry interval together encode the throttling contract: 10 consecutive errors trigger a 300-second backoff.
  test("ACCESS_API_ERROR_LIMIT is 10", () => {

    assert.equal(ACCESS_API_ERROR_LIMIT, 10, "error limit must be 10 to match the documented backoff contract");
  });

  test("ACCESS_API_RETRY_INTERVAL is 300 seconds", () => {

    assert.equal(ACCESS_API_RETRY_INTERVAL, 300, "retry interval must be 300 seconds to match the documented backoff contract");
  });

  // The API timeout is documented as "should never be greater than 5000 ms" - we lock both the value and the upper bound so future tuning can change the value but a
  // regression that pushes it past the ceiling gets a loud failure with the spec citation visible in the diff.
  test("ACCESS_API_TIMEOUT is 3500 ms and at most 5000 ms", () => {

    assert.equal(ACCESS_API_TIMEOUT, 3500, "API timeout must be 3500 ms");
    assert.ok(ACCESS_API_TIMEOUT <= 5000, "API timeout must never exceed the documented 5000 ms ceiling");
  });

  test("ACCESS_BOOTSTRAP_REFRESH_INTERVAL is 120000 ms", () => {

    assert.equal(ACCESS_BOOTSTRAP_REFRESH_INTERVAL, 120000, "the bootstrap refresh failsafe must run on the documented two-minute cadence");
  });

  test("ACCESS_EVENTS_HEARTBEAT_TIMEOUT is 10000 ms", () => {

    assert.equal(ACCESS_EVENTS_HEARTBEAT_TIMEOUT, 10000, "the events heartbeat watchdog must trip at the documented 10-second silence threshold");
  });

  // The official API's address. These are not tuning values like the ones above - they are where the controller answers, so a wrong one does not degrade behavior,
  // it makes the entire official surface unreachable.
  test("ACCESS_OFFICIAL_API_PORT is 12445", () => {

    assert.equal(ACCESS_OFFICIAL_API_PORT, 12445, "the official API answers on its own port rather than through the proxy the Access application sits behind");
  });

  test("ACCESS_OFFICIAL_API_PATH_PREFIX is the developer application path", () => {

    assert.equal(ACCESS_OFFICIAL_API_PATH_PREFIX, "/api/v1/developer");
    assert.equal(ACCESS_OFFICIAL_API_PATH_PREFIX.startsWith("/"), true, "the prefix joins a host, so it carries its own leading slash");
    assert.equal(ACCESS_OFFICIAL_API_PATH_PREFIX.endsWith("/"), false, "an endpoint path carries the slash that separates it from the prefix");
  });

  // Coherence of the timing set, not just the individual values. The watchdog window is derived from the controller's own ~5-second heartbeat cadence, so it must
  // leave room for at least one missed beat; and a request deadline that outlived the channel watchdog would let a single wedged request survive the teardown that
  // is supposed to clear it. These relationships are the contract a future retuning has to preserve, so they are asserted rather than left to the comments.
  test("the timing constants are coherent: the watchdog tolerates a missed heartbeat and outlives a single request deadline", () => {

    // The controller's realtime heartbeat cadence, in milliseconds. This is the wire's behavior, not ours, which is why it appears here as a literal rather than as
    // one of our own exported constants.
    const heartbeatCadenceMs = 5000;

    assert.ok(ACCESS_EVENTS_HEARTBEAT_TIMEOUT >= (heartbeatCadenceMs * 2), "the watchdog window must tolerate at least one missed heartbeat");
    assert.ok(ACCESS_API_TIMEOUT < ACCESS_EVENTS_HEARTBEAT_TIMEOUT, "a request deadline must expire well before the channel watchdog declares the stream dead");
    assert.ok((ACCESS_API_RETRY_INTERVAL * 1000) > ACCESS_API_TIMEOUT, "the backoff cooldown must be far longer than the request deadline that feeds it");
  });

  // Sanity: every exported constant must be a finite positive integer. A negative or NaN value would indicate a typo and would corrupt the timing logic in subtle
  // ways the per-value tests might miss - a unit slip that still satisfies an equality assertion elsewhere, for instance.
  test("every exported constant is a finite positive integer", () => {

    const values = [

      [ "ACCESS_API_ERROR_LIMIT", ACCESS_API_ERROR_LIMIT ],
      [ "ACCESS_API_RETRY_INTERVAL", ACCESS_API_RETRY_INTERVAL ],
      [ "ACCESS_API_TIMEOUT", ACCESS_API_TIMEOUT ],
      [ "ACCESS_BOOTSTRAP_REFRESH_INTERVAL", ACCESS_BOOTSTRAP_REFRESH_INTERVAL ],
      [ "ACCESS_EVENTS_HEARTBEAT_TIMEOUT", ACCESS_EVENTS_HEARTBEAT_TIMEOUT ]
    ] as const;

    for(const [ name, value ] of values) {

      assert.ok(Number.isInteger(value), name + " must be an integer, got " + String(value));
      assert.ok(value > 0, name + " must be positive, got " + String(value));
      assert.ok(Number.isFinite(value), name + " must be finite, got " + String(value));
    }
  });
});

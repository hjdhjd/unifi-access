/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * testing.helpers.ts: Cross-cutting helpers shared across the unit tests in this codebase.
 *
 * These helpers exist as code rather than data because they encapsulate behavior the test runtime needs: a typed rejection assertion, a poll that waits in
 * macrotask turns rather than in time, the walk that flattens a topology document's hardware out of its nesting, the narrowing of a nullable lookup to the value
 * it found, a typed subscription to a diagnostics channel, and the errno-shaped error a transport failure arrives as. They live in src/ so they sit beside the
 * production code they support, and the helpers exclude pattern in tsconfig.build.json and the coverage flags keep them out of the published build and out of
 * the coverage denominators. Deterministic time control is the shared library's `TestClock` (`homebridge-plugin-utils/testing`).
 *
 * A helper earns its place here when more than one test module needs it. A helper specific to a single source module belongs beside that module as a sibling
 * helpers file instead, and the codebase's fixture convention is verbatim captured literals rather than factories, so no fixture builders live here.
 */
import type { AccessBootstrapConfig, AccessDeviceConfig } from "./types/index.ts";
import type { Channel } from "node:diagnostics_channel";
import assert from "node:assert/strict";
import { settle } from "homebridge-plugin-utils/testing";

/**
 * Assert that a subject rejects with a particular error class, and run the caller's own field checks against the narrowed error.
 *
 * Every suite that asserts a typed rejection writes the same shape: reject, establish the class, then read the fields that make the refusal the right one. Writing
 * that shape once is what lets a site say only what it is about - the class and the fields - rather than restating the callback protocol `assert.rejects` expects,
 * and it is what keeps a field assertion free of a cast, because the check receives the error already narrowed to the class.
 *
 * @param subject    - The promise, or the function returning one, that must reject.
 * @param errorClass - The class the rejection has to be an instance of.
 * @param options    - The field checks and the failure message.
 * @param options.check   - Runs against the narrowed error, so a field assertion needs no cast of its own.
 * @param options.message - Reported when the rejection is of the wrong class. Defaults to naming the class expected and what arrived instead.
 */
export async function assertRejectsWith<E extends Error>(subject: Promise<unknown> | (() => Promise<unknown>), errorClass: new (...args: never[]) => E,
  options: { check?: (error: E) => void; message?: string } = {}): Promise<void> {

  await assert.rejects(subject, (error: unknown) => {

    assert.ok(error instanceof errorClass, options.message ?? ("expected " + errorClass.name + ", got " + String(error)));
    options.check?.(error);

    return true;
  });
}

// How many macrotask turns a poll may spend before it gives up. It is a count of turns rather than a duration: each turn is one `settle()`, which drains the
// whole microtask cascade and passes the event loop's poll phase, so a budget spent here costs the predicate's own evaluations and nothing else. Every wait this
// corpus performs runs over a fake socket, a mock reply, or a store's own wake, and the authoring battery measured a maximum of 6 turns across three ten-run
// passes, so 100 leaves better than fifteen times the room any site has needed.
const SETTLE_UNTIL_TURNS = 100;

/**
 * Evaluate a predicate until it holds, crossing one macrotask turn between attempts and failing once the turn budget is spent.
 *
 * The cascade this serves is in-process and short: a fake socket's dispatch, a mock reply, a store's wake. One turn drains the whole microtask chain behind any of
 * them and a few turns exhaust the longest of them, so the budget is a count of turns rather than a deadline - an exhausted poll has spent predicate evaluations
 * rather than time, and a run under a loaded CPU waits exactly as many turns as a run on an idle one. Pair it with a `TestClock`'s `advance()` inside the predicate
 * to drive time-dependent production code forward between attempts. A wait on a real socket is a different problem and not this helper's job...that one reaches
 * for the shared testing library's real-time `waitUntil`, and no site in this corpus needs one.
 *
 * @param predicate - Returns a boolean or a promise of one. Evaluated before anything is yielded, then once after each turn the budget allows.
 * @param options   - The budget and the failure message.
 * @param options.message - Reported when the budget is spent with the predicate still false. Defaults to naming the budget.
 * @param options.turns   - How many macrotask turns to spend. Defaults to {@link SETTLE_UNTIL_TURNS}.
 */
export async function settleUntil(predicate: () => boolean | Promise<boolean>, options: { message?: string; turns?: number } = {}): Promise<void> {

  const turns = options.turns ?? SETTLE_UNTIL_TURNS;

  // The awaits are sequential because that is the poll itself: the predicate is the gate and the turn is the cadence, so evaluating ahead of the yield would answer
  // before the cascade it is waiting on has run.
  for(let turn = 0; turn <= turns; turn++) {

    // eslint-disable-next-line no-await-in-loop
    if(await predicate()) {

      return;
    }

    // The evaluation that follows the last turn has already seen everything the budget can release, so there is nothing left to yield for.
    if(turn === turns) {

      break;
    }

    // eslint-disable-next-line no-await-in-loop
    await settle();
  }

  assert.fail(options.message ?? ("the predicate did not hold within " + turns.toString() + " macrotask turns."));
}

/**
 * Every device record a topology document holds, walked out of its nesting in document order: the hardware the building hosts directly, then the hardware
 * attached to each door of each floor. The records are the document's own objects rather than copies, which is what lets a test read the document's own spelling
 * of a record beside what the state stored for it, and re-spell a record in place on a clone.
 *
 * @param bootstrap - The topology document to walk.
 *
 * @returns The document's device records, in document order.
 */
export function topologyDevices(bootstrap: AccessBootstrapConfig): AccessDeviceConfig[] {

  return [ ...(bootstrap.device_groups ?? []).flat(), ...(bootstrap.floors ?? []).flatMap((floor) => floor.doors.flatMap((door) => door.device_groups.flat())) ];
}

/**
 * Assert that a lookup found what it was asked for, and hand the value back narrowed to its present type.
 *
 * Every suite that reads a handle, a record, or an entry through a lookup that can answer `undefined` writes the same shape: look the value up, then `assert.ok` it
 * so the compiler narrows every read that follows. Writing that shape once is what lets a failure name what the test expected to find rather than report a bare
 * falsy value, and it is what types the result without a cast, because the value comes back already narrowed.
 *
 * @param value       - What the lookup answered. Anything but `undefined` or `null` passes.
 * @param description - What the lookup was expected to find, named in the failure message.
 *
 * @returns The value itself, narrowed to exclude `undefined` and `null`.
 */
export function present<T>(value: T, description: string): NonNullable<T> {

  assert.ok((value !== undefined) && (value !== null), "expected " + description + ", got " + String(value));

  return value;
}

/**
 * The errno-shaped error the platform and undici raise when a connection fails: an `Error` carrying a `code` beside its message.
 *
 * Every suite that drives a transport failure needs one of these, and assembling it inline puts the shape - which property carries the code, and that the code
 * sits on the error itself rather than on a cause - at each site. Building it here is what lets a site say only which failure it means.
 *
 * @param message - The message the platform would have raised, as in "connect ECONNREFUSED".
 * @param code    - The errno the failure reports, as in "ECONNREFUSED".
 *
 * @returns The error, typed as the platform's own errno exception.
 */
export function errnoError(message: string, code: string): NodeJS.ErrnoException {

  return Object.assign(new Error(message), { code });
}

/**
 * Subscribe to a diagnostics channel, receiving each published payload typed by the channel itself.
 *
 * The platform types every channel's listener with an `unknown` message whatever the channel's own type parameter says, so a suite subscribing directly writes a
 * cast at every site...and a cast written per site is a cast that can name the wrong payload. We register a forwarding wrapper rather than the handler itself so
 * that cast lives in one place, the single unavoidable boundary cast, and everything above it is fully typed: a suite reaching for a member of the published
 * roster reads the payload's own fields without one. The handle is a `Disposable` so a test binds it with `using` and the release happens at scope exit whichever
 * way the test leaves.
 *
 * @param channel - The roster member to subscribe to.
 * @param handler - Invoked with each payload published on the channel until the returned handle is disposed.
 *
 * @returns A `Disposable` that removes this subscription when disposed.
 */
export function subscribeTo<T>(channel: Channel<T>, handler: (message: T) => void): Disposable {

  const listener = (message: unknown): void => handler(message as T);

  channel.subscribe(listener);

  return { [Symbol.dispose]: (): void => channel.unsubscribe(listener) };
}

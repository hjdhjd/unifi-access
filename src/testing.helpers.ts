/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * testing.helpers.ts: Cross-cutting helpers shared across the unit tests in this codebase.
 *
 * These helpers exist as code rather than data because they encapsulate behavior the test runtime needs: the walk that flattens a topology document's hardware out
 * of its nesting, a typed subscription to a diagnostics channel, and the refresh callback handed to a store that must never refresh. They live in src/ so they sit
 * beside the production code they support, and the helpers exclude pattern in tsconfig.build.json and the coverage flags keep them out of the published build and
 * out of the coverage denominators. The general-purpose helpers are the ones `homebridge-plugin-utils/testing` ships - deterministic time control, the turn-budgeted
 * poll, the narrowing of a nullable lookup, and the errno-shaped error a transport failure arrives as among them - so a helper lives here only when that entry carries
 * nothing that covers it.
 *
 * A helper earns its place here when more than one test module needs it. A helper specific to a single source module belongs beside that module as a sibling
 * helpers file instead, and the codebase's fixture convention is verbatim captured literals rather than factories, so no fixture builders live here.
 */
import type { AccessBootstrapConfig, AccessDeviceConfig } from "./types/index.ts";
import type { Channel } from "node:diagnostics_channel";

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

  return [ ...(bootstrap.device_groups ?? []).flat(), ...(bootstrap.floors ?? []).flatMap((floor) => (floor.doors ?? []).flatMap((door) => door.device_groups.flat())) ];
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

/**
 * The refresh callback for a store whose test never expects a refresh pass: it rejects with an error naming that expectation.
 *
 * A suite that arranges a store's state by explicit dispatch builds it with the failsafe disabled and hands it this callback, so a refresh that runs anyway
 * re-seeds nothing over the state the test arranged and fails with an error that says which expectation broke. Writing the callback once is what keeps that
 * message the same at every site, and it is what lets a site say only that it expects no refresh.
 */
export async function refuseRefresh(): Promise<void> {

  throw new Error("the refresh callback must not be called");
}

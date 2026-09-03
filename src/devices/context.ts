/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * context.ts: The narrow, package-internal dependency surface a device projection needs from the client.
 */
import type { AccessLogging } from "../logging.ts";
import type { AccessRoutingView } from "../client/routing.ts";
import type { Nullable } from "../types/index.ts";
import type { StateStore } from "../state/store.ts";
import type { Transport } from "../transport/http.ts";

/**
 * The store as the devices tier is allowed to see it: the two read shapes and nothing else.
 *
 * This is what makes the tier's write-through rule a guarantee the compiler holds rather than a convention a reviewer has to notice. A device command advances the
 * controller and then waits for the realtime stream to report the change back, exactly as every other subscriber does; it never folds its own response into state.
 * Typing the context's store as this slice means the dispatch chokepoint is not reachable from the devices tier at all, so the rule cannot be broken by accident.
 *
 * @category Devices
 */
export type StateReader = Pick<StateStore, "observe" | "snapshot">;

/**
 * The package-internal surface a device projection - and the registry that mints them - depends on, supplied by the client at the composition root. It is
 * deliberately narrow, so none of the full client surface leaks into the devices tier and a test builds a small fake context rather than a whole client.
 *
 * A projection reads its record through `store` (a snapshot for its synchronous getters, an observation for its change stream) and issues its write-through
 * commands through `transport`. It holds no state of its own: it is a live view over the one source of truth.
 *
 * `transport` is `null` on a client with no credentials, where the routing decision never takes a direct path, so a projection never dispatches through it. The
 * nullability states what such a client actually holds rather than making the tier's presence conditional on it.
 *
 * `routing` is the door operations that can take either of the controller's two APIs, and it is deliberately the routing view rather than the routing service or
 * the official facade. A projection holding the facade could issue an official call outside the routing decision; a projection holding the service could write to
 * the capability verdicts it keeps. This tier decides neither, and the type is what says so.
 *
 * @category Devices
 */
export interface AccessDeviceContext {

  readonly host: string;
  readonly log: AccessLogging;
  readonly routing: AccessRoutingView;
  readonly store: StateReader;
  readonly transport: Nullable<Transport>;
}

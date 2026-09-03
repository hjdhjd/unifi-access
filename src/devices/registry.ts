/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * registry.ts: The projection factory - typed device, hub, and access-point lookup and iteration over the current state.
 */
import type { AccessState, AccessStateDevice } from "../protocol/reducer.ts";
import { isEnterpriseHubRecord, isHub, selectAccessPoints } from "../state/selectors.ts";
import { AccessDevice } from "./device.ts";
import type { AccessDeviceContext } from "./context.ts";
import { AccessHub } from "./hub.ts";

/**
 * The projection factory the client composes. It turns identities into live handles over the current store snapshot: every modeled device as an
 * {@link AccessDevice}, the hub-capable ones as command-bearing {@link AccessHub} handles, and each door-serving port of a multi-port Enterprise Access Hub as a
 * handle of its own.
 *
 * Three views, and which one to reach for follows from what a consumer wants to do. `device` reaches any record, including the ones the other views deliberately
 * withhold, and is where configuration reads and writes happen. `hub` reaches the hardware that drives a single door. `accessPoint` reaches one door of a
 * multi-port hub - the view that exists because a consumer looking for "the hardware serving this door" would otherwise find nothing at seven of the eight doors an
 * eight-port hub drives.
 *
 * A building-hosted Enterprise Access Hub is deliberately absent from the hub views. Its record binds a whole hub rather than any one door, so a door command
 * issued through it would resolve to an arbitrary one of its ports - the exact confusion the per-port view exists to prevent. It stays fully reachable through
 * `device` for configuration, and its doors through `accessPoints`. The withholding and the expansion read the same predicate, so a record is expanded into
 * per-port handles exactly where it is withheld from whole-hub ones.
 *
 * Handles are not cached: each lookup or iteration mints fresh ones. That is deliberate and cheap - a handle is a thin view over the single source of truth, and
 * identity is meaningless for a value that only reads through.
 *
 * @category Devices
 */
export class AccessDeviceRegistry {

  readonly #ctx: AccessDeviceContext;

  constructor(ctx: AccessDeviceContext) {

    this.#ctx = ctx;
  }

  /**
   * Look up any modeled device by identity, or `undefined` when the current state holds no such device.
   *
   * @param id - The device's `unique_id`.
   *
   * @returns A live device handle, or `undefined`.
   */
  device(id: string): AccessDevice | undefined {

    return (this.#ctx.store.snapshot().devices.get(id) === undefined) ? undefined : new AccessDevice(this.#ctx, id, deviceSelector(id));
  }

  /**
   * Every modeled device in the current state, as live handles. Includes the building-hosted Enterprise Access Hub record that the hub views withhold.
   *
   * @returns The device handles.
   */
  devices(): readonly AccessDevice[] {

    return [...this.#ctx.store.snapshot().devices.keys()].map((id) => new AccessDevice(this.#ctx, id, deviceSelector(id)));
  }

  /**
   * Look up a hub by identity, or `undefined` when the current state holds no hub-capable device under it.
   *
   * A building-hosted Enterprise Access Hub answers `undefined` here even though it is hub-capable, because a door command issued against the whole hub would
   * resolve to an arbitrary one of its ports. Reach its doors through {@link AccessDeviceRegistry.accessPoint} instead, and the record itself through
   * {@link AccessDeviceRegistry.device}.
   *
   * @param id - The device's `unique_id`.
   *
   * @returns A live hub handle, or `undefined`.
   */
  hub(id: string): AccessHub | undefined {

    const state = this.#ctx.store.snapshot();
    const config = state.devices.get(id);

    if((config === undefined) || !isHub(config) || isEnterpriseHubRecord(config, state)) {

      return undefined;
    }

    return new AccessHub(this.#ctx, id, deviceSelector(id));
  }

  /**
   * Every hub in the current state, as live handles, excluding the building-hosted Enterprise Access Hub records for the reason {@link AccessDeviceRegistry.hub}
   * gives.
   *
   * @returns The hub handles.
   */
  hubs(): readonly AccessHub[] {

    const state = this.#ctx.store.snapshot();

    return [...state.devices.values()].filter((config) => isHub(config) && !isEnterpriseHubRecord(config, state))
      .map((config) => new AccessHub(this.#ctx, config.unique_id, deviceSelector(config.unique_id)));
  }

  /**
   * Look up one door-serving port of an Enterprise Access Hub by the port's own identity, or `undefined` when the expansion holds no such port.
   *
   * The handle is bound to the synthesized port record rather than to the hub's, so its door command resolves to the door that port serves and its device-scoped
   * commands key on the port's own identity - which is the identity the controller itself addresses a port by.
   *
   * @param id - The port's `unique_id`.
   *
   * @returns A live hub handle over that port, or `undefined`.
   */
  accessPoint(id: string): AccessHub | undefined {

    return (findAccessPoint(this.#ctx.store.snapshot(), id) === undefined) ? undefined : new AccessHub(this.#ctx, id, accessPointSelector(id));
  }

  /**
   * Every door-serving port of every Enterprise Access Hub in the current state, as live handles - one per door the hardware drives.
   *
   * @returns The access-point handles.
   */
  accessPoints(): readonly AccessHub[] {

    return selectAccessPoints(this.#ctx.store.snapshot()).map((point) => new AccessHub(this.#ctx, point.unique_id, accessPointSelector(point.unique_id)));
  }
}

// A device's selector, built per identity. It is a factory rather than a closure over the registry so that a handle's selector depends on nothing but the identity
// it reads, which is what lets the handle outlive the lookup that made it.
function deviceSelector(id: string): (state: AccessState) => AccessStateDevice | undefined {

  return (state) => state.devices.get(id);
}

// An access point's selector, reading the port out of the expansion rather than out of the devices map - the port is a synthesized record that the devices map does
// not hold. It reads through the memoized expansion, so the entry it returns is reference-stable across dispatches that did not touch its hub.
function accessPointSelector(id: string): (state: AccessState) => AccessStateDevice | undefined {

  return (state) => findAccessPoint(state, id);
}

// One port of the expansion, by its own identity.
function findAccessPoint(state: AccessState, id: string): AccessStateDevice | undefined {

  return selectAccessPoints(state).find((point) => point.unique_id === id);
}

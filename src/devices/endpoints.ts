/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * endpoints.ts: The single source of truth for the Access device and location REST endpoint URLs.
 */
import { ACCESS_API_PATH_PREFIX } from "../settings.ts";

/* The base every builder below composes from. It is a private function rather than a repeated literal so the controller address and the application path meet in
 * one place for this tier: a change to either is a single edit here, and no builder in this file can drift onto a different base. The prefix itself is not
 * re-spelled - it comes from the constant that owns it, which is what makes that constant a single home rather than a second copy of the same string.
 */
function apiBase(host: string): string {

  return "https://" + host + ACCESS_API_PATH_PREFIX;
}

/**
 * The REST endpoint for one device.
 *
 * @param host - The controller address (no scheme).
 * @param id   - The device's `unique_id`.
 *
 * @returns The fully-qualified endpoint URL.
 *
 * @category Devices
 */
export function deviceEndpoint(host: string, id: string): string {

  return apiBase(host) + "/device/" + id;
}

/**
 * The endpoint a device's configuration write targets. The controller keeps two collections for a device's settings and picks between them by what the device is:
 * hub-capable hardware writes to `configs`, everything else to `settings`. The caller decides which, because the choice is a read of the device's live capability
 * rather than anything this module can see.
 *
 * @param host - The controller address (no scheme).
 * @param id   - The device's `unique_id`.
 * @param kind - Which collection to address.
 *
 * @returns The fully-qualified endpoint URL.
 *
 * @category Devices
 */
export function deviceSettingsEndpoint(host: string, id: string, kind: "configs" | "settings"): string {

  return deviceEndpoint(host, id) + "/" + kind;
}

/**
 * The endpoint that restarts a device.
 *
 * @param host - The controller address (no scheme).
 * @param id   - The device's `unique_id`.
 *
 * @returns The fully-qualified endpoint URL.
 *
 * @category Devices
 */
export function deviceRestartEndpoint(host: string, id: string): string {

  return deviceEndpoint(host, id) + "/restart";
}

/**
 * The endpoint that sets a device's lock rule. The query parameter asks the controller to answer with the resulting rule rather than an empty acknowledgement, which
 * is how the rule write reports what it actually established.
 *
 * @param host - The controller address (no scheme).
 * @param id   - The device's `unique_id`.
 *
 * @returns The fully-qualified endpoint URL.
 *
 * @category Devices
 */
export function lockRuleEndpoint(host: string, id: string): string {

  return deviceEndpoint(host, id) + "/lock_rule?get_result=true";
}

/**
 * The endpoint that unlocks a door, or closes one that is held open.
 *
 * The resource is the door rather than the hardware driving it, which is what lets one multi-door hub address each of its doors independently - the device endpoint
 * could only name the hub. Passing `"close"` adds the control parameter that ends an unlock rather than beginning one.
 *
 * @param host       - The controller address (no scheme).
 * @param locationId - The door's `unique_id`.
 * @param command    - Pass `"close"` to close the door rather than unlock it.
 *
 * @returns The fully-qualified endpoint URL.
 *
 * @category Devices
 */
export function locationUnlockEndpoint(host: string, locationId: string, command?: "close"): string {

  const url = apiBase(host) + "/location/" + locationId + "/unlock";

  return (command === undefined) ? url : url + "?control_cmd=" + command;
}

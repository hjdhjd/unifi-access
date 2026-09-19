/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * devices.ts: The official API's device domain - the adopted device inventory, per-device access-method settings, and the doorbell trigger.
 */
import type { AccessOfficialCallOptions, OfficialDispatch, OfficialDomainOptions } from "./dispatch.ts";
import { officialEndpoint } from "./endpoints.ts";

/**
 * Whether an access method is switched on. The wire spells these `"yes"` and `"no"` rather than as booleans, in both directions - the write takes the same pair
 * the read returns - and this is the one vocabulary here carried closed: both values have been observed live, and the reference's own field table claiming
 * `"true"`/`"false"` is contradicted by its own sample on the same page and by the wire.
 *
 * @category Official
 */
export type AccessOfficialAccessMethodValue = "no" | "yes";

/**
 * An access method that is simply on or off.
 *
 * Live-verified.
 *
 * @category Official
 */
export interface AccessOfficialAccessMethodToggle {

  readonly enabled: AccessOfficialAccessMethodValue;
}

/**
 * The PIN keypad's settings. Shuffling the keypad layout applies only while the method itself is enabled.
 *
 * Live-verified.
 *
 * @category Official
 */
export interface AccessOfficialAccessMethodPinCode {

  readonly enabled: AccessOfficialAccessMethodValue;
  readonly pin_code_shuffle: AccessOfficialAccessMethodValue;
}

/**
 * Face unlock's settings. The two tuning members apply only while the method itself is enabled, and a reader reports only the ones it supports.
 *
 * Live-verified.
 *
 * @category Official
 */
export interface AccessOfficialAccessMethodFace {

  readonly anti_spoofing_level?: "high" | "medium" | "no" | (string & {});
  readonly detect_distance?: "far" | "medium" | "near" | (string & {});
  readonly enabled: AccessOfficialAccessMethodValue;
}

/**
 * The access methods a device offers, keyed by method.
 *
 * This map is SPARSE, and every member is optional for that reason: a device reports only the methods its hardware class has, and a class with nothing to report
 * answers with an empty map. Coverage ranges from that empty map up to the full set this type declares. So an absent key means the device cannot do that method,
 * NOT that the method is switched off; reading absence as disabled is the misreading this type exists to prevent, and the two are distinguished by whether the
 * key is there rather than by its value.
 *
 * Live-verified.
 *
 * @category Official
 */
export interface AccessOfficialAccessMethods {

  readonly bt_button?: AccessOfficialAccessMethodToggle;
  readonly bt_shake?: AccessOfficialAccessMethodToggle;
  readonly bt_tap?: AccessOfficialAccessMethodToggle;
  readonly face?: AccessOfficialAccessMethodFace;
  readonly mobile_wave?: AccessOfficialAccessMethodToggle;
  readonly nfc?: AccessOfficialAccessMethodToggle;
  readonly pin_code?: AccessOfficialAccessMethodPinCode;
  readonly qr_code?: AccessOfficialAccessMethodToggle;
  readonly touch_pass?: AccessOfficialAccessMethodToggle;
  readonly wave?: AccessOfficialAccessMethodToggle;
}

/**
 * A device's access-method settings, and the device they belong to.
 *
 * Live-verified.
 *
 * @category Official
 */
export interface AccessOfficialDeviceSettings {

  readonly access_methods: AccessOfficialAccessMethods;
  readonly device_id: string;
}

/**
 * An adopted device.
 *
 * `capabilities` is the controller's own feature-flag vocabulary for the hardware - strings such as `is_hub`, `pin_code`, and `two_factor_auth` - and is the
 * dependable way to ask what a device can do, rather than matching on `type`.
 *
 * Live-verified. Every member beyond `alias`, `id`, `name`, and `type` is on the wire and in no documented schema for this endpoint.
 *
 * @category Official
 */
export interface AccessOfficialDevice {

  readonly alias: string;
  readonly capabilities: readonly string[];
  readonly connected_uah_id: string;
  readonly id: string;
  readonly is_adopted: boolean;
  readonly is_connected: boolean;
  readonly is_managed: boolean;
  readonly is_online: boolean;
  readonly location_id: string;
  readonly name: string;
  readonly type: string;
}

/**
 * Set the PIN keypad's settings. Shuffling applies only while the method is enabled.
 *
 * @category Official
 */
export interface AccessOfficialAccessMethodPinCodeUpdate {

  enabled?: AccessOfficialAccessMethodValue;
  pin_code_shuffle?: AccessOfficialAccessMethodValue;
}

/**
 * Set face unlock's settings.
 *
 * The tuning members apply only while `enabled` is on, and the controller accepts only four combinations of the two: anti-spoofing `no` with detection distance
 * `far`, `no` with `medium`, `medium` with `near`, and `high` with `near`. That constraint is stated rather than typed: it comes from documentation this reference
 * has been wrong in before, and encoding it would risk making a combination the controller accepts impossible to send.
 *
 * @category Official
 */
export interface AccessOfficialAccessMethodFaceUpdate {

  anti_spoofing_level?: "high" | "medium" | "no";
  detect_distance?: "far" | "medium" | "near";
  enabled?: AccessOfficialAccessMethodValue;
}

/**
 * The access methods to change, keyed by method. Naming a method the device's hardware class does not offer has no effect.
 *
 * @category Official
 */
export interface AccessOfficialAccessMethodsUpdate {

  bt_button?: AccessOfficialAccessMethodToggle;
  bt_shake?: AccessOfficialAccessMethodToggle;
  bt_tap?: AccessOfficialAccessMethodToggle;
  face?: AccessOfficialAccessMethodFaceUpdate;
  mobile_wave?: AccessOfficialAccessMethodToggle;
  nfc?: AccessOfficialAccessMethodToggle;
  pin_code?: AccessOfficialAccessMethodPinCodeUpdate;
  qr_code?: AccessOfficialAccessMethodToggle;
  touch_pass?: AccessOfficialAccessMethodToggle;
  wave?: AccessOfficialAccessMethodToggle;
}

/**
 * Update a device's access-method settings.
 *
 * The body nests the methods under `access_methods`, in the same shape the read returns, rather than carrying the dotted top-level names the reference's field
 * table lists. The reference's own request sample sends the nested form, and the wire agrees with the sample rather than with the table.
 *
 * Live-verified.
 *
 * @category Official
 */
export interface AccessOfficialDeviceSettingsUpdate {

  access_methods: AccessOfficialAccessMethodsUpdate;
}

/**
 * List devices. `refresh` asks the controller for real-time device state rather than its cache, which is slower.
 *
 * @category Official
 */
export interface AccessOfficialDeviceListOptions {

  refresh?: boolean;
}

/**
 * Trigger a doorbell. `cancel` stops a call that is still ringing rather than starting one.
 *
 * @category Official
 */
export interface AccessOfficialDoorbellTriggerOptions {

  cancel?: boolean;
  room_name?: string;
}

/**
 * The official API's device domain: the adopted inventory, the per-device access-method settings, and the doorbell trigger.
 */
export class OfficialDevices {

  readonly #dispatch: OfficialDispatch;
  readonly #host: string;

  constructor(options: OfficialDomainOptions) {

    this.#dispatch = options.dispatch;
    this.#host = options.host;
  }

  /**
   * Fetch the adopted devices, grouped by the door they serve. `GET /devices`, permission `view:device`.
   *
   * The payload is an array of arrays, and it is returned as one: each inner array holds the devices attached to a single door. The reference's schema table
   * describes a flat array, but its own sample and the wire both nest, and flattening here would hide which devices share a door - a projection a caller can make
   * for itself, where the grouping cannot be recovered once it is thrown away.
   *
   * Live-verified.
   *
   * @param opts - Whether to bypass the controller's device cache.
   * @param call - The per-call options - an optional abort signal.
   *
   * @returns The devices, grouped per door.
   */
  async fetchAll(opts: AccessOfficialDeviceListOptions = {}, call: AccessOfficialCallOptions = {}): Promise<AccessOfficialDevice[][]> {

    return (await this.#dispatch.request<AccessOfficialDevice[][]>(officialEndpoint(this.#host, "/devices", { "refresh": opts.refresh }), {}, call)).data;
  }

  /**
   * Read a device's access-method settings. `GET /devices/:device_id/settings`, permission `view:device`. Requires UniFi Access 3.3.10 or later.
   *
   * The returned map is sparse - see {@link AccessOfficialAccessMethods} for why an absent method is not a disabled one.
   *
   * Live-verified.
   *
   * @param deviceId - The device's identifier.
   * @param call     - The per-call options - an optional abort signal.
   *
   * @returns The device's settings.
   */
  async fetchSettings(deviceId: string, call: AccessOfficialCallOptions = {}): Promise<AccessOfficialDeviceSettings> {

    return (await this.#dispatch.request<AccessOfficialDeviceSettings>(officialEndpoint(this.#host,
      "/devices/" + encodeURIComponent(deviceId) + "/settings"), {}, call)).data;
  }

  /**
   * Update a device's access-method settings. `PUT /devices/:device_id/settings`, permission `edit:device`. Requires UniFi Access 3.3.10 or later.
   *
   * The write takes the same nested shape and the same `"no"`/`"yes"` vocabulary the read returns. The reference's field table spells the values `"true"` and
   * `"false"` and names the methods as dotted top-level parameters, and it is contradicted on both counts by its own request sample and by the wire.
   *
   * A method whose prerequisites the controller lacks is declined silently: the request answers success and the setting is left as it was. So a caller that needs
   * certainty about what took effect reads the settings back rather than treating the success as confirmation.
   *
   * Live-verified.
   *
   * @param deviceId - The device's identifier.
   * @param opts     - The methods to change.
   * @param call     - The per-call options - an optional abort signal.
   */
  async updateSettings(deviceId: string, opts: AccessOfficialDeviceSettingsUpdate, call: AccessOfficialCallOptions = {}): Promise<void> {

    await this.#dispatch.command(officialEndpoint(this.#host, "/devices/" + encodeURIComponent(deviceId) + "/settings"), { json: opts, method: "PUT" }, call);
  }

  /**
   * Ring a doorbell, or cancel one that is ringing. `POST /devices/:device_id/doorbell`, permission `edit:device`. Requires UniFi Access 4.0.10 or later.
   *
   * Live-verified.
   *
   * @param deviceId - The reader's identifier.
   * @param opts     - The Intercom directory name to ring, or whether to cancel a call already in progress.
   * @param call     - The per-call options - an optional abort signal.
   */
  async triggerDoorbell(deviceId: string, opts: AccessOfficialDoorbellTriggerOptions = {}, call: AccessOfficialCallOptions = {}): Promise<void> {

    await this.#dispatch.command(officialEndpoint(this.#host, "/devices/" + encodeURIComponent(deviceId) + "/doorbell"), { json: opts, method: "POST" }, call);
  }
}

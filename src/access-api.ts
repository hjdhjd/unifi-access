/* Copyright(C) 2019-2025, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * access-api.ts: Our UniFi Access API implementation.
 */
import { ACCESS_API_ERROR_LIMIT, ACCESS_API_RETRY_INTERVAL, ACCESS_API_TIMEOUT } from "./settings.js";
import type { AccessApiResponse, AccessBootstrapConfig, AccessControllerConfig, AccessDeviceConfig, AccessDeviceConfigPayload, AccessDoorConfig,
  AccessFloorConfig, Nullable } from "./access-types.js";
import { Agent, type Dispatcher, type ErrorEvent, type MessageEvent, Pool, WebSocket, errors, interceptors, request } from "undici";
import type { AccessLogging } from "./access-logging.js";
import { EventEmitter } from "node:events";
import { STATUS_CODES } from "node:http";
import util from "node:util";

export type RequestOptions = { dispatcher?: Dispatcher } & Omit<Dispatcher.RequestOptions, "origin" | "path">;

/**
 * Options to tailor the behavior of {@link AccessApi.retrieve}.
 *
 * @property {boolean} [logErrors=true] - Log errors. Defaults to `true`.
 * @property {number} [timeout=3500] - Amount of time, in milliseconds, to wait for the Access controller to respond before timing out. Defaults to `3500`.
 */
export interface RetrieveOptions {

  logErrors?: boolean;
  timeout?: number;
}

// Our private interface to retrieve.
interface InternalRetrieveOptions extends RetrieveOptions {

  decodeResponse?: boolean;
}

/**
 * The direct UniFi Access API is partially documented through an officially supported public API that Ubiquiti has released. However, this API also has certain
 * constraints and limitations such as lacking the ability to change the settings on an Access device. The full native API has been reverse engineered mostly through
 * trail and error with the Access web interface as well as insight from the public API.
 *
 * Here's how the UniFi Access API works:
 *
 * 1. {@link login | Login} to the UniFi Access controller and acquire security credentials for further calls to the API.
 *
 * 2. Enumerate the list of UniFi Access devices by calling the {@link bootstrap} property. This contains everything you would want to know about the devices attached to
 *    this particular UniFi Access controller. Information about the Access controller can be accessed through the {@link controller} property.
 *
 * 3. Listen for `message` events emitted by {@link AccessApi} containing all Access controller events, in realtime. They are delivered as
 *    {@link access-types.AccessEventPacket} packets, containing the event-specific details.
 *
 * Those are the basics that gets us up and running.
 */
export class AccessApi extends EventEmitter {

  private _bootstrap: Nullable<AccessBootstrapConfig>;
  private _controller: Nullable<AccessControllerConfig>;
  private _devices: Nullable<AccessDeviceConfig[]>;
  private _doors: Nullable<AccessDoorConfig[]>;
  private _floors: Nullable<AccessFloorConfig[]>;
  private _isAdminUser: boolean;
  private _isThrottled: boolean;
  private address: string;
  private apiErrorCount: number;
  private apiLastSuccess: number;
  private dispatcher?: Dispatcher;
  private events: Nullable<WebSocket>;
  private eventsTimer: Nullable<NodeJS.Timeout>;
  private headers: Record<string, string | undefined>;
  private log: AccessLogging;
  private password: string;
  private username: string;

  /**
   * Create an instance of the UniFi Access API.
   *
   * @param log - Logging functions to use.
   *
   * @defaultValue `none` - Logging will be done to stdout and stderr.
   */
  // Initialize this instance with our login information.
  constructor(log?: AccessLogging) {

    // Initialize our parent.
    super();

    // If we didn't get passed a logging parameter, by default we log to the console.
    log ??= {

      /* eslint-disable no-console */
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      debug: (_message: string, ..._parameters: unknown[]): void => { /* No debug logging by default. */ },
      error: (message: string, ...parameters: unknown[]): void => console.error(message, ...parameters),
      info: (message: string, ...parameters: unknown[]): void => console.log(message, ...parameters),
      warn: (message: string, ...parameters: unknown[]): void => console.log(message, ...parameters)
      /* eslint-enable no-console */
    };

    this._bootstrap = null;
    this._controller = null;
    this._devices = null;
    this._doors = null;
    this._floors = null;
    this._isAdminUser = false;
    this._isThrottled = false;
    this.events = null;
    this.eventsTimer = null;

    this.log = {

      debug: (message: string, ...parameters: unknown[]): void => log.debug(this.name + ": " + message, ...parameters),
      error: (message: string, ...parameters: unknown[]): void => log.error(this.name + ": API error: " + message, ...parameters),
      info: (message: string, ...parameters: unknown[]): void => log.info(this.name + ": " + message, ...parameters),
      warn: (message: string, ...parameters: unknown[]): void => log.warn(this.name + ": " + message, ...parameters)
    };

    this.apiErrorCount = 0;
    this.apiLastSuccess = 0;
    this.headers = {};
    this.address = "";
    this.username = "";
    this.password = "";
  }

  /**
   * Execute a login attempt to the UniFi Access API.
   *
   * @param address - Address of the UniFi Access controller, expressed as an FQDN or IP address.
   * @param username   - Username to use when logging into the controller.
   * @param password   - Password to use when logging into the controller.
   *
   * @returns Returns a promise that will resolve to `true` if successful and `false` otherwise.
   *
   * @remarks A `login` event will be emitted each time this method is called, with the result of the attempt as an argument.
   *
   * @example
   * Login to the Access controller. You can selectively choose to either `await` the promise that is returned by `login`, or subscribe to the `login` event.
   *
   * ```ts
   * import { AccessApi } from "unifi-access";
   *
   * // Create a new Access API instance.
   * const ufp = new AccessApi();
   *
   * // Set a listener to wait for the login event to occur.
   * ufp.once("login", (successfulLogin: boolean) => {
   *
   *   // Indicate if we are successful.
   *   if(successfulLogin) {
   *
   *     console.log("Logged in successfully.");
   *     process.exit(0);
   *   }
   * });
   *
   * // Login to the Access controller.
   * if(!(await ufa.login("access-controller.local", "username", "password"))) {
   *
   *   console.log("Invalid login credentials.");
   *   process.exit(0);
   * };
   * ```
   */
  // Login to the Access controller and terminate any existing login we might have.
  public async login(address: string, username: string, password: string): Promise<boolean> {

    this.address = address;
    this.username = username;
    this.password = password;

    this.logout();

    // Let's attempt to login.
    const loginSuccess = await this.loginController();

    // Publish the result to our listeners
    this.emit("login", loginSuccess);

    // Return the status of our login attempt.
    return loginSuccess;
  }

  // Login to the UniFi Access API.
  private async loginController(): Promise<boolean> {

    // If we're already logged in, we're done.
    if(this.headers.cookie && this.headers["x-csrf-token"]) {

      return true;
    }

    // Utility to grab the headers we're interested in a normalized manner.
    const getHeader = (name: string, headers?: Record<string, string | string[] | undefined>): Nullable<string> => {

      const rawHeader = headers?.[name.toLowerCase()];

      if(!rawHeader) {

        return null;
      }

      // Normalize it to a string:
      return Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
    };

    // Acquire a CSRF token, if needed. We only need to do this if we aren't already logged in, or we don't already have a token.
    if(!this.headers["x-csrf-token"]) {

      // UniFi OS has cross-site request forgery protection built into it's web management UI. We retrieve the CSRF token, if available, by connecting to the Access
      // controller and checking the headers for it.
      const response = await this.retrieve("https://" + this.address, { method: "GET" }, { logErrors: false });

      if(this.responseOk(response?.statusCode)) {

        const csrfToken = getHeader("X-CSRF-Token", response?.headers);

        // Preserve the CSRF token, if found, for future API calls.
        if(csrfToken) {

          this.headers["x-csrf-token"] = csrfToken;
        }
      }
    }

    // Log us in.
    const response = await this.retrieve(this.getApiEndpoint("login"), {

      body: JSON.stringify({ password: this.password, rememberMe: true, token: "", username: this.username }),
      method: "POST"
    });

    // Something went wrong with the login call, possibly a controller reboot or failure.
    if(!this.responseOk(response?.statusCode)) {

      this.logout();

      return false;
    }

    // We're logged in. Let's configure our headers.
    const csrfToken = getHeader("X-Updated-CSRF-Token", response?.headers) ?? getHeader("X-CSRF-Token", response?.headers);
    const cookie = getHeader("Set-Cookie", response?.headers);

    // Save the refreshed cookie and CSRF token for future API calls and we're done.
    if(csrfToken && cookie) {

      // Only preserve the token element of the cookie and not the superfluous information that's been added to it.
      this.headers.cookie = cookie.split(";")[0];

      // Save the CSRF token.
      this.headers["x-csrf-token"] = csrfToken;

      return true;
    }

    // Clear out our login credentials.
    this.logout();

    return false;
  }

  // Attempt to retrieve the bootstrap configuration from the Access controller.
  private async bootstrapController(retry: boolean): Promise<boolean> {

    // Log us in if needed.
    if(!(await this.loginController())) {

      return retry ? this.bootstrapController(false) : false;
    }

    // Utility to retrieve and parise API responses, with error handling.
    const retrieveEndpoint = async (endpoint: string): Promise<Nullable<AccessApiResponse>> => {

      // Retrieve the endpoint from the controller.
      const response = await this.retrieve(this.getApiEndpoint(endpoint));

      // Something went wrong. Retry the bootstrap attempt once, and then we're done.
      if(!this.responseOk(response?.statusCode)) {

        this.logRetry("Unable to retrieve the UniFi Access " + endpoint + " configuration.", retry);

        return null;
      }

      let data: Nullable<AccessApiResponse> = null;

      try {

        data = await response?.body.json() as AccessApiResponse;

      // @eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch(error) {

        data = null;
        this.log.error("Unable to parse response from UniFi Access. Will retry again later.");
      }

      return data;
    };

    // Retrieve the controller configuration.
    this._controller = ((await retrieveEndpoint("controller"))?.data as AccessControllerConfig | undefined) ?? null;

    if(!this._controller && retry) {

      return this.bootstrapController(false);
    }

    // Next, retrieve the bootstrap configuration.
    const data = ((await retrieveEndpoint("bootstrap"))?.data as AccessBootstrapConfig[] | undefined);

    this._bootstrap = data ? data[0] : null;

    if(!this._bootstrap && retry) {

      return this.bootstrapController(false);
    }

    // Retrieve the list of doors from all the floors the user has configured.
    this._doors = this._bootstrap?.floors?.flatMap(floor => floor.doors).filter(Boolean) ?? null;

    // In case we end up with an empty floors array due to changes in the Access API, we can conceivably end up with an empty array here.
    this._doors = this._doors?.length ? this._doors : null;

    // Retrieve the list of devices from all the doors the user has configured.
    this._devices = this._doors?.map(x => x.device_groups ?? []).flat(2).filter(Boolean) ?? null;

    // In case we end up with an empty floors array due to changes in the Access API, we can conceivably end up with an empty array here.
    this._devices = this._devices?.length ? this._devices : null;

    // UA 4.x fallback: some controllers expose device_groups at the top level without floors/doors.
    if(!this._devices && Array.isArray(this._bootstrap?.device_groups)) {

      this._devices = this._bootstrap.device_groups.flat().filter(Boolean);
      this._devices = this._devices.length ? this._devices : null;
    }

    // Account for Enterprise Access Hubs. What we do here is append to the devices array a transformed version of each extension (which in the case of an EAH amounts to
    // the equivalent of a hub / lock) attached to it. We transform the configuration to make it appear like it's a typical UAH for our purposes, and we map the name and
    // unlock location accordingly.
    /* eslint-disable camelcase */
    const eahDevices = this._bootstrap?.device_groups?.flat().filter(device => device.device_type === "UAH-Ent").
      flatMap(({ extensions = [], alias, display_model, location_id, ...device }) => extensions.
        map(({ target_name, target_value, ...extension }) => ({...device, ...extension, alias: target_name ?? "Unknown",
          display_model: display_model + ((extension.source_id !== undefined) ? " " + extension.source_id.replace(/(^\w|\s+\w)/g, match => match.toUpperCase()) : ""),
          location_id: target_value ?? location_id, name: alias })));
    /* eslint-enable camelcase */

    // Add EAH devices, if we have them.
    if(eahDevices?.length) {

      this._devices ??= [];
      this._devices.push(...eahDevices);
    }

    // Set the list of floors as a convenience.
    this._floors = this._bootstrap?.floors ?? null;

    // If we're bootstrapped, connect to the event listener API. Otherwise, we're done.
    if(!this._bootstrap || !(await this.launchEventsWs())) {

      return retry ? this.bootstrapController(false) : false;
    }

    // Notify our users.
    this.emit("bootstrap", this._bootstrap);

    // We're bootstrapped and connected to the events API.
    return true;
  }

  // Connect to the realtime events API.
  private async launchEventsWs(): Promise<boolean> {

    // Log us in if needed.
    if(!(await this.loginController())) {

      return false;
    }

    // If we already have a listener, we're already all set.
    if(this.events) {

      return true;
    }

    try {

      const ws = new WebSocket("wss://" + this.address + "/proxy/access/api/v2/ws/notification",
        { dispatcher: new Agent({ connect: { rejectUnauthorized: false } }), headers: { Cookie: this.headers.cookie ?? "" } });

      let messageHandler: Nullable<(event: MessageEvent) => void>;

      // Cleanup after ourselves if our websocket closes for some resaon.
      ws.addEventListener("close", (): void => {

        if(this.eventsTimer) {

          clearTimeout(this.eventsTimer);
          this.eventsTimer = null;
        }

        this.events = null;

        if(messageHandler) {

          ws.removeEventListener("message", messageHandler);
          messageHandler = null;
        }
      }, { once: true });

      // Handle any websocket errors.
      ws.addEventListener("error", (event: ErrorEvent): void => {

        // Check if this is a TypeError from undici's internal WebSocket handling. They're expected in certain disconnection scenarios.
        if(!(event.error instanceof TypeError)) {

          this.log.error("Events API error: %s", event.error.cause);
          this.log.error(util.inspect(event.error, { colors: true, depth: null, sorted: true }));
        }

        ws.close();
      }, { once: true });

      // Process messages as they come in.
      ws.addEventListener("message", messageHandler = (event?: MessageEvent): void => {

        if(!event) {

          this.log.error("Unable to process message from the realtime events API.");
          ws.close();

          return;
        }

        // No event data - we're done.
        if(!event.data) {

          return;
        }

        // The Access events API seems to send a heartbeat every five seconds.
        if(event.data === "\"Hello\"\n") {

          // Heartbeat.
          if(this.eventsTimer) {

            clearTimeout(this.eventsTimer);
          }

          this.eventsTimer = setTimeout(() => {

            this.log.error("Failed to detect heartbeat from the events API. Resetting the connection.");
            this.reset();
          }, 1000 * 10);

          return;
        }

        // Access events are published as JSON objects.
        try {

          // Emit the decoded packet for users.
          this.emit("message", JSON.parse(event.data));
        } catch(error) {

          this.log.error("Error processing message from the events API: %s", error);

          return;
        }
      });

      // Make the websocket available, and then we're done.
      this.events = ws;

      // Establish our heartbeat.
      this.eventsTimer = setTimeout(() => {

        this.log.error("Failed to detect heartbeat from the events API. Resetting the connection.");
        this.reset();
      }, 1000 * 10);
    } catch(error) {

      this.log.error("Error connecting to the realtime update events API: %s", error);
    }

    return true;
  }

  /**
   * Retrieve the bootstrap JSON from a UniFi Access controller.
   *
   * @returns Returns a promise that will resolve to `true` if successful and `false` otherwise.
   *
   * @remarks A `bootstrap` event will be emitted each time this method is successfully called, with the AccessToplogyConfig JSON as an argument. As a
   * convenience, the {@link devices}, {@link doors}, and {@link floors} properties will be populated as well.
   *
   * @example
   * Retrieve the bootstrap JSON. You can selectively choose to either `await` the promise that is returned by `getBootstrap`, or subscribe to the `bootstrap` event.
   *
   * ```ts
   * import { AccessApi, AccessDeviceConfig } from "unifi-access";
   * import util from "node:util";
   *
   * // Create a new Access API instance.
   * const ufa = new AccessApi();
   *
   * // Set a listener to wait for the bootstrap event to occur.
   * ufa.once("bootstrap", (bootstrapJSON: AccessDeviceConfig) => {
   *
   *   // Once we've bootstrapped the Access controller, output the bootstrap JSON and we're done.
   *   process.stdout.write(util.inspect(bootstrapJSON, { colors: true, depth: null, sorted: true }) + "\n", () => process.exit(0));
   * });
   *
   * // Login to the Access controller.
   * if(!(await ufa.login("access-controller.local", "username", "password"))) {
   *
   *   console.log("Invalid login credentials.");
   *   process.exit(0);
   * };
   *
   * // Bootstrap the controller. It will emit a message once it's received the bootstrap JSON, or you can alternatively wait for the promise to resolve.
   * if(!(await ufa.getBootstrap())) {
   *
   *   console.log("Unable to bootstrap the Access controller.");
   *   process.exit(0);
   * }
   * ```
   *
   * Alternatively, you can access the bootstrap JSON directly through the {@link bootstrap} accessor:
   *
   * ```ts
   * import { AccessApi } from "unifi-access";
   * import util from "node:util";
   *
   * // Create a new Access API instance.
   * const ufa = new AccessApi();
   *
   * // Login to the Access controller.
   * if(!(await ufa.login("access-controller.local", "username", "password"))) {
   *
   *   console.log("Invalid login credentials.");
   *   process.exit(0);
   * };
   *
   * // Bootstrap the controller.
   * if(!(await ufa.getBootstrap())) {
   *
   *   console.log("Unable to bootstrap the Access controller.");
   *   process.exit(0);
   * }
   *
   * // Once we've bootstrapped the Access controller, access the bootstrap JSON through the bootstrap accessor and we're done.
   * process.stdout.write(util.inspect(ufa.bootstrap, { colors: true, depth: null, sorted: true }) + "\n", () => process.exit(0));
   * ```
   *
   */
  // Get our UniFi Access configuration.
  public async getBootstrap(): Promise<boolean> {

    // Bootstrap the controller, and attempt to retry the bootstrap if it fails.
    return this.bootstrapController(true);
  }

  /**
   * Send an unlock command to the Access controller.
   *
   * @param device    - Access device.
   * @param duration  - Unlock interval in minutes.
   *
   * @returns Returns `true` if successful, `false` otherwise.
   *
   * @remarks If `duration` is not specified, a standard unlock request will be sent to the Access controller which will unlock for 2 seconds. Valid values for duration
   * are `Infinity` - remain unlocked until reset, `0` - reset lock to secure state, `duration` - number of minutes.
   */
  // Send an unlock command to a hub.
  public async unlock(device: AccessDeviceConfig, duration?: number): Promise<boolean> {

    // No device object, we're done.
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if(!device) {

      return false;
    }

    // Unlocking only works on hubs.
    if(!device.capabilities.includes("is_hub")) {

      return false;
    }

    // Default to the standard unlock endpoint.
    let action = "unlock";
    let endpoint = this.getApiEndpoint("location") + "/" + device.location_id + "/unlock";
    let payload = {};

    // If we've specified a duration, let's specify that.
    if(duration !== undefined) {

      // eslint-disable-next-line camelcase
      const params = new URLSearchParams({ get_result: "true" });

      endpoint = this.getApiEndpoint("device") + "/" + device.unique_id + "/lock_rule?" + params.toString();

      // Safety check for out of bounds values.
      if(duration < 0) {

        duration = 0;
      }

      switch(duration) {

        case 0:

          action = "lock";
          payload = { type: "reset" };

          break;

        case Infinity:

          payload = { type: "keep_unlock" };

          break;

        default:

          payload = { interval: Math.trunc(duration), type: "custom" };
      }
    } else {

      // For undefined duration, use the generic location unlock endpoint (for gates). We prefer the door/gate location from extensions over the device's building
      // location.
      const locationId = device.extensions?.find(ext => ext.extension_name === "port_setting")?.target_value ?? device.location_id;

      endpoint = this.getApiEndpoint("location") + "/" + locationId + "/unlock";
    }

    // Request the unlock from Access.
    const response = await this.retrieve(endpoint, {

      body: JSON.stringify(payload),
      method: "PUT"
    });

    if(!this.responseOk(response?.statusCode)) {

      this.log.error("%s: Unable to %s the %s: %s.", this.getFullName(device), action, device.display_model, response?.statusCode);

      return false;
    }

    // Get our status.
    const status = await response?.body.json() as AccessApiResponse;

    if(status.codeS === "SUCCESS") {

      return true;
    }

    // We failed - let's log what we know.
    this.log.error("%s: Error %sing the %s: \n%s", this.getFullName(device), action, device.display_model,
      util.inspect(status, { colors: false, depth: null, sorted: true }));

    return false;
  }

  /**
   * Update an Access device's configuration on the UniFi Access controller.
   *
   * @typeParam DeviceType - Generic for any known Access device type.
   *
   * @param device  - Access device.
   * @param payload - Device configuration payload to upload, usually a subset of the device-specific configuration JSON.
   *
   * @returns Returns a promise that will resolve to the updated device-specific configuration JSON if successful, and `null` otherwise.
   *
   * @remarks Use this method to change the configuration of a given Access device or controller. It requires the credentials used to login to the Access API
   *   to have administrative privileges for most settings.
   */
  // Update an Access device object.
  public async updateDevice<DeviceType extends AccessDeviceConfig>(device: DeviceType, payload: AccessDeviceConfigPayload): Promise<Nullable<DeviceType>> {

    // No device object, we're done.
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if(!device) {

      return null;
    }

    // Log us in if needed.
    if(!(await this.loginController())) {

      return null;
    }

    // Only admin users can update JSON objects.
    if(!this.isAdminUser) {

      return null;
    }

    this.log.debug("%s: %s", this.getFullName(device), util.inspect(payload, { colors: true, depth: null, sorted: true }));

    // Update Access with the new configuration.
    const response = await this.retrieve(this.getApiEndpoint("device") + "/" + device.unique_id + (device.capabilities.includes("is_hub") ? "configs" : "settings"), {

      body: JSON.stringify(payload),
      method: "PUT"
    });

    // Something happened - the retrieve call will log the error for us.
    if(!response) {

      return null;
    }

    if(!this.responseOk(response.statusCode)) {

      this.log.error("%s: Unable to configure the %s: %s.", this.getFullName(device), device.device_type, response.statusCode);

      return null;
    }

    // We successfully set the message, return the updated device object.
    return await response.body.json() as DeviceType;
  }

  /**
   * Utility method that generates a nicely formatted device information string.
   *
   * @param device     - Access device.
   * @param name       - Optional name for the device. Defaults to the device type (e.g. `UA G2 Pro Black`).
   * @param deviceInfo - Optionally specify whether or not to include the IP address and MAC address in the returned string. Defaults to `false`.
   *
   * @returns Returns the Access device name in the following format: <code>*Access device name* [*Access device type*] (address: *IP address* mac: *MAC address*)</code>.
   *
   * @remarks The example above assumed the `deviceInfo` parameter is set to `true`.
   */
  // Utility to generate a nicely formatted device string.
  public getDeviceName(device: AccessDeviceConfig, name = device.alias?.length ? device.alias : device.name, deviceInfo = false): string {

    // Include the host address information, if we have it.
    const host = (("ip" in device) && device.ip) ? "address: " + device.ip + " " : "";
    const type = (("display_model" in device) && device.display_model) ? device.display_model : device.device_type;

    // A completely enumerated device will appear as:
    // Device Name [Device Type] (address: IP address, mac: MAC address).
    return (name ?? type) + " [" + type + "]" + (deviceInfo ? " (" + host + "mac: " + device.mac.replace(/:/g, "").toUpperCase() + ")" : "");
  }

  /**
   * Utility method that generates a combined, nicely formatted device and controller string.
   *
   * @param device - Access device.
   *
   * @returns Returns the Access device name in the following format:
   *   <code>*Access controller name* [*Access controller type*] *Access device name* [*Access device type*]</code>.
   */
  // Utility to generate a nicely formatted controller and device string.
  public getFullName(device: AccessDeviceConfig): string {

    const deviceName = this.getDeviceName(device);

    // Returns: Controller [Controller Type] Device Name [Device Type]
    return this.name + (deviceName.length ? " " + deviceName : "");
  }

  /**
   * Terminate any open connection to the UniFi Access API.
   */
  // Utility to disconnect from the Access controller and reset the connection.
  public reset(): void {

    this._bootstrap = null;
    this._floors = null;
    this._doors = null;
    this._devices = null;

    if(this.eventsTimer) {

      clearTimeout(this.eventsTimer);
    }

    this.eventsTimer = null;
    this.events?.close();
    this.events = null;

    if(this.address) {

      // Cleanup any prior pool.
      void this.dispatcher?.destroy();

      // Create an interceptor that allows us to set the user agent to our liking.
      const ua: Dispatcher.DispatcherComposeInterceptor = (dispatch) => (opts: Dispatcher.DispatchOptions, handler: Dispatcher.DispatchHandler) => {

        opts.headers ??= {};
        (opts.headers as Record<string, string>)["user-agent"] = "unifi-access";

        return dispatch(opts, handler);
      };

      // Create a dispatcher using a new pool. We want to explicitly allow self-signed SSL certificates, enabled HTTP2 connections, and allow up to five connections at a
      // time and provide some robust retry handling - we retry each request up to three times, with backoff.
      this.dispatcher = new Pool("https://" + this.address, { allowH2: true, clientTtl: 60 * 1000, connect: { rejectUnauthorized: false }, connections: 5 })
        .compose(ua, interceptors.retry({ maxRetries: 5, maxTimeout: 1500, methods: [ "DELETE", "GET", "HEAD", "OPTIONS", "POST", "PUT" ], minTimeout: 100,
          statusCodes: [ 400, 404, 429, 500, 502, 503, 504 ], timeoutFactor: 2 }));
    }
  }

  /**
   * Clear the login credentials and terminate any open connection to the UniFi Access API.
   */
  // Utility to clear out old login credentials or attempts.
  public logout(): void {

    // Close any connection to the Access API.
    this.reset();

    // Reset our parameters.
    this._isAdminUser = false;

    // Save our CSRF token, if we have one.
    const csrfToken = this.headers["x-csrf-token"];

    // Initialize the headers we need.
    this.headers = {};
    this.headers["content-type"] = "application/json";

    // Restore the CSRF token if we have one.
    if(csrfToken) {

      this.headers["x-csrf-token"] = csrfToken;
    }
  }

  /**
   * Execute an HTTP fetch request to the Access controller.
   *
   * @param url       - Full URL to request (e.g., `https://192.168.1.1/proxy/access/api/v2/devices/topologyv4`)
   * @param options   - Parameters to pass on for the endpoint request.
   * @param retrieveOptions - Additional options for error handling and timeouts
   *
   * @returns Promise resolving to the Response object, or `null` on failure.
   *
   * @remarks
   * This method provides direct access to the Protect controller API for advanced use cases not covered by the built-in methods. It handles:
   *
   * - Authentication and session management
   * - Automatic retry with exponential backoff
   * - Error logging and throttling
   * - CSRF token management
   *
   * The `options` parameter extends [Undici's RequestOptions](https://undici.nodejs.org/#/docs/api/Dispatcher.md?id=parameter-requestoptions), providing full control
   * over the HTTP request.
   */
  // Communicate HTTP requests with a Access controller.
  public async retrieve(url: string, options: RequestOptions = { method: "GET" }, retrieveOptions: RetrieveOptions = {}):
  Promise<Nullable<Dispatcher.ResponseData<unknown>>> {

    return this._retrieve(url, options, retrieveOptions);
  }

  // Internal interface to communicating HTTP requests with an Access controller, with error handling.
  private async _retrieve(url: string, options: RequestOptions = { method: "GET" }, retrieveOptions: InternalRetrieveOptions = {}):
  Promise<Nullable<Dispatcher.ResponseData<unknown>>> {

    // Set our defaults unless the user has overriden them.
    retrieveOptions.decodeResponse ??= true;
    retrieveOptions.logErrors ??= true;
    retrieveOptions.timeout ??= ACCESS_API_TIMEOUT;

    // Log errors if that's what the caller requested.
    const logError = (message: string, ...parameters: unknown[]): void => {

      if(!retrieveOptions.logErrors) {

        return;
      }

      this.log.error(message, ...parameters);
    };

    // Catch Access controller server-side issues:
    //
    // 400: Bad request.
    // 404: Not found.
    // 429: Too many requests.
    // 500: Internal server error.
    // 502: Bad gateway.
    // 503: Service temporarily unavailable.
    const serverErrors = new Set([ 400, 404, 429, 500, 502, 503 ]);

    let response: Dispatcher.ResponseData<unknown>;

    // Create a signal handler to deliver the abort operation.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), retrieveOptions.timeout);

    options.dispatcher = this.dispatcher;
    options.headers = this.headers;
    options.signal = controller.signal;

    try {

      const now = Date.now();

      // Throttle this after ACCESS_API_ERROR_LIMIT attempts.
      if(this.apiErrorCount >= ACCESS_API_ERROR_LIMIT) {

        // Let the user know we've got an API problem.
        if(!this._isThrottled) {

          this.apiLastSuccess = now;
          this._isThrottled = true;

          this.log.error("Throttling API calls due to errors with the %s previous attempts. Pausing communication with the Access controller for %s minutes.",
            this.apiErrorCount++, ACCESS_API_RETRY_INTERVAL / 60);

          this.reset();

          return null;
        }

        // Check to see if we are still throttling our API calls.
        if((this.apiLastSuccess + (ACCESS_API_RETRY_INTERVAL * 1000)) > now) {

          return null;
        }

        // Inform the user that we're out of the penalty box and try again.
        this.log.error("Resuming connectivity to the UniFi Access API after pausing for %s minutes.", ACCESS_API_RETRY_INTERVAL / 60);

        this.apiErrorCount = 0;
        this._isThrottled = false;

        if(!(await this.loginController())) {

          return null;
        }
      }

      response = await request(url, options);

      // The caller will sort through responses instead of us.
      if(!retrieveOptions.decodeResponse) {

        return response;
      }

      // Preemptively increase the error count.
      this.apiErrorCount++;

      // Bad username and password.
      if(response.statusCode === 401) {

        this.logout();
        logError("Invalid login credentials given. Please check your login and password.");

        return null;
      }

      // Insufficient privileges.
      if(response.statusCode === 403) {

        logError("Insufficient privileges for this user. Please check the roles assigned to this user and ensure it has sufficient privileges.");

        return null;
      }

      if(!this.responseOk(response.statusCode)) {

        if(serverErrors.has(response.statusCode)) {

          logError("Unable to connect to the Access controller. This is usually temporary and will occur during device reboots.");

          return null;
        }

        // Some other unknown error occurred.
        logError("%s - %s", response.statusCode, STATUS_CODES[response.statusCode]);

        return null;
      }

      this.apiLastSuccess = Date.now();
      this.apiErrorCount = 0;
      this._isThrottled = false;

      return response;
    } catch(error) {

      // Increment our API error count.
      this.apiErrorCount++;

      // We aborted the connection.
      if((error instanceof DOMException) && (error.name === "AbortError")) {

        logError("Access controller is taking too long to respond to a request. This error can usually be safely ignored.");
        this.log.debug("Original request was: %s", url);

        return null;
      }

      // We destroyed the pool due to a reset event and our inflight connections are failing.
      if(error instanceof errors.ClientDestroyedError) {

        return null;
      }

      // We destroyed the pool due to a reset event and our inflight connections are failing.
      if(error instanceof errors.RequestRetryError) {

        logError("Unable to connect to the Access controller. This is usually temporary and will occur during device reboots.");

        return null;
      }

      // Connection timed out.
      if(error instanceof errors.ConnectTimeoutError) {

        logError("Connection timed out.");

        return null;
      }

      let cause;

      if(error instanceof TypeError) {

        cause = error.cause as NodeJS.ErrnoException;
      }

      if((error instanceof Error) && ("code" in error) && (typeof (error as NodeJS.ErrnoException).code === "string")) {

        cause = error;
      }

      if(cause) {

        switch(cause.code) {

          case "ECONNREFUSED":
          case "EHOSTDOWN":

            logError("Connection refused.");

            break;

          case "ECONNRESET":

            logError("Network connection to Access controller has been reset.");

            break;

          case "ENOTFOUND":

            if(this.address) {

              logError("Hostname or IP address not found: %s. Please ensure the address you configured for this UniFi Access controller is correct.", this.address);
            } else {

              logError("No hostname or IP address provided.");
            }

            break;

          default:

            // If we're logging when we have an error, do so.
            logError("Error: %s | %s.", cause.code, cause.message);

            break;
        }

        return null;
      }

      logError("Unknown error: %s", util.inspect(error, { colors: true, depth: null, sorted: true}));

      return null;
    } finally {

      // Clear out our response timeout.
      clearTimeout(timer);
    }
  }

  // Utility function for logging connection retries.
  private logRetry(logMessage: string, isRetry: boolean): void {

    // If we're over the API limit, no need to continue indicating errors since we already inform users we're throttling API calls.
    if(this.apiErrorCount >= ACCESS_API_ERROR_LIMIT) {

      return;
    }

    // If we're retrying, only log when debugging.
    if(isRetry) {

      this.log.debug("%s Retrying.", logMessage);
    } else {

      this.log.error(logMessage);
    }
  }

  // Utility to check return status from a call to request.
  public responseOk(code?: number): boolean {

    if(code === undefined) {

      return false;
    }

    return (code >= 200) && (code < 300);
  }

  /**
   * Return an API endpoint for the requested endpoint type.
   *
   * @param endpoint - Requested endpoint type.
   *
   * @returns Returns a URL to the requested endpoint if successful, and an empty string otherwise.
   *
   * @remarks Valid API endpoints are `bootstrap`, `device`, `login`, `self`, and `websocket`.
   */
  // Return the appropriate URL to access various Access API endpoints.
  public getApiEndpoint(endpoint: string): string {

    let endpointSuffix;
    let endpointPrefix = "/proxy/access/api/v2/";

    switch(endpoint) {

      case "bootstrap":

        endpointSuffix = "devices/topology4";

        break;

      case "controller":

        endpointSuffix = "access/info";

        break;

      case "device":

        endpointSuffix = "device";

        break;

      case "location":

        endpointSuffix = "location";

        break;

      case "login":
        endpointPrefix = "/api/";
        endpointSuffix = "auth/login";

        break;

      case "self":

        endpointPrefix = "/api/";
        endpointSuffix = "users/self";

        break;

      case "settings":

        endpointSuffix = "settings";

        break;

      case "websocket":

        endpointSuffix = "ws";

        break;

      default:

        break;
    }

    if(!endpointSuffix) {

      return "";
    }

    return "https://" + this.address + endpointPrefix + endpointSuffix;
  }

  /**
   * Access the Access controller information JSON.
   *
   * @returns Returns the controller information JSON if the Access controller has been bootstrapped, `null` otherwise.
   */
  // Get the controller JSON.
  public get controller(): Nullable<AccessControllerConfig> {

    return this._controller;
  }

  /**
   * Access the Access controller bootstrap JSON.
   *
   * @returns Returns the bootstrap JSON if the Access controller has been bootstrapped, `null` otherwise.
   */
  // Get the bootstrap JSON.
  public get bootstrap(): Nullable<AccessBootstrapConfig> {

    return this._bootstrap;
  }

  /**
   * Access the Access controller list of devices.
   *
   * @returns Returns an array of all the devices from all the UniFi Access hubs associated with this controller, `null` otherwise.
   */
  // Get the list of devices.
  public get devices(): Nullable<AccessDeviceConfig[]> {

    return this._devices;
  }

  /**
   * Access the Access controller list of doors.
   *
   * @returns Returns an array of all the doors from all the UniFi Access hubs associated with this controller, `null` otherwise.
   */
  // Get the list of doors.
  public get doors(): Nullable<AccessDoorConfig[]> {

    return this._doors;
  }

  /**
   * Access the Access controller list of floors.
   *
   * @returns Returns an array of all the floors from all the UniFi Access hubs associated with this controller, `null` otherwise.
   */
  // Get the list of floors.
  public get floors(): Nullable<AccessFloorConfig[]> {

    return this._floors;
  }

  /**
   * Utility method that returns whether the credentials that were used to login to the Access controller have administrative privileges or not.
   *
   * @returns Returns `true` if the logged in user has administrative privileges, `false` otherwise.
   */
  // Return whether the logged in credentials are an admin user or not.
  public get isAdminUser(): boolean {

    return this._isAdminUser;
  }

  /**
   * Utility method that returns whether our connection to the Access controller is currently throttled or not.
   *
   * @returns Returns `true` if the API has returned too many errors and is now throttled for a period of time, `false` otherwise.
   *
   * @category Utilities
   */
  public get isThrottled(): boolean {

    return this._isThrottled;
  }

  /**
   * Utility method that returns a nicely formatted version of the Access controller name.
   *
   * @returns Returns the Access controller name in the following format:
   *   <code>*Access controller name* [*Access controller type*]</code>.
   */
  // Utility to generate a nicely formatted controller string.
  public get name(): string {

    // Our controller string, if it exists, appears as `Controller [Controller Type]`. Otherwise, we appear as `address`.
    // Our controller string, if it exists, appears as `Controller`. Otherwise, we appear as `address`.
    if(this._bootstrap?.alias?.length || this._bootstrap?.name?.length) {

      return this._bootstrap.alias?.length ? this._bootstrap.alias : this._bootstrap.name ?? "Unknown";
    } else {

      return this.address;
    }
  }
}

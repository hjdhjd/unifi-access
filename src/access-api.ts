/* Copyright(C) 2019-2024, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * access-api.ts: Our UniFi Access API implementation.
 */
import { ACCESS_API_ERROR_LIMIT, ACCESS_API_RETRY_INTERVAL, ACCESS_API_TIMEOUT } from "./settings.js";
import { ALPNProtocol, AbortError, FetchError, Headers, Request, RequestOptions, Response, context, timeoutSignal } from "@adobe/fetch";
import {
  AccessApiResponse,
  AccessBootstrapConfig,
  AccessControllerConfig,
  AccessDeviceConfig,
  AccessDeviceConfigPayload,
  AccessDoorConfig,
  AccessFloorConfig
} from "./access-types.js";
import { AccessLogging } from "./access-logging.js";
import { EventEmitter } from "node:events";
import WebSocket from "ws";
import util from "node:util";

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
 * 3. Listen for `message` events emitted by {@link AccessApi} containing all Access controller events, in realtime. They are delivered as {@link AccessEventPacket}
 *    packets, containing the event-specific details.
 *
 * Those are the basics that gets us up and running.
 */
export class AccessApi extends EventEmitter {

  private _bootstrap: AccessBootstrapConfig | null;
  private _controller: AccessControllerConfig | null;
  private _devices: AccessDeviceConfig[] | null;
  private _doors: AccessDoorConfig[] | null;
  private _floors: AccessFloorConfig[] | null;
  private address: string;
  private apiErrorCount: number;
  private apiLastSuccess: number;
  private events: WebSocket | null;
  private eventsTimer: NodeJS.Timeout | null;
  private fetch: (url: string|Request, options?: RequestOptions) => Promise<Response>;
  private headers: Headers;
  private _isAdminUser: boolean;
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
    if(!log) {

      log = {

        /* eslint-disable no-console */
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        debug: (message: string, ...parameters: unknown[]): void => { /* No debug logging by default. */ },
        error: (message: string, ...parameters: unknown[]): void => console.error(message, ...parameters),
        info: (message: string, ...parameters: unknown[]): void => console.log(message, ...parameters),
        warn: (message: string, ...parameters: unknown[]): void => console.log(message, ...parameters)
        /* eslint-enable no-console */
      };
    }

    this._bootstrap = null;
    this._controller = null;
    this._devices = null;
    this._doors = null;
    this._floors = null;
    this.events = null;
    this.eventsTimer = null;

    this.log = {

      debug: (message: string, ...parameters: unknown[]): void => log?.debug(this.name + ": " + message, ...parameters),
      error: (message: string, ...parameters: unknown[]): void => log?.error(this.name + ": API error: " + message, ...parameters),
      info: (message: string, ...parameters: unknown[]): void => log?.info(this.name + ": " + message, ...parameters),
      warn: (message: string, ...parameters: unknown[]): void => log?.warn(this.name + ": " + message, ...parameters)
    };

    this.apiErrorCount = 0;
    this.apiLastSuccess = 0;
    const { fetch } = context({ alpnProtocols: [ ALPNProtocol.ALPN_HTTP2 ], rejectUnauthorized: false, userAgent: "unifi-access" });
    this.fetch = fetch;
    this.headers = new Headers();
    this._isAdminUser = false;
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

    this.logout();

    this.address = address;
    this.username = username;
    this.password = password;

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
    if(this.headers.has("Cookie") && this.headers.has("X-CSRF-Token")) {

      return true;
    }

    // Acquire a CSRF token, if needed. We only need to do this if we aren't already logged in, or we don't already have a token.
    if(!this.headers.has("X-CSRF-Token")) {

      // UniFi OS has cross-site request forgery protection built into it's web management UI. We retrieve the CSRF token, if available, by connecting to the Access
      // controller and checking the headers for it.
      const response = await this.retrieve("https://" + this.address, { method: "GET" }, false);

      if(response?.ok) {

        const csrfToken = response.headers.get("X-CSRF-Token");

        // Preserve the CSRF token, if found, for future API calls.
        if(csrfToken) {

          this.headers.set("X-CSRF-Token", csrfToken);
        }
      }
    }

    // Log us in.
    const response = await this.retrieve(this.getApiEndpoint("login"), {

      body: JSON.stringify({ password: this.password, rememberMe: true, token: "", username: this.username }),
      method: "POST"
    });

    // Something went wrong with the login call, possibly a controller reboot or failure.
    if(!response?.ok) {

      this.logout();
      return false;
    }

    // We're logged in. Let's configure our headers.
    const csrfToken = response.headers.get("X-Updated-CSRF-Token") ?? response.headers.get("X-CSRF-Token");
    const cookie = response.headers.get("Set-Cookie");

    // Save the refreshed cookie and CSRF token for future API calls and we're done.
    if(csrfToken && cookie) {

      // Only preserve the token element of the cookie and not the superfluous information that's been added to it.
      this.headers.set("Cookie", cookie.split(";")[0]);

      // Save the CSRF token.
      this.headers.set("X-CSRF-Token", csrfToken);

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
    const retrieveEndpoint = async (endpoint: string): Promise<AccessApiResponse | null> => {

      // Retrieve the endpoint from the controller.
      const response = await this.retrieve(this.getApiEndpoint(endpoint));

      // Something went wrong. Retry the bootstrap attempt once, and then we're done.
      if(!response?.ok) {

        this.logRetry("Unable to retrieve the UniFi Access " + endpoint + " configuration.", retry);
        return null;
      }

      let data: AccessApiResponse | null = null;

      try {

        data = await response.json() as AccessApiResponse;

      } catch(error) {

        data = null;
        this.log.error("Unable to parse response from UniFi Access. Will retry again later.");
      }

      return data;
    };

    // Retrieve the controller configuration.
    this._controller = ((await retrieveEndpoint("controller"))?.data as AccessControllerConfig) ?? null;

    if(!this._controller && retry) {

      return this.bootstrapController(false);
    }

    // Next, retrieve the bootstrap configuration.
    const data = ((await retrieveEndpoint("bootstrap"))?.data as AccessBootstrapConfig[]);

    this._bootstrap = data ? data[0] : null;

    if(!this._bootstrap && retry) {

      return this.bootstrapController(false);
    }

    // Retrieve the list of doors from all the floors the user has configured.
    this._doors = this._bootstrap?.floors.flatMap(x => x.doors) ?? null;

    // Retrieve the list of devices from all the doors the user has configured.
    this._devices = this._doors?.map(x => x.device_groups).flat(2) ?? null;

    // Set the list of floors as a convenience.
    this._floors = this._bootstrap?.floors ?? null;

    // We're good. Now connect to the event listener API.
    if(!(await this.launchEventsWs())) {

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

      const ws = new WebSocket("wss://" + this.address + "/proxy/access/api/v2/ws/notification", {

        headers: {

          Cookie: this.headers.get("Cookie") ?? ""
        },

        rejectUnauthorized: false
      });

      if(!ws) {

        this.log.error("Unable to connect to the realtime events API. Will retry again later.");

        if(this.eventsTimer) {

          clearTimeout(this.eventsTimer);
          this.eventsTimer = null;
        }

        this.events = null;

        return false;
      }

      let messageHandler: ((event: Buffer) => void) | null;

      // Cleanup after ourselves if our websocket closes for some resaon.
      ws.once("close", (): void => {

        if(this.eventsTimer) {

          clearTimeout(this.eventsTimer);
          this.eventsTimer = null;
        }

        this.events = null;

        if(messageHandler) {

          ws.removeListener("message", messageHandler);
          messageHandler = null;
        }
      });

      // Handle any websocket errors.
      ws.once("error", (error: Error): void => {

        // If we're closing before fully established it's because we're shutting down the API - ignore it.
        if(error.message !== "WebSocket was closed before the connection was established") {

          this.log.error(error.toString());
        }

        ws.terminate();
      });

      // Process messages as they come in.
      ws.on("message", messageHandler = (event: Buffer): void => {

        if(!event) {

          this.log.error("Unable to process message from the realtime events API.");
          ws.terminate();
          return;
        }

        // The Access events API seems to send a heartbeat every five seconds.
        if(event.toString() === "\"Hello\"\n") {

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

        // Parse the JSON from the events API.
        let json;

        try {

          json = JSON.parse(event.toString()) as JSON;
        } catch(error) {

          this.log.error("Error processing message from the events API: %s", error);
          return;
        }

        // Emit the decoded packet for users.
        this.emit("message", json);
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
    if(!device) {

      return false;
    }

    // Unlocking only works on hubs.
    if(device.device_type !== "UAH") {

      return false;
    }

    // Default to the standard unlock endpoint.
    let action = "unlock";
    let endpoint = "/relay_unlock";
    let payload = {};

    // If we've specified a duration, let's specify that.
    if(duration !== undefined) {

      endpoint = "/lock_rule";

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
    }

    // Request the unlock from Access.
    const response = await this.retrieve(this.getApiEndpoint("device") + "/" + device.unique_id + endpoint, {

      body: payload,
      method: "PUT"
    });

    if(!response?.ok) {

      this.log.error("%s: Unable to %s the %s: %s.", this.getFullName(device), action, device.display_model, response?.status);
      return false;
    }

    // Get our status.
    const status = await response.json() as AccessApiResponse;

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
  public async updateDevice<DeviceType extends AccessDeviceConfig>(device: DeviceType, payload: AccessDeviceConfigPayload): Promise<DeviceType | null> {

    // No device object, we're done.
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
    const response = await this.retrieve(this.getApiEndpoint("device") + "/" + device.unique_id + (device.device_type === "UAH" ? "configs" : "settings"), {

      body: JSON.stringify(payload),
      method: "PUT"
    });

    if(!response?.ok) {

      this.log.error("%s: Unable to configure the %s: %s.", this.getFullName(device), device.device_type, response?.status);
      return null;
    }

    // We successfully set the message, return the updated device object.
    return await response.json() as DeviceType;
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
  public getDeviceName(device: AccessDeviceConfig, name = device?.name, deviceInfo = false): string {

    // Validate our inputs.
    if(!device) {

      return "";
    }

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
    this.events?.terminate();
    this.events = null;
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
    const csrfToken = this.headers?.get("X-CSRF-Token");

    // Initialize the headers we need.
    this.headers = new Headers();
    this.headers.set("Content-Type", "application/json");

    // Restore the CSRF token if we have one.
    if(csrfToken) {

      this.headers.set("X-CSRF-Token", csrfToken);
    }
  }

  /**
   * Execute an HTTP fetch request to the Access controller.
   *
   * @param url       - Requested endpoint type. Valid types are `livestream` and `talkback`.
   * @param options   - Parameters to pass on for the endpoint request.
   * @param logErrors - Log errors that aren't already accounted for and handled, rather than failing silently. Defaults to `true`.
   *
   * @returns Returns a promise that will resolve to a Response object successful, and `null` otherwise.
   *
   * @remarks This method should be used when direct access to the Access controller is needed, or when this library doesn't have a needed method to access
   *   controller capabilities.
   */
  // Communicate HTTP requests with a Access controller.
  public async retrieve(url: string, options: RequestOptions = { method: "GET" }, logErrors = true): Promise<Response | null> {

    return this._retrieve(url, options, logErrors);
  }

  // Internal interface to communicating HTTP requests with an Access controller, with error handling.
  private async _retrieve(url: string, options: RequestOptions = { method: "GET" }, logErrors = true, decodeResponse = true, isRetry = false): Promise<Response | null> {

    // Catch Access controller server-side issues:
    //
    // 400: Bad request.
    // 404: Not found.
    // 429: Too many requests.
    // 500: Internal server error.
    // 502: Bad gateway.
    // 503: Service temporarily unavailable.
    const isServerSideIssue = (code: number): boolean => [400, 404, 429, 500, 502, 503].some(x => x === code);

    let response: Response;

    // Create a signal handler to deliver the abort operation.
    const signal = timeoutSignal(ACCESS_API_TIMEOUT * 1000);

    options.headers = this.headers;
    options.signal = signal;

    try {

      const now = Date.now();

      // Throttle this after ACCESS_API_ERROR_LIMIT attempts.
      if(this.apiErrorCount >= ACCESS_API_ERROR_LIMIT) {

        // Let the user know we've got an API problem.
        if(this.apiErrorCount === ACCESS_API_ERROR_LIMIT) {

          this.log.error("Throttling API calls due to errors with the %s previous attempts. Pausing communication with the Access controller for %s minutes.",
            this.apiErrorCount, ACCESS_API_RETRY_INTERVAL / 60);
          this.apiErrorCount++;
          this.apiLastSuccess = now;
          return null;
        }

        // Check to see if we are still throttling our API calls.
        if((this.apiLastSuccess + (ACCESS_API_RETRY_INTERVAL * 1000)) > now) {

          return null;
        }

        // Inform the user that we're out of the penalty box and try again.
        this.log.error("Resuming connectivity to the UniFi Access API after pausing for %s minutes.", ACCESS_API_RETRY_INTERVAL / 60);

        this.apiErrorCount = 0;
        this.reset();

        if(!(await this.loginController())) {

          return null;
        }
      }

      response = await this.fetch(url, options);

      // The caller will sort through responses instead of us.
      if(!decodeResponse) {

        return response;
      }

      // Preemptively increase the error count.
      this.apiErrorCount++;

      // Bad username and password.
      if(response.status === 401) {

        this.logout();
        this.log.error("Invalid login credentials given. Please check your login and password.");
        return null;
      }

      // Insufficient privileges.
      if(response.status === 403) {

        this.log.error("Insufficient privileges for this user. Please check the roles assigned to this user and ensure it has sufficient privileges.");
        return null;
      }

      if(!response.ok && isServerSideIssue(response.status)) {

        this.log.error("Unable to connect to the Access controller. This is usually temporary and will occur during Access controller reboots and firmware updates.");
        return null;
      }

      // Some other unknown error occurred.
      if(!response.ok) {

        this.log.error("%s - %s", response.status, response.statusText);
        return null;
      }

      this.apiLastSuccess = Date.now();
      this.apiErrorCount = 0;
      return response;
    } catch(error) {

      this.apiErrorCount++;

      if(error instanceof AbortError) {

        this.log.error("Access controller is taking too long to respond to a request. This error can usually be safely ignored.");
        this.log.debug("Original request was: %s", url);
        return null;
      }

      if(error instanceof FetchError) {

        switch(error.code) {

          case "ECONNREFUSED":
          case "ERR_HTTP2_STREAM_CANCEL":

            this.log.error("Connection refused.");
            break;

          case "ECONNRESET":

            // Retry on connection reset, but no more than once.
            if(!isRetry) {

              return this._retrieve(url, options, logErrors, decodeResponse, true);
            }

            this.log.error("Network connection to Access controller has been reset.");
            break;

          case "ENOTFOUND":

            this.log.error("Hostname or IP address not found: %s. Please ensure the address you configured for this UniFi Access controller is correct.",
              this.address);
            break;

          default:

            // If we're logging when we have an error, do so.
            if(logErrors) {

              this.log.error("Error: %s %s.", error.code, error.message);
            }
            break;
        }
      }

      return null;
    } finally {

      // Clear out our response timeout if needed.
      signal.clear();
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
  public get controller(): AccessControllerConfig | null {

    return this._controller;
  }

  /**
   * Access the Access controller bootstrap JSON.
   *
   * @returns Returns the bootstrap JSON if the Access controller has been bootstrapped, `null` otherwise.
   */
  // Get the bootstrap JSON.
  public get bootstrap(): AccessBootstrapConfig | null {

    return this._bootstrap;
  }

  /**
   * Access the Access controller list of devices.
   *
   * @returns Returns an array of all the devices from all the UniFi Access hubs associated with this controller, `null` otherwise.
   */
  // Get the list of devices.
  public get devices(): AccessDeviceConfig[] | null {

    return this._devices;
  }

  /**
   * Access the Access controller list of doors.
   *
   * @returns Returns an array of all the doors from all the UniFi Access hubs associated with this controller, `null` otherwise.
   */
  // Get the list of doors.
  public get doors(): AccessDoorConfig[] | null {

    return this._doors;
  }

  /**
   * Access the Access controller list of floors.
   *
   * @returns Returns an array of all the floors from all the UniFi Access hubs associated with this controller, `null` otherwise.
   */
  // Get the list of floors.
  public get floors(): AccessFloorConfig[] | null {

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
   * Utility method that returns a nicely formatted version of the Access controller name.
   *
   * @returns Returns the Access controller name in the following format:
   *   <code>*Access controller name* [*Access controller type*]</code>.
   */
  // Utility to generate a nicely formatted controller string.
  public get name(): string {

    // Our controller string, if it exists, appears as `Controller [Controller Type]`. Otherwise, we appear as `address`.
    // Our controller string, if it exists, appears as `Controller`. Otherwise, we appear as `address`.
    if(this._bootstrap && this._bootstrap.name) {

      return this._bootstrap.name;
    } else {

      return this.address;
    }
  }
}

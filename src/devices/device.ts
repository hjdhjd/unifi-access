/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * device.ts: The projection base - a live read-through view over the state store - and the device layer that adds identity and the write-through command surface.
 */
import { ACCESS_METHOD_KEYS, ACCESS_METHOD_ROW_TAG, accessMethodValue } from "../protocol/vocabulary.ts";
import type { AccessDeviceConfig, AccessDeviceConfigPayload, Nullable } from "../types/index.ts";
import type { AccessResponse, HttpMethod } from "../transport/http.ts";
import type { AccessState, AccessStateDevice } from "../protocol/reducer.ts";
import { accessMethodsEndpoint, deviceRestartEndpoint, deviceSettingsEndpoint } from "./endpoints.ts";
import { deviceAccessMethodStates, deviceDisplayName, isCamera, isHub, isTamperCapable as readTamperCapability, tamperState as readTamperState,
  selectAccessPoints } from "../state/selectors.ts";
import type { AccessDeviceContext } from "./context.ts";
import type { AccessMethod } from "../protocol/vocabulary.ts";
import { readResultEnvelope } from "../protocol/envelope.ts";

// The sentence a refused restart falls back to when the controller sent no message of its own. The endpoint answers the same result envelope the door commands do,
// so it reports a refusal the same way, and this names the command that drew it.
const DEVICE_RESTART_REFUSED = "The UniFi Access controller refused the device restart.";

/**
 * The read-only core every projection shares. A projection is **a live view, not a cached record**: it holds only its context and a pre-bound selector, and every
 * read goes through to the current store snapshot. Holding one across hours of state change is safe, because its getters always reflect the latest reduced state.
 *
 * This base supplies exactly what every projection has in common - the asserting `config` getter, its non-throwing `peek()` companion, the absent-record guard, and
 * live `observe()` - and nothing else. It is unbounded in its record type and carries no identity of its own, because reading-through-and-observing is meaningful
 * for any reduced record however it is addressed.
 *
 * When the underlying record has left the state, or has not arrived yet, the asserting reads throw: for a caller whose contract requires the record, a handle to an
 * absent one is a programming error. A caller that treats absence as an ordinary runtime condition asks non-throwingly instead - `peek()` returns the record or
 * `undefined`, and a fresh lookup through the registry likewise returns `undefined` once the record is gone.
 *
 * @typeParam TConfig - The record type this projection wraps.
 *
 * @category Devices
 */
export abstract class Projection<TConfig> {

  protected readonly ctx: AccessDeviceContext;

  // The record's selector, pre-bound for this projection so that observe() holds a stable selector reference - the store's dedup is keyed on that identity, so a
  // freshly-built selector per call would defeat it.
  readonly #select: (state: AccessState) => TConfig | undefined;

  protected constructor(ctx: AccessDeviceContext, select: (state: AccessState) => TConfig | undefined) {

    this.ctx = ctx;
    this.#select = select;
  }

  /**
   * The record's current configuration, read through to the live store snapshot.
   *
   * @returns The current configuration.
   *
   * @throws {ReferenceError} If the record is no longer present in the controller state.
   */
  get config(): Readonly<TConfig> {

    return this.#requireConfig();
  }

  /**
   * The record's current configuration if it is present, or `undefined` if it is not - the non-throwing companion to `config`. Reach for this to
   * ask "is it still here, and if so what is it?": a record leaving the state is an ordinary runtime condition, so it is reported as `undefined` rather than as an
   * error. Reach for `config` where the record's presence is a precondition and its absence is a defect that should fail loudly.
   *
   * Like every projection read this goes through to the current snapshot rather than to anything captured at construction. It is the single home of that raw read;
   * `config` is this read plus the absent-record guard.
   *
   * @returns The current configuration, or `undefined` when the record is not in the controller state.
   */
  peek(): Readonly<TConfig> | undefined {

    return this.#select(this.ctx.store.snapshot());
  }

  /**
   * Observe this projection. The returned async iterable yields `this` each time the record changes by reference, and stays silent on dispatches that did not touch
   * it. Pair it with the synchronous getters: those answer "what is it now", this answers "tell me when it changes".
   *
   * @param opts - Optional abort signal that terminates the iteration.
   *
   * @returns An async iterable of this projection, yielding once per change.
   */
  async *observe(opts: { signal?: AbortSignal } = {}): AsyncGenerator<this> {

    // The store dedups on this selector's output; we map every distinct output back to the same live handle, which the consumer re-reads through its getters. As an
    // async-generator method, `this` stays bound to the instance for the life of the iteration.
    for await (const _config of this.ctx.store.observe(this.#select, opts)) {

      yield this;
    }
  }

  /**
   * The message the absent-record guard throws with, supplied by each concrete projection so the error names its own subject.
   *
   * @returns The `ReferenceError` message for an absent record.
   */
  protected abstract absenceMessage(): string;

  // The asserting read: peek the live record and throw a subject-specific ReferenceError when it is absent. The raw read lives in peek(), so config and peek() share
  // one recipe and config is exactly peek()'s throwing form, and every getter built on config inherits one precise message.
  #requireConfig(): Readonly<TConfig> {

    const config = this.peek();

    if(config === undefined) {

      throw new ReferenceError(this.absenceMessage());
    }

    return config;
  }
}

/**
 * A device on the controller, as a live projection with the write-through command surface every modeled device supports.
 *
 * This class is concrete rather than abstract, which is a deliberate divergence from a hierarchy that fixes a category tag per leaf: Access models one device
 * shape, so the generic device is itself something a consumer can hold. The hub-specific commands live one level down, on `AccessHub`, because they address a door
 * rather than the device.
 *
 * Commands are **write-through**: they tell the controller to do something and return, without folding the response into the store. State advances only through
 * the reducer's other inputs - the realtime notification stream and the refresh failsafe - and never through a command's own response, so the issuer learns of
 * its own change the way every other subscriber does. The consequence is that a projection reflects a command's effect once the stream (or the next refresh)
 * delivers it, not synchronously after the `await`, so a consumer observes rather than reads back.
 *
 * @category Devices
 */
export class AccessDevice extends Projection<AccessStateDevice> {

  /** The device's stable identity, the `unique_id` the controller assigned it. */
  readonly id: string;

  constructor(ctx: AccessDeviceContext, id: string, select: (state: AccessState) => AccessStateDevice | undefined) {

    super(ctx, select);
    this.id = id;
  }

  /**
   * The device's display name, as {@link deviceDisplayName} answers it: the alias an administrator gave it when there is one, and the controller's own name
   * for the hardware otherwise. The rule and its rationale live with that selector, so a consumer labelling a device from its record and a handle reading its
   * own name cannot drift apart.
   *
   * @throws {ReferenceError} If the device is no longer present in the controller state.
   */
  get name(): string {

    return deviceDisplayName(this.config);
  }

  /**
   * Whether the controller currently reports this device as online.
   *
   * This reads the controller's own `is_online` and nothing else. The record carries neighboring flags - adopted, managed, connected - that describe how the
   * device is enrolled rather than whether it is reachable now, and a consumer wanting a stricter definition composes them itself off `config`. Folding them in
   * here would make this getter one consumer's policy rather than the controller's report.
   *
   * @throws {ReferenceError} If the device is no longer present in the controller state.
   */
  get isOnline(): boolean {

    return this.config.is_online;
  }

  /**
   * Whether this device's hardware can detect tampering, read through the state tier's own `isTamperCapable` predicate.
   *
   * It is mirrored here where the role classification is not, because a hub's role produces a projection class a consumer can ask about directly and this one
   * produces none: there is no tamper-capable subclass to test, so the handle is where a consumer asks. Both censuses establish the capability, so this answers
   * whichever way the client connected.
   *
   * @throws {ReferenceError} If the device is no longer present in the controller state.
   */
  get isTamperCapable(): boolean {

    return readTamperCapability(this.config);
  }

  /**
   * What this device reports about tampering, read through the state tier's own `tamperState` selector: `true` with the condition raised, `false` with it clear,
   * and `undefined` where nothing has established a reading - a record with no tamper row, one carrying no configuration rows at all as every token-only census
   * produces, a device whose tampering alert is switched off and so reports no tamper input, or a value outside the vocabulary the controller has been observed to
   * write. That selector's own documentation is the full statement of the contract.
   *
   * @throws {ReferenceError} If the device is no longer present in the controller state.
   */
  get tamperState(): boolean | undefined {

    return readTamperState(this.config);
  }

  /**
   * What this device's own configuration rows say about each access method, read through the state tier's own `deviceAccessMethodStates` selector: `true` for a
   * method its row reports enabled, `false` for one reported disabled, and no entry where no row establishes a reading - a method the device has no row for, a
   * record carrying no configuration rows at all as every token-only census produces, or a row carrying a value outside the `"yes"` and `"no"` pair. That
   * selector's own documentation is the full statement of the contract.
   *
   * @throws {ReferenceError} If the device is no longer present in the controller state.
   */
  get accessMethodStates(): Partial<Readonly<Record<AccessMethod, boolean>>> {

    return deviceAccessMethodStates(this.config);
  }

  /**
   * The identifier of the distinct device this one reaches the controller through, or `null` for a device that connects in its own right.
   *
   * This is the dependency an operator has to respect: hardware behind an Enterprise Access Hub takes both its uplink and its power from that hub, so it is
   * reachable only while the hub is. A caller sequencing commands across a fleet restarts what is attached before what carries it, and a caller displaying an
   * inventory can render the same relationship as a tree.
   *
   * @returns The carrying device's identifier, or `null` when there is none.
   *
   * @throws {ReferenceError} If the device is no longer present in the controller state.
   */
  get uplinkId(): string | null {

    const config = this.config;

    /* A door-serving port of an Enterprise Access Hub is that hub's own hardware wearing a port's identity, so nothing carries it. The record cannot answer this
     * about itself - synthesis gives a port a distinct identifier of its own while it inherits the hub's self-referential uplink field, so reading that field
     * raw calls the hub's hardware something attached to itself. Asking the expansion whether it produced this record is what tells the two apart, and it is the
     * only place the answer exists.
     */
    if(selectAccessPoints(this.ctx.store.snapshot()).some((point) => point.unique_id === this.id)) {

      return null;
    }

    // The controller spells "nothing carries this device" two ways, an empty field and a reference back to the device itself, and both mean the same thing.
    if((config.connected_uah_id === "") || (config.connected_uah_id === config.unique_id)) {

      return null;
    }

    return config.connected_uah_id;
  }

  /**
   * Apply a configuration change to this device. Write-through: it writes to the controller and returns the record the controller echoed back, without folding it
   * into the store - the change is reflected once the realtime stream or the next refresh delivers it. The echoed record is a convenience for a caller that wants
   * to see what the controller made of the write, not a second source of state.
   *
   * There is no envelope to check here, which is what sets this apart from the door commands. The device-settings endpoint answers with the device record itself
   * rather than with the result envelope the rest of the surface wraps its answers in, so a domain-level verdict is not something this response carries: a non-2xx
   * classifies and throws, and a 2xx is the echoed record.
   *
   * @param payload - The configuration to apply.
   * @param opts    - Optional abort signal.
   *
   * @returns The device record as the controller echoed it.
   *
   * @throws {@link AccessCapabilityError} when this client has no path that can carry the write - one held to the official API, which cannot express it, or one
   *   holding only a token, whose credentials the Access application's own endpoints require. The classified `FatalError` on a non-2xx -
   *   {@link AccessAuthorizationError} when the account lacks the privilege the write requires - or a transport-level `AccessError` on failure.
   */
  async updateDevice(payload: AccessDeviceConfigPayload, opts: { signal?: AbortSignal } = {}): Promise<AccessDeviceConfig> {

    /* Which collection the write targets follows the device's live capability: the controller keeps hub-capable hardware's settings under one name and everything
     * else's under another. This is URL routing rather than a validity guard - every modeled device can be written to, and a device that is not a hub simply has
     * its settings under the other name.
     */
    const kind = isHub(this.config) ? "configs" : "settings";

    /* Where the echoed record is caught. It lives on a holder rather than a bare binding because the routed call is what runs the expression that fills it: a
     * property read is not narrowed across that call, which is exactly the truth of the situation, where a binding the compiler could see assigned nowhere else
     * would read as permanently empty.
     */
    const echo: { record?: AccessDeviceConfig } = {};

    await this.ctx.routing.routedDirect({

      deviceId: this.id,
      direct: async (): Promise<void> => {

        const response = await this.dispatch(deviceSettingsEndpoint(this.ctx.host, this.id, kind),
          { body: payload, method: "PUT", ...((opts.signal !== undefined) && { signal: opts.signal }) });

        echo.record = response.json<AccessDeviceConfig>();
      },
      operation: "a configuration write",
      ...((opts.signal !== undefined) && { signal: opts.signal })
    });

    // The routed call resolves only after the direct expression ran, so the record is always here by the time this reads it. Reaching this throw would be the same
    // class of defect the reducer's exhaustiveness guard turns loud: a caller that got past routing without the command being issued.
    if(echo.record === undefined) {

      throw new TypeError("A device configuration write resolved without the controller's echoed record, which the routing decision excludes.");
    }

    return echo.record;
  }

  /**
   * Switch one of this device's access methods - the ways a credential presented at it can open a door - on or off, by name. Write-through: it writes to the
   * controller and returns, and the change is reflected once the realtime stream or the next refresh delivers it.
   *
   * The library knows which keys a method spans on each path and which endpoint each path writes, so the caller names the method and nothing more. The official
   * path goes first where the client has one: its device settings write, and then a read of the settings back, because that write answers success for a method
   * the controller declines. The method reading the state asked for completes the switch, and reading the other state throws {@link AccessDeclinedError}. A
   * device whose official settings do not list the method, or list it with a value outside the `"yes"` and `"no"` pair, sends the switch to the Access
   * application's own endpoints on a client that holds credentials, and so does an official failure other than a decline or an abort. There, camera-class
   * hardware, as {@link isCamera} answers it, takes its rows on the camera configuration endpoint, `configs?is_camera=true`, and every other device on its
   * `settings` collection, hubs included, each row in the shape the controller's access-method rows take: its key, the `open_door_mode` tag, and a `"yes"` or
   * `"no"` value. Any 2xx there is success whatever its body, because no capture records what the controller answers a row array with.
   *
   * @param method  - The access method, by the library's own name for it.
   * @param enabled - `true` to switch the method on, `false` to switch it off.
   * @param opts    - Optional abort signal.
   *
   * @throws {@link AccessDeclinedError} when the controller accepts the official write and the read-back shows the method in the other state.
   *   {@link AccessCapabilityError} when no path this client holds can carry the switch, as on a client with no direct path whose device's official settings do not
   *   list the method or list it with a value outside the `"yes"` and `"no"` pair. Any other official failure as itself on a client with no direct path to take
   *   instead. On the direct path, the classified `FatalError` on a non-2xx - {@link AccessAuthorizationError} when the account lacks the privilege the write
   *   requires - or a transport-level `AccessError` on failure.
   */
  async setAccessMethod(method: AccessMethod, enabled: boolean, opts: { signal?: AbortSignal } = {}): Promise<void> {

    /* The endpoint and the keys follow the record's own camera flag rather than the hub capability a configuration write routes by: a hub takes its access methods
     * on the settings collection like every other device that is not camera-class. As with that write, this is URL routing rather than a validity guard.
     */
    const camera = isCamera(this.config);
    const value = accessMethodValue(enabled);

    // One row per key the method spans on this endpoint, with the tag and the value spellings the controller's access-method rows carry.
    const rows = ACCESS_METHOD_KEYS[method][camera ? "camera" : "direct"].map((key) => ({ key, tag: ACCESS_METHOD_ROW_TAG, value }));

    await this.ctx.routing.routedAccessMethod({

      deviceId: this.id,
      direct: async (): Promise<void> => {

        await this.dispatch(accessMethodsEndpoint(this.ctx.host, this.id, camera ? "camera" : "settings"),
          { body: rows, method: "PUT", ...((opts.signal !== undefined) && { signal: opts.signal }) });
      },
      enabled,
      method,
      ...((opts.signal !== undefined) && { signal: opts.signal })
    });
  }

  /**
   * Restart this device. Write-through: the controller drops and re-establishes the device, and the projection reflects the cycle as the realtime stream reports
   * it.
   *
   * This endpoint answers in the same result envelope the door commands do, captured from a live restart on 2026-08-16, so its verdict is read the same way: a
   * non-2xx classifies and throws, and a 2xx whose envelope reports anything other than success throws rather than reading as an accepted restart.
   *
   * @param opts - Optional abort signal.
   *
   * @throws {@link AccessCapabilityError} when this client has no path that can carry the restart - one held to the official API, which cannot express it, or one
   *   holding only a token, whose credentials the Access application's own endpoints require. {@link AccessApiError} when the controller accepts the request but
   *   reports the restart unsuccessful, the classified `FatalError` on a non-2xx, or a transport-level `AccessError` on failure.
   */
  async restart(opts: { signal?: AbortSignal } = {}): Promise<void> {

    await this.ctx.routing.routedDirect({

      deviceId: this.id,
      direct: async (): Promise<void> => {

        const response = await this.dispatch(deviceRestartEndpoint(this.ctx.host, this.id),
          { method: "PUT", ...((opts.signal !== undefined) && { signal: opts.signal }) });

        this.requireDomainSuccess(response, DEVICE_RESTART_REFUSED);
      },
      operation: "a restart",
      ...((opts.signal !== undefined) && { signal: opts.signal })
    });
  }

  /**
   * Issue one authenticated request against a fully-qualified URL and return the 2xx-classified response. This is the single home of the device-command mechanic -
   * the method default, the body convention, and the status classification - so every command shares one definition rather than re-spelling the request shape.
   *
   * The URL is passed whole rather than assembled from this device's own endpoint and a suffix, because two of the hub commands address the door resource rather
   * than the device: a suffix-based shape could not express them. Each caller builds its URL from the endpoints module, which is where those shapes live.
   *
   * The body is a tri-state, and the distinction is on the wire. Omitting it sends `{}`, which is what a parameterless command sends; passing an object sends that
   * object; passing `null` sends no body at all, which is what one command's field-proven shape requires. `GET` and `HEAD` never carry a body whatever is passed.
   * No headers are set here: the transport stamps the content type on every request it sends as its own single decision, so repeating it would be a second place
   * that decides what a request declares.
   *
   * @param url  - The fully-qualified request URL.
   * @param opts - The HTTP `method` (default `POST`), the `body` tri-state, and an optional abort `signal`.
   *
   * @returns The 2xx-classified response.
   *
   * @throws The classified `FatalError` on a non-2xx, or a transport-level `AccessError` on failure.
   */
  protected async dispatch(url: string, opts: { body?: Nullable<object>; method?: HttpMethod; signal?: AbortSignal } = {}): Promise<AccessResponse> {

    /* Unreachable by construction: every direct closure runs only where the routing decision took the direct path, and that path exists only where a transport
     * does. It throws rather than returning silently because reaching it is a defect in a caller that bypassed routing, exactly the class the reducer's
     * exhaustiveness guard turns loud - a silent return would leave that caller believing a command it never sent had been issued.
     */
    if(this.ctx.transport === null) {

      throw new TypeError("A direct device command reached a client that holds no direct transport, which the routing decision excludes.");
    }

    const method = opts.method ?? "POST";
    const carriesBody = (method !== "GET") && (method !== "HEAD") && (opts.body !== null);
    const response = await this.ctx.transport.send(url, {

      ...(carriesBody && { body: JSON.stringify(opts.body ?? {}) }),
      method,
      ...((opts.signal !== undefined) && { signal: opts.signal })
    });

    return response.ensureOk();
  }

  /**
   * Read a command's result envelope and throw when the controller reports the operation unsuccessful.
   *
   * A 2xx means the controller accepted the request and answered; what it answered can still refuse the operation, and that verdict is in the envelope rather than
   * in the status. The reading belongs to the protocol tier, which is what has every command on either of the controller's APIs judge one envelope the same way
   * rather than each spelling out its own idea of what success looks like.
   *
   * @param response - The 2xx-classified response to read.
   * @param message  - The sentence the thrown refusal falls back to when the controller sent no message of its own, naming the command that drew it.
   *
   * @throws {@link AccessApiError} when the envelope refuses, carrying the controller's own code, its message and its diagnostic, or {@link AccessProtocolError}
   *   when the body is not a result envelope at all.
   */
  protected requireDomainSuccess(response: AccessResponse, message: string): void {

    readResultEnvelope(response.json<unknown>(), message);
  }

  // The absent-device guard message, naming the device by the identity the caller holds it under.
  protected absenceMessage(): string {

    return "Device " + this.id + " is no longer present in the UniFi Access controller state.";
  }
}

/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * device.ts: The projection base - a live read-through view over the state store - and the device layer that adds identity and the write-through command surface.
 */
import type { AccessApiResponse, AccessDeviceConfig, AccessDeviceConfigPayload, Nullable } from "../types/index.ts";
import type { AccessState, AccessStateDevice } from "../protocol/reducer.ts";
import { deviceRestartEndpoint, deviceSettingsEndpoint } from "./endpoints.ts";
import { isHub, selectAccessPoints } from "../state/selectors.ts";
import type { AccessDeviceContext } from "./context.ts";
import { AccessRequestError } from "../errors.ts";
import type { AccessResponse } from "../transport/http.ts";
import type { HttpMethod } from "../transport/http.ts";

// What a refused restart says. The endpoint answers the same result envelope the door commands do, so it reports a refusal the same way and this names the command
// that drew it.
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
 * the reducer's two inputs - the realtime notification stream and the refresh failsafe - so the issuer learns of its own change the way every other subscriber
 * does. The consequence is that a projection reflects a command's effect once the stream (or the next refresh) delivers it, not synchronously after the `await`, so
 * a consumer observes rather than reads back.
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
   * The device's display name: the alias an administrator gave it when there is one, and the controller's own name for the hardware otherwise. The precedence is
   * the controller interface's own - an alias is what a person chose to call this device, so it wins wherever one is set - and an alias set to the empty string
   * counts as unset, which is how clearing an alias in the interface reads on the wire.
   *
   * @throws {ReferenceError} If the device is no longer present in the controller state.
   */
  get name(): string {

    const config = this.config;

    return config.alias || config.name;
  }

  /**
   * Whether the controller currently reports this device as online.
   *
   * This reads the controller's own `is_online` and nothing else. The record carries neighbouring flags - adopted, managed, connected - that describe how the
   * device is enrolled rather than whether it is reachable now, and a consumer wanting a stricter definition composes them itself off `config`. Folding them in
   * here would make this getter one consumer's policy rather than the controller's report.
   *
   * @throws {ReferenceError} If the device is no longer present in the controller state.
   */
  get isOnline(): boolean {

    return this.config.is_online;
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
      operation: "a device configuration write",
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
   * Restart this device. Write-through: the controller drops and re-establishes the device, and the projection reflects the cycle as the realtime stream reports
   * it.
   *
   * This endpoint answers in the same result envelope the door commands do, captured from a live restart on 2026-08-16, so its verdict is read the same way: a
   * non-2xx classifies and throws, and a 2xx whose envelope reports anything other than success throws rather than reading as an accepted restart.
   *
   * @param opts - Optional abort signal.
   *
   * @throws {@link AccessCapabilityError} when this client has no path that can carry the restart - one held to the official API, which cannot express it, or one
   *   holding only a token, whose credentials the Access application's own endpoints require. {@link AccessRequestError} when the controller accepts the request but
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
      operation: "a device restart",
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
   * A 2xx means the controller accepted the request and answered; what it answered can still report that the operation did not succeed, and that verdict is in the
   * envelope rather than in the status. This lives beside the dispatch helper so that every command reading an envelope reads it the same way, rather than each one
   * spelling out its own idea of what success looks like.
   *
   * The thrown error carries the response's real status code, which is what the library's request error is for: this is the controller's own report of a refusal,
   * not a caller's mistake.
   *
   * @param response - The 2xx-classified response to read.
   * @param message  - The message the thrown error carries, naming the operation that was refused.
   *
   * @throws {@link AccessRequestError} when the envelope reports anything other than success.
   */
  protected requireDomainSuccess(response: AccessResponse, message: string): void {

    const body = response.json<AccessApiResponse>();

    if(body.codeS !== "SUCCESS") {

      throw new AccessRequestError(message, { body: body.msg, headers: {}, statusCode: response.statusCode });
    }
  }

  // The absent-device guard message, naming the device by the identity the caller holds it under.
  protected absenceMessage(): string {

    return "Device " + this.id + " is no longer present in the UniFi Access controller state.";
  }
}

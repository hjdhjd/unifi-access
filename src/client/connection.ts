/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * connection.ts: ConnectionMonitor - the connection-state machine, restart detection, and the recovery coordinator that folds the transport throttle and the
 * events-stream stall into one observable health surface.
 */

/**
 * {@link ConnectionMonitor} is the single coordinator that responds to the signals the layers below it detect: the transport's throttle rails, which are its
 * circuit breaker's verdict on reachability, and the events stream's error rail, which is its watchdog's verdict on whether the notification channel is still
 * alive. Detection stays with the resource that owns the signal; the response - verify, re-bootstrap, relaunch, and the state machine that narrates it - lives
 * here. That is the same split the throttle and the stall already use, and this is the responding half of it.
 *
 * **The monitor is state machine and policy; it does not own a raw event stream.** The notification socket has to be replaced on recovery, because the stream
 * never reconnects itself - it tears down on a stall and stops. Fusing that lifecycle into the monitor would pile two responsibilities into one class and force
 * paired attach-and-detach bookkeeping on every relaunch. So the replaceable stream lives behind a small owner that presents a stable surface, and the monitor
 * wires into it exactly once.
 *
 * **The state is derived rather than stored.** It is the recovery phase, except that a tripped breaker shows as `throttled` when it is the only thing wrong. Once
 * recovery is underway the recovery phase wins, because then the monitor rather than the breaker owns re-probing, and "lost" or "reconnecting" is the more
 * actionable answer than "cooling down". A transition is therefore just "recompute after any input, and announce when the answer changed" - there is no transition
 * table to fall out of step with the machine.
 *
 * **Coupling is narrow and inverted.** The transport dependency is the structural {@link ThrottleSource} - the throttle verdict and its rails, nothing more -
 * rather than the concrete class; the store is read only through its public observation surface; and every other piece of I/O is an injected function the
 * composition root supplies. The monitor publishes on no diagnostics channel of its own, because it does not know which controller it is monitoring: the client
 * that does know owns every publish.
 *
 * @module AccessConnectionMonitor
 */
import { ACCESS_REBOOT_UPTIME_DROP_MINIMUM, ACCESS_RECOVERY_BACKOFF_MS, ACCESS_RECOVERY_STEADY_INTERVAL_MS } from "../settings.ts";
import { AccessAbortedError, AccessError, AccessNetworkError, formatErrorChain } from "../errors.ts";
import type { AccessEventPacket, Nullable } from "../types/index.ts";
import type { AccessLogging } from "../logging.ts";
import type { AccessWireEvent } from "../protocol/events.ts";
import type { Clock } from "../clock.ts";
import { EventBus } from "../event-bus.ts";
import type { EventStream } from "../transport/events-stream.ts";
import type { StateStore } from "../state/store.ts";
import type { StreamOptions } from "../event-bus.ts";
import { noopLog } from "../logging.ts";
import { selectControllerUptime } from "../state/selectors.ts";
import { wallClock } from "../clock.ts";

// The recovery sub-state the monitor keeps. The observable state widens this with the derived throttle verdict, so the breaker's answer never has to be mirrored
// into a field of our own - it is read live from the transport.
/** @internal */
type RecoveryPhase = "degraded" | "healthy" | "lost" | "reconnecting";

/**
 * The connection's observable state. `healthy` is steady operation; `degraded` means a fault was seen and reachability is being probed; `reconnecting` means the
 * controller answered and the monitor is re-bootstrapping and relaunching the notification stream; `lost` means the controller is unreachable and recovery is
 * polling for its return; `throttled` means the transport's breaker is open and holding requests back. The throttle verdict is read live from the transport and
 * takes precedence only while nothing else is wrong.
 *
 * @category Client
 */
export type ConnectionState = RecoveryPhase | "throttled";

/**
 * One edge of the connection state machine, carried on the `stateChanged` rail and yielded by {@link ConnectionMonitor.observe}. `reason` is present when a typed
 * fault - a stall, a failed reachability probe - is what drove the edge, and it holds that failure's whole cause chain as {@link formatErrorChain} renders it, so
 * the controller's own diagnosis reaches a consumer rather than the wrapper's sentence alone: the edge into `lost` carries exactly the text its own warning logs.
 *
 * @category Client
 */
export interface ConnectionTransition {

  from: ConnectionState;
  reason?: string;
  to: ConnectionState;
}

/**
 * The events {@link ConnectionMonitor} publishes on its three-rail surface.
 *
 * - `stateChanged` fires on every edge of the state machine.
 * - `controllerLost` fires once when the controller is concluded unreachable, carrying the fault that settled it.
 * - `controllerRebooted` fires when the controller's reported uptime falls far enough to read as a restart, carrying both readings.
 * - `controllerRecovered` fires when the connection returns to healthy after having been lost.
 * - `throttleEntered` and `throttleExited` forward the transport breaker's own transitions.
 *
 * @category Client
 */
export interface ConnectionEvents {

  controllerLost: [reason: AccessError];
  controllerRebooted: [info: { newUptime: number; previousUptime: number }];
  controllerRecovered: [];
  stateChanged: [transition: ConnectionTransition];
  throttleEntered: [];
  throttleExited: [];
}

/**
 * The transport surface the monitor depends on: the throttle verdict and the two throttle rails, and nothing else. Expressing it as a structural type rather than
 * as the concrete transport is what makes the narrow coupling a guarantee the compiler holds - the monitor cannot reach the request path or the breaker's
 * internals, because this type does not expose them. The real transport satisfies it structurally.
 *
 * @category Client
 */
export interface ThrottleSource {

  readonly isThrottled: boolean;
  on(event: "throttleEntered" | "throttleExited", handler: () => void): Disposable;
}

/**
 * Construction options for {@link ConnectionMonitor}. Every piece of I/O is an injected function the composition root supplies, mirroring how every other
 * subsystem in this library inverts its dependencies.
 *
 * - `eventStreamFactory` builds a notification stream. It is the single construction path, used for the initial stream and for every relaunch, and its optional
 *   signal binds only to the initial connect - a relaunch must not inherit a signal that may already have fired.
 * - `packetSink` and `rawPacketSink` receive what the live stream decodes; the composition root fans them into the store and the client's own rails.
 * - `reBootstrap` re-fetches the controller's documents and applies them, so recovery re-seeds state through the one path that owns that order.
 * - `refreshAdminStatus` re-checks the account's privilege after a successful relaunch. It is called and not awaited, so a slow or hanging check cannot hold
 *   recovery open.
 * - `verify` is the reachability probe.
 * - `store` is read only through its observation surface; `transport` is the narrow throttle source.
 * - `signal` cancels the initial connect.
 *
 * @category Client
 */
export interface ConnectionMonitorOptions {

  clock?: Clock;
  eventStreamFactory: (signal?: AbortSignal) => EventStream;
  log?: AccessLogging;
  packetSink: (event: AccessWireEvent) => void;
  rawPacketSink: (packet: AccessEventPacket) => void;
  reBootstrap: (signal?: AbortSignal) => Promise<void>;
  refreshAdminStatus: (signal?: AbortSignal) => Promise<Nullable<boolean>>;
  signal?: AbortSignal;
  store: StateStore;
  transport: ThrottleSource;
  verify: (signal?: AbortSignal) => Promise<void>;
}

/**
 * Owns the replaceable notification stream behind a stable surface, so the monitor subscribes once and never re-attaches across relaunches. It builds each inner
 * stream through the one injected factory, bridges that stream's packets to the injected sinks, and forwards its faults to the callback the monitor wired.
 *
 * Construction allocates nothing. The first socket is built by `open()`, which is what lets the guard around the composition root's connect cover every resource
 * the stream takes: a constructor that allocates I/O cannot be made exception-safe by the code that calls it.
 *
 * The bridges attach synchronously at build time, before anything awaits the open handshake, which preserves the property the composition root relies on: a
 * subscription in place before the socket can deliver anything. On relaunch the subscriptions are disposed *before* the old stream is torn down, so a dying
 * socket's late frames reach neither the monitor nor a consumer.
 *
 * It listens only for faults. The stream routes the faults of a stream that opened onto that rail - a stall, a socket error, and a peer dropping a live socket,
 * which is how a controller going down arrives - while a close the stream initiated itself, and any failure that lands before it opened, stay off it. So the
 * fault rail alone is the recovery signal.
 */
class ManagedEventStream implements AsyncDisposable {

  readonly #factory: (signal?: AbortSignal) => EventStream;
  readonly #onError: (error: AccessError) => void;
  readonly #packetSink: (event: AccessWireEvent) => void;
  readonly #rawPacketSink: (packet: AccessEventPacket) => void;

  // The current inner stream and the bridges into it. Both are replaced together on a relaunch, so they can never describe different sockets, and neither exists
  // until open() builds the first one.
  #stream: Nullable<EventStream> = null;
  #subscriptions: Disposable[] = [];

  constructor(options: {
    factory: (signal?: AbortSignal) => EventStream;
    onError: (error: AccessError) => void;
    packetSink: (event: AccessWireEvent) => void;
    rawPacketSink: (packet: AccessEventPacket) => void;
  }) {

    this.#factory = options.factory;
    this.#onError = options.onError;
    this.#packetSink = options.packetSink;
    this.#rawPacketSink = options.rawPacketSink;
  }

  /**
   * Build the first stream and wait for it to open. The caller's signal binds to this connect alone and is never carried into a relaunch, which must not inherit a
   * signal that may already have fired.
   */
  async open(signal?: AbortSignal): Promise<void> {

    const stream = this.#build(signal);

    this.#stream = stream;

    await stream.opened;
  }

  /**
   * Tear the current stream down and bring a fresh one up, then wait for it to open. There is no cursor to carry across: the controller offers no replay, so a
   * relaunched stream simply starts from now, and the re-bootstrap that precedes it is what covers whatever was missed.
   */
  async relaunch(): Promise<void> {

    await this.#teardown();

    const stream = this.#build();

    this.#stream = stream;

    await stream.opened;
  }

  /** Detach the bridges and tear the current stream down. Safe to call more than once, through the stream's own repeat-safe close. */
  async [Symbol.asyncDispose](): Promise<void> {

    await this.#teardown();
  }

  // Build one stream and attach the stable bridges synchronously, before the socket can deliver anything, tracking them so teardown can detach them first.
  #build(signal?: AbortSignal): EventStream {

    const stream = this.#factory(signal);

    this.#subscriptions = [ stream.on("packet", (event): void => this.#packetSink(event)),
      stream.on("rawPacket", (packet): void => this.#rawPacketSink(packet)), stream.on("error", (error): void => this.#onError(error)) ];

    return stream;
  }

  // Detach the bridges, then tear the stream down. Disposing the subscriptions first is what guarantees the close this triggers, and any frame still in flight,
  // reaches nobody. A teardown that runs before the first open finds no bridges to detach and no stream to close.
  async #teardown(): Promise<void> {

    for(const subscription of this.#subscriptions) {

      subscription[Symbol.dispose]();
    }

    this.#subscriptions = [];

    await this.#stream?.[Symbol.asyncDispose]();
  }
}

/**
 * The connection coordinator. Constructed by the client; consumers read it as `client.connection`.
 *
 * @category Client
 */
export class ConnectionMonitor {

  readonly #bus = new EventBus<ConnectionEvents>();
  readonly #clock: Clock;
  // The connect caller's signal, held for the open the composition root drives. It binds to that first connect alone, so a relaunch never inherits it.
  readonly #connectSignal: AbortSignal | undefined;
  // One AbortController for the monitor's lifetime. It ends the uptime-observation loop and any recovery wait; disposal aborts it.
  readonly #controller = new AbortController();
  readonly #log: AccessLogging;
  readonly #managed: ManagedEventStream;
  /* The initial handshake, held here as a deferred rather than delegated to the stream, because the stream that answers it does not exist until open() builds one.
   * A consumer may read `connection.opened` from the moment it holds a client, so the promise has to exist first and be settled by whichever arrives: the open, or
   * a disposal that means the open never will.
   */
  readonly #opened = Promise.withResolvers<undefined>();
  readonly #reBootstrap: (signal?: AbortSignal) => Promise<void>;
  readonly #refreshAdminStatus: (signal?: AbortSignal) => Promise<Nullable<boolean>>;
  readonly #store: StateStore;
  readonly #throttleSubscriptions: Disposable[];
  readonly #transport: ThrottleSource;
  readonly #verifyProbe: (signal?: AbortSignal) => Promise<void>;

  /* The state machine's own bookkeeping. The observable state is derived from the phase and the transport's live verdict rather than stored. `#lastFault` is the
   * most recent typed fault, which supplies a transition's reason and the lost announcement's payload. `#reportedState` caches the last announced value purely to
   * dedup. `#recovering` keeps a re-entrant fault from starting a second loop, and `#recoveryWake` is the handle that lets a detected restart interrupt a parked
   * wait. `#wasLost` records that an episode actually reached lost, so recovery is announced only after a genuine loss. `#lastUptime` is the restart detector's
   * baseline: seeded at construction from what the store already holds, updated on every yield, and dying with the monitor - there is no reset path because there
   * is no lifecycle event that would want one.
   */
  #lastFault: Nullable<AccessError> = null;
  #lastUptime: Nullable<number>;
  #phase: RecoveryPhase = "healthy";
  #recovering = false;
  #recoveryWake: Nullable<AbortController> = null;
  #reportedState: ConnectionState;
  #wasLost = false;

  constructor(options: ConnectionMonitorOptions) {

    this.#clock = options.clock ?? wallClock;
    this.#connectSignal = options.signal;
    this.#log = options.log ?? noopLog;
    this.#reBootstrap = options.reBootstrap;
    this.#refreshAdminStatus = options.refreshAdminStatus;
    this.#store = options.store;
    this.#transport = options.transport;
    this.#verifyProbe = options.verify;

    // Build the stream owner. Its sinks and its fault callback are wired once here and re-attached internally on every relaunch, so the monitor never does paired
    // attach-and-detach bookkeeping. The owner allocates nothing until open(), which is what keeps this constructor pure assembly.
    this.#managed = new ManagedEventStream({

      factory: options.eventStreamFactory,
      onError: (error: AccessError): void => this.#onStreamFault(error),
      packetSink: options.packetSink,
      rawPacketSink: options.rawPacketSink
    });

    /* Seed the restart baseline and the dedup baseline before the loops that use them start. Reading the uptime here rather than adopting the first observed value
     * is what closes the first-window blind spot: a controller that restarts between the connect fetch and the first refresh would otherwise have its drop adopted
     * as the baseline and go unreported.
     */
    this.#lastUptime = selectControllerUptime(this.#store.snapshot());
    this.#reportedState = this.#derive();

    // Fold the transport's throttle rails in: forward them on our own surface and recompute. The transport already logs its own breaker transitions, so they are
    // not logged again here.
    this.#throttleSubscriptions = [
      this.#transport.on("throttleEntered", (): void => this.#onThrottle(true)),
      this.#transport.on("throttleExited", (): void => this.#onThrottle(false))
    ];

    /* Mark the handshake as handled, so a consumer that never reads `opened` - which is every consumer that simply holds the client - cannot turn a failed open or
     * a disposal into a process-level unhandled rejection. A real reader still receives the rejection, because both handlers run.
     */
    void this.#opened.promise.catch(() => undefined);

    // Watch the controller's uptime for a restart. The loop runs detached for the monitor's lifetime; disposal ends it.
    void this.#watchRestarts();
  }

  /** The current connection state, derived live from the recovery phase and the transport's throttle verdict, so it can never drift from a separately stored value. */
  get state(): ConnectionState {

    return this.#derive();
  }

  /** Whether the connection is in steady operation. */
  get isHealthy(): boolean {

    return this.#derive() === "healthy";
  }

  /** Whether the transport's breaker is open. Delegated verbatim to the transport, which is the single source of truth for reachability backoff. */
  get isThrottled(): boolean {

    return this.#transport.isThrottled;
  }

  /**
   * The initial open handshake. `connect()` drives it through {@link ConnectionMonitor.open} and tears the client down if it fails, and a disposal that lands
   * before the channel ever opened settles this as a cancellation rather than leaving a reader parked on it.
   */
  get opened(): Promise<void> {

    return this.#opened.promise;
  }

  /**
   * Open the realtime notification channel. This is the composition root's call, made once inside the guard that owns teardown: everything the socket allocates is
   * built here rather than while the monitor is being assembled, so a failure always has an owner that can dispose it. Either outcome settles
   * {@link ConnectionMonitor.opened}.
   *
   * @throws {@link AccessAbortedError} if the connect signal cancels the handshake, or a transport-level `AccessError` when the socket cannot be opened.
   */
  async open(): Promise<void> {

    try {

      await this.#managed.open(this.#connectSignal);

      this.#opened.resolve(undefined);
    } catch(error) {

      this.#opened.reject(error);

      throw error;
    }
  }

  /**
   * Subscribe to a connection event. Returns a `Disposable`; prefer `using sub = connection.on(...)` so the listener detaches at scope exit.
   *
   * @param event   - The event to listen for.
   * @param handler - Invoked on each emission.
   *
   * @returns A `Disposable` that removes the listener when disposed.
   */
  on<K extends keyof ConnectionEvents>(event: K, handler: (...args: ConnectionEvents[K]) => void): Disposable {

    return this.#bus.on(event, handler);
  }

  /**
   * Wait for the next emission of a connection event.
   *
   * @param event - The event to await.
   * @param opts  - Optional abort signal.
   *
   * @returns A promise resolving to the event's argument tuple.
   */
  async once<K extends keyof ConnectionEvents>(event: K, opts: { signal?: AbortSignal } = {}): Promise<ConnectionEvents[K]> {

    return this.#bus.once(event, opts);
  }

  /**
   * Stream every subsequent emission of a connection event until the signal aborts.
   *
   * @param event - The event to stream.
   * @param opts  - Stream options, including the abort signal.
   *
   * @returns An async iterable of the event's argument tuples.
   */
  stream<K extends keyof ConnectionEvents>(event: K, opts: StreamOptions = {}): AsyncIterable<ConnectionEvents[K]> {

    return this.#bus.stream(event, opts);
  }

  /**
   * Observe the state machine: every transition until the signal aborts. Sugar over the `stateChanged` rail that unwraps the single-element tuple and ends quietly
   * on the caller's own abort.
   *
   * @param opts - Optional abort signal that terminates the iteration.
   *
   * @returns An async iterable of state transitions.
   */
  async *observe(opts: { signal?: AbortSignal } = {}): AsyncGenerator<ConnectionTransition> {

    try {

      for await (const [transition] of this.#bus.stream("stateChanged", opts)) {

        yield transition;
      }
    } catch(error) {

      if(opts.signal?.aborted === true) {

        return;
      }

      throw error;
    }
  }

  /**
   * Probe the controller's reachability on demand. Resolves when it answers and throws the classified error otherwise - the same probe the recovery loop uses,
   * exposed so a consumer can ask the question itself.
   *
   * @param opts - Optional abort signal.
   *
   * @throws The classified `FatalError` on a non-2xx, or a transport-level `AccessError` when the controller cannot be reached.
   */
  async verify(opts: { signal?: AbortSignal } = {}): Promise<void> {

    await this.#verifyProbe(opts.signal);
  }

  /**
   * Dispose the monitor: end the uptime-observation loop and any recovery wait, release the initial handshake, detach the throttle subscriptions, and tear the
   * notification stream down. Safe to call more than once.
   */
  async [Symbol.asyncDispose](): Promise<void> {

    this.#controller.abort();

    /* Release anyone parked on the handshake. A disposal before the channel opened means the open is never coming, so the promise settles as the cancellation it
     * is rather than staying pending for the life of the process; a handshake that already settled keeps its own answer, because a settled deferred ignores this.
     */
    this.#opened.reject(new AccessAbortedError("The UniFi Access connection was disposed before its realtime notification channel opened."));

    for(const subscription of this.#throttleSubscriptions) {

      subscription[Symbol.dispose]();
    }

    await this.#managed[Symbol.asyncDispose]();
  }

  // The one derivation of the observable state. The throttle verdict surfaces only while the recovery phase is healthy - that is, while the breaker is the only
  // thing wrong - so it is read straight from the transport rather than mirrored into a field. Once recovery is underway the phase wins, because the monitor rather
  // than the breaker owns re-probing then, and "lost" is a more actionable answer than "cooling down". The precedence follows the ownership boundary exactly.
  #derive(): ConnectionState {

    return (this.#transport.isThrottled && (this.#phase === "healthy")) ? "throttled" : this.#phase;
  }

  // Recompute and announce when the answer changed. The one place a transition is emitted, so the rail and the diagnostic can never disagree.
  #recompute(): void {

    const next = this.#derive();

    if(next === this.#reportedState) {

      return;
    }

    const from = this.#reportedState;

    this.#reportedState = next;
    this.#bus.emit("stateChanged", { from, to: next, ...((this.#lastFault !== null) && { reason: formatErrorChain(this.#lastFault) }) });
  }

  // Move to a phase and recompute. Entering `lost` goes through its own path instead, so the announcement fires once per episode.
  #enterPhase(phase: RecoveryPhase): void {

    this.#phase = phase;
    this.#recompute();
  }

  // Conclude the controller is unreachable, announcing it on the edge into lost rather than on every failed poll, and marking the episode so a later return to
  // healthy is announced as a recovery.
  #enterLost(reason: AccessError): void {

    const announce = this.#phase !== "lost";

    this.#lastFault = reason;
    this.#phase = "lost";
    this.#wasLost = true;
    this.#recompute();

    if(announce) {

      this.#log.warn("The UniFi Access controller appears to be unreachable; the connection is lost and recovery is polling for its return.",
        { reason: formatErrorChain(reason) });
      this.#bus.emit("controllerLost", reason);
    }
  }

  // A throttle rail fired. Forward it and recompute, which is where the derived state starts or stops reflecting it.
  #onThrottle(entered: boolean): void {

    this.#bus.emit(entered ? "throttleEntered" : "throttleExited");
    this.#recompute();
  }

  // The notification channel faulted. Record it, mark the connection degraded if this is the first sign of trouble, and kick recovery. A close the stream itself
  // initiated raises nothing here, so this runs only for genuine faults.
  #onStreamFault(error: AccessError): void {

    this.#lastFault = error;
    this.#log.debug("The UniFi Access realtime notification channel faulted; beginning recovery.", { reason: formatErrorChain(error) });

    if(this.#phase === "healthy") {

      this.#enterPhase("degraded");
    }

    void this.#recover();
  }

  /* The guarded recovery loop: one schedule, walked out to a steady floor it then polls at for as long as the monitor lives.
   *
   * The delay generator yields the wait before each attempt - the staged prefix, then the floor forever - so the loop itself is just "wait, then attempt". A wait
   * ends when it elapses and the attempt runs on schedule, when a detected restart wakes it so the attempt runs now rather than sleeping out a backoff that a
   * returned controller has made pointless, or when disposal aborts it and the loop ends. Recovery therefore keeps polling a slow-to-return controller
   * indefinitely rather than giving up after a handful of tries. The guard makes a re-entrant fault a no-op, so one episode runs one loop.
   */
  async #recover(): Promise<void> {

    if(this.#recovering) {

      return;
    }

    this.#recovering = true;

    try {

      for(const delay of backoffDelays()) {

        /* Park on the next delay, but make the wait interruptible by a wake that is distinct from disposal: the monitor's lifetime signal and a per-iteration wake
         * are composed, so disposal aborts the first and a detected restart the second. The composite is rebuilt per iteration and held weakly by the platform, so
         * these are reclaimed rather than accumulating. Sequential by design - each attempt must finish before the next is scheduled.
         */
        const wake = new AbortController();

        this.#recoveryWake = wake;

        try {

          // eslint-disable-next-line no-await-in-loop
          await this.#clock.delay(delay, { signal: AbortSignal.any([ this.#controller.signal, wake.signal ]) });
        } catch {

          // The delay aborted. Disposal means we are done; anything else is the wake, so we fall through and attempt now.
          if(this.#controller.signal.aborted) {

            return;
          }
        } finally {

          this.#recoveryWake = null;
        }

        // eslint-disable-next-line no-await-in-loop
        if(await this.#attemptRecovery()) {

          return;
        }
      }
    } catch {

      /* A genuine backstop rather than dead code. The attempt's own failure path announces on the event bus, and a consumer's synchronous listener that throws
       * would propagate back to here; swallowing it keeps this detached loop from surfacing as an unhandled rejection. The wait's own abort is handled inside the
       * loop, so this does not fire on disposal.
       */
    } finally {

      this.#recovering = false;
    }
  }

  // Wake a parked recovery wait so its next attempt runs at once. A no-op when recovery is not parked - between attempts, or not recovering at all.
  #wakeRecovery(): void {

    this.#recoveryWake?.abort();
  }

  /* One recovery attempt: probe, re-bootstrap, relaunch. The probe and the re-bootstrap both dispatch as recovery trials, so they go out at this loop's cadence
   * rather than waiting out the breaker's cooldown - which is what makes this loop the single owner of how often a recovering client touches the controller.
   *
   * The privilege re-check is issued and deliberately not awaited. A reconnect is the moment an account's rights may have changed, so it is worth asking, but the
   * answer gates nothing: recovery is complete when the channel is live, and awaiting a check that a struggling controller may never answer would hold the
   * connection in `reconnecting` for no reason. It carries the monitor's lifetime signal so a check still in flight at disposal is released; it does not need to
   * carry one for correctness, because the session refuses to write a verdict that no longer describes it.
   */
  async #attemptRecovery(): Promise<boolean> {

    try {

      await this.#verifyProbe(this.#controller.signal);

      this.#enterPhase("reconnecting");
      this.#log.info("Reconnecting to the UniFi Access realtime notification channel.");

      await this.#reBootstrap(this.#controller.signal);
      await this.#managed.relaunch();

      void this.#refreshAdminStatusInBackground(this.#controller.signal);

      this.#onRecovered();

      return true;
    } catch(error) {

      const fault = (error instanceof AccessError) ? error :
        new AccessNetworkError("Recovery of the connection to the UniFi Access controller failed.", { cause: error });

      /* The attempt failed. Disposal means we are done: an attempt the monitor's own abort cut short learned nothing about the controller, so concluding it
       * unreachable would announce a loss that did not happen and warn about a client that is being torn down. Anything else is a real failure and drops to lost.
       */
      if(this.#controller.signal.aborted) {

        this.#log.debug("Recovery of the connection to the UniFi Access controller ended with its disposal.", { reason: formatErrorChain(fault) });

        return false;
      }

      this.#enterLost(fault);

      return false;
    }
  }

  /* The privilege re-check, run detached so a slow or hanging check cannot hold recovery open. The only cancellation it can be handed is the monitor's own, so a
   * disposal landing mid-check is this task ending on schedule rather than a failure to report. The injected check absorbs every other refusal itself - a
   * controller it could not reach leaves the previous verdict standing - so anything arriving here that is not a cancellation means that contract broke, which
   * earns a debug line and nothing more, because the answer gates nothing. Either way the task settles here rather than surfacing as an unhandled rejection.
   */
  async #refreshAdminStatusInBackground(signal: AbortSignal): Promise<void> {

    try {

      await this.#refreshAdminStatus(signal);
    } catch(error) {

      if(error instanceof AccessAbortedError) {

        return;
      }

      this.#log.debug("The UniFi Access administrative privilege re-check ended in a failure the session was expected to absorb.", error);
    }
  }

  // Recovery completed. Clear the fault, return to healthy, and announce a recovery only when the episode had actually reached lost - a transient stall that
  // re-bootstrapped without the controller ever going unreachable does not warrant one. The transient case still confirms itself at the stream level, so each
  // recovery logs exactly one closing line and the cases cannot both fire.
  #onRecovered(): void {

    const recovered = this.#wasLost;

    this.#lastFault = null;
    this.#wasLost = false;
    this.#enterPhase("healthy");

    if(recovered) {

      this.#log.info("Recovered the connection to the UniFi Access controller.");
      this.#bus.emit("controllerRecovered");

      return;
    }

    this.#log.info("Reconnected the UniFi Access realtime notification channel.");
  }

  /* Watch the controller's reported uptime for a restart.
   *
   * The reading is the controller's own and is not a clock. Across a long horizon it tracks elapsed time, and a restart returns it to near zero; across a short one
   * the controller can serve the identical value twice, so flatness proves nothing either way. What a restart does produce is a large *decrease* - the whole of the
   * prior uptime, which is days on any controller that has been up - so a decrease past the floor is the signal, and anything smaller is treated as skew from a
   * mechanism whose magnitude was never bounded by observation.
   *
   * This is graded best-effort diagnostics, and nothing correctness-bearing depends on it. It produces an informational line, an event, and a wake for a parked
   * recovery wait. A missed restart costs the line and the event, because the recovery loop is already polling on its own cadence during any real outage; a false one
   * costs one wrong line, one event, and one early probe that finds a healthy controller.
   */
  async #watchRestarts(): Promise<void> {

    try {

      for await (const uptime of this.#store.observe(selectControllerUptime, { signal: this.#controller.signal })) {

        const previousUptime = this.#lastUptime;

        this.#lastUptime = uptime;

        if((previousUptime === null) || (uptime === null) || ((previousUptime - uptime) <= ACCESS_REBOOT_UPTIME_DROP_MINIMUM)) {

          continue;
        }

        this.#log.info("The UniFi Access controller appears to have restarted.");

        // A detected restart proves the controller is answering again, because this reading came back on a successful fetch. Wake any parked recovery so it relaunches
        // now rather than sleeping out a backoff, and wake before announcing so a slow or throwing listener cannot cost us the wake.
        this.#wakeRecovery();
        this.#bus.emit("controllerRebooted", { newUptime: uptime, previousUptime });
      }
    } catch {

      // The observation ends on abort when the monitor is disposed. That is the loop's normal end rather than an error.
    }
  }
}

// The wait before each successive recovery attempt: the staged prefix, then the steady floor forever. The unbounded tail is what makes recovery poll indefinitely -
// the loop ends on success or disposal, never by running out of schedule.
function *backoffDelays(): Generator<number> {

  yield* ACCESS_RECOVERY_BACKOFF_MS;

  for(;;) {

    yield ACCESS_RECOVERY_STEADY_INTERVAL_MS;
  }
}

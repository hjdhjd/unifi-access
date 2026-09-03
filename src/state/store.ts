/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * store.ts: The observable state store - snapshot, observe, the single dispatch chokepoint, and the periodic bootstrap-refresh failsafe.
 */

/**
 * The observable heart of the library. {@link StateStore} holds exactly one {@link AccessState} reference and advances it through a single chokepoint
 * ({@link StateStore.dispatch}), which folds an {@link AccessTypedEvent} through the pure reducer. It is a *generic* state engine over `AccessState`: it deals only
 * in configuration records and imports nothing above the protocol tier, so it is unit-testable without a single mock.
 *
 * Two read shapes sit over the one source of truth:
 *
 * - {@link StateStore.snapshot} returns the current state synchronously - the hot-path read.
 * - {@link StateStore.observe} returns an `AsyncIterable` of a selector's output that yields only when the selected value *changes* by reference. Because the reducer
 *   preserves references through structural sharing and the selectors memoize on map identity, an `Object.is` comparison is a correct and nearly free change test.
 *
 * The store also owns the **refresh failsafe**: on a fixed cadence (default {@link ACCESS_BOOTSTRAP_REFRESH_INTERVAL}) it invokes the injected `refresh` callback,
 * which re-seeds the store from whatever the composition root seeded it from. The loop assumes nothing about what a refresh is - the callback reads what its mode
 * can reach and applies it through the store's own methods - so one mechanism serves a client re-fetching its document pair and a client re-reading the official
 * API's listings alike. The reducer's reconciliation makes a refresh that finds no drift produce no observer notifications at all, so the failsafe is invisible
 * until something has actually changed. Taking a callback rather than a transport reference keeps the store at the data layer, where it performs no I/O of its own
 * and is testable with a fake refresh and a fake `Clock`. The mechanism lives here, beside the chokepoint it feeds; the policy of what that callback does, and how
 * it interacts with connection recovery, belongs to the layer that composes the store.
 *
 * @module AccessStateStore
 */
import type { AccessBootstrapConfig, AccessControllerConfig, AccessDoorStateEntry, Nullable } from "../types/index.ts";
import type { AccessState, AccessStateDevice, AccessStateDoor } from "../protocol/reducer.ts";
import { createInitialState, reduce } from "../protocol/reducer.ts";
import { ACCESS_BOOTSTRAP_REFRESH_INTERVAL } from "../settings.ts";
import type { AccessLogging } from "../logging.ts";
import type { AccessTypedEvent } from "../protocol/events.ts";
import type { Clock } from "../clock.ts";
import { noopLog } from "../logging.ts";
import { wallClock } from "../clock.ts";

/**
 * The pair of documents one refresh pass carries. The controller describes itself in two independent documents - a topology document naming its floors, doors, and
 * hardware, and an information document naming the controller and the host it runs on - so a refresh that fetched only one would leave the other to go stale.
 *
 * `controller` is nullable so that a composition root may refresh the topology alone, which is what a caller that has no use for the controller document does
 * rather than fetching one and discarding it.
 *
 * @category State
 */
export interface AccessRefreshDocuments {

  controller: Nullable<AccessControllerConfig>;
  topology: AccessBootstrapConfig;
}

/**
 * What one pass over the official API's listings established: the device records, the door records, and the door-state facts those same doors carried.
 *
 * The three travel together because they are one reading of the controller rather than three, and applying them as one dispatch is what keeps an observer of the
 * hubs from waking before the door state a hub reads has landed.
 *
 * @category State
 */
export interface AccessCensus {

  devices: readonly AccessStateDevice[];
  doorStates: readonly AccessDoorStateEntry[];
  doors: readonly AccessStateDoor[];
}

/**
 * Construction options for {@link StateStore}.
 *
 * - `refresh` is the callback the failsafe invokes to re-seed the store from whatever the composition root seeded it from. It reads what its mode can reach and
 *   applies it through the store's own methods, exactly as the composition root's recovery closure does, so the order a document pair is applied in stays owned by
 *   the store's own `applyRefreshDocuments` and the loop assumes nothing about what a refresh is. A composition root wires it to a transport request and a test
 *   wires a fake. Injecting a function rather than a transport is what keeps the store at the data layer and deterministically testable. Omitting it says there is
 *   no source to re-seed from: the failsafe then does not exist rather than existing with nothing to call. It receives the loop's own lifetime signal, so a read
 *   still in flight when the store is disposed is released rather than running on past the store that asked for it.
 * - `refreshIntervalMs` defaults to {@link ACCESS_BOOTSTRAP_REFRESH_INTERVAL}. Passing `false` or a non-positive interval disables the failsafe outright, leaving
 *   the consumer to rely on the realtime notification channel alone.
 * - `onDispatch` observes each event that actually advanced the state. It is composition wiring rather than a consumer-facing surface: the store is deliberately
 *   host-agnostic, so it cannot itself publish the host-attributed diagnostic a consumer subscribes to, and the composition root that does know the host wires this
 *   to that publisher. It follows the same injected-function shape the transport's own auth hooks use.
 *
 * @category State
 */
export interface StateStoreOptions {

  clock?: Clock;
  initialState?: AccessState;
  log?: AccessLogging;
  onDispatch?: (event: AccessTypedEvent) => void;
  refresh?: (signal?: AbortSignal) => Promise<void>;
  refreshIntervalMs?: number | false;
}

/**
 * One consumer's live view of a selector over the store. Created lazily when iteration begins, so an `observe()` that is never iterated registers nothing and leaks
 * nothing, and torn down when iteration ends. The store calls {@link StateObserver.evaluate} on every state change; the observer re-runs its selector and enqueues a
 * value only when the result differs by reference from the last one it yielded.
 *
 * The queue is deliberately unbounded, matching the library-wide subscription rule: a slow consumer accumulates pending values rather than having them dropped
 * underneath it. The accepted trade-off is memory - a consumer that registers an observer and then stops iterating grows its queue for as long as state keeps
 * changing - and it is accepted because dropping a state change silently is the worse failure, and because state changes do not arrive in the bursts a media stream
 * does, so the queue stays short whenever a consumer iterates at all.
 */
class StateObserver<T> {

  // The pending values waiting to be yielded, and the resolver of the promise the iterator is currently parked on (null when the iterator is actively draining
  // rather than waiting). `#closed` ends the iteration once the queue has drained.
  #closed = false;
  #lastYielded: T;
  #queue: T[] = [];
  readonly #selector: (state: AccessState) => T;
  #wake: (() => void) | null = null;

  constructor(selector: (state: AccessState) => T, initialState: AccessState) {

    this.#selector = selector;

    // Seed the baseline from the state at iteration time, so the observer yields on the first *subsequent* change rather than re-emitting the current value, which
    // the consumer already has through snapshot(). This is the "yields when X changes" contract.
    this.#lastYielded = selector(initialState);
  }

  // Called by the store on every committed state change. Re-run the selector against the new state, and enqueue - waking any parked iterator - only when the derived
  // value is a different reference than the one last yielded.
  evaluate(state: AccessState): void {

    const next = this.#selector(state);

    if(Object.is(next, this.#lastYielded)) {

      return;
    }

    this.#lastYielded = next;
    this.#queue.push(next);
    this.#signal();
  }

  // Terminate the iteration. The iterator drains whatever is already queued, then returns.
  close(): void {

    this.#closed = true;
    this.#signal();
  }

  // The async iteration itself. Drains the queue in batches, swapping in a fresh array so values arriving mid-yield are picked up on the next pass, then parks on a
  // `Promise.withResolvers()` until the next `evaluate` or `close` wakes it. No timers, no EventEmitter, no listener bookkeeping.
  async *iterate(): AsyncGenerator<T> {

    for(;;) {

      if(this.#queue.length > 0) {

        const batch = this.#queue;

        this.#queue = [];

        for(const value of batch) {

          yield value;
        }

        continue;
      }

      if(this.#closed) {

        return;
      }

      const { promise, resolve } = Promise.withResolvers<undefined>();

      // The wake is a zero-argument signal; closing over the resolver means the queue-side `#signal` never needs to know the gate carries an (ignored) value.
      this.#wake = (): void => resolve(undefined);

      // Parking on the next signal is the whole point of this loop - the await is intentional and sequential, not an accidental serialization of independent work.
      // eslint-disable-next-line no-await-in-loop
      await promise;
    }
  }

  // Wake a parked iterator exactly once. A no-op when the iterator is mid-drain, with no resolver registered, because it re-checks the queue on its next pass anyway.
  #signal(): void {

    const wake = this.#wake;

    this.#wake = null;
    wake?.();
  }
}

/**
 * The canonical state holder. See the module documentation for the model. The composition root constructs it and consumers read it; {@link createStateStore} is the
 * one documented exception, the factory a test harness uses to drive the real engine standalone.
 *
 * @category State
 */
export class StateStore implements AsyncDisposable {

  readonly #clock: Clock;
  // Set by disposal and never cleared. The store is disposed once, at the end of its life, so this is a terminal condition rather than a mode: it is what lets the
  // dispatch chokepoint and observe() refuse work for a store whose teardown has already run.
  #disposed = false;
  readonly #log: AccessLogging;
  readonly #observers = new Set<StateObserver<unknown>>();
  // The composition root's dispatch observer, bound at construction and never replaced. There is no reset path because there is no lifecycle event that would want
  // one: the hook belongs to the root that built this store, and the terminal disposal guard in dispatch is what ends it.
  readonly #onDispatch: ((event: AccessTypedEvent) => void) | undefined;
  // One AbortController for the refresh loop's lifetime, aborted on disposal - the library's "one AbortController per resource lifetime" rule.
  readonly #refreshController = new AbortController();
  readonly #refresh: ((signal?: AbortSignal) => Promise<void>) | undefined;
  #state: AccessState;

  constructor(options: StateStoreOptions) {

    this.#clock = options.clock ?? wallClock;
    this.#log = options.log ?? noopLog;
    this.#onDispatch = options.onDispatch;
    this.#refresh = options.refresh;
    this.#state = options.initialState ?? createInitialState();

    // Start the failsafe unless there is nothing to refresh from, or it was explicitly disabled, or it was given a non-positive interval. The loop runs detached
    // for the store's lifetime; disposal aborts it.
    const intervalMs = options.refreshIntervalMs ?? ACCESS_BOOTSTRAP_REFRESH_INTERVAL;

    if((this.#refresh !== undefined) && (intervalMs !== false) && (intervalMs > 0)) {

      void this.#runRefreshLoop(intervalMs, this.#refresh);
    }
  }

  /**
   * The current state. Synchronous and reference-stable between dispatches - safe to read on a hot path and to compare with `Object.is`.
   *
   * @returns The current {@link AccessState}.
   */
  snapshot(): AccessState {

    return this.#state;
  }

  /**
   * Observe a selector over the state. The returned async iterable yields the selector's output once at every point the value *changes* by reference, and never on a
   * dispatch that left the value unchanged. Pair it with {@link StateStore.snapshot} for the current value: snapshot for "what is it now", observe for "tell me when
   * it changes".
   *
   * Termination: pass `opts.signal` to end the iteration - the iterator returns cleanly on abort - or simply `break` out of the `for await`. Either path
   * unregisters the observer. An already-aborted signal yields nothing, and so does an observation begun on a disposed store.
   *
   * @typeParam T - The selector's output type.
   *
   * @param selector - A pure function from state to the value of interest. Use the memoized selectors in `state/selectors.ts` so unchanged collections compare equal.
   * @param opts     - Optional abort signal that terminates the iteration.
   *
   * @returns An async iterable of the selector's value at each change.
   */
  async *observe<T>(selector: (state: AccessState) => T, opts: { signal?: AbortSignal } = {}): AsyncGenerator<T> {

    const signal = opts.signal;

    // Nothing to observe if the caller handed us an already-aborted signal.
    if(signal?.aborted) {

      return;
    }

    /* A disposed store notifies nobody ever again, so registering here would hand the caller an iterator that can never yield and never end, parking its consumer
     * forever. Completing immediately is the honest answer: the observation is over before it began, which is exactly what an observation of a torn-down store is.
     */
    if(this.#disposed) {

      return;
    }

    // An async-generator method's body runs only when iteration begins, so registration is lazy - an un-iterated observe registers nothing and leaks nothing - and it
    // reads the current state for its baseline at that moment. It is race-free because dispatch only ever enqueues to observers already in the set.
    const observer = new StateObserver<T>(selector, this.#state);
    const onAbort = (): void => observer.close();

    this.#observers.add(observer);
    signal?.addEventListener("abort", onAbort, { once: true });

    try {

      yield* observer.iterate();
    } finally {

      this.#observers.delete(observer);
      signal?.removeEventListener("abort", onAbort);
    }
  }

  /**
   * Advance the state by one event. The single mutation chokepoint: it folds the event through the pure reducer and, only when the resulting state is a *different*
   * reference, commits it and notifies every active observer. An event the reducer returns unchanged notifies nobody.
   *
   * Package-internal: the realtime notification stream, the refresh failsafe, and the client's initial bootstrap call it. It is not a consumer-facing surface.
   *
   * @param event - The typed event to apply.
   *
   * @internal
   */
  dispatch(event: AccessTypedEvent): void {

    /* Disposal is terminal, and this is the one place every caller passes through - the realtime stream, the failsafe, and the composition root alike - so guarding
     * here covers them all, including a refresh already in flight when disposal ran and settling afterward.
     */
    if(this.#disposed) {

      return;
    }

    const next = reduce(this.#state, event);

    /* The reducer returns the same reference for anything that changed nothing: a no-op patch, an activity signal, or a refreshed topology document that reconciled
     * to zero drift. This gate skips waking observers for all of them, and the drift-free refresh is the case worth naming, because the reducer hands back the state
     * object itself when a fresh document matched what was already stored. Absorbing that here, before any observer runs, sits above the per-observer `Object.is`
     * dedup in StateObserver.evaluate rather than replacing it: the two layers are independent, and the observer layer is still what suppresses a real state change
     * whose selected value happens to be unchanged.
     */
    if(Object.is(next, this.#state)) {

      return;
    }

    this.#state = next;

    /* The dispatch observer runs on committed events only, which is what makes it a measure of state flow rather than of traffic. Its errors are deliberately not
     * caught: the publisher a composition root wires here returns normally even when a subscriber throws, so a throw reaching this point would be a defect in the
     * wiring rather than a subscriber's ordinary misbehavior, and swallowing it would hide exactly the case worth seeing.
     */
    this.#onDispatch?.(event);

    for(const observer of this.#observers) {

      observer.evaluate(next);
    }
  }

  /**
   * Apply one refresh pass's pair of documents, in the order the store owns.
   *
   * The controller document is dispatched before the topology, so an observer watching the controller - the reboot detection above all - sees the fresh host
   * information before the topology reconciliation's own notifications land. Every caller goes through this one method rather than replicating that order: the
   * periodic failsafe here, and the composition root's connect seeding and recovery re-bootstrap.
   *
   * A pair carrying no controller document dispatches the topology alone, which is how a caller that refreshed only the topology says so.
   *
   * Package-internal, like {@link StateStore.dispatch}.
   *
   * @param documents - The pair one refresh pass fetched.
   *
   * @internal
   */
  applyRefreshDocuments(documents: AccessRefreshDocuments): void {

    if(documents.controller !== null) {

      this.dispatch({ data: documents.controller, kind: "controllerChanged" });
    }

    this.dispatch({ data: documents.topology, kind: "bootstrapLoaded" });
  }

  /**
   * Apply facts about doors read from a source that answers only part of what a door-state report carries.
   *
   * The official API's door list is that source: it reports each door's position and lock without the wiring and availability members a hub's own report carries.
   * Applying it through the same dispatch chokepoint as everything else is what keeps the store's one-way-in rule intact, and the reducer is where the merge
   * discipline lives - supplied members win, held members survive, and nothing is dropped for going unmentioned.
   *
   * `complete` says the entries are every door the source knows of, which is the only thing that licenses removing the ones it did not name. Pass it for a read that
   * enumerates; leave it off for one that speaks about a subset. An enumeration of no doors removes nothing either way.
   *
   * Package-internal, like {@link StateStore.dispatch}.
   *
   * @param entries - What the source established about each door, keyed by the door's own identity.
   * @param opts    - Whether the entries are a complete enumeration of the source's doors.
   *
   * @internal
   */
  applyDoorStateFacts(entries: readonly AccessDoorStateEntry[], opts: { complete?: boolean } = {}): void {

    this.dispatch({ complete: opts.complete === true, entries, kind: "doorStateFactsApplied" });
  }

  /**
   * Apply one census from the official API's listings: the device records, the door records, and the door-state facts one pass read, in one dispatch.
   *
   * A client with no topology seeds from this and re-seeds from it on recovery and on the refresh interval. The three collections travel together so an observer of
   * the hubs never wakes before the door state a hub reads has landed; the reducer is where the merge, admission, and removal discipline lives. `complete` carries
   * the same license it carries for the door facts, per collection.
   *
   * Package-internal, like {@link StateStore.dispatch}.
   *
   * @param census - What the listings established.
   * @param opts   - Whether the census is a complete enumeration of what the source knows of.
   *
   * @internal
   */
  applyCensus(census: AccessCensus, opts: { complete?: boolean } = {}): void {

    this.dispatch({ complete: opts.complete === true, ...census, kind: "censusApplied" });
  }

  /**
   * Stop the refresh failsafe and terminate every open observer. Safe to call more than once. After it resolves the store is inert: nothing dispatches, nothing is
   * notified, and a later observation completes immediately rather than registering.
   */
  async [Symbol.asyncDispose](): Promise<void> {

    this.#disposed = true;
    this.#refreshController.abort();

    for(const observer of this.#observers) {

      observer.close();
    }

    this.#observers.clear();
  }

  // The refresh failsafe. Ticks on the injected clock, and each tick invokes the callback, which reads and applies whatever its mode re-seeds from. A failure is not
  // fatal: the failsafe simply retries on the next tick, so a transient controller hiccup never tears the loop down, and escalating a sustained failure into a
  // health verdict belongs to the layer that owns connection policy rather than here. The loop ends only when disposal aborts the controller, which surfaces as the
  // interval iterator throwing its abort error - the normal shutdown path, swallowed here.
  async #runRefreshLoop(intervalMs: number, refresh: (signal?: AbortSignal) => Promise<void>): Promise<void> {

    try {

      for await (const _tick of this.#clock.setInterval(intervalMs, { signal: this.#refreshController.signal })) {

        try {

          // Sequential by design: one refresh per interval, each completing before the next tick is honored.

          await refresh(this.#refreshController.signal);
        } catch(error) {

          /* A failure at disposal is the shutdown path rather than a refresh that went wrong: the signal the read carries fires as the store is torn down, so the
           * read rejects on its way out. Saying it will be retried on the next interval would promise an interval the disposal has already ended, and the loop's
           * own exit below is where that path is accounted for.
           */
          if(!this.#refreshController.signal.aborted) {

            this.#log.debug("Bootstrap refresh failed; retrying on the next interval.", error);
          }
        }
      }
    } catch {

      // The interval iterator throws on abort when the store is disposed. That is the expected end of the loop, not an error.
    }
  }
}

/**
 * Construct a {@link StateStore} directly - the single documented exception to the package's export law, which otherwise keeps the store off the public surface so a
 * consumer has exactly one composition path. This factory exists for the test harnesses that need the real reducer and observer engine standalone: a consumer
 * driving the genuine store never has to hand-mirror its dispatch, dedup, and refresh semantics in a double.
 *
 * @param options - The store options, every one of them optional: the refresh callback, the clock, the initial state, the logger, the dispatch observer, and the
 *   refresh interval.
 *
 * @returns A new state store.
 *
 * @category State
 */
export function createStateStore(options: StateStoreOptions): StateStore {

  return new StateStore(options);
}

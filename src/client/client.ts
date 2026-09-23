/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * client.ts: AccessClient - the consumer-facing composition root and its atomic connect() factory.
 */

/**
 * The consumer-facing entry point and composition root. {@link AccessClient.connect} is the one way in: it authenticates, fetches what the supplied identities can
 * reach, seeds the state model, and brings the realtime channel up as a single operation that either returns a ready client or throws. There is no half-built
 * state - a failure at any stage tears down what was built before the error propagates.
 *
 * A controller answers to two APIs, and a client connects with the identities for either or both. Credentials reach the Access application's own endpoints, which
 * serve the topology document; a bearer token reaches the published API, whose own listings are the census a client with no credentials builds its inventory from.
 * Either way the device projections read one record shape. What a client can do follows from what it holds, and it says so at `capabilities` rather than leaving a
 * consumer to infer it.
 *
 * The client *composes* its subsystems rather than inheriting from any of them. It owns the transports, the sessions, the state store, the device registry, the
 * routing service, the connection monitor, and a private event bus, and presents a deliberately small surface over them:
 *
 * - `state` is the data layer: a synchronous snapshot and a live observation over the reduced controller state.
 * - The device accessors are the projection layer: live handles the registry builds. They live on the client rather than on `state` because a projection needs the
 *   client's routing decision and its transport, while the store stays a generic engine that knows nothing about devices.
 * - `official` is the published API's facade, and `capabilities` is what this client can reach.
 * - `transport` is the documented escape hatch for calls the typed surface does not cover.
 * - `on`, `once`, and `stream` are the event surface, with the realtime firehose carried on the packet rail.
 *
 * @module AccessClient
 */
import { AccessAbortedError, AccessApiError, AccessBootstrapError, AccessCapabilityError, isPrivilegeRefusal } from "../errors.ts";
import type { AccessApiMode, AccessApiOverride, AccessCapabilities } from "./routing.ts";
import type { AccessBootstrapConfig, AccessControllerConfig, AccessDoorStateEntry, AccessEventPacket, Nullable } from "../types/index.ts";
import type { AccessConnectionTransitionPayload, AccessStoreDispatchPayload } from "../diagnostics.ts";
import type { AccessTypedEvent, AccessWireEvent } from "../protocol/events.ts";
import type { ConnectionTransition, ThrottleSource } from "./connection.ts";
import { doorStateEntry, officialDeviceRecord, officialDoorRecord } from "./census.ts";
import { officialEndpoint, officialHost, officialNotificationUrl } from "../official/endpoints.ts";
import { selectController, selectControllerName, selectDoorStates } from "../state/selectors.ts";
import { ACCESS_API_PATH_PREFIX } from "../settings.ts";
import type { AccessDevice } from "../devices/device.ts";
import type { AccessDeviceContext } from "../devices/context.ts";
import { AccessDeviceRegistry } from "../devices/registry.ts";
import type { AccessHub } from "../devices/hub.ts";
import type { AccessLogging } from "../logging.ts";
import type { AccessRefreshDocuments } from "../state/store.ts";
import { AccessRoutingService } from "./routing.ts";
import type { AccessStateDevice } from "../protocol/reducer.ts";
import type { AccessWebSocket } from "../transport/ws.ts";
import { AuthSession } from "../transport/auth.ts";
import type { Clock } from "../clock.ts";
import { ConnectionMonitor } from "./connection.ts";
import type { Dispatcher } from "undici";
import { EventBus } from "../event-bus.ts";
import { EventStream } from "../transport/events-stream.ts";
import { OfficialApi } from "../official/api.ts";
import { StateStore } from "../state/store.ts";
import type { StreamOptions } from "../event-bus.ts";
import { TokenSession } from "../official/session.ts";
import { Transport } from "../transport/http.ts";
import { channels } from "../diagnostics.ts";
import { classifyPacket } from "../protocol/events.ts";
import { noopLog } from "../logging.ts";
import { readResultEnvelope } from "../protocol/envelope.ts";
import { singleFlight } from "../single-flight.ts";
import { wallClock } from "../clock.ts";

/**
 * The options common to every way of connecting: the controller address, and the injected dependencies that each have a default.
 *
 * - `api` holds routed commands to one of the controller's two APIs; it defaults to `auto`, which prefers the official path and falls back to the direct one.
 * - `clock` is the time source threaded into every subsystem; it defaults to the wall clock, and a test injects a fake to drive time deterministically.
 * - `dispatcher` substitutes the transport's connection pool; when omitted the transport builds and owns one.
 * - `log` is the structured logger; it defaults to a sink that discards.
 * - `refreshIntervalMs` sets the store's refresh cadence; passing `false` disables the failsafe entirely, leaving the consumer on the realtime channel alone. Every
 *   mode re-seeds on that cadence from whatever it seeded from at connect.
 * - `signal` cancels the initial connect. It binds only to connect, never to a later recovery relaunch.
 * - `verifyTls` requires a certificate that verifies from every listener this client dials, on the request path and the notification socket alike. It defaults
 *   to `false`, because a controller presents a self-signed certificate that no verification chain accepts. There are two listeners: the UniFi console, which
 *   the credentials identity reaches, and the Access developer API on its own port, which the token identity reaches. A certificate installed on the console
 *   never reaches the developer API, which presents one of its own, so a token identity needs a certificate installed there - through
 *   {@link OfficialApiServer.uploadCertificate} - before verification succeeds on that leg. A certificate that does not verify raises
 *   {@link AccessCertificateError}, which names the listener it came from and the reason the verifier gave.
 * - `webSocket` is the notification socket factory, defaulting to a real socket and injected in tests. It receives the upgrade's URL and the headers it carries.
 *
 * @category Client
 */
export interface ConnectOptionsBase {

  api?: AccessApiOverride;
  clock?: Clock;
  dispatcher?: Dispatcher;
  host: string;
  log?: AccessLogging;
  refreshIntervalMs?: number | false;
  signal?: AbortSignal;
  verifyTls?: boolean;
  webSocket?: (url: string, headers: Record<string, string>) => AccessWebSocket;
}

/**
 * The identities a client can connect with. At least one is required, and the union is what makes "no identity at all" impossible to write.
 *
 * Credentials reach the Access application's own endpoints, which is where the topology document lives. A token reaches the published API, whose device and door
 * listings are what a client with no credentials seeds the same state model from. Supplying both is the fullest client: the topology-seeded state model plus the
 * official facade, with each command taking whichever path serves it best.
 *
 * The `never` members on the token-only arm are what make a partial credential pair a compile error rather than a runtime surprise - a username with no password
 * describes no way of authenticating, and this is the shape that says so.
 *
 * @category Client
 */
export type ConnectIdentity = { password: string; token?: string; username: string } | { password?: never; token: string; username?: never };

/**
 * Options for {@link AccessClient.connect}: the controller address and injected dependencies, plus at least one identity to connect with.
 *
 * @category Client
 */
export type ConnectOptions = ConnectOptionsBase & ConnectIdentity;

/**
 * The events {@link AccessClient} publishes.
 *
 * `packet` is the realtime firehose: the same typed event that feeds the reducer, fanned out to consumers. The notification stream decodes and classifies each
 * frame once, and the composition root's single bridge dispatches that event into the store and then emits it here - so there is one decode path serving both the
 * state model and the firehose, and a consumer reading `client.state` inside a handler already sees the post-event state.
 *
 * `rawPacket` is the raw observability firehose: every well-formed frame the controller sent, emitted before classification, so it carries both the notifications
 * the library does not model and the payload fields the translation drops. It is never dispatched into state.
 *
 * @category Client
 */
export interface AccessClientEvents {

  packet: [event: AccessWireEvent];
  rawPacket: [packet: AccessEventPacket];
}

/* The parts the private constructor assembles into a client. Built by connect() once authentication and the initial fetch have succeeded; the constructor wires
 * the sinks and assembles the connection monitor, and connect() then opens the notification channel through it.
 *
 * The identity-dependent parts travel as GROUPS rather than as loose optional members, and that is what makes an inconsistent client unrepresentable rather than
 * merely unlikely: a credential session without the transport that carries it, or a transport with no registry built over it, cannot be described here at all. The
 * client then holds each group behind one check instead of re-testing each member wherever it is used.
 */
interface AccessClientParts {

  capabilities: AccessCapabilities;
  clock: Clock;
  direct?: { auth: AuthSession; transport: Transport };
  eventStreamFactory: (signal?: AbortSignal) => EventStream;
  host: string;
  log: AccessLogging;
  official?: { api: OfficialApi; transport: Transport };
  reBootstrap: (signal?: AbortSignal) => Promise<void>;
  routing: AccessRoutingService;
  signal?: AbortSignal;
  store: StateStore;
  throttleSource: ThrottleSource;
  verify: (signal?: AbortSignal) => Promise<void>;
}

// The two documents one pass fetches, and the probe endpoint. Named here so the fetch, the refresh, and the reachability probe cannot address different endpoints.
function topologyUrl(host: string): string {

  return "https://" + host + ACCESS_API_PATH_PREFIX + "/devices/topology4";
}

function controllerUrl(host: string): string {

  return "https://" + host + ACCESS_API_PATH_PREFIX + "/access/info";
}

/* The sentences a bootstrap read speaks, each held once. The configuration and topology subjects are the tail every message reporting a failure to read a document
 * ends in, whichever stage it failed at, and the documents subject is the tail of the message reporting a pair that was read and could not be applied; the refusal
 * sentences are what a refused read falls back to when the controller sent no message of its own, each naming the read that drew it; and the absent-document
 * sentences say the controller reported success and then sent nothing to read.
 */
const CONFIGURATION_SUBJECT = "the UniFi Access controller configuration.";
const CONTROLLER_DOCUMENT_ABSENT = "The controller information endpoint answered with no document.";
const CONTROLLER_READ_REFUSED = "The UniFi Access controller refused the controller information read.";
const DOCUMENTS_SUBJECT = "the UniFi Access controller documents to the state model.";
const TOPOLOGY_DOCUMENT_ABSENT = "The topology endpoint answered with no document.";
const TOPOLOGY_READ_REFUSED = "The UniFi Access controller refused the topology read.";
const TOPOLOGY_SUBJECT = "the UniFi Access controller topology.";

/* How a failure raised while reading one of the controller's bootstrap documents classifies, stated once for every read of one. A refusal in the result envelope is
 * the controller declining to hand the document over - the same event as the non-2xx the fetch tries already wrap - so it is a fetch-stage failure. Everything else
 * the read can raise is the document arriving and not being the document: a body that will not decode, a body that is not an envelope at all, or a success envelope
 * carrying no document. Those are the parse stage.
 */
function bootstrapFailure(error: unknown, subject: string): AccessBootstrapError {

  if(error instanceof AccessApiError) {

    return new AccessBootstrapError("Unable to fetch " + subject, { cause: error, stage: "fetch" });
  }

  return new AccessBootstrapError("Unable to parse " + subject, { cause: error, stage: "parse" });
}

/* Apply a fetched document pair to the store, classifying a failure to fold it as the apply stage. The documents arrived and decoded, so neither the fetch nor the
 * parse stage describes what went wrong: a throw here is a wire shape the reducer does not model or a fault in the reducer itself, and naming it apart is what points
 * a report at the right fix. The read classification above is deliberately not reused, because it would report a reducer throw as a body that failed to parse.
 * Every site that applies the pair goes through here - the connect seed, the refresh failsafe, and a recovery re-bootstrap - so the stage reads the same wherever
 * the fold fails.
 */
function applyBootstrapDocuments(store: StateStore, documents: AccessRefreshDocuments): void {

  try {

    store.applyRefreshDocuments(documents);
  } catch(error) {

    throw new AccessBootstrapError("Unable to apply " + DOCUMENTS_SUBJECT, { cause: error, stage: "apply" });
  }
}

/* Fetch both of the controller's documents concurrently and unwrap them. They are independent requests describing independent things, so fetching them in sequence
 * would double the latency of every refresh for no benefit.
 *
 * Failures are classified by what they mean rather than by where they were caught. The controller not handing over a document is the fetch stage, whether it
 * declined by status or inside the envelope it answered a 2xx with; the document arriving and not being the document is the parse stage. Transport-level failures
 * propagate as the typed errors they already are. The topology endpoint answers with a single-element collection rather than a bare document, so a missing element
 * is a parse-stage failure rather than something to paper over with an empty topology.
 */
async function fetchBootstrapPair(transport: Transport, host: string, opts: { probe?: boolean; signal?: AbortSignal } = {}): Promise<AccessRefreshDocuments> {

  const send = (url: string): ReturnType<Transport["send"]> => transport.send(url,
    { ...((opts.probe === true) && { probe: true }), ...((opts.signal !== undefined) && { signal: opts.signal }) });

  const [ controllerResponse, topologyResponse ] = await Promise.all([ send(controllerUrl(host)), send(topologyUrl(host)) ]);

  try {

    controllerResponse.ensureOk();
    topologyResponse.ensureOk();
  } catch(error) {

    throw new AccessBootstrapError("Unable to fetch " + CONFIGURATION_SUBJECT, { cause: error, stage: "fetch" });
  }

  try {

    /* What this reads is the envelope's verdict and the document's presence. Below those, the shape is trusted, down into every nested field those interfaces
     * declare: nothing here validates deeper than the topology collection's first element existing, and a controller that answered with a differently shaped
     * payload would surface as a downstream type mismatch rather than as a parse-stage failure caught at this boundary.
     */
    const controllerEnvelope = readResultEnvelope(controllerResponse.json<unknown>(), CONTROLLER_READ_REFUSED);

    if(!("data" in controllerEnvelope)) {

      throw new TypeError(CONTROLLER_DOCUMENT_ABSENT);
    }

    const topologyEnvelope = readResultEnvelope(topologyResponse.json<unknown>(), TOPOLOGY_READ_REFUSED);

    if(!("data" in topologyEnvelope)) {

      throw new TypeError(TOPOLOGY_DOCUMENT_ABSENT);
    }

    const controller = controllerEnvelope.data as AccessControllerConfig;
    const topology = (topologyEnvelope.data as AccessBootstrapConfig[])[0];

    if(topology === undefined) {

      throw new TypeError(TOPOLOGY_DOCUMENT_ABSENT);
    }

    return { controller, topology };
  } catch(error) {

    throw bootstrapFailure(error, CONFIGURATION_SUBJECT);
  }
}

/**
 * The UniFi Access client. Construct it through {@link AccessClient.connect}.
 *
 * @category Client
 */
export class AccessClient implements AsyncDisposable {

  readonly #bus = new EventBus<AccessClientEvents>();
  readonly #capabilities: AccessCapabilities;
  readonly #connection: ConnectionMonitor;
  readonly #direct: { auth: AuthSession; transport: Transport } | undefined;
  readonly #host: string;
  readonly #official: { api: OfficialApi; transport: Transport } | undefined;
  readonly #registry: AccessDeviceRegistry;
  readonly #store: StateStore;
  readonly #subscriptions: Disposable[];

  private constructor(parts: AccessClientParts) {

    this.#capabilities = parts.capabilities;
    this.#direct = parts.direct;
    this.#host = parts.host;
    this.#official = parts.official;
    this.#store = parts.store;

    /* The narrow surface every projection reads through, built here at the composition root so the devices tier depends on exactly the members it needs. It is
     * built in every mode, because every mode has a census to project over: the transport is what a mode may lack, and a client with none carries a null there
     * rather than withholding the projections. Which commands such a projection can actually issue is the routing decision's question, not the registry's.
     */
    const context: AccessDeviceContext = { host: parts.host, log: parts.log, routing: parts.routing, store: parts.store,
      transport: parts.direct?.transport ?? null };

    this.#registry = new AccessDeviceRegistry(context);

    /* The single decode sink. The stream decodes and classifies each frame once and hands over one event; this fans that one event into the store, so state
     * advances, and then onto the firehose, so consumers see it. Dispatching before emitting is what lets a consumer read the post-event state inside its own
     * handler. The connection monitor owns the socket's lifecycle and re-attaches this across every relaunch, so there is exactly one decode path at any moment.
     */
    const packetSink = (event: AccessWireEvent): void => {

      this.#store.dispatch(event);
      this.#bus.emit("packet", event);
    };

    const rawPacketSink = (packet: AccessEventPacket): void => {

      this.#bus.emit("rawPacket", packet);
    };

    this.#connection = new ConnectionMonitor({

      clock: parts.clock,
      eventStreamFactory: parts.eventStreamFactory,
      log: parts.log,
      packetSink,
      rawPacketSink,
      reBootstrap: parts.reBootstrap,

      /* Privilege belongs to a credential session, so a client that has none has nothing to re-check and answers the undetermined verdict directly. The monitor
       * calls this on every recovery either way, which is what keeps the mode out of the monitor.
       */
      refreshAdminStatus: async (signal?: AbortSignal): Promise<Nullable<boolean>> => {

        return (parts.direct === undefined) ? null : parts.direct.auth.refreshAdminStatus((signal !== undefined) ? { signal } : {});
      },
      store: parts.store,
      transport: parts.throttleSource,
      verify: parts.verify,
      ...((parts.signal !== undefined) && { signal: parts.signal })
    });

    /* The diagnostics bridge. Both channels are published from here rather than from the layers that produce the events, because both payloads carry the
     * controller's address and neither of those layers knows it: the store is deliberately host-agnostic and the monitor is deliberately host-agnostic, and this
     * is the layer that is not. Both subscriptions live for the client's lifetime and are disposed with it.
     */
    const publishTransition = (transition: ConnectionTransition): void => {

      if(channels.connectionTransition.hasSubscribers) {

        channels.connectionTransition.publish({ ...transition, host: this.#host } satisfies AccessConnectionTransitionPayload);
      }
    };

    this.#subscriptions = [this.#connection.on("stateChanged", publishTransition)];
  }

  /**
   * Connect to an Access controller. Authenticates, fetches what the supplied identities can reach, seeds the state model, brings the realtime channel up, and
   * determines the account's privilege - all as one operation.
   *
   * **Credentials, a token, or both.** Credentials reach the Access application's own endpoints and are what the topology document and the privilege verdict come
   * from. A token reaches the published API and is what `official`, the routed commands' preferred path, and a credential-less client's own inventory come from.
   * Supplying both gives a client everything: state seeded from the topology and corrected by the official read, with each routed command taking whichever path
   * serves it.
   *
   * **A token-only client is a first-class client with a smaller surface, not a degraded one.** What a token reaches on the wire is exactly what it exposes. Its
   * device and door inventory is seeded from the official API's own listings, so `devices`, `hubs`, `device()`, and `hub()` answer with records carrying what those
   * listings establish and nothing they do not. `accessPoints` reads empty and an Enterprise Access Hub is withheld from the hub views, because the per-port expansion
   * and the hub's own placement are read from topology the listing does not carry. A hub's door commands take the official path, `close()` among them as the gate
   * control command, while `restart()`, `updateDevice()`, and `fetchBootstrap` refuse with a capability error. A token refused the device listing connects with an
   * empty inventory and says so once in the log. `isAdmin`, `controllerName`, and `controllerInfo` read `null`, because a token has no account whose privilege could
   * be determined and the controller document is not something the published API serves. Restart detection is inert for that same reason - it watches the controller
   * document's uptime, and there is none - while recovery from a dropped notification channel runs exactly as it does in any other mode. Door state and the inventory
   * are seeded from the official reads, corrected live by the official notification socket, and re-read by the refresh failsafe and on recovery.
   *
   * @param opts - The controller address, at least one identity, and the optional injected dependencies.
   *
   * @returns A ready client.
   *
   * @throws {TypeError} when the options ask for a path the supplied identities cannot take - a token-only client held to the direct API, or a credential-only client
   *   held to the official one. Caller misuse, raised before anything is sent.
   * @throws {@link AccessAuthError} when an identity is refused, its `identity` field naming whether the credentials or the API token were the rejected one,
   *   {@link AccessNetworkError} when the controller cannot be reached, {@link AccessBootstrapError} when its configuration cannot be fetched, parsed, or
   *   applied, or any other typed `FatalError` those stages surface. No partial client escapes a failure.
   */
  static async connect(opts: ConnectOptions): Promise<AccessClient> {

    const clock = opts.clock ?? wallClock;
    const log = opts.log ?? noopLog;
    const override = opts.api ?? "auto";
    const hasCredentials = opts.username !== undefined;
    const hasToken = opts.token !== undefined;
    const mode: AccessApiMode = hasCredentials ? (hasToken ? "dual" : "credential") : "token";

    /* An override the supplied identities cannot honor is a caller's own contradiction rather than anything the controller said, so it raises the language's own error
     * type before a single request goes out. The compiler cannot catch these: which identities were supplied is a type-level fact, but pairing them with an override
     * is a value-level one.
     */
    if(!hasCredentials && (override === "direct-only")) {

      throw new TypeError("A token-only UniFi Access client cannot be held to the direct API, which requires credentials.");
    }

    if(!hasToken && (override === "official-only")) {

      throw new TypeError("A credential-only UniFi Access client cannot be held to the official API, which requires a token.");
    }

    /* A signal already aborted is the caller's own decision, taken before the connect began, so the refusal is immediate. It raises the library's typed abort
     * rather than the platform's own DOMException, which is what lets a consumer branch on one class for every abort the library reports. The refusal lands
     * ahead of any transport, so neither a request nor a socket follows a connect the caller has already given up on.
     */
    if(opts.signal?.aborted === true) {

      throw new AccessAbortedError("The connect was aborted by the caller's signal before any request was sent.");
    }

    /* The direct half: the credential session and the transport that carries it, built together or not at all so that neither can exist without the other. The
     * authentication hooks are closures that run only when a request is dispatched, which is strictly after the session exists - which is what lets the transport
     * stamp credentials and trigger a relogin without importing upward.
     */
    const direct = ((): Nullable<{ auth: AuthSession; transport: Transport }> => {

      if(!hasCredentials) {

        return null;
      }

      // eslint-disable-next-line prefer-const
      let session: AuthSession;
      const directTransport = new Transport({

        clock,
        getAuthHeaders: (): Record<string, string> => session.authHeaders(),
        host: opts.host,
        identity: "credentials",
        log,
        onUnauthorized: (): Promise<boolean> => session.reauthenticate(),
        ...((opts.dispatcher !== undefined) && { dispatcher: opts.dispatcher }),
        ...((opts.verifyTls !== undefined) && { verifyTls: opts.verifyTls })
      });

      session = new AuthSession({ log, transport: directTransport });

      return { auth: session, transport: directTransport };
    })();
    const transport = direct?.transport ?? null;

    /* The official half: the token session, a transport bound to the official address, and the facade over it. The address matters rather than being cosmetic - a
     * pool takes its origin from what it was built with, so a transport built against the bare host would pool against an origin no official request reaches.
     */
    const tokenSession = (opts.token === undefined) ? null : new TokenSession({ token: opts.token });
    const officialTransport = (tokenSession === null) ? null : new Transport({

      clock,
      getAuthHeaders: (): Record<string, string> => tokenSession.authHeaders(),
      host: officialHost(opts.host),
      identity: "token",
      log,
      onUnauthorized: (): Promise<boolean> => tokenSession.unauthorized(),
      ...((opts.dispatcher !== undefined) && { dispatcher: opts.dispatcher }),
      ...((opts.verifyTls !== undefined) && { verifyTls: opts.verifyTls })
    });
    const official = (officialTransport === null) ? null : new OfficialApi({ host: opts.host, transport: officialTransport });

    // Everything built so far, torn down together when a stage below fails. Nothing else exists yet, so this is the whole cleanup at that point.
    const teardownTransports = async (): Promise<void> => {

      await transport?.[Symbol.asyncDispose]();
      await officialTransport?.[Symbol.asyncDispose]();
    };


    /* The document pair's own coalescing gate. Every caller that reaches for the pair - the initial connect, the refresh failsafe, and a recovery re-bootstrap -
     * shares it, and some of them can overlap freely, so sharing one fetch is what keeps a stale controller document from landing on top of a fresher one and
     * letting a recovering client read a restart that had already been accounted for.
     *
     * A caller that wanted a recovery trial and joins a fetch already in flight as an ordinary request accepts that request's fate. If the breaker refuses it, that
     * recovery attempt fails and the loop retries on its own schedule with a fresh trial, so the case is self-correcting rather than a stall. A joiner re-applying
     * the same resolved pair is absorbed by the reducer, which returns the same state for documents it has already reconciled.
     */
    const fetchPair = singleFlight((documentTransport: Transport, fetchOpts: { probe?: boolean; signal?: AbortSignal } = {}): Promise<AccessRefreshDocuments> => {

      return fetchBootstrapPair(documentTransport, opts.host, fetchOpts);
    });

    /* Whether this client's official surface is usable. It begins as whether a facade was built at all, and the seed below can settle it false for a controller that
     * answers that it has no official API - which is the verdict the capability snapshot and the routing service are both built from, rather than the facade's mere
     * existence.
     */
    let officialCapable = official !== null;

    let documents: Nullable<AccessRefreshDocuments> = null;

    try {

      // Stage 1: authenticate. A credential failure and an unreachable controller are both already typed fatals, so they propagate as they are.
      if((direct !== null) && (opts.username !== undefined)) {

        await direct.auth.login({ host: opts.host, password: opts.password, username: opts.username }, (opts.signal !== undefined) ? { signal: opts.signal } : {});
      }

      // Stage 2: fetch what the identities in hand can reach. Not a recovery trial - the breaker is closed at connect time, so this respects its gate like any
      // ordinary request.
      if(direct !== null) {

        documents = await fetchPair(direct.transport, (opts.signal !== undefined) ? { signal: opts.signal } : {});
      }
    } catch(error) {

      await teardownTransports();

      throw error;
    }

    /* Whether the token was refused the device listing. A token is granted its permissions when it is issued and keeps them for its life, so a refusal of one
     * listing is a fact about this client rather than about the moment it asked, and it latches exactly as the routing tier's capability verdicts latch: set once
     * on the first refusal, never cleared, ended only by disposal. Re-asking on every refresh would spend a request per interval to learn the same answer and log
     * the same warning each time.
     */
    let inventoryRefused = false;

    /* Read the device listing, or learn that this token may not. A token is scoped per endpoint, so one that reads doors may still be refused devices; that is not a
     * failure of the connection, it is a smaller client, and it is reported once and then remembered rather than re-discovered on every re-seed. The refusal is read
     * through this library's one published reading of a privilege refusal, and anything else is the fault it is.
     */
    const readOfficialDevices = async (facade: OfficialApi, signal?: AbortSignal): Promise<AccessStateDevice[]> => {

      try {

        // The listing options and the call options are separate parameters, so the empty payload bag is what puts the signal in the position the merge reads it
        // from - appending it as one argument would bind it to the listing options and it would never reach the request.
        return (await facade.devices.fetchAll({}, { ...((signal !== undefined) && { signal }) })).flat().map(officialDeviceRecord);
      } catch(error) {

        if(!isPrivilegeRefusal(error)) {

          throw error;
        }

        inventoryRefused = true;
        log.warn("The UniFi Access controller refused this token the device listing, so the device inventory stays empty.", { host: opts.host });

        return [];
      }
    };

    /* Seed from what the official API says, which is also how a token is verified. Where there is a topology the listings contribute door facts alone; where there
     * is none they are the census, and the devices, the doors, and their state land together. Declared before the store because the store's options read this
     * binding for the refresh failsafe; its body reads the store lazily, which is what makes the order work.
     *
     * It is single-flighted because every caller that reaches for it - the connect seed, the refresh failsafe, and a recovery re-seed - shares it on the same
     * terms the document pair is single-flighted: overlapping callers share one reading, so two passes cannot settle out of order and restate a stale listing
     * over a fresh one.
     *
     * The signal is the initiating caller's, and a joiner shares its fate - which is right here because every signal that can reach this read fires only when the
     * client as a whole is going away, so no joiner is ever cancelled by a lifecycle that was not also ending its own.
     */
    const seedFromOfficial = singleFlight(async (signal?: AbortSignal): Promise<void> => {

      // A client with no token has no official surface to read; its seed is the document pair.
      if(official === null) {

        return;
      }

      /* The doors read comes first and alone, because it is the probe that establishes the token works: a failure here is the failure connect reports, and nothing
       * else is asked of a token that fails it. Where a topology exists it owns the records, and the listing contributes only the door facts it can establish, as a
       * partial source over some doors.
       */
      const doors = await official.spaces.fetchAll({ ...((signal !== undefined) && { signal }) });

      if(hasCredentials) {

        store.applyDoorStateFacts(doors.map(doorStateEntry));

        return;
      }

      // With no topology the listings are the census: the doors just read, their door facts, and the devices - applied as one.
      const devices = inventoryRefused ? [] : await readOfficialDevices(official, signal);

      store.applyCensus({ devices, doorStates: doors.map(doorStateEntry), doors: doors.map(officialDoorRecord) }, { complete: true });
    });

    // Stage 3: build the store. Its refresh failsafe starts with it, so from here on a failure has the store to tear down as well as the transports.
    const store = new StateStore({

      clock,
      log,
      onDispatch: (event: AccessTypedEvent): void => {

        if(channels.storeDispatch.hasSubscribers) {

          channels.storeDispatch.publish({ host: opts.host, kind: event.kind } satisfies AccessStoreDispatchPayload);
        }
      },
      /* The failsafe re-seeds each mode from what it seeded from in the first place - the document pair where there are credentials, the official listings where
       * there are not - so the loop runs on the caller's own cadence in every mode rather than being switched off for one of them.
       */
      refresh: (direct !== null) ? async (signal?: AbortSignal): Promise<void> => applyBootstrapDocuments(store, await fetchPair(direct.transport,
        { ...((signal !== undefined) && { signal }) })) : seedFromOfficial,
      ...((opts.refreshIntervalMs !== undefined) && { refreshIntervalMs: opts.refreshIntervalMs })
    });

    /* Stage 3b: seed the store, first from the document pair through the one method that owns the order the two documents are applied in, and then from the
     * official listings, which is where a token is verified. Both seeds run under one teardown, because the failsafe is already running by the time either can
     * fail, and a store left standing behind a rejected connect would keep re-fetching for a client that never existed.
     */
    try {

      if(documents !== null) {

        applyBootstrapDocuments(store, documents);
      }

      await seedFromOfficial(opts.signal);
    } catch(error) {

      /* This is fatal in some cases and not in others. Anything but the Identity Enterprise code is a genuine failure of the seed; that code on a client with no
       * other identity leaves nothing to fall back to; and that code on a client that also holds credentials is simply the news that this controller has no
       * official API, which the map records and the client carries on without.
       */
      const folded = (error instanceof AccessApiError) && (error.code === "CODE_OTHERS_UID_ADOPTED_NOT_SUPPORTED") && hasCredentials;

      if(!folded) {

        await store[Symbol.asyncDispose]();
        await teardownTransports();

        throw error;
      }

      officialCapable = false;
    }

    const capabilities: AccessCapabilities = { mode, official: officialCapable, override };
    const routing = new AccessRoutingService({ capabilities, official: officialCapable ? official : null, store });

    // Stage 4: build the injected functions the connection monitor drives. The stream factory is the single construction path for the initial socket and every
    // relaunch, and its optional signal binds only to the initial connect. The re-bootstrap and the reachability probe both dispatch as recovery trials.
    const useOfficialChannel = transport === null;
    const eventStreamFactory = (signal?: AbortSignal): EventStream => new EventStream({

      clock,

      /* The upgrade carries whichever identity this client connects with. On the Access application's own socket that is the session cookie and nothing else: the
       * session's full header set also carries the CSRF token, which belongs on the request path, and letting it join the upgrade would change what this connection
       * puts on the wire for no reason the controller asked for. The empty-string fallback keeps the header present before login completes, which is how an upgrade
       * with no credentials in hand presents itself. On the official socket it is the bearer token, through the same hook, which is what lets one stream serve both.
       */
      getAuthHeaders: (): Record<string, string> => (useOfficialChannel && (tokenSession !== null)) ? tokenSession.authHeaders() :
        ({ Cookie: direct?.auth.sessionCookie ?? "" }),
      host: opts.host,

      // Which listener the stream dials, carried so a certificate it will not accept names the listener that presented it rather than the address alone.
      identity: useOfficialChannel ? "token" : "credentials",
      log,
      ...(useOfficialChannel && { endpoint: officialNotificationUrl(opts.host) }),
      ...((signal !== undefined) && { signal }),
      ...((opts.verifyTls !== undefined) && { verifyTls: opts.verifyTls }),
      ...((opts.webSocket !== undefined) && { webSocket: opts.webSocket })
    });

    /* Stage 5: the recovery closures, and the client itself.
     *
     * Which API each closure addresses is settled here, once, rather than re-decided on every call: what this client can reach does not change over its life, so a
     * per-call branch would be asking a question that was answered at connect. Each mode draws from one source, the same one its refresh failsafe draws from - the
     * document pair where there are credentials, the official listings where there are not - and the official read is deliberately not re-run on a credential-path
     * recovery, because the topology pair is what the failsafe and recovery share there while the door facts a token supplies are corrected by the stream that has
     * just come back up.
     *
     * The verification probe is a transport-level act on both legs: one marked send against a single endpoint - the topology document where there are credentials,
     * the doors listing where there are not - whose only question is whether the controller answers. The mark is what carries it through an open breaker, so a
     * controller that has come back is found at the recovery loop's own cadence rather than after the full cooldown, and the outcome books through the ordinary
     * path either way. The body is discarded, which leaves the seed above the one place a door listing becomes state.
     *
     * The monitor's throttle source follows the same rule: it is whichever transport backs the channel these probes go through, and the monitor is none the wiser.
     */

    /* The token leg's recovery closures, and with them the rule that a client must hold an identity it can actually reach a controller with. The identity union
     * makes an options object with neither identity a compile error, so the refusal here is for a caller that reached the runtime without the compiler - untyped
     * JavaScript, or a value parsed from configuration - rather than for anything the typed surface admits. Returning the closures rather than a boolean verdict is
     * what keeps the rule and its proof together: past the refusal, the transport these closures send through is one the types already know is there, so nothing
     * downstream re-asks the question or asserts an answer to it.
     *
     * It tears down what the stages above built before it throws, on the same terms every other failure in this sequence does: the store's refresh failsafe is
     * armed by then, so leaving it standing would hold a timer for a client that never existed.
     */
    const officialRecovery = async (): Promise<{ reBootstrap: (signal?: AbortSignal) => Promise<void>; throttleSource: Transport;
      verify: (signal?: AbortSignal) => Promise<void>; }> => {

      if(officialTransport === null) {

        await store[Symbol.asyncDispose]();
        await teardownTransports();

        throw new TypeError("A UniFi Access client requires either credentials or a token.");
      }

      return {

        reBootstrap: seedFromOfficial,
        throttleSource: officialTransport,
        verify: async (signal?: AbortSignal): Promise<void> => {

          const response = await officialTransport.send(officialEndpoint(opts.host, "/doors"), { probe: true, ...((signal !== undefined) && { signal }) });

          response.ensureOk();
        }
      };
    };

    const recovery = (direct === null) ? await officialRecovery() : {

      reBootstrap: async (signal?: AbortSignal): Promise<void> => {

        applyBootstrapDocuments(store, await fetchPair(direct.transport, { probe: true, ...((signal !== undefined) && { signal }) }));
      },
      throttleSource: direct.transport,
      verify: async (signal?: AbortSignal): Promise<void> => {

        const response = await direct.transport.send(topologyUrl(opts.host), { probe: true, ...((signal !== undefined) && { signal }) });

        response.ensureOk();
      }
    };

    const throttleSource: ThrottleSource = recovery.throttleSource;
    const reBootstrap = recovery.reBootstrap;
    const verify = recovery.verify;

    const client = new AccessClient({

      capabilities,
      clock,
      ...((direct !== null) && { direct }),
      eventStreamFactory,
      host: opts.host,
      log,
      ...(((official !== null) && (officialTransport !== null)) && { official: { api: official, transport: officialTransport } }),
      reBootstrap,
      routing,
      store,
      throttleSource,
      verify,
      ...((opts.signal !== undefined) && { signal: opts.signal })
    });

    try {

      // The channel opens inside the guard, so every resource the socket allocates has an owner: the catch below tears the whole client down.
      await client.connection.open();

      /* Determine the account's privilege before returning. This one is awaited where the recovery-path re-check is not, because a consumer reading `isAdmin` on a
       * freshly connected client should get an answer rather than "not yet determined". Its failure is not fatal: a check that could not reach the controller has
       * learned nothing, so the verdict stays undetermined and the client is still perfectly usable for everything that does not require privilege. A client with no
       * credentials has no account to ask about and skips it.
       */
      if(direct !== null) {

        await direct.auth.refreshAdminStatus((opts.signal !== undefined) ? { signal: opts.signal } : {});
      }
    } catch(error) {

      // Atomic: tear the whole client down so nothing half-built escapes.
      await client[Symbol.asyncDispose]();

      throw error;
    }

    return client;
  }

  /**
   * Classify a notification packet into a typed event, or `null` when the packet is well-formed but describes something the library does not model. Static, pure,
   * and connection-independent: it is the offline counterpart of the {@link AccessClient.events} rail, which is this same classification applied to the live
   * socket, so captured frames can be run through exactly the path the realtime channel uses.
   *
   * @param packet - A notification packet as the controller sent it.
   *
   * @returns The classified event, or `null` for a valid-but-unmodeled packet.
   */
  static classifyPacket(packet: AccessEventPacket): Nullable<AccessWireEvent> {

    return classifyPacket(packet);
  }

  /** The data layer: a synchronous snapshot and a live observation over the reduced controller state. */
  get state(): StateStore {

    return this.#store;
  }

  /**
   * The HTTP transport for the Access application's own endpoints - the documented escape hatch for calls the typed surface does not cover - or `null` on a client
   * with no credentials, which never reaches those endpoints at all. The escape hatch belongs to the credential surface; the official API's own untyped endpoints
   * are reachable through {@link AccessClient.official}'s request hatches.
   */
  get transport(): Nullable<Transport> {

    return this.#direct?.transport ?? null;
  }

  /**
   * The official UniFi Access API, or `null` when this client has no working official path.
   *
   * Nullability follows the capability map rather than bare token presence, so the two agree by construction: a client that supplied a token to a controller that
   * has no official API - an Identity Enterprise deployment - reads `null` here and `false` at `capabilities.official`, from the one verdict derived at connect.
   */
  get official(): Nullable<OfficialApi> {

    return this.#capabilities.official ? (this.#official?.api ?? null) : null;
  }

  /**
   * What this client can do, as established at connect: the identities it holds, whether the official path is available, and the routing override in force.
   *
   * A connect-time snapshot rather than a live reading. See {@link AccessCapabilities} for what that does and does not move.
   */
  get capabilities(): AccessCapabilities {

    return this.#capabilities;
  }

  /** The connection monitor: the observable state machine, restart detection, throttle and stall folding, and automatic recovery of the realtime channel. */
  get connection(): ConnectionMonitor {

    return this.#connection;
  }

  /**
   * Whether the authenticated account holds administrative privilege, or `null` when that has never been established. This is the session's own verdict rather
   * than anything derived from state: privilege belongs to the credentials, not to the controller's configuration.
   */
  get isAdmin(): Nullable<boolean> {

    return this.#direct?.auth.isAdmin ?? null;
  }

  /** The controller's display name, or `null` before its information document has been fetched - which a connected client never sees, since connect awaits it. */
  get controllerName(): Nullable<string> {

    return selectControllerName(this.#store.snapshot());
  }

  /** The controller's own information document, or `null` before one has been fetched. */
  get controllerInfo(): Nullable<AccessControllerConfig> {

    return selectController(this.#store.snapshot());
  }

  /** The live state of every door, keyed by door identity: seeded at connect from what each mode's read establishes, corrected live by the stream. An entry is
   * absent only where neither source had anything to say about that door.
   */
  get doorStates(): ReadonlyMap<string, AccessDoorStateEntry> {

    return selectDoorStates(this.#store.snapshot());
  }

  /** Every modeled device in the current state, as live handles. */
  get devices(): readonly AccessDevice[] {

    return this.#registry.devices();
  }

  /** Every hub in the current state, as live handles. */
  get hubs(): readonly AccessHub[] {

    return this.#registry.hubs();
  }

  /** Every door-serving port of every Enterprise Access Hub, as live handles - one per door the hardware drives. */
  get accessPoints(): readonly AccessHub[] {

    return this.#registry.accessPoints();
  }

  /**
   * Look up a device by identity, or `undefined` when the current state holds no such device.
   *
   * @param id - The device's `unique_id`.
   *
   * @returns A live device handle, or `undefined`.
   */
  device(id: string): AccessDevice | undefined {

    return this.#registry.device(id);
  }

  /**
   * Look up a hub by identity, or `undefined` when the current state holds no hub-capable device under it. A building-hosted Enterprise Access Hub answers
   * `undefined` here; reach its doors through {@link AccessClient.accessPoint}.
   *
   * @param id - The device's `unique_id`.
   *
   * @returns A live hub handle, or `undefined`.
   */
  hub(id: string): AccessHub | undefined {

    return this.#registry.hub(id);
  }

  /**
   * Look up one door-serving port of an Enterprise Access Hub by the port's own identity, or `undefined` when no such port exists.
   *
   * @param id - The port's `unique_id`.
   *
   * @returns A live hub handle over that port, or `undefined`.
   */
  accessPoint(id: string): AccessHub | undefined {

    return this.#registry.accessPoint(id);
  }

  /**
   * Subscribe to a client event. Returns a `Disposable`; prefer `using sub = client.on(...)` so the listener detaches at scope exit.
   *
   * @param event   - The event to listen for.
   * @param handler - Invoked on each emission.
   *
   * @returns A `Disposable` that removes the listener when disposed.
   */
  on<K extends keyof AccessClientEvents>(event: K, handler: (...args: AccessClientEvents[K]) => void): Disposable {

    return this.#bus.on(event, handler);
  }

  /**
   * Wait for the next emission of a client event.
   *
   * @param event - The event to await.
   * @param opts  - Optional abort signal.
   *
   * @returns A promise resolving to the event's argument tuple.
   */
  async once<K extends keyof AccessClientEvents>(event: K, opts: { signal?: AbortSignal } = {}): Promise<AccessClientEvents[K]> {

    return this.#bus.once(event, opts);
  }

  /**
   * Stream every subsequent emission of a client event until the signal aborts.
   *
   * @param event - The event to stream.
   * @param opts  - Stream options, including the abort signal.
   *
   * @returns An async iterable of the event's argument tuples.
   */
  stream<K extends keyof AccessClientEvents>(event: K, opts: StreamOptions = {}): AsyncIterable<AccessClientEvents[K]> {

    return this.#bus.stream(event, opts);
  }

  /**
   * The realtime firehose: every typed event the controller produces, until the signal aborts or the client is disposed. Each event has already been folded into
   * the state model by the time it arrives here, so reading `client.state` inside the loop observes the post-event state.
   *
   * @param opts - Optional abort signal that terminates the iteration.
   *
   * @returns An async iterable of typed events.
   */
  async *events(opts: { signal?: AbortSignal } = {}): AsyncGenerator<AccessWireEvent> {

    // The underlying rail rejects with the abort reason when its signal fires; this sugar smooths the caller's own abort into a clean return, so a loop over the
    // firehose ends quietly rather than forcing every consumer to wrap it. Any other error still propagates.
    try {

      for await (const [event] of this.#bus.stream("packet", opts)) {

        yield event;
      }
    } catch(error) {

      if(opts.signal?.aborted === true) {

        return;
      }

      throw error;
    }
  }

  /**
   * The raw firehose: every well-formed frame the controller sent, before classification, so it carries the notifications the library does not model and the
   * payload fields the translation drops. Pure observability - a raw frame is never folded into state, so reading `client.state` inside this loop carries no
   * ordering guarantee relative to the frame.
   *
   * @param opts - Optional abort signal that terminates the iteration.
   *
   * @returns An async iterable of raw notification packets.
   */
  async *rawPackets(opts: { signal?: AbortSignal } = {}): AsyncGenerator<AccessEventPacket> {

    try {

      for await (const [packet] of this.#bus.stream("rawPacket", opts)) {

        yield packet;
      }
    } catch(error) {

      if(opts.signal?.aborted === true) {

        return;
      }

      throw error;
    }
  }

  /**
   * Fetch the controller's topology document on demand and return the parsed JSON untouched.
   *
   * The library does not retain the raw document - it is consumed once as a synthetic event and only the reduced state survives - so this is a fresh request whose
   * result is returned verbatim and deliberately not folded into state. It is a faithful dump for diagnostics rather than a cached copy; the reduced, observable
   * model remains `client.state`. The return type is deliberately unknown: this is whatever the controller sent, not the curated model.
   *
   * The topology document is credential surface: it is served by the Access application's own endpoints and has no equivalent on the published API, so a
   * token-only client cannot produce it and says so rather than answering something thinner and calling it the same thing.
   *
   * @param opts - Optional abort signal.
   *
   * @throws {@link AccessCapabilityError} on a client with no credentials, {@link AccessBootstrapError} when the document cannot be fetched, is refused, or cannot
   *   be parsed, or a transport-level `AccessError`.
   */
  async fetchBootstrap(opts: { signal?: AbortSignal } = {}): Promise<unknown> {

    if(this.#direct === undefined) {

      throw new AccessCapabilityError("This UniFi Access client cannot fetch the controller's topology document, because it is served by the Access " +
        "application's own endpoints, which require credentials.");
    }

    const response = await this.#direct.transport.send(topologyUrl(this.#host), (opts.signal !== undefined) ? { signal: opts.signal } : {});

    try {

      response.ensureOk();
    } catch(error) {

      throw new AccessBootstrapError("Unable to fetch " + TOPOLOGY_SUBJECT, { cause: error, stage: "fetch" });
    }

    try {

      return readResultEnvelope(response.json<unknown>(), TOPOLOGY_READ_REFUSED);
    } catch(error) {

      throw bootstrapFailure(error, TOPOLOGY_SUBJECT);
    }
  }

  /**
   * Dispose the client: tear down the connection monitor, stopping recovery and closing the realtime channel; stop the refresh failsafe and end every observation;
   * end the session; and destroy every connection pool this client built - in that order, so what feeds the state and the transports stops before they do. A client
   * holding both identities destroys both pools; one holding either destroys the one it built. Safe to call more than once, and the canonical teardown through
   * `await using client = await AccessClient.connect(...)`.
   */
  async [Symbol.asyncDispose](): Promise<void> {

    for(const subscription of this.#subscriptions) {

      subscription[Symbol.dispose]();
    }

    await this.#connection[Symbol.asyncDispose]();
    await this.#store[Symbol.asyncDispose]();
    this.#direct?.auth.logout();

    // The pools go last and together, because everything above feeds them. Which of them exist follows from what the client was built with rather than from its
    // mode, so a client with one identity tears down one pool by the same code that tears down two.
    await this.#direct?.transport[Symbol.asyncDispose]();
    await this.#official?.transport[Symbol.asyncDispose]();
  }
}

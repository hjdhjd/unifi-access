# Changelog

All notable changes to this project will be documented in this file. This project uses [semantic versioning](https://semver.org/).

## 2.0.0 (unreleased)

v2 is a ground-up rewrite around a single model: the controller's state is a reducer over a typed realtime notification stream, with a periodic re-bootstrap as a permanent failsafe. The entry point, error handling, resource lifetimes, event model, and device surface are all new, and the API is not source-compatible with 1.x.

  * Breaking change: the entry point is now `AccessClient.connect()`, a single atomic operation that authenticates, fetches the controller's documents, seeds the state model, and opens the realtime channel, returning a fully-ready client or throwing. The `new AccessApi()` + `login()` + `getBootstrap()` sequence and its half-constructed-object state are gone.
  * Breaking change: failures throw a typed `AccessError` hierarchy split into `RecoverableError` (throttle, timeout, network, abort, stall) and `FatalError` (auth, authorization, request, protocol, bootstrap). The 1.x pattern of returning `false` or `null` on failure is removed: a method resolves with its value or throws.
  * Breaking change: devices are live projections rather than cached records. `client.devices`, `client.hubs`, and `client.accessPoints` return handles whose getters read through to the current state, and per-device operations are methods on the handle: `device.restart()`, `device.updateDevice()`, and, on a hub, `hub.unlock()`, `hub.close()`, and `hub.setLockRule()`. The free-function `unlock(device, duration)` and `updateDevice(device, payload)` are replaced by those methods, and a duration is now expressed as a lock rule rather than as an overloaded number.
  * Breaking change: state is observable. `client.state.snapshot()` is the current reduced state and `client.state.observe(selector)` yields a selector's output only when it changes, with memoized selectors exported for the common views. The `bootstrap`, `controller`, `devices`, `doors`, and `floors` getters that returned cached arrays are replaced by that model, and `client.fetchBootstrap()` covers the case where the controller's raw topology document itself is what you want.
  * Breaking change: the event surface is a three-rail facade. `on` returns a `Disposable`, `once` returns a `Promise`, and `stream` returns an `AsyncIterable`, with `client.events()` as the classified firehose and `client.rawPackets()` as the verbatim frame rail. The `on("message", packet)` listener is replaced by that model, and the client no longer extends `EventEmitter`, so the inherited emitter methods no longer leak onto the public surface.
  * Breaking change: every long-lived resource is an `AsyncDisposable`. `await using client = await AccessClient.connect(...)` closes the notification stream, stops the refresh failsafe, ends the session, and destroys the connection pool at scope exit. There are no `reset()` or `logout()` calls to forget.
  * Breaking change: the minimum supported Node version is now Node 22.20 or later, and the package is ESM-only.
  * New feature: the official UniFi Access developer API, implemented as a complete typed reference: a method for every documented endpoint, each marked with its provenance (live-verified or documentation-derived), riding one enveloped dispatch that maps the controller's `CODE_*` refusal vocabulary into the typed error hierarchy.
  * New feature: token authentication. A client connects with credentials, a token, or both - `AccessClient.connect({ host, token })` - and a token-only client is a first-class client whose command surface is the official facade at `client.official`. Its devices and doors are seeded from the official API's own listings into the same state model, so `client.devices`, `client.hubs`, the selectors, and a hub's `doorState` answer in every mode, with `mac` restored from the device identifier and everything the listing does not carry left absent rather than invented.
  * Improvement: every MAC address the state model holds as a device's own or as the controller host's is spelled one way - uppercase, without separators, the spelling the UniFi Protect family carries - whichever way the controller spelled it in the topology document, a notification, the controller document, or the official listing, so a consumer that keys on an address is never re-keyed by the wire's own case. The camera records a hub embeds are the companion Protect controller's own material and keep the spelling it gave them; the `ufa` device, hub, and access-point listings show the same spelling. The `isMacAddress` and `normalizeMacAddress` functions that state the rule are published for a consumer that holds an address of its own.
  * New feature: capability routing. Commands take the official path where one serves and the direct path otherwise, the `api` connect option pins a channel and a pinned client refuses whatever that channel cannot carry, and `client.capabilities` is the connect-time map of what the client can do.
  * New feature: webhook payload types and signature verification - the typed delivery shapes, `isAccessWebhookDelivery` to narrow a parsed body to the delivery union, and `verifyWebhookSignature`, which answers with the validated signature's timestamp for the receiver's own freshness window - for consuming the controller's webhook deliveries on your own HTTP surface without a client at all.
  * New feature: per-door live state. The controller's door reports are modeled as a first-class concept, readable as `client.doorStates` or through a hub's own `doorState`, and delivered on the firehose as a typed `doorStateChanged` event carrying every door the packet named. Door state is seeded at connect in every mode - from the topology's wiring and hardware readings with credentials, from the official doors read with a token - and corrected live by the stream.
  * New feature: the gate command vocabulary. `hub.close()` acts on either API - the Access application's own close command with credentials, the official API's gate control command without - `hub.stop()` halts a three-button gate mid-transition, and an unlock can carry the double-driveway entry direction, with the gate surfaces documented for UA Hub Gate hardware on UniFi Access 4.2.16 or later, and each of these commands - `hub.setLockRule()` beside them - taking an optional `doorId` that names which door of multi-door hardware to act on.
  * New feature: one lock-rule vocabulary across both channels. `hub.setLockRule()` and the official surface speak the same rule union, with a custom rule's interval in whole minutes - the controller's own granularity.
  * New feature: each door-serving port of an Enterprise Access Hub is addressable in its own right through `client.accessPoints`, so a multi-door hub's doors are commanded individually rather than through a synthesized stand-in.
  * New feature: a connection-health monitor (`client.connection`) with an observable state machine, controller reboot detection, throttle status, and automatic recovery of the realtime channel after an outage.
  * New feature: a `node:diagnostics_channel` observability surface, with named channels across HTTP requests and throttling, session relogin, realtime events, connection state, and state dispatch. The channel roster and its payload types are part of the public contract.
  * New feature: opt-in strict TLS certificate verification. `AccessClient.connect({ verifyTls: true })` requires the controller to present a certificate that verifies, on the request path and the realtime notification socket alike, and the `ufa` CLI reads the same choice from a `verifyTls` field in `ufa.json`. It defaults to off, because a controller ships a self-signed certificate that no verification chain accepts.
  * New feature: the `ufa` CLI is rebuilt as a first-class reference consumer that reaches the controller only through the public API. The command surface is noun-first - the door, device, watch, user, visitor, logs, and webhook groups, with doors addressed by id, name, or full name in every mode beside `info` and `bootstrap`, an `api` hatch that reaches any official endpoint, and an offline `classify` over captured packets - with the event filter grammar carried into `ufa watch events`, unit-suffixed durations (`30s`, `5m`, `1h`), a mode-aware `doctor` health probe that exercises every subsystem the connection offers and exits non-zero on a failure, and credentials extending to the token identity.
  * New feature: a capture scrub. Every `ufa` command that emits a wire document - the `api` hatch, `bootstrap`, `info`, `logs`, `user`, `visitor`, `webhook`, the `device` and `door` groups, and the `watch events` and `watch raw` leaves - accepts `--scrub`, which replaces every identifying value in the output - names, identifiers, hardware and network addresses, hostnames, mail addresses, phone numbers, license plates, tokens, and secrets - with a shape-valid stand-in, consistently across the whole capture so cross-references survive, and a combination that emits no document refuses the flag with a stated usage error rather than silently ignoring it.
  * New feature: a plain-English gloss for unlock authentication types. `ACCESS_AUTHENTICATION_TYPES` maps the tokens the controller reports for how an unlock was authenticated - on the webhook, on the realtime socket's log frames, and on the official system-logs endpoint - to a label fit for showing to a person, with a token the table does not name read as absent so a consumer shows the wire's own spelling rather than an invented meaning.
  * Improvement: an authentication or authorization refusal names which identity the controller refused. `AccessAuthError` and `AccessAuthorizationError` carry an `identity` field - `"credentials"` for the direct login, `"token"` for the official API's bearer token - and word their messages accordingly, so a consumer holding both identities can tell a rejected password from a token issued without the permission an endpoint requires.
  * Improvement: every official API method accepts per-call options as its last parameter. `AccessOfficialCallOptions` carries the caller's `AbortSignal`, composed with the transport's own timeout and classified as the caller's act when it fires, so a routed door command and the read beside it can both be cancelled, and the `ufa` CLI threads its Ctrl-C through it on every command.
  * Improvement: the stream options and the socket contract are part of the published surface. `StreamOptions` is what `stream()` accepts - the abort signal that ends the iteration - and `AccessWebSocket`, with its event types, is the contract a consumer's own socket implementation satisfies when supplied through the `webSocket` connect option, so both can be named in consumer code.
  * Housekeeping.

## 1.5.3 (2026-01-23)
  * Fix: resolve an issue where Gate Hubs were not discovered when multiple hub types exist.

## 1.5.2 (2026-01-23)
  * Housekeeping.

## 1.5.1 (2025-11-24)
  * Housekeeping.

## 1.5.0 (2025-11-10)
  * Improvement: additional typings for recent Access releases.
  * Housekeeping.

## 1.4.0 (2025-11-09)
  * Behavior change: we now use undici for the underlying network stack, resulting in some adjustments to our API options.
  * New feature: UniFi Access Gate Hub support.
  * Housekeeping.

## 1.3.2 (2025-06-11)
  * Fix: increase our robustness against potential weirdness in what the Access API gives us to work with.
  * Housekeeping.

## 1.3.1 (2025-05-31)
  * Improvement: remove the dependency on homebridge-plugin-utils.
  * Housekeeping.

## 1.3.0 (2025-05-27)
  * New feature: utility appication, ufa, to allow command-line access to the UniFi Access API.
  * New feature: initial support for Enterprise Access Hubs.
  * Improvement: additional typings for recent Access releases.
  * Housekeeping.

## 1.2.0 (2024-10-02)
  * Improvement: support for UniFi Access v2.3.
  * Housekeeping.

## 1.1.0 (2024-08-04)
  * Improvement: support for UniFi Access v2.
  * Improvement: support for all Access hub types.
  * Housekeeping.

## 1.0.3 (2024-03-31)
  * Fix: additional robustification.
  * Housekeeping.

## 1.0.2 (2024-03-16)
  * Fix: more robust exception handling.

## 1.0.1 (2024-03-15)
  * Housekeeping.

## 1.0.0 (2024-03-12)
  * New feature: the UniFi Access controller property and API reply JSONs are now available.
  * Improvement: the `unlock` API endpoint has been enhanced to allow for arbitrary time periods.
  * Housekeeping.

## 0.2.0 (2024-03-06)
  * New feature: unlock support.
  * New feature: better device enumeration.
  * New feature: access to the realtime events API for UniFi Access.
  * Housekeeping.

## 0.1.0 (2024-03-02)
  * Initial release. Support for device enumeration and some foundational capabilities.

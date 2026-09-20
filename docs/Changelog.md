# Changelog

All notable changes to this project will be documented in this file. This project uses [semantic versioning](https://semver.org/).

## 2.0.0 (2026-09-19)

v2 is a ground-up rewrite around a single model: the controller's state is a reducer over a typed realtime notification stream, with a periodic re-bootstrap as a permanent failsafe. The entry point, error handling, resource lifetimes, event model, and device surface are all new, and the API is not source-compatible with 1.x.

  * Breaking change: the entry point is now `AccessClient.connect()` - a single atomic operation that authenticates, fetches the controller's documents, seeds the state model, and opens the realtime channel, returning a fully-ready client or throwing. The client is an `AsyncDisposable`, so `await using` closes the stream, stops the refresh failsafe, ends the session, and destroys the connection pool at scope exit. The `new AccessApi()` + `login()` + `getBootstrap()` sequence, its half-constructed-object state, and the `reset()` and `logout()` calls are gone.
  * Breaking change: failures throw a typed `AccessError` hierarchy split into `RecoverableError` (throttle, timeout, network, abort, stall) and `FatalError` (auth, authorization, request, protocol, bootstrap, capability, API refusal). The 1.x pattern of returning `false` or `null` on failure is removed - methods resolve with their value or throw - and an authentication refusal says whether it was the credentials or the token that the controller refused.
  * Breaking change: devices are live projections, not cached records. `client.devices`, `client.hubs`, and `client.accessPoints` return handles whose getters read through to the current state, and per-device operations are methods on the handle: `device.restart()`, `device.updateDevice()`, and on a hub `hub.unlock()`, `hub.close()`, `hub.stop()`, and `hub.setLockRule()`, each taking an optional `doorId` on multi-door hardware. The free-function `unlock(device, duration)` and `updateDevice(device, payload)` are replaced by those methods, and a duration is now a lock rule rather than an overloaded number.
  * Breaking change: state is observable - `client.state.snapshot()` is the current reduced state and `client.state.observe(selector)` yields a selector's output only when it changes, with memoized selectors exported for the common views. The `bootstrap`, `controller`, `devices`, `doors`, and `floors` getters that returned cached arrays are replaced by that model; `client.fetchBootstrap()` remains for when the raw topology document itself is what you want.
  * Breaking change: the event surface is a three-rail facade - `on` returns a `Disposable`, `once` returns a `Promise`, `stream` returns an `AsyncIterable` - with `client.events()` as the classified firehose and `client.rawPackets()` as the verbatim frame rail. The `on("message", packet)` listener is replaced by that model, and the client no longer extends `EventEmitter`, so its inherited methods no longer leak onto the public surface.
  * Breaking change: the minimum supported Node version is now Node 22.20 or later.
  * New feature: the official UniFi Access developer API as a complete typed reference - a method for every documented endpoint, each marked with its provenance (live-verified or documentation-derived), through one enveloped dispatch that maps the controller's `CODE_*` refusal vocabulary into the typed error hierarchy. Every method takes a caller's `AbortSignal` as its last parameter.
  * New feature: token authentication. A client connects with credentials, a token, or both - `AccessClient.connect({ host, token })` - and a token-only client is a first-class client whose command surface is the official facade at `client.official`. Its devices and doors are seeded from the official API's own listings into the same state model, so the device handles, the selectors, and door state answer in every mode.
  * New feature: capability routing. Commands take the official path where one serves and the direct path otherwise, the `api` connect option fixes the channel and a fixed client refuses whatever that channel cannot carry, and `client.capabilities` is the connect-time map of what the client can do.
  * New feature: webhook payload types and signature verification - the typed delivery shapes, `isAccessWebhookDelivery` to narrow a parsed body, and `verifyWebhookSignature`, which answers with the validated signature's timestamp for the receiver's own freshness window - for consuming the controller's webhook deliveries without a client at all.
  * New feature: per-door live state. The controller's door reports are a first-class concept, readable as `client.doorStates` or through a hub's own `doorState`, seeded at connect in every mode, corrected live by the stream, and delivered on the firehose as a typed `doorStateChanged` event.
  * New feature: the gate command vocabulary. `hub.close()` acts on either API, `hub.stop()` halts a three-button gate mid-transition, and an unlock can carry the double-driveway entry direction, for UA Hub Gate hardware on UniFi Access 4.2.16 or later.
  * New feature: one lock-rule vocabulary across both channels. `hub.setLockRule()` and the official surface speak the same rule union, with a custom rule's interval in whole minutes - the controller's own granularity.
  * New feature: each door-serving port of an Enterprise Access Hub is addressable in its own right through `client.accessPoints`, so a multi-door hub's doors are commanded individually rather than through a synthesized stand-in.
  * New feature: a connection-health monitor (`client.connection`) with an observable state machine, controller reboot detection, throttle status, and automatic recovery of the realtime channel after an outage.
  * New feature: a `node:diagnostics_channel` observability surface, with named channels across HTTP requests and throttling, session relogin, realtime events, connection state, and state dispatch. The channel roster and its payload types are part of the public contract.
  * New feature: tamper detection. `device.tamperState` is a typed read on the handle - `true` while the controller reports the enclosure tripped, `false` while it does not, `undefined` where nothing has established a reading - `device.isTamperCapable` says whether the device carries the capability, and the controller's tamper notification arrives on the firehose as a typed `tamperAlert` event.
  * New feature: opt-in strict TLS certificate verification. `AccessClient.connect({ verifyTls: true })` requires a certificate that verifies on the request path and the realtime socket alike, and a failure raises `AccessCertificateError` naming which listener presented it and why. It defaults to off, because a controller ships a self-signed certificate that no verification chain accepts.
  * New feature: a plain-English gloss for unlock authentication types. `ACCESS_AUTHENTICATION_TYPES` maps the tokens the controller reports for how an unlock was authenticated - on the webhook, the realtime socket, and the official system-logs endpoint - to a label fit for showing to a person.
  * New feature: the `ufa` CLI is rebuilt as a first-class reference consumer that reaches the controller only through the public API. The command surface is noun-first - door, device, watch, user, visitor, logs, and webhook groups, plus `info`, `bootstrap`, an `api` hatch that reaches any official endpoint, and an offline `classify` over captured packets - with doors addressed by id or name in every mode, unit-suffixed durations (`30s`, `5m`, `1h`), and a mode-aware `doctor` health probe that exercises every subsystem the connection offers.
  * New feature: a capture scrub. Every `ufa` command that emits a wire document accepts `--scrub`, which replaces every identifying value in the output - names and aliases, identifiers, hardware and network addresses, hostnames, mail addresses, phone numbers, license plates, tokens, and secrets - with a shape-valid stand-in, consistently across the whole capture so cross-references survive.
  * Improvement: every MAC address the state model holds is spelled one way - uppercase, without separators, the spelling the UniFi Protect family carries - whichever way the controller spelled it, so a consumer that keys on an address is never re-keyed by the wire's own case. The `isMacAddress` and `normalizeMacAddress` functions that state the rule are published, recognizing colon, hyphen, dot, and contiguous spellings.
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

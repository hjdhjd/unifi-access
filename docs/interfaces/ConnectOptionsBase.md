[**unifi-access**](../README.md)

***

[Home](../README.md) / ConnectOptionsBase

# Interface: ConnectOptionsBase

The options common to every way of connecting: the controller address, and the injected dependencies that each have a default.

`host` is the controller's address without a scheme: a hostname or an IPv4 address, with an optional `:port`, or an IPv6 literal, accepted bare (`fe80::1`) or
bracketed (`[fe80::1]`), with a port only after the bracketed form (`[fe80::1]:7443`), because a bare literal's own colons leave no way to tell a port from its
last group. A single trailing `/` is accepted and dropped, so `access.local/` connects as `access.local`, because it is the empty path every URL places after the
address anyway. A port addresses the UniFi console alone, because the Access developer API answers on a port of its own at the same host. Every URL the client
composes reads the address as the URL parser reads it, while every log and diagnostics payload carries it exactly as configured. An address no URL can carry is
refused with [AccessConfigurationError](../classes/AccessConfigurationError.md) before any request is sent: an IPv6 literal with a zone (`fe80::1%en0`), or a value
carrying credentials, a path, a query or a fragment.

Each of the others has a default:

- `api` holds routed commands to one of the controller's two APIs; it defaults to `auto`, which prefers the official path and falls back to the direct one.
- `clock` is the time source threaded into every subsystem; it defaults to the wall clock, and a test injects a fake to drive time deterministically.
- `dispatcher` substitutes the transport's connection pool; when omitted the transport builds and owns one.
- `log` is the structured logger; it defaults to a sink that discards.
- `refreshIntervalMs` sets the store's refresh cadence; passing `false` disables the failsafe entirely, leaving the consumer on the realtime channel alone. Every
  mode re-seeds on that cadence from whatever it seeded from at connect.
- `signal` cancels the initial connect. It binds only to connect, never to a later recovery relaunch.
- `verifyTls` requires a certificate that verifies from every listener this client dials, on the request path and the notification socket alike. It defaults
  to `false`, because a controller presents a self-signed certificate that no verification chain accepts. There are two listeners: the UniFi console, which
  the credentials identity reaches, and the Access developer API on its own port, which the token identity reaches. A certificate installed on the console
  never reaches the developer API, which presents one of its own, so a token identity needs a certificate installed there - through
  [OfficialApiServer.uploadCertificate](OfficialApiServer.md#uploadcertificate) - before verification succeeds on that leg. A certificate that does not verify raises
  [AccessCertificateError](../classes/AccessCertificateError.md), which names the listener it came from and the reason the verifier gave.
- `webSocket` is the notification socket factory, defaulting to a real socket and injected in tests. It receives the upgrade's URL and the headers it carries.

## Properties

| Property | Type |
| ------ | ------ |
| <a id="api"></a> `api?` | [`AccessApiOverride`](../type-aliases/AccessApiOverride.md) |
| <a id="clock"></a> `clock?` | [`Clock`](Clock.md) |
| <a id="dispatcher"></a> `dispatcher?` | `Dispatcher` |
| <a id="host"></a> `host` | `string` |
| <a id="log"></a> `log?` | [`AccessLogging`](AccessLogging.md) |
| <a id="refreshintervalms"></a> `refreshIntervalMs?` | `number` \| `false` |
| <a id="signal"></a> `signal?` | `AbortSignal` |
| <a id="verifytls"></a> `verifyTls?` | `boolean` |
| <a id="websocket"></a> `webSocket?` | (`url`, `headers`) => [`AccessWebSocket`](AccessWebSocket.md) |

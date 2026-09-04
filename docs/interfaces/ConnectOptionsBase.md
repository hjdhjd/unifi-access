[**unifi-access**](../README.md)

***

[Home](../README.md) / ConnectOptionsBase

# Interface: ConnectOptionsBase

The options common to every way of connecting: the controller address, and the injected dependencies that each have a default.

- `api` holds routed commands to one of the controller's two APIs; it defaults to `auto`, which prefers the official path and falls back to the direct one.
- `clock` is the time source threaded into every subsystem; it defaults to the wall clock, and a test injects a fake to drive time deterministically.
- `dispatcher` substitutes the transport's connection pool; when omitted the transport builds and owns one.
- `log` is the structured logger; it defaults to a sink that discards.
- `refreshIntervalMs` sets the store's refresh cadence; passing `false` disables the failsafe entirely, leaving the consumer on the realtime channel alone. Every
  mode re-seeds on that cadence from whatever it seeded from at connect.
- `signal` cancels the initial connect. It binds only to connect, never to a later recovery relaunch.
- `verifyTls` requires the controller to present a certificate that verifies, on the request path and the notification socket alike. It defaults to `false`,
  because a controller presents a self-signed certificate that no verification chain accepts - turn it on where a trusted certificate has been installed on the
  controller and a connection to an impostor should fail rather than proceed.
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

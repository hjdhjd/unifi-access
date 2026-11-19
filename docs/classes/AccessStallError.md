[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessStallError

# Class: AccessStallError

The realtime events channel produced no data for longer than its heartbeat watchdog window - silence beyond `ACCESS_EVENTS_HEARTBEAT_TIMEOUT`, a window spanning
two of the controller's heartbeat intervals, which the watchdog notices one to two windows after the last frame. The underlying channel is presumed dead. As a
`RecoverableError`, the error type itself is the signal to recover: the events stream's subscriber (the `ConnectionMonitor`) re-bootstraps and relaunches rather
than leaving a consumer reading state that silently stopped updating.

## Extends

- [`RecoverableError`](RecoverableError.md)

## Constructors

### Constructor

```ts
new AccessStallError(message, options): AccessStallError;
```

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `message` | `string` |
| `options` | \{ `cause?`: `unknown`; `silentForMs`: `number`; \} |
| `options.cause?` | `unknown` |
| `options.silentForMs` | `number` |

#### Returns

`AccessStallError`

#### Overrides

`RecoverableError.constructor`

## Properties

| Property | Modifier | Type | Description |
| ------ | ------ | ------ | ------ |
| <a id="silentforms"></a> `silentForMs` | `readonly` | `number` | Milliseconds of silence observed before the watchdog tripped. |

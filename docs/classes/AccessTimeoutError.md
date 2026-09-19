[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessTimeoutError

# Class: AccessTimeoutError

Our own request deadline elapsed before the controller responded. Distinct from [AccessAbortedError](AccessAbortedError.md): this fires when the library's own request deadline wins the
race, whereas an aborted error fires when the caller's signal wins. The transport tells the two apart by the identity of the reason the failure carries - the reason of
its own deadline signal names a timeout, and the reason of the caller's signal names a cancellation - so the class states which signal fired first rather than which
one happens to be aborted by the time the failure is classified.

## Extends

- [`RecoverableError`](RecoverableError.md)

## Constructors

### Constructor

```ts
new AccessTimeoutError(message, options): AccessTimeoutError;
```

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `message` | `string` |
| `options` | \{ `cause?`: `unknown`; `elapsedMs`: `number`; \} |
| `options.cause?` | `unknown` |
| `options.elapsedMs` | `number` |

#### Returns

`AccessTimeoutError`

#### Overrides

```ts
RecoverableError.constructor
```

## Properties

| Property | Modifier | Type | Description |
| ------ | ------ | ------ | ------ |
| <a id="elapsedms"></a> `elapsedMs` | `readonly` | `number` | Milliseconds elapsed between dispatch and the deadline firing. |

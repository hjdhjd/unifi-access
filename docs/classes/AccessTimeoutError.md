[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessTimeoutError

# Class: AccessTimeoutError

Our own request deadline elapsed before the controller responded. Distinct from [AccessAbortedError](AccessAbortedError.md): this fires when the library's internal
`AbortSignal.timeout()` wins the race, whereas an aborted error fires when the caller's signal wins. The transport tells the two apart by checking whether the
caller's own `AbortSignal` is already aborted: if it is, the cancellation came from the caller; if not, the library's timeout won.

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

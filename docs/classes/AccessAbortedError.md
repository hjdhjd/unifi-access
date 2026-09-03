[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessAbortedError

# Class: AccessAbortedError

The caller's `AbortSignal` fired. The operation was cancelled by the consumer, not by the library's own deadline. Recoverable in the sense that the caller chose
to stop - re-issuing the operation with a fresh signal is valid.

## Extends

- [`RecoverableError`](RecoverableError.md)

## Constructors

### Constructor

```ts
new AccessAbortedError(message, options?): AccessAbortedError;
```

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `message` | `string` |
| `options?` | \{ `cause?`: `unknown`; \} |
| `options.cause?` | `unknown` |

#### Returns

`AccessAbortedError`

#### Overrides

```ts
RecoverableError.constructor
```

[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessConfigurationError

# Class: AccessConfigurationError

A connect option the library cannot act on, refused by [AccessClient.connect](AccessClient.md#connect) before any request is sent: a controller address no URL can
carry, such as an IPv6 literal with a zone (`fe80::1%en0`) or a value carrying credentials, a path, a query or a fragment. The message names the address.
Fatal because the same configuration is refused the same way on every attempt, so the caller corrects it rather than retrying.

## Extends

- [`FatalError`](FatalError.md)

## Constructors

### Constructor

```ts
new AccessConfigurationError(message, options?): AccessConfigurationError;
```

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `message` | `string` |
| `options?` | \{ `cause?`: `unknown`; \} |
| `options.cause?` | `unknown` |

#### Returns

`AccessConfigurationError`

#### Overrides

```ts
FatalError.constructor
```

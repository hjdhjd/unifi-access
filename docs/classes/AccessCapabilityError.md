[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessCapabilityError

# Class: AccessCapabilityError

A requested operation has no path this client can carry it on. Fatal because it describes what this client is rather than what the controller did: the same call
will fail the same way for as long as the client lives, and a fresh connect with different options is what changes the answer.

Three things put an operation out of reach. The client may lack the channel the operation needs at all - an attributed unlock has no direct-path expression, so a
credential-only client cannot issue one. The routing override may have pinned the client away from the only channel that could carry it. Or the addressed device
may sit below the endpoint's firmware floor, leaving an operation that had exactly one capable path with none.

The error carries a message and nothing else, deliberately. What a caller needs in order to act is which capabilities this client has, and that is a question
about the client rather than about one failed call - so it is answered by the capability map the client publishes, in one place, rather than by fields duplicated
onto every refusal. The message names the operation, the capability it wanted, and the mode that could not supply it.

## Extends

- [`FatalError`](FatalError.md)

## Constructors

### Constructor

```ts
new AccessCapabilityError(message, options?): AccessCapabilityError;
```

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `message` | `string` |
| `options?` | \{ `cause?`: `unknown`; \} |
| `options.cause?` | `unknown` |

#### Returns

`AccessCapabilityError`

#### Overrides

```ts
FatalError.constructor
```

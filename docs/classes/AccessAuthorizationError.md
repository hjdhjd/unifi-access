[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessAuthorizationError

# Class: AccessAuthorizationError

The identity authenticated but lacks the privilege the operation requires (typically a `403`; Access reserves many operations for administrator accounts).
Fatal because the same identity will keep being refused. [AccessAuthorizationError.identity](#identity) names which one fell short, so a caller reporting the failure
can point at the remedy that applies.

## Extends

- [`FatalError`](FatalError.md)

## Constructors

### Constructor

```ts
new AccessAuthorizationError(message, options?): AccessAuthorizationError;
```

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `message` | `string` |
| `options?` | \{ `cause?`: `unknown`; `identity?`: [`AccessIdentityLeg`](../type-aliases/AccessIdentityLeg.md); `statusCode?`: `number`; \} |
| `options.cause?` | `unknown` |
| `options.identity?` | [`AccessIdentityLeg`](../type-aliases/AccessIdentityLeg.md) |
| `options.statusCode?` | `number` |

#### Returns

`AccessAuthorizationError`

#### Overrides

```ts
FatalError.constructor
```

## Properties

| Property | Modifier | Type | Description |
| ------ | ------ | ------ | ------ |
| <a id="identity"></a> `identity` | `readonly` | [`AccessIdentityLeg`](../type-aliases/AccessIdentityLeg.md) \| `undefined` | Which identity leg the controller refused - `"credentials"` when the signed-in account lacks the privilege, typically a role short of administrator, `"token"` when the official API's bearer token was not issued the permission the endpoint requires - or `undefined` when the constructing caller attributed none. The leg is what splits the remedy: grant the account the role, versus reissue the token with the permission. And a `403` implies something a `401` does not, whichever leg it names - that identity authenticated, because a controller refusing an operation on privilege grounds has already accepted who is asking. |
| <a id="statuscode"></a> `statusCode` | `readonly` | `number` \| `undefined` | The HTTP status that triggered the classification, when the failure originated from a response (typically `403`). |

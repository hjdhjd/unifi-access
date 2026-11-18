[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessAuthorizationError

# Class: AccessAuthorizationError

The identity authenticated but lacks the privilege the operation requires (a `403`, or a token's `401` the library settled as a missing permission; Access reserves
many operations for administrator accounts). Fatal because the same identity will keep being refused. [AccessAuthorizationError.identity](#identity) names which one fell
short, so a caller reporting the failure can point at the remedy that applies. At connect, a client whose direct path can serve folds a token refused a permission
into credentials-only operation with a warning; on a routed door command the same client sends its door commands to that path with a warning, and a routed
access-method write refused one takes its own direct path instead, so a consumer meets this error for a token only from a token-only client, from a client held to
the official API, or from the official facade called directly.

The controller answers a token missing a permission with the same 401 it answers a refused token with, so the library asks it for the door listing, which every
token must be allowed, and reports the 401 here, at that status, when the listing still serves the token. Where the official API's refusal carries its result
envelope, the error carries that refusal as an [AccessApiError](AccessApiError.md) in its `cause`.

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

`FatalError.constructor`

## Properties

| Property | Modifier | Type | Description |
| ------ | ------ | ------ | ------ |
| <a id="identity"></a> `identity` | `readonly` | [`AccessIdentityLeg`](../type-aliases/AccessIdentityLeg.md) \| `undefined` | Which identity leg the controller refused - `"credentials"` when the signed-in account lacks the privilege, typically a role short of administrator, `"token"` when the official API's bearer token was not issued the permission the endpoint requires - or `undefined` when the constructing caller attributed none. The leg is what splits the remedy: grant the account the role, versus reissue the token with the permission. And this error implies something an [AccessAuthError](AccessAuthError.md) does not, whichever leg it names and whichever status it carries - that identity authenticated, because a controller refusing an operation on privilege grounds has already accepted who is asking. |
| <a id="statuscode"></a> `statusCode` | `readonly` | `number` \| `undefined` | The HTTP status that triggered the classification, when the failure originated from a response (a `403`, or a `401` for a token refused a permission). |

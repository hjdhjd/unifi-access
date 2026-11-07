[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessAuthError

# Class: AccessAuthError

Authentication failed: invalid credentials, an expired session that could not be renewed, a CSRF-token rotation that did not complete, or an API token the
controller refused. Fatal because retrying with the same identity reproduces the failure. [AccessAuthError.identity](#identity) names which identity was the refused
one, so a caller reporting the failure can point at the right one. At connect and on a routed command alike, a client whose direct path can serve folds a refused
token into credentials-only operation with a warning, so a consumer meets this error for a token only from a token-only client, from a client held to the official
API, or from the official facade called directly.

## Extends

- [`FatalError`](FatalError.md)

## Constructors

### Constructor

```ts
new AccessAuthError(message, options?): AccessAuthError;
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

`AccessAuthError`

#### Overrides

`FatalError.constructor`

## Properties

| Property | Modifier | Type | Description |
| ------ | ------ | ------ | ------ |
| <a id="identity"></a> `identity` | `readonly` | [`AccessIdentityLeg`](../type-aliases/AccessIdentityLeg.md) \| `undefined` | Which identity leg the controller refused - `"credentials"` for the direct login session, `"token"` for the official API's bearer token - or `undefined` when the constructing caller attributed none. A token-tagged failure reaches a consumer from a token-only client, at connect or on any routed command; from a client held to the official API by its override, whichever identities it holds, at connect or on any routed command; and from the official facade called directly, on any client. Everywhere else the client holds a direct path that can carry on without the token, and it folds the refusal into credentials-only operation with a warning rather than raising it. |
| <a id="statuscode"></a> `statusCode` | `readonly` | `number` \| `undefined` | The HTTP status that triggered the classification, when the failure originated from a response (typically `401`). |

[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessAuthError

# Class: AccessAuthError

Authentication failed: invalid credentials, an expired session that could not be renewed, a CSRF-token rotation that did not complete, or an API token the
controller refused. Fatal because retrying with the same identity reproduces the failure. [AccessAuthError.identity](#identity) names which identity was the refused
one, so a caller reporting the failure can point at the right one.

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

```ts
FatalError.constructor
```

## Properties

| Property | Modifier | Type | Description |
| ------ | ------ | ------ | ------ |
| <a id="identity"></a> `identity` | `readonly` | [`AccessIdentityLeg`](../type-aliases/AccessIdentityLeg.md) \| `undefined` | Which identity leg the controller refused - `"credentials"` for the direct login session, `"token"` for the official API's bearer token - or `undefined` when the constructing caller attributed none. `AccessClient.connect()` logs in with credentials before the official read that verifies the token, so a token-tagged failure from a connect holding both identities carries a second fact by implication: the credentials themselves authenticated, because the login they authenticated is what the refused read ran after. |
| <a id="statuscode"></a> `statusCode` | `readonly` | `number` \| `undefined` | The HTTP status that triggered the classification, when the failure originated from a response (typically `401`). |

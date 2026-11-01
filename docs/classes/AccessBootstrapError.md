[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessBootstrapError

# Class: AccessBootstrapError

The bootstrap sequence failed while fetching, parsing, or applying the controller bootstrap documents. `stage` marks which - `"fetch"` when the controller
declines to hand a document over, by a non-2xx status (an [AccessRequestError](AccessRequestError.md) for any status other than a refused identity or privilege) or inside the
envelope it answered a 2xx with, `"parse"` when the body cannot be decoded, `"apply"` when a decoded document cannot be folded into the state model - so the
caller can report the precise point of failure rather than a generic "connect failed." A login or reachability failure is not wrapped here: a transport-level
failure reaching the endpoint propagates as its own typed error, and a login failure as [AccessAuthError](AccessAuthError.md) when the controller refused the sign-in or as
[AccessRequestError](AccessRequestError.md) when it answered with a status that is no verdict on the credentials.

## Extends

- [`FatalError`](FatalError.md)

## Constructors

### Constructor

```ts
new AccessBootstrapError(message, options): AccessBootstrapError;
```

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `message` | `string` |
| `options` | \{ `cause?`: `unknown`; `stage`: [`AccessBootstrapStage`](../type-aliases/AccessBootstrapStage.md); \} |
| `options.cause?` | `unknown` |
| `options.stage` | [`AccessBootstrapStage`](../type-aliases/AccessBootstrapStage.md) |

#### Returns

`AccessBootstrapError`

#### Overrides

```ts
FatalError.constructor
```

## Properties

| Property | Modifier | Type | Description |
| ------ | ------ | ------ | ------ |
| <a id="stage"></a> `stage` | `readonly` | [`AccessBootstrapStage`](../type-aliases/AccessBootstrapStage.md) | The stage of the connect sequence at which the failure occurred. |

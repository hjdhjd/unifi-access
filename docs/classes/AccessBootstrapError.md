[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessBootstrapError

# Class: AccessBootstrapError

The bootstrap sequence failed while fetching, parsing, or applying the controller bootstrap documents. `stage` marks which - `"fetch"` when the bootstrap endpoint
returns a non-2xx status or the transport fails reaching it, `"parse"` when the body cannot be decoded, `"apply"` when a decoded document cannot be folded into the
state model - so the caller can report the precise point of failure rather than a generic "connect failed." A login or reachability failure is not wrapped here; it
propagates as its own typed fatal.

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

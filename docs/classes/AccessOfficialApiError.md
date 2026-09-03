[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessOfficialApiError

# Class: AccessOfficialApiError

The official API refused a request. Its result envelope carries a `code` on every response, and a code other than success is the controller declining in its own
vocabulary rather than through an HTTP status - the status on such a response is a 2xx, so nothing below this layer can classify it. Fatal because the refusal
describes the request rather than the moment: the same call will be refused the same way.

The controller's own `msg` is the error's message, carried through the message channel rather than duplicated into a second field, and `code` is the typed
vocabulary a caller branches on. Two of those codes are capability signals rather than faults, and are worth naming here because a consumer will want to route
them rather than report them:

- `CODE_OTHERS_UID_ADOPTED_NOT_SUPPORTED` - the official API does not exist on this controller at all, which is what an Identity Enterprise controller answers.
- `CODE_DEVICE_API_NOT_SUPPORTED` - the addressed device sits below the endpoint's firmware floor.

Both still throw from the request path, because a request that did not happen is a failure from the caller's point of view whatever the reason. What the typed
code buys is that a layer deciding which capabilities a controller has can branch on them with compile-time narrowing rather than by matching strings.

## Extends

- [`FatalError`](FatalError.md)

## Constructors

### Constructor

```ts
new AccessOfficialApiError(message, options): AccessOfficialApiError;
```

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `message` | `string` |
| `options` | \{ `cause?`: `unknown`; `code`: [`AccessOfficialApiCode`](../type-aliases/AccessOfficialApiCode.md); \} |
| `options.cause?` | `unknown` |
| `options.code` | [`AccessOfficialApiCode`](../type-aliases/AccessOfficialApiCode.md) |

#### Returns

`AccessOfficialApiError`

#### Overrides

```ts
FatalError.constructor
```

## Properties

| Property | Modifier | Type | Description |
| ------ | ------ | ------ | ------ |
| <a id="code"></a> `code` | `readonly` | [`AccessOfficialApiCode`](../type-aliases/AccessOfficialApiCode.md) | The official API's own result code, as the controller spelled it. |

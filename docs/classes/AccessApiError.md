[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessApiError

# Class: AccessApiError

The controller refused a request inside its result envelope - on the official developer API and on the Access application's own endpoints alike, which write one
envelope between them. The envelope carries a `code` on every response, and a code other than success is the controller declining in its own vocabulary rather
than through an HTTP status: the status on such a response is a 2xx, so nothing below this layer can classify it. Fatal because the refusal describes the request
rather than the moment: the same call will be refused the same way.

The controller's own `msg` is the error's message, carried through the message channel rather than duplicated into a second field, and `code` is the typed vocabulary a
caller branches on. Some of those codes are capability signals rather than faults, worth naming here because a consumer will want to route them rather than report
them, and the official API answers each of them:

- `CODE_OTHERS_UID_ADOPTED_NOT_SUPPORTED` - the official API does not exist on this controller at all, which is what an Identity Enterprise controller answers.
- `CODE_DEVICE_API_NOT_SUPPORTED` - the addressed device sits below the endpoint's firmware floor.

Each still throws from the request path, because a request that did not happen is a failure from the caller's point of view whatever the reason. What the typed code
buys is that a layer deciding which capabilities a controller has can branch on them with compile-time narrowing rather than by matching strings.

## Extends

- [`FatalError`](FatalError.md)

## Constructors

### Constructor

```ts
new AccessApiError(message, options): AccessApiError;
```

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `message` | `string` |
| `options` | \{ `cause?`: `unknown`; `code`: [`AccessApiCode`](../type-aliases/AccessApiCode.md); `detail?`: `string`; \} |
| `options.cause?` | `unknown` |
| `options.code` | [`AccessApiCode`](../type-aliases/AccessApiCode.md) |
| `options.detail?` | `string` |

#### Returns

`AccessApiError`

#### Overrides

```ts
FatalError.constructor
```

## Properties

| Property | Modifier | Type | Description |
| ------ | ------ | ------ | ------ |
| <a id="code"></a> `code` | `readonly` | [`AccessApiCode`](../type-aliases/AccessApiCode.md) | The official API's own result code, as the controller spelled it. |
| <a id="detail"></a> `detail` | `readonly` | `string` \| `undefined` | The controller's own diagnostic text, trimmed of the whitespace the wire pads it with and otherwise unparsed, when the refusal sent one beside its message. Undefined when it sent none, or sent nothing but whitespace. |

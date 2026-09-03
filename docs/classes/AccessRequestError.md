[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessRequestError

# Class: AccessRequestError

The controller returned an error status the library does not classify more specifically (a 4xx other than 401/403, or any 5xx). The status, body, and headers are
preserved so the caller can inspect the controller's own explanation.

## Extends

- [`FatalError`](FatalError.md)

## Constructors

### Constructor

```ts
new AccessRequestError(message, options): AccessRequestError;
```

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `message` | `string` |
| `options` | \{ `body?`: `unknown`; `cause?`: `unknown`; `headers?`: `Record`\<`string`, `string`\>; `statusCode`: `number`; \} |
| `options.body?` | `unknown` |
| `options.cause?` | `unknown` |
| `options.headers?` | `Record`\<`string`, `string`\> |
| `options.statusCode` | `number` |

#### Returns

`AccessRequestError`

#### Overrides

```ts
FatalError.constructor
```

## Properties

| Property | Modifier | Type | Description |
| ------ | ------ | ------ | ------ |
| <a id="body"></a> `body` | `readonly` | `unknown` | The response body, when one was read. Left as `unknown` because it may be parsed JSON, raw text, or absent. |
| <a id="headers"></a> `headers` | `readonly` | `Readonly`\<`Record`\<`string`, `string`\>\> \| `undefined` | The response headers, when captured. |
| <a id="statuscode"></a> `statusCode` | `readonly` | `number` | The HTTP status code the controller returned. |

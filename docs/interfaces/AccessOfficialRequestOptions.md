[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessOfficialRequestOptions

# Interface: AccessOfficialRequestOptions

Per-request options for an official request: everything the transport accepts, plus the two encodings this layer owns.

At most one of `body`, `form`, and `json` may be present. They are three ways of saying what the request carries, so supplying two is a caller defect rather
than a wire condition, and it throws a `TypeError` naming the conflict rather than silently letting one win.

## Extends

- `RequestOptions`

## Properties

| Property | Type | Inherited from |
| ------ | ------ | ------ |
| <a id="body"></a> `body?` | `string` \| `Uint8Array`\<`ArrayBufferLike`\> | `RequestOptions.body` |
| <a id="form"></a> `form?` | readonly [`AccessOfficialFormPart`](AccessOfficialFormPart.md)[] | - |
| <a id="headers"></a> `headers?` | `Record`\<`string`, `string`\> | `RequestOptions.headers` |
| <a id="json"></a> `json?` | `unknown` | - |
| <a id="method"></a> `method?` | `HttpMethod` | `RequestOptions.method` |
| <a id="retry"></a> `retry?` | `boolean` | `RequestOptions.retry` |
| <a id="signal"></a> `signal?` | `AbortSignal` | `RequestOptions.signal` |
| <a id="timeout"></a> `timeout?` | `number` | `RequestOptions.timeout` |

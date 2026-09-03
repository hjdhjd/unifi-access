[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessOfficialFormPart

# Interface: AccessOfficialFormPart

One part of a multipart upload: the bytes, the form field the endpoint reads them from, and the filename the part is announced under.

`filename` is required because every multipart endpoint the API documents takes a named file, and a receiver that reads uploads by filename has nothing to read
from a part that omits it. The name belongs to the caller, which read the file and knows what it is called, so no method here invents one.

## Properties

| Property | Type |
| ------ | ------ |
| <a id="data"></a> `data` | `string` \| `Uint8Array`\<`ArrayBufferLike`\> |
| <a id="field"></a> `field` | `string` |
| <a id="filename"></a> `filename` | `string` |

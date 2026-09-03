[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessOfficialFileUpload

# Interface: AccessOfficialFileUpload

A file a caller hands to a multipart endpoint: its bytes and the name to announce it under.

This is the caller's half of [AccessOfficialFormPart](AccessOfficialFormPart.md) - the form field a part is sent under is the endpoint's business, so the method supplies it and the
caller supplies only what it actually knows.

## Properties

| Property | Type |
| ------ | ------ |
| <a id="data"></a> `data` | `string` \| `Uint8Array`\<`ArrayBufferLike`\> |
| <a id="filename"></a> `filename` | `string` |

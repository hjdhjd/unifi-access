[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessHttpRequestCommon

# Interface: AccessHttpRequestCommon

The fields every request payload carries, named once here so the start payload and the end payload cannot drift apart on the identity of the request they
describe. `requestId` is what correlates the two.

## Properties

| Property | Type |
| ------ | ------ |
| <a id="method"></a> `method` | `string` |
| <a id="requestid"></a> `requestId` | `string` |
| <a id="url"></a> `url` | `string` |

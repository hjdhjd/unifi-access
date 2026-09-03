[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessApiResponseInterface

# Interface: AccessApiResponseInterface

A description of the UniFi Access API response JSON, the envelope wrapping the result of a REST call.

`data` carries an object for single-record endpoints and an array for collection endpoints; both are confirmed against the wire. The string form is declared from the
native interface and has not been observed. Note that the authenticated user endpoint does not use this envelope at all - it returns
[AccessUserConfigInterface](AccessUserConfigInterface.md) as the entire response body.

## Properties

| Property | Type |
| ------ | ------ |
| <a id="code"></a> `code` | `number` |
| <a id="codes"></a> `codeS` | `string` |
| <a id="data"></a> `data` | \| `string` \| `Record`\<`string`, `unknown`\> \| `Record`\<`string`, `unknown`\>[] |
| <a id="error"></a> `error` | `string` |
| <a id="msg"></a> `msg` | `string` |

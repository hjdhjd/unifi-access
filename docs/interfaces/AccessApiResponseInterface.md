[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessApiResponseInterface

# Interface: AccessApiResponseInterface

The one result envelope the controller's application writes on both of its surfaces, in the native dialect: a numeric `code` carrying the `CODE_*` vocabulary
string beside it in `codeS`.

Those two members are the only ones anything verifies, because together they are what identifies the envelope. Every other member is declared as the controller
leaves it, unverified and typed as `unknown`, and is read defensively by whoever consumes it. `code`, `codeS`, `msg` and `error` arrive on every capture in hand;
`data` only on the ones that reported success, a refusal carrying none at all; `cloud_code` on the direct refusal captured on 2026-09-16, and `source` on the
official refusal captured on 2026-09-15, each an empty string there and read by nothing. `pagination` is declared because either dialect can answer either
outcome and the official listing endpoints report a page beside their results, no native page report having been observed.

Note that the authenticated user endpoint does not use this envelope at all - it returns [AccessUserConfigInterface](AccessUserConfigInterface.md) as the entire response body.

## Properties

| Property | Type |
| ------ | ------ |
| <a id="cloud_code"></a> `cloud_code?` | `unknown` |
| <a id="code"></a> `code` | `number` |
| <a id="codes"></a> `codeS` | `string` |
| <a id="data"></a> `data?` | `unknown` |
| <a id="error"></a> `error?` | `unknown` |
| <a id="msg"></a> `msg?` | `unknown` |
| <a id="pagination"></a> `pagination?` | `unknown` |
| <a id="source"></a> `source?` | `unknown` |

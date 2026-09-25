[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessCapabilities

# Interface: AccessCapabilities

What a client can do, as established at connect.

This is a SNAPSHOT rather than a live reading, and the distinction matters. `official` says the official path was present and working when the client connected -
a token was supplied, and the read that verifies it succeeded. It reads `false` on a client with no token, and on one whose connect folded that read's failure: a
client holding credentials whose controller answered as an Identity Enterprise deployment does, that it has no official API, or a client whose direct path can
serve and whose token the controller refused. It deliberately does not move afterward: an official path closed mid-life, whether by an Identity Enterprise
controller's report or by the token rejected or refused a permission on a client that can fall back to its credentials, or a device found to sit below a firmware
floor, changes what the routing service will attempt without rewriting the client's own description of itself. A consumer reading this is asking what kind of
client it holds, which is a question with a stable answer.

## Properties

| Property | Modifier | Type |
| ------ | ------ | ------ |
| <a id="mode"></a> `mode` | `readonly` | [`AccessApiMode`](../type-aliases/AccessApiMode.md) |
| <a id="official"></a> `official` | `readonly` | `boolean` |
| <a id="override"></a> `override` | `readonly` | [`AccessApiOverride`](../type-aliases/AccessApiOverride.md) |

[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessCapabilities

# Interface: AccessCapabilities

What a client can do, as established at connect.

This is a SNAPSHOT rather than a live reading, and the distinction matters. `official` says the official path was present and working when the client connected -
a token was supplied and the controller did not refuse it as an Identity Enterprise deployment does. It deliberately does not move afterward: a session revoked
mid-life, or a device found to sit below a firmware floor, changes what the routing service will attempt without rewriting the client's own description of itself.
A consumer reading this is asking what kind of client it holds, which is a question with a stable answer.

## Properties

| Property | Modifier | Type |
| ------ | ------ | ------ |
| <a id="mode"></a> `mode` | `readonly` | [`AccessApiMode`](../type-aliases/AccessApiMode.md) |
| <a id="official"></a> `official` | `readonly` | `boolean` |
| <a id="override"></a> `override` | `readonly` | [`AccessApiOverride`](../type-aliases/AccessApiOverride.md) |

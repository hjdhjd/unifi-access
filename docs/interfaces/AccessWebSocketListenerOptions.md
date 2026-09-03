[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessWebSocketListenerOptions

# Interface: AccessWebSocketListenerOptions

The listener-registration options the stream uses - a subset of the standard `addEventListener` options. `signal` is how one `AbortController` detaches every
listener at once, which is the stream's whole teardown mechanism.

## Properties

| Property | Type |
| ------ | ------ |
| <a id="once"></a> `once?` | `boolean` |
| <a id="signal"></a> `signal?` | `AbortSignal` |

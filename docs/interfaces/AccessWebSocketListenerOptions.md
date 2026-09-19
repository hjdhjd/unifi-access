[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessWebSocketListenerOptions

# Interface: AccessWebSocketListenerOptions

The listener-registration options the stream uses - a subset of the standard `addEventListener` options. `once` is the only one it passes, for the events a
socket reports a single time. Detaching is the stream's own explicit act through `removeEventListener` rather than an option handed to the registration, so
an implementation of this surface owes nothing beyond honoring `once`.

## Properties

| Property | Type |
| ------ | ------ |
| <a id="once"></a> `once?` | `boolean` |

[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessWebSocketMessageEvent

# Interface: AccessWebSocketMessageEvent

The message event delivered to a `message` listener. The notification protocol is JSON text, so a frame's `data` normally arrives as a string; we accept any
shape and normalize it to text before decoding.

## Properties

| Property | Type |
| ------ | ------ |
| <a id="data"></a> `data` | `unknown` |

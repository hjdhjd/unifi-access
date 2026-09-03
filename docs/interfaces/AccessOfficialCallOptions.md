[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessOfficialCallOptions

# Interface: AccessOfficialCallOptions

Per-call options accepted by every official domain method, always as the method's last parameter.

The payload bags that precede it say what a request tells the controller; this says how the call behaves. Keeping the two apart is what makes it impossible for
a per-call concern to reach the wire: no payload type carries these members, so nothing here can leak into a body or a query string.

`signal` is the caller's cancellation, composed with the transport's own timeout and classified as the caller's act when it fires.

## Properties

| Property | Type |
| ------ | ------ |
| <a id="signal"></a> `signal?` | `AbortSignal` |

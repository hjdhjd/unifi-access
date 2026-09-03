[**unifi-access**](../README.md)

***

[Home](../README.md) / ConnectionTransition

# Interface: ConnectionTransition

One edge of the connection state machine, carried on the `stateChanged` rail and yielded by [ConnectionMonitor.observe](ConnectionMonitor.md#observe). `reason` is present when a typed
fault - a stall, a failed reachability probe - is what drove the edge.

## Properties

| Property | Type |
| ------ | ------ |
| <a id="from"></a> `from` | [`ConnectionState`](../type-aliases/ConnectionState.md) |
| <a id="reason"></a> `reason?` | `string` |
| <a id="to"></a> `to` | [`ConnectionState`](../type-aliases/ConnectionState.md) |

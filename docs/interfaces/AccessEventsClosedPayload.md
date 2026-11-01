[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessEventsClosedPayload

# Interface: AccessEventsClosedPayload

Payload published on [channels.eventsClosed](../variables/channels.md#property-eventsclosed). When the controller closes the stream unprompted, `code` and `reason` carry the peer's WebSocket close
frame. When the stream closes itself, they carry the library's own classification instead: `1000` for a teardown it chose (an explicit `close()` or the
caller's cancel of a connect in flight) and `1006` for one a failure forced (a socket error or a watchdog stall), with a reason describing what ended it.

## Properties

| Property | Type |
| ------ | ------ |
| <a id="code"></a> `code` | `number` |
| <a id="host"></a> `host` | `string` |
| <a id="reason"></a> `reason` | `string` |

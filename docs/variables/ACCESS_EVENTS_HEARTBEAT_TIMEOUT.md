[**unifi-access**](../README.md)

***

[Home](../README.md) / ACCESS\_EVENTS\_HEARTBEAT\_TIMEOUT

# Variable: ACCESS\_EVENTS\_HEARTBEAT\_TIMEOUT

```ts
const ACCESS_EVENTS_HEARTBEAT_TIMEOUT: 10000 = 10000;
```

Events WebSocket heartbeat watchdog timeout, in milliseconds. The controller heartbeats its realtime events channel on roughly a five-second cadence, so this
window tolerates exactly one missed beat before the channel is presumed dead and the socket is torn down for a fresh connection. Sitting at twice the cadence is
deliberate: a tighter window would trip on ordinary scheduling and network jitter between healthy beats, while a looser one would leave a consumer reading state
that has silently stopped updating for longer than the reconnect it defers.

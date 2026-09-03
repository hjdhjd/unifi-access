[**unifi-access**](../README.md)

***

[Home](../README.md) / ConnectionEvents

# Interface: ConnectionEvents

The events [ConnectionMonitor](ConnectionMonitor.md) publishes on its three-rail surface.

- `stateChanged` fires on every edge of the state machine.
- `controllerLost` fires once when the controller is concluded unreachable, carrying the fault that settled it.
- `controllerRebooted` fires when the controller's reported uptime falls far enough to read as a restart, carrying both readings.
- `controllerRecovered` fires when the connection returns to healthy after having been lost.
- `throttleEntered` and `throttleExited` forward the transport breaker's own transitions.

## Properties

| Property | Type |
| ------ | ------ |
| <a id="controllerlost"></a> `controllerLost` | \[[`AccessError`](../classes/AccessError.md)\] |
| <a id="controllerrebooted"></a> `controllerRebooted` | \[\{ `newUptime`: `number`; `previousUptime`: `number`; \}\] |
| <a id="controllerrecovered"></a> `controllerRecovered` | \[\] |
| <a id="statechanged"></a> `stateChanged` | \[[`ConnectionTransition`](ConnectionTransition.md)\] |
| <a id="throttleentered"></a> `throttleEntered` | \[\] |
| <a id="throttleexited"></a> `throttleExited` | \[\] |

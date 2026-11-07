[**unifi-access**](../README.md)

***

[Home](../README.md) / ConnectionEvents

# Interface: ConnectionEvents

The events [ConnectionMonitor](ConnectionMonitor.md) publishes on its three-rail surface.

- `stateChanged` fires on every edge of the state machine.
- `controllerLost` fires when the controller is concluded lost, and again whenever the class the loss is announced as changes, carrying the fault that settled
  it.
- `controllerRebooted` fires when the controller's reported uptime falls far enough to read as a restart, carrying both readings.
- `controllerRecovered` fires when recovery completes after the connection was lost, into `healthy` or into `throttled` when the transport's breaker is open.
- `throttleEntered` and `throttleExited` forward the transport breaker's own transitions.

## Properties

| Property | Type |
| ------ | ------ |
| <a id="controllerlost"></a> `controllerLost` | \[`reason`: [`AccessError`](../classes/AccessError.md)\] |
| <a id="controllerrebooted"></a> `controllerRebooted` | \[`info`: \{ `newUptime`: `number`; `previousUptime`: `number`; \}\] |
| <a id="controllerrecovered"></a> `controllerRecovered` | \[\] |
| <a id="statechanged"></a> `stateChanged` | \[`transition`: [`ConnectionTransition`](ConnectionTransition.md)\] |
| <a id="throttleentered"></a> `throttleEntered` | \[\] |
| <a id="throttleexited"></a> `throttleExited` | \[\] |

[**unifi-access**](../README.md)

***

[Home](../README.md) / ConnectionState

# Type Alias: ConnectionState

```ts
type ConnectionState = RecoveryPhase | "throttled";
```

The connection's observable state. `healthy` is steady operation; `degraded` means a fault was seen and reachability is being probed; `reconnecting` means the
controller answered and the monitor is re-bootstrapping and relaunching the notification stream; `lost` means the controller is unreachable and recovery is
polling for its return; `throttled` means the transport's breaker is open and holding requests back. The throttle verdict is read live from the transport and
takes precedence only while nothing else is wrong.

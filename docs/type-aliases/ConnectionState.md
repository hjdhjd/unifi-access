[**unifi-access**](../README.md)

***

[Home](../README.md) / ConnectionState

# Type Alias: ConnectionState

```ts
type ConnectionState = RecoveryPhase | "throttled";
```

The connection's observable state. `healthy` is steady operation; `degraded` means a fault was seen and reachability is being probed; `reconnecting` means the
controller answered and the monitor is re-bootstrapping and relaunching the notification stream; `lost` means a recovery attempt failed, and recovery is
retrying on the schedule its cause calls for, the lost line and `controllerLost` naming the class that cause is announced as; `throttled` means the transport's
breaker is open and holding requests back. The throttle verdict is read live from the transport and takes precedence only while nothing else is wrong.

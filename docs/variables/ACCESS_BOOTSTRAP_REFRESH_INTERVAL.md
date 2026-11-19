[**unifi-access**](../README.md)

***

[Home](../README.md) / ACCESS\_BOOTSTRAP\_REFRESH\_INTERVAL

# Variable: ACCESS\_BOOTSTRAP\_REFRESH\_INTERVAL

```ts
const ACCESS_BOOTSTRAP_REFRESH_INTERVAL: 120000 = 120000;
```

Interval, in milliseconds, between the state store's periodic re-read of what the client seeded from - the topology and controller documents where it holds
credentials, the official API's listings where it holds only a token. The controller's realtime notification channel is occasionally lossy, so a library that
only ever folded notifications would drift away from the controller with no way back. Re-reading on a fixed cadence is the failsafe against that, and the library
owns the cadence rather than leaving each consumer to schedule its own: the reducer reconciles a refresh that found no drift without touching a device or door
record, so an unnecessary refresh wakes no observer of either. The controller document carries the host's uptime and usually differs, so on a credential refresh
the state reference, the dispatch channel, and the store's debug line still move. Two minutes is short enough that a missed notification is corrected well
inside the window anyone would notice a stale door in, and long enough that the polling is negligible beside the realtime channel carrying the ordinary case.

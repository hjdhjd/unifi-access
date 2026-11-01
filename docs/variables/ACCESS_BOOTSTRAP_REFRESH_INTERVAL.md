[**unifi-access**](../README.md)

***

[Home](../README.md) / ACCESS\_BOOTSTRAP\_REFRESH\_INTERVAL

# Variable: ACCESS\_BOOTSTRAP\_REFRESH\_INTERVAL

```ts
const ACCESS_BOOTSTRAP_REFRESH_INTERVAL: 120000 = 120000;
```

Interval, in milliseconds, between the state store's periodic re-fetch of the topology document. The controller's realtime notification channel is occasionally
lossy, so a library that only ever folded notifications would drift away from the controller with no way back. Re-reading the document on a fixed cadence is the
failsafe against that, and the library owns the cadence rather than leaving each consumer to schedule its own: the reducer reconciles a refresh that found no
drift down to the identical state reference, so an unnecessary refresh costs one request and produces no observable change at all. Two minutes is short enough
that a missed notification is corrected well inside the window anyone would notice a stale door in, and long enough that the polling is negligible beside the
realtime channel carrying the ordinary case.

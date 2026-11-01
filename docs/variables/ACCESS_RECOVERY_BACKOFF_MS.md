[**unifi-access**](../README.md)

***

[Home](../README.md) / ACCESS\_RECOVERY\_BACKOFF\_MS

# Variable: ACCESS\_RECOVERY\_BACKOFF\_MS

```ts
const ACCESS_RECOVERY_BACKOFF_MS: number[];
```

The delays, in milliseconds, before each successive attempt to recover a faulted connection, after which recovery settles onto
[ACCESS\_RECOVERY\_STEADY\_INTERVAL\_MS](ACCESS_RECOVERY_STEADY_INTERVAL_MS.md) and polls at it for as long as it lives. The leading zero is "probe at once": a fault is most often a momentary drop that
the very next attempt resolves, so waiting before the first attempt would add latency to the common case for no benefit. The staged delays that follow back off
through the window a controller takes to restart a service, and that steady interval is where recovery settles for an outage of any length - a controller that
returns after an hour is picked up within one interval of returning rather than after a curve that has grown without bound.

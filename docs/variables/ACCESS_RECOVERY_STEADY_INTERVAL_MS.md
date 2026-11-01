[**unifi-access**](../README.md)

***

[Home](../README.md) / ACCESS\_RECOVERY\_STEADY\_INTERVAL\_MS

# Variable: ACCESS\_RECOVERY\_STEADY\_INTERVAL\_MS

```ts
const ACCESS_RECOVERY_STEADY_INTERVAL_MS: 60000 = 60000;
```

The interval, in milliseconds, the recovery loop polls at once it has walked out the staged delays [ACCESS\_RECOVERY\_BACKOFF\_MS](ACCESS_RECOVERY_BACKOFF_MS.md) holds. One minute is short
enough that a returning controller is picked up promptly and long enough that polling an absent one indefinitely costs nothing worth measuring.

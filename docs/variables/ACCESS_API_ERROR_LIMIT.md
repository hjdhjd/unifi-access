[**unifi-access**](../README.md)

***

[Home](../README.md) / ACCESS\_API\_ERROR\_LIMIT

# Variable: ACCESS\_API\_ERROR\_LIMIT

```ts
const ACCESS_API_ERROR_LIMIT: 10 = 10;
```

Number of consecutive requests the controller did not serve - no answer, a 5xx or a 429 - to accept before backing off, so a struggling Access controller is never
met with a retry storm on top of whatever is already wrong with it. The count is consecutive rather than cumulative: a single request the controller served clears
it, so ordinary isolated failures on a busy controller never accumulate their way into the cooldown window [ACCESS\_API\_RETRY\_INTERVAL](ACCESS_API_RETRY_INTERVAL.md) sets, and only sustained
failure - the shape that actually means the controller is unwell - opens it.

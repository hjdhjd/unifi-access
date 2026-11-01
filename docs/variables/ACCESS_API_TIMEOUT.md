[**unifi-access**](../README.md)

***

[Home](../README.md) / ACCESS\_API\_TIMEOUT

# Variable: ACCESS\_API\_TIMEOUT

```ts
const ACCESS_API_TIMEOUT: 3500 = 3500;
```

Access API response timeout, in milliseconds, bounding every request so a wedged connection surfaces as a prompt, typed timeout rather than hanging its caller
indefinitely. This should never be greater than 5000 ms: a healthy controller answers well inside that window even under load, so a longer deadline buys no
additional successes and only delays the recovery a timeout is meant to trigger.

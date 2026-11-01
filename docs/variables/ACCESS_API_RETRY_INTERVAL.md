[**unifi-access**](../README.md)

***

[Home](../README.md) / ACCESS\_API\_RETRY\_INTERVAL

# Variable: ACCESS\_API\_RETRY\_INTERVAL

```ts
const ACCESS_API_RETRY_INTERVAL: 300 = 300;
```

Interval, in seconds, to wait before reaching for the API again once [ACCESS\_API\_ERROR\_LIMIT](ACCESS_API_ERROR_LIMIT.md) consecutive failures have accumulated. Five minutes is the
compromise between the two ways this can go wrong: shorter, and a rebooting or overloaded controller is hammered while it is least able to answer; longer, and a
controller that has already recovered stays unreachable to the library for no reason. It comfortably exceeds a controller's own restart time, so a single cooldown is
usually enough for the next attempt to land on a healthy controller.

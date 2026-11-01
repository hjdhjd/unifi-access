[**unifi-access**](../README.md)

***

[Home](../README.md) / ACCESS\_REBOOT\_UPTIME\_DROP\_MINIMUM

# Variable: ACCESS\_REBOOT\_UPTIME\_DROP\_MINIMUM

```ts
const ACCESS_REBOOT_UPTIME_DROP_MINIMUM: 300 = 300;
```

How far the controller's reported uptime must fall, in seconds, before the drop is read as a restart rather than as noise. The unit matches the uptime field's
own.

The basis is worth stating plainly, because it is a margin rather than a measurement. Observation of a live controller found the served uptime flat across a
twenty-second window and advancing across a day; it never found the value moving backward by any amount. So this floor does not encode an observed skew - it is
chosen to sit far above any skew a caching or clock-step mechanism could plausibly produce, and far below the drop a real restart produces, which is the whole of
the controller's prior uptime and is measured in days. A false reading would require five minutes of backward movement from a mechanism never seen on this
hardware.

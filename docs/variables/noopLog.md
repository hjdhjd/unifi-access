[**unifi-access**](../README.md)

***

[Home](../README.md) / noopLog

# Variable: noopLog

```ts
const noopLog: AccessLogging;
```

The default logger every subsystem falls back to when a consumer injects none. It discards every message at every level.

A library should be silent by default - emitting to the console uninvited is surprising output a consumer did not ask for. Consumers that want visibility inject
their own `AccessLogging` (Homebridge's, Pino, Winston, console). Defaulting to a no-op rather than `console` keeps the library quiet in the embedded case and
leaves every consumer in complete control of where the library's output lands, and whether it lands at all.

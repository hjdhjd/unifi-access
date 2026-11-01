[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessControllerReadiness

# Type Alias: AccessControllerReadiness

```ts
type AccessControllerReadiness = "limiting" | "not-ready";
```

What a controller's answer says about its readiness to serve, when it says something about that rather than about the request it answered: `"limiting"` is a
controller limiting requests, the 429 that asks to be asked less often, and `"not-ready"` is a controller not ready yet, answering with a status the transport
retries as the readiness answer a controller rebooting or starting a service gives. [controllerReadinessOf](../functions/controllerReadinessOf.md) is the reading that names one.

[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessError

# Abstract Class: AccessError

The error model in one sentence: every failure the library raises is a subclass of AccessError, and the *first* level of the hierarchy answers the only
question a caller universally needs answered - should I retry, or should I propagate?

- [RecoverableError](RecoverableError.md) means the operation could plausibly succeed if retried or deferred (a throttle window, a timeout, a transient network blip, a caller abort,
  a stalled realtime channel). The caller decides the retry policy, and the HTTP pool's transparent retries of a transient answer or connection fault, on the terms
  [ACCESS\_API\_RETRY\_PROFILE](../variables/ACCESS_API_RETRY_PROFILE.md) states, are the layer beneath that policy rather than a part of it.
- [FatalError](FatalError.md) means retrying the same call will fail the same way (bad credentials, insufficient privileges, a 4xx/5xx the controller will keep returning, a
  protocol violation, a structural bootstrap failure), except that an [AccessRequestError](AccessRequestError.md) that [controllerReadinessOf](../functions/controllerReadinessOf.md) reads as limiting or not ready is
  the controller's readiness answer rather than a verdict on the request: a status in the transport's retried set is the answer a controller gives while restarting or
  starting a service, and a 429 is the controller asking to be asked later, its `Retry-After` among the error's headers, so a caller on a reconnect schedule retries
  such a request again later. The caller should surface or propagate it.

Consumers branch on the abstract base for policy (`if(err instanceof RecoverableError) { defer(); }`) and on the concrete class for specific handling
(`if(err instanceof AccessThrottledError) { waitFor(err.cooldownMs); }`). This is the Node idiom - a class hierarchy with `instanceof` - chosen deliberately over
a Result/Either return type, because it composes naturally with `try`/`catch`, `await`, and the platform's own error-cause chaining.

Every error chains its underlying `cause` so `resolveErrnoCause` keeps working one hop down the chain (the shape undici raises for connection failures).

## Extends

- `Error`

## Extended by

- [`FatalError`](FatalError.md)
- [`RecoverableError`](RecoverableError.md)

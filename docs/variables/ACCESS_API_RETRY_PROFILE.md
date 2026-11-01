[**unifi-access**](../README.md)

***

[Home](../README.md) / ACCESS\_API\_RETRY\_PROFILE

# Variable: ACCESS\_API\_RETRY\_PROFILE

```ts
const ACCESS_API_RETRY_PROFILE: {
  maxRetries: 5;
  maxTimeout: 1500;
  methods: readonly ["DELETE", "GET", "HEAD", "OPTIONS", "POST", "PUT"];
  minTimeout: 100;
  statusCodes: readonly [400, 404, 500, 502, 503, 504];
  timeoutFactor: 2;
};
```

The HTTP pool's retry profile: which requests the pool transparently re-sends, on which responses, and how long it waits between attempts. The transport composes
its retry interceptor from this one definition, so every request the pool carries is retried on the same terms, and anything that reasons about the pool's retry
timing reads it here rather than restating it.

The status codes are the transient failures the retry interceptor retries before the transport's `send` observes the controller's last answer. Each one is a
condition in which a UniFi OS controller was not in a state to answer rather than a considered refusal: the 5xx family is the controller shedding load or
proxying to a service that has not come up, and 400 and 404 are what its API gateway returns for a route that exists but whose backing service is still
starting - the shape a controller presents for a window after a reboot. They must not be trimmed on the reasoning that a 4xx is a client error. A retried
status that persists through every attempt is not discarded: the controller's last answer reaches the caller as the response it was, and `ensureOk` turns it
into an `AccessRequestError` carrying its status, body and headers.

A 429 is not among them, and no answer whose headers carry a Retry-After key is retried, whatever the key's value. Retrying a rate limit multiplies the load the
controller asked to shed, and a hinted wait of a second or more cannot fit inside the request deadline, so such an answer returns to its caller at once with
the controller's hint among its headers, for a caller on a reconnect schedule to wait out.

The retried verbs are the conventionally retry-safe ones plus POST: the interceptor only fires on those transient statuses and on the transient connection faults
undici treats as retryable - conditions that ordinarily mean the controller was not in a state to accept and act on the request - so re-sending a write absorbs a
reboot window just as re-sending a read does. That makes the set a default rather than a promise that a request is applied once, and a request that must not be
applied twice opts out through the transport's per-request `retry` option. PATCH is held out of the set outright, because the config writes it carries are where
a double-apply would be consequential and the API offers no guarantee that repeating one is safe.

The pool retries a request at most `maxRetries` times. The wait before each retry starts at `minTimeout` and grows by `timeoutFactor` up to `maxTimeout`, so a
momentary blip is retried almost at once and a controller still coming up is given progressively more room. This is the HTTP-layer retry surface and is distinct from
the throttle circuit breaker that [ACCESS\_API\_ERROR\_LIMIT](ACCESS_API_ERROR_LIMIT.md) and [ACCESS\_API\_RETRY\_INTERVAL](ACCESS_API_RETRY_INTERVAL.md) govern, which counts what survives these retries: an unanswered
request, a 5xx or a 429 books a failure, and every other answer came from a controller that was serving, a 4xx it kept returning through every attempt among them.

## Type Declaration

| Name | Type | Default value |
| ------ | ------ | ------ |
| <a id="property-maxretries"></a> `maxRetries` | `5` | `5` |
| <a id="property-maxtimeout"></a> `maxTimeout` | `1500` | `1500` |
| <a id="property-methods"></a> `methods` | readonly \[`"DELETE"`, `"GET"`, `"HEAD"`, `"OPTIONS"`, `"POST"`, `"PUT"`\] | - |
| <a id="property-mintimeout"></a> `minTimeout` | `100` | `100` |
| <a id="property-statuscodes"></a> `statusCodes` | readonly \[`400`, `404`, `500`, `502`, `503`, `504`\] | - |
| <a id="property-timeoutfactor"></a> `timeoutFactor` | `2` | `2` |

[**unifi-access**](../README.md)

***

[Home](../README.md) / RecoverableError

# Abstract Class: RecoverableError

Abstract base for failures the caller may retry or defer. The library classifies the failure as recoverable and returns control so the caller can apply its own
backoff, escalation, or alternative-path policy, and the HTTP pool's transparent retries, on the terms [ACCESS\_API\_RETRY\_PROFILE](../variables/ACCESS_API_RETRY_PROFILE.md) states, are the layer beneath
that policy rather than a part of it.

## Extends

- [`AccessError`](AccessError.md)

## Extended by

- [`AccessAbortedError`](AccessAbortedError.md)
- [`AccessNetworkError`](AccessNetworkError.md)
- [`AccessStallError`](AccessStallError.md)
- [`AccessThrottledError`](AccessThrottledError.md)
- [`AccessTimeoutError`](AccessTimeoutError.md)

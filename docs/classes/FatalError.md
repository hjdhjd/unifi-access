[**unifi-access**](../README.md)

***

[Home](../README.md) / FatalError

# Abstract Class: FatalError

Abstract base for failures the caller should propagate. Retrying the identical call will reproduce the identical failure, so the correct response is to surface it. The
exception is an [AccessRequestError](AccessRequestError.md) that [controllerReadinessOf](../functions/controllerReadinessOf.md) reads as limiting or not ready, which is the controller's readiness answer rather than a
verdict on the call, and which a later retry can clear.

## Extends

- [`AccessError`](AccessError.md)

## Extended by

- [`AccessApiError`](AccessApiError.md)
- [`AccessAuthError`](AccessAuthError.md)
- [`AccessAuthorizationError`](AccessAuthorizationError.md)
- [`AccessBootstrapError`](AccessBootstrapError.md)
- [`AccessCapabilityError`](AccessCapabilityError.md)
- [`AccessConfigurationError`](AccessConfigurationError.md)
- [`AccessDeclinedError`](AccessDeclinedError.md)
- [`AccessProtocolError`](AccessProtocolError.md)
- [`AccessRequestError`](AccessRequestError.md)

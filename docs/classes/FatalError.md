[**unifi-access**](../README.md)

***

[Home](../README.md) / FatalError

# Abstract Class: FatalError

Abstract base for failures the caller should propagate. Retrying the identical call will reproduce the identical failure, so the correct response is to surface it.

## Extends

- [`AccessError`](AccessError.md)

## Extended by

- [`AccessApiError`](AccessApiError.md)
- [`AccessAuthError`](AccessAuthError.md)
- [`AccessAuthorizationError`](AccessAuthorizationError.md)
- [`AccessBootstrapError`](AccessBootstrapError.md)
- [`AccessCapabilityError`](AccessCapabilityError.md)
- [`AccessProtocolError`](AccessProtocolError.md)
- [`AccessRequestError`](AccessRequestError.md)

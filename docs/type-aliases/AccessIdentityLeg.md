[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessIdentityLeg

# Type Alias: AccessIdentityLeg

```ts
type AccessIdentityLeg = "credentials" | "token";
```

The two identities a client can authenticate with, and which an [AccessAuthError](../classes/AccessAuthError.md) or an [AccessAuthorizationError](../classes/AccessAuthorizationError.md) names as the refused one:
`"credentials"` is the account login session that authenticates the direct API, `"token"` the bearer token that authenticates the official API. A client holds
either or both - the `ConnectIdentity` union is how a caller supplies them - and each is refused independently, so the leg is what tells a user which of the two
to go fix.

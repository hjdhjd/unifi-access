[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessApiMode

# Type Alias: AccessApiMode

```ts
type AccessApiMode = "credential" | "dual" | "token";
```

Which identities a client holds, and therefore which of the controller's APIs it can reach.

`credential` is a username and password alone, `token` is a bearer token alone, and `dual` is both. The mode follows from what was supplied at connect and never
changes for the life of the client.

[**unifi-access**](../README.md)

***

[Home](../README.md) / ConnectIdentity

# Type Alias: ConnectIdentity

```ts
type ConnectIdentity = 
  | {
  password: string;
  token?: string;
  username: string;
}
  | {
  password?: never;
  token: string;
  username?: never;
};
```

The identities a client can connect with. At least one is required, and the union is what makes "no identity at all" impossible to write.

Credentials reach the Access application's own endpoints, which is where the topology document lives. A token reaches the published API, whose device and door
listings are what a client with no credentials seeds the same state model from. Supplying both is the fullest client: the topology-seeded state model plus the
official facade, with each command taking whichever path serves it best.

The `never` members on the token-only arm are what make a partial credential pair a compile error rather than a runtime surprise - a username with no password
describes no way of authenticating, and this is the shape that says so.

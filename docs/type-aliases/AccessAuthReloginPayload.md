[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessAuthReloginPayload

# Type Alias: AccessAuthReloginPayload

```ts
type AccessAuthReloginPayload = 
  | {
  host: string;
  success: boolean;
}
  | {
  host: null;
  success: false;
};
```

Payload published on [channels.authRelogin](../variables/channels.md#property-authrelogin). The two arms encode which recoveries are possible. With credentials retained, the relogin ran against the
controller and `success` reports whether it re-established the session. With none - the state an explicit logout leaves behind - there was nothing to attempt, so
`host` is null and the attempt cannot have succeeded. Splitting the arms rather than making `host` nullable on one shape means the combination that would claim a
recovery nobody attempted cannot be constructed at all.

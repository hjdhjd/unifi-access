[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessOfficialUserCreated

# Type Alias: AccessOfficialUserCreated

```ts
type AccessOfficialUserCreated = Pick<AccessOfficialUserGroupMember, "first_name" | "id" | "last_name" | "user_email"> & Partial<Omit<AccessOfficialUserGroupMember, "first_name" | "id" | "last_name" | "user_email">>;
```

What the registration endpoint echoes back.

Against a live controller the echo carries the complete account record, not the four members the reference describes - which makes this another place the
documented response understates what the wire sends. The four documented members are required here because the reference claims them and the wire confirms
them; the rest are live-verified and optional, pending more specimens than the one this rests on.

This is one account shape observed through two endpoints with different confidence rather than two shapes, so it is derived from [AccessOfficialUserGroupMember](../interfaces/AccessOfficialUserGroupMember.md) rather than restating the same member names beside it. The derivation is what carries the difference: the four the reference
documents stay required, and the rest become optional, so each endpoint's own observed confidence is expressed while the names and their types live in one
place and cannot drift apart.

Live-verified.

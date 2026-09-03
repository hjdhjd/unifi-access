[**unifi-access**](../README.md)

***

[Home](../README.md) / OfficialIdentity

# Interface: OfficialIdentity

The official API's UniFi Identity domain: invitations, and the Identity resources assigned to users and user groups.

Every type and method here is documentation-derived. The endpoints need a controller joined to UniFi Identity, and a controller upgraded to Identity Enterprise
withdraws the official API altogether - which it signals with the `CODE_OTHERS_UID_ADOPTED_NOT_SUPPORTED` result code rather than through any version check a
caller could make in advance.

## Methods

### assignGroupResources()

```ts
assignGroupResources(
   id, 
   opts, 
   call?
): Promise<void>;
```

Assign Identity resources to a user group. `POST /user_groups/:id/identity/assignments`, permission `edit:user`. Requires UniFi Access 2.2.0 or later.

Documentation-derived.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `id` | `string` | The group's identifier. |
| `opts` | [`AccessOfficialIdentityAssignment`](AccessOfficialIdentityAssignment.md) | The resource type and the resources of it to assign. |
| `call` | [`AccessOfficialCallOptions`](AccessOfficialCallOptions.md) | The per-call options - an optional abort signal. |

#### Returns

`Promise`\<`void`\>

***

### assignUserResources()

```ts
assignUserResources(
   id, 
   opts, 
   call?
): Promise<void>;
```

Assign Identity resources to a user. `POST /users/:id/identity/assignments`, permission `edit:user`. Requires UniFi Access 1.24.6 or later.

Documentation-derived.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `id` | `string` | The user's identifier. |
| `opts` | [`AccessOfficialIdentityAssignment`](AccessOfficialIdentityAssignment.md) | The resource type and the resources of it to assign. |
| `call` | [`AccessOfficialCallOptions`](AccessOfficialCallOptions.md) | The per-call options - an optional abort signal. |

#### Returns

`Promise`\<`void`\>

***

### fetchAvailableResources()

```ts
fetchAvailableResources(opts?, call?): Promise<Readonly<Record<string, readonly AccessOfficialIdentityResource[]>>>;
```

Read the Identity resources available to assign. `GET /users/identity/assignments`, permission `view:user`. Requires UniFi Access 1.24.6 or later.

Documentation-derived.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `opts` | [`AccessOfficialIdentityResourceOptions`](AccessOfficialIdentityResourceOptions.md) | The resource type to narrow to; omitting it returns every type. |
| `call` | [`AccessOfficialCallOptions`](AccessOfficialCallOptions.md) | The per-call options - an optional abort signal. |

#### Returns

`Promise`\<`Readonly`\<`Record`\<`string`, readonly [`AccessOfficialIdentityResource`](AccessOfficialIdentityResource.md)[]\>\>\>

The available resources, grouped by type.

***

### fetchGroupResources()

```ts
fetchGroupResources(id, call?): Promise<Readonly<Record<string, readonly AccessOfficialIdentityResource[]>>>;
```

Read the Identity resources assigned to a user group. `GET /user_groups/:id/identity/assignments`, permission `view:user`. Requires UniFi Access 2.2.0 or
later.

Documentation-derived.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `id` | `string` | The group's identifier. |
| `call` | [`AccessOfficialCallOptions`](AccessOfficialCallOptions.md) | The per-call options - an optional abort signal. |

#### Returns

`Promise`\<`Readonly`\<`Record`\<`string`, readonly [`AccessOfficialIdentityResource`](AccessOfficialIdentityResource.md)[]\>\>\>

The group's resources, grouped by type.

***

### fetchUserResources()

```ts
fetchUserResources(id, call?): Promise<Readonly<Record<string, readonly AccessOfficialIdentityResource[]>>>;
```

Read the Identity resources assigned to a user. `GET /users/:id/identity/assignments`, permission `view:user`. Requires UniFi Access 1.24.6 or later.

Documentation-derived.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `id` | `string` | The user's identifier. |
| `call` | [`AccessOfficialCallOptions`](AccessOfficialCallOptions.md) | The per-call options - an optional abort signal. |

#### Returns

`Promise`\<`Readonly`\<`Record`\<`string`, readonly [`AccessOfficialIdentityResource`](AccessOfficialIdentityResource.md)[]\>\>\>

The user's resources, grouped by type.

***

### sendInvitations()

```ts
sendInvitations(invitations, call?): Promise<AccessOfficialIdentityInvitationFailure[]>;
```

Send UniFi Identity invitations. `POST /users/identity/invitations`, permission `edit:user`. Requires UniFi Access 1.24.6 or later.

The body is the bare array of invitations, with no wrapper member around it. The envelope reports success even when individual invitations fail, so the
returned array is what says whether they all went out.

Documentation-derived.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `invitations` | readonly [`AccessOfficialIdentityInvitation`](AccessOfficialIdentityInvitation.md)[] | The invitations to send. |
| `call` | [`AccessOfficialCallOptions`](AccessOfficialCallOptions.md) | The per-call options - an optional abort signal. |

#### Returns

`Promise`\<[`AccessOfficialIdentityInvitationFailure`](AccessOfficialIdentityInvitationFailure.md)[]\>

One entry per invitation that failed; empty when every one was sent.

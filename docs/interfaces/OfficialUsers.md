[**unifi-access**](../README.md)

***

[Home](../README.md) / OfficialUsers

# Interface: OfficialUsers

The official API's user domain: local accounts, the user-group hierarchy, and the credentials and access policies attached to either.

## Methods

### assignAccessPolicies()

```ts
assignAccessPolicies(
   id, 
   policyIds, 
   call?
): Promise<void>;
```

Set the access policies assigned directly to a user. `PUT /users/:id/access_policies`, permission `edit:user`.

The set is replaced rather than added to, so an empty array removes every policy assigned directly to the user.

Documentation-derived.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `id` | `string` | The user's identifier. |
| `policyIds` | readonly `string`[] | The policies to assign. |
| `call` | [`AccessOfficialCallOptions`](AccessOfficialCallOptions.md) | The per-call options - an optional abort signal. |

#### Returns

`Promise`\<`void`\>

***

### assignAccessPoliciesToGroup()

```ts
assignAccessPoliciesToGroup(
   id, 
   policyIds, 
   call?
): Promise<void>;
```

Set the access policies assigned to a user group. `PUT /user_groups/:id/access_policies`, permission `edit:user`. Requires UniFi Access 2.2.6 or later.

Documentation-derived.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `id` | `string` | The group's identifier. |
| `policyIds` | readonly `string`[] | The policies to assign. |
| `call` | [`AccessOfficialCallOptions`](AccessOfficialCallOptions.md) | The per-call options - an optional abort signal. |

#### Returns

`Promise`\<`void`\>

***

### assignLicensePlates()

```ts
assignLicensePlates(
   id, 
   plates, 
   call?
): Promise<void>;
```

Set the license plates registered to a user. `PUT /users/:id/license_plates`, permission `edit:user`. Requires UniFi Access 3.3.10 or later.

The body is the bare array of plate numbers, with no wrapper member around it.

Documentation-derived.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `id` | `string` | The user's identifier. |
| `plates` | readonly `string`[] | The plate numbers to register. |
| `call` | [`AccessOfficialCallOptions`](AccessOfficialCallOptions.md) | The per-call options - an optional abort signal. |

#### Returns

`Promise`\<`void`\>

***

### assignNfcCard()

```ts
assignNfcCard(
   id, 
   opts, 
   call?
): Promise<void>;
```

Assign an NFC card to a user. `PUT /users/:id/nfc_cards`, permission `edit:user`.

Documentation-derived.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `id` | `string` | The user's identifier. |
| `opts` | [`AccessOfficialUserNfcCardAssign`](AccessOfficialUserNfcCardAssign.md) | The card's token, and whether to take it from its current holder. |
| `call` | [`AccessOfficialCallOptions`](AccessOfficialCallOptions.md) | The per-call options - an optional abort signal. |

#### Returns

`Promise`\<`void`\>

***

### assignPinCode()

```ts
assignPinCode(
   id, 
   pinCode, 
   call?
): Promise<void>;
```

Assign a PIN code to a user. `PUT /users/:id/pin_codes`, permission `edit:user`.

Live-verified.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `id` | `string` | The user's identifier. |
| `pinCode` | `string` | The code, minted through the credentials domain. |
| `call` | [`AccessOfficialCallOptions`](AccessOfficialCallOptions.md) | The per-call options - an optional abort signal. |

#### Returns

`Promise`\<`void`\>

***

### assignToGroup()

```ts
assignToGroup(
   id, 
   userIds, 
   call?
): Promise<void>;
```

Add users to a group. `POST /user_groups/:id/users`, permission `edit:user`. Requires UniFi Access 2.2.6 or later.

The body is the bare array of identifiers, with no wrapper member around it - the endpoint reads the whole document as the list.

Documentation-derived.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `id` | `string` | The group's identifier. |
| `userIds` | readonly `string`[] | The users to add. |
| `call` | [`AccessOfficialCallOptions`](AccessOfficialCallOptions.md) | The per-call options - an optional abort signal. |

#### Returns

`Promise`\<`void`\>

***

### assignTouchPass()

```ts
assignTouchPass(
   userId, 
   touchPassId, 
   call?
): Promise<AccessOfficialTouchPass>;
```

Assign a Touch Pass to a user. `PUT /users/:user_id/touch_passes/:touch_pass_id`, permission `edit:user`. Requires UniFi Access 3.2.20 or later.

Documentation-derived.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `userId` | `string` | The user's identifier. |
| `touchPassId` | `string` | The pass's identifier, from the assignable list. |
| `call` | [`AccessOfficialCallOptions`](AccessOfficialCallOptions.md) | The per-call options - an optional abort signal. |

#### Returns

`Promise`\<[`AccessOfficialTouchPass`](AccessOfficialTouchPass.md)\>

The pass, now assigned.

***

### batchAssignTouchPasses()

```ts
batchAssignTouchPasses(opts, call?): Promise<AccessOfficialTouchPass[]>;
```

Assign Touch Passes to several users at once. `PUT /users/touch_passes/assign`, permission `edit:user`. Requires UniFi Access 3.2.20 or later.

Documentation-derived.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `opts` | [`AccessOfficialTouchPassBatchAssign`](AccessOfficialTouchPassBatchAssign.md) | The users to assign to, and the email addresses to record against them. |
| `call` | [`AccessOfficialCallOptions`](AccessOfficialCallOptions.md) | The per-call options - an optional abort signal. |

#### Returns

`Promise`\<[`AccessOfficialTouchPass`](AccessOfficialTouchPass.md)[]\>

One pass per user assigned.

***

### create()

```ts
create(opts, call?): Promise<AccessOfficialUserCreated>;
```

Register a user. `POST /users`, permission `edit:user`.

Live-verified.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `opts` | [`AccessOfficialUserCreate`](AccessOfficialUserCreate.md) | The user to register. |
| `call` | [`AccessOfficialCallOptions`](AccessOfficialCallOptions.md) | The per-call options - an optional abort signal. |

#### Returns

`Promise`\<[`AccessOfficialUserCreated`](../type-aliases/AccessOfficialUserCreated.md)\>

The identifier the controller minted, with the names it recorded.

***

### createGroup()

```ts
createGroup(opts, call?): Promise<void>;
```

Create a user group. `POST /user_groups`, permission `edit:user`. Requires UniFi Access 2.2.6 or later.

Documentation-derived.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `opts` | [`AccessOfficialUserGroupCreate`](AccessOfficialUserGroupCreate.md) | The group to create. |
| `call` | [`AccessOfficialCallOptions`](AccessOfficialCallOptions.md) | The per-call options - an optional abort signal. |

#### Returns

`Promise`\<`void`\>

***

### delete()

```ts
delete(id, call?): Promise<void>;
```

Delete a user. `DELETE /users/:id`, permission `edit:user`. Requires UniFi Access 3.1.30 or later.

Only a user already in the disabled status can be deleted, so an active account is deactivated first.

Live-verified.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `id` | `string` | The user's identifier. |
| `call` | [`AccessOfficialCallOptions`](AccessOfficialCallOptions.md) | The per-call options - an optional abort signal. |

#### Returns

`Promise`\<`void`\>

***

### deleteGroup()

```ts
deleteGroup(id, call?): Promise<void>;
```

Delete a user group. `DELETE /user_groups/:id`, permission `edit:user`. Requires UniFi Access 2.2.6 or later.

Documentation-derived.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `id` | `string` | The group's identifier. |
| `call` | [`AccessOfficialCallOptions`](AccessOfficialCallOptions.md) | The per-call options - an optional abort signal. |

#### Returns

`Promise`\<`void`\>

***

### fetch()

```ts
fetch(
   id, 
   opts?, 
   call?
): Promise<AccessOfficialUser>;
```

Fetch one user. `GET /users/:id`, permission `view:user`.

Live-verified.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `id` | `string` | The user's identifier. |
| `opts` | [`AccessOfficialUserFetchOptions`](AccessOfficialUserFetchOptions.md) | The expansions to request. |
| `call` | [`AccessOfficialCallOptions`](AccessOfficialCallOptions.md) | The per-call options - an optional abort signal. |

#### Returns

`Promise`\<[`AccessOfficialUser`](AccessOfficialUser.md)\>

The user.

***

### fetchAccessPolicies()

```ts
fetchAccessPolicies(
   id, 
   opts?, 
   call?
): Promise<AccessOfficialAccessPolicy[]>;
```

Fetch the access policies a user holds. `GET /users/:id/access_policies`, permission `view:user`. Requires UniFi Access 2.2.6 or later.

Documentation-derived.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `id` | `string` | The user's identifier. |
| `opts` | [`AccessOfficialUserAccessPolicyOptions`](AccessOfficialUserAccessPolicyOptions.md) | Whether to report only the policies assigned directly to the user rather than those inherited from their groups. |
| `call` | [`AccessOfficialCallOptions`](AccessOfficialCallOptions.md) | The per-call options - an optional abort signal. |

#### Returns

`Promise`\<[`AccessOfficialAccessPolicy`](AccessOfficialAccessPolicy.md)[]\>

The policies.

***

### fetchAll()

```ts
fetchAll(opts?, call?): Promise<AccessOfficialResult<AccessOfficialUser[]>>;
```

Fetch a page of users. `GET /users`, permission `view:user`.

Live-verified.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `opts` | [`AccessOfficialUserListOptions`](AccessOfficialUserListOptions.md) | The page to fetch, and the expansions to request. |
| `call` | [`AccessOfficialCallOptions`](AccessOfficialCallOptions.md) | The per-call options - an optional abort signal. |

#### Returns

`Promise`\<[`AccessOfficialResult`](AccessOfficialResult.md)\<[`AccessOfficialUser`](AccessOfficialUser.md)[]\>\>

The page of users, and the pagination describing it.

***

### fetchAllGroups()

```ts
fetchAllGroups(call?): Promise<AccessOfficialUserGroup[]>;
```

Fetch every user group. `GET /user_groups`, permission `view:user`. Requires UniFi Access 2.2.6 or later.

Documentation-derived.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `call` | [`AccessOfficialCallOptions`](AccessOfficialCallOptions.md) | The per-call options - an optional abort signal. |

#### Returns

`Promise`\<[`AccessOfficialUserGroup`](AccessOfficialUserGroup.md)[]\>

Every group on the controller.

***

### fetchAllGroupUsers()

```ts
fetchAllGroupUsers(id, call?): Promise<AccessOfficialUserGroupMember[]>;
```

Fetch the users in a group and every subgroup below it. `GET /user_groups/:id/users/all`, permission `view:user`. Requires UniFi Access 2.2.6 or later.

Documentation-derived.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `id` | `string` | The group's identifier. |
| `call` | [`AccessOfficialCallOptions`](AccessOfficialCallOptions.md) | The per-call options - an optional abort signal. |

#### Returns

`Promise`\<[`AccessOfficialUserGroupMember`](AccessOfficialUserGroupMember.md)[]\>

The group's members, subgroups included.

***

### fetchGroup()

```ts
fetchGroup(id, call?): Promise<AccessOfficialUserGroup>;
```

Fetch one user group. `GET /user_groups/:id`, permission `view:user`. Requires UniFi Access 2.2.6 or later.

Documentation-derived.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `id` | `string` | The group's identifier. |
| `call` | [`AccessOfficialCallOptions`](AccessOfficialCallOptions.md) | The per-call options - an optional abort signal. |

#### Returns

`Promise`\<[`AccessOfficialUserGroup`](AccessOfficialUserGroup.md)\>

The group.

***

### fetchGroupAccessPolicies()

```ts
fetchGroupAccessPolicies(id, call?): Promise<AccessOfficialAccessPolicy[]>;
```

Fetch the access policies a user group holds. `GET /user_groups/:id/access_policies`, permission `view:user`. Requires UniFi Access 2.2.6 or later.

Documentation-derived.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `id` | `string` | The group's identifier. |
| `call` | [`AccessOfficialCallOptions`](AccessOfficialCallOptions.md) | The per-call options - an optional abort signal. |

#### Returns

`Promise`\<[`AccessOfficialAccessPolicy`](AccessOfficialAccessPolicy.md)[]\>

The policies.

***

### fetchGroupUsers()

```ts
fetchGroupUsers(id, call?): Promise<AccessOfficialUserGroupMember[]>;
```

Fetch the users in a group, excluding its subgroups. `GET /user_groups/:id/users`, permission `view:user`. Requires UniFi Access 2.2.6 or later.

Documentation-derived.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `id` | `string` | The group's identifier. |
| `call` | [`AccessOfficialCallOptions`](AccessOfficialCallOptions.md) | The per-call options - an optional abort signal. |

#### Returns

`Promise`\<[`AccessOfficialUserGroupMember`](AccessOfficialUserGroupMember.md)[]\>

The group's own members.

***

### iterateAll()

```ts
iterateAll(opts?, call?): AsyncGenerator<AccessOfficialUser>;
```

Iterate every user, walking the listing to its end. `GET /users`, permission `view:user`.

Composed over [OfficialUsers.fetchAll](#fetchall); the endpoint is live-verified.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `opts` | [`AccessOfficialUserListOptions`](AccessOfficialUserListOptions.md) | The expansions to request, and the page size to walk the listing in. |
| `call` | [`AccessOfficialCallOptions`](AccessOfficialCallOptions.md) | The per-call options - an optional abort signal. |

#### Returns

`AsyncGenerator`\<[`AccessOfficialUser`](AccessOfficialUser.md)\>

Every user the listing reports, in the order its pages carry them.

***

### iterateSearch()

```ts
iterateSearch(opts?, call?): AsyncGenerator<AccessOfficialUserSearchResult>;
```

Iterate every user a search matches, walking the matches to their end. `GET /users/search`, permission `view:user`. Requires UniFi Access 3.1.30 or later.

Composed over [OfficialUsers.search](#search); the endpoint is live-verified and answers no pagination member, so the walk ends after one page.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `opts` | [`AccessOfficialUserSearchOptions`](AccessOfficialUserSearchOptions.md) | The search terms, and the page size to walk the matches in. |
| `call` | [`AccessOfficialCallOptions`](AccessOfficialCallOptions.md) | The per-call options - an optional abort signal. |

#### Returns

`AsyncGenerator`\<[`AccessOfficialUserSearchResult`](AccessOfficialUserSearchResult.md)\>

Every match the search reports, in the order its pages carry them.

***

### search()

```ts
search(opts?, call?): Promise<AccessOfficialResult<AccessOfficialUserSearchResult[]>>;
```

Search users. `GET /users/search`, permission `view:user`. Requires UniFi Access 3.1.30 or later.

Live-verified (2026-09-07): the keyword matches case-insensitively as a substring of the first name, the last name, and the full name; the answer carries no
pagination member, so a walk over it ends after its first page.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `opts` | [`AccessOfficialUserSearchOptions`](AccessOfficialUserSearchOptions.md) | The search terms and the page to fetch. |
| `call` | [`AccessOfficialCallOptions`](AccessOfficialCallOptions.md) | The per-call options - an optional abort signal. |

#### Returns

`Promise`\<[`AccessOfficialResult`](AccessOfficialResult.md)\<[`AccessOfficialUserSearchResult`](AccessOfficialUserSearchResult.md)[]\>\>

The page of matches; pagination is not reported by this endpoint.

***

### unassignFromGroup()

```ts
unassignFromGroup(
   id, 
   userIds, 
   call?
): Promise<void>;
```

Remove users from a group. `POST /user_groups/:id/users/delete`, permission `edit:user`. Requires UniFi Access 2.2.6 or later.

The body is the bare array of identifiers, exactly as on the assignment endpoint.

Documentation-derived.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `id` | `string` | The group's identifier. |
| `userIds` | readonly `string`[] | The users to remove. |
| `call` | [`AccessOfficialCallOptions`](AccessOfficialCallOptions.md) | The per-call options - an optional abort signal. |

#### Returns

`Promise`\<`void`\>

***

### unassignLicensePlate()

```ts
unassignLicensePlate(
   userId, 
   licensePlateId, 
   call?
): Promise<void>;
```

Unregister one license plate from a user. `DELETE /users/:user_id/license_plates/:license_plate_id`, permission `edit:user`. Requires UniFi Access 3.3.10 or
later.

Documentation-derived.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `userId` | `string` | The user's identifier. |
| `licensePlateId` | `string` | The plate's identifier, from the user's own record. |
| `call` | [`AccessOfficialCallOptions`](AccessOfficialCallOptions.md) | The per-call options - an optional abort signal. |

#### Returns

`Promise`\<`void`\>

***

### unassignNfcCard()

```ts
unassignNfcCard(
   id, 
   token, 
   call?
): Promise<void>;
```

Unassign an NFC card from a user. `PUT /users/:id/nfc_cards/delete`, permission `edit:user`.

The verb is the documented one. The reference's own sample for this endpoint sends `DELETE` against the same URL, but its visitor counterpart documents the
same operation as `PUT` without contradicting itself, and the `/delete` path suffix is how this API tunnels a delete through a verb that carries a body.

Documentation-derived.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `id` | `string` | The user's identifier. |
| `token` | `string` | The card's token. |
| `call` | [`AccessOfficialCallOptions`](AccessOfficialCallOptions.md) | The per-call options - an optional abort signal. |

#### Returns

`Promise`\<`void`\>

***

### unassignPinCode()

```ts
unassignPinCode(id, call?): Promise<void>;
```

Unassign a user's PIN code. `DELETE /users/:id/pin_codes`, permission `edit:user`.

Live-verified.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `id` | `string` | The user's identifier. |
| `call` | [`AccessOfficialCallOptions`](AccessOfficialCallOptions.md) | The per-call options - an optional abort signal. |

#### Returns

`Promise`\<`void`\>

***

### unassignTouchPass()

```ts
unassignTouchPass(
   userId, 
   touchPassId, 
   call?
): Promise<AccessOfficialTouchPass>;
```

Unassign a Touch Pass from a user. `DELETE /users/:user_id/touch_passes/:touch_pass_id`, permission `edit:user`. Requires UniFi Access 3.2.20 or later.

Documentation-derived.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `userId` | `string` | The user's identifier. |
| `touchPassId` | `string` | The pass's identifier. |
| `call` | [`AccessOfficialCallOptions`](AccessOfficialCallOptions.md) | The per-call options - an optional abort signal. |

#### Returns

`Promise`\<[`AccessOfficialTouchPass`](AccessOfficialTouchPass.md)\>

The pass, now unassigned - its `user_*` members emptied.

***

### update()

```ts
update(
   id, 
   opts, 
   call?
): Promise<void>;
```

Update a user. `PUT /users/:id`, permission `edit:user`.

Live-verified.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `id` | `string` | The user's identifier. |
| `opts` | [`AccessOfficialUserUpdate`](AccessOfficialUserUpdate.md) | The members to change; anything omitted is left as it stands. |
| `call` | [`AccessOfficialCallOptions`](AccessOfficialCallOptions.md) | The per-call options - an optional abort signal. |

#### Returns

`Promise`\<`void`\>

***

### updateGroup()

```ts
updateGroup(
   id, 
   opts, 
   call?
): Promise<void>;
```

Update a user group. `PUT /user_groups/:id`, permission `edit:user`. Requires UniFi Access 2.2.6 or later.

Documentation-derived.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `id` | `string` | The group's identifier. |
| `opts` | [`AccessOfficialUserGroupUpdate`](AccessOfficialUserGroupUpdate.md) | The members to change; anything omitted is left as it stands. |
| `call` | [`AccessOfficialCallOptions`](AccessOfficialCallOptions.md) | The per-call options - an optional abort signal. |

#### Returns

`Promise`\<`void`\>

***

### uploadAvatar()

```ts
uploadAvatar(
   id, 
   opts, 
   call?
): Promise<AccessOfficialUserAvatar>;
```

Upload a user's profile picture. `POST /users/:id/avatar`, permission `edit:user`. Requires UniFi Access 3.3.10 or later.

Supported for local users only - an account backed by a UI account updates its picture through the UI account interface instead.

Live-verified (2026-09-18): a multipart upload sending the image under the field `file` answered the stored picture's location under `url`.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `id` | `string` | The user's identifier. |
| `opts` | [`AccessOfficialFileUpload`](AccessOfficialFileUpload.md) | The image bytes and the name to send them under. |
| `call` | [`AccessOfficialCallOptions`](AccessOfficialCallOptions.md) | The per-call options - an optional abort signal. |

#### Returns

`Promise`\<[`AccessOfficialUserAvatar`](AccessOfficialUserAvatar.md)\>

Where the picture now lives.

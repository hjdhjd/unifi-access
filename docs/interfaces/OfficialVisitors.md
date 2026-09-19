[**unifi-access**](../README.md)

***

[Home](../README.md) / OfficialVisitors

# Interface: OfficialVisitors

The official API's visitor domain: time-bounded guests, the schedule governing when they may enter, and the credentials issued to them for the visit.

## Methods

### assignLicensePlates()

```ts
assignLicensePlates(
   id, 
   plates, 
   call?
): Promise<void>;
```

Set the license plates registered to a visitor. `PUT /visitors/:id/license_plates`, permission `edit:visitor`. Requires UniFi Access 3.3.10 or later.

The body is the bare array of plate numbers, with no wrapper member around it.

Documentation-derived.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `id` | `string` | The visitor's identifier. |
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

Assign an NFC card to a visitor. `PUT /visitors/:id/nfc_cards`, permission `edit:visitor`.

Documentation-derived.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `id` | `string` | The visitor's identifier. |
| `opts` | [`AccessOfficialVisitorNfcCardAssign`](AccessOfficialVisitorNfcCardAssign.md) | The card's token, and whether to take it from its current holder. |
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

Assign a PIN code to a visitor. `PUT /visitors/:id/pin_codes`, permission `edit:visitor`.

Documentation-derived.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `id` | `string` | The visitor's identifier. |
| `pinCode` | `string` | The code, minted through the credentials domain. |
| `call` | [`AccessOfficialCallOptions`](AccessOfficialCallOptions.md) | The per-call options - an optional abort signal. |

#### Returns

`Promise`\<`void`\>

***

### assignQrCode()

```ts
assignQrCode(id, call?): Promise<void>;
```

Issue a QR code to a visitor. `PUT /visitors/:id/qr_codes`, permission `edit:visitor`. Requires UniFi Access 3.3.10 or later.

The endpoint takes no body - the visitor named in the path is the whole request. Download the resulting image through the credentials domain.

Documentation-derived.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `id` | `string` | The visitor's identifier. |
| `call` | [`AccessOfficialCallOptions`](AccessOfficialCallOptions.md) | The per-call options - an optional abort signal. |

#### Returns

`Promise`\<`void`\>

***

### create()

```ts
create(opts, call?): Promise<AccessOfficialVisitor>;
```

Invite a visitor. `POST /visitors`, permission `edit:visitor`.

Live-verified.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `opts` | [`AccessOfficialVisitorCreate`](AccessOfficialVisitorCreate.md) | The visitor to invite. |
| `call` | [`AccessOfficialCallOptions`](AccessOfficialCallOptions.md) | The per-call options - an optional abort signal. |

#### Returns

`Promise`\<[`AccessOfficialVisitor`](AccessOfficialVisitor.md)\>

The created visitor, with their resources expanded and their schedule resolved.

***

### delete()

```ts
delete(
   id, 
   opts?, 
   call?
): Promise<void>;
```

Cancel or remove a visitor. `DELETE /visitors/:id`, permission `edit:visitor`.

The default is a cancellation: the visitor is moved to the cancelled status and their record stays, which is what keeps the visit in the controller's own
history. Passing `is_force` removes the record outright instead.

Live-verified.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `id` | `string` | The visitor's identifier. |
| `opts` | [`AccessOfficialVisitorDeleteOptions`](AccessOfficialVisitorDeleteOptions.md) | Whether to remove the record rather than cancel the visit. |
| `call` | [`AccessOfficialCallOptions`](AccessOfficialCallOptions.md) | The per-call options - an optional abort signal. |

#### Returns

`Promise`\<`void`\>

***

### fetch()

```ts
fetch(id, call?): Promise<AccessOfficialVisitor>;
```

Fetch one visitor. `GET /visitors/:id`, permission `view:visitor`.

Live-verified.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `id` | `string` | The visitor's identifier. |
| `call` | [`AccessOfficialCallOptions`](AccessOfficialCallOptions.md) | The per-call options - an optional abort signal. |

#### Returns

`Promise`\<[`AccessOfficialVisitor`](AccessOfficialVisitor.md)\>

The visitor.

***

### fetchAll()

```ts
fetchAll(opts?, call?): Promise<AccessOfficialResult<AccessOfficialVisitor[]>>;
```

Fetch a page of visitors. `GET /visitors`, permission `view:visitor`. License plates on the returned records require UniFi Access 3.3.10 or later.

Live-verified.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `opts` | [`AccessOfficialVisitorListOptions`](AccessOfficialVisitorListOptions.md) | The page to fetch, the status to narrow to, and the expansions to request. |
| `call` | [`AccessOfficialCallOptions`](AccessOfficialCallOptions.md) | The per-call options - an optional abort signal. |

#### Returns

`Promise`\<[`AccessOfficialResult`](AccessOfficialResult.md)\<[`AccessOfficialVisitor`](AccessOfficialVisitor.md)[]\>\>

The page of visitors, and the pagination describing it.

***

### iterateAll()

```ts
iterateAll(opts?, call?): AsyncGenerator<AccessOfficialVisitor>;
```

Iterate every visitor, walking the listing to its end. `GET /visitors`, permission `view:visitor`. License plates on the returned records require UniFi Access
3.3.10 or later.

Composed over [OfficialVisitors.fetchAll](#fetchall); the endpoint is live-verified.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `opts` | [`AccessOfficialVisitorListOptions`](AccessOfficialVisitorListOptions.md) | The status to narrow to, the expansions to request, and the page size to walk the listing in. |
| `call` | [`AccessOfficialCallOptions`](AccessOfficialCallOptions.md) | The per-call options - an optional abort signal. |

#### Returns

`AsyncGenerator`\<[`AccessOfficialVisitor`](AccessOfficialVisitor.md)\>

Every visitor the listing reports, in the order its pages carry them.

***

### unassignLicensePlate()

```ts
unassignLicensePlate(
   visitorId, 
   licensePlateId, 
   call?
): Promise<void>;
```

Unregister one license plate from a visitor. `DELETE /visitors/:visitor_id/license_plates/:license_plate_id`, permission `edit:visitor`. Requires UniFi Access
3.3.10 or later.

Documentation-derived.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `visitorId` | `string` | The visitor's identifier. |
| `licensePlateId` | `string` | The plate's identifier, from the visitor's own record. |
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

Unassign an NFC card from a visitor. `PUT /visitors/:id/nfc_cards/delete`, permission `edit:visitor`.

The `/delete` path suffix on a `PUT` is the same verb-tunneling workaround [OfficialUsers.unassignNfcCard](OfficialUsers.md#unassignnfccard) explains in full: the operation carries a
body, so it goes through a verb that allows one, with the suffix carrying the delete semantics.

Documentation-derived.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `id` | `string` | The visitor's identifier. |
| `token` | `string` | The card's token. |
| `call` | [`AccessOfficialCallOptions`](AccessOfficialCallOptions.md) | The per-call options - an optional abort signal. |

#### Returns

`Promise`\<`void`\>

***

### unassignPinCode()

```ts
unassignPinCode(id, call?): Promise<void>;
```

Unassign a visitor's PIN code. `DELETE /visitors/:id/pin_codes`, permission `edit:visitor`.

Documentation-derived.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `id` | `string` | The visitor's identifier. |
| `call` | [`AccessOfficialCallOptions`](AccessOfficialCallOptions.md) | The per-call options - an optional abort signal. |

#### Returns

`Promise`\<`void`\>

***

### unassignQrCode()

```ts
unassignQrCode(id, call?): Promise<void>;
```

Revoke a visitor's QR code. `DELETE /visitors/:id/qr_codes`, permission `edit:visitor`. Requires UniFi Access 3.3.10 or later.

Documentation-derived.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `id` | `string` | The visitor's identifier. |
| `call` | [`AccessOfficialCallOptions`](AccessOfficialCallOptions.md) | The per-call options - an optional abort signal. |

#### Returns

`Promise`\<`void`\>

***

### update()

```ts
update(
   id, 
   opts, 
   call?
): Promise<AccessOfficialVisitor>;
```

Update a visitor. `PUT /visitors/:id`, permission `edit:visitor`.

Documentation-derived.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `id` | `string` | The visitor's identifier. |
| `opts` | [`AccessOfficialVisitorUpdate`](AccessOfficialVisitorUpdate.md) | The members to change; anything omitted is left as it stands. |
| `call` | [`AccessOfficialCallOptions`](AccessOfficialCallOptions.md) | The per-call options - an optional abort signal. |

#### Returns

`Promise`\<[`AccessOfficialVisitor`](AccessOfficialVisitor.md)\>

The updated visitor.

[**unifi-access**](../README.md)

***

[Home](../README.md) / OfficialCredentials

# Interface: OfficialCredentials

The official API's credential domain: PIN codes, NFC cards and the reader sessions that enroll them, Touch Passes, and visitor QR codes.

## Methods

### cancelNfcEnrollment()

```ts
cancelNfcEnrollment(sessionId, call?): Promise<void>;
```

Close an NFC enrollment session. `DELETE /credentials/nfc_cards/sessions/:id`, permission `edit:credential`.

Documentation-derived.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `sessionId` | `string` | The session identifier. |
| `call` | [`AccessOfficialCallOptions`](AccessOfficialCallOptions.md) | The per-call options - an optional abort signal. |

#### Returns

`Promise`\<`void`\>

***

### deleteNfcCard()

```ts
deleteNfcCard(token, call?): Promise<void>;
```

Delete an NFC card. `DELETE /credentials/nfc_cards/tokens/:token`, permission `edit:credential`. Requires UniFi Access 1.22.16 or later.

Documentation-derived.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `token` | `string` | The card's token. |
| `call` | [`AccessOfficialCallOptions`](AccessOfficialCallOptions.md) | The per-call options - an optional abort signal. |

#### Returns

`Promise`\<`void`\>

***

### downloadQrCode()

```ts
downloadQrCode(visitorId, call?): Promise<Buffer<ArrayBufferLike>>;
```

Download a visitor's QR code as an image. `GET /credentials/qr_codes/download/:visitor_id`, permission `view:credential`. Requires UniFi Access 3.3.10 or
later.

Documentation-derived.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `visitorId` | `string` | The visitor whose code to download. |
| `call` | [`AccessOfficialCallOptions`](AccessOfficialCallOptions.md) | The per-call options - an optional abort signal. |

#### Returns

`Promise`\<`Buffer`\<`ArrayBufferLike`\>\>

The image bytes.

***

### enrollNfcCard()

```ts
enrollNfcCard(opts, call?): Promise<AccessOfficialNfcEnrollmentSession>;
```

Wake a reader and open a session to enroll an NFC card. `POST /credentials/nfc_cards/sessions`, permission `edit:credential`.

The session identifier is the caller's to hold: it is the only handle to the reader session, so losing it leaves the session to expire on the controller's own
terms rather than being releasable. [OfficialCredentials.cancelNfcEnrollment](#cancelnfcenrollment) is the clean release.

Documentation-derived.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `opts` | [`AccessOfficialNfcCardEnroll`](AccessOfficialNfcCardEnroll.md) | The reader to wake, and whether to reset a card already enrolled at another site. |
| `call` | [`AccessOfficialCallOptions`](AccessOfficialCallOptions.md) | The per-call options - an optional abort signal. |

#### Returns

`Promise`\<[`AccessOfficialNfcEnrollmentSession`](AccessOfficialNfcEnrollmentSession.md)\>

The session identifier.

***

### fetchAllNfcCards()

```ts
fetchAllNfcCards(opts?, call?): Promise<AccessOfficialResult<AccessOfficialNfcCard[]>>;
```

Fetch a page of NFC cards. `GET /credentials/nfc_cards/tokens`, permission `view:credential`. Requires UniFi Access 1.22.16 or later.

Live-verified.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `opts` | [`AccessOfficialPageOptions`](AccessOfficialPageOptions.md) | The page to fetch. |
| `call` | [`AccessOfficialCallOptions`](AccessOfficialCallOptions.md) | The per-call options - an optional abort signal. |

#### Returns

`Promise`\<[`AccessOfficialResult`](AccessOfficialResult.md)\<[`AccessOfficialNfcCard`](AccessOfficialNfcCard.md)[]\>\>

The page of cards, and the pagination describing it.

***

### fetchAllTouchPasses()

```ts
fetchAllTouchPasses(opts?, call?): Promise<AccessOfficialResult<AccessOfficialTouchPass[]>>;
```

Fetch a page of Touch Passes. `GET /credentials/touch_passes`, permission `view:credential`. Requires UniFi Access 3.2.20 or later.

Live-verified.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `opts` | [`AccessOfficialTouchPassListOptions`](AccessOfficialTouchPassListOptions.md) | The page to fetch, and the status to narrow to. |
| `call` | [`AccessOfficialCallOptions`](AccessOfficialCallOptions.md) | The per-call options - an optional abort signal. |

#### Returns

`Promise`\<[`AccessOfficialResult`](AccessOfficialResult.md)\<[`AccessOfficialTouchPass`](AccessOfficialTouchPass.md)[]\>\>

The page of passes, and the pagination describing it.

***

### fetchAssignableTouchPasses()

```ts
fetchAssignableTouchPasses(call?): Promise<AccessOfficialTouchPass[]>;
```

Fetch every Touch Pass that can be reassigned - the suspended and inactive ones. `GET /credentials/touch_passes/assignable`, permission `view:credential`.
Requires UniFi Access 3.2.20 or later.

Documentation-derived.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `call` | [`AccessOfficialCallOptions`](AccessOfficialCallOptions.md) | The per-call options - an optional abort signal. |

#### Returns

`Promise`\<[`AccessOfficialTouchPass`](AccessOfficialTouchPass.md)[]\>

The assignable passes.

***

### fetchNfcCard()

```ts
fetchNfcCard(token, call?): Promise<AccessOfficialNfcCard>;
```

Fetch one NFC card. `GET /credentials/nfc_cards/tokens/:token`, permission `view:credential`. Requires UniFi Access 1.22.16 or later.

Documentation-derived.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `token` | `string` | The card's token. |
| `call` | [`AccessOfficialCallOptions`](AccessOfficialCallOptions.md) | The per-call options - an optional abort signal. |

#### Returns

`Promise`\<[`AccessOfficialNfcCard`](AccessOfficialNfcCard.md)\>

The card.

***

### fetchNfcEnrollmentStatus()

```ts
fetchNfcEnrollmentStatus(sessionId, call?): Promise<AccessOfficialNfcEnrollmentStatus>;
```

Read what a reader has captured in an enrollment session. `GET /credentials/nfc_cards/sessions/:id`, permission `edit:credential`.

Documentation-derived.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `sessionId` | `string` | The session identifier. |
| `call` | [`AccessOfficialCallOptions`](AccessOfficialCallOptions.md) | The per-call options - an optional abort signal. |

#### Returns

`Promise`\<[`AccessOfficialNfcEnrollmentStatus`](AccessOfficialNfcEnrollmentStatus.md)\>

The card's token and identifier.

***

### fetchTouchPass()

```ts
fetchTouchPass(id, call?): Promise<AccessOfficialTouchPass>;
```

Fetch one Touch Pass in full. `GET /credentials/touch_passes/:id`, permission `view:credential`. Requires UniFi Access 3.2.20 or later.

Documentation-derived.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `id` | `string` | The pass's identifier. |
| `call` | [`AccessOfficialCallOptions`](AccessOfficialCallOptions.md) | The per-call options - an optional abort signal. |

#### Returns

`Promise`\<[`AccessOfficialTouchPass`](AccessOfficialTouchPass.md)\>

The pass.

***

### generatePinCode()

```ts
generatePinCode(call?): Promise<string>;
```

Mint a PIN code. `POST /credentials/pin_codes`, permission `view:credential`.

The code is minted, not assigned - hand it to a user or visitor through their own PIN assignment endpoint to put it into service.

Live-verified.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `call` | [`AccessOfficialCallOptions`](AccessOfficialCallOptions.md) | The per-call options - an optional abort signal. |

#### Returns

`Promise`\<`string`\>

The minted PIN code.

***

### importNfcCards()

```ts
importNfcCards(opts, call?): Promise<AccessOfficialNfcCardImportResult[]>;
```

Import third-party NFC cards from a CSV. `POST /credentials/nfc_cards/import`, permission `edit:credential`. Requires UniFi Access 3.3.10 or later.

The file is a CSV of `NFC_ID,alias` rows, where the identifiers are uppercase hex and each alias must be unique - a duplicate alias fails that row. The
envelope reports the import as a success either way, and each returned row carries an empty `token` when that row failed.

Documentation-derived.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `opts` | [`AccessOfficialFileUpload`](AccessOfficialFileUpload.md) | The CSV bytes and the name to send them under. |
| `call` | [`AccessOfficialCallOptions`](AccessOfficialCallOptions.md) | The per-call options - an optional abort signal. |

#### Returns

`Promise`\<[`AccessOfficialNfcCardImportResult`](AccessOfficialNfcCardImportResult.md)[]\>

One result per row of the file.

***

### purchaseTouchPasses()

```ts
purchaseTouchPasses(count, call?): Promise<AccessOfficialTouchPass>;
```

Purchase Touch Passes. `POST /credentials/touch_passes`, permission `edit:credential`. Requires UniFi Access 3.2.20 or later.

This spends money: the controller requires a payment method configured in the Access web application before it will accept the request.

Documentation-derived, and deliberately never exercised against a live controller for the reason above - so the shape here is the reference's, unconfirmed by
any capture.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `count` | `number` | How many passes to purchase. |
| `call` | [`AccessOfficialCallOptions`](AccessOfficialCallOptions.md) | The per-call options - an optional abort signal. |

#### Returns

`Promise`\<[`AccessOfficialTouchPass`](AccessOfficialTouchPass.md)\>

The purchased pass.

***

### searchTouchPasses()

```ts
searchTouchPasses(condition, call?): Promise<AccessOfficialTouchPass[]>;
```

Search Touch Passes by card identifier or holder name. `GET /credentials/touch_passes/search`, permission `view:credential`. Requires UniFi Access 3.2.20 or
later.

Documentation-derived.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `condition` | `string` | The card identifier or user name to match. |
| `call` | [`AccessOfficialCallOptions`](AccessOfficialCallOptions.md) | The per-call options - an optional abort signal. |

#### Returns

`Promise`\<[`AccessOfficialTouchPass`](AccessOfficialTouchPass.md)[]\>

The matching passes.

***

### updateNfcCard()

```ts
updateNfcCard(
   token, 
   opts, 
   call?
): Promise<void>;
```

Rename an NFC card. `PUT /credentials/nfc_cards/tokens/:token`, permission `edit:credential`. Requires UniFi Access 3.1.30 or later.

Documentation-derived.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `token` | `string` | The card's token. |
| `opts` | [`AccessOfficialNfcCardUpdate`](AccessOfficialNfcCardUpdate.md) | The members to change. |
| `call` | [`AccessOfficialCallOptions`](AccessOfficialCallOptions.md) | The per-call options - an optional abort signal. |

#### Returns

`Promise`\<`void`\>

***

### updateTouchPass()

```ts
updateTouchPass(
   id, 
   opts, 
   call?
): Promise<AccessOfficialTouchPass>;
```

Update a Touch Pass. `PUT /credentials/touch_passes/:id`, permission `edit:credential`. Requires UniFi Access 3.2.20 or later.

Documentation-derived.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `id` | `string` | The pass's identifier. |
| `opts` | [`AccessOfficialTouchPassUpdate`](AccessOfficialTouchPassUpdate.md) | The members to change. |
| `call` | [`AccessOfficialCallOptions`](AccessOfficialCallOptions.md) | The per-call options - an optional abort signal. |

#### Returns

`Promise`\<[`AccessOfficialTouchPass`](AccessOfficialTouchPass.md)\>

The updated pass.

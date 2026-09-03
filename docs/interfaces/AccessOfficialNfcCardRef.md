[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessOfficialNfcCardRef

# Interface: AccessOfficialNfcCardRef

An NFC card as a holder's own record names it - the handle and the card type, rather than the full card record.

Users and visitors both carry this, and both type-import it from here, because a card is a credential rather than a property of whoever holds it.

Live-verified.

## Properties

| Property | Modifier | Type |
| ------ | ------ | ------ |
| <a id="id"></a> `id` | `readonly` | `string` |
| <a id="token"></a> `token` | `readonly` | `string` |
| <a id="type"></a> `type` | `readonly` | \| `string` & \{ \} \| `"ua_card"` |

[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessOfficialNfcCard

# Interface: AccessOfficialNfcCard

An NFC card known to the controller.

Live-verified. `nfc_id` and `note` are on the wire and in no documented schema for this record - `nfc_id` is the card's own printed identifier, where `token` is
the controller's handle for it and the value every assignment endpoint takes.

## Properties

| Property | Modifier | Type |
| ------ | ------ | ------ |
| <a id="alias"></a> `alias` | `readonly` | `string` |
| <a id="card_type"></a> `card_type` | `readonly` | `string` |
| <a id="display_id"></a> `display_id` | `readonly` | `string` |
| <a id="nfc_id"></a> `nfc_id` | `readonly` | `string` |
| <a id="note"></a> `note` | `readonly` | `string` |
| <a id="status"></a> `status` | `readonly` | \| `string` & \{ \} \| `"assigned"` \| `"deleted"` \| `"disable"` \| `"loss"` \| `"pending"` |
| <a id="token"></a> `token` | `readonly` | `string` |
| <a id="user"></a> `user` | `readonly` | [`AccessOfficialNfcCardUser`](AccessOfficialNfcCardUser.md) |
| <a id="user_id"></a> `user_id` | `readonly` | `string` |
| <a id="user_type"></a> `user_type` | `readonly` | \| `string` & \{ \} \| `"USER"` \| `"VISITOR"` |

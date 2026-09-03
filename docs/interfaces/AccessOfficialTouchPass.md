[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessOfficialTouchPass

# Interface: AccessOfficialTouchPass

A Touch Pass: a credential provisioned onto a phone or watch rather than carried as a card.

The `user_*` members are empty strings when the pass is unassigned, which is the wire's own way of saying so - they are carried exactly as sent rather than
translated to `null`, because a consumer reaching past this library to the same endpoint would see the empty strings and expect them to agree.

`activated_at` and `expired_at` are optional because the list endpoint omits them; the detail endpoint reports them. Live-verified.

## Properties

| Property | Modifier | Type |
| ------ | ------ | ------ |
| <a id="activated_at"></a> `activated_at?` | `readonly` | `unknown` |
| <a id="bundles"></a> `bundles` | `readonly` | readonly [`AccessOfficialTouchPassBundle`](AccessOfficialTouchPassBundle.md)[] |
| <a id="card_id"></a> `card_id` | `readonly` | `string` |
| <a id="card_name"></a> `card_name` | `readonly` | `string` |
| <a id="expired_at"></a> `expired_at?` | `readonly` | `unknown` |
| <a id="id"></a> `id` | `readonly` | `string` |
| <a id="last_activity"></a> `last_activity` | `readonly` | `Nullable`\<`string`\> |
| <a id="status"></a> `status` | `readonly` | \| `string` & \{ \} \| `"ACTIVE"` \| `"SUSPENDED"` \| `"EXPIRED"` \| `"INACTIVE"` \| `"PENDING"` |
| <a id="user_avatar"></a> `user_avatar` | `readonly` | `string` |
| <a id="user_email"></a> `user_email` | `readonly` | `string` |
| <a id="user_id"></a> `user_id` | `readonly` | `string` |
| <a id="user_name"></a> `user_name` | `readonly` | `string` |
| <a id="user_status"></a> `user_status` | `readonly` | \| `string` & \{ \} \| `"ACTIVE"` \| `"PENDING"` \| `"UNLINK"` |

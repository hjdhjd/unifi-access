[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessOfficialTouchPassUpdate

# Interface: AccessOfficialTouchPassUpdate

Update a Touch Pass: rename it, change its status, or unbundle devices from it.

## Properties

| Property | Type |
| ------ | ------ |
| <a id="bundles"></a> `bundles?` | readonly [`AccessOfficialTouchPassBundleUpdate`](AccessOfficialTouchPassBundleUpdate.md)[] |
| <a id="card_name"></a> `card_name?` | `string` |
| <a id="status"></a> `status?` | `"ACTIVE"` \| `"SUSPENDED"` |

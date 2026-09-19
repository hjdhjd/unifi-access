[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessOfficialUserAvatar

# Interface: AccessOfficialUserAvatar

Where a user's uploaded profile picture lives. The answer carries the stored image's controller-relative path under `url`; the vendor reference documents that
member as `avatar_url`, and what the wire sends is what this declares.

Live-verified (2026-09-18): an upload answered one `url` member carrying a controller-relative path.

## Properties

| Property | Modifier | Type |
| ------ | ------ | ------ |
| <a id="url"></a> `url` | `readonly` | `string` |

[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessOfficialAccessMethodFace

# Interface: AccessOfficialAccessMethodFace

Face unlock's settings. The two tuning members apply only while the method itself is enabled, and a reader reports only the ones it supports.

Live-verified.

## Properties

| Property | Modifier | Type |
| ------ | ------ | ------ |
| <a id="anti_spoofing_level"></a> `anti_spoofing_level?` | `readonly` | \| `string` & \{ \} \| `"no"` \| `"high"` \| `"medium"` |
| <a id="detect_distance"></a> `detect_distance?` | `readonly` | \| `string` & \{ \} \| `"medium"` \| `"far"` \| `"near"` |
| <a id="enabled"></a> `enabled` | `readonly` | [`AccessOfficialAccessMethodValue`](../type-aliases/AccessOfficialAccessMethodValue.md) |

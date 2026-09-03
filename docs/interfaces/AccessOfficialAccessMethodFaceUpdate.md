[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessOfficialAccessMethodFaceUpdate

# Interface: AccessOfficialAccessMethodFaceUpdate

Set face unlock's settings.

The tuning members apply only while `enabled` is on, and the controller accepts only four combinations of the two: anti-spoofing `no` with detection distance
`far`, `no` with `medium`, `medium` with `near`, and `high` with `near`. That constraint is stated rather than typed: it comes from documentation this reference
has been wrong in before, and encoding it would risk making a combination the controller accepts impossible to send.

## Properties

| Property | Type |
| ------ | ------ |
| <a id="anti_spoofing_level"></a> `anti_spoofing_level?` | `"no"` \| `"high"` \| `"medium"` |
| <a id="detect_distance"></a> `detect_distance?` | `"medium"` \| `"far"` \| `"near"` |
| <a id="enabled"></a> `enabled?` | [`AccessOfficialAccessMethodValue`](../type-aliases/AccessOfficialAccessMethodValue.md) |

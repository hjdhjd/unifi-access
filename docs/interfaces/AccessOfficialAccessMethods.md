[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessOfficialAccessMethods

# Interface: AccessOfficialAccessMethods

The access methods a device offers, keyed by method.

This map is SPARSE, and every member is optional for that reason: a device reports only the methods its hardware class has, and a class with nothing to report
answers with an empty map. Coverage ranges from that empty map up to the full set this type declares. So an absent key means the device cannot do that method,
NOT that the method is switched off; reading absence as disabled is the misreading this type exists to prevent, and the two are distinguished by whether the
key is there rather than by its value.

Live-verified.

## Properties

| Property | Modifier | Type |
| ------ | ------ | ------ |
| <a id="bt_button"></a> `bt_button?` | `readonly` | [`AccessOfficialAccessMethodToggle`](AccessOfficialAccessMethodToggle.md) |
| <a id="bt_shake"></a> `bt_shake?` | `readonly` | [`AccessOfficialAccessMethodToggle`](AccessOfficialAccessMethodToggle.md) |
| <a id="bt_tap"></a> `bt_tap?` | `readonly` | [`AccessOfficialAccessMethodToggle`](AccessOfficialAccessMethodToggle.md) |
| <a id="face"></a> `face?` | `readonly` | [`AccessOfficialAccessMethodFace`](AccessOfficialAccessMethodFace.md) |
| <a id="mobile_wave"></a> `mobile_wave?` | `readonly` | [`AccessOfficialAccessMethodToggle`](AccessOfficialAccessMethodToggle.md) |
| <a id="nfc"></a> `nfc?` | `readonly` | [`AccessOfficialAccessMethodToggle`](AccessOfficialAccessMethodToggle.md) |
| <a id="pin_code"></a> `pin_code?` | `readonly` | [`AccessOfficialAccessMethodPinCode`](AccessOfficialAccessMethodPinCode.md) |
| <a id="qr_code"></a> `qr_code?` | `readonly` | [`AccessOfficialAccessMethodToggle`](AccessOfficialAccessMethodToggle.md) |
| <a id="touch_pass"></a> `touch_pass?` | `readonly` | [`AccessOfficialAccessMethodToggle`](AccessOfficialAccessMethodToggle.md) |
| <a id="wave"></a> `wave?` | `readonly` | [`AccessOfficialAccessMethodToggle`](AccessOfficialAccessMethodToggle.md) |

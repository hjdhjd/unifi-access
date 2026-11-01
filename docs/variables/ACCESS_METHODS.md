[**unifi-access**](../README.md)

***

[Home](../README.md) / ACCESS\_METHODS

# Variable: ACCESS\_METHODS

```ts
const ACCESS_METHODS: readonly ["face", "mobile", "nfc", "pin", "qr", "touchPass", "wave"];
```

Every access method a device can be switched by name - the ways a credential presented at a reader can open a door: `face` face unlock, `mobile` an unlock
from the UniFi Access mobile app over Bluetooth, `nfc` an NFC card, `pin` a PIN entered at the keypad, `qr` a QR code, `touchPass` a Touch Pass held in a
phone's wallet, and `wave` a hand wave at the reader.

The names are this library's own rather than any channel's. The controller spells one method differently on each surface that writes it - TouchPass is
`apple_pass` in a device's configuration rows and `touch_pass` in its official settings, and mobile unlock spans more than one key on every surface - so a
vocabulary keyed on a wire spelling would hand every consumer the per-surface table this module keeps. A consumer naming a method to switch reads this list
rather than restating it.

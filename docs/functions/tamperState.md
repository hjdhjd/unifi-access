[**unifi-access**](../README.md)

***

[Home](../README.md) / tamperState

# Function: tamperState()

```ts
function tamperState(device): boolean | undefined;
```

What a device's `tamper_event` configuration row reports: `true` where the controller has that device's tamper condition raised, `false` where it does not, and
`undefined` where nothing has established a reading.

Tampering is a property of the record rather than of a notification, which is why it is read rather than subscribed to. The controller keeps the condition on the
device's own row and revises it there, so a consumer asking what is true right now reads this, while the typed `tamperAlert` activity event announces the incident
as it happens. Each answers a different question, and a consumer announcing an alert reads the state separately rather than inferring it from the alert's arrival.

The neighbouring `tampering` row is the device's tampering-alert setting, and a live capture on a UA Ultra established what that setting does to the reading
beside it: the hardware reports no tamper input while it is off. An enclosure trip made with the setting off moved no row and raised no notification, while the
same trip made with it on moved the input row and raised the notification. So a record whose setting row is present and reads anything but `true` answers
`undefined` here, its input row being a stale reading rather than a quiet one, while a record carrying no setting row gates nothing, because an absent setting
is no evidence of gating.

The absent answer covers the situations a caller may want to tell apart from a quiet device, and they are deliberately not collapsed into `false`. The record may
carry no such row; it may carry no configuration rows at all, which is every record a token-only census produced, so a token client reads `undefined` here by
construction while [isTamperCapable](isTamperCapable.md) still answers; the device's tampering alert may be switched off, which leaves its input row a reading the hardware
has stopped revising; or the row may carry a value outside the spellings the controller has been observed to write, which is not guessed at. A caller telling a
first observation from a change needs that absence distinct from a reported `false`.

The reading is refreshed by the topology census and by the controller's original device-update dialect, whose every captured delivery is a full record carrying
the whole row array. The newer dialect carries no configuration rows at all, so a controller emitting only that one refreshes this at the periodic topology
re-read alone. And because a topology fetch already in flight when the condition flips lands the reading it was answered with, a flip can read as reverted until
the next delivery corrects it - the eventual consistency the reducer accepts for every member a census supplies.

## Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `device` | [`AccessStateDevice`](../type-aliases/AccessStateDevice.md) | Any device configuration record (only its configuration rows are read). |

## Returns

`boolean` \| `undefined`

`true` or `false` as the input row reports where the tampering-alert setting is on or absent, and `undefined` where no reading is established.

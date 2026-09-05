[**unifi-access**](../README.md)

***

[Home](../README.md) / isTamperCapable

# Function: isTamperCapable()

```ts
function isTamperCapable(device): boolean;
```

Whether a device's hardware can detect tampering - a unit that reports being opened, or pulled off the mount it was installed on.

The check is the controller's own `tamper_proofing` capability, and both censuses carry it: the topology document lists it among a device's capabilities and so
does the official device inventory. That is what sets this apart from [tamperState](tamperState.md), which answers only where a census established the configuration rows
- a client holding only a token can ask whether the hardware detects tampering at all, even though nothing has told it what the hardware currently reports.

## Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `device` | [`AccessStateDevice`](../type-aliases/AccessStateDevice.md) | Any device configuration record (only its capabilities are read). |

## Returns

`boolean`

`true` when the device carries the tamper capability.

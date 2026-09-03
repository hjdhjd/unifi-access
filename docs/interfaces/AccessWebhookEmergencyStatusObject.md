[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessWebhookEmergencyStatusObject

# Interface: AccessWebhookEmergencyStatusObject

What an emergency-status delivery reports: which emergency mode changed, whether it is now in force, and whether it applies to the whole site.

Documentation-derived: no capture in hand exercises this event.

## Properties

| Property | Modifier | Type |
| ------ | ------ | ------ |
| <a id="glocal"></a> `glocal` | `readonly` | `boolean` |
| <a id="mode"></a> `mode` | `readonly` | `"evacuation"` \| `"lockdown"` |
| <a id="value"></a> `value` | `readonly` | `boolean` |

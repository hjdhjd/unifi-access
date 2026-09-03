[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessOfficialEmergencyStatus

# Interface: AccessOfficialEmergencyStatus

Which site-wide emergency modes are in force.

The read shape is the wire's own pair of flags. Whether a controller can report both at once is not something the documentation settles, so the read transcribes
what arrives rather than foreclosing a state it might send - the write side is where the contradiction is made unrepresentable.

Live-verified.

## Properties

| Property | Modifier | Type |
| ------ | ------ | ------ |
| <a id="evacuation"></a> `evacuation` | `readonly` | `boolean` |
| <a id="lockdown"></a> `lockdown` | `readonly` | `boolean` |

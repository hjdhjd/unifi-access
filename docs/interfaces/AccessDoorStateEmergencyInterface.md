[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessDoorStateEmergencyInterface

# Interface: AccessDoorStateEmergencyInterface

A description of a door's emergency condition, reported as the two independent sources that can raise one. `hardware` is a physical emergency input wired to the
hub; `software` is a controller-issued emergency state. Both are open strings, observed as `none` when no emergency is in force.

## Properties

| Property | Type |
| ------ | ------ |
| <a id="hardware"></a> `hardware` | `string` |
| <a id="software"></a> `software` | `string` |

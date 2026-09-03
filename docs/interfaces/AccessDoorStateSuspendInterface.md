[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessDoorStateSuspendInterface

# Interface: AccessDoorStateSuspendInterface

A description of a door's unlock suspension - the controller's own record of a scheduled unlock that was suspended. `status` reports where the suspension stands
and `unlock_type` names the unlock it applies to, both open strings, and both observed empty or `end` on a door with nothing suspended.

## Properties

| Property | Type |
| ------ | ------ |
| <a id="status"></a> `status` | `string` |
| <a id="unlock_type"></a> `unlock_type` | `string` |

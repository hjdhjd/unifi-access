[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessDoorStateEntryInterface

# Interface: AccessDoorStateEntryInterface

A description of one door's live state, as the controller reports it on its newer notification dialect. Verified against live captures: a door hub sends an array of
these under `location_states` on a device update, and a door location sends the identical shape as its `state` member on a location update.

`lock` and `dps` are the two members a consumer reads first. `lock` reports the lock's own condition, observed as `locked` and `unlocked`. `dps` reports the door
position sensor, observed as `close`, `open`, and `none` - the last on a door whose sensor is not wired, which is also what `dps_connected` reports as `false`.
Both vocabularies are open strings the controller chooses rather than closed unions, because a hub class this library has never seen may report a value neither
capture generation carries, and a closed union would make that value unrepresentable rather than merely unfamiliar.

The alarm and suspension members reflect per-hub-class presence rather than a sparse payload: a door reporting no alarm and no suspension omits them entirely, and
the same door carries them on a later report when the condition arises. A consumer therefore reads their absence as "no alarm" and "not suspended".

Every member but the door's own identity is optional, which describes what an entry's source established rather than a sparse wire. A door hub reports the whole
record on every notification, so an entry born from one of its reports carries them all, while hardware this library holds no capture of may report fewer members and
its entries carry what it sent. An entry can also be seeded at connect from what a controller's other surfaces answer about a door, and those surfaces answer less:
hardware flags establish position only where a sensor is wired, and the official API knows nothing about wiring at all. Requiring a member would force such an entry
to invent a value for something nothing asked, so an entry states what its source established and stays silent on the rest. A consumer therefore reads an absent
member as "not established", distinct from a `dps` of `none` or an `is_unavailable` of `false`, which are the controller positively reporting a condition.

## Properties

| Property | Type |
| ------ | ------ |
| <a id="alarms"></a> `alarms?` | [`AccessDoorStateAlarmInterface`](AccessDoorStateAlarmInterface.md)[] |
| <a id="dps"></a> `dps?` | `string` |
| <a id="dps_connected"></a> `dps_connected?` | `boolean` |
| <a id="emergency"></a> `emergency?` | [`AccessDoorStateEmergencyInterface`](AccessDoorStateEmergencyInterface.md) |
| <a id="is_unavailable"></a> `is_unavailable?` | `boolean` |
| <a id="location_id"></a> `location_id` | `string` |
| <a id="lock"></a> `lock?` | `string` |
| <a id="unlock_suspend"></a> `unlock_suspend?` | [`AccessDoorStateSuspendInterface`](AccessDoorStateSuspendInterface.md) |

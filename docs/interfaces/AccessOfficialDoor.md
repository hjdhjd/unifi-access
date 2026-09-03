[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessOfficialDoor

# Interface: AccessOfficialDoor

A door.

`door_position_status` reports whether the door is physically open. Its vocabulary has already grown once past what the reference publishes - the wire answers
the string `"none"` on a hub whose position sensor is not wired, where the documentation describes `null` for that case - so both are carried, alongside the open
arm.

`extras` is where a UA Hub reports its door's position, under the `uah-input_state_dps` and `uah-wiring_state_dps` members. It is optional because the carriers
differ: a UA Hub populates it, a UA Hub Door Mini and a UA Ultra send an empty object, and some responses omit it entirely. An empty or absent `extras`
therefore says nothing about whether the door has a position sensor - a UA Hub Door Mini reports the same condition on its device record instead.

Live-verified.

## Properties

| Property | Modifier | Type |
| ------ | ------ | ------ |
| <a id="door_lock_relay_status"></a> `door_lock_relay_status` | `readonly` | \| `string` & \{ \} \| `"lock"` \| `"unlock"` |
| <a id="door_position_status"></a> `door_position_status` | `readonly` | \| `string` & \{ \} \| `"close"` \| `"none"` \| `"open"` \| `null` |
| <a id="extras"></a> `extras?` | `readonly` | `Readonly`\<`Record`\<`string`, `AccessKnownJsonValue`\>\> |
| <a id="floor_id"></a> `floor_id` | `readonly` | `string` |
| <a id="full_name"></a> `full_name` | `readonly` | `string` |
| <a id="id"></a> `id` | `readonly` | `string` |
| <a id="is_bind_hub"></a> `is_bind_hub` | `readonly` | `boolean` |
| <a id="name"></a> `name` | `readonly` | `string` |
| <a id="type"></a> `type` | `readonly` | \| `"door"` \| `string` & \{ \} |

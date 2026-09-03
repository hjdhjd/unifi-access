[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessEventDoorbellRingInterface

# Interface: AccessEventDoorbellRingInterface

A description of the UniFi Access doorbell ring event data payload.

The shape is verified against live captures on hub-class topology, a G2 Pro reader connected to a UAH door hub. Every required member arrives on both an older and a
current capture generation, while the optional members are the ones the current generation adds, so a consumer treats their absence as an ordinary payload rather
than a malformed one. Event shapes vary by door hub and reader type, and gate (UGT) topologies are unverified against any capture in hand, so a consumer running on
that hardware should expect the payload to differ from what is modeled here.

## Properties

| Property | Type |
| ------ | ------ |
| <a id="channel"></a> `channel` | `string` |
| <a id="clear_request_id"></a> `clear_request_id` | `string` |
| <a id="connected_uah_id"></a> `connected_uah_id` | `string` |
| <a id="connected_uah_type"></a> `connected_uah_type` | `string` |
| <a id="console_id"></a> `console_id?` | `string` |
| <a id="controller_id"></a> `controller_id` | `string` |
| <a id="create_time"></a> `create_time` | `number` |
| <a id="device_id"></a> `device_id` | `string` |
| <a id="device_name"></a> `device_name` | `string` |
| <a id="device_type"></a> `device_type` | `string` |
| <a id="disable_pickup"></a> `disable_pickup?` | `boolean` |
| <a id="door_guard_ids"></a> `door_guard_ids` | `string`[] |
| <a id="door_id"></a> `door_id?` | `string` |
| <a id="door_name"></a> `door_name` | `string` |
| <a id="doorbell_channel"></a> `doorbell_channel?` | `string` |
| <a id="floor_name"></a> `floor_name` | `string` |
| <a id="has_package_camera"></a> `has_package_camera?` | `boolean` |
| <a id="host_device_mac"></a> `host_device_mac` | `string` |
| <a id="hub_gate_door_mode"></a> `hub_gate_door_mode?` | `string` |
| <a id="in_or_out"></a> `in_or_out` | `string` |
| <a id="is_camera"></a> `is_camera?` | `boolean` |
| <a id="is_double_driveway"></a> `is_double_driveway?` | `boolean` |
| <a id="mutable_content"></a> `mutable_content?` | `boolean` |
| <a id="reason_code"></a> `reason_code` | `number` |
| <a id="request_id"></a> `request_id` | `string` |
| <a id="room_id"></a> `room_id` | `string` |
| <a id="send_voip"></a> `send_voip?` | `boolean` |
| <a id="support_feature"></a> `support_feature` | `string`[] |
| <a id="template_id"></a> `template_id?` | `string` |
| <a id="token"></a> `token` | `string` |
| <a id="unlocking_not_allowed"></a> `unlocking_not_allowed?` | `boolean` |

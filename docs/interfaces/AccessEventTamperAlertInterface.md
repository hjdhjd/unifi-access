[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessEventTamperAlertInterface

# Interface: AccessEventTamperAlertInterface

A description of the UniFi Access tamper alert event data payload, verified against live captures: an alert carries exactly the members declared here and nothing
besides. `device` names the hardware that raised it, which is the identity the alert is attributed to, and `title` is the controller's own notification headline.

There is deliberately no verdict here, because the wire carries none. The payload says that an alert was raised and names what raised it; what the hardware
currently reports lives on that device's own configuration row, and a consumer wanting it reads the state rather than inferring it from this.

## Properties

| Property | Type |
| ------ | ------ |
| <a id="device"></a> `device` | \{ `device_type`: `string`; `firmware`: `string`; `guid`: `string`; `is_connected`: `boolean`; `mac`: `string`; `name`: `string`; `unique_id`: `string`; \} |
| `device.device_type` | `string` |
| `device.firmware` | `string` |
| `device.guid` | `string` |
| `device.is_connected` | `boolean` |
| `device.mac` | `string` |
| `device.name` | `string` |
| `device.unique_id` | `string` |
| <a id="door_id"></a> `door_id` | `string` |
| <a id="door_name"></a> `door_name` | `string` |
| <a id="host_device_mac"></a> `host_device_mac` | `string` |
| <a id="notify_user_ids"></a> `notify_user_ids` | `string`[] |
| <a id="request_id"></a> `request_id` | `string` |
| <a id="title"></a> `title` | `string` |

[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessEventDoorbellCancelInterface

# Interface: AccessEventDoorbellCancelInterface

A description of the UniFi Access doorbell ring cancel event data payload, verified against live captures: a cancellation carries exactly the members declared here
and nothing besides. `remote_call_request_id` repeats the `request_id` of the [AccessEventDoorbellRingInterface](AccessEventDoorbellRingInterface.md) it ends, which is how a consumer pairs a
cancellation with the call it belongs to.

## Properties

| Property | Type |
| ------ | ------ |
| <a id="reason_code"></a> `reason_code` | `number` |
| <a id="remote_call_request_id"></a> `remote_call_request_id` | `string` |

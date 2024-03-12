[unifi-access](README.md) / Exports

# unifi-access

## Table of contents

### Classes

- [AccessApi](classes/AccessApi.md)
- [FetchError](classes/FetchError.md)

### Interfaces

- [AccessBootstrapConfig](interfaces/AccessBootstrapConfig.md)
- [AccessBootstrapConfigInterface](interfaces/AccessBootstrapConfigInterface.md)
- [AccessControllerConfig](interfaces/AccessControllerConfig.md)
- [AccessControllerConfigInterface](interfaces/AccessControllerConfigInterface.md)
- [AccessControllerConfigPayload](interfaces/AccessControllerConfigPayload.md)
- [AccessDeviceConfig](interfaces/AccessDeviceConfig.md)
- [AccessDeviceConfigInterface](interfaces/AccessDeviceConfigInterface.md)
- [AccessDeviceConfigPayload](interfaces/AccessDeviceConfigPayload.md)
- [AccessDeviceEntryConfig](interfaces/AccessDeviceEntryConfig.md)
- [AccessDeviceEntryConfigInterface](interfaces/AccessDeviceEntryConfigInterface.md)
- [AccessDeviceEntryConfigPayload](interfaces/AccessDeviceEntryConfigPayload.md)
- [AccessDeviceExtrasConfigInterface](interfaces/AccessDeviceExtrasConfigInterface.md)
- [AccessDoorConfig](interfaces/AccessDoorConfig.md)
- [AccessDoorConfigInterface](interfaces/AccessDoorConfigInterface.md)
- [AccessDoorConfigPayload](interfaces/AccessDoorConfigPayload.md)
- [AccessFloorConfig](interfaces/AccessFloorConfig.md)
- [AccessFloorConfigInterface](interfaces/AccessFloorConfigInterface.md)
- [AccessFloorConfigPayload](interfaces/AccessFloorConfigPayload.md)
- [AccessLogging](interfaces/AccessLogging.md)

### Type Aliases

- [AccessApiResponse](modules.md#accessapiresponse)
- [AccessEventDoorbellCancel](modules.md#accesseventdoorbellcancel)
- [AccessEventDoorbellRing](modules.md#accesseventdoorbellring)
- [AccessEventPacket](modules.md#accesseventpacket)

## Type Aliases

### AccessApiResponse

Ƭ **AccessApiResponse**: `Object`

UniFi Access API response JSON.

#### Type declaration

| Name | Type |
| :------ | :------ |
| `code` | `number` |
| `codeS` | `string` |
| `data` | `Record`\<`string`, `unknown`\> \| `Record`\<`string`, `unknown`\>[] \| `string` |
| `error` | `string` |
| `msg` | `string` |

#### Defined in

[src/access-types.ts:9](https://github.com/hjdhjd/unifi-access/blob/0e21590/src/access-types.ts#L9)

___

### AccessEventDoorbellCancel

Ƭ **AccessEventDoorbellCancel**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `reason_code` | `number` |
| `remote_call_request_id` | `string` |

#### Defined in

[src/access-types.ts:62](https://github.com/hjdhjd/unifi-access/blob/0e21590/src/access-types.ts#L62)

___

### AccessEventDoorbellRing

Ƭ **AccessEventDoorbellRing**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `channel` | `string` |
| `clear_request_id` | `string` |
| `connected_uah_id` | `string` |
| `connected_uah_type` | `string` |
| `controller_id` | `string` |
| `create_time` | `number` |
| `device_id` | `string` |
| `device_name` | `string` |
| `device_type` | `string` |
| `door_guard_ids` | `string`[] |
| `door_name` | `string` |
| `floor_name` | `string` |
| `host_device_mac` | `string` |
| `in_or_out` | `string` |
| `reason_code` | `number` |
| `request_id` | `string` |
| `room_id` | `string` |
| `support_feature` | `string`[] |
| `token` | `string` |

#### Defined in

[src/access-types.ts:38](https://github.com/hjdhjd/unifi-access/blob/0e21590/src/access-types.ts#L38)

___

### AccessEventPacket

Ƭ **AccessEventPacket**: `Object`

UniFi Access event packet.

**`Param`**

Access event topic.

**`Param`**

Access event payload.

**`Remarks`**

A UniFi Access event packet is the representation of a notification event from a UniFi Access controller. The Access `event` property informs us of the
notification type, such as `access.data.device.remote_unlock`, for door unlock events. The details of the event are delivered as a JSON payload in the `data`
property.

#### Type declaration

| Name | Type |
| :------ | :------ |
| `data` | `Record`\<`string`, `string`\> \| `Record`\<`string`, `unknown`\> \| [`AccessControllerConfig`](interfaces/AccessControllerConfig.md) \| [`AccessDeviceConfig`](interfaces/AccessDeviceConfig.md) |
| `event` | `string` |
| `event_object_id` | `string` |
| `receiver_id` | `string` |
| `save_to_history` | `boolean` |

#### Defined in

[src/access-types.ts:28](https://github.com/hjdhjd/unifi-access/blob/0e21590/src/access-types.ts#L28)

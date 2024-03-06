[unifi-access](README.md) / Exports

# unifi-access

## Table of contents

### Classes

- [AccessApi](classes/AccessApi.md)
- [FetchError](classes/FetchError.md)

### Interfaces

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
- [AccessTopologyConfig](interfaces/AccessTopologyConfig.md)
- [AccessTopologyConfigInterface](interfaces/AccessTopologyConfigInterface.md)
- [AccessTopologyConfigPayload](interfaces/AccessTopologyConfigPayload.md)

### Type Aliases

- [AccessApiResponse](modules.md#accessapiresponse)
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
| `data` | `string` |
| `error` | `string` |
| `msg` | `string` |

#### Defined in

[src/access-types.ts:9](https://github.com/hjdhjd/unifi-access/blob/870bfaa/src/access-types.ts#L9)

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
| `data` | `Record`\<`string`, `string`\> |
| `event` | `string` |
| `event_object_id` | `string` |
| `receiver_id` | `string` |
| `save_to_history` | `boolean` |

#### Defined in

[src/access-types.ts:28](https://github.com/hjdhjd/unifi-access/blob/870bfaa/src/access-types.ts#L28)

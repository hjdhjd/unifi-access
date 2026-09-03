[**unifi-access**](../README.md)

***

[Home](../README.md) / OfficialDevices

# Interface: OfficialDevices

The official API's device domain: the adopted inventory, the per-device access-method settings, and the doorbell trigger.

## Methods

### fetchAll()

```ts
fetchAll(opts?, call?): Promise<AccessOfficialDevice[][]>;
```

Fetch the adopted devices, grouped by the door they serve. `GET /devices`, permission `view:device`.

The payload is an array of arrays, and it is returned as one: each inner array holds the devices attached to a single door. The reference's schema table
describes a flat array, but its own sample and the wire both nest, and flattening here would hide which devices share a door - a projection a caller can make
for itself, where the grouping cannot be recovered once it is thrown away.

Live-verified.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `opts` | [`AccessOfficialDeviceListOptions`](AccessOfficialDeviceListOptions.md) | Whether to bypass the controller's device cache. |
| `call` | [`AccessOfficialCallOptions`](AccessOfficialCallOptions.md) | The per-call options - an optional abort signal. |

#### Returns

`Promise`\<[`AccessOfficialDevice`](AccessOfficialDevice.md)[][]\>

The devices, grouped per door.

***

### fetchSettings()

```ts
fetchSettings(deviceId, call?): Promise<AccessOfficialDeviceSettings>;
```

Read a device's access-method settings. `GET /devices/:device_id/settings`, permission `view:device`. Requires UniFi Access 3.3.10 or later.

The returned map is sparse - see [AccessOfficialAccessMethods](AccessOfficialAccessMethods.md) for why an absent method is not a disabled one.

Live-verified.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `deviceId` | `string` | The device's identifier. |
| `call` | [`AccessOfficialCallOptions`](AccessOfficialCallOptions.md) | The per-call options - an optional abort signal. |

#### Returns

`Promise`\<[`AccessOfficialDeviceSettings`](AccessOfficialDeviceSettings.md)\>

The device's settings.

***

### triggerDoorbell()

```ts
triggerDoorbell(
   deviceId, 
   opts?, 
   call?
): Promise<void>;
```

Ring a doorbell, or cancel one that is ringing. `POST /devices/:device_id/doorbell`, permission `edit:device`. Requires UniFi Access 4.0.10 or later.

Live-verified.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `deviceId` | `string` | The reader's identifier. |
| `opts` | [`AccessOfficialDoorbellTriggerOptions`](AccessOfficialDoorbellTriggerOptions.md) | The Intercom directory name to ring, or whether to cancel a call already in progress. |
| `call` | [`AccessOfficialCallOptions`](AccessOfficialCallOptions.md) | The per-call options - an optional abort signal. |

#### Returns

`Promise`\<`void`\>

***

### updateSettings()

```ts
updateSettings(
   deviceId, 
   opts, 
   call?
): Promise<void>;
```

Update a device's access-method settings. `PUT /devices/:device_id/settings`, permission `edit:device`. Requires UniFi Access 3.3.10 or later.

The write takes the same nested shape and the same `"no"`/`"yes"` vocabulary the read returns. The reference's field table spells the values `"true"` and
`"false"` and names the methods as dotted top-level parameters, and it is contradicted on both counts by its own request sample and by the wire.

A method whose prerequisites the controller lacks is declined silently: the request answers success and the setting is left as it was. So a caller that needs
certainty about what took effect reads the settings back rather than treating the success as confirmation.

Live-verified.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `deviceId` | `string` | The device's identifier. |
| `opts` | [`AccessOfficialDeviceSettingsUpdate`](AccessOfficialDeviceSettingsUpdate.md) | The methods to change. |
| `call` | [`AccessOfficialCallOptions`](AccessOfficialCallOptions.md) | The per-call options - an optional abort signal. |

#### Returns

`Promise`\<`void`\>

[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessOfficialDeviceSettingsUpdate

# Interface: AccessOfficialDeviceSettingsUpdate

Update a device's access-method settings.

The body nests the methods under `access_methods`, in the same shape the read returns, rather than carrying the dotted top-level names the reference's field
table lists. The reference's own request sample sends the nested form, and the wire agrees with the sample rather than with the table.

Live-verified.

## Properties

| Property | Type |
| ------ | ------ |
| <a id="access_methods"></a> `access_methods` | [`AccessOfficialAccessMethodsUpdate`](AccessOfficialAccessMethodsUpdate.md) |

[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessOfficialLicensePlate

# Interface: AccessOfficialLicensePlate

A license plate registered as a credential.

This is the one declaration of the shape in the library: users and visitors both carry it, and both type-import it from here because a license plate is a
credential rather than a property of whoever holds it.

Documentation-derived.

## Properties

| Property | Modifier | Type |
| ------ | ------ | ------ |
| <a id="credential"></a> `credential` | `readonly` | `string` |
| <a id="credential_status"></a> `credential_status` | `readonly` | \| `string` & \{ \} \| `"active"` \| `"deactivate"` |
| <a id="credential_type"></a> `credential_type` | `readonly` | \| `string` & \{ \} \| `"license"` |
| <a id="id"></a> `id` | `readonly` | `string` |

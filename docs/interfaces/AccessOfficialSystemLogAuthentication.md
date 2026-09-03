[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessOfficialSystemLogAuthentication

# Interface: AccessOfficialSystemLogAuthentication

How the credential behind a log entry was presented. Null on an entry that involved no authentication at all, such as a device reboot.

`credential_provider` speaks the same vocabulary an unlock's authentication type does and reads through [ACCESS\_AUTHENTICATION\_TYPES](../variables/ACCESS_AUTHENTICATION_TYPES.md) when the value is
being shown to a person. This channel delivers the uppercase spelling, so the lookup needs no case folding.

Live-verified.

## Properties

| Property | Modifier | Type |
| ------ | ------ | ------ |
| <a id="credential_provider"></a> `credential_provider` | `readonly` | `string` |
| <a id="issuer"></a> `issuer` | `readonly` | `string` |

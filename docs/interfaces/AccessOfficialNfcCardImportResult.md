[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessOfficialNfcCardImportResult

# Interface: AccessOfficialNfcCardImportResult

The outcome of one row of an NFC card import.

An empty `token` is the wire's own marker that this row failed - the controller reports the whole import as a success and marks the individual rows, so a caller
that only checked the envelope would believe every row landed. The value is carried as the wire sent it rather than translated into an error.

Documentation-derived.

## Properties

| Property | Modifier | Type |
| ------ | ------ | ------ |
| <a id="alias"></a> `alias` | `readonly` | `string` |
| <a id="nfc_id"></a> `nfc_id` | `readonly` | `string` |
| <a id="token"></a> `token` | `readonly` | `string` |

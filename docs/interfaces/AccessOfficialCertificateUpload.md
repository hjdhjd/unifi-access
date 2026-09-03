[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessOfficialCertificateUpload

# Interface: AccessOfficialCertificateUpload

The certificate and private key to install on the official API's TLS listener.

Both are files the caller read and names: the reference's own sample calls them `server.crt` and `server.key`, but the filenames sent are whatever the caller
supplies, because they belong to the caller's own key material rather than to this library.

## Properties

| Property | Type |
| ------ | ------ |
| <a id="cert"></a> `cert` | [`AccessOfficialFileUpload`](AccessOfficialFileUpload.md) |
| <a id="key"></a> `key` | [`AccessOfficialFileUpload`](AccessOfficialFileUpload.md) |

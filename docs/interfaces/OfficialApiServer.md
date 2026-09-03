[**unifi-access**](../README.md)

***

[Home](../README.md) / OfficialApiServer

# Interface: OfficialApiServer

The official API's own server domain: the TLS certificate the developer port presents.

Both endpoints are documentation-derived. Neither has been exercised against a live controller, because each rewrites durable controller configuration.

## Methods

### deleteCertificate()

```ts
deleteCertificate(call?): Promise<void>;
```

Remove the installed certificate, returning the listener to the one it ships with. `DELETE /api_server/certificates`, permission `edit:api_server`. Requires
UniFi Access 2.2.10 or later.

Documentation-derived.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `call` | [`AccessOfficialCallOptions`](AccessOfficialCallOptions.md) | The per-call options - an optional abort signal. |

#### Returns

`Promise`\<`void`\>

***

### uploadCertificate()

```ts
uploadCertificate(opts, call?): Promise<void>;
```

Install a certificate on the official API's TLS listener. `POST /api_server/certificates`, permission `edit:api_server`. Requires UniFi Access 2.2.10 or
later.

This applies to the developer port alone, and the Access application must be restarted before the new certificate is presented. That restart takes down the
very port every official request rides, so a caller should expect requests to fail for the length of the restart - and repeated failures across that window
trip the transport's throttle cooldown exactly as any other stretch of an unreachable controller does.

A key that does not match its certificate is refused as a parameter error.

Documentation-derived.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `opts` | [`AccessOfficialCertificateUpload`](AccessOfficialCertificateUpload.md) | The certificate and its private key. |
| `call` | [`AccessOfficialCallOptions`](AccessOfficialCallOptions.md) | The per-call options - an optional abort signal. |

#### Returns

`Promise`\<`void`\>

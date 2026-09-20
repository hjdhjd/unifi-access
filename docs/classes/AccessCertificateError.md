[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessCertificateError

# Class: AccessCertificateError

A listener presented a certificate the platform's verification refused. The request path and the notification socket both raise it, so a caller reads one class
whichever channel met the refusal, and the sentence names the listener that presented the certificate, the address it was dialed at, and the verifier's own
reason.

Recoverable, and deliberately so: an operator who installs a certificate the verifier accepts fixes this while the process runs, so the connection monitor
keeps trying on its own cadence and finds the listener answering rather than stopping on a fault it would never retry. Subclassing [AccessNetworkError](AccessNetworkError.md)
is what keeps that true without any policy being restated - every reading that treats a reachability failure as recoverable treats this one the same way, and
a caller that wants the certificate case in particular branches on this class.

## Extends

- [`AccessNetworkError`](AccessNetworkError.md)

## Constructors

### Constructor

```ts
new AccessCertificateError(options): AccessCertificateError;
```

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `options` | \{ `cause`: `unknown`; `host`: `string`; `identity`: [`AccessIdentityLeg`](../type-aliases/AccessIdentityLeg.md); \} |
| `options.cause` | `unknown` |
| `options.host` | `string` |
| `options.identity` | [`AccessIdentityLeg`](../type-aliases/AccessIdentityLeg.md) |

#### Returns

`AccessCertificateError`

#### Overrides

[`AccessNetworkError`](AccessNetworkError.md).[`constructor`](AccessNetworkError.md#constructor)

## Properties

| Property | Modifier | Type | Description | Inherited from |
| ------ | ------ | ------ | ------ | ------ |
| <a id="code"></a> `code` | `readonly` | `string` \| `undefined` | The Node errno string (e.g., `"ECONNREFUSED"`, `"ETIMEDOUT"`), when one could be resolved from the cause chain. | [`AccessNetworkError`](AccessNetworkError.md).[`code`](AccessNetworkError.md#code) |
| <a id="host"></a> `host` | `readonly` | `string` | The address the listener was dialed at, exactly as the transport or the stream dialed it: the bare host for the console, and `host:port` for the developer API, which answers on a port of its own. | - |
| <a id="identity"></a> `identity` | `readonly` | [`AccessIdentityLeg`](../type-aliases/AccessIdentityLeg.md) | Which listener presented the certificate, named by the identity that reaches it - `"credentials"` is the UniFi console, `"token"` is the Access developer API. The leg names the listener here because each identity reaches exactly one of them, so nothing further has to be threaded through the transports to say which certificate a user is being told about. The remedy follows from the leg. A certificate installed on the console never reaches the developer API, which presents one of its own, so a token identity is fixed by a certificate installed on the developer API itself - [OfficialApiServer.uploadCertificate](../interfaces/OfficialApiServer.md#uploadcertificate) is the surface that installs one. | - |

[**unifi-access**](../README.md)

***

[Home](../README.md) / OfficialApi

# Interface: OfficialApi

The official UniFi Access API, as typed domains over one request path.

Every endpoint the reference publishes is a typed method on one of the domain members below, organized the way the reference organizes them. What the reference
does not publish goes through the three hatches - `request`, `command`, and `download` - which take a path below the application prefix and give a caller the
same envelope handling, error classification, and encoding the typed methods get. So an undocumented endpoint is reachable without waiting for a library
release, and without a second way of talking to the controller growing up beside this one.

One transport serves every domain, which is deliberate: the throttle breaker it carries then models the CONTROLLER's health rather than any one domain's. An
official refusal arrives under a success status inside the envelope and never books a breaker failure - only genuine reachability faults do - so a breaker that
opens is saying the controller is unreachable, and throttling every domain at that point is the breaker doing its job.

## Properties

| Property | Modifier | Type | Description |
| ------ | ------ | ------ | ------ |
| <a id="credentials"></a> `credentials` | `readonly` | [`OfficialCredentials`](OfficialCredentials.md) | Credentials: PIN codes, NFC cards and their enrollment sessions, Touch Passes, and visitor QR codes. |
| <a id="devices"></a> `devices` | `readonly` | [`OfficialDevices`](OfficialDevices.md) | Devices: the adopted inventory, per-device access-method settings, and the doorbell trigger. |
| <a id="identity"></a> `identity` | `readonly` | [`OfficialIdentity`](OfficialIdentity.md) | UniFi Identity: invitations, and the Identity resources assigned to users and groups. |
| <a id="logs"></a> `logs` | `readonly` | [`OfficialSystemLogs`](OfficialSystemLogs.md) | System logs: the searchable activity record, its CSV export, and the media entries point at. |
| <a id="policies"></a> `policies` | `readonly` | [`OfficialAccessPolicies`](OfficialAccessPolicies.md) | Access policies: the policies themselves, holiday groups, and schedules. |
| <a id="server"></a> `server` | `readonly` | [`OfficialApiServer`](OfficialApiServer.md) | The API server itself: the TLS certificate the developer port presents. |
| <a id="spaces"></a> `spaces` | `readonly` | [`OfficialSpaces`](OfficialSpaces.md) | Spaces: the door topology, door groups, and the unlock, lock-rule, and emergency controls. |
| <a id="users"></a> `users` | `readonly` | [`OfficialUsers`](OfficialUsers.md) | Users: local accounts, the user-group hierarchy, and the credentials and policies attached to both. |
| <a id="visitors"></a> `visitors` | `readonly` | [`OfficialVisitors`](OfficialVisitors.md) | Visitors: time-bounded guests, their visit scheduling, and the credentials issued to them. |
| <a id="webhooks"></a> `webhooks` | `readonly` | [`OfficialWebhooks`](OfficialWebhooks.md) | Webhooks: the endpoints the controller delivers to. |

## Methods

### command()

```ts
command(path, opts?): Promise<void>;
```

Send a mutation to an official endpoint this library does not model, where success carries no payload worth reading.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `path` | `string` | The endpoint path below the application prefix, with its leading slash. |
| `opts` | [`AccessOfficialRequestOptions`](AccessOfficialRequestOptions.md) | Per-request options, encoded and threaded exactly as they are for a typed method. |

#### Returns

`Promise`\<`void`\>

***

### download()

```ts
download(path, opts?): Promise<Buffer<ArrayBufferLike>>;
```

Fetch raw bytes from an official endpoint this library does not model.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `path` | `string` | The endpoint path below the application prefix, with its leading slash. |
| `opts` | [`AccessOfficialRequestOptions`](AccessOfficialRequestOptions.md) | Per-request options, encoded and threaded exactly as they are for a typed method. |

#### Returns

`Promise`\<`Buffer`\<`ArrayBufferLike`\>\>

The response body as raw bytes.

***

### request()

```ts
request<T>(path, opts?): Promise<AccessOfficialResult<T>>;
```

Send a request to an official endpoint this library does not model, and unwrap its result envelope.

#### Type Parameters

| Type Parameter | Description |
| ------ | ------ |
| `T` | The payload shape the endpoint returns. The caller asserts it, exactly as it does on the typed domain methods. |

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `path` | `string` | The endpoint path below the application prefix, with its leading slash. |
| `opts` | [`AccessOfficialRequestOptions`](AccessOfficialRequestOptions.md) | Per-request options, encoded and threaded exactly as they are for a typed method. |

#### Returns

`Promise`\<[`AccessOfficialResult`](AccessOfficialResult.md)\<`T`\>\>

The endpoint's payload, and its pagination when it paginates.

[**unifi-access**](../README.md)

***

[Home](../README.md) / OfficialSystemLogs

# Interface: OfficialSystemLogs

The official API's system-log domain: the searchable activity record, its CSV export, and the media entries can point at.

## Methods

### export()

```ts
export(opts, call?): Promise<Buffer<ArrayBufferLike>>;
```

Export log entries as CSV. `POST /system/logs/export`, permission `view:system_log`. Requires UniFi Access 1.20.11 or later.

Documentation-derived.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `opts` | [`AccessOfficialSystemLogExportOptions`](AccessOfficialSystemLogExportOptions.md) | The topic, the window, and the timezone to render timestamps in. |
| `call` | [`AccessOfficialCallOptions`](AccessOfficialCallOptions.md) | The per-call options - an optional abort signal. |

#### Returns

`Promise`\<`Buffer`\<`ArrayBufferLike`\>\>

The CSV bytes.

***

### fetch()

```ts
fetch(opts, call?): Promise<AccessOfficialResult<AccessOfficialSystemLogHits>>;
```

Fetch a page of log entries. `POST /system/logs`, permission `view:system_log`.

The verb is POST because the query goes in a body, but this is a read: repeating it returns the same page rather than doing anything twice, so it opts back
in to the transparent retry that the surface's genuinely-minting POSTs opt out of.

The pagination goes in the query string while the filter goes in the body, which is the endpoint's own split rather than this library's.

Live-verified.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `opts` | [`AccessOfficialSystemLogFetchOptions`](AccessOfficialSystemLogFetchOptions.md) | The topic to query, the window to query it over, and the page to fetch. |
| `call` | [`AccessOfficialCallOptions`](AccessOfficialCallOptions.md) | The per-call options - an optional abort signal. |

#### Returns

`Promise`\<[`AccessOfficialResult`](AccessOfficialResult.md)\<[`AccessOfficialSystemLogHits`](AccessOfficialSystemLogHits.md)\>\>

The page of entries, and the pagination describing it.

***

### fetchResource()

```ts
fetchResource(id, call?): Promise<AccessOfficialSystemLogResource>;
```

Fetch the media a log entry points at. `GET /system/logs/resource/:id`, permission `view:system_log`. Requires UniFi Access 1.24.6 or later.

The identifier comes from a log entry's target typed `activities_resource`.

Documentation-derived.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `id` | `string` | The resource's identifier. |
| `call` | [`AccessOfficialCallOptions`](AccessOfficialCallOptions.md) | The per-call options - an optional abort signal. |

#### Returns

`Promise`\<[`AccessOfficialSystemLogResource`](AccessOfficialSystemLogResource.md)\>

Where the recording and its thumbnail live.

***

### fetchStaticResource()

```ts
fetchStaticResource(path, call?): Promise<Buffer<ArrayBufferLike>>;
```

Fetch a static resource by its own path. `GET /system/static/:path`, permission `view:system_log`. Requires UniFi Access 1.24.6 or later.

The parameter is a wire path rather than an identifier - `avatar/<id>`, `activities_resource/video/<file>.jpg` - taken verbatim from a log record. It is
therefore interpolated without escaping, because its slashes are path structure the controller expects, not characters to encode.

Documentation-derived.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `path` | `string` | The resource path, exactly as a log record spelled it. |
| `call` | [`AccessOfficialCallOptions`](AccessOfficialCallOptions.md) | The per-call options - an optional abort signal. |

#### Returns

`Promise`\<`Buffer`\<`ArrayBufferLike`\>\>

The resource bytes.

***

### iterate()

```ts
iterate(opts, call?): AsyncGenerator<AccessOfficialSystemLogHit>;
```

Iterate every log entry the query matches, walking the pages to their end. `POST /system/logs`, permission `view:system_log`.

A log is unbounded in a way a listing is not, so a caller bounds the walk with `since` and `until`, or stops iterating early - returning from a `for await`
ends the walk at the page it is on.

Composed over [OfficialSystemLogs.fetch](#fetch); the endpoint is live-verified.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `opts` | [`AccessOfficialSystemLogFetchOptions`](AccessOfficialSystemLogFetchOptions.md) | The topic to query, the window to query it over, and the page size to walk it in. |
| `call` | [`AccessOfficialCallOptions`](AccessOfficialCallOptions.md) | The per-call options - an optional abort signal. |

#### Returns

`AsyncGenerator`\<[`AccessOfficialSystemLogHit`](AccessOfficialSystemLogHit.md)\>

Every entry the query matches, in the order its pages carry them.

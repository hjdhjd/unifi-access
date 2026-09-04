[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessClient

# Class: AccessClient

The UniFi Access client. Construct it through [AccessClient.connect](#connect).

## Implements

- `AsyncDisposable`

## Accessors

### accessPoints

#### Get Signature

```ts
get accessPoints(): readonly AccessHub[];
```

Every door-serving port of every Enterprise Access Hub, as live handles - one per door the hardware drives.

##### Returns

readonly [`AccessHub`](../interfaces/AccessHub.md)[]

***

### capabilities

#### Get Signature

```ts
get capabilities(): AccessCapabilities;
```

What this client can do, as established at connect: the identities it holds, whether the official path is available, and the routing override in force.

A connect-time snapshot rather than a live reading. See [AccessCapabilities](../interfaces/AccessCapabilities.md) for what that does and does not move.

##### Returns

[`AccessCapabilities`](../interfaces/AccessCapabilities.md)

***

### connection

#### Get Signature

```ts
get connection(): ConnectionMonitor;
```

The connection monitor: the observable state machine, restart detection, throttle and stall folding, and automatic recovery of the realtime channel.

##### Returns

[`ConnectionMonitor`](../interfaces/ConnectionMonitor.md)

***

### controllerInfo

#### Get Signature

```ts
get controllerInfo(): Nullable<AccessControllerConfigInterface>;
```

The controller's own information document, or `null` before one has been fetched.

##### Returns

`Nullable`\<[`AccessControllerConfigInterface`](../interfaces/AccessControllerConfigInterface.md)\>

***

### controllerName

#### Get Signature

```ts
get controllerName(): Nullable<string>;
```

The controller's display name, or `null` before its information document has been fetched - which a connected client never sees, since connect awaits it.

##### Returns

`Nullable`\<`string`\>

***

### devices

#### Get Signature

```ts
get devices(): readonly AccessDevice[];
```

Every modeled device in the current state, as live handles.

##### Returns

readonly [`AccessDevice`](../interfaces/AccessDevice.md)[]

***

### doorStates

#### Get Signature

```ts
get doorStates(): ReadonlyMap<string, AccessDoorStateEntryInterface>;
```

The live state of every door, keyed by door identity: seeded at connect from what each mode's read establishes, corrected live by the stream. An entry is
absent only where neither source had anything to say about that door.

##### Returns

`ReadonlyMap`\<`string`, [`AccessDoorStateEntryInterface`](../interfaces/AccessDoorStateEntryInterface.md)\>

***

### hubs

#### Get Signature

```ts
get hubs(): readonly AccessHub[];
```

Every hub in the current state, as live handles.

##### Returns

readonly [`AccessHub`](../interfaces/AccessHub.md)[]

***

### isAdmin

#### Get Signature

```ts
get isAdmin(): Nullable<boolean>;
```

Whether the authenticated account holds administrative privilege, or `null` when that has never been established. This is the session's own verdict rather
than anything derived from state: privilege belongs to the credentials, not to the controller's configuration.

##### Returns

`Nullable`\<`boolean`\>

***

### official

#### Get Signature

```ts
get official(): Nullable<OfficialApi>;
```

The official UniFi Access API, or `null` when this client has no working official path.

Nullability follows the capability map rather than bare token presence, so the two agree by construction: a client that supplied a token to a controller that
has no official API - an Identity Enterprise deployment - reads `null` here and `false` at `capabilities.official`, from the one verdict derived at connect.

##### Returns

`Nullable`\<[`OfficialApi`](../interfaces/OfficialApi.md)\>

***

### state

#### Get Signature

```ts
get state(): StateStore;
```

The data layer: a synchronous snapshot and a live observation over the reduced controller state.

##### Returns

[`StateStore`](../interfaces/StateStore.md)

***

### transport

#### Get Signature

```ts
get transport(): Nullable<Transport>;
```

The HTTP transport for the Access application's own endpoints - the documented escape hatch for calls the typed surface does not cover - or `null` on a client
with no credentials, which never reaches those endpoints at all. The escape hatch belongs to the credential surface; the official API's own untyped endpoints
are reachable through [AccessClient.official](#official)'s request hatches.

##### Returns

`Nullable`\<`Transport`\>

## Methods

### \[asyncDispose\]()

```ts
asyncDispose: Promise<void>;
```

Dispose the client: tear down the connection monitor, stopping recovery and closing the realtime channel; stop the refresh failsafe and end every observation;
end the session; and destroy every connection pool this client built - in that order, so what feeds the state and the transports stops before they do. A client
holding both identities destroys both pools; one holding either destroys the one it built. Safe to call more than once, and the canonical teardown through
`await using client = await AccessClient.connect(...)`.

#### Returns

`Promise`\<`void`\>

#### Implementation of

```ts
AsyncDisposable.[asyncDispose]
```

***

### accessPoint()

```ts
accessPoint(id): AccessHub | undefined;
```

Look up one door-serving port of an Enterprise Access Hub by the port's own identity, or `undefined` when no such port exists.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `id` | `string` | The port's `unique_id`. |

#### Returns

[`AccessHub`](../interfaces/AccessHub.md) \| `undefined`

A live hub handle over that port, or `undefined`.

***

### device()

```ts
device(id): AccessDevice | undefined;
```

Look up a device by identity, or `undefined` when the current state holds no such device.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `id` | `string` | The device's `unique_id`. |

#### Returns

[`AccessDevice`](../interfaces/AccessDevice.md) \| `undefined`

A live device handle, or `undefined`.

***

### events()

```ts
events(opts?): AsyncGenerator<AccessWireEvent>;
```

The realtime firehose: every typed event the controller produces, until the signal aborts or the client is disposed. Each event has already been folded into
the state model by the time it arrives here, so reading `client.state` inside the loop observes the post-event state.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `opts` | \{ `signal?`: `AbortSignal`; \} | Optional abort signal that terminates the iteration. |
| `opts.signal?` | `AbortSignal` | - |

#### Returns

`AsyncGenerator`\<[`AccessWireEvent`](../type-aliases/AccessWireEvent.md)\>

An async iterable of typed events.

***

### fetchBootstrap()

```ts
fetchBootstrap(opts?): Promise<unknown>;
```

Fetch the controller's topology document on demand and return the parsed JSON untouched.

The library does not retain the raw document - it is consumed once as a synthetic event and only the reduced state survives - so this is a fresh request whose
result is returned verbatim and deliberately not folded into state. It is a faithful dump for diagnostics rather than a cached copy; the reduced, observable
model remains `client.state`. The return type is deliberately unknown: this is whatever the controller sent, not the curated model.

The topology document is credential surface: it is served by the Access application's own endpoints and has no equivalent on the published API, so a
token-only client cannot produce it and says so rather than answering something thinner and calling it the same thing.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `opts` | \{ `signal?`: `AbortSignal`; \} | Optional abort signal. |
| `opts.signal?` | `AbortSignal` | - |

#### Returns

`Promise`\<`unknown`\>

#### Throws

[AccessCapabilityError](AccessCapabilityError.md) on a client with no credentials, [AccessBootstrapError](AccessBootstrapError.md) when the document cannot be fetched or parsed, or a
  transport-level `AccessError`.

***

### hub()

```ts
hub(id): AccessHub | undefined;
```

Look up a hub by identity, or `undefined` when the current state holds no hub-capable device under it. A building-hosted Enterprise Access Hub answers
`undefined` here; reach its doors through [AccessClient.accessPoint](#accesspoint).

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `id` | `string` | The device's `unique_id`. |

#### Returns

[`AccessHub`](../interfaces/AccessHub.md) \| `undefined`

A live hub handle, or `undefined`.

***

### on()

```ts
on<K>(event, handler): Disposable;
```

Subscribe to a client event. Returns a `Disposable`; prefer `using sub = client.on(...)` so the listener detaches at scope exit.

#### Type Parameters

| Type Parameter |
| ------ |
| `K` *extends* keyof [`AccessClientEvents`](../interfaces/AccessClientEvents.md) |

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `event` | `K` | The event to listen for. |
| `handler` | (...`args`) => `void` | Invoked on each emission. |

#### Returns

`Disposable`

A `Disposable` that removes the listener when disposed.

***

### once()

```ts
once<K>(event, opts?): Promise<AccessClientEvents[K]>;
```

Wait for the next emission of a client event.

#### Type Parameters

| Type Parameter |
| ------ |
| `K` *extends* keyof [`AccessClientEvents`](../interfaces/AccessClientEvents.md) |

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `event` | `K` | The event to await. |
| `opts` | \{ `signal?`: `AbortSignal`; \} | Optional abort signal. |
| `opts.signal?` | `AbortSignal` | - |

#### Returns

`Promise`\<[`AccessClientEvents`](../interfaces/AccessClientEvents.md)\[`K`\]\>

A promise resolving to the event's argument tuple.

***

### rawPackets()

```ts
rawPackets(opts?): AsyncGenerator<AccessEventPacketInterface>;
```

The raw firehose: every well-formed frame the controller sent, before classification, so it carries the notifications the library does not model and the
payload fields the translation drops. Pure observability - a raw frame is never folded into state, so reading `client.state` inside this loop carries no
ordering guarantee relative to the frame.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `opts` | \{ `signal?`: `AbortSignal`; \} | Optional abort signal that terminates the iteration. |
| `opts.signal?` | `AbortSignal` | - |

#### Returns

`AsyncGenerator`\<[`AccessEventPacketInterface`](../interfaces/AccessEventPacketInterface.md)\>

An async iterable of raw notification packets.

***

### stream()

```ts
stream<K>(event, opts?): AsyncIterable<AccessClientEvents[K]>;
```

Stream every subsequent emission of a client event until the signal aborts.

#### Type Parameters

| Type Parameter |
| ------ |
| `K` *extends* keyof [`AccessClientEvents`](../interfaces/AccessClientEvents.md) |

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `event` | `K` | The event to stream. |
| `opts` | [`StreamOptions`](../interfaces/StreamOptions.md) | Stream options, including the abort signal. |

#### Returns

`AsyncIterable`\<[`AccessClientEvents`](../interfaces/AccessClientEvents.md)\[`K`\]\>

An async iterable of the event's argument tuples.

***

### classifyPacket()

```ts
static classifyPacket(packet): Nullable<AccessWireEvent>;
```

Classify a notification packet into a typed event, or `null` when the packet is well-formed but describes something the library does not model. Static, pure,
and connection-independent: it is the offline counterpart of the [AccessClient.events](#events) rail, which is this same classification applied to the live
socket, so captured frames can be run through exactly the path the realtime channel uses.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `packet` | [`AccessEventPacketInterface`](../interfaces/AccessEventPacketInterface.md) | A notification packet as the controller sent it. |

#### Returns

`Nullable`\<[`AccessWireEvent`](../type-aliases/AccessWireEvent.md)\>

The classified event, or `null` for a valid-but-unmodeled packet.

***

### connect()

```ts
static connect(opts): Promise<AccessClient>;
```

Connect to an Access controller. Authenticates, fetches what the supplied identities can reach, seeds the state model, brings the realtime channel up, and
determines the account's privilege - all as one operation.

**Credentials, a token, or both.** Credentials reach the Access application's own endpoints and are what the topology document and the privilege verdict come
from. A token reaches the published API and is what `official`, the routed commands' preferred path, and a credential-less client's own inventory come from.
Supplying both gives a client everything: state seeded from the topology and corrected by the official read, with each routed command taking whichever path
serves it.

**A token-only client is a first-class client with a smaller surface, not a degraded one.** What a token reaches on the wire is exactly what it exposes. Its
device and door inventory is seeded from the official API's own listings, so `devices`, `hubs`, `device()`, and `hub()` answer with records carrying what those
listings establish and nothing they do not. `accessPoints` reads empty and an Enterprise Access Hub is withheld from the hub views, because the per-port expansion
and the hub's own placement are read from topology the listing does not carry. A hub's door commands take the official path, `close()` among them as the gate
control command, while `restart()`, `updateDevice()`, and `fetchBootstrap` refuse with a capability error. A token refused the device listing connects with an
empty inventory and says so once in the log. `isAdmin`, `controllerName`, and `controllerInfo` read `null`, because a token has no account whose privilege could
be determined and the controller document is not something the published API serves. Restart detection is inert for that same reason - it watches the controller
document's uptime, and there is none - while recovery from a dropped notification channel runs exactly as it does in any other mode. Door state and the inventory
are seeded from the official reads, corrected live by the official notification socket, and re-read by the refresh failsafe and on recovery.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `opts` | [`ConnectOptions`](../type-aliases/ConnectOptions.md) | The controller address, at least one identity, and the optional injected dependencies. |

#### Returns

`Promise`\<`AccessClient`\>

A ready client.

#### Throws

when the options ask for a path the supplied identities cannot take - a token-only client held to the direct API, or a credential-only client
  held to the official one. Caller misuse, raised before anything is sent.

#### Throws

[AccessAuthError](AccessAuthError.md) when an identity is refused, its `identity` field naming whether the credentials or the API token were the rejected one,
  [AccessNetworkError](AccessNetworkError.md) when the controller cannot be reached, [AccessBootstrapError](AccessBootstrapError.md) when its configuration cannot be fetched or parsed, or any
  other typed `FatalError` those stages surface. No partial client escapes a failure.

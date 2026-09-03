[**unifi-access**](../README.md)

***

[Home](../README.md) / ConnectionMonitor

# Interface: ConnectionMonitor

The connection coordinator. Constructed by the client; consumers read it as `client.connection`.

## Accessors

### isHealthy

#### Get Signature

```ts
get isHealthy(): boolean;
```

Whether the connection is in steady operation.

##### Returns

`boolean`

***

### isThrottled

#### Get Signature

```ts
get isThrottled(): boolean;
```

Whether the transport's breaker is open. Delegated verbatim to the transport, which is the single source of truth for reachability backoff.

##### Returns

`boolean`

***

### opened

#### Get Signature

```ts
get opened(): Promise<void>;
```

The initial open handshake. `connect()` drives it through [ConnectionMonitor.open](#open) and tears the client down if it fails, and a disposal that lands
before the channel ever opened settles this as a cancellation rather than leaving a reader parked on it.

##### Returns

`Promise`\<`void`\>

***

### state

#### Get Signature

```ts
get state(): ConnectionState;
```

The current connection state, derived live from the recovery phase and the transport's throttle verdict, so it can never drift from a separately stored value.

##### Returns

[`ConnectionState`](../type-aliases/ConnectionState.md)

## Methods

### \[asyncDispose\]()

```ts
asyncDispose: Promise<void>;
```

Dispose the monitor: end the uptime-observation loop and any recovery wait, release the initial handshake, detach the throttle subscriptions, and tear the
notification stream down. Safe to call more than once.

#### Returns

`Promise`\<`void`\>

***

### observe()

```ts
observe(opts?): AsyncGenerator<ConnectionTransition>;
```

Observe the state machine: every transition until the signal aborts. Sugar over the `stateChanged` rail that unwraps the single-element tuple and ends quietly
on the caller's own abort.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `opts` | \{ `signal?`: `AbortSignal`; \} | Optional abort signal that terminates the iteration. |
| `opts.signal?` | `AbortSignal` | - |

#### Returns

`AsyncGenerator`\<[`ConnectionTransition`](ConnectionTransition.md)\>

An async iterable of state transitions.

***

### on()

```ts
on<K>(event, handler): Disposable;
```

Subscribe to a connection event. Returns a `Disposable`; prefer `using sub = connection.on(...)` so the listener detaches at scope exit.

#### Type Parameters

| Type Parameter |
| ------ |
| `K` *extends* keyof [`ConnectionEvents`](ConnectionEvents.md) |

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
once<K>(event, opts?): Promise<ConnectionEvents[K]>;
```

Wait for the next emission of a connection event.

#### Type Parameters

| Type Parameter |
| ------ |
| `K` *extends* keyof [`ConnectionEvents`](ConnectionEvents.md) |

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `event` | `K` | The event to await. |
| `opts` | \{ `signal?`: `AbortSignal`; \} | Optional abort signal. |
| `opts.signal?` | `AbortSignal` | - |

#### Returns

`Promise`\<[`ConnectionEvents`](ConnectionEvents.md)\[`K`\]\>

A promise resolving to the event's argument tuple.

***

### open()

```ts
open(): Promise<void>;
```

Open the realtime notification channel. This is the composition root's call, made once inside the guard that owns teardown: everything the socket allocates is
built here rather than while the monitor is being assembled, so a failure always has an owner that can dispose it. Either outcome settles
[ConnectionMonitor.opened](#opened).

#### Returns

`Promise`\<`void`\>

#### Throws

[AccessAbortedError](../classes/AccessAbortedError.md) if the connect signal cancels the handshake, or a transport-level `AccessError` when the socket cannot be opened.

***

### stream()

```ts
stream<K>(event, opts?): AsyncIterable<ConnectionEvents[K]>;
```

Stream every subsequent emission of a connection event until the signal aborts.

#### Type Parameters

| Type Parameter |
| ------ |
| `K` *extends* keyof [`ConnectionEvents`](ConnectionEvents.md) |

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `event` | `K` | The event to stream. |
| `opts` | [`StreamOptions`](StreamOptions.md) | Stream options, including the abort signal. |

#### Returns

`AsyncIterable`\<[`ConnectionEvents`](ConnectionEvents.md)\[`K`\]\>

An async iterable of the event's argument tuples.

***

### verify()

```ts
verify(opts?): Promise<void>;
```

Probe the controller's reachability on demand. Resolves when it answers and throws the classified error otherwise - the same probe the recovery loop uses,
exposed so a consumer can ask the question itself.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `opts` | \{ `signal?`: `AbortSignal`; \} | Optional abort signal. |
| `opts.signal?` | `AbortSignal` | - |

#### Returns

`Promise`\<`void`\>

#### Throws

The classified `FatalError` on a non-2xx, or a transport-level `AccessError` when the controller cannot be reached.

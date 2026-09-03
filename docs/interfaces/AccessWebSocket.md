[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessWebSocket

# Interface: AccessWebSocket

The minimal *receive-direction* WebSocket surface the realtime events stream consumes - deliberately a small subset of the WHATWG/undici `WebSocket`, so the
dependency is exactly what the stream needs and nothing more. undici's `WebSocket` satisfies this structurally, so the default factory assigns to it without a
cast.

It lives in its own module rather than inside the stream because it is the one definition everything that touches a socket must agree on: the stream that
consumes one, the test fake that implements one, and a consumer's own socket supplied through the client's `webSocket` connect option. Writing it once means
neither the fake nor a consumer's implementation can drift from what production actually calls.

## Properties

| Property | Type |
| ------ | ------ |
| <a id="binarytype"></a> `binaryType` | `"arraybuffer"` \| `"blob"` |

## Methods

### addEventListener()

#### Call Signature

```ts
addEventListener(
   type, 
   listener, 
   options?
): void;
```

##### Parameters

| Parameter | Type |
| ------ | ------ |
| `type` | `"open"` |
| `listener` | () => `void` |
| `options?` | [`AccessWebSocketListenerOptions`](AccessWebSocketListenerOptions.md) |

##### Returns

`void`

#### Call Signature

```ts
addEventListener(
   type, 
   listener, 
   options?
): void;
```

##### Parameters

| Parameter | Type |
| ------ | ------ |
| `type` | `"message"` |
| `listener` | (`event`) => `void` |
| `options?` | [`AccessWebSocketListenerOptions`](AccessWebSocketListenerOptions.md) |

##### Returns

`void`

#### Call Signature

```ts
addEventListener(
   type, 
   listener, 
   options?
): void;
```

##### Parameters

| Parameter | Type |
| ------ | ------ |
| `type` | `"close"` |
| `listener` | (`event`) => `void` |
| `options?` | [`AccessWebSocketListenerOptions`](AccessWebSocketListenerOptions.md) |

##### Returns

`void`

#### Call Signature

```ts
addEventListener(
   type, 
   listener, 
   options?
): void;
```

##### Parameters

| Parameter | Type |
| ------ | ------ |
| `type` | `"error"` |
| `listener` | (`event`) => `void` |
| `options?` | [`AccessWebSocketListenerOptions`](AccessWebSocketListenerOptions.md) |

##### Returns

`void`

***

### close()

```ts
close(): void;
```

#### Returns

`void`

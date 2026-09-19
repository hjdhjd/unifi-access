[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessDevice

# Interface: AccessDevice

A device on the controller, as a live projection with the write-through command surface every modeled device supports.

This class is concrete rather than abstract, which is a deliberate divergence from a hierarchy that fixes a category tag per leaf: Access models one device
shape, so the generic device is itself something a consumer can hold. The hub-specific commands live one level down, on `AccessHub`, because they address a door
rather than the device.

Commands are **write-through**: they tell the controller to do something and return, without folding the response into the store. State advances only through
the reducer's other inputs - the realtime notification stream and the refresh failsafe - and never through a command's own response, so the issuer learns of
its own change the way every other subscriber does. The consequence is that a projection reflects a command's effect once the stream (or the next refresh)
delivers it, not synchronously after the `await`, so a consumer observes rather than reads back.

## Extends

- `Projection`\<[`AccessStateDevice`](../type-aliases/AccessStateDevice.md)\>

## Extended by

- [`AccessHub`](AccessHub.md)

## Properties

| Property | Modifier | Type | Description |
| ------ | ------ | ------ | ------ |
| <a id="id"></a> `id` | `readonly` | `string` | The device's stable identity, the `unique_id` the controller assigned it. |

## Accessors

### config

#### Get Signature

```ts
get config(): Readonly<TConfig>;
```

The record's current configuration, read through to the live store snapshot.

##### Throws

If the record is no longer present in the controller state.

##### Returns

`Readonly`\<`TConfig`\>

The current configuration.

#### Inherited from

```ts
Projection.config
```

***

### isOnline

#### Get Signature

```ts
get isOnline(): boolean;
```

Whether the controller currently reports this device as online.

This reads the controller's own `is_online` and nothing else. The record carries neighboring flags - adopted, managed, connected - that describe how the
device is enrolled rather than whether it is reachable now, and a consumer wanting a stricter definition composes them itself off `config`. Folding them in
here would make this getter one consumer's policy rather than the controller's report.

##### Throws

If the device is no longer present in the controller state.

##### Returns

`boolean`

***

### isTamperCapable

#### Get Signature

```ts
get isTamperCapable(): boolean;
```

Whether this device's hardware can detect tampering, read through the state tier's own `isTamperCapable` predicate.

It is mirrored here where the role classification is not, because a hub's role produces a projection class a consumer can ask about directly and this one
produces none: there is no tamper-capable subclass to test, so the handle is where a consumer asks. Both censuses establish the capability, so this answers
whichever way the client connected.

##### Throws

If the device is no longer present in the controller state.

##### Returns

`boolean`

***

### name

#### Get Signature

```ts
get name(): string;
```

The device's display name, as [deviceDisplayName](../functions/deviceDisplayName.md) answers it: the alias an administrator gave it when there is one, and the controller's own name
for the hardware otherwise. The rule and its rationale live with that selector, so a consumer labelling a device from its record and a handle reading its
own name cannot drift apart.

##### Throws

If the device is no longer present in the controller state.

##### Returns

`string`

***

### tamperState

#### Get Signature

```ts
get tamperState(): boolean | undefined;
```

What this device reports about tampering, read through the state tier's own `tamperState` selector: `true` with the condition raised, `false` with it clear,
and `undefined` where nothing has established a reading - a record with no tamper row, one carrying no configuration rows at all as every token-only census
produces, a device whose tampering alert is switched off and so reports no tamper input, or a value outside the vocabulary the controller has been observed to
write. That selector's own documentation is the full statement of the contract.

##### Throws

If the device is no longer present in the controller state.

##### Returns

`boolean` \| `undefined`

***

### uplinkId

#### Get Signature

```ts
get uplinkId(): string | null;
```

The identifier of the distinct device this one reaches the controller through, or `null` for a device that connects in its own right.

This is the dependency an operator has to respect: hardware behind an Enterprise Access Hub takes both its uplink and its power from that hub, so it is
reachable only while the hub is. A caller sequencing commands across a fleet restarts what is attached before what carries it, and a caller displaying an
inventory can render the same relationship as a tree.

##### Throws

If the device is no longer present in the controller state.

##### Returns

`string` \| `null`

The carrying device's identifier, or `null` when there is none.

## Methods

### observe()

```ts
observe(opts?): AsyncGenerator<AccessDevice>;
```

Observe this projection. The returned async iterable yields `this` each time the record changes by reference, and stays silent on dispatches that did not touch
it. Pair it with the synchronous getters: those answer "what is it now", this answers "tell me when it changes".

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `opts` | \{ `signal?`: `AbortSignal`; \} | Optional abort signal that terminates the iteration. |
| `opts.signal?` | `AbortSignal` | - |

#### Returns

`AsyncGenerator`\<`AccessDevice`\>

An async iterable of this projection, yielding once per change.

#### Inherited from

```ts
Projection.observe
```

***

### peek()

```ts
peek(): 
  | Readonly<AccessStateDevice>
  | undefined;
```

The record's current configuration if it is present, or `undefined` if it is not - the non-throwing companion to `config`. Reach for this to
ask "is it still here, and if so what is it?": a record leaving the state is an ordinary runtime condition, so it is reported as `undefined` rather than as an
error. Reach for `config` where the record's presence is a precondition and its absence is a defect that should fail loudly.

Like every projection read this goes through to the current snapshot rather than to anything captured at construction. It is the single home of that raw read;
`config` is this read plus the absent-record guard.

#### Returns

  \| `Readonly`\<[`AccessStateDevice`](../type-aliases/AccessStateDevice.md)\>
  \| `undefined`

The current configuration, or `undefined` when the record is not in the controller state.

#### Inherited from

```ts
Projection.peek
```

***

### restart()

```ts
restart(opts?): Promise<void>;
```

Restart this device. Write-through: the controller drops and re-establishes the device, and the projection reflects the cycle as the realtime stream reports
it.

This endpoint answers in the same result envelope the door commands do, captured from a live restart on 2026-08-16, so its verdict is read the same way: a
non-2xx classifies and throws, and a 2xx whose envelope reports anything other than success throws rather than reading as an accepted restart.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `opts` | \{ `signal?`: `AbortSignal`; \} | Optional abort signal. |
| `opts.signal?` | `AbortSignal` | - |

#### Returns

`Promise`\<`void`\>

#### Throws

[AccessCapabilityError](../classes/AccessCapabilityError.md) when this client has no path that can carry the restart - one held to the official API, which cannot express it, or one
  holding only a token, whose credentials the Access application's own endpoints require. [AccessApiError](../classes/AccessApiError.md) when the controller accepts the request but
  reports the restart unsuccessful, the classified `FatalError` on a non-2xx, or a transport-level `AccessError` on failure.

***

### updateDevice()

```ts
updateDevice(payload, opts?): Promise<AccessDeviceConfigInterface>;
```

Apply a configuration change to this device. Write-through: it writes to the controller and returns the record the controller echoed back, without folding it
into the store - the change is reflected once the realtime stream or the next refresh delivers it. The echoed record is a convenience for a caller that wants
to see what the controller made of the write, not a second source of state.

There is no envelope to check here, which is what sets this apart from the door commands. The device-settings endpoint answers with the device record itself
rather than with the result envelope the rest of the surface wraps its answers in, so a domain-level verdict is not something this response carries: a non-2xx
classifies and throws, and a 2xx is the echoed record.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `payload` | [`AccessDeviceConfigPayload`](../type-aliases/AccessDeviceConfigPayload.md) | The configuration to apply. |
| `opts` | \{ `signal?`: `AbortSignal`; \} | Optional abort signal. |
| `opts.signal?` | `AbortSignal` | - |

#### Returns

`Promise`\<[`AccessDeviceConfigInterface`](AccessDeviceConfigInterface.md)\>

The device record as the controller echoed it.

#### Throws

[AccessCapabilityError](../classes/AccessCapabilityError.md) when this client has no path that can carry the write - one held to the official API, which cannot express it, or one
  holding only a token, whose credentials the Access application's own endpoints require. The classified `FatalError` on a non-2xx -
  [AccessAuthorizationError](../classes/AccessAuthorizationError.md) when the account lacks the privilege the write requires - or a transport-level `AccessError` on failure.

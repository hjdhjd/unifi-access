[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessHub

# Interface: AccessHub

A hub-capable device, as a live projection carrying the commands that act on the door it drives.

The distinction from [AccessDevice](AccessDevice.md) is what the commands address. A device command targets the hardware; a hub's unlock and close target the *door*, which
is a separate resource on the controller. That is what lets one multi-port hub drive several doors independently: each port is bound to its own door, and the
registry mints a handle per port whose commands resolve to that port's door.

Every command here is write-through, like every other command in the tier: the controller acts, and the projection reflects it once the realtime stream reports
the change.

## Extends

- [`AccessDevice`](AccessDevice.md)

## Properties

| Property | Modifier | Type | Description | Inherited from |
| ------ | ------ | ------ | ------ | ------ |
| <a id="id"></a> `id` | `readonly` | `string` | The device's stable identity, the `unique_id` the controller assigned it. | [`AccessDevice`](AccessDevice.md).[`id`](AccessDevice.md#id) |

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

[`AccessDevice`](AccessDevice.md).[`config`](AccessDevice.md#config)

***

### door

#### Get Signature

```ts
get door(): AccessStateDoor | undefined;
```

The door record this hub drives, as the census of the controller's doors carried it - its names above all, which is what a consumer naming this door in its own
output reads rather than reaching around the projection into the state snapshot for it. Reading it through the hub keeps a consumer from re-deriving which
door this hardware acts on, exactly as [AccessHub.doorState](#doorstate) does, and both getters resolve that door the same way - through [AccessHub.doorId](#doorid),
which on hardware driving several doors answers with the first port binding its record carries.

It is `undefined` where the state holds no record for the door, which is what a census that never carried the door looks like from here.

##### Throws

If the device is no longer present in the controller state.

##### Returns

[`AccessStateDoor`](../type-aliases/AccessStateDoor.md) \| `undefined`

***

### doorId

#### Get Signature

```ts
get doorId(): string;
```

The door this handle acts on - the identity its commands address and its [AccessHub.doorState](#doorstate) reads: the door bound to the hub's port when the record
carries that binding, and the device's own location otherwise.

The two arms are the same rule seen from two directions. A whole multi-port hub records each port's door in its extensions, so the binding is where the door
identity lives. A synthesized per-port handle already *is* one port: the registry gives it that port's own location and no extensions at all, so the fallback
resolves it to its own door by construction rather than by a special case. Single-door hardware takes the same fallback for the same reason - its location is
its door. Publishing the resolution keeps it single-sourced: a consumer matching a topology door to the handle that drives it reads this rather than restating
the port-extension rule.

Where a record carries several port bindings, the first of them as the controller delivered them is what this answers with. That ordering is the controller's
own and nothing here promises it will hold, so commanding a particular door of hardware that drives more than one is what the door commands' `doorId` target
is for.

##### Throws

If the device is no longer present in the controller state.

##### Returns

`string`

***

### doorState

#### Get Signature

```ts
get doorState(): 
  | AccessDoorStateEntryInterface
  | undefined;
```

The door's live state: what it last reported, or what its serving hardware was read to establish before it had reported anything.

A door reached this way is `undefined` only when neither source had anything to say about it. The members are individually optional for the same reason, so a
reading established from hardware flags states what those flags proved and stays silent on the rest. Reading it through the hub is what keeps a consumer from
having to re-derive which door this hardware drives, which is a resolution the hub already owns.

##### Throws

If the device is no longer present in the controller state.

##### Returns

  \| [`AccessDoorStateEntryInterface`](AccessDoorStateEntryInterface.md)
  \| `undefined`

***

### isOnline

#### Get Signature

```ts
get isOnline(): boolean;
```

Whether the controller currently reports this device as online.

This reads the controller's own `is_online` and nothing else. The record carries neighbouring flags - adopted, managed, connected - that describe how the
device is enrolled rather than whether it is reachable now, and a consumer wanting a stricter definition composes them itself off `config`. Folding them in
here would make this getter one consumer's policy rather than the controller's report.

##### Throws

If the device is no longer present in the controller state.

##### Returns

`boolean`

#### Inherited from

[`AccessDevice`](AccessDevice.md).[`isOnline`](AccessDevice.md#isonline)

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

#### Inherited from

[`AccessDevice`](AccessDevice.md).[`isTamperCapable`](AccessDevice.md#istampercapable)

***

### name

#### Get Signature

```ts
get name(): string;
```

The device's display name: the alias an administrator gave it when there is one, and the controller's own name for the hardware otherwise. The precedence is
the controller interface's own - an alias is what a person chose to call this device, so it wins wherever one is set - and an alias set to the empty string
counts as unset, which is how clearing an alias in the interface reads on the wire.

##### Throws

If the device is no longer present in the controller state.

##### Returns

`string`

#### Inherited from

[`AccessDevice`](AccessDevice.md).[`name`](AccessDevice.md#name)

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

#### Inherited from

[`AccessDevice`](AccessDevice.md).[`tamperState`](AccessDevice.md#tamperstate)

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

#### Inherited from

[`AccessDevice`](AccessDevice.md).[`uplinkId`](AccessDevice.md#uplinkid)

## Methods

### close()

```ts
close(opts?): Promise<void>;
```

Close the door this hub drives, ending an unlock that is holding it open. This is the other half of the two-button surface a gate or a door with a held-open
unlock presents: `unlock` begins, this ends.

The request deliberately carries no body at all, which is the field-proven shape for this command - the controller reads the command from the query parameter, and a
body is what distinguishes an unlock from a close on the same resource. The wire shape is proven from hardware rather than from a capture, so no recorded specimen
confirms it.

**Which API carries this depends on the client.** Every client holding a direct path takes the hardware-proven command above. A client with none - one holding only
a token, or one held to the official API - reaches the published API's gate control command instead, which the reference documents for UA Hub Gate hardware in
three-button mode on UniFi Access 4.2.16 or later and no capture confirms on other door families.

**Close belongs to gate hardware.** A door hub refuses the command on both APIs - field-verified against live hardware - which fits the functional split:
a gate has a close motion to command, and a door's lock does not. Ending a held-open unlock on a door hub is [AccessHub.setLockRule](#setlockrule) with the
`reset` rule, which restores the door's own schedule.

The door closed is this handle's own unless `doorId` names another, which is how the second door of a gate driving two is reached. Both paths take the target
as given - the direct command's own door resource and the official control command's door argument alike - because which doors exist is the controller's to
say rather than this library's.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `opts` | \{ `doorId?`: `string`; `signal?`: `AbortSignal`; \} | Which door to close, and an optional abort signal. |
| `opts.doorId?` | `string` | - |
| `opts.signal?` | `AbortSignal` | - |

#### Returns

`Promise`\<`void`\>

#### Throws

[AccessCapabilityError](../classes/AccessCapabilityError.md) when the client holds no direct path and its official rail is absent, revoked, or refused for this device,
  [AccessRequestError](../classes/AccessRequestError.md) when the controller accepts the request but reports the close unsuccessful, the classified `FatalError` on a non-2xx, or a
  transport-level `AccessError` on failure.

***

### observe()

```ts
observe(opts?): AsyncGenerator<AccessHub>;
```

Observe this projection. The returned async iterable yields `this` each time the record changes by reference, and stays silent on dispatches that did not touch
it. Pair it with the synchronous getters: those answer "what is it now", this answers "tell me when it changes".

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `opts` | \{ `signal?`: `AbortSignal`; \} | Optional abort signal that terminates the iteration. |
| `opts.signal?` | `AbortSignal` | - |

#### Returns

`AsyncGenerator`\<`AccessHub`\>

An async iterable of this projection, yielding once per change.

#### Inherited from

[`AccessDevice`](AccessDevice.md).[`observe`](AccessDevice.md#observe)

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

[`AccessDevice`](AccessDevice.md).[`peek`](AccessDevice.md#peek)

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
  holding only a token, whose credentials the Access application's own endpoints require. [AccessRequestError](../classes/AccessRequestError.md) when the controller accepts the request but
  reports the restart unsuccessful, the classified `FatalError` on a non-2xx, or a transport-level `AccessError` on failure.

#### Inherited from

[`AccessDevice`](AccessDevice.md).[`restart`](AccessDevice.md#restart)

***

### setLockRule()

```ts
setLockRule(rule, opts?): Promise<void>;
```

Set the rule governing this hub's lock.

**Which API carries this depends on the rule.** The official path serves every verb where one is available; the direct path serves the three the Access
application's own endpoint can express - `reset`, `keep_unlock`, and `custom`. The other three are official-only, so a client with no working official path
refuses them rather than approximating.

**A rule can name the door it governs.** `doorId` defaults to this handle's own door, and a rule targeting any other door takes the official path alone: the Access
application's own rule resource is keyed by the device rather than by the door, so it can only ever govern the door that device resolves for itself. A client with
no working official path refuses such a rule rather than writing it to a door the caller did not ask for. A target that resolves to this handle's own door is the
same write the default is, and takes the direct path exactly as the default does.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `rule` | [`AccessOfficialLockRuleSet`](../type-aliases/AccessOfficialLockRuleSet.md) | The rule to establish. A `custom` rule's interval is a positive whole number of minutes. |
| `opts` | \{ `doorId?`: `string`; `signal?`: `AbortSignal`; \} | Which door the rule governs, and an optional abort signal. |
| `opts.doorId?` | `string` | - |
| `opts.signal?` | `AbortSignal` | - |

#### Returns

`Promise`\<`void`\>

#### Throws

If a custom rule's interval is not a positive whole number - caller misuse, raised before anything is sent.

#### Throws

[AccessCapabilityError](../classes/AccessCapabilityError.md) when no available path can carry the rule, [AccessRequestError](../classes/AccessRequestError.md) when the controller accepts the request but reports
  the rule unsuccessful, the classified `FatalError` on a non-2xx, or a transport-level `AccessError` on failure.

***

### stop()

```ts
stop(opts?): Promise<void>;
```

Halt this hub's gate mid-transition, leaving it where it stands rather than completing the travel it is running.

The reference documents this command for UA Hub Gate hardware in three-button mode on UniFi Access 4.2.16 or later, and no capture confirms it, so what other
hardware makes of it is what field reports will establish. It is official-only: the Access application's own resource has no proven stop spelling, and this library
does not invent direct-API behavior, so a client with no working official path refuses rather than approximating.

Which gate is halted is this handle's own door unless `doorId` picks out another of the doors the hardware drives.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `opts` | \{ `doorId?`: `string`; `signal?`: `AbortSignal`; \} | Which door to halt, and an optional abort signal. |
| `opts.doorId?` | `string` | - |
| `opts.signal?` | `AbortSignal` | - |

#### Returns

`Promise`\<`void`\>

#### Throws

[AccessCapabilityError](../classes/AccessCapabilityError.md) when no available path can carry the stop, [AccessOfficialApiError](../classes/AccessOfficialApiError.md) when the controller refuses it in its own
  vocabulary, the classified `FatalError` on a non-2xx, or a transport-level `AccessError` on failure.

***

### unlock()

```ts
unlock(opts?): Promise<void>;
```

Unlock the door this hub drives.

**Which API carries this depends on the client and on what is asked.** A plain unlock takes the official path where one is available and the direct path otherwise,
which is the routing default; on a client holding both identities that means the controller attributes the unlock to the token's own identity rather than to the
credential account. Set `api` at connect to hold it to one channel.

Supplying `actor` is what makes an automation legible in the controller's logs and webhook deliveries as the automation rather than as whatever it
authenticated with, and `entryMethod` is which of a double-driveway gate's two approaches the unlock is for. Only the official API can express either one, so
an unlock carrying one has no direct-path fallback and a client without a working official path refuses it rather than quietly dropping what it cannot say.

On a token-only client this projection exists over the official inventory, and this unlock takes the official path - the only path such a client holds. So does its
`close`, which reaches that path as the gate control command.

`doorId` is which door to unlock where the hardware drives more than one, and it defaults to the door this handle resolves for itself. Both paths address the
door rather than the hardware, so the target holds whichever one carries the unlock, and the id travels as given: the controller is the authority on what a
door id names, and nothing here checks it against the state first.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `opts` | \{ `actor?`: [`AccessOfficialDoorUnlockActor`](AccessOfficialDoorUnlockActor.md); `doorId?`: `string`; `entryMethod?`: [`AccessOfficialDoorEntryMethod`](../type-aliases/AccessOfficialDoorEntryMethod.md); `signal?`: `AbortSignal`; \} | Who to attribute the unlock to, which door to unlock, which approach of a driveway gate it is for, and an optional abort signal. |
| `opts.actor?` | [`AccessOfficialDoorUnlockActor`](AccessOfficialDoorUnlockActor.md) | - |
| `opts.doorId?` | `string` | - |
| `opts.entryMethod?` | [`AccessOfficialDoorEntryMethod`](../type-aliases/AccessOfficialDoorEntryMethod.md) | - |
| `opts.signal?` | `AbortSignal` | - |

#### Returns

`Promise`\<`void`\>

#### Throws

[AccessCapabilityError](../classes/AccessCapabilityError.md) when no available path can carry the unlock as asked, [AccessRequestError](../classes/AccessRequestError.md) when the controller accepts the request
  but reports the unlock unsuccessful, the classified `FatalError` on a non-2xx, or a transport-level `AccessError` on failure.

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

#### Inherited from

[`AccessDevice`](AccessDevice.md).[`updateDevice`](AccessDevice.md#updatedevice)

[**unifi-access**](../README.md)

***

[Home](../README.md) / OfficialSpaces

# Interface: OfficialSpaces

The official API's spaces domain: the door topology, the door groups composed from it, and the unlock, lock-rule, and emergency controls on the doors.

## Methods

### createDoorGroup()

```ts
createDoorGroup(opts, call?): Promise<AccessOfficialDoorGroup>;
```

Create a door group. `POST /door_groups`, permission `edit:space`.

Live-verified.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `opts` | [`AccessOfficialDoorGroupCreate`](AccessOfficialDoorGroupCreate.md) | The group to create. |
| `call` | [`AccessOfficialCallOptions`](AccessOfficialCallOptions.md) | The per-call options - an optional abort signal. |

#### Returns

`Promise`\<[`AccessOfficialDoorGroup`](AccessOfficialDoorGroup.md)\>

The created group.

***

### deleteDoorGroup()

```ts
deleteDoorGroup(id, call?): Promise<void>;
```

Delete a door group. `DELETE /door_groups/:id`, permission `edit:space`.

Live-verified.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `id` | `string` | The group's identifier. |
| `call` | [`AccessOfficialCallOptions`](AccessOfficialCallOptions.md) | The per-call options - an optional abort signal. |

#### Returns

`Promise`\<`void`\>

***

### fetch()

```ts
fetch(id, call?): Promise<AccessOfficialDoor>;
```

Fetch one door. `GET /doors/:id`, permission `view:space`.

Live-verified.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `id` | `string` | The door's identifier. |
| `call` | [`AccessOfficialCallOptions`](AccessOfficialCallOptions.md) | The per-call options - an optional abort signal. |

#### Returns

`Promise`\<[`AccessOfficialDoor`](AccessOfficialDoor.md)\>

The door.

***

### fetchAll()

```ts
fetchAll(call?): Promise<AccessOfficialDoor[]>;
```

Fetch every door. `GET /doors`, permission `view:space`.

Live-verified.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `call` | [`AccessOfficialCallOptions`](AccessOfficialCallOptions.md) | The per-call options - an optional abort signal. |

#### Returns

`Promise`\<[`AccessOfficialDoor`](AccessOfficialDoor.md)[]\>

Every door on the controller.

***

### fetchAllDoorGroups()

```ts
fetchAllDoorGroups(call?): Promise<AccessOfficialDoorGroup[]>;
```

Fetch every door group. `GET /door_groups`, permission `view:space`.

The controller's own all-doors `building` group never appears here - the documentation says so and the wire agrees. Read it from the topology instead.

Live-verified.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `call` | [`AccessOfficialCallOptions`](AccessOfficialCallOptions.md) | The per-call options - an optional abort signal. |

#### Returns

`Promise`\<[`AccessOfficialDoorGroup`](AccessOfficialDoorGroup.md)[]\>

Every created door group.

***

### fetchDoorGroup()

```ts
fetchDoorGroup(id, call?): Promise<AccessOfficialDoorGroup>;
```

Fetch one door group. `GET /door_groups/:id`, permission `view:space`.

Live-verified.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `id` | `string` | The group's identifier. |
| `call` | [`AccessOfficialCallOptions`](AccessOfficialCallOptions.md) | The per-call options - an optional abort signal. |

#### Returns

`Promise`\<[`AccessOfficialDoorGroup`](AccessOfficialDoorGroup.md)\>

The group, with each door named.

***

### fetchEmergency()

```ts
fetchEmergency(call?): Promise<AccessOfficialEmergencyStatus>;
```

Read which site-wide emergency modes are in force. `GET /doors/settings/emergency`, permission `view:space`. Requires UniFi Access 1.24.6 or later.

Live-verified.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `call` | [`AccessOfficialCallOptions`](AccessOfficialCallOptions.md) | The per-call options - an optional abort signal. |

#### Returns

`Promise`\<[`AccessOfficialEmergencyStatus`](AccessOfficialEmergencyStatus.md)\>

The emergency flags.

***

### fetchLockRule()

```ts
fetchLockRule(id, call?): Promise<AccessOfficialLockRule>;
```

Read the temporary locking rule in force on a door. `GET /doors/:id/lock_rule`, permission `view:space`. Requires UniFi Access 1.24.6 or later.

Live-verified.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `id` | `string` | The door's identifier. |
| `call` | [`AccessOfficialCallOptions`](AccessOfficialCallOptions.md) | The per-call options - an optional abort signal. |

#### Returns

`Promise`\<[`AccessOfficialLockRule`](AccessOfficialLockRule.md)\>

The rule, or the idle state's empty `type` with a zero `ended_time`.

***

### fetchTopology()

```ts
fetchTopology(call?): Promise<AccessOfficialDoorGroupTopology[]>;
```

Fetch the whole door topology - every group, the floors beneath it, and the doors on each. `GET /door_groups/topology`, permission `view:space`.

Live-verified.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `call` | [`AccessOfficialCallOptions`](AccessOfficialCallOptions.md) | The per-call options - an optional abort signal. |

#### Returns

`Promise`\<[`AccessOfficialDoorGroupTopology`](AccessOfficialDoorGroupTopology.md)[]\>

The topology.

***

### setEmergency()

```ts
setEmergency(state, call?): Promise<void>;
```

Put a site-wide emergency mode in force. `PUT /doors/settings/emergency`, permission `edit:space`. Requires UniFi Access 1.24.6 or later.

This applies to every door at once, not to one. The three states map onto the wire's two flags, and both flags are always sent: sending only the one that
changed would leave the other's prior value ambiguous, and taking one state rather than two flags makes the contradictory both-in-force request impossible to
compose.

Documentation-derived.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `state` | [`AccessOfficialEmergencyState`](../type-aliases/AccessOfficialEmergencyState.md) | The mode to put in force; `normal` clears both. |
| `call` | [`AccessOfficialCallOptions`](AccessOfficialCallOptions.md) | The per-call options - an optional abort signal. |

#### Returns

`Promise`\<`void`\>

***

### setLockRule()

```ts
setLockRule(
   id, 
   rule, 
   call?
): Promise<void>;
```

Put a temporary locking rule on a door. `PUT /doors/:id/lock_rule`, permission `edit:space`. Requires UniFi Access 1.24.6 or later.

A `custom` rule's `interval` is in MINUTES, which is the unit both the wire and the reference speak - a value of 2 holds the relay for two minutes. `reset`
restores an unlock schedule to its original state, `lock_early` locks before a scheduled unlock window ends, and `lock_now` ends the schedule and any
temporary unlock together.

Documentation-derived.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `id` | `string` | The door's identifier. |
| `rule` | [`AccessOfficialLockRuleSet`](../type-aliases/AccessOfficialLockRuleSet.md) | The rule to put in force. |
| `call` | [`AccessOfficialCallOptions`](AccessOfficialCallOptions.md) | The per-call options - an optional abort signal. |

#### Returns

`Promise`\<`void`\>

***

### unlock()

```ts
unlock(
   id, 
   opts?, 
   call?
): Promise<void>;
```

Unlock a door. `PUT /doors/:id/unlock`, permission `edit:space`.

This request is never retried. It fires a relay once rather than asserting a state, so a transparent re-send after a transient status could re-open a door
somebody had already closed behind them - and the caller seeing the transient error is the safer outcome.

Live-verified.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `id` | `string` | The door's identifier. |
| `opts` | [`AccessOfficialDoorUnlockOptions`](AccessOfficialDoorUnlockOptions.md) | Who to attribute the unlock to, what to echo onto the webhook delivery, and the gate-specific controls. |
| `call` | [`AccessOfficialCallOptions`](AccessOfficialCallOptions.md) | The per-call options - an optional abort signal. |

#### Returns

`Promise`\<`void`\>

***

### updateDoorGroup()

```ts
updateDoorGroup(
   id, 
   opts, 
   call?
): Promise<AccessOfficialDoorGroup>;
```

Update a door group. `PUT /door_groups/:id`, permission `edit:space`.

Documentation-derived.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `id` | `string` | The group's identifier. |
| `opts` | [`AccessOfficialDoorGroupUpdate`](AccessOfficialDoorGroupUpdate.md) | The members to change. An empty `resources` array empties the group. |
| `call` | [`AccessOfficialCallOptions`](AccessOfficialCallOptions.md) | The per-call options - an optional abort signal. |

#### Returns

`Promise`\<[`AccessOfficialDoorGroup`](AccessOfficialDoorGroup.md)\>

The updated group.

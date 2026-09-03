[**unifi-access**](../README.md)

***

[Home](../README.md) / OfficialAccessPolicies

# Interface: OfficialAccessPolicies

The official API's access-policy domain: the policies themselves, the holiday groups a schedule observes, and the schedules a policy grants on.

## Methods

### create()

```ts
create(opts, call?): Promise<AccessOfficialAccessPolicy>;
```

Create an access policy. `POST /access_policies`, permission `edit:policy`.

Live-verified.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `opts` | [`AccessOfficialAccessPolicyCreate`](AccessOfficialAccessPolicyCreate.md) | The policy to create. |
| `call` | [`AccessOfficialCallOptions`](AccessOfficialCallOptions.md) | The per-call options - an optional abort signal. |

#### Returns

`Promise`\<[`AccessOfficialAccessPolicy`](AccessOfficialAccessPolicy.md)\>

The created policy.

***

### createHolidayGroup()

```ts
createHolidayGroup(opts, call?): Promise<AccessOfficialHolidayGroup>;
```

Create a holiday group. `POST /access_policies/holiday_groups`, permission `edit:policy`.

Documentation-derived.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `opts` | [`AccessOfficialHolidayGroupCreate`](AccessOfficialHolidayGroupCreate.md) | The group to create. |
| `call` | [`AccessOfficialCallOptions`](AccessOfficialCallOptions.md) | The per-call options - an optional abort signal. |

#### Returns

`Promise`\<[`AccessOfficialHolidayGroup`](AccessOfficialHolidayGroup.md)\>

The created group.

***

### createSchedule()

```ts
createSchedule(opts, call?): Promise<AccessOfficialSchedule>;
```

Create a schedule. `POST /access_policies/schedules`, permission `edit:policy`. The nested `holiday_schedule` member requires UniFi Access 1.20.11 or later.

The week schedule must name all seven days. A map carrying only some of them is refused with the controller's own system-error code rather than being taken as
a schedule with the rest closed, which is why [AccessOfficialWeekSchedule](AccessOfficialWeekSchedule.md) requires every day and an unwanted day is sent as an empty array.

Live-verified.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `opts` | [`AccessOfficialScheduleCreate`](AccessOfficialScheduleCreate.md) | The schedule to create. |
| `call` | [`AccessOfficialCallOptions`](AccessOfficialCallOptions.md) | The per-call options - an optional abort signal. |

#### Returns

`Promise`\<[`AccessOfficialSchedule`](AccessOfficialSchedule.md)\>

The created schedule.

***

### delete()

```ts
delete(id, call?): Promise<void>;
```

Delete an access policy. `DELETE /access_policies/:id`, permission `edit:policy`.

Live-verified.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `id` | `string` | The policy's identifier. |
| `call` | [`AccessOfficialCallOptions`](AccessOfficialCallOptions.md) | The per-call options - an optional abort signal. |

#### Returns

`Promise`\<`void`\>

***

### deleteHolidayGroup()

```ts
deleteHolidayGroup(id, call?): Promise<void>;
```

Delete a holiday group. `DELETE /access_policies/holiday_groups/:id`, permission `edit:policy`.

Documentation-derived.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `id` | `string` | The group's identifier. |
| `call` | [`AccessOfficialCallOptions`](AccessOfficialCallOptions.md) | The per-call options - an optional abort signal. |

#### Returns

`Promise`\<`void`\>

***

### deleteSchedule()

```ts
deleteSchedule(id, call?): Promise<void>;
```

Delete a schedule. `DELETE /access_policies/schedules/:id`, permission `edit:policy`.

Live-verified.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `id` | `string` | The schedule's identifier. |
| `call` | [`AccessOfficialCallOptions`](AccessOfficialCallOptions.md) | The per-call options - an optional abort signal. |

#### Returns

`Promise`\<`void`\>

***

### fetch()

```ts
fetch(id, call?): Promise<AccessOfficialAccessPolicy>;
```

Fetch one access policy. `GET /access_policies/:id`, permission `view:policy`.

Live-verified.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `id` | `string` | The policy's identifier. |
| `call` | [`AccessOfficialCallOptions`](AccessOfficialCallOptions.md) | The per-call options - an optional abort signal. |

#### Returns

`Promise`\<[`AccessOfficialAccessPolicy`](AccessOfficialAccessPolicy.md)\>

The policy.

***

### fetchAll()

```ts
fetchAll(call?): Promise<AccessOfficialAccessPolicy[]>;
```

Fetch every access policy. `GET /access_policies`, permission `view:policy`.

Live-verified.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `call` | [`AccessOfficialCallOptions`](AccessOfficialCallOptions.md) | The per-call options - an optional abort signal. |

#### Returns

`Promise`\<[`AccessOfficialAccessPolicy`](AccessOfficialAccessPolicy.md)[]\>

Every policy on the controller.

***

### fetchAllHolidayGroups()

```ts
fetchAllHolidayGroups(call?): Promise<AccessOfficialHolidayGroupSummary[]>;
```

Fetch every holiday group, as summaries. `GET /access_policies/holiday_groups`, permission `view:policy`.

The list view reports each group's holiday count rather than its holidays; [OfficialAccessPolicies.fetchHolidayGroup](#fetchholidaygroup) returns them.

Live-verified.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `call` | [`AccessOfficialCallOptions`](AccessOfficialCallOptions.md) | The per-call options - an optional abort signal. |

#### Returns

`Promise`\<[`AccessOfficialHolidayGroupSummary`](AccessOfficialHolidayGroupSummary.md)[]\>

Every holiday group on the controller.

***

### fetchAllSchedules()

```ts
fetchAllSchedules(call?): Promise<AccessOfficialSchedule[]>;
```

Fetch every schedule. `GET /access_policies/schedules`, permission `view:policy`.

The list view is a summary projection: it omits `weekly`, `holiday_group`, and `holiday_schedule` on every entry.

Live-verified.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `call` | [`AccessOfficialCallOptions`](AccessOfficialCallOptions.md) | The per-call options - an optional abort signal. |

#### Returns

`Promise`\<[`AccessOfficialSchedule`](AccessOfficialSchedule.md)[]\>

Every schedule on the controller.

***

### fetchHolidayGroup()

```ts
fetchHolidayGroup(id, call?): Promise<AccessOfficialHolidayGroup>;
```

Fetch one holiday group in full. `GET /access_policies/holiday_groups/:id`, permission `view:policy`.

Documentation-derived.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `id` | `string` | The group's identifier. |
| `call` | [`AccessOfficialCallOptions`](AccessOfficialCallOptions.md) | The per-call options - an optional abort signal. |

#### Returns

`Promise`\<[`AccessOfficialHolidayGroup`](AccessOfficialHolidayGroup.md)\>

The group, with its holidays.

***

### fetchSchedule()

```ts
fetchSchedule(id, call?): Promise<AccessOfficialSchedule>;
```

Fetch one schedule. `GET /access_policies/schedules/:id`, permission `view:policy`.

Live-verified.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `id` | `string` | The schedule's identifier. |
| `call` | [`AccessOfficialCallOptions`](AccessOfficialCallOptions.md) | The per-call options - an optional abort signal. |

#### Returns

`Promise`\<[`AccessOfficialSchedule`](AccessOfficialSchedule.md)\>

The schedule.

***

### update()

```ts
update(
   id, 
   opts, 
   call?
): Promise<AccessOfficialAccessPolicy>;
```

Update an access policy. `PUT /access_policies/:id`, permission `edit:policy`.

Documentation-derived.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `id` | `string` | The policy's identifier. |
| `opts` | [`AccessOfficialAccessPolicyUpdate`](AccessOfficialAccessPolicyUpdate.md) | The members to change; anything omitted is left as it stands. |
| `call` | [`AccessOfficialCallOptions`](AccessOfficialCallOptions.md) | The per-call options - an optional abort signal. |

#### Returns

`Promise`\<[`AccessOfficialAccessPolicy`](AccessOfficialAccessPolicy.md)\>

The updated policy.

***

### updateHolidayGroup()

```ts
updateHolidayGroup(
   id, 
   opts, 
   call?
): Promise<AccessOfficialHolidayGroup>;
```

Update a holiday group. `PUT /access_policies/holiday_groups/:id`, permission `edit:policy`.

Documentation-derived.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `id` | `string` | The group's identifier. |
| `opts` | [`AccessOfficialHolidayGroupUpdate`](AccessOfficialHolidayGroupUpdate.md) | The members to change. Omitting `holidays` leaves the group's holidays as they stand. |
| `call` | [`AccessOfficialCallOptions`](AccessOfficialCallOptions.md) | The per-call options - an optional abort signal. |

#### Returns

`Promise`\<[`AccessOfficialHolidayGroup`](AccessOfficialHolidayGroup.md)\>

The updated group.

***

### updateSchedule()

```ts
updateSchedule(
   id, 
   opts, 
   call?
): Promise<void>;
```

Update a schedule. `PUT /access_policies/schedules/:id`, permission `edit:policy`.

Documentation-derived.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `id` | `string` | The schedule's identifier. |
| `opts` | [`AccessOfficialScheduleUpdate`](AccessOfficialScheduleUpdate.md) | The members to change; anything omitted is left as it stands. |
| `call` | [`AccessOfficialCallOptions`](AccessOfficialCallOptions.md) | The per-call options - an optional abort signal. |

#### Returns

`Promise`\<`void`\>

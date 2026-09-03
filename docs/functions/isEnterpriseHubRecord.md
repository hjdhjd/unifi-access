[**unifi-access**](../README.md)

***

[Home](../README.md) / isEnterpriseHubRecord

# Function: isEnterpriseHubRecord()

```ts
function isEnterpriseHubRecord(device, state): boolean;
```

Whether a device record is an Enterprise Access Hub the building hosts directly - the multi-port hardware [selectAccessPoints](selectAccessPoints.md) expands into one access point
per door-serving port.

This is the one definition of that qualification, shared by the expansion and by the projection tier's hub accessors, which is what keeps the two complementary
by construction: a record is expanded into per-port handles exactly where it is withheld from the whole-hub handles, so no record is ever reachable through both
views and no record is reachable through neither. Two independent predicates could drift into leaving a record with either both views or none.

An Enterprise Access Hub also qualifies in a state with no topology root at all. Without a root there is no building identity to match its placement against and
no port extensions to expand, so a whole-hub handle would resolve its door to the hub's own location and command the wrong resource. Withholding it from the hub
views is the honest answer until a topology places it, and the per-port view answers empty there for the same reason.

## Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `device` | [`AccessStateDevice`](../type-aliases/AccessStateDevice.md) | Any device record the state holds. |
| `state` | [`AccessState`](../type-aliases/AccessState.md) | The current state, whose topology root supplies the building identity the scan matches against. |

## Returns

`boolean`

`true` when the record is an Enterprise Access Hub the building hosts, or one no topology has placed.

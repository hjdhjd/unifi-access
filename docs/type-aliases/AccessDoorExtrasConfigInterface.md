[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessDoorExtrasConfigInterface

# Type Alias: AccessDoorExtrasConfigInterface

```ts
type AccessDoorExtrasConfigInterface = {
  door_thumbnail?: string;
  door_thumbnail_last_update?: number;
  uah-input_state_dps?: string;
  uah-wiring_state_dps-neg?: string;
  uah-wiring_state_dps-pos?: string;
};
```

A description of the extras a `door` location carries: the door's thumbnail image and the door position sensor (DPS) state reported by an attached hub.

Every field is optional because the controller emits these as independently-appearing groups...a door may carry the thumbnail pair alone, the `uah-*` triple
alone, both, or neither, and which groups appear varies by the hardware attached to the door rather than by firmware.

The `uah-*` fields are strings rather than booleans: the wire carries the DPS state as `"off"` on every reader sampled through 2026, never as a JSON boolean.

## Properties

| Property | Type |
| ------ | ------ |
| <a id="door_thumbnail"></a> `door_thumbnail?` | `string` |
| <a id="door_thumbnail_last_update"></a> `door_thumbnail_last_update?` | `number` |
| <a id="uah-input_state_dps"></a> `uah-input_state_dps?` | `string` |
| <a id="uah-wiring_state_dps-neg"></a> `uah-wiring_state_dps-neg?` | `string` |
| <a id="uah-wiring_state_dps-pos"></a> `uah-wiring_state_dps-pos?` | `string` |

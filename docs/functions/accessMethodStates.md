[**unifi-access**](../README.md)

***

[Home](../README.md) / accessMethodStates

# Function: accessMethodStates()

```ts
function accessMethodStates(settings): Partial<Readonly<Record<AccessMethod, boolean>>>;
```

Read a device's official access-method settings as each access method's state, by name: `true` for a method the settings report enabled, `false` for one they
report disabled, and no entry at all for a method they do not list, which is a method the device cannot do rather than one switched off. A method the settings
list with a value outside the `"yes"` and `"no"` pair has no entry either, because a spelling the wire has not been observed to write is not guessed at.

Each method is judged on the first of the official keys it spans, so a method spanning more than one key, as mobile unlock does, reads one way wherever it is
read. The routed access-method write judges its read-back through this, so a consumer's own read and that write's verdict rest on one rule, and the value rule
is the one the state tier's `deviceAccessMethodStates` applies to a device's own configuration rows.

## Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `settings` | [`AccessOfficialDeviceSettings`](../interfaces/AccessOfficialDeviceSettings.md) | The device's settings, as the official settings read answers them. |

## Returns

`Partial`\<`Readonly`\<`Record`\<[`AccessMethod`](../type-aliases/AccessMethod.md), `boolean`\>\>\>

Each method the settings list with an established reading, mapped to whether it is enabled.

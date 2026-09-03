[**unifi-access**](../README.md)

***

[Home](../README.md) / selectControllerUptime

# Function: selectControllerUptime()

```ts
function selectControllerUptime(state): Nullable<number>;
```

The controller host's uptime in seconds, or `null` before its information document has been fetched.

The value is what the controller serves rather than a measurement this library takes. Across a long horizon it advances with elapsed time, and a restart returns
it to near zero; across a short one the controller can serve the identical value twice, so it is not a monotonic clock and a consumer should not read a flat
value as a stalled controller. No memo level is needed because the value is a number: an observer
comparing it by identity is comparing the number itself, so a re-served identical reading wakes nobody.

## Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `state` | [`AccessState`](../type-aliases/AccessState.md) | The current state. |

## Returns

`Nullable`\<`number`\>

The host's uptime in seconds, or `null`.

[**unifi-access**](../README.md)

***

[Home](../README.md) / selectControllerName

# Function: selectControllerName()

```ts
function selectControllerName(state): Nullable<string>;
```

The controller's display name, or `null` before its information document has been fetched. This is the host's own hostname - the name an administrator gave the
console, and the one that matches what the controller's interface shows - rather than the hardware shortname beside it, which names the model.

## Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `state` | [`AccessState`](../type-aliases/AccessState.md) | The current state. |

## Returns

`Nullable`\<`string`\>

The controller's display name, or `null`.

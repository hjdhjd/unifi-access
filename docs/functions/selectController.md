[**unifi-access**](../README.md)

***

[Home](../README.md) / selectController

# Function: selectController()

```ts
function selectController(state): Nullable<AccessControllerConfigInterface>;
```

The controller's own information document, or `null` before one has been fetched. Read through a selector rather than off the state directly so that every
consumer of the controller record - including the client's own convenience getter - reaches it the one way.

## Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `state` | [`AccessState`](../type-aliases/AccessState.md) | The current state. |

## Returns

`Nullable`\<[`AccessControllerConfigInterface`](../interfaces/AccessControllerConfigInterface.md)\>

The controller document, or `null`.

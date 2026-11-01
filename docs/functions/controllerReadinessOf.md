[**unifi-access**](../README.md)

***

[Home](../README.md) / controllerReadinessOf

# Function: controllerReadinessOf()

```ts
function controllerReadinessOf(error): 
  | AccessControllerReadiness
  | null;
```

Whether a failure is the controller answering that it is limiting requests or is not ready yet, rather than judging the request or failing to answer at all: an
[AccessRequestError](../classes/AccessRequestError.md) carrying a 429 reads `"limiting"`, and one carrying a status the transport retries reads `"not-ready"`, handed in bare or as the
`cause` of an [AccessBootstrapError](../classes/AccessBootstrapError.md), the one wrapper this opens, on the terms [isSignInRefusal](isSignInRefusal.md) opens it.

Saying this once is what keeps a consumer's reading from drifting from the library's own. The connection monitor announces a lost connection by this reading,
and a consumer reporting a failed connect reads a startup answered this way by the same rule rather than as an unreachable controller. A sign-in refused on either
ground answers `null`, because [isSignInRefusal](isSignInRefusal.md) is its reading, and so does every failure that is not a status the controller answered.

## Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `error` | `unknown` | The error value to classify. Typed `unknown` because catch bindings, event handlers, and rejected promises all deliver untyped values. |

## Returns

  \| [`AccessControllerReadiness`](../type-aliases/AccessControllerReadiness.md)
  \| `null`

`"limiting"` or `"not-ready"` when the failure is such an answer, and `null` for anything else.

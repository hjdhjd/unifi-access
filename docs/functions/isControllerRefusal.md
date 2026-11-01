[**unifi-access**](../README.md)

***

[Home](../README.md) / isControllerRefusal

# Function: isControllerRefusal()

```ts
function isControllerRefusal(error): boolean;
```

Whether a failure is the controller refusing in a way that asking again sooner cannot change: a refused identity or privilege, as [isSignInRefusal](isSignInRefusal.md) reads one, in
every spelling it reads, or a refused request rate, a controller limiting requests, the 429 the transport classifies as an [AccessRequestError](../classes/AccessRequestError.md) and
[controllerReadinessOf](controllerReadinessOf.md) reads as `"limiting"`. In each the controller answered, and its answer stands until a person corrects the credentials or the privilege,
or the controller lifts its limit, so a caller retrying a connection waits for any of them on the slower [ACCESS\_RECOVERY\_REFUSAL\_SCHEDULE\_MS](../variables/ACCESS_RECOVERY_REFUSAL_SCHEDULE_MS.md) rather than at the
pace it keeps for a controller it cannot reach. The library's own recovery chooses its schedule by this reading, so a connect retry that branches on it walks that
schedule for exactly the failures recovery walks it for.

It pairs with [isSignInRefusal](isSignInRefusal.md), the narrower reading: this one chooses the schedule, and that one chooses how a loss is announced, because a refused sign-in
waits on a person to correct the credentials or the privilege while a rate limit is the controller asking to be asked less often.

An [AccessBootstrapError](../classes/AccessBootstrapError.md) handed in is read by the `cause` it carries, because the direct bootstrap wraps a refused or rate-limited document read in that error
at the fetch stage, and no further, so a bootstrap error wrapping another bootstrap error answers false. Each reading this joins opens that one wrapper by the same
rule, so every arm reads the same error. Every other error is read as itself, so a network fault carrying a refusal somewhere below it is the network fault it is.
The answer is a plain `boolean` rather than a type guard, because in the wrapped case the refusal is the `cause` of the value handed in rather than that value.

## Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `error` | `unknown` | The error value to classify. Typed `unknown` because catch bindings, event handlers, and rejected promises all deliver untyped values. |

## Returns

`boolean`

`true` when the failure, or the cause a bootstrap error carries, is a refused identity, a refused privilege or a refused request rate; `false` for
  anything else, a controller not ready yet among them.

[**unifi-access**](../README.md)

***

[Home](../README.md) / isSignInRefusal

# Function: isSignInRefusal()

```ts
function isSignInRefusal(error): boolean;
```

Whether a failure is the controller refusing the sign-in on either ground - the identity itself, as [isIdentityRefusal](isIdentityRefusal.md) reads one, or a privilege, as
[isPrivilegeRefusal](isPrivilegeRefusal.md) reads one - in every spelling the library produces for each. It is the narrower reading of a refusal, and it chooses the library's refused
announcement, because nothing changes until a person corrects the credentials or the privilege. It chooses no schedule: a caller retrying a connection chooses its
schedule by [isControllerRefusal](isControllerRefusal.md), which reads a refused sign-in and a rate limit alike.

What is read is the error handed in, or the `cause` of an [AccessBootstrapError](../classes/AccessBootstrapError.md) handed in, and no further. The direct bootstrap wraps a refused document
read in that error at the fetch stage, and the narrower predicates read the error handed in and never its `cause` chain, so this opens that one wrapper, the one
their own contract tells a caller to open. Every other error is read as itself, and a bootstrap error wrapping another bootstrap error answers false.

The answer is a plain `boolean` rather than a type guard, because in the wrapped case the value handed in is the wrapper and the refusal is its `cause`, so
narrowing the value handed in would claim something untrue of it. A caller that wants the narrowed arm hands the refusal itself, the wrapper's `cause` in the
wrapped case, to the narrower predicate that reads it.

## Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `error` | `unknown` | The error value to classify. Typed `unknown` because catch bindings, event handlers, and rejected promises all deliver untyped values. |

## Returns

`boolean`

`true` when the failure, or the cause a bootstrap error carries, is an identity or a privilege refusal; `false` for anything else, a rate limit among them.

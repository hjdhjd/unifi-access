[**unifi-access**](../README.md)

***

[Home](../README.md) / isPrivilegeRefusal

# Function: isPrivilegeRefusal()

```ts
function isPrivilegeRefusal(error): error is AccessAuthorizationError | AccessApiError & { code: "CODE_OPERATION_FORBIDDEN" };
```

Whether a failure is the controller refusing an operation on privilege grounds - the identity authenticated, and was told it may not do this. A refusal is spelled
differently depending on which of the controller's surfaces answered it, and this reads every spelling the library produces for one.

The following spellings qualify:

1. An [AccessAuthorizationError](../classes/AccessAuthorizationError.md), the transport's classification of a refused status.
2. An [AccessApiError](../classes/AccessApiError.md) whose `code` is `CODE_OPERATION_FORBIDDEN`, the controller's own refusal answered inside a successful response.

What is read is the error handed in, never its `cause` chain, so a wrapper around a refusal answers false. The library's own case is a refused bootstrap document,
which arrives as an [AccessBootstrapError](../classes/AccessBootstrapError.md), so a caller holding one hands that wrapper's `cause` to this rather than the wrapper itself. A failed authentication
is a different fault with a different remedy and answers false...a privilege refusal is the controller having already accepted who is asking.

Saying this once is what keeps a consumer's reading from drifting from the library's, and it is the one place a further spelling lands if the controller grows
one. The predicate type names the code deliberately rather than answering with the bare class: a type guard narrows the false branch as well, and an
`AccessApiError` carrying any other code answers false, so the bare class there would tell the compiler that such an error cannot exist where it plainly can.
Naming the code keeps the class in the false branch for the caller to read, and hands the true branch the narrowed members it reports the refusal from.

## Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `error` | `unknown` | The error value to classify. Typed `unknown` because catch bindings, event handlers, and rejected promises all deliver untyped values. |

## Returns

error is AccessAuthorizationError \| AccessApiError & \{ code: "CODE\_OPERATION\_FORBIDDEN" \}

`true` when the failure is a privilege refusal, narrowed to the arm that carries the caller's diagnosis; `false` for anything else.

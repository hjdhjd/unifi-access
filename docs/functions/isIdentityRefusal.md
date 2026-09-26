[**unifi-access**](../README.md)

***

[Home](../README.md) / isIdentityRefusal

# Function: isIdentityRefusal()

```ts
function isIdentityRefusal(error): error is AccessAuthError | AccessApiError & { code: "CODE_ACCESS_TOKEN_INVALID" | "CODE_AUTH_FAILED" | "CODE_UNAUTHORIZED" };
```

Whether a failure is the controller refusing the identity itself - the credentials or the token did not authenticate, so the controller never reached the
question of what that identity may do. A refused identity is spelled differently depending on which of the controller's surfaces answered it, and this reads
every spelling the library produces for one.

The following spellings qualify:

1. An [AccessAuthError](../classes/AccessAuthError.md), the transport's classification of a refused status.
2. An [AccessApiError](../classes/AccessApiError.md) whose `code` is `CODE_ACCESS_TOKEN_INVALID`, `CODE_AUTH_FAILED`, or `CODE_UNAUTHORIZED`, the controller's own refusal answered
   inside a successful response. These are the codes the vendor's reference documents for a refused identity, and none has yet been captured from a live
   controller. `CODE_UNAUTHORIZED` is read as a refused identity by this library's ruling, following its name, which is the HTTP vocabulary for a failed
   authentication, although the reference words its message as a refused permission and no capture has settled which it is.

What is read is the error handed in, never its `cause` chain, so a wrapper around a refusal answers false, on the same terms as [isPrivilegeRefusal](isPrivilegeRefusal.md). A caller
that wants a refused identity and a refused permission read together through an [AccessBootstrapError](../classes/AccessBootstrapError.md) hands the wrapper to [isSignInRefusal](isSignInRefusal.md) instead. A
privilege refusal is a different fault with a different remedy and answers false...an identity refused a permission has already authenticated. No failure answers true
both here and there, so a caller can branch on each reading without ordering them.

The predicate type names the codes rather than answering with the bare class, for the reason [isPrivilegeRefusal](isPrivilegeRefusal.md) gives: an `AccessApiError` carrying any
other code answers false, so it stays in the caller's type on the false branch, and the true branch hands over the narrowed members the refusal is reported from.

## Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `error` | `unknown` | The error value to classify. Typed `unknown` because catch bindings, event handlers, and rejected promises all deliver untyped values. |

## Returns

error is AccessAuthError \| AccessApiError & \{ code: "CODE\_ACCESS\_TOKEN\_INVALID" \| "CODE\_AUTH\_FAILED" \| "CODE\_UNAUTHORIZED" \}

`true` when the failure is an identity refusal, narrowed to the arm that carries the caller's diagnosis; `false` for anything else.

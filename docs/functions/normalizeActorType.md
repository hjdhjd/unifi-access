[**unifi-access**](../README.md)

***

[Home](../README.md) / normalizeActorType

# Function: normalizeActorType()

```ts
function normalizeActorType(actorType): AccessActorType;
```

Fold an actor type into the library's single spelling of it.

The controller spells the API-caller actor two ways for one concept: with an underscore on the notification socket and with a hyphen on the webhook. Underscore
is the spelling this library carries, because it is what the socket sends and because it matches how every other value on this wire is spelled. Everything else
passes through untouched - this folds a known split rather than filtering a vocabulary it does not own.

## Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `actorType` | `string` | The actor type exactly as the channel spelled it. |

## Returns

[`AccessActorType`](../type-aliases/AccessActorType.md)

The actor type in the library's spelling.

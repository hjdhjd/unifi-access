[**unifi-access**](../README.md)

***

[Home](../README.md) / ACCESS\_DOORBELL\_REASON\_CODES

# Variable: ACCESS\_DOORBELL\_REASON\_CODES

```ts
const ACCESS_DOORBELL_REASON_CODES: Readonly<Record<number, string>>;
```

What each of a doorbell call's reason codes means, in words fit to show a person.

Four of these carry the controller documentation's own meaning. The fifth, `400`, does not: the reference glosses it as the call having been answered by another
administrator, and a live call answered by the very person subscribed to the notification carried it anyway. Read the documented way the code would state a
falsehood about who acted, so what it actually reports is narrower - the call was answered somewhere other than here, which may well be somewhere else the same
person is signed in. That is the meaning carried below, and it is the one row whose wording departs from the reference.

The type is keyed by plain `number` so that a reason code read off a payload indexes it directly, and a code outside the documented set reads as absent rather
than as a compile error. Absence is a real answer: the controller sends `0` on a call that is merely beginning, and nothing here should invent a meaning for it.

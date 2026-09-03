[**unifi-access**](../README.md)

***

[Home](../README.md) / verifyWebhookSignature

# Function: verifyWebhookSignature()

```ts
function verifyWebhookSignature(opts): Nullable<AccessWebhookSignature>;
```

Establish that a webhook delivery really came from the controller that holds this endpoint's secret, and answer with what its signature established.

The scheme is the controller's, verified end to end against live deliveries: the `Signature` header carries a unix timestamp and a hex-encoded MAC, and the MAC
is HMAC-SHA256 over the timestamp's decimal digits, a literal `.`, and the request body exactly as it arrived. The body must therefore be the raw bytes or the
raw text - a body that has been parsed and re-serialized will not verify, because re-serializing is free to change whitespace and key order that the MAC covered.

There is no freshness check here, and that is deliberate on two grounds. Comparing a timestamp against the present needs a clock, which would make this function
impure and put it at odds with how every other time-dependent thing in this library takes its clock by injection. And how old is too old is a policy question
with no library-wide answer: a consumer that queues deliveries tolerates minutes, one that acts on them immediately tolerates seconds. So the validated
timestamp is handed back instead, and a receiver applies its own window to it without re-parsing a header this function has already read and authenticated.

Every failure is a clean `null` rather than a throw - a malformed header, an absent signature, a truncated MAC, and a MAC that simply does not match are all
"this did not come from the controller", and a receiver handling untrusted input should not have to distinguish them to stay safe.

## Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `opts` | \{ `body`: `string` \| `Uint8Array`\<`ArrayBufferLike`\>; `header`: `string`; `secret`: `string`; \} | The delivery to verify. |
| `opts.body` | `string` \| `Uint8Array`\<`ArrayBufferLike`\> | The request body exactly as received, as bytes or as text. |
| `opts.header` | `string` | The delivery's `Signature` header value. |
| `opts.secret` | `string` | The secret the controller minted when the endpoint was registered. |

## Returns

`Nullable`\<[`AccessWebhookSignature`](../interfaces/AccessWebhookSignature.md)\>

What the signature established when it is authentic, and `null` for every other outcome.

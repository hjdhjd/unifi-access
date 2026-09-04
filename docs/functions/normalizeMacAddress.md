[**unifi-access**](../README.md)

***

[Home](../README.md) / normalizeMacAddress

# Function: normalizeMacAddress()

```ts
function normalizeMacAddress(value): string;
```

Fold a hardware address into the library's single spelling of it: uppercase, with no separators. Every spelling [isMacAddress](isMacAddress.md) accepts folds the same way,
whether the digits are joined by colons, by hyphens, by dots, or by nothing at all.

The controller spells one device's address with the case varying from record to record and from one read to the next, and the official API carries it with the
separators removed. Uppercase without separators is the spelling this library carries because it is the spelling the companion UniFi Protect controller and its
library carry verbatim from their own wire, so a consumer serving both families keys every device one way, and because one spelling is the whole point: a
consumer keyed on an address must never be re-keyed by the wire's case. A value that is not an address passes through untouched - this folds a known split rather
than filtering a vocabulary it does not own. An address a channel hands a consumer directly - a doorbell ring's host device, a webhook's device - is folded the
same way by the consumer that reads it.

## Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `value` | `string` | The address exactly as a channel spelled it. |

## Returns

`string`

The address in the library's spelling, or the value unchanged when it is not an address.

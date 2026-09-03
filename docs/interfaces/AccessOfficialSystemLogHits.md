[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessOfficialSystemLogHits

# Interface: AccessOfficialSystemLogHits

A page of log entries.

The pagination is NOT in here - it rides at the top level of the envelope, exactly as it does on every other paginated endpoint, and reaches the caller beside
this payload. The reference documents page counters inside the payload instead, which the wire does not do.

Live-verified.

## Properties

| Property | Modifier | Type |
| ------ | ------ | ------ |
| <a id="hits"></a> `hits` | `readonly` | readonly [`AccessOfficialSystemLogHit`](AccessOfficialSystemLogHit.md)[] |

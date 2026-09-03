[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessWebhookDpsStatusObject

# Interface: AccessWebhookDpsStatusObject

What a door-position delivery reports: which way the door moved.

This is the plainest of the ways the controller describes door position - the notification socket carries the same condition inside a per-door state array, and
the older dialect hides it in a wiring flag whose polarity is inverted against the semantic state. The controller delivers it for hardware beyond what its own
changelog scopes it to, so a consumer should not decide from that list whether to expect it.

Live-verified.

## Properties

| Property | Modifier | Type |
| ------ | ------ | ------ |
| <a id="event_type"></a> `event_type` | `readonly` | `"dps_change"` |
| <a id="status"></a> `status` | `readonly` | `"close"` \| `"open"` |

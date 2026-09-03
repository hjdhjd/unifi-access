[**unifi-access**](../README.md)

***

[Home](../README.md) / ACCESS\_AUTHENTICATION\_TYPES

# Variable: ACCESS\_AUTHENTICATION\_TYPES

```ts
const ACCESS_AUTHENTICATION_TYPES: Readonly<Record<string, string>>;
```

What each of an unlock's authentication types means, in words fit to show a person.

The controller reports how a door was opened as a bare token, and every channel that describes an unlock speaks the same vocabulary: the webhook's unlock
payload, the notification socket's log records, the official socket's doorbell-answer record, and the official system-logs endpoint. `WAVE` reads as the
controller's own display of the gesture does, which its log line states as "Access Granted (Hand)".

Each meaning is a lowercase phrase fragment with no terminal punctuation, because these are written to sit inside a sentence the consumer composes - "unlocked
by Homebridge (remote command through the hub)" - where [ACCESS\_DOORBELL\_REASON\_CODES](ACCESS_DOORBELL_REASON_CODES.md) states standalone sentences because a reason code renders alone.
Rendering for a person is the whole of what this table is for: a protocol decision reads the token itself, and the token is what stays in anything
machine-facing.

Absence is a real answer, so there is no fallback row. A token outside the set below reads as absent and a consumer shows the spelling the wire sent rather
than a meaning this library invented for it...the set is bounded by what captures have shown rather than by what the reference documents, which enumerates none
of this vocabulary, so a row arrives here when a capture shows the spelling and never by speculation about what else a reader might report.

The keys are the uppercase spelling, which is what the webhook, the socket's `access.logs.add` frames, and the official system-logs endpoint all deliver. The
socket's `access.logs.insights.add` frames spell the same vocabulary lowercase, so a consumer reading that one channel folds case before looking a token up.

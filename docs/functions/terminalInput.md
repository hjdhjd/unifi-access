[**unifi-access**](../README.md)

***

[Home](../README.md) / terminalInput

# Function: terminalInput()

```ts
function terminalInput(device, input): AccessTerminalInputFacts;
```

What a device reports about one of the terminals on its back: whether the hardware has something in service on it, and what that terminal currently reads.

The answer is one of three, and the union's own shape is what keeps them apart. A terminal reporting `wired: true` is in service and carries its reading as
`state` wherever one is readable; a terminal reporting `wired: false` is one the hardware says nothing is attached to, and it carries no reading at all, because
a floating input's row is a value nothing has qualified; and an empty object is no evidence either way, which is a different statement from reporting nothing
wired. **Wired means in service**, which the hardware establishes in one of two ways: a live circuit detected on the terminal's own wiring pair, which is what
every model but one reports, or, on a UA Ultra, which detects no circuits at all, the port setting that assigns its one input terminal to a duty.

Which terminals a device carries is what the captures establish rather than what a model name implies, so this answers per record. A UA Hub carries all four -
its door position sensor, its remote release, its request to enter, and its request to exit. A UA Hub Door Mini and a UA Ultra carry the position sensor and the
request to exit of their one door port. A port of an Enterprise Access Hub carries its own two, and the whole hub carries none that can be named without
ambiguity: eight ports speak the same terminals, so the hub itself answers with no evidence and its per-port access points answer instead. A reader carries
none, and answers nothing for every terminal.

The absent answer covers the situations a caller wants to tell apart from a terminal with nothing wired to it, and they are deliberately not collapsed together.
The record may carry none of the terminal's keys; it may carry no configuration rows at all, which is every record a token-only census produced, so a token
client reads `{}` here by construction for every terminal; the wiring pair may be only half readable, which is no pair; or the hardware may report neither a
pair nor a duty, which is a UA Ultra whose port setting has never been established.

This is read live on every call, where the door-state entry a door carries is seeded once from the same hardware and then left to the notification stream. So a
consumer asking what a terminal reports right now reads this, and one asking what the controller last said about a door reads that.

The reading is refreshed by the topology census and by the controller's original device-update dialect, whose every captured delivery is a full record carrying
the whole row array and the extensions beside it. The newer dialect carries its terminals under a member the canonical merge excludes, so a controller emitting
only that one refreshes this at the periodic topology re-read alone.

There is no capability predicate beside this the way [isTamperCapable](isTamperCapable.md) sits beside [tamperState](tamperState.md), because no single capability string marks
terminal-bearing hardware across the families - a UA Ultra and a UA Hub carry different ones - so the presence of the keys is the evidence, and it is what this
answers on.

`on` and `off` are the controller's own vocabulary for what a terminal reads, and the physical sense of a reading is the consumer's to apply: whether a closed
contact reads `on` depends on how an installer wired and mounted it, exactly as the door position polarity does.

## Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `device` | [`AccessStateDevice`](../type-aliases/AccessStateDevice.md) | Any device configuration record (only its configuration rows, its extensions, and its port identity are read). |
| `input` | `"dps"` \| `"rel"` \| `"ren"` \| `"rex"` \| `"sideDps"` | Which terminal to read, from [ACCESS\_TERMINAL\_INPUTS](../variables/ACCESS_TERMINAL_INPUTS.md). |

## Returns

[`AccessTerminalInputFacts`](../type-aliases/AccessTerminalInputFacts.md)

What the hardware established, with every member whose evidence is absent left out entirely.

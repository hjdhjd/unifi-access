[**unifi-access**](../README.md)

***

[Home](../README.md) / deviceAccessMethodStates

# Function: deviceAccessMethodStates()

```ts
function deviceAccessMethodStates(device): Partial<Readonly<Record<AccessMethod, boolean>>>;
```

What a device's own configuration rows say about each access method, by name: `true` for a method its row reports enabled, `false` for one reported disabled,
and no entry where nothing has established a reading.

Each method is judged on one row: the one filed under the controller's access-method tag whose key is the first the method's direct write spans, which is the
spelling the captured rows carry. A row carrying that key under another tag is not an access-method row and is not read. The value rule is the one
[accessMethodStates](accessMethodStates.md) applies to the official settings, so a method reads one way whichever surface stated it.

The absent answer covers the situations a caller may want to tell apart from a method switched off, and they are deliberately not collapsed into `false`. The
record may carry no row for the method, which says nothing about whether the hardware can do it - a captured G2 Pro offering face unlock carries no face row,
and a captured UA Hub offering PIN entry carries no pin row; it may carry no configuration rows at all, which is every record a token-only census produced until
a device update of the original dialect delivers its rows, so a token client can read `{}` here; or the row may carry a value outside the `"yes"` and `"no"`
pair, which is not guessed at. So absence here is a different statement from absence in the official settings reading, where a method the settings do not list
is one the device cannot do.

The reading is refreshed by the topology census, by the controller's original device-update dialect, whose every captured delivery is a full record carrying
the whole row array, and by the newer dialect's access-method map, whose values land on the rows the record already holds. That map establishes no row the
record lacks, so a record holding no rows - a token-only client's record before an original-dialect update delivers them - still answers `{}` however many maps
arrive. And because a topology fetch already in flight when a method is switched lands the reading it was answered with, a switch can read as reverted until
the next delivery corrects it - the eventual consistency the reducer accepts for every member a census supplies.

It is re-evaluated on every call rather than memoized, joining [tamperState](tamperState.md), [terminalInput](terminalInput.md) and [portBindings](portBindings.md) in the per-record group the
memo discipline does not cover. The answer is a fresh object on every call, so a consumer watching for a change observes the device record and reads this from
it, rather than handing this to `observe` as a selector, where a fresh object would compare unequal and wake on every dispatch.

## Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `device` | [`AccessStateDevice`](../type-aliases/AccessStateDevice.md) | Any device configuration record (only its configuration rows are read). |

## Returns

`Partial`\<`Readonly`\<`Record`\<[`AccessMethod`](../type-aliases/AccessMethod.md), `boolean`\>\>\>

Each method with an established reading, mapped to whether it is enabled.

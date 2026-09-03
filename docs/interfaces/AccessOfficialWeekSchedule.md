[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessOfficialWeekSchedule

# Interface: AccessOfficialWeekSchedule

The weekly access pattern, keyed by the lowercase English day names the wire spells.

A day's empty array means no access that day, which is why every day is present rather than optional: an absent key and a closed day would otherwise be the same
document, and the reference's samples spell all seven.

The wire requires all seven too. A map naming only some of the days is refused outright with the controller's own system-error code rather than being read as a
schedule with the unnamed days closed, so the seven required members here are what the endpoint actually accepts rather than a convention this library imposes.

This is the one declaration of the weekday map in the library - the visitor schedule carries the identical shape and type-imports it rather than restating it.

Live-verified.

## Properties

| Property | Modifier | Type |
| ------ | ------ | ------ |
| <a id="friday"></a> `friday` | `readonly` | readonly [`AccessOfficialScheduleWindow`](AccessOfficialScheduleWindow.md)[] |
| <a id="monday"></a> `monday` | `readonly` | readonly [`AccessOfficialScheduleWindow`](AccessOfficialScheduleWindow.md)[] |
| <a id="saturday"></a> `saturday` | `readonly` | readonly [`AccessOfficialScheduleWindow`](AccessOfficialScheduleWindow.md)[] |
| <a id="sunday"></a> `sunday` | `readonly` | readonly [`AccessOfficialScheduleWindow`](AccessOfficialScheduleWindow.md)[] |
| <a id="thursday"></a> `thursday` | `readonly` | readonly [`AccessOfficialScheduleWindow`](AccessOfficialScheduleWindow.md)[] |
| <a id="tuesday"></a> `tuesday` | `readonly` | readonly [`AccessOfficialScheduleWindow`](AccessOfficialScheduleWindow.md)[] |
| <a id="wednesday"></a> `wednesday` | `readonly` | readonly [`AccessOfficialScheduleWindow`](AccessOfficialScheduleWindow.md)[] |

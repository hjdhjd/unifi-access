[**unifi-access**](../README.md)

***

[Home](../README.md) / deviceDisplayName

# Function: deviceDisplayName()

```ts
function deviceDisplayName(device): string;
```

A device's display name: the alias an administrator gave it when there is one, and the controller's own name for the hardware otherwise.

The precedence is the controller interface's own - an alias is what a person chose to call this device, so it wins wherever one is set - and an alias set to
the empty string counts as unset, which is how clearing an alias in the interface reads on the wire. The rule lives here, at the record, so the projection's
own name and a routing refusal naming the device it could not serve read one answer rather than each deriving it.

## Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `device` | `Pick`\<[`AccessStateDevice`](../type-aliases/AccessStateDevice.md), `"alias"` \| `"name"`\> | Any device configuration record (only its alias and name are read). |

## Returns

`string`

The alias where one is set, and the hardware name otherwise.

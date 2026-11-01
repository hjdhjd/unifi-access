[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessDeclinedError

# Class: AccessDeclinedError

The controller declined an access-method change it accepted. The official settings write answers success for a method whose prerequisites the controller lacks
and leaves the setting as it was, so the routed access-method write reads the setting back, and this is what it raises when the read-back shows the method in
the other state. The controller answered and refused, so the change is not repeated on the other path.

Fatal because the same change is declined the same way until the controller has what the method needs. The message names the method and the device.

## Extends

- [`FatalError`](FatalError.md)

## Constructors

### Constructor

```ts
new AccessDeclinedError(message, options): AccessDeclinedError;
```

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `message` | `string` |
| `options` | \{ `cause?`: `unknown`; `method`: `"face"` \| `"mobile"` \| `"nfc"` \| `"pin"` \| `"qr"` \| `"touchPass"` \| `"wave"`; `reported`: `boolean`; \} |
| `options.cause?` | `unknown` |
| `options.method` | `"face"` \| `"mobile"` \| `"nfc"` \| `"pin"` \| `"qr"` \| `"touchPass"` \| `"wave"` |
| `options.reported` | `boolean` |

#### Returns

`AccessDeclinedError`

#### Overrides

```ts
FatalError.constructor
```

## Properties

| Property | Modifier | Type | Description |
| ------ | ------ | ------ | ------ |
| <a id="method"></a> `method` | `readonly` | `"face"` \| `"mobile"` \| `"nfc"` \| `"pin"` \| `"qr"` \| `"touchPass"` \| `"wave"` | The access method the change was asked of. |
| <a id="reported"></a> `reported` | `readonly` | `boolean` | The state the read-back reports the method in, `true` for enabled - the other state from the one the change asked for. |

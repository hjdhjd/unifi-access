[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessPortBinding

# Interface: AccessPortBinding

One port-to-door binding: which door a hub's port is bound to, what the controller calls the thing at the other end of it, and which port it is.

A member whose evidence is absent is ABSENT from the object rather than present and `undefined`, the rule the terminal facts hold to as well, so a consumer asking
whether a binding names its port asks whether the member is there at all.

## Properties

| Property | Modifier | Type | Description |
| ------ | ------ | ------ | ------ |
| <a id="doorid"></a> `doorId` | `readonly` | `string` | The bound door's identity, as the extension's `target_value` carries it. This is the member a command targets and a topology door is matched against. |
| <a id="name"></a> `name?` | `readonly` | `string` | The target's name exactly as the controller wrote it, from the extension's `target_name`. On every captured hub it is the bound door's own name, and a UA Gate owner reported it carrying the gate operator's name instead, so it is passed through rather than interpreted. It is absent where the record carries none. |
| <a id="port"></a> `port?` | `readonly` | `string` | The port this binding belongs to, from the extension's `source_id` - `port1` through `port8` on captured hardware. It is absent where the record carries none. |

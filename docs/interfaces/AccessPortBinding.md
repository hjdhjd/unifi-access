[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessPortBinding

# Interface: AccessPortBinding

One port-to-door binding: which door a hub's port is bound to, what the controller calls the thing at the other end of it, and which port it is.

It also carries the relay and door-position keys the port's configuration names.

A member whose evidence is absent is ABSENT from the object rather than present and `undefined`, the rule the terminal facts hold to as well, so a consumer asking
whether a binding names its port asks whether the member is there at all.

## Properties

| Property | Modifier | Type | Description |
| ------ | ------ | ------ | ------ |
| <a id="doorid"></a> `doorId` | `readonly` | `string` | The bound door's identity, as the extension's `target_value` carries it. This is the member a command targets and a topology door is matched against. |
| <a id="dpskey"></a> `dpsKey?` | `readonly` | `string` | The key of this port's door-position sensor input, exactly as the controller wrote it, from the `config_value` of the extension's `dps_key` row. It rests on a UA Gate owner's captured record, so it is passed through rather than interpreted. It is absent where the record carries none, or carries one that is not a string. |
| <a id="name"></a> `name?` | `readonly` | `string` | The target's name exactly as the controller wrote it, from the extension's `target_name`. On every captured hub it is the bound door's own name, and a UA Gate owner reported it carrying the gate operator's name instead, so it is passed through rather than interpreted. It is absent where the record carries none. |
| <a id="port"></a> `port?` | `readonly` | `string` | The port this binding belongs to, from the extension's `source_id` - `port1` through `port8` on captured hardware. It is absent where the record carries none. |
| <a id="relaykey"></a> `relayKey?` | `readonly` | `string` | The key of this port's relay output, exactly as the controller wrote it, from the `config_value` of the extension's `relay_key` row. It rests on a UA Gate owner's captured record, so it is passed through rather than interpreted. It is absent where the record carries none, or carries one that is not a string. |

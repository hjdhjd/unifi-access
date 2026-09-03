[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessOfficialDoorUnlockOptions

# Interface: AccessOfficialDoorUnlockOptions

Unlock a door.

With no actor supplied the controller attributes the unlock to the API token's own name, so supplying one is what makes an automation legible in the logs and
webhook deliveries as the automation rather than as the account it authenticated with. `extra` is echoed back verbatim on the webhook delivery.

`controlCmd` applies to a UA Hub Gate in three-button mode and `entryMethod` to a double-driveway gate; both require UniFi Access 4.2.16 or later, and the actor
and extra members require 3.3.21 or later.

## Properties

| Property | Type |
| ------ | ------ |
| <a id="actor"></a> `actor?` | [`AccessOfficialDoorUnlockActor`](AccessOfficialDoorUnlockActor.md) |
| <a id="controlcmd"></a> `controlCmd?` | `"close"` \| `"open"` \| `"stop"` |
| <a id="entrymethod"></a> `entryMethod?` | [`AccessOfficialDoorEntryMethod`](../type-aliases/AccessOfficialDoorEntryMethod.md) |
| <a id="extra"></a> `extra?` | `Readonly`\<`Record`\<`string`, `AccessKnownJsonValue`\>\> |
| <a id="readerid"></a> `readerId?` | `string` |

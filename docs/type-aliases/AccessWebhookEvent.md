[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessWebhookEvent

# Type Alias: AccessWebhookEvent

```ts
type AccessWebhookEvent = 
  | AccessWebhookDelivery<"access.device.dps_status", AccessWebhookDpsStatusObject>
  | AccessWebhookDelivery<"access.device.emergency_status", AccessWebhookEmergencyStatusObject>
  | AccessWebhookDelivery<"access.door.unlock", AccessWebhookDoorUnlockObject>
  | AccessWebhookDelivery<"access.doorbell.completed", AccessWebhookDoorbellCompletedObject>
  | AccessWebhookDelivery<"access.doorbell.incoming", AccessWebhookDoorbellIncomingObject>
  | AccessWebhookDelivery<"access.doorbell.incoming.REN", AccessWebhookDoorbellRenObject>
  | AccessWebhookDelivery<"access.temporary_unlock.end", AccessWebhookUnmodeledObject>
  | AccessWebhookDelivery<"access.temporary_unlock.start", AccessWebhookUnmodeledObject>
  | AccessWebhookDelivery<"access.unlock_schedule.activate", AccessWebhookUnmodeledObject>
  | AccessWebhookDelivery<"access.unlock_schedule.deactivate", AccessWebhookUnmodeledObject>
| AccessWebhookDelivery<"access.visitor.status.changed", AccessWebhookUnmodeledObject>;
```

Every webhook event the controller can be registered for, as a discriminated union on `event`.

A consumer switches on `event` and receives the matching payload with no cast. Four of the members are live-verified against deliveries from a real controller;
the rest are derived from the reference, and each says which it is in its own documentation, so nothing here presents a documented guess as an observation.

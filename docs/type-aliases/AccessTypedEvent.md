[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessTypedEvent

# Type Alias: AccessTypedEvent

```ts
type AccessTypedEvent = 
  | {
  data: AccessBootstrapConfig;
  kind: "bootstrapLoaded";
}
  | {
  data: AccessControllerConfig;
  kind: "controllerChanged";
}
  | {
  complete: boolean;
  entries: readonly AccessDoorStateEntry[];
  kind: "doorStateFactsApplied";
}
  | {
  complete: boolean;
  devices: readonly AccessStateDevice[];
  doors: readonly AccessStateDoor[];
  doorStates: readonly AccessDoorStateEntry[];
  kind: "censusApplied";
}
  | {
  eventName: string;
  id: string;
  kind: "deviceChanged";
  payload: AccessDeviceConfigPayload;
}
  | {
  eventName: string;
  id: string;
  kind: "deviceRemoved";
}
  | {
  eventName: string;
  id: string;
  kind: "locationChanged";
  payload: DeepWirePartial<AccessLocationConfig>;
}
  | {
  eventName: string;
  id: string;
  kind: "doorbellRing";
  payload: AccessEventDoorbellRing;
}
  | {
  eventName: string;
  kind: "doorbellCancel";
  payload: AccessEventDoorbellCancel;
}
  | {
  eventName: string;
  kind: "doorStateChanged";
  states: readonly [AccessDoorStateEntry, ...AccessDoorStateEntry[]];
} & 
  | {
  device: {
     id: string;
     payload: AccessDeviceConfigPayload;
  };
  location?: never;
}
  | {
  device?: never;
  location: {
     id: string;
     payload: DeepWirePartial<AccessLocationConfig>;
  };
}
  | {
  eventName: string;
  id: string;
  kind: "unlock";
};
```

The discriminated union of every notification the library models, produced by the classifier. It splits into two categories by relationship to state.

**State transitions** advance the modeled state:

- `deviceChanged` - a device record changed. Both notification dialects produce this one kind, with the newer dialect's payload already translated into the
  bootstrap vocabulary, so a consumer never sees the dialect split.
- `deviceRemoved` - a device was removed. Identity-only by design: the older dialect sends a record here and the newer one sends nothing, and the removal needs
  only the identity. The full payload the older dialect sends stays available on the raw packet rail.
- `locationChanged` - a door, floor, or building record changed, again with the newer dialect translated.
- `doorStateChanged` - one or more doors reported their live lock, position, alarm, and emergency condition. Both newer-dialect carriers produce it, each carrying
  its own facet of the packet alongside the door state, so nothing the packet said is lost to the modeling.
- `bootstrapLoaded` - a freshly fetched topology document. Synthetic rather than a wire packet: the client dispatches it so that the reducer has one input union
  and one entry point rather than a separate bootstrap path.
- `controllerChanged` - a freshly fetched controller-information document. Synthetic for the same reason as `bootstrapLoaded`, and dispatched from the same
  refresh: the controller document drifts on its own schedule from the topology document, so the two travel as separate events rather than one.
- `doorStateFactsApplied` - facts about doors read from a source that answers some of what a door-state report carries. Synthetic like the two above, and the
  third member of that family: the client dispatches it after reading the official API's door list, so that a partial set of facts reaches state through the same
  chokepoint a full report does.
- `censusApplied` - the official API's listings, projected into the records the state holds. Synthetic like the three above, and dispatched by a client whose
  only census of the controller's hardware and doors those listings are, so that its devices, doors, and door state all reach state in one step.

**Activity signals** describe something that happened rather than a change of condition, and the reducer returns state untouched for them:

- `doorbellRing` - a doorbell was pressed. Attributed to the reader that rang, taken from the payload rather than the envelope, because the envelope identifier on
  this notification is a per-notification value rather than a device.
- `doorbellCancel` - a ring was cancelled or otherwise ended.
- `unlock` - a door was unlocked.

Every member lifted from the wire carries `eventName`, the raw notification name, so normalizing two dialects into one kind never hides which name arrived. The
synthetic members carry no `eventName`, because no packet produced them.

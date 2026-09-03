[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessState

# Type Alias: AccessState

```ts
type AccessState = Readonly<{
  controller: Nullable<AccessControllerConfig>;
  devices: ReadonlyMap<string, AccessStateDevice>;
  doors: ReadonlyMap<string, AccessStateDoor>;
  doorStates: ReadonlyMap<string, AccessDoorStateEntry>;
  floors: ReadonlyMap<string, AccessStateFloor>;
  root: Nullable<AccessStateRoot>;
}>;
```

The immutable snapshot of a controller's modeled state. Devices, doors, and floors are normalized into `unique_id -> record` maps for direct lookup, and the
topology root is the single record above them, with the controller's own information document and the live door states held beside them.

The topology root and the controller document are separate members because their reconciliation disciplines differ. The root is reference-stable across a refresh
that found no drift, which is the guarantee the observation layer rests on; the controller document carries the host's uptime, so it is expected to advance on
every genuine fetch. Folding the second into the first would make every refresh look like drift.

`doorStates` is keyed by door identity rather than by the device that reported it, because a multi-door hub reports several doors and a door can be reported by
more than one carrier. It is the one collection here fed by more than one kind of source, so its lifecycle is enumerated in full on the reducer's door-state arm.

A device record is stored as its census delivered it, and the two censuses deliver different amounts. A topology record is stored exactly as the controller sent
it, which means it still carries the `door`, `floor`, and `location` members the wire embeds in it; a record projected from the official API's device inventory
embeds no location snapshots at all, because that listing carries none. Where those members are present, keeping them is deliberate: the maps are the working
truth either way, and the embedded members are a snapshot of what the location records looked like when that device record was issued. They go stale between
events, and a consumer that wants a door's current state reads the doors map rather than a device's copy of it. Pruning them would be the alternative, but it
would discard wire material a consumer may legitimately want, and unlike the collections above they are not a second home for a record this state also stores
under its own identity. Where records are admitted, each admission rule turns a guarantee the wire does not make into one the state does: a record arriving
without a `capabilities` array is stored carrying an empty one, so the required member the device type declares is true of every record here; and a record's own
`mac`, like the controller document's `host.mac`, is stored in one spelling whichever way the wire spelled it, because the controller cases an address differently
from record to record and from one read to the next, and a consumer keyed on an address must never be re-keyed by that. The spelling rule reaches a record's own
member and nothing nested inside it: the camera records some hardware embeds are the companion UniFi Protect controller's own material, which this library
deliberately does not model, and they keep their addresses as the wire sent them.

There is deliberately no counter or timestamp here. A pure reducer cannot write a wall-clock field without minting a new state reference on every packet, which
would destroy the no-op and structural-sharing guarantees the observation layer depends on.

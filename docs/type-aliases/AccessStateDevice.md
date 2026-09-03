[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessStateDevice

# Type Alias: AccessStateDevice

```ts
type AccessStateDevice = Pick<AccessDeviceConfig, 
  | "alias"
  | "capabilities"
  | "connected_uah_id"
  | "device_type"
  | "is_adopted"
  | "is_connected"
  | "is_managed"
  | "is_online"
  | "location_id"
  | "name"
| "unique_id"> & Partial<AccessDeviceConfig>;
```

A device as stored: the record both censuses of the controller's hardware can fill.

The topology document, which a client with credentials seeds from, carries the whole wire record. The official API's device inventory, which a client with only
a token seeds from, carries the hardware's identity, its names, its role capabilities, its enrollment flags, and the door it serves - no addresses beyond the one
its identifier restores, no firmware, no configuration rows, no port extensions. The members both censuses establish are required; the rest are optional, so a
record carries what its census said and a consumer reads an absent member as not established by that census rather than as an invented value. A topology record
satisfies this type unchanged, which is what lets the selectors and projections serve both censuses through one record shape.

`mac`, where a census established it, is spelled one way - uppercase, without separators, the spelling the companion UniFi Protect controller carries - whichever
way the wire spelled it, so a consumer keyed on the address is never re-keyed by the controller casing it differently from one read to the next.

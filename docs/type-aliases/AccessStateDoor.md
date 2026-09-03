[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessStateDoor

# Type Alias: AccessStateDoor

```ts
type AccessStateDoor = Pick<AccessDoorConfig, "full_name" | "location_type" | "name" | "unique_id" | "up_id"> & Partial<OmitMembers<AccessDoorConfig, "device_groups">>;
```

A door as stored: the record both censuses of the controller's doors can fill, without the device group the devices map owns.

The topology document carries the whole location record; the official API's door listing carries the door's identity, its names, the floor above it, and its
kind. The members both establish are required. The rest are optional, so a record states what its census said and a consumer reads an absent member as not
established by that census rather than as a value. A topology door satisfies this type unchanged once its device group is pruned.

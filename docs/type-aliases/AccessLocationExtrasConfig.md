[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessLocationExtrasConfig

# Type Alias: AccessLocationExtrasConfig

```ts
type AccessLocationExtrasConfig = 
  | AccessBuildingExtrasConfigInterface
  | AccessDoorExtrasConfigInterface;
```

The extras a location carries, selected by that location's own `location_type`. A `door` location carries the scalar thumbnail and DPS fields; a `building` location
carries the per-hub `door_thumbnails` array. A `floor` location carries an extras object whose fields are simply all absent, which satisfies the scalar shape
structurally, so it needs no branch of its own.

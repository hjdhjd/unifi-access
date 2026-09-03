[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessBuildingExtrasConfigInterface

# Type Alias: AccessBuildingExtrasConfigInterface

```ts
type AccessBuildingExtrasConfigInterface = {
  door_thumbnails: {
     door_cover: Nullable<AccessKnownJsonValue>;
     door_thumbnail: string;
     door_thumbnail_last_update: number;
     hub_id: string;
  }[];
};
```

A description of the extras a `building` location carries: one thumbnail entry per door hub hosted directly by the building, rather than the flat per-door scalars a
`door` location reports. The cover is typed as an open JSON value because the controller has only ever sent it as `null`, so its non-null shape is unpinned.

## Properties

| Property | Type |
| ------ | ------ |
| <a id="door_thumbnails"></a> `door_thumbnails` | \{ `door_cover`: `Nullable`\<`AccessKnownJsonValue`\>; `door_thumbnail`: `string`; `door_thumbnail_last_update`: `number`; `hub_id`: `string`; \}[] |

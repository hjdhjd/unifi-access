[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessUserRoleConfigInterface

# Interface: AccessUserRoleConfigInterface

A description of a UniFi Access user role JSON, the named privilege level assigned to a user. `level` orders roles against each other, and `system_role` marks the
roles the controller ships rather than ones an administrator created.

## Indexable

```ts
[key: string]: AccessKnownJsonValue
```

## Properties

| Property | Type |
| ------ | ------ |
| <a id="create_time"></a> `create_time` | `string` |
| <a id="is_private"></a> `is_private` | `boolean` |
| <a id="level"></a> `level` | `number` |
| <a id="name"></a> `name` | `string` |
| <a id="system_key"></a> `system_key` | `string` |
| <a id="system_role"></a> `system_role` | `boolean` |
| <a id="unique_id"></a> `unique_id` | `string` |
| <a id="update_time"></a> `update_time` | `string` |

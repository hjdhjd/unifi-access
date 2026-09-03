[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessOfficialAccessPolicyUpdate

# Interface: AccessOfficialAccessPolicyUpdate

Update an access policy. Every member is optional - the endpoint is a partial update, and an omitted member is left as it stands.

## Properties

| Property | Type |
| ------ | ------ |
| <a id="name"></a> `name?` | `string` |
| <a id="resource"></a> `resource?` | readonly [`AccessOfficialAccessPolicyResourceRef`](AccessOfficialAccessPolicyResourceRef.md)[] |
| <a id="schedule_id"></a> `schedule_id?` | `string` |

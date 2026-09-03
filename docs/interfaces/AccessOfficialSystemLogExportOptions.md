[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessOfficialSystemLogExportOptions

# Interface: AccessOfficialSystemLogExportOptions

Export the system log as CSV. The window between `since` and `until` cannot exceed one month, and `timezone` is an IANA zone name such as `America/New_York`.

## Properties

| Property | Type |
| ------ | ------ |
| <a id="actor_id"></a> `actor_id?` | `string` |
| <a id="since"></a> `since` | `number` |
| <a id="timezone"></a> `timezone` | `string` |
| <a id="topic"></a> `topic` | [`AccessOfficialSystemLogTopic`](../type-aliases/AccessOfficialSystemLogTopic.md) |
| <a id="until"></a> `until` | `number` |

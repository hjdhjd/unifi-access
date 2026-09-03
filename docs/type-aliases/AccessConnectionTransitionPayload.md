[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessConnectionTransitionPayload

# Type Alias: AccessConnectionTransitionPayload

```ts
type AccessConnectionTransitionPayload = ConnectionTransition & {
  host: string;
};
```

Payload published on the `unifi-access:connection:transition` channel. Composed from the monitor's own transition type plus the controller this client
addresses, so a change to what a connection state can be cannot drift this payload away from it - the same reason the request payloads compose from their shared
fields rather than restating them.

## Type Declaration

| Name | Type |
| ------ | ------ |
| `host` | `string` |

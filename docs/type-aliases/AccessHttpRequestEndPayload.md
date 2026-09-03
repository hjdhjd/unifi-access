[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessHttpRequestEndPayload

# Type Alias: AccessHttpRequestEndPayload

```ts
type AccessHttpRequestEndPayload = AccessHttpRequestCommon & {
  durationMs: number;
  host: string;
} & AccessHttpRequestEndOutcome;
```

Payload published on [channels.httpRequestEnd](../variables/channels.md#property-httprequestend). Composed from the shared request fields, the measured duration and host, and the outcome union, so each
piece is defined once. `durationMs` spans dispatch to settle and is measured on the transport's own injected clock.

## Type Declaration

| Name | Type |
| ------ | ------ |
| `durationMs` | `number` |
| `host` | `string` |

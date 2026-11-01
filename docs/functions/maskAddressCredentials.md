[**unifi-access**](../README.md)

***

[Home](../README.md) / maskAddressCredentials

# Function: maskAddressCredentials()

```ts
function maskAddressCredentials(address): string;
```

Mask the credentials a controller address can carry, for a message or a log line that names the address: everything through its last `@` becomes `***@`, and an
address carrying no `@` is returned unchanged. Each refusal that names the address quotes it through this mask, and a consumer naming the address in its own log
applies the same rule.

The mask reads the text rather than a parse, because a parse misreads a scheme-prefixed address: `https://user:pass@10.0.0.1` parses as the host `https` with the
credentials in its path, where a mask over the parsed user and password finds nothing to hide. Masking through the last `@` can hide more than credentials, a host
and a path standing before it among them, and hiding too much is the safe direction.

## Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `address` | `string` | The controller address as configured. |

## Returns

`string`

The address with everything through its last `@` masked as `***@`, or the address unchanged when it carries no `@`.

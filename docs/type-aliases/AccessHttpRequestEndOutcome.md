[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessHttpRequestEndOutcome

# Type Alias: AccessHttpRequestEndOutcome

```ts
type AccessHttpRequestEndOutcome = 
  | {
  error: string;
  outcome: "failure";
}
  | {
  outcome: "response";
  statusCode: number;
};
```

How a request finished, as the two outcomes a dispatch can actually have. A response arrived and carries its status, or the request failed at the transport level
and carries the classified error's message with no status at all, because none was ever received. As a union rather than a pair of optional fields, reading a
status code requires narrowing to the arm that has one, so a consumer cannot read a status from a failure that never had one.

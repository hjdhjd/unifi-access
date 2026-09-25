[**unifi-access**](../README.md)

***

[Home](../README.md) / ACCESS\_API\_RETRY\_PROFILE

# Variable: ACCESS\_API\_RETRY\_PROFILE

```ts
const ACCESS_API_RETRY_PROFILE: {
  maxRetries: 5;
  maxTimeout: 1500;
  methods: readonly ["DELETE", "GET", "HEAD", "OPTIONS", "POST", "PUT"];
  minTimeout: 100;
  statusCodes: readonly [400, 404, 429, 500, 502, 503, 504];
  timeoutFactor: 2;
};
```

## Type Declaration

| Name | Type | Default value |
| ------ | ------ | ------ |
| <a id="property-maxretries"></a> `maxRetries` | `5` | `5` |
| <a id="property-maxtimeout"></a> `maxTimeout` | `1500` | `1500` |
| <a id="property-methods"></a> `methods` | readonly \[`"DELETE"`, `"GET"`, `"HEAD"`, `"OPTIONS"`, `"POST"`, `"PUT"`\] | - |
| <a id="property-mintimeout"></a> `minTimeout` | `100` | `100` |
| <a id="property-statuscodes"></a> `statusCodes` | readonly \[`400`, `404`, `429`, `500`, `502`, `503`, `504`\] | - |
| <a id="property-timeoutfactor"></a> `timeoutFactor` | `2` | `2` |

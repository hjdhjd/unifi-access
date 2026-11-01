[**unifi-access**](../README.md)

***

[Home](../README.md) / ACCESS\_OFFICIAL\_API\_PORT

# Variable: ACCESS\_OFFICIAL\_API\_PORT

```ts
const ACCESS_OFFICIAL_API_PORT: 12445 = 12445;
```

The dedicated TCP port the controller serves the official API on. It is not reachable through the UniFi OS proxy that fronts the Access application - a request
for the official path below that proxy is refused before it reaches the API at all - so the port is what makes the official surface addressable, and every
official URL is built from it rather than from the controller's default HTTPS port.

[**unifi-access**](../README.md)

***

[Home](../README.md) / ACCESS\_API\_PATH\_PREFIX

# Variable: ACCESS\_API\_PATH\_PREFIX

```ts
const ACCESS_API_PATH_PREFIX: "/proxy/access/api/v2" = "/proxy/access/api/v2";
```

The path prefix every Access application endpoint hangs off, below the UniFi OS proxy that fronts it. It lives here as one constant rather than being re-spelled
at each endpoint builder because it is the one part of every Access URL that is neither the host nor the resource: a controller that moved its application behind
a different proxy path would be a single edit here, and a typo in it cannot reach only some endpoints. The UniFi OS endpoints the login and privilege checks use
are deliberately not built from it - they belong to the operating system rather than to Access, and they sit at their own root.

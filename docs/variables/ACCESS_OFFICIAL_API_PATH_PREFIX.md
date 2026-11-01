[**unifi-access**](../README.md)

***

[Home](../README.md) / ACCESS\_OFFICIAL\_API\_PATH\_PREFIX

# Variable: ACCESS\_OFFICIAL\_API\_PATH\_PREFIX

```ts
const ACCESS_OFFICIAL_API_PATH_PREFIX: "/api/v1/developer" = "/api/v1/developer";
```

The path prefix every official-API endpoint hangs off. The official API is a separate application from the Access application [ACCESS\_API\_PATH\_PREFIX](ACCESS_API_PATH_PREFIX.md)
addresses: it answers on its own port, speaks its own result envelope, and authenticates with a bearer token rather than a session cookie, so its address is a second
constant rather than a variation on that one. The notification socket upgrades under this same prefix, so the REST endpoints and the socket share this one constant.

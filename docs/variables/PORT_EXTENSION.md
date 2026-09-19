[**unifi-access**](../README.md)

***

[Home](../README.md) / PORT\_EXTENSION

# Variable: PORT\_EXTENSION

```ts
const PORT_EXTENSION: "port_setting" = "port_setting";
```

The extension a hub binds one of its ports through. A hub records which door each of its ports serves under this name, with the door identity as the extension's
target and the port's own configuration - the terminal catalog's duty selector among it - in the entries beside it.

It is published so that a consumer holding a raw device record can select on the same name this module does, rather than spelling the wire's string itself.

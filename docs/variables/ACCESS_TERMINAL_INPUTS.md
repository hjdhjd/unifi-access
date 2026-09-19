[**unifi-access**](../README.md)

***

[Home](../README.md) / ACCESS\_TERMINAL\_INPUTS

# Variable: ACCESS\_TERMINAL\_INPUTS

```ts
const ACCESS_TERMINAL_INPUTS: readonly ["dps", "rel", "ren", "rex", "sideDps"];
```

Every terminal a hub reports about: `dps` the door position sensor, `rel` the remote release, `ren` the request to enter, `rex` the request to exit, and
`sideDps` the position sensor of the side door a UA Hub or a UA Gate drives.

The names are this library's own rather than the wire's. The controller spells one terminal differently on each hardware family - a UA Hub's position input is
`input_state_dps` where a UA Hub Door Mini's is `input_d1_dps` - so a vocabulary keyed on wire spellings would hand every consumer the same per-model table this
module exists to own. A consumer iterating the terminals a hub can report reads this list rather than restating it.

[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessActorType

# Type Alias: AccessActorType

```ts
type AccessActorType = 
  | "open_api"
  | "user"
  | string & {
};
```

Who or what an action is attributed to.

Two members are named because the controller uses them to draw the one distinction a consumer most often cares about: `user` is a human operating the controller
or one of its readers, and `open_api` is a caller acting through the official API. An unlock's actor is what tells those apart, which is what makes attributed
unlocking worth anything - a log that reads as the automation that acted rather than as the account it authenticated with.

The vocabulary is open beyond those because no source enumerates it. A closed union would be a claim about what else the controller can attribute an action to,
where this is a description of the values that have been seen and typed.

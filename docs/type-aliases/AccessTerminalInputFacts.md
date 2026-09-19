[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessTerminalInputFacts

# Type Alias: AccessTerminalInputFacts

```ts
type AccessTerminalInputFacts = 
  | {
  state?: boolean;
  wired: true;
}
  | {
  wired: false;
}
  | {
  wired?: undefined;
};
```

What a terminal read established, shaped so that the coupling rules between its members cannot be violated.

The three arms are the three honest outcomes rather than one shape with optional members. A terminal in service carries its reading wherever one is readable; a
terminal the hardware reports nothing wired to says exactly that and carries no reading, because a floating input's row is a value nothing has qualified; and a
terminal nothing has said anything about makes no claim in either direction, which is a different statement from reporting it unwired. `wired` means in service:
a live circuit detected on the terminal's own wiring pair, or, on hardware that detects no circuits, the port's duty selector naming this terminal as the one
that input is assigned to. The third arm is the empty object, typed with an optional-undefined member so that a consumer reads `facts.wired` as a three-way
value and narrows on it.

A member whose evidence is absent is ABSENT from the object rather than present and `undefined`. The project's compiler settings do not police explicit
`undefined`, so this is a rule the tests enforce with `Object.hasOwn` rather than one the type system can hold.

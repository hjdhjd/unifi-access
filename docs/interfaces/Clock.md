[**unifi-access**](../README.md)

***

[Home](../README.md) / Clock

# Interface: Clock

Source of time for any code that needs to know "what time is it now?", "wake me up after a delay," or "call me back once the time is up." Production code reads
time exclusively through this interface, never through `Date.now()`, `node:timers/promises`, or the global `setTimeout` directly. Tests substitute a fake clock
to drive time deterministically without real-time waits or module-level mocking.

The interface is shaped by what consumers actually need - a clock, a one-shot delay, and a one-shot callback timer (`now` / `delay` / `schedule`), no more. Adding
methods speculatively (setImmediate, a repeating timer, etc.) would be YAGNI; adding them when a consumer first needs one is principled, and each member here
answers a consumer. `now` serves the throttle breaker's cooldown and the elapsed time a failed request reports, readings a suite steps rather than waits for.
`delay` serves the connection-recovery backoff curve, which needs a one-shot wait of varying duration. `schedule` serves the transport's request deadline, which
`armDeadline` arms on it, so a suite fires the deadline rather than waiting it out and a request releases its timer the moment it settles. A repeating consumer -
the heartbeat watchdog, the refresh failsafe - is itself a loop that awaits one `delay` per pass, so that single primitive covers a varying sequence and a fixed
cadence alike. The consumers are every subsystem that needs wall-clock time, a delay, or a deadline - the transport throttle breaker and the request deadline
beside it, the events heartbeat watchdog, the store refresh loop, and the connection recovery loop among them.

Why dependency injection here rather than module mocking: time is a real dependency the code reads from, not an incidental detail of the runtime. Naming
it as a parameter at the function (or constructor) signature makes the dependency visible at the call site - a reader sees `clock: Clock` and immediately
knows the function reads time. With ambient `Date.now()`, the same reader has to scan the function body to discover the dependency. Surfacing implicit
dependencies is the architectural property that makes the rest of the testing story trivial.

## Methods

### delay()

```ts
delay(ms, init): Promise<void>;
```

Resolves once, after `ms` milliseconds, unless the abort signal fires first. Mirrors `setTimeout` from `node:timers/promises` but takes only the parameters
we actually use - the value parameter and the optional `ref` flag are omitted because no consumer needs them.

The signal is required rather than optional because every consumer here waits inside a lifecycle that disposal has to be able to end: a loop that forgot
cancellation would hold its subsystem open past teardown, and requiring the signal makes that shape unwritable. The returned promise rejects with an
`AbortError` if the signal aborts before the delay elapses, matching `setTimeout` from `node:timers/promises`, so a consumer's loop ends cleanly on disposal.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `ms` | `number` | Delay before the promise resolves, in milliseconds. |
| `init` | \{ `signal`: `AbortSignal`; \} | Includes the abort signal that cancels the delay. |
| `init.signal` | `AbortSignal` | - |

#### Returns

`Promise`\<`void`\>

A promise that resolves after the delay, or rejects with `AbortError` on abort.

***

### now()

```ts
now(): number;
```

Returns the current wall-clock time in milliseconds since the Unix epoch. The semantic matches `Date.now()`.

#### Returns

`number`

***

### schedule()

```ts
schedule(
   callback, 
   ms, 
   init?
): Disposable;
```

Runs `callback` once, after `ms` milliseconds. The production clock arms it on the global `setTimeout`, read at call time rather than bound when the module
loads, so a harness that replaces the global observes the timer.

With `init.unref` set the timer never holds the process open, so a process whose only pending work is a timer armed this way exits without waiting for it.
Omitted, the platform's default holds: the timer keeps the process alive until it fires or is disposed. Set or omitted, the timer comes due at the same moment,
so the flag decides only whether the process waits for it.

The timer is one-shot only. Every repeating consumer here is a loop that awaits one `delay` per pass, and what needs a callback timer is the deadline
`armDeadline` arms, which fires once, so a repeating arm would add surface no consumer calls.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `callback` | () => `void` | The function to run when the timer fires. |
| `ms` | `number` | The timer's window, in milliseconds. |
| `init?` | \{ `unref?`: `boolean`; \} | Optional init options. `unref` arms a timer that does not hold the process open. |
| `init.unref?` | `boolean` | - |

#### Returns

`Disposable`

A handle whose `[Symbol.dispose]` cancels the timer. Disposing it before it fires means the callback never runs; disposing it after it fired, or a
second time, does nothing.

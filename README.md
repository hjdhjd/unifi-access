<SPAN ALIGN="CENTER" STYLE="text-align:center">
<DIV ALIGN="CENTER" STYLE="text-align:center">

[![unifi-access: UniFi Access API](https://raw.githubusercontent.com/hjdhjd/unifi-access/main/unifi-access.svg)](https://github.com/hjdhjd/unifi-access)

# UniFi Access API

[![Downloads](https://img.shields.io/npm/dt/unifi-access?color=%230559C9&logo=icloud&logoColor=%23FFFFFF&style=for-the-badge)](https://www.npmjs.com/package/unifi-access)
[![Version](https://img.shields.io/npm/v/unifi-access?color=%230559C9&label=UniFi%20Access%20API&logo=ubiquiti&logoColor=%23FFFFFF&style=for-the-badge)](https://www.npmjs.com/package/unifi-access)

## A modern TypeScript implementation of the UniFi Access API.
</DIV>
</SPAN>

`unifi-access` is a TypeScript library that connects to and communicates with the Ubiquiti UniFi Access API and ecosystem. [UniFi Access](https://ui.com/door-access) is [Ubiquiti's](https://www.ui.com) enterprise and small business solution for door access, with a range of controller hardware, locks, readers, and intercoms to choose from, as well as an app you can use to view, configure, and manage your setup.

It is ESM-only, Node 22.20+, and built around a single idea: the controller's state is a reducer over a typed realtime notification stream, with a periodic re-bootstrap as a permanent failsafe. You connect once, then read live device projections, observe state as it changes, subscribe to a typed event firehose, and command doors, all with typed errors and `await using` resource cleanup.

## Installation

To use this library in Node, install it from the command line:

```sh
npm install unifi-access
```

## Getting started

`AccessClient.connect()` is the one entry point. It logs in, fetches the controller's documents, seeds the state model, opens the realtime notification channel, and returns a fully-ready client, or it throws a typed error. There is no half-constructed client to clean up on failure, and the client is an `AsyncDisposable`, so `await using` tears everything down at scope exit.

```ts
import { AccessClient } from "unifi-access";

await using client = await AccessClient.connect({ host: "192.168.1.1", password: "password", username: "access-user" });

console.log("Connected to", client.controllerName, "with", client.devices.length, "devices.");

// Devices are live projections over the current state. Hold one for hours; its getters always reflect the latest state.
for(const device of client.devices) {

  console.log(device.name, device.isOnline ? "online" : "offline");
}

// Hubs drive doors, so the door commands live on them. Each port of a multi-door Enterprise Access Hub is its own hub handle.
await client.hubs[0]?.unlock();
```

A client connects with credentials, a token, or both. Credentials reach the Access application's own endpoints, which is where the topology and the realtime notification stream come from. A token reaches the published developer API, exposed complete at `client.official` with a typed method for every documented endpoint, and seeds the same state model from that API's own device and door listings. So the device and door projections answer in every mode, each carrying what that mode's census established. Supplying both is the fullest client: door commands route official-first, and `client.capabilities` says what the connection established.

```ts
// The published developer API alone: the devices and doors it lists are seeded into the same state model, with users, visitors, logs, webhooks, and door control through client.official.
await using tokenClient = await AccessClient.connect({ host: "192.168.1.1", token: "access-api-token" });

// Both identities: the full topology and realtime stream, plus the official surface, with each command taking whichever path serves it best.
await using dualClient = await AccessClient.connect({ host: "192.168.1.1", password: "password", token: "access-api-token", username: "access-user" });
```

When the scope exits, including on a thrown error, `await using` closes the notification stream, stops the refresh failsafe, ends the session, and destroys the connection pool. There is no `.stop()` to forget.

## The realtime firehose

`client.events()` is an async iterable of every typed event the controller emits, ending cleanly when its signal aborts. Each event has already been folded into the state model by the time it reaches you, so reading `client.state` inside the loop sees the post-event state:

```ts
for await (const event of client.events({ signal })) {

  switch(event.kind) {

    case "doorbellRing":     onRing(event.id); break;
    case "unlock":           onUnlock(event.id); break;
    case "doorStateChanged": onDoorStates(event.states); break;
  }
}
```

`client.rawPackets()` is the same stream before classification: every well-formed frame the controller sent, including the notifications the library does not model. It is the surface for exploring and capturing the wire protocol.

To track a slice of state instead of the firehose, observe a selector. `client.state.observe(selector)` yields the selector's output only when it changes:

```ts
import { selectDoorStates } from "unifi-access";

for await (const doorStates of client.state.observe(selectDoorStates, { signal })) {

  console.log(doorStates.size, "doors have reported their state.");
}
```

## Typed errors: recoverable versus fatal

Every failure is a typed `AccessError`, classified by the only universal question, which is whether the caller can retry. Catch the abstract base for policy, the concrete class for specifics.

```ts
import { AccessAuthorizationError, RecoverableError } from "unifi-access";

try {

  await client.hub(id)?.unlock({ signal });
} catch(error) {

  if(error instanceof AccessAuthorizationError) {

    return;                  // The account lacks the rights this command requires; not retryable.
  }

  if(error instanceof RecoverableError) {

    return deferAndRetry();  // Throttle, timeout, network, abort, stall: defer and retry.
  }

  throw error;
}
```

`RecoverableError` (throttle, timeout, network, abort, stall) means "you may retry or defer"; `FatalError` (auth, authorization, request, protocol, bootstrap) means "propagate". Connection health, including throttling, controller reboots, and automatic recovery after an outage, is observable on `client.connection`.

## The ufa command-line client

Installing the package installs `ufa`, a command-line client for the controller. It is the library's reference consumer: every command reaches the controller through the public API surface and nothing else.

```sh
ufa info                                      # the controller's own configuration
ufa info doors                                # every door in the topology
ufa bootstrap --json | jq .                   # the whole topology document, as the controller sent it
ufa watch events --ring                       # stream doorbell rings as they happen
ufa watch events --json                       # the notification firehose, as NDJSON for capture
ufa door unlock "Loading Dock"                # unlock a door
ufa door unlock "Loading Dock" --duration 30m # hold it unlocked for thirty minutes
ufa device restart all                        # restart every connected device
ufa device state                              # what the controller reports about every device
ufa doctor                                    # health-check every subsystem against the controller
```

`ufa` reads its credentials from `./ufa.json` in the working directory, then `~/.ufa.json`, taking the first that exists. Any of the identities works - the credential pair, the token, or both - and the CLI connects in whatever mode the file provides:

```json
{
  "controller": "192.168.1.1",
  "username": "access-user",
  "password": "password",
  "tokens": {
    "access": "access-api-token"
  },
  "verifyTls": false
}
```

`tokens` is keyed by the UniFi application a token was issued for, so a token for a sibling application sits beside the Access one without the file changing shape. `verifyTls` asks for strict TLS certificate verification, and defaults to `false` because controllers ship self-signed certificates that no verification chain accepts - turn it on where a trusted certificate has been installed on the controller.

Run `ufa --help` for the full command list, or `ufa <command> --help` for one command's options. `ufa doctor` is the quickest "is my install healthy?" probe, `ufa watch events` carries a filter grammar rich enough to follow one door, one device type, or one event name through the firehose, and `ufa api` reaches any official endpoint, documented or not.

## Documentation

- **[API reference](https://github.com/hjdhjd/unifi-access/blob/main/docs/README.md)**: the complete rendered API documentation, covering every class, function, type, and variable in the public surface.
- **[Diagnostics channels](https://github.com/hjdhjd/unifi-access/blob/main/docs/variables/channels.md)**: the `node:diagnostics_channel` observability surface, with every named channel and its payload shape.
- **[Changelog](https://github.com/hjdhjd/unifi-access/blob/main/docs/Changelog.md)**: changes and release history of this library.

The [`ufa` CLI source](https://github.com/hjdhjd/unifi-access/tree/main/src/util/cli) is worth reading alongside the reference: it exercises the API surface against real hardware using the exact idioms above, with `await using`, an `AbortSignal` for Ctrl-C, typed errors, and async iteration.

## Breaking changes in 2.0.0

The 2.0.0 API is a clean-slate design and is not source-compatible with the 1.x surface. The [2.0.0 changelog entry](https://github.com/hjdhjd/unifi-access/blob/main/docs/Changelog.md) enumerates every breaking change and what to use instead. It is the single home for that detail, so nothing here restates it.

## The direct and the published Access APIs

Ubiquiti publishes an official API for UniFi Access, and the native interface the Access app itself speaks is broader. This library implements both. The direct API is where realtime notifications and the full topology come from; the official API is the published, token-authenticated surface, implemented as a reference with a typed method for every documented endpoint plus webhook payload types and signature verification, and its device and door listings are what a token-only client's live projections are built from. A client connects with credentials, a token, or both, says what it can do at `client.capabilities`, and routes door commands official-first, with the `api` connect option holding a channel fixed when you need one.

## Why use this library for UniFi Access support?

In short, because I use it every day to support a [Homebridge](https://homebridge.io) plugin named [homebridge-unifi-access](https://www.npmjs.com/package/homebridge-unifi-access) that I maintain. I package the core API library separately from the plugin so that other open source projects can take advantage of the work that has been done here to understand and decode the UniFi Access API.

The UniFi Access API is largely undocumented, and implementing a library like this one is the result of many hours of trial and error as well as community support.

### How you can contribute and make this library even better

I welcome inputs and perspective, particularly around hardware I cannot test against directly. Gate hubs are the notable case: their behavior is implemented from field reports rather than from captures, and it is marked as such wherever it is asserted.

## The UniFi Access realtime notifications API

Access publishes a realtime notification stream over a websocket, and it is the backbone of this library's state model. The library consumes it for you - `client.events()` and `client.rawPackets()` - but the protocol itself is worth documenting for anyone exploring the wire.

Connect to `wss://<controller>/proxy/access/api/v2/ws/notification` with your session cookie, or to the official API's notification endpoint on its dedicated port with a bearer token - both sockets carry the same stream, byte for byte. Unlike UniFi Protect's binary framing, Access speaks plain JSON text frames, with a heartbeat frame (the JSON encoding of the string `Hello`, followed by a newline) on a roughly five-second cadence.

Each notification is a JSON envelope: `event` (the notification's name), `event_object_id`, `receiver_id`, `save_to_history`, `data` (the payload, which is `null` on deletion events), and on some events a `meta` member. Two dialects share the socket. The legacy names (`access.data.device.update` and friends) identify the entity through `event_object_id` and carry full records. The `access.data.v2.*` names identify the entity through `meta.id` - their `event_object_id` is a per-notification UUID - and carry sparse partial records with a renamed field vocabulary. This library reconciles both dialects into one typed event model; a consumer reading raw frames must account for both.

The easiest way to explore is capture: `ufa watch raw` streams every frame verbatim as NDJSON, and `ufa classify` runs captured frames back through the library's own classifier offline.

### Non-Ubiquiti apps using the Access API

This work is the result of many hours of reverse engineering and community support. If you use this API documentation or the library in your own project, I ask that you credit this repository - it helps the next person find the canonical source.

## Library Development Dashboard
This is mostly of interest to the true developer nerds amongst us.

[![License](https://img.shields.io/npm/l/unifi-access?color=%230559C9&logo=open%20source%20initiative&logoColor=%23FFFFFF&style=for-the-badge)](https://github.com/hjdhjd/unifi-access/blob/main/LICENSE.md)
[![Build Status](https://img.shields.io/github/actions/workflow/status/hjdhjd/unifi-access/ci.yml?branch=main&color=%230559C9&logo=github-actions&logoColor=%23FFFFFF&style=for-the-badge)](https://github.com/hjdhjd/unifi-access/actions?query=workflow%3A%22Continuous+Integration%22)
[![Dependencies](https://img.shields.io/librariesio/release/npm/unifi-access?color=%230559C9&logo=dependabot&style=for-the-badge)](https://libraries.io/npm/uniti-access)
[![GitHub commits since latest release (by SemVer)](https://img.shields.io/github/commits-since/hjdhjd/unifi-access/latest?color=%230559C9&logo=github&sort=semver&style=for-the-badge)](https://github.com/hjdhjd/unifi-access/commits/main)

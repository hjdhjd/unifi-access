<SPAN ALIGN="CENTER" STYLE="text-align:center">
<DIV ALIGN="CENTER" STYLE="text-align:center">

[![unifi-access: UniFi Access API](https://raw.githubusercontent.com/hjdhjd/unifi-access/main/unifi-access.svg)](https://github.com/hjdhjd/unifi-access)

# UniFi Access API

[![Downloads](https://img.shields.io/npm/dt/unifi-access?color=%230559C9&logo=icloud&logoColor=%23FFFFFF&style=for-the-badge)](https://www.npmjs.com/package/unifi-access)
[![Version](https://img.shields.io/npm/v/unifi-access?color=%230559C9&label=UniFi%20Access%20API&logo=ubiquiti&logoColor=%23FFFFFF&style=for-the-badge)](https://www.npmjs.com/package/unifi-access)

## A complete UniFi Access API implementation.
</DIV>
</SPAN>

`unifi-access` is a TypeScript library for the Ubiquiti [UniFi Access](https://ui.com/door-access) door access platform, implementing both of the controller's API surfaces: the native interface the Access application itself speaks, and the published developer API as a complete typed reference.

The library is built around a single model: the controller's state is a reducer over a typed realtime notification stream, with a periodic re-bootstrap as a permanent failsafe. `AccessClient.connect()` returns a fully-ready client or throws a typed error, devices are live projections whose getters always reflect the current state, every failure is a typed `AccessError`, and every long-lived resource is an `AsyncDisposable` that `await using` tears down at scope exit.

A client connects with credentials, a token, or both. Credentials reach the native surface - the topology and the realtime firehose. A token reaches the official developer API at `client.official`, with a typed method for every documented endpoint, webhook payload types with signature verification, and door control, and its device and door listings seed the same state model. So the device projections answer in either mode, carrying what that mode's census established. With both, door commands route official-first and `client.capabilities` says what the connection established.

The package also installs `ufa`, a command-line client that is the library's reference consumer by construction: every command reaches the controller through the public API surface and nothing else.

A consumer's own test suite has an entry of its own, `unifi-access/testing`: the webhook signing helper that mints a `Signature` header exactly as the controller does, so a suite can hand its receiver a delivery that verifies without restating the scheme. Nothing on the main surface reaches it, and nothing in production should.

## Why use this library for UniFi Access support?

In short, because I use it every day to support a [Homebridge](https://homebridge.io) plugin named [homebridge-unifi-access](https://www.npmjs.com/package/homebridge-unifi-access) that I maintain. I package the core API library separately from the plugin so that other open source projects can take advantage of the work that has been done here to understand and decode the UniFi Access API.

The native UniFi Access API is largely undocumented, and implementing a library like this one is the result of many hours of trial and error as well as community support.

### <A NAME="access-contribute"></A>How you can contribute and make this library even better

I welcome inputs and perspective, particularly around hardware I cannot test against directly. Gate hubs are the notable case: their behavior is implemented from field reports rather than from captures, and it is marked as such wherever it is asserted.

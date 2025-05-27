**unifi-access**

***

<SPAN ALIGN="CENTER" STYLE="text-align:center">
<DIV ALIGN="CENTER" STYLE="text-align:center">

[![unifi-access: UniFi Access API](https://raw.githubusercontent.com/hjdhjd/unifi-access/main/unifi-access.svg)](https://github.com/hjdhjd/unifi-access)

# UniFi Access API

[![Downloads](https://img.shields.io/npm/dt/unifi-access?color=%230559C9&logo=icloud&logoColor=%23FFFFFF&style=for-the-badge)](https://www.npmjs.com/package/unifi-access)
[![Version](https://img.shields.io/npm/v/unifi-access?color=%230559C9&label=UniFi%20Access%20API&logo=ubiquiti&logoColor=%23FFFFFF&style=for-the-badge)](https://www.npmjs.com/package/unifi-access)

## A complete UniFi Access API implementation.
</DIV>
</SPAN>

`unifi-access` is a library that enabled you to connect to and communicate with the Ubiquiti UniFi Access native API and ecosystem. [UniFi Access](https://www.ui.com/door-access) is [Ubiquiti's](https://www.ui.com) enterprise and small business solution for door access with a variety of controller hardware options, locks, and readers for you to choose from, as well as an app which you can use to manage door security.

## Why use this library for UniFi Access support?
In short - because I use it every day to support a popular [Homebridge](https://homebridge.io) plugin named [homebridge-unifi-access](https://www.npmjs.com/package/homebridge-unifi-access) that I maintain.

Ubiquiti has made a public UniFi Access API available and suitable for end users and large-scale integration scenarios, focused almost entirely on authentication integration and the ability to unlock a door. It works, it's supported by Ubiquiti, and if you're looking for an official solution that's where I would point you to. It's also limited in what it can do and constrained to a handful of use cases.

I prefer native API solutions when possible - they can be more feature-rich and there's a fun challenge in solving the puzzle of how it's all put together.

This implementation is unique: it's a true native library for UniFi Access, in much the same vein as my [UniFi Protect](https://www.npmjs.com/package/unifi-protect) library. It will ultimately provide access to the native capabilities of the Access platform well beyond what Ubiquiti officially supports currently. It's well-tested, it is modern, and most importantly, *it just works*. It's quite easy to add support for UniFi Access in your project using this library, and you can rely on the fact that the code is used by a significant population of users out there who ensure its continued robustness.

This implementation is also in its infancy. More capabilities will come with time.

### <A NAME="access-contribute"></A>How you can contribute and make this library even better
This implementation is not yet feature complete. I strive to add support for meaningful features to a broad groups of people in order to avoid any unnecessary cruft and technical debt that may accrue over time.

The native UniFi Access API is undocumented and implementing a library like this one is the result of many hours of trial and error as well as community support.

## Modules

| Module | Description |
| ------ | ------ |
| [access-api](access-api.md) | - |
| [access-logging](access-logging.md) | - |
| [access-types](access-types.md) | - |

/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * index.ts: The internal barrel forwarding every UniFi Access type.
 */

/**
 * A semi-complete description of all the object types used by the UniFi Access API.
 *
 * The UniFi Access API is largely undocumented - these interfaces and types have been gleaned through a lot of experimentation and observation, and typed against
 * captures taken from live controllers. Access is always evolving and I will attempt to keep up with the changes over time.
 *
 * Each wire record has an **Interface** (the full definition with all properties) and a **Config** type alias. For update payloads, consumers use one of the published
 * `...Payload` aliases, each of which makes every member optional and null-admitting to match what a notification actually carries. The wire-record interfaces include
 * `[key: string]: AccessKnownJsonValue` index signatures so that untyped API fields are accessible without casting, while the fully enumerated value shapes they
 * compose stay closed.
 *
 * @module AccessTypes
 */
export type * from "./common.ts";
export type * from "./controller.ts";
export type * from "./device.ts";
export type * from "./events.ts";
export type * from "./settings.ts";
export type * from "./topology.ts";
export type * from "./user.ts";

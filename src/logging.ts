/* Copyright(C) 2017-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * logging.ts: Logging support for the UniFi Access library.
 */

/**
 * Logging interface for this library that you can optionally specify.
 *
 * This interface allows you to leverage your own custom logging capabilities, if you so choose. The library is silent by default, falling back to a no-op logger; to see
 * output you inject your own implementation, specifying the functions to use for the various alert levels the library uses: `debug`, `error`, `info`, and `warn`.
 *
 * @module AccessLogging
 */

/**
 * Logging interface, leveraging what we do for Homebridge and elsewhere as a good template.
 *
 * @remarks The library is silent by default, falling back to a no-op logger. To route output somewhere, inject your own logging functions covering all the alert levels
 * the library uses: `debug`, `error`, `info`, and `warn`.
 */
export interface AccessLogging {

  debug(message: string, ...parameters: unknown[]): void;
  error(message: string, ...parameters: unknown[]): void;
  info(message: string, ...parameters: unknown[]): void;
  warn(message: string, ...parameters: unknown[]): void;
}

/**
 * The default logger every subsystem falls back to when a consumer injects none. It discards every message at every level.
 *
 * A library should be silent by default - emitting to the console uninvited is surprising output a consumer did not ask for. Consumers that want visibility inject
 * their own `AccessLogging` (Homebridge's, Pino, Winston, console). Defaulting to a no-op rather than `console` keeps the library quiet in the embedded case and
 * leaves every consumer in complete control of where the library's output lands, and whether it lands at all.
 *
 * @category Utilities
 */
export const noopLog: AccessLogging = {

  debug: (): void => { /* Intentionally discards the message. */ },
  error: (): void => { /* Intentionally discards the message. */ },
  info: (): void => { /* Intentionally discards the message. */ },
  warn: (): void => { /* Intentionally discards the message. */ }
};

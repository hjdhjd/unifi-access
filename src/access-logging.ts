/* Copyright(C) 2017-2024, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * access-logging.ts: Logging support for the UniFi Access library.
 */

// Logging support, borrowed from Homebridge.
export interface AccessLogging {

  debug(message: string, ...parameters: unknown[]): void;
  error(message: string, ...parameters: unknown[]): void;
  info(message: string, ...parameters: unknown[]): void;
  warn(message: string, ...parameters: unknown[]): void;
}

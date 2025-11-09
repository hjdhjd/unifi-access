/* Copyright(C) 2017-2025, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * settings.ts: Settings and constants for UniFi Access.
 */

// Number of API errors to accept before we backoff so we don't slam an Access controller.
export const ACCESS_API_ERROR_LIMIT = 10;

// Interval, in seconds, to wait before trying to access the API again once we've hit the ACCESS_API_ERROR_LIMIT threshold.
export const ACCESS_API_RETRY_INTERVAL = 300;

// Access API response timeout, in milliseconds. This should never be greater than 5000 ms.
export const ACCESS_API_TIMEOUT = 3500;

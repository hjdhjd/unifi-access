/* Copyright(C) 2017-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * settings.ts: Settings and constants for UniFi Access.
 */

// Number of consecutive API errors to accept before backing off, so a struggling Access controller is never met with a retry storm on top of whatever is already
// wrong with it. The count is consecutive rather than cumulative: a single success clears it, so ordinary isolated failures on a busy controller never accumulate
// their way into the cooldown window below, and only sustained failure - the shape that actually means the controller is unwell - opens it.
export const ACCESS_API_ERROR_LIMIT = 10;

// The path prefix every Access application endpoint hangs off, below the UniFi OS proxy that fronts it. It lives here as one constant rather than being re-spelled
// at each endpoint builder because it is the one part of every Access URL that is neither the host nor the resource: a controller that moved its application behind
// a different proxy path would be a single edit here, and a typo in it cannot reach only some endpoints. The UniFi OS endpoints the login and privilege checks use
// are deliberately not built from it - they belong to the operating system rather than to Access, and they sit at their own root.
export const ACCESS_API_PATH_PREFIX = "/proxy/access/api/v2";

// Interval, in seconds, to wait before reaching for the API again once ACCESS_API_ERROR_LIMIT consecutive errors have accumulated. Five minutes is the compromise
// between the two ways this can go wrong: shorter, and a rebooting or overloaded controller is hammered while it is least able to answer; longer, and a controller
// that has already recovered stays unreachable to the library for no reason. It comfortably exceeds a controller's own restart time, so a single cooldown is
// usually enough for the next attempt to land on a healthy controller.
export const ACCESS_API_RETRY_INTERVAL = 300;

// Access API response timeout, in milliseconds, bounding every request so a wedged connection surfaces as a prompt, typed timeout rather than hanging its caller
// indefinitely. This should never be greater than 5000 ms: a healthy controller answers well inside that window even under load, so a longer deadline buys no
// additional successes and only delays the recovery a timeout is meant to trigger.
export const ACCESS_API_TIMEOUT = 3500;

// Interval, in milliseconds, between the state store's periodic re-fetch of the topology document. The controller's realtime notification channel is occasionally
// lossy, so a library that only ever folded notifications would drift away from the controller with no way back. Re-reading the document on a fixed cadence is the
// failsafe against that, and the library owns the cadence rather than leaving each consumer to schedule its own: the reducer reconciles a refresh that found no
// drift down to the identical state reference, so an unnecessary refresh costs one request and produces no observable change at all. Two minutes is short enough
// that a missed notification is corrected well inside the window anyone would notice a stale door in, and long enough that the polling is negligible beside the
// realtime channel carrying the ordinary case.
export const ACCESS_BOOTSTRAP_REFRESH_INTERVAL = 120000;

// Events WebSocket heartbeat watchdog timeout, in milliseconds. The controller heartbeats its realtime events channel on roughly a five-second cadence, so this
// window tolerates exactly one missed beat before the channel is presumed dead and the socket is torn down for a fresh connection. Sitting at twice the cadence is
// deliberate: a tighter window would trip on ordinary scheduling and network jitter between healthy beats, while a looser one would leave a consumer reading state
// that has silently stopped updating for longer than the reconnect it defers.
export const ACCESS_EVENTS_HEARTBEAT_TIMEOUT = 10000;

// The path prefix every official-API endpoint hangs off. The official API is a separate application from the Access one above: it answers on its own port, speaks
// its own result envelope, and authenticates with a bearer token rather than a session cookie, so its address is a second constant rather than a variation on the
// first. The notification socket upgrades under this same prefix, which is why it lives here rather than beside the REST builders alone.
export const ACCESS_OFFICIAL_API_PATH_PREFIX = "/api/v1/developer";

// The dedicated TCP port the controller serves the official API on. It is not reachable through the UniFi OS proxy that fronts the Access application - a request
// for the official path below that proxy is refused before it reaches the API at all - so the port is what makes the official surface addressable, and every
// official URL is built from it rather than from the controller's default HTTPS port.
export const ACCESS_OFFICIAL_API_PORT = 12445;

/* How far the controller's reported uptime must fall, in seconds, before the drop is read as a restart rather than as noise. The unit matches the uptime field's
 * own.
 *
 * The basis is worth stating plainly, because it is a margin rather than a measurement. Observation of a live controller found the served uptime flat across a
 * twenty-second window and advancing across a day; it never found the value moving backward by any amount. So this floor does not encode an observed skew - it is
 * chosen to sit far above any skew a caching or clock-step mechanism could plausibly produce, and far below the drop a real restart produces, which is the whole of
 * the controller's prior uptime and is measured in days. A false reading would require five minutes of backward movement from a mechanism never seen on this
 * hardware.
 */
export const ACCESS_REBOOT_UPTIME_DROP_MINIMUM = 300;

/* The delays, in milliseconds, before each successive attempt to recover a faulted connection, followed by the steady interval the recovery loop settles onto and
 * polls at for as long as it lives. The leading zero is "probe at once": a fault is most often a momentary drop that the very next attempt resolves, so waiting
 * before the first attempt would add latency to the common case for no benefit. The staged delays that follow back off through the window a controller takes to
 * restart a service, and the floor is where recovery settles for an outage of any length - a controller that returns after an hour is picked up within one
 * interval of returning rather than after a curve that has grown without bound.
 */
export const ACCESS_RECOVERY_BACKOFF_MS = [ 0, 5000, 15000, 30000 ];

// The interval, in milliseconds, the recovery loop polls at once it has walked out its staged delays. One minute is short enough that a returning controller is
// picked up promptly and long enough that polling an absent one indefinitely costs nothing worth measuring.
export const ACCESS_RECOVERY_STEADY_INTERVAL_MS = 60000;

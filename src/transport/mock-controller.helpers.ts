/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * mock-controller.helpers.ts: Test-only factory wiring an undici MockAgent and a fake clock into a Transport, so the transport and auth tests exercise the real
 * request path, throttle breaker, and error classification without a live controller or real-time waits.
 */
import type { AccessIdentityLeg } from "../errors.ts";
import type { AccessLogging } from "../logging.ts";
import type { FakeClock } from "../testing.helpers.ts";
import type { Interceptable } from "undici";
import { MockAgent } from "undici";
import { Transport } from "./http.ts";
import { fakeClock } from "../testing.helpers.ts";

// The bundle a test drives: the agent (for intercept setup and teardown), the interceptable pool bound to the controller origin, the transport under test, the fake
// clock that advances breaker time, and the host string for building request URLs.
export interface MockTransport {

  agent: MockAgent;
  clock: FakeClock;
  host: string;
  pool: Interceptable;
  transport: Transport;
}

// Build a Transport backed by a MockAgent and a fake clock. The optional injections are forwarded only when supplied, so the transport sees an option that was not
// passed as genuinely absent rather than present-and-undefined - which keeps its own `?? default` reads and any membership test on the options object honest.
export function makeMockTransport(options: {
  getAuthHeaders?: () => Record<string, string>;
  host?: string;
  identity?: AccessIdentityLeg;
  log?: AccessLogging;
  onUnauthorized?: () => Promise<boolean>;
} = {}): MockTransport {

  const host = options.host ?? "10.0.0.1";
  const agent = new MockAgent();

  agent.disableNetConnect();

  const clock = fakeClock();
  const transport = new Transport({

    clock,
    dispatcher: agent,
    host,
    ...((options.getAuthHeaders !== undefined) && { getAuthHeaders: options.getAuthHeaders }),
    ...((options.identity !== undefined) && { identity: options.identity }),
    ...((options.log !== undefined) && { log: options.log }),
    ...((options.onUnauthorized !== undefined) && { onUnauthorized: options.onUnauthorized })
  });

  return { agent, clock, host, pool: agent.get("https://" + host), transport };
}

// Build a fully-qualified URL for a path on the mock controller's origin.
export function url(host: string, path: string): string {

  return "https://" + host + path;
}

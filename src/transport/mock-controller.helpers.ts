/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * mock-controller.helpers.ts: Test-only factory wiring an undici MockAgent and a `TestClock` into a Transport, so the transport and auth tests exercise the real
 * request path, throttle breaker, and error classification without a live controller or real-time waits.
 */
import type { AccessIdentityLeg } from "../errors.ts";
import type { AccessLogging } from "../logging.ts";
import type { Interceptable } from "undici";
import { MockAgent } from "undici";
import type { MockInterceptor } from "undici/types/mock-interceptor.js";
import { TestClock } from "homebridge-plugin-utils/testing";
import { Transport } from "./http.ts";

// The bundle a test drives: the agent (for intercept setup and teardown), the interceptable pool bound to the controller origin, the transport under test, the
// `TestClock` that advances breaker time, and the host string for building request URLs.
export interface MockTransport {

  agent: MockAgent;
  clock: TestClock;
  host: string;
  pool: Interceptable;
  transport: Transport;
}

// Build a Transport backed by a MockAgent and a `TestClock`. The optional injections are forwarded only when supplied, so the transport sees an option that was not
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

  const clock = new TestClock();
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

// A reply held open until the test releases it: the callback an interception is registered with, and the call that lets it answer.
export interface HeldReply {

  readonly release: () => void;
  readonly reply: MockInterceptor.MockReplyOptionsCallback;
}

/* A reply the test itself releases. undici resolves an asynchronous reply-options callback before it dispatches the response
 * (node_modules/undici/lib/mock/mock-utils.js:325-330), so a reply released after a point in the test is one that provably lands after that point. Widening a
 * race window that way is deterministic where a wall-clock margin is a guess about the scheduler.
 *
 * A reply that is never released leaves its request pending past any abort and past any deadline, because undici installs a request's abort hook only at
 * dispatch. A site that needs a response to stay open until an abort or the transport's own deadline ends it therefore keeps undici's delayed reply rather than
 * reaching for this one.
 */
export function heldReply(statusCode: number, data: MockInterceptor.MockReplyOptions["data"],
  responseOptions?: MockInterceptor.MockReplyOptions["responseOptions"]): HeldReply {

  const gate = Promise.withResolvers<undefined>();

  return {

    release: (): void => {

      gate.resolve(undefined);
    },

    reply: async (): Promise<MockInterceptor.MockReplyOptions> => {

      await gate.promise;

      // The optional response options are forwarded only when supplied, the same way the transport factory above forwards its own optional injections.
      return { data, ...((responseOptions !== undefined) && { responseOptions }), statusCode };
    }
  };
}

// Build a fully-qualified URL for a path on the mock controller's origin.
export function url(host: string, path: string): string {

  return "https://" + host + path;
}

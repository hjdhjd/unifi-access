/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * refusals.fixtures.ts: The official API's refusal of a token, captured from a live controller and embedded verbatim.
 *
 * The capture was taken on 2026-11-17 from a controller reporting UniFi OS 6.0.17 and UniFi Access 4.3.24. Beyond the v1 in the developer API's path, the refusal
 * carries no schema version of its own, so those versions are what a recapture is compared against.
 */
import type { ResultEnvelope } from "../protocol/envelope.ts";

/* One refused official request exactly as the controller answered it: the status, and the body declared against the result envelope so the suite type-checks the
 * envelope model against real wire material rather than against a restatement of itself. Nothing here is tidied: key order and casing are the controller's own.
 *
 * The controller answered this same status and body for an invalid token, for a deleted one, and for a valid token not issued the permission the endpoint requires,
 * so the refusal itself cannot tell a refused token from a missing permission. That is what the token session's door listing exists to settle, and why the result
 * code it carries is reached as the identity error's cause rather than read as the verdict.
 *
 * Captured from a live controller, 2026-11-17.
 */
export const accessOfficialTokenRefusalFixture: { readonly body: ResultEnvelope; readonly statusCode: number } = {

  body: { "code": "CODE_UNAUTHORIZED", "msg": "You do not have permission to perform this action." },
  statusCode: 401
};

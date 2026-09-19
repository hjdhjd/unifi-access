/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * envelope.ts: The controller's result envelope - its two dialects, the guard that admits one, and the reading that yields a payload or a typed refusal.
 */
import { AccessApiError, AccessProtocolError } from "../errors.ts";
import type { AccessApiResponse } from "../types/index.ts";
import { isRecord } from "../json.ts";

/**
 * The single home of what a decoded 2xx body means: whether it is the result envelope the controller answers in, which dialect it is written in, and what verdict
 * it reports.
 *
 * The controller's application writes one envelope on both of its surfaces - the Access application's own endpoints and the published developer API alike - and it
 * reports its refusals *inside* that envelope under a 2xx status. A caller that read the status alone would therefore treat a refused operation as a successful
 * one. Reading the envelope in exactly one place is what makes that impossible: every consumer either receives what the endpoint really answered, or meets a typed
 * error carrying the controller's own code, its message, and its diagnostic.
 *
 * This is protocol-tier material for the same reason the port-binding reads are. The knowledge is about what the wire's values mean, it performs no I/O, and every
 * consumer sits above it: the official API's three request arms, the device tier's command reads, and the client's bootstrap document reads all ask this module the
 * same question and act on the same answer. What each of them does with an envelope that reports success is its own business - one reads a payload, one reads
 * nothing, one takes the document - and none of them decides what success is.
 *
 * Two envelope writers answer and they spell the result code differently, both observed live against one controller. The native dialect carries a numeric `code`
 * with the `CODE_*` vocabulary string beside it in `codeS`, captured on an official refusal on 2026-09-15 and on a direct door-command refusal on 2026-09-16; the
 * documented dialect carries that vocabulary string in `code` itself, captured on three official successes. Which writer answers - whether it follows from the
 * outcome or from the endpoint - is not established, so the union below admits either dialect on either outcome...a reading that is correct whichever way that
 * question turns out to fall.
 */

// The one result code that means the request succeeded. Every other code is the controller declining in its own vocabulary rather than through an HTTP status.
const RESULT_SUCCESS_CODE = "SUCCESS";

/* The dialect the vendor's reference documents. It differs from the native one only in spelling the vocabulary string in `code` itself, so it is declared as
 * exactly that difference: every member the two dialects share has one declaration, on the wire-facing type, and this one says what the documented writer does
 * differently.
 */
interface DocumentedEnvelope extends Pick<AccessApiResponse, "data" | "msg" | "pagination"> {

  code: string;
}

// Either dialect: what the guard admits, and what the reader hands back when the controller reported success.
export type ResultEnvelope = AccessApiResponse | DocumentedEnvelope;

/* Whether a decoded body is the envelope the controller answers in. The presence of `codeS` says which dialect this is, and the code that dialect carries then says
 * which outcome it reports. Admission asks the dialect question exactly the way the reading asks it, so the two can never disagree about which arm a record is in.
 *
 * Both arms are conditioned on that presence rather than offered as alternatives. A numeric `code` alone carries no vocabulary string to classify by and nothing to
 * hand the typed error, and a string `code` beside a `codeS` that is not a string would reach the reading through the documented arm, which would then read a
 * non-string as the code. Neither is an envelope.
 */
function isResultEnvelope(value: unknown): value is ResultEnvelope {

  return isRecord(value) && (("codeS" in value) ? ((typeof value["code"] === "number") && (typeof value["codeS"] === "string")) :
    (typeof value["code"] === "string"));
}

/* What one of the controller's own text members says, or undefined when it says nothing usable. Both the message and the diagnostic are read through here, so the
 * rule that such a member is the controller's words with the wire's padding removed - and is absent when nothing is left - is stated once.
 *
 * The boundary is whitespace at the ends and nothing else. Padding carries nothing a reader could use and a consumer appending its own punctuation to a message
 * that already ends in a space prints the gap; punctuation, casing and the controller's own spelling are its text and stay exactly as sent. Nor is this a
 * wire-truth question: the bytes as delivered stay on the wire types and on the raw packet rail, and what a typed error carries is already a projection - the
 * message channel substitutes a sentence of this library's own where the controller sent none.
 */
function controllerText(value: unknown): string | undefined {

  if(typeof value !== "string") {

    return undefined;
  }

  const text = value.trim();

  return (text.length > 0) ? text : undefined;
}

/**
 * Read a decoded 2xx body as a result envelope, establishing that the controller answered in one and that it did not refuse the request.
 *
 * @param body    - The decoded 2xx response body.
 * @param refusal - The sentence the thrown refusal carries when the controller sent no message of its own, naming the operation so that an unhandled refusal still
 *   says what was refused.
 *
 * @returns The envelope the controller answered with, for the caller to take its payload - or nothing at all - out of.
 *
 * @throws {@link AccessApiError} when the envelope reports a code other than success, carrying the controller's own code, message and diagnostic.
 *   {@link AccessProtocolError} when the body is not a result envelope at all.
 */
export function readResultEnvelope(body: unknown, refusal: string): ResultEnvelope {

  if(!isResultEnvelope(body)) {

    /* The sentence takes no per-caller context, unlike the refusal's. A body that is not an envelope is the wire being violated rather than an operation being
     * refused, and the callers that owe a reader the locus - the bootstrap reads - wrap this in the staged error their own contracts promise.
     */
    throw new AccessProtocolError("The UniFi Access controller answered with a document that is not a result envelope.");
  }

  /* Read the result code out of whichever dialect answered, once, so everything below speaks one vocabulary: the success test and the error construction never have
   * to ask which writer they are reading. The diagnostic travels with the code because both are facts of the same dialect - the native arm carries its own in
   * `error`, and the documented arm has no such member.
   */
  const { code, detail } = ("codeS" in body) ? { code: body.codeS, detail: controllerText(body.error) } : { code: body.code, detail: undefined };

  if(code !== RESULT_SUCCESS_CODE) {

    /* The controller's own message is the error's message. It says what went wrong in the controller's words, which is more use to a caller than anything this
     * layer could compose, and carrying it as the message rather than as a second field is what makes an unhandled refusal read properly in a log. The fallback
     * covers a refusal that arrived without one, so the error still says something, and it names the operation because this module knows nothing else about it.
     */
    const message = controllerText(body.msg) ?? refusal;

    throw new AccessApiError(message, { code, detail });
  }

  return body;
}

/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * dispatch.ts: The official API's single request path - the result envelope read through the protocol tier, the outbound encoding, and the page report carried through.
 */
import type { RequestOptions, Transport } from "../transport/http.ts";
import { AccessProtocolError } from "../errors.ts";
import { isRecord } from "../json.ts";
import { readResultEnvelope } from "../protocol/envelope.ts";

// The content type a JSON answer carries. A binary endpoint answering in it is answering with an envelope rather than with bytes, which is what the download arm
// tests for before it hands a caller anything.
const JSON_CONTENT_TYPE = "application/json";

// What a refusal on this surface says when the controller sent no message of its own. It names the API so that an unhandled refusal still says which one declined.
const OFFICIAL_REFUSAL_FALLBACK = "The UniFi Access controller refused an official API request without explaining why.";

/**
 * The pagination a list endpoint reports beside its results. It sits at the top level of the envelope rather than inside the results, on every paginated endpoint
 * the wire has been observed to answer - including the one the reference documents as nesting it, which it does not.
 */
export interface AccessOfficialPagination {

  readonly page_num: number;
  readonly page_size: number;
  readonly total: number;
}

/**
 * The result of one official request: the payload the endpoint returned, and the pagination beside it when the endpoint paginates.
 *
 * `pagination` is present exactly when the response carried it and structurally absent otherwise, rather than present-and-undefined. A caller can therefore tell a
 * paginated endpoint from an unpaginated one by what it received, and nothing here invents a page count for an endpoint that reported none.
 *
 * @typeParam T - The payload shape the calling endpoint documents.
 */
export interface AccessOfficialResult<T> {

  readonly data: T;
  readonly pagination?: AccessOfficialPagination;
}

/**
 * One part of a multipart upload: the bytes, the form field the endpoint reads them from, and the filename the part is announced under.
 *
 * `filename` is required because every multipart endpoint the API documents takes a named file, and a receiver that reads uploads by filename has nothing to read
 * from a part that omits it. The name belongs to the caller, which read the file and knows what it is called, so no method here invents one.
 *
 * @category Official
 */
export interface AccessOfficialFormPart {

  data: Uint8Array | string;
  field: string;
  filename: string;
}

/**
 * A file a caller hands to a multipart endpoint: its bytes and the name to announce it under.
 *
 * This is the caller's half of {@link AccessOfficialFormPart} - the form field a part is sent under is the endpoint's business, so the method supplies it and the
 * caller supplies only what it actually knows.
 *
 * @category Official
 */
export interface AccessOfficialFileUpload {

  data: Uint8Array | string;
  filename: string;
}

/**
 * Per-request options for an official request: everything the transport accepts, plus the two encodings this layer owns.
 *
 * At most one of `body`, `form`, and `json` may be present. They are three ways of saying what the request carries, so supplying two is a caller defect rather
 * than a wire condition, and it throws a `TypeError` naming the conflict rather than silently letting one win.
 *
 * @category Official
 */
export interface AccessOfficialRequestOptions extends RequestOptions {

  form?: readonly AccessOfficialFormPart[];
  json?: unknown;
}

/**
 * Per-call options accepted by every official domain method, always as the method's last parameter.
 *
 * The payload bags that precede it say what a request tells the controller; this says how the call behaves. Keeping the two apart is what makes it impossible for
 * a per-call concern to reach the wire: no payload type carries these members, so nothing here can leak into a body or a query string.
 *
 * `signal` is the caller's cancellation, composed with the transport's own timeout and classified as the caller's act when it fires.
 *
 * @category Official
 */
export interface AccessOfficialCallOptions {

  signal?: AbortSignal;
}

/**
 * Construction options for {@link OfficialDispatch}. The transport is the only dependency, and it arrives already built: the composition root constructs it
 * against the official address with the token session's closures wired in, which is what keeps this module free of any knowledge of either.
 */
export interface OfficialDispatchOptions {

  transport: Transport;
}

/**
 * Construction options for every official domain class: the shared request path, and the controller address its URLs are built against. A domain holds these two
 * and nothing else, so the set is declared once here rather than re-spelled by each domain module.
 */
export interface OfficialDomainOptions {

  dispatch: OfficialDispatch;
  host: string;
}

/**
 * The one path every official request takes.
 *
 * The official API answers in a uniform envelope - a result code, the payload, a message, and pagination on the endpoints that page - and it reports its refusals
 * *inside* that envelope with a 2xx status. So a caller that read the status alone would treat a refused request as a successful one carrying a payload it never
 * got. The protocol tier's envelope reader is what makes that impossible, and it is the reader the Access application's own endpoints go through as well: every
 * official request resolves to a payload the endpoint really returned, or throws. What this module owns is the three arms, the outbound encoding, and the page
 * report an arm reads beside its results.
 *
 * The outcomes, and where each is decided:
 *
 * - A non-2xx never reaches the envelope at all. It classifies through the transport's own status mapping, so an official 401 or 403 raises the same typed error
 *   an Access-application request would, and there is one HTTP-status vocabulary in the library rather than two.
 * - A 2xx whose code is not success throws {@link AccessApiError}, carrying the controller's own code as a typed field and its message as the error's.
 * - A 2xx whose code is success returns the payload, with pagination beside it when the endpoint sent some.
 *
 * The envelope tolerances are the wire's, not guesses: `msg` arrives truncated on several endpoints, `data` is variously an object, an array, a bare string, or
 * null depending on what the endpoint does, and pagination sits at the top level even where the reference documents it inside the results. Reading one uniform
 * envelope is what lets every endpoint share this path.
 *
 * The class exposes one arm per response shape the API answers in: {@link OfficialDispatch.request} for an endpoint that returns a typed payload,
 * {@link OfficialDispatch.command} for a mutation whose success carries nothing worth reading, and {@link OfficialDispatch.download} for the endpoints that answer
 * raw bytes. Outbound encoding is owned here too, so a caller hands typed values and parts rather than a serialized body.
 */
export class OfficialDispatch {

  readonly #transport: Transport;

  constructor(options: OfficialDispatchOptions) {

    this.#transport = options.transport;
  }

  /**
   * Send an official request and unwrap its result envelope.
   *
   * @typeParam T - The payload shape the endpoint documents. This is the caller's assertion about what the endpoint returns, exactly as it is on the transport's
   *   own JSON decode - the envelope guarantees that a payload arrived, and the endpoint's own documentation is what says which shape it is.
   *
   * @param url  - The fully-qualified official endpoint URL.
   * @param opts - Per-request options, encoded here and threaded to the transport.
   * @param call - The per-call options every domain method forwards, merged into the request options here.
   *
   * @returns The endpoint's payload, and its pagination when it paginates.
   *
   * @throws {@link AccessApiError} when the controller refuses the request in its own vocabulary, {@link AccessProtocolError} when the response is not the
   *   envelope every official endpoint answers in, or the transport's own typed errors for a non-2xx and for every transport-level failure.
   */
  async request<T>(url: string, opts: AccessOfficialRequestOptions = {}, call: AccessOfficialCallOptions = {}): Promise<AccessOfficialResult<T>> {

    // A non-2xx throws here, through the transport's existing status classification, so this method only ever goes on to read an envelope the controller meant as
    // an answer. The JSON decode throws its own protocol error, which is why nothing below re-wraps a parse failure.
    const body = readResultEnvelope((await this.#transport.send(url, await this.#encode(opts, call))).ensureOk().json<unknown>(), OFFICIAL_REFUSAL_FALLBACK);

    /* This arm's contract is a payload of type `T`, so an envelope carrying no `data` member cannot satisfy it: resolving would hand the caller `undefined` under
     * whatever type it asked for, which is the assertion-into-a-lie the typed return exists to prevent. A mutation whose success genuinely carries nothing goes
     * through `command` instead, which never reads the member at all - so this guard costs those endpoints nothing.
     */
    if(!("data" in body)) {

      throw new AccessProtocolError("The UniFi Access controller reported an official API request successful without returning its result.");
    }

    const pagination = asPagination(body.pagination);

    return { data: body.data as T, ...((pagination !== undefined) && { pagination }) };
  }

  /**
   * Send an official mutation whose success carries no payload worth reading.
   *
   * A successful mutation answers in whatever shape the endpoint happens to send - no `data` member, `null`, an empty object, or the literal string `"success"`
   * among the shapes observed - and all of them mean the same thing: the controller accepted the request. So this arm establishes that the envelope reported
   * success and deliberately never reads the member. Refusals classify exactly as they do on the typed read, because a refusal is the same event whatever the
   * caller expected back.
   *
   * @param url  - The fully-qualified official endpoint URL.
   * @param opts - Per-request options, encoded here and threaded to the transport.
   * @param call - The per-call options every domain method forwards, merged into the request options here.
   *
   * @throws {@link AccessApiError} when the controller refuses the request in its own vocabulary, {@link AccessProtocolError} when the response is not the
   *   envelope every official endpoint answers in, or the transport's own typed errors for a non-2xx and for every transport-level failure.
   */
  async command(url: string, opts: AccessOfficialRequestOptions = {}, call: AccessOfficialCallOptions = {}): Promise<void> {

    readResultEnvelope((await this.#transport.send(url, await this.#encode(opts, call))).ensureOk().json<unknown>(), OFFICIAL_REFUSAL_FALLBACK);
  }

  /**
   * Send an official request to an endpoint that answers raw bytes - an image, a CSV export, a static resource.
   *
   * A 2xx alone does not establish that bytes arrived. The API reports its refusals inside a success status on every other endpoint, and nothing suggests the
   * binary ones abandon that convention, so a JSON-typed answer here is read as an envelope rather than handed back as a file: a refusal code throws the typed
   * official error, and a success code throws a protocol error, because a binary endpoint has no JSON success shape to return. A JSON body that is not an envelope
   * at all throws a protocol error too, exactly as the enveloped arms treat the same document. Any other content type is the file, returned verbatim.
   *
   * Documentation-derived: no failing binary call has been captured, so the sniff covers both refusal channels rather than assuming the endpoints use only one.
   *
   * @param url  - The fully-qualified official endpoint URL.
   * @param opts - Per-request options, encoded here and threaded to the transport.
   * @param call - The per-call options every domain method forwards, merged into the request options here.
   *
   * @returns The response body as raw bytes.
   *
   * @throws {@link AccessApiError} when the controller refuses the request in its own vocabulary, {@link AccessProtocolError} when a JSON answer arrives
   *   where bytes were expected, or the transport's own typed errors for a non-2xx and for every transport-level failure.
   */
  async download(url: string, opts: AccessOfficialRequestOptions = {}, call: AccessOfficialCallOptions = {}): Promise<Buffer> {

    const response = (await this.#transport.send(url, await this.#encode(opts, call))).ensureOk();
    const contentType = response.header("content-type");

    if(contentType?.includes(JSON_CONTENT_TYPE)) {

      // A refusal throws from here with the controller's own code, and an unparseable or code-less document throws the decode's own protocol error - so the only
      // way past this call is a success envelope, which is itself wrong on an endpoint that owes the caller bytes.
      readResultEnvelope(response.json<unknown>(), OFFICIAL_REFUSAL_FALLBACK);

      throw new AccessProtocolError("The UniFi Access controller answered an official API request for binary content with a result envelope.");
    }

    return response.body;
  }

  /* Turn the official options into the transport's own, which is where outbound encoding, the retry default, and the per-call merge all live.
   *
   * The retry default is a policy this layer owns rather than the transport: retry-safety is a question about what repeating a request *does*, and only the layer
   * that knows the API knows that. Every POST on this surface applies an effect rather than reading state, so a transparently re-sent one applies it twice; every
   * other verb either reads or re-asserts a state it is already asserting. So POST defaults to no-retry and the rest inherit the pool's profile, with an explicit
   * `retry` from the caller always winning - which is how an endpoint that breaks the verb correlation says so.
   *
   * The per-call options join the transport's options here and nowhere else. Every domain method forwards its own bag verbatim rather than composing a signal into
   * the request options itself, so the mechanism that carries a cancellation from a caller to the transport exists once for the whole surface rather than once per
   * method. The call options win where both channels supply a signal, because they are the more particular statement: the request options belong to the method or
   * the escape hatch that built the request, while the call options belong to the caller of that one call.
   */
  async #encode(opts: AccessOfficialRequestOptions, call: AccessOfficialCallOptions): Promise<RequestOptions> {

    const { form, json, retry, ...rest } = opts;
    const supplied: string[] = [];

    if(rest.body !== undefined) {

      supplied.push("body");
    }

    if(form !== undefined) {

      supplied.push("form");
    }

    if(json !== undefined) {

      supplied.push("json");
    }

    // Two channels describing one request body is a programming error rather than anything the wire did, so it raises the platform's own invalid-argument class:
    // the protocol error hierarchy describes what a controller sent, and using it here would file a caller's mistake as the controller's.
    if(supplied.length > 1) {

      throw new TypeError("An official API request carries at most one of body, form, and json, and this one supplied " + supplied.join(" and ") + ".");
    }

    const resolvedRetry = retry ?? ((rest.method === "POST") ? false : undefined);
    const resolvedSignal = call.signal ?? rest.signal;
    const base: RequestOptions = { ...rest, ...((resolvedRetry !== undefined) && { retry: resolvedRetry }),
      ...((resolvedSignal !== undefined) && { signal: resolvedSignal }) };

    if(json !== undefined) {

      return { ...base, body: JSON.stringify(json) };
    }

    if(form !== undefined) {

      const encoded = await encodeMultipart(form);

      // The boundary reaches the header and the body as one minted value, and the per-call header overrides the transport's JSON stamp through the precedence the
      // transport already applies - so declaring the multipart type takes no transport change and cannot name a boundary the body does not use.
      return { ...base, body: encoded.body, headers: { ...base.headers, "content-type": encoded.contentType } };
    }

    return base;
  }
}

/* Serialize a multipart body from its parts, returning the bytes and the content type that describes them.
 *
 * The platform's own serializer does the framing, and the reason it can be trusted here is that its output is taken as BYTES before anything else sees it. That
 * matters because of a property of the dependency rather than a preference. Every Node process holds two undici implementations: the platform's globals belong to
 * the runtime's own bundled copy, which also pre-registers its dispatcher as the process-wide default, while this package depends on a second, independently
 * versioned one. A form container is admitted by the serializer inside the DISPATCHER's copy only through an `instanceof` check against that copy's own class, so a
 * container built from the other copy passes the duck-typed routing gate, fails the brand check, and yields a body stream that never ends - a silent hang rather
 * than an error. The transport accepts a dispatcher injected by the consumer, from whatever copy the consumer holds, so that coupling is not this library's to
 * guarantee.
 *
 * Serializing EAGERLY is what makes the question moot. The container, the files, and the response all come from one copy, and the serialization completes here,
 * before any dispatcher exists in the flow - so no container ever reaches undici, and the coupling cannot engage. Bytes deliver correctly under every dispatcher.
 * The escaping and framing the platform applies were compared against a hand-assembled body character for character on 2026-08-16 and agree.
 */
async function encodeMultipart(parts: readonly AccessOfficialFormPart[]): Promise<{ body: Uint8Array; contentType: string }> {

  const form = new FormData();

  for(const part of parts) {

    /* The bytes are re-wrapped rather than handed over as they arrived. A caller's own buffer may be backed by any kind of memory - a file read hands back one
     * whose type admits shared memory - while the file constructor accepts a view over ordinary memory alone. Re-wrapping states which of the two this is, and it
     * costs a copy the hand-assembled body was already paying when it concatenated every part into one buffer.
     *
     * Every part announces itself as generic binary rather than as the type its content actually is - a CSV of NFC pairs, a PEM key or certificate, an avatar
     * image. The user-avatar endpoint answers that question for itself: a live upload on 2026-09-18 of a valid PNG announced this way was stored, and the
     * controller answered with the path it filed the image under, so the generic announcement is what that endpoint accepts and the caller's own type is not
     * needed. The residual is per endpoint rather than general...another endpoint could parse its parts differently, and the certificate upload has never been
     * exercised against a controller, so if one refuses a part on its type the fix is to carry the caller's own type here rather than to state one for it.
     */
    form.append(part.field, new File([(typeof part.data === "string") ? part.data : new Uint8Array(part.data)], part.filename,
      { type: "application/octet-stream" }));
  }

  const response = new Response(form);
  const contentType = response.headers.get("content-type");

  // The boundary is minted by the serializer and reported only through this header, so a response that carries no content type describes a body nothing could
  // parse. The platform always sets it; reading it as an answer rather than assuming it is what keeps that a statement about the response rather than a hope.
  if(contentType === null) {

    throw new AccessProtocolError("The platform's multipart serializer produced a body with no content type to describe it.");
  }

  return { body: await response.bytes(), contentType };
}

// Read the pagination member, or undefined when the response carried none - or carried something that is not a page report. Every member is required because a
// partial report describes no page a caller could act on, and reporting it as absent leaves the caller correctly treating the response as unpaginated.
function asPagination(value: unknown): AccessOfficialPagination | undefined {

  if(!isRecord(value)) {

    return undefined;
  }

  const pageNum = value["page_num"];
  const pageSize = value["page_size"];
  const total = value["total"];

  if((typeof pageNum !== "number") || (typeof pageSize !== "number") || (typeof total !== "number")) {

    return undefined;
  }

  // The wire's own member names, quoted so the record reads as the wire vocabulary it is rather than as identifiers this library chose.
  return { "page_num": pageNum, "page_size": pageSize, "total": total };
}

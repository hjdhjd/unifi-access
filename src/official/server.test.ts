/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * server.test.ts: Unit tests for the official API's own certificate management. The upload row is the second multipart consumer, and it asserts the two-part
 * framing and the caller-supplied filenames - the reference's own sample names are deliberately not what the fixture sends.
 */
import { VOID_OK, describeDomainTable, officialPath, parseMultipart } from "./domain.helpers.ts";
import type { DomainRow } from "./domain.helpers.ts";
import { OfficialApiServer } from "./server.ts";
import assert from "node:assert/strict";

const rows: readonly DomainRow<OfficialApiServer>[] = [

  { inspect: (request) => {

    const parts = parseMultipart(request.body, request.headers["content-type"] ?? "");

    assert.equal(parts.length, 2);
    assert.equal(parts[0]?.field, "key");
    assert.equal(parts[1]?.field, "cert");

    /* The filenames are the caller's, and these two are deliberately not the conventional `server.key` and `server.crt` the reference's sample uses - so a method
     * that invented the conventional names instead of forwarding what it was handed fails here.
     */
    assert.equal(parts[0]?.filename, "test-name-1-private.pem");
    assert.equal(parts[1]?.filename, "test-name-1-chain.pem");
    assert.equal(parts[0]?.data.toString("utf8"), "PRIVATE KEY BYTES");
    assert.deepEqual(parts[1]?.data, Buffer.from([ 45, 45, 66, 69, 71, 73, 78 ]));

    // The transport's JSON stamp would name no boundary at all, so the multipart type has to be the one that reached the wire.
    assert.match(request.headers["content-type"] ?? "", (/^multipart\/form-data; boundary=/));
  },
  method: "uploadCertificate", path: officialPath("/api_server/certificates"), reply: VOID_OK,
  run: async (domain, call) => domain.uploadCertificate({ cert: { data: new Uint8Array([ 45, 45, 66, 69, 71, 73, 78 ]), filename: "test-name-1-chain.pem" },
    key: { data: "PRIVATE KEY BYTES", filename: "test-name-1-private.pem" } }, call), verb: "POST" },

  { method: "deleteCertificate", path: officialPath("/api_server/certificates"), reply: VOID_OK, run: async (domain, call) => domain.deleteCertificate(call),
    verb: "DELETE" }
];

describeDomainTable({ domainClass: OfficialApiServer, name: "OfficialApiServer", rows });

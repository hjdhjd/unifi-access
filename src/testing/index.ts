/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * testing/index.ts: The library's test-support entry point - what a consumer's own test suite imports, and nothing production ever does.
 */

/**
 * The test-support surface, reachable at `unifi-access/testing`.
 *
 * The package publishes one surface for production, the main entry, and this one for a consumer's tests: the helpers a suite needs to exercise its own code
 * against this library's mechanisms without restating them. Today that is the webhook signing helper, the other half of the signature verification the main
 * surface offers, so a suite can hand its webhook receiver a delivery that verifies exactly as the controller's would.
 *
 * Nothing in production may import from this entry, and that is what a dedicated subpath buys over a category tag on the main surface: a production module
 * reaching for a signing helper names a specifier a reader and a grep can both see is wrong. Each helper still lives beside the production module it mirrors,
 * because a helper and its subject drift apart the moment they stop sharing a file; only its export path lives here.
 *
 * @module
 */
export { signWebhookDelivery } from "../official/webhooks.ts";

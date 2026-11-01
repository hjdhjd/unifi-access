/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * url-host.test.ts: Unit tests for the controller address as a URL carries it - the credential mask and its publication, the bracket-aware formatter over each
 * input class it tells apart, and the derivation of the controller's URL authority over each address shape it accepts and each it refuses.
 */
import { controllerAuthority, formatUrlHost, maskAddressCredentials } from "./url-host.ts";
import { describe, test } from "node:test";
import { AccessConfigurationError } from "../errors.ts";
import assert from "node:assert/strict";
import { maskAddressCredentials as barrelMaskAddressCredentials } from "../index.ts";

// Assert that a call refuses the address with the typed configuration error, its message naming the address as a refusal quotes it, everything through its last `@`
// masked as `***@` when it has one, and holding none of the text the address held before its last `@`, and return the refusal's cause.
function refusal(call: () => unknown, address: string): unknown {

  const at = address.lastIndexOf("@");
  const quoted = "\"" + ((at === -1) ? address : ("***@" + address.slice(at + 1))) + "\"";

  let cause: unknown;

  assert.throws(call, (error: unknown) => {

    assert.ok(error instanceof AccessConfigurationError, JSON.stringify(address) + " is refused with the configuration error");
    assert.ok(error.message.includes(quoted), JSON.stringify(address) + " is named in the refusal as " + quoted);

    if(at > 0) {

      assert.ok(!error.message.includes(address.slice(0, at)), JSON.stringify(address) + " leaves none of its text before its last @ in the refusal");
    }

    cause = error.cause;

    return true;
  });

  return cause;
}

describe("maskAddressCredentials", () => {

  test("masks everything through the last `@` as `***@`, and returns an address carrying no `@` unchanged", () => {

    // A user and a password, an address with no `@` at all, an empty marker, which masks like any other, and a second `@`, which the mask reaches through.
    const cases = [

      { address: "user:pass@h", masked: "***@h" },
      { address: "h", masked: "h" },
      { address: "@h", masked: "***@h" },
      { address: "a@b@h", masked: "***@h" }
    ];

    for(const { address, masked } of cases) {

      assert.equal(maskAddressCredentials(address), masked, JSON.stringify(address) + " masks as " + JSON.stringify(masked));
    }
  });

  test("the barrel publishes the very function", () => {

    /* Nothing else in the suite establishes that the mask reached the public surface, and typedoc reads the barrel alone - a symbol missing from it has no page
     * and no consumer. Identity rather than behavior is the assertion, because a re-export that resolved to something else would still answer correctly.
     */
    assert.equal(Object.is(barrelMaskAddressCredentials, maskAddressCredentials), true);
  });
});

describe("formatUrlHost", () => {

  test("brackets a bare IPv6 literal", () => {

    assert.equal(formatUrlHost("fe80::1"), "[fe80::1]");
    assert.equal(formatUrlHost("::1"), "[::1]");
    assert.equal(formatUrlHost("::ffff:10.0.0.1"), "[::ffff:10.0.0.1]");
  });

  test("passes a hostname or an IPv4 address, with or without a port, and a bracketed literal through untouched", () => {

    for(const host of [ "access.local", "10.0.0.1", "access.local:7443", "10.0.0.1:7443", "[fe80::1]", "[fe80::1]:7443" ]) {

      assert.equal(formatUrlHost(host), host);
    }
  });

  test("refuses an IPv6 literal carrying a zone, naming the address", () => {

    refusal(() => formatUrlHost("fe80::1%en0"), "fe80::1%en0");
    assert.throws(() => formatUrlHost("fe80::1%en0"), { message: /^The controller address / }, "the zone refusal opens as the derivation's refusals do");
  });
});

describe("controllerAuthority", () => {

  test("derives the authority every URL is composed on as the URL parser reads it, a single trailing slash dropped and a bare IPv6 literal bracketed", () => {

    // An IPv4-mapped literal comes back in the parser's canonical hexadecimal form, and a tab is one of the characters the parser strips wherever it stands.
    const cases = [

      { authority: "[::ffff:a00:1]", host: "::ffff:10.0.0.1" },
      { authority: "[fe80::1]", host: "fe80::1" },
      { authority: "[fe80::1]", host: "fe80::1/" },
      { authority: "[fe80::1]", host: "[fe80::1]" },
      { authority: "[fe80::1]:7443", host: "[fe80::1]:7443" },
      { authority: "[fe80::1]:7443", host: "[fe80::1]:7443/" },
      { authority: "10.0.0.1", host: "10.0.0.1" },
      { authority: "10.0.0.1", host: "10.0.0.1/" },
      { authority: "10.0.0.1", host: "10.0.0.1/." },
      { authority: "10.0.0.1", host: "10.0.0.1\t" },
      { authority: "10.0.0.1:7443", host: "10.0.0.1:7443" },
      { authority: "access.local", host: ":@access.local" },
      { authority: "access.local", host: "@access.local" },
      { authority: "access.local", host: "Access.Local:443" },
      { authority: "access.local", host: "access.local" },
      { authority: "access.local:7443", host: "access.local:7443" },
      { authority: "access.local:7443", host: "access.local:7443/" }
    ];

    for(const { authority, host } of cases) {

      assert.equal(controllerAuthority(host), authority, JSON.stringify(host) + " derives its authority");
    }
  });

  test("refuses a host that is missing or is not a string before any text is read, quoting no value and with no cause", () => {

    // Each is a value a hand-edited configuration can hand a JavaScript consumer past the type. The sentence quotes no address, so the row reads it whole rather
    // than through refusal(), which expects a quoted one.
    for(const host of [ undefined, null, 7443, { host: "access.local" } ]) {

      assert.throws(() => controllerAuthority(host), (error: unknown) => {

        assert.ok(error instanceof AccessConfigurationError, JSON.stringify(host) + " is refused with the configuration error");
        assert.equal(error.message, "The controller address is missing or is not text; set it to the controller's hostname or IP address.",
          JSON.stringify(host) + " is refused with the sentence that quotes no value");
        assert.equal(error.cause, undefined, JSON.stringify(host) + " is refused with no cause");

        return true;
      });
    }
  });

  test("refuses an address carrying credentials before its last `@` ahead of any parse, its refusal masking everything through that `@`", () => {

    // A user, a user and a password, the same behind a scheme, which a parse reads as the host `https` with the credentials in its path, a password holding an `@` of its
    // own, an empty `@` ahead of the credentials, and credentials beside a port out of range, which a parse refuses with the whole composed URL, credentials and all, as
    // its refusal's input. Each is refused before any parse, so none carries a cause, and its message holds none of the credentials.
    const cases = [

      { host: "user@10.0.0.1", quoted: "***@10.0.0.1" },
      { host: "user:pass@10.0.0.1", quoted: "***@10.0.0.1" },
      { host: "https://user:pass@10.0.0.1", quoted: "***@10.0.0.1" },
      { host: "user:p@ss@10.0.0.1", quoted: "***@10.0.0.1" },
      { host: "@user:pass@10.0.0.1", quoted: "***@10.0.0.1" },
      { host: "user:secret@10.0.0.1:99999", quoted: "***@10.0.0.1:99999" }
    ];

    for(const { host, quoted } of cases) {

      assert.equal(refusal(() => controllerAuthority(host), host), undefined, JSON.stringify(host) + " is refused before any parse, which raised nothing");
      assert.throws(() => controllerAuthority(host), { message: "The controller address \"" + quoted + "\" carries more than a host and a port." },
        JSON.stringify(host) + " is refused as carrying more than a host and a port, its credentials masked");
    }
  });

  test("refuses an address whose text before its last `@` is neither empty nor a lone colon ahead of any parse, its quote masked", () => {

    /* Only the empty marker and the lone colon name an empty user and an empty password. A run of colons names a password of colons, a second `@` names a user of
     * `@`, and `user` names a user: each parses as the host `access.local` with credentials beside it, so each is refused before the parse. The mask quotes all of
     * them alike, so the message is asserted whole rather than searched for the text before the `@`, which the mask's own `@` would hold.
     */
    for(const host of [ "::@access.local", "@@access.local", "user@access.local" ]) {

      assert.throws(() => controllerAuthority(host), (error: unknown) => {

        assert.ok(error instanceof AccessConfigurationError, JSON.stringify(host) + " is refused with the configuration error");
        assert.equal(error.message, "The controller address \"***@access.local\" carries more than a host and a port.", JSON.stringify(host) + " is quoted masked");
        assert.equal(error.cause, undefined, JSON.stringify(host) + " is refused before any parse, which raised nothing");

        return true;
      });
    }
  });

  test("refuses a lone colon before a host the parser cannot read as it refuses an empty marker, each with the parser's refusal as the cause", () => {

    /* The lone colon names an empty user and an empty password, as the empty marker does, so it too reaches the parse, and a host the parser refuses behind it is
     * refused with the empty marker's message. The messages are compared with each other rather than with a sentence, because what this row holds is that the markers
     * are refused alike.
     */
    const [ lone, empty ] = [ ":@fe80::1", "@fe80::1" ].map((host) => {

      let message = "";

      assert.throws(() => controllerAuthority(host), (error: unknown) => {

        assert.ok(error instanceof AccessConfigurationError, JSON.stringify(host) + " is refused with the configuration error");
        assert.ok(error.cause instanceof TypeError, JSON.stringify(host) + " carries the parser's refusal as its cause");

        message = error.message;

        return true;
      });

      return message;
    });

    assert.equal(lone, empty, "the lone colon is refused with the empty marker's message");
  });

  test("refuses a zoned IPv6 literal through the formatter's own refusal", () => {

    assert.equal(refusal(() => controllerAuthority("fe80::1%en0"), "fe80::1%en0"), undefined, "the formatter refuses before any parse, so there is no parser cause");
    assert.equal(refusal(() => controllerAuthority("fe80::1%en0/"), "fe80::1%en0"), undefined, "the formatter names the literal its trailing slash was dropped from");

    for(const host of [ "fe80::1%en0", "fe80::1%en0/" ]) {

      assert.throws(() => controllerAuthority(host), { message: /^The controller address / }, JSON.stringify(host) + "'s zone refusal opens as its siblings do");
    }
  });

  test("refuses an address the URL parser cannot read as a host, the parser's refusal as the cause", () => {

    // An empty address and a lone `/`, which drops to it, a forbidden host character, a zone inside brackets, a port out of range, brackets around something that
    // is no IPv6 literal, a trailing space or control character, which the parser trims from a bare host and refuses once a path follows it, and a leading space,
    // which follows the scheme and so is never trimmed at all.
    for(const host of [ "", "/", "access local", "[fe80::1%en0]", "10.0.0.1:99999", "[access.local]", "10.0.0.1 ", "10.0.0.1\u0001", " 10.0.0.1" ]) {

      assert.ok(refusal(() => controllerAuthority(host), host) instanceof TypeError, JSON.stringify(host) + " carries the parser's refusal as its cause");
    }
  });

  test("refuses an address carrying more than a host and a port", () => {

    // Each parses, and each carries a URL part beyond the authority: a path, a query, a fragment, and a scheme, which parses as the host `https` with the rest of the
    // address as its path. A second trailing `/` (a single one is dropped as the empty path), an empty trailing `?` or `#`, or a backslash parses alone as a bare host
    // and carries that part once a path follows it, as every composed URL does.
    for(const host of [ "10.0.0.1/proxy", "10.0.0.1?debug=1", "10.0.0.1#top", "https://10.0.0.1", "10.0.0.1//", "10.0.0.1?", "10.0.0.1#", "10.0.0.1\\" ]) {

      assert.equal(refusal(() => controllerAuthority(host), host), undefined, JSON.stringify(host) + " is refused on its parse, which raised nothing");
    }
  });
});

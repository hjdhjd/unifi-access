/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * errors-parity.test.ts: Differential tests holding this library's cause-chain rendering equal to the shared plugin utilities' formatter. The library takes no
 * runtime dependency on that package, so the rendering rule is implemented in both places; this suite is what keeps the two of them one rule. It feeds a table of
 * error shapes through each and asserts the same text comes back, so a change to either rendering reddens it here.
 */
import { AccessApiError, AccessBootstrapError, formatErrorChain } from "./errors.ts";
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { formatErrorMessage } from "homebridge-plugin-utils";

interface RenderingCase {

  name: string;
  value: unknown;
}

/* Every shape the rendering rule branches on, plus the chain the library actually produces when a bootstrap refusal wraps the controller's own words. Built by a
 * function rather than held as a module constant so each run gets its own values...the self-referential row mutates the error it names, and a shared table would
 * carry that mutation between tests.
 */
function renderingTable(): RenderingCase[] {

  const looping = new Error("Unable to fetch the bootstrap.");

  looping.cause = new Error("the controller refused the request.", { cause: looping });

  let bounded = new Error("level 11.");

  for(let level = 10; level >= 0; level--) {

    bounded = new Error("level " + level.toString() + ".", { cause: bounded });
  }

  return [

    { name: "a lone error whose message ends in a period", value: new Error("Unable to fetch the bootstrap.") },
    { name: "a lone error whose message carries no period", value: new Error("Unable to fetch the bootstrap") },
    { name: "a string", value: "the controller refused." },
    { name: "a number", value: 42 },
    { name: "undefined", value: undefined },
    { name: "a two-link chain", value: new Error("Unable to fetch the bootstrap.", { cause: new Error("the controller refused the request.") }) },
    { name: "a three-link chain", value: new Error("Unable to fetch the bootstrap.",
      { cause: new Error("the controller refused the request.", { cause: new Error("connect ECONNREFUSED.") }) }) },
    { name: "a cause whose words the top sentence already carries", value: new Error("Unable to fetch the bootstrap: the controller refused the request.",
      { cause: new Error("the controller refused the request.") }) },
    { name: "a cause whose words an earlier link already appended", value: new Error("Unable to unlock the door.",
      { cause: new Error("the controller refused the request.", { cause: new Error("the controller refused.") }) }) },
    { name: "a cause whose message is empty", value: new Error("Unable to fetch the bootstrap.", { cause: new Error("") }) },
    { name: "a link that is not an error carrying a further error below it", value: new Error("Unable to fetch the bootstrap.",
      { cause: { cause: new Error("connect ECONNREFUSED."), code: "CODE_SYSTEM_ERROR" } }) },
    { name: "a cause that is not an object", value: new Error("Unable to fetch the bootstrap.", { cause: "the controller refused." }) },
    { name: "a top value that is not an error carrying an error below it", value: { cause: new Error("the controller refused the request."),
      code: "CODE_SYSTEM_ERROR" } },
    { name: "a chain deeper than the bound", value: bounded },
    { name: "a chain that refers back to itself", value: looping },
    { name: "a cause key carrying undefined", value: new Error("Unable to fetch the bootstrap.",
      { cause: new Error("the controller refused the request.", { cause: undefined }) }) },
    { name: "a bootstrap refusal wrapping the controller's own refusal", value: new AccessBootstrapError("Unable to fetch the bootstrap.",
      { cause: new AccessApiError("The controller refused the request.", { code: "CODE_SYSTEM_ERROR" }), stage: "fetch" }) }
  ];
}

describe("formatErrorChain parity with the shared plugin utilities", () => {

  for(const { name, value } of renderingTable()) {

    test("renders " + name + " exactly as the shared formatter does", () => {

      assert.equal(formatErrorChain(value), formatErrorMessage(value), "the two renderings agree on " + name);
    });
  }
});

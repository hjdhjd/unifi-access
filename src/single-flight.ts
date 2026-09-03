/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * single-flight.ts: The in-flight coalescing gate - overlapping callers share one attempt rather than racing several.
 */
import type { Nullable } from "./types/index.ts";

/**
 * Wrap an asynchronous operation so that callers overlapping in time share one attempt and accept its fate.
 *
 * Coalescing is what keeps two passes from settling out of order, so a staler answer can never land on top of a fresher one. The slot is set when an attempt
 * begins and cleared when it settles either way, so a rejection leaves the next caller to start cleanly rather than joining a failure, and there is no reset path
 * to forget: nothing is retained between attempts.
 *
 * A joiner's own arguments are not used, because the attempt it joins was already shaped by the first caller's. That is the honest trade for sharing one run, and
 * it is why this suits an operation whose callers want the same answer rather than one whose arguments select what they get.
 *
 * @typeParam A - The wrapped operation's argument tuple.
 * @typeParam T - What the operation resolves to.
 *
 * @param run - The operation to coalesce.
 *
 * @returns A function with the same signature, whose overlapping calls share one run.
 */
export function singleFlight<A extends unknown[], T>(run: (...args: A) => Promise<T>): (...args: A) => Promise<T> {

  let inFlight: Nullable<Promise<T>> = null;

  return (...args: A): Promise<T> => {

    if(inFlight !== null) {

      return inFlight;
    }

    const attempt = run(...args).finally(() => {

      inFlight = null;
    });

    inFlight = attempt;

    return attempt;
  };
}

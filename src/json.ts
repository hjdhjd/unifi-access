/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * json.ts: The decode-boundary record predicate every parsed payload is measured against.
 */

/**
 * Whether a decoded value is a record - a non-null, non-array object - which is the shape every envelope, payload, and wire record must have before a member is
 * read off it.
 *
 * One definition because every decode boundary in the library asks the same question, among them the notification classifier testing a frame, the official dispatch
 * testing an envelope, the webhook decoder testing a delivery, and the reducer's merge deciding whether two values recurse or replace.
 *
 * @param value - Any decoded value.
 *
 * @returns `true` when the value is a non-null object that is not an array.
 */
export function isRecord(value: unknown): value is Record<string, unknown> {

  return (typeof value === "object") && (value !== null) && !Array.isArray(value);
}

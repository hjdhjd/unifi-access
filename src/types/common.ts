/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * common.ts: Language-level generic helper types, with no UniFi Access domain of their own.
 */

/**
 * The language-level generic building blocks the rest of the type surface composes from: the null-tolerant deep-partial mapped type update payloads are declared
 * against, a member-exclusion mapping the state records are pruned with, a nullable helper, and the recursive JSON value type used as the index signature on
 * wire-record interfaces.
 *
 * @module AccessTypesCommon
 */

/* The deep partial event payloads are typed against.
 *
 * Every member is optional because a notification payload is a sparse projection of the record it describes: a v2 device update carries substantially fewer keys than
 * the bootstrap record, and a legacy update carries a full record. Both inhabit this one type, so no separate full-record payload type is needed.
 *
 * Every member also admits `null`, which is the property that separates this from a plain deep partial. On this wire a null-valued member means NOT CARRIED, never
 * cleared: a legacy device update nulls fields whose stored values are real and stable across the same window, and the devices did not lose those fields. Some of those
 * nulled fields are declared non-nullable on the record types, which is accurate for a record and wrong for a payload, so the null tolerance lives here rather than
 * loosening the record declarations. The reducer's merge is what honors the semantics by skipping a null at every depth.
 *
 * The `NonNullable` guard on the array and object branches is what lets an optional member partialize correctly. Reading `T[P] extends (infer I)[]` against an
 * optional member tests `I[] | undefined`, which matches neither branch and falls through to the primitive passthrough, so an optional array member would be typed as
 * its full element type rather than a partial of it. Stripping the undefined first puts the member on the branch its declared shape calls for.
 *
 * The `as P extends string ? P : never` key filter excludes the string index signature from the mapping. Without it the mapping recurses into the
 * AccessKnownJsonValue index signature, causing infinite type instantiation. This is what lets a wire-record interface carry both explicit properties and a
 * `[key: string]` index signature while still being usable as a payload type.
 */
/** @ignore */
export type DeepWirePartial<T> = {

  [P in keyof T as P extends string ? P : never]?: Nullable<NonNullable<T[P]> extends (infer I)[] ? DeepWirePartial<I>[] :
    NonNullable<T[P]> extends object ? DeepWirePartial<NonNullable<T[P]>> : T[P]>
};

/* Member exclusion that keeps everything else the interface declares. The state records are pruned with this: a stored door drops the device_groups the devices map
 * owns, a stored floor drops the doors the doors map owns, and the stored root drops both, so no record in a state map embeds entries another map owns.
 *
 * The homomorphic mapping is the reason this is not `Omit`. Over an interface carrying a string index signature, `Omit` resolves `keyof T` to `string` and collapses
 * every declared member into the index signature, so the member information the rest of the type surface depends on is destroyed. Mapping over `keyof T` directly
 * preserves each declared member, its optionality, and the index signature alongside them.
 *
 * Keeping the index signature has consequences worth naming, and neither should be over-read. The pruning is advisory at the type level, since the retained index
 * signature still admits the excluded key: the runtime rest-destructure in the reducer and the `Object.hasOwn` test assertions are what actually enforce it. And `K`
 * is deliberately unconstrained, because a `keyof`-based constraint is vacuous over an index-signatured interface, where `keyof` collapses to `string`. A misspelled
 * exclusion key is still caught, at the construction site, where the rest-destructured object fails to satisfy a type that still requires the member the typo failed
 * to exclude.
 */
/** @ignore */
export type OmitMembers<T, K extends PropertyKey> = {

  [P in keyof T as P extends K ? never : P]: T[P]
};

/** @ignore */
export type Nullable<T> = T | null;

// Recursive JSON value type representing any JSON-compatible value, plus `undefined` for properties that may be absent on a partial payload. Used as the index signature
// type on wire-record interfaces so that untyped fields flowing through from the Access API are accessible without casting.
/** @ignore */
export type AccessKnownJsonValue = boolean | null | number | string | undefined | AccessKnownJsonValue[] | { [key: string]: AccessKnownJsonValue };

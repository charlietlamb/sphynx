import type { SymbolDefinition } from "@sphynx/schema/pull-requests";

/**
 * Diff text by path. Navigation and comment handlers read patches inside
 * reducers, so they need a synchronous lookup rather than a query.
 */
export type PatchMap = ReadonlyMap<string, string>;

export type SymbolIndex = ReadonlyMap<string, SymbolDefinition>;

export const EMPTY_PATCHES: PatchMap = new Map();

export const EMPTY_SYMBOLS: SymbolIndex = new Map();

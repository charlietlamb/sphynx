import { describe, expect, test } from "bun:test";
import { buildSymbolIndex } from "./symbol-index";

const DEFAULT_PATH = "src/example.ts";

function indexOf(
  ...entries: readonly { path?: string; patch: string | null }[]
) {
  const patches = new Map<string, string>();
  for (const entry of entries) {
    if (entry.patch) {
      patches.set(entry.path ?? DEFAULT_PATH, entry.patch);
    }
  }
  return buildSymbolIndex(patches);
}

describe("buildSymbolIndex", () => {
  test("indexes function, class, const arrow, and type definitions with line numbers", () => {
    const patch = [
      "@@ -1,2 +10,8 @@",
      " import { x } from './x';",
      "+export function computeTotal(a: number) {",
      "+  return a;",
      "+}",
      "+export class PaymentGateway {}",
      "+const formatLabel = (value: string) => value;",
      "+export interface InvoiceSummary {}",
      " const untouched = 1;",
    ].join("\n");
    const index = indexOf({ patch });

    expect(index.computeTotal).toEqual({
      kind: "top",
      path: "src/example.ts",
      lineNumber: 11,
      scope: "global",
    });
    expect(index.PaymentGateway).toEqual({
      kind: "top",
      path: "src/example.ts",
      lineNumber: 14,
      scope: "global",
    });
    expect(index.formatLabel).toEqual({
      kind: "top",
      path: "src/example.ts",
      lineNumber: 15,
      scope: "global",
    });
    expect(index.InvoiceSummary).toEqual({
      kind: "top",
      path: "src/example.ts",
      lineNumber: 16,
      scope: "global",
    });
  });

  test("counts deleted lines against the old file only", () => {
    const patch = [
      "@@ -1,3 +1,3 @@",
      "-function removedThing() {}",
      "+function addedThing() {}",
      " const keep = 1;",
      "+function trailingThing() {}",
    ].join("\n");
    const index = indexOf({ patch });

    expect(index.removedThing).toBeUndefined();
    expect(index.addedThing?.lineNumber).toBe(1);
    expect(index.trailingThing?.lineNumber).toBe(3);
  });

  test("drops symbols defined in more than one place", () => {
    const patch = "@@ -1 +1,2 @@\n+function duplicated() {}";
    const index = indexOf({ patch }, { path: "src/other.ts", patch });
    expect("duplicated" in index).toBe(false);
  });

  test("indexes multi-line arrows, default classes, and typed arrow consts", () => {
    const patch = [
      "@@ -1 +1,4 @@",
      "+export const buildInvoice = (",
      "+export default class HomeView {}",
      "+const applyDiscount: (x: number) => number = (x) => x;",
      "+const wrapped = (await load()).items;",
    ].join("\n");
    const index = indexOf({ patch });

    expect(index.buildInvoice?.lineNumber).toBe(1);
    expect(index.HomeView?.lineNumber).toBe(2);
    expect(index.applyDiscount?.lineNumber).toBe(3);
    expect("wrapped" in index).toBe(false);
  });

  test("indexes class methods but not control flow or call statements", () => {
    const patch = [
      "@@ -1 +1,6 @@",
      "+  async fetchTotals(id: string) {",
      "+  handleClick = () => {",
      "+  render(): ReactNode {",
      "+  while (running) {",
      "+  navigate(path);",
      "+  constructor(deps: Deps) {",
    ].join("\n");
    const index = indexOf({ patch });

    expect(index.fetchTotals).toEqual({
      kind: "member",
      path: "src/example.ts",
      lineNumber: 1,
      scope: "global",
    });
    expect(index.handleClick?.kind).toBe("member");
    expect(index.render?.lineNumber).toBe(3);
    expect("while" in index).toBe(false);
    expect("navigate" in index).toBe(false);
    expect("constructor" in index).toBe(false);
  });

  test("keeps overload blocks linkable instead of dropping them as ambiguous", () => {
    const patch = [
      "@@ -1 +1,3 @@",
      "+export function parseAmount(v: string): number;",
      "+export function parseAmount(v: number): number;",
      "+export function parseAmount(v: string | number): number {",
    ].join("\n");
    const index = indexOf({ patch });
    expect(index.parseAmount?.lineNumber).toBe(1);
  });

  test("does not index call lines with function callbacks as member definitions", () => {
    const patch = [
      "@@ -1 +1,2 @@",
      '+describe("payments", function () {',
      "+  fetchTotals(id: string) {",
    ].join("\n");
    const index = indexOf({ patch });
    expect("describe" in index).toBe(false);
    expect(index.fetchTotals?.kind).toBe("member");
  });

  test("scopes definitions in test files to their own file", () => {
    const patch = "@@ -1 +1 @@\n+const planHelper = () => ({});";
    const index = indexOf(
      { path: "server/tests/unit/catalog.test.ts", patch },
      { path: "src/specs/setup.spec.tsx", patch: null }
    );
    expect(index.planHelper?.scope).toBe("file");
  });

  test("ignores non-js files, missing patches, and short names", () => {
    const index = indexOf(
      { path: "README.md", patch: "@@ -1 +1 @@\n+function readmeFn() {}" },
      { path: "src/none.ts", patch: null },
      { path: "src/short.ts", patch: "@@ -1 +1 @@\n+function fn() {}" }
    );
    expect(Object.keys(index)).toHaveLength(0);
  });
});

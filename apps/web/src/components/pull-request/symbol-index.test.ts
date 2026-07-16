import { describe, expect, test } from "bun:test";
import type { PullRequestFile } from "@sphynx/schema/pull-requests";
import { buildSymbolIndex } from "./symbol-index";

function makeFile(overrides: Partial<PullRequestFile>): PullRequestFile {
  return {
    path: "src/example.ts",
    previousPath: null,
    sha: "abc",
    status: "modified",
    additions: 1,
    deletions: 0,
    changes: 1,
    patch: null,
    renderability: "patch",
    githubUrl: "https://github.com/o/r/blob/sha/src/example.ts",
    ...overrides,
  };
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
    const index = buildSymbolIndex([makeFile({ patch })]);

    expect(index.get("computeTotal")).toEqual({
      kind: "top",
      path: "src/example.ts",
      lineNumber: 11,
      scope: "global",
    });
    expect(index.get("PaymentGateway")).toEqual({
      kind: "top",
      path: "src/example.ts",
      lineNumber: 14,
      scope: "global",
    });
    expect(index.get("formatLabel")).toEqual({
      kind: "top",
      path: "src/example.ts",
      lineNumber: 15,
      scope: "global",
    });
    expect(index.get("InvoiceSummary")).toEqual({
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
    const index = buildSymbolIndex([makeFile({ patch })]);

    expect(index.get("removedThing")).toBeUndefined();
    expect(index.get("addedThing")?.lineNumber).toBe(1);
    expect(index.get("trailingThing")?.lineNumber).toBe(3);
  });

  test("drops symbols defined in more than one place", () => {
    const patch = "@@ -1 +1,2 @@\n+function duplicated() {}";
    const files = [
      makeFile({ patch }),
      makeFile({ path: "src/other.ts", patch }),
    ];
    expect(buildSymbolIndex(files).has("duplicated")).toBe(false);
  });

  test("indexes multi-line arrows, default classes, and typed arrow consts", () => {
    const patch = [
      "@@ -1 +1,4 @@",
      "+export const buildInvoice = (",
      "+export default class HomeView {}",
      "+const applyDiscount: (x: number) => number = (x) => x;",
      "+const wrapped = (await load()).items;",
    ].join("\n");
    const index = buildSymbolIndex([makeFile({ patch })]);

    expect(index.get("buildInvoice")?.lineNumber).toBe(1);
    expect(index.get("HomeView")?.lineNumber).toBe(2);
    expect(index.get("applyDiscount")?.lineNumber).toBe(3);
    expect(index.has("wrapped")).toBe(false);
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
    const index = buildSymbolIndex([makeFile({ patch })]);

    expect(index.get("fetchTotals")).toEqual({
      kind: "member",
      path: "src/example.ts",
      lineNumber: 1,
      scope: "global",
    });
    expect(index.get("handleClick")?.kind).toBe("member");
    expect(index.get("render")?.lineNumber).toBe(3);
    expect(index.has("while")).toBe(false);
    expect(index.has("navigate")).toBe(false);
    expect(index.has("constructor")).toBe(false);
  });

  test("keeps overload blocks linkable instead of dropping them as ambiguous", () => {
    const patch = [
      "@@ -1 +1,3 @@",
      "+export function parseAmount(v: string): number;",
      "+export function parseAmount(v: number): number;",
      "+export function parseAmount(v: string | number): number {",
    ].join("\n");
    const index = buildSymbolIndex([makeFile({ patch })]);
    expect(index.get("parseAmount")?.lineNumber).toBe(1);
  });

  test("does not index call lines with function callbacks as member definitions", () => {
    const patch = [
      "@@ -1 +1,2 @@",
      '+describe("payments", function () {',
      "+  fetchTotals(id: string) {",
    ].join("\n");
    const index = buildSymbolIndex([makeFile({ patch })]);
    expect(index.has("describe")).toBe(false);
    expect(index.get("fetchTotals")?.kind).toBe("member");
  });

  test("scopes definitions in test files to their own file", () => {
    const patch = "@@ -1 +1 @@\n+const planHelper = () => ({});";
    const index = buildSymbolIndex([
      makeFile({ path: "server/tests/unit/catalog.test.ts", patch }),
      makeFile({ path: "src/specs/setup.spec.tsx", patch: null }),
    ]);
    expect(index.get("planHelper")?.scope).toBe("file");
  });

  test("ignores non-js files, missing patches, and short names", () => {
    const files = [
      makeFile({
        path: "README.md",
        patch: "@@ -1 +1 @@\n+function readmeFn() {}",
      }),
      makeFile({ path: "src/none.ts", patch: null }),
      makeFile({
        path: "src/short.ts",
        patch: "@@ -1 +1 @@\n+function fn() {}",
      }),
    ];
    expect(buildSymbolIndex(files).size).toBe(0);
  });
});

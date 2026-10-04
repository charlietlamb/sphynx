import { describe, expect, it } from "bun:test";
import {
  type NamedValue,
  revisionOf,
} from "../../src/environment/named-values";

const at = new Date("2026-10-04T00:00:00Z");

const held = (id: string, name: string, revision: number): NamedValue => ({
  row: {
    createdAt: at,
    createdBy: null,
    id,
    lastUsedAt: null,
    name,
    organizationId: "org_named",
    ownerUserId: null,
    preview: "••••••••",
    revision,
    scope: "organization",
    sealedValue: "sealed",
    secret: true,
    updatedAt: at,
  },
  value: "value",
});

const snapshot = (...values: NamedValue[]) =>
  new Map(values.map((value) => [value.row.name, value]));

describe("a credential's revision", () => {
  it("is a fixed positive integer for one snapshot of its variables", () => {
    expect(
      revisionOf(
        snapshot(
          held("var_id", "MODAL_TOKEN_ID", 1),
          held("var_secret", "MODAL_TOKEN_SECRET", 2)
        )
      )
    ).toBe(910_705_809);
  });

  it("does not depend on the order the variables were read in", () => {
    expect(
      revisionOf(
        snapshot(
          held("var_secret", "MODAL_TOKEN_SECRET", 2),
          held("var_id", "MODAL_TOKEN_ID", 1)
        )
      )
    ).toBe(910_705_809);
  });

  it("differs once a variable is removed even when the revisions add up the same", () => {
    const both = revisionOf(
      snapshot(
        held("var_id", "MODAL_TOKEN_ID", 1),
        held("var_secret", "MODAL_TOKEN_SECRET", 1)
      )
    );
    const one = revisionOf(snapshot(held("var_id", "MODAL_TOKEN_ID", 2)));

    expect(one).not.toBe(both);
  });

  it("differs when a variable is replaced by a new row at the same revision", () => {
    expect(revisionOf(snapshot(held("var_old", "MODAL_TOKEN_ID", 1)))).not.toBe(
      revisionOf(snapshot(held("var_new", "MODAL_TOKEN_ID", 1)))
    );
  });
});

import { Schema } from "effect";
import { describe, expect, test } from "vitest";
import { FullDatabaseId } from "./githubScalars";

const decode = Schema.decodeUnknownSync(FullDatabaseId);

describe("FullDatabaseId", () => {
  test("coerces GitHub's numeric BigInt id to a string", () => {
    expect(decode(3_695_737_672)).toBe("3695737672");
  });

  test("passes a string id through", () => {
    expect(decode("PRRC_kwABC")).toBe("PRRC_kwABC");
  });

  test("null and undefined decode to null", () => {
    expect(decode(null)).toBeNull();
    expect(decode(undefined)).toBeNull();
  });
});

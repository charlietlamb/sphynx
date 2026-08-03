import { describe, expect, test } from "bun:test";
import { ConvexError } from "convex/values";
import {
  installErrorDetail,
  isPermanentReadError,
  isReauthError,
} from "@/lib/auth-error";

describe("isPermanentReadError", () => {
  test("the load-race Unauthenticated string is transient", () => {
    expect(isPermanentReadError(new ConvexError("Unauthenticated"))).toBe(
      false
    );
  });

  test("the connection-lost action string is transient", () => {
    expect(
      isPermanentReadError(
        new Error("Connection lost while action was in flight")
      )
    ).toBe(false);
  });

  test("a bare Server Error is transient", () => {
    expect(isPermanentReadError(new Error("Server Error"))).toBe(false);
  });

  test("genuine access codes are permanent", () => {
    for (const code of ["UNAUTHORIZED", "FORBIDDEN", "RATE_LIMITED"]) {
      expect(isPermanentReadError(new ConvexError({ code }))).toBe(true);
    }
  });

  test("a not-found message is permanent", () => {
    expect(isPermanentReadError(new Error("PullRequestNotFound"))).toBe(true);
  });
});

describe("isReauthError", () => {
  test("keeps treating the bare Unauthenticated string as reauth", () => {
    expect(isReauthError(new ConvexError("Unauthenticated"))).toBe(true);
  });

  test("a plain error is not reauth", () => {
    expect(isReauthError(new Error("boom"))).toBe(false);
  });
});

describe("installErrorDetail", () => {
  test("reads a structured message", () => {
    expect(
      installErrorDetail(new ConvexError({ code: "FORBIDDEN", message: "no" }))
    ).toBe("no");
  });
});

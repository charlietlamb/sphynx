import { describe, expect, test } from "bun:test";
import { ageDays, fullDate, shortAge } from "@/lib/age";

const NOW = Date.parse("2026-07-10T12:00:00Z");

describe("shortAge", () => {
  test("formats minutes, hours, and days", () => {
    expect(shortAge("2026-07-10T11:30:00Z", NOW)).toBe("30m");
    expect(shortAge("2026-07-10T04:00:00Z", NOW)).toBe("8h");
    expect(shortAge("2026-07-05T12:00:00Z", NOW)).toBe("5d");
  });

  test("clamps future or same-instant timestamps to one minute", () => {
    expect(shortAge("2026-07-10T12:00:00Z", NOW)).toBe("1m");
  });
});

describe("ageDays", () => {
  test("returns fractional days", () => {
    expect(ageDays("2026-07-09T12:00:00Z", NOW)).toBeCloseTo(1);
  });
});

describe("fullDate", () => {
  test("formats an absolute date", () => {
    expect(fullDate("2026-07-03T09:00:00Z")).toBe("3 Jul 2026");
  });
});

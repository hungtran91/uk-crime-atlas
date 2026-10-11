import { describe, expect, it } from "vitest";
import { parseMonth, withMonth } from "@/lib/month";

const months = ["2026-05", "2026-06", "2026-07"];
const latest = "2026-07";

describe("parseMonth", () => {
  it("accepts a month that is in the data", () => {
    expect(parseMonth("2026-05", months, latest)).toBe("2026-05");
  });

  it("falls back to the latest month when absent or invalid", () => {
    for (const v of [null, undefined, "", "banana", "2026-5", "2024-01", "2026-08"]) {
      expect(parseMonth(v, months, latest)).toBe(latest);
    }
  });
});

describe("withMonth", () => {
  it("carries a non-default month", () => {
    expect(withMonth("/force/kent", "2026-05", latest)).toBe("/force/kent?month=2026-05");
    expect(withMonth("/", "2026-06", latest)).toBe("/?month=2026-06");
  });

  it("leaves the latest month out of the URL", () => {
    expect(withMonth("/force/kent", latest, latest)).toBe("/force/kent");
  });
});

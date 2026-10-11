import { describe, expect, it } from "vitest";
import { fmt, monthLabel, monthShort, rankLabel } from "@/lib/format";

describe("fmt", () => {
  it("formats ordinals", () => {
    const cases: [number, string][] = [
      [1, "1st"], [2, "2nd"], [3, "3rd"], [4, "4th"], [11, "11th"], [12, "12th"], [13, "13th"],
      [21, "21st"], [22, "22nd"], [23, "23rd"], [40, "40th"], [101, "101st"], [111, "111th"],
    ];
    for (const [n, s] of cases) expect(fmt.ordinal(n)).toBe(s);
  });

  it("signs percentages with a true minus and drops the sign when they round to zero", () => {
    expect(fmt.pct(0.0651)).toBe("+6.5%");
    expect(fmt.pct(-0.0545)).toBe("−5.5%");
    expect(fmt.pct(0.4, 0)).toBe("+40%");
    expect(fmt.pct(0.00004)).toBe("0.0%");
    expect(fmt.pct(0)).toBe("0.0%");
  });

  it("signs absolute changes", () => {
    expect(fmt.change(0.472)).toBe("+0.47");
    expect(fmt.change(-0.388)).toBe("−0.39");
    expect(fmt.change(0.001)).toBe("0.00");
  });

  it("formats numbers in en-GB", () => {
    expect(fmt.int(461234)).toBe("461,234");
    expect(fmt.dec1(5.04)).toBe("5.0");
    expect(fmt.dec2(7.7)).toBe("7.70");
    expect(fmt.compact(1_234_567)).toBe("1.2M");
    expect(fmt.compact(161_499)).toBe("161k");
    expect(fmt.compact(9_999)).toBe("9,999");
  });
});

describe("labels", () => {
  it("formats ranks", () => {
    expect(rankLabel(2, 40)).toBe("2nd of 40 reporting");
  });

  it("formats months without locale-dependent names", () => {
    expect(monthLabel("2026-07")).toBe("Jul 2026");
    expect(monthLabel("2025-09")).toBe("Sep 2025");
    expect(monthShort("2025-12")).toBe("Dec");
  });
});

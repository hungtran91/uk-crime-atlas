import { describe, expect, it } from "vitest";
import { createDataset, type CountRow, type Force, type Meta } from "@/lib/data";
import {
  binIndex,
  CITY_OF_LONDON_ID,
  forceMonth,
  highestRate,
  monthOverMonth,
  national,
  nationalRateSeries,
  rankForces,
  rate,
} from "@/lib/metrics";

// a, b: ordinary forces. b publishes nothing in 2026-02. z has rows but no population.
const meta: Meta = {
  months: ["2026-01", "2026-02", "2026-03"],
  latestMonth: "2026-03",
  generatedAt: "2026-04-01T00:00:00Z",
  populationYear: 2024,
  excludedCategories: ["Anti-social behaviour"],
  missing: { "2026-02": ["b"] },
};
const forces: Force[] = [
  { id: "a", name: "A", onsCode: "E1", population: 1000 },
  { id: "b", name: "B", onsCode: "E2", population: 2000 },
  { id: CITY_OF_LONDON_ID, name: "City of London", onsCode: "E3", population: 100 },
  { id: "z", name: "Z", onsCode: "E4", population: 0 },
];
const row = (forceId: string, month: string, category: string, count: number): CountRow => ({
  forceId,
  month,
  category,
  count,
});
const ds = createDataset(meta, forces, [
  row("a", "2026-01", "Burglary", 4),
  row("a", "2026-01", "Drugs", 6),
  row("b", "2026-01", "Burglary", 10),
  row(CITY_OF_LONDON_ID, "2026-01", "Burglary", 5),
  row("z", "2026-01", "Burglary", 3),
  row("a", "2026-02", "Burglary", 8),
  row("a", "2026-02", "Drugs", 4),
  row(CITY_OF_LONDON_ID, "2026-02", "Burglary", 4),
  row("z", "2026-02", "Burglary", 1),
  row("a", "2026-03", "Burglary", 9),
  row("a", "2026-03", "Robbery", 1),
  row("b", "2026-03", "Burglary", 16),
  row("b", "2026-03", "Drugs", 4),
  row(CITY_OF_LONDON_ID, "2026-03", "Burglary", 2),
  row("z", "2026-03", "Burglary", 2),
]);

describe("rate", () => {
  it("is count per 1,000 residents", () => {
    expect(rate(7, 1000)).toBe(7);
    expect(rate(25, 3100)).toBeCloseTo(8.0645, 4);
  });

  it("is null without a count or a population", () => {
    expect(rate(null, 1000)).toBeNull();
    expect(rate(5, 0)).toBeNull();
  });
});

describe("forceMonth", () => {
  it("is null (not zero) for a missing force-month", () => {
    expect(forceMonth(ds, "b", "2026-02")).toBeNull();
  });

  it("counts an absent category as 0", () => {
    const b = forceMonth(ds, "b", "2026-01");
    expect(b?.categories).toEqual([
      { category: "Burglary", count: 10 },
      { category: "Drugs", count: 0 },
      { category: "Robbery", count: 0 },
    ]);
    expect(b?.total).toBe(10);
    expect(b?.rate).toBe(5);
  });

  it("has a null rate when the population is unusable", () => {
    expect(forceMonth(ds, "z", "2026-01")?.rate).toBeNull();
  });
});

describe("national", () => {
  it("uses only reporting forces for numerator and population", () => {
    const n = national(ds, "2026-02");
    expect(n.reportingIds).toEqual(["a", CITY_OF_LONDON_ID]);
    expect(n.missingIds).toEqual(["b", "z"]);
    expect(n.total).toBe(16);
    expect(n.population).toBe(1100);
    expect(n.rate).toBeCloseTo((16 / 1100) * 1000, 12);
    expect(n.categories).toEqual([
      { category: "Burglary", count: 12 },
      { category: "Drugs", count: 4 },
      { category: "Robbery", count: 0 },
    ]);
  });

  it("gives the sparkline one national rate per month", () => {
    expect(nationalRateSeries(ds)).toEqual([
      national(ds, "2026-01").rate,
      national(ds, "2026-02").rate,
      national(ds, "2026-03").rate,
    ]);
    expect(national(ds, "2026-01").reporting).toBe(3);
  });
});

describe("rankForces", () => {
  it("ranks reporting forces only, so N excludes missing forces", () => {
    const r = rankForces(ds, "2026-02");
    expect(r.map((x) => [x.forceId, x.rank, x.of])).toEqual([
      [CITY_OF_LONDON_ID, 1, 2],
      ["a", 2, 2],
    ]);
  });

  it("breaks ties by id", () => {
    expect(rankForces(ds, "2026-03").map((x) => [x.forceId, x.rank])).toEqual([
      [CITY_OF_LONDON_ID, 1],
      ["a", 2],
      ["b", 3],
    ]);
  });
});

describe("highestRate", () => {
  it("skips City of London although it ranks first", () => {
    const h = highestRate(ds, "2026-02");
    expect(h?.forceId).toBe("a");
    expect(h?.rank).toBe(2);
    expect(h?.vsNational).toBeCloseTo(12 / ((16 / 1100) * 1000) - 1, 12);
  });
});

describe("monthOverMonth", () => {
  it("is null for the first month", () => {
    expect(monthOverMonth(ds, "2026-01")).toBeNull();
  });

  it("compares only forces reporting in both months", () => {
    const m = monthOverMonth(ds, "2026-02");
    expect(m?.prevMonth).toBe("2026-01");
    expect(m?.forceIds).toEqual(["a", CITY_OF_LONDON_ID]);
    expect(m?.current).toBe(16);
    expect(m?.previous).toBe(15);
    expect(m?.pct).toBeCloseTo(1 / 15, 12);
    expect(m?.ratePoints).toBeCloseTo((16 / 1100) * 1000 - (15 / 1100) * 1000, 12);
  });

  it("excludes a force missing in the previous month even when it reports now", () => {
    const m = monthOverMonth(ds, "2026-03");
    expect(m?.forceIds).toEqual(["a", CITY_OF_LONDON_ID]);
    expect(m?.current).toBe(12);
    expect(m?.previous).toBe(16);
    expect(m?.pct).toBe(-0.25);
  });

  it("gives category changes, null when the previous count is 0", () => {
    const cats = monthOverMonth(ds, "2026-03")?.categories;
    expect(cats).toEqual([
      { category: "Burglary", current: 11, previous: 12, pct: 11 / 12 - 1 },
      { category: "Drugs", current: 0, previous: 4, pct: -1 },
      { category: "Robbery", current: 1, previous: 0, pct: null },
    ]);
  });
});

describe("binIndex", () => {
  it("maps rates to classes 1–7 and no data to null", () => {
    expect(binIndex(null)).toBeNull();
    expect(binIndex(0)).toBe(1);
    expect(binIndex(5.49)).toBe(1);
    expect(binIndex(5.5)).toBe(2);
    expect(binIndex(10.49)).toBe(6);
    expect(binIndex(10.5)).toBe(7);
    expect(binIndex(48)).toBe(7);
  });
});

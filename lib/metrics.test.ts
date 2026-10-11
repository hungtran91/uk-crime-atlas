import { describe, expect, it } from "vitest";
import { createDataset, type CountRow, type Force, type Meta } from "@/lib/data";
import {
  binIndex,
  CITY_OF_LONDON_ID,
  forceCategories,
  forceChange,
  forceMonth,
  forceRateSeries,
  forceStanding,
  highestRate,
  monthOverMonth,
  national,
  nationalRateSeries,
  nationalWithout,
  rankBand,
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
  incompleteThreshold: 0.5,
  incomplete: {},
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

describe("forceRateSeries", () => {
  it("has a null, not a zero, for a missing month", () => {
    expect(forceRateSeries(ds, "a")).toEqual([10, 12, 10]);
    expect(forceRateSeries(ds, "b")).toEqual([5, null, 10]);
  });
});

describe("forceChange", () => {
  it("is null for the first month", () => {
    expect(forceChange(ds, "a", "2026-01")).toBeNull();
  });

  it("gives the change in rate points and in percent", () => {
    const c = forceChange(ds, "a", "2026-02");
    expect(c?.prevMonth).toBe("2026-01");
    expect(c?.ratePoints).toBeCloseTo(2, 12);
    expect(c?.pct).toBeCloseTo(0.2, 12);
  });

  it("is null when either month is missing", () => {
    expect(forceChange(ds, "b", "2026-02")).toBeNull();
    expect(forceChange(ds, "b", "2026-03")).toBeNull();
  });
});

describe("forceCategories", () => {
  it("is null for a missing force-month", () => {
    expect(forceCategories(ds, "b", "2026-02")).toBeNull();
  });

  it("puts the force rate next to the reporting-forces national rate", () => {
    const natRate = (count: number) => (count / 3100) * 1000;
    const cats = forceCategories(ds, "a", "2026-03");
    expect(cats?.map((c) => [c.category, c.count, c.per1000])).toEqual([
      ["Burglary", 9, 9],
      ["Drugs", 0, 0],
      ["Robbery", 1, 1],
    ]);
    expect(cats?.[0].nationalPer1000).toBeCloseTo(natRate(27), 12);
    expect(cats?.[0].vsNational).toBeCloseTo(9 / natRate(27) - 1, 12);
    expect(cats?.[1].vsNational).toBe(-1);
    expect(cats?.map((c) => c.momPct)).toEqual([0.125, -1, null]);
  });

  it("has no month-over-month change when the previous month is missing", () => {
    expect(forceCategories(ds, "b", "2026-03")?.every((c) => c.momPct === null)).toBe(true);
    expect(forceCategories(ds, "a", "2026-01")?.every((c) => c.momPct === null)).toBe(true);
  });
});

describe("rankBand", () => {
  it("splits reporting forces into top quartile, middle half and bottom quartile", () => {
    expect([1, 10, 11, 30, 31, 40].map((r) => rankBand(r, 40))).toEqual([
      "top", "top", "middle", "middle", "bottom", "bottom",
    ]);
    expect(rankBand(11, 41)).toBe("top");
    expect(rankBand(31, 41)).toBe("bottom");
  });
});

describe("nationalWithout", () => {
  it("recomputes the national rate without one force", () => {
    expect(nationalWithout(ds, "2026-01", "b")).toBeCloseTo((15 / 1100) * 1000, 12);
    expect(nationalWithout(ds, "2026-01", "z")).toBe(national(ds, "2026-01").rate);
  });
});

describe("forceStanding", () => {
  it("is null for a force that is not reporting", () => {
    expect(forceStanding(ds, "b", "2026-02")).toBeNull();
    expect(forceStanding(ds, "z", "2026-02")).toBeNull();
  });

  it("ranks among reporting forces and compares with their national rate", () => {
    const s = forceStanding(ds, "a", "2026-02");
    expect(s).toMatchObject({ rate: 12, total: 12, rank: 2, of: 2, band: "bottom" });
    expect(s?.vsNational).toBeCloseTo(12 / ((16 / 1100) * 1000) - 1, 12);
  });
});

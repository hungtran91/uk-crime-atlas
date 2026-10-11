// Checks lib/metrics against the figures validate.py computed independently in Python.
// Expected values come only from data/reference.json; rerun validate.py after any data refresh.
import { describe, expect, it } from "vitest";
import reference from "@/data/reference.json";
import { loadDataset } from "@/lib/data";
import {
  CITY_OF_LONDON_ID,
  forceChange,
  forceMonth,
  highestRate,
  monthOverMonth,
  national,
  nationalRateSeries,
  rankForces,
} from "@/lib/metrics";

const ds = loadDataset();
const PRECISION = 9;

describe("reference.json", () => {
  it("was generated from the committed data", () => {
    expect(reference.generatedFrom).toBe(ds.meta.generatedAt);
    expect(reference.latestMonth).toBe(ds.meta.latestMonth);
    expect(reference.national.map((n) => n.month)).toEqual(ds.meta.months);
  });
});

describe("national rate (reporting forces only)", () => {
  it.each(reference.national)("$month", (ref) => {
    const n = national(ds, ref.month);
    expect(n.reporting).toBe(ref.reporting);
    expect(n.rate).toBeCloseTo(ref.rate, PRECISION);
  });

  it("feeds the sparkline series", () => {
    const series = nationalRateSeries(ds);
    expect(series).toHaveLength(reference.national.length);
    series.forEach((v, i) => expect(v).toBeCloseTo(reference.national[i].rate, PRECISION));
  });
});

describe("month-over-month, like-for-like", () => {
  it("is null for the first month", () => {
    expect(monthOverMonth(ds, ds.meta.months[0])).toBeNull();
  });

  it.each(reference.monthOverMonth)("$month vs $prevMonth", (ref) => {
    const m = monthOverMonth(ds, ref.month);
    expect(m?.prevMonth).toBe(ref.prevMonth);
    expect(m?.forces).toBe(ref.forces);
    expect(m?.pct).toBeCloseTo(ref.pct, PRECISION);
    expect(m?.ratePoints).toBeCloseTo(ref.ratePoints, PRECISION);
  });
});

describe("latest-month ranks", () => {
  const ranked = rankForces(ds, reference.latestMonth);
  const { of, top, bottom } = reference.latestRanks;
  const pick = (r: { forceId: string; rank: number }) => [r.forceId, r.rank];

  it("counts only reporting forces", () => {
    expect(ranked).toHaveLength(of);
    expect(ranked.every((r) => r.of === of)).toBe(true);
  });

  it("matches the reference top and bottom three", () => {
    expect(ranked.slice(0, top.length).map(pick)).toEqual(top.map(pick));
    expect(ranked.slice(-bottom.length).map(pick)).toEqual(bottom.map(pick));
    [...top, ...bottom].forEach((ref) => {
      expect(ranked.find((r) => r.forceId === ref.forceId)?.rate).toBeCloseTo(ref.rate, PRECISION);
    });
  });

  it("ranks City of London but leaves it out of the highest-rate KPI", () => {
    expect(ranked.some((r) => r.forceId === CITY_OF_LONDON_ID)).toBe(true);
    const expected = top.find((r) => r.forceId !== CITY_OF_LONDON_ID);
    const h = highestRate(ds, reference.latestMonth);
    expect(h?.forceId).toBe(expected?.forceId);
    expect(h?.rank).toBe(expected?.rank);
  });
});

describe("missing force-months", () => {
  it.each(ds.meta.months)("%s: missing forces have no rate and no rank", (month) => {
    const missing = ds.meta.missing[month] ?? [];
    const n = national(ds, month);
    const rankedIds = new Set(rankForces(ds, month).map((r) => r.forceId));
    for (const id of missing) {
      expect(n.missingIds).toContain(id);
      expect(n.reportingIds).not.toContain(id);
      expect(rankedIds.has(id)).toBe(false);
    }
    expect(n.missingIds).toHaveLength(missing.length);
  });
});

describe("incomplete force-months", () => {
  it("are the ones validate.py found", () => {
    const listed = Object.entries(ds.meta.incomplete).flatMap(([month, entries]) =>
      entries.map((e) => ({ ...e, month })),
    );
    expect(listed).toHaveLength(reference.incomplete.length);
    for (const ref of reference.incomplete) expect(listed).toContainEqual(ref);
  });

  it.each(reference.incomplete)("$forceId $month has no rate, rank or change", (ref) => {
    expect(forceMonth(ds, ref.forceId, ref.month)).toBeNull();
    expect(national(ds, ref.month).reportingIds).not.toContain(ref.forceId);
    expect(rankForces(ds, ref.month).some((r) => r.forceId === ref.forceId)).toBe(false);
    expect(forceChange(ds, ref.forceId, ref.month)).toBeNull();
    const next = ds.meta.months[ds.meta.months.indexOf(ref.month) + 1];
    if (next) {
      expect(forceChange(ds, ref.forceId, next)).toBeNull();
      expect(monthOverMonth(ds, next)?.forceIds).not.toContain(ref.forceId);
    }
  });
});

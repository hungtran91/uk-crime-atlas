import { describe, expect, it } from "vitest";
import { loadDataset } from "@/lib/data";
import { loadMapGeometry, METROPOLITAN_ID } from "@/lib/geo";
import { CITY_OF_LONDON_ID, highestRate, monthOverMonth, national, rankForces } from "@/lib/metrics";
import { buildOverviewModel } from "@/lib/overview";
import { placeTooltip } from "@/lib/tooltip";

const ds = loadDataset();
const model = buildOverviewModel(ds);

describe("buildOverviewModel", () => {
  it("covers every month and force", () => {
    expect(model.months).toEqual(ds.meta.months);
    expect(model.latestMonth).toBe(ds.meta.latestMonth);
    expect(model.rateSeries).toHaveLength(ds.meta.months.length);
    for (const m of model.months) {
      expect(Object.keys(model.byMonth[m].rows).sort()).toEqual(ds.forces.map((f) => f.id).sort());
    }
  });

  it.each(ds.meta.months)("%s agrees with lib/metrics", (month) => {
    const o = model.byMonth[month];
    const nat = national(ds, month);
    const mom = monthOverMonth(ds, month);
    expect(o.total).toBe(nat.total);
    expect(o.rate).toBe(nat.rate);
    expect(o.reporting).toBe(nat.reporting);
    expect(o.missingNames).toHaveLength(ds.forces.length - nat.reporting);
    expect(o.mom?.pct ?? null).toBe(mom?.pct ?? null);
    expect(o.mom?.ratePoints ?? null).toBe(mom?.ratePoints ?? null);
    expect(o.highest?.forceId).toBe(highestRate(ds, month)?.forceId);
    expect(o.highest?.forceId).not.toBe(CITY_OF_LONDON_ID);

    for (const r of rankForces(ds, month)) {
      expect(o.rows[r.forceId]).toMatchObject({ rate: r.rate, rank: r.rank, of: nat.reporting });
    }
    for (const id of nat.missingIds) {
      expect(o.rows[id]).toEqual({ rate: null, total: null, rank: null, of: null, vsNational: null, bin: null });
    }
  });

  it.each(ds.meta.months)("%s categories are sorted and add up to the national total", (month) => {
    const o = model.byMonth[month];
    expect(o.categories.map((c) => c.category).sort()).toEqual(ds.categories);
    const counts = o.categories.map((c) => c.count);
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
    expect(counts.reduce((a, b) => a + b, 0)).toBe(o.total);
  });
});

describe("loadMapGeometry", () => {
  const geo = loadMapGeometry();

  it("has one non-empty path per force inside the viewBox", () => {
    expect(geo.areas.map((a) => a.id).sort()).toEqual(ds.forces.map((f) => f.id).sort());
    for (const a of geo.areas) {
      expect(a.d.startsWith("M")).toBe(true);
      const nums = a.d.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
      expect(Math.min(...nums)).toBeGreaterThanOrEqual(0);
      expect(Math.max(...nums)).toBeLessThanOrEqual(Math.max(geo.width, geo.height));
    }
  });

  it("has no area that fills the whole map (flipped ring)", () => {
    for (const a of [...geo.areas, ...geo.inset.areas]) {
      const xs = [...a.d.matchAll(/[ML](-?[\d.]+),/g)].map((m) => Number(m[1]));
      expect(xs.length).toBeGreaterThan(3);
      expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(geo.width / 2);
    }
  });

  it("puts the Met and City of London in the London inset", () => {
    expect(geo.inset.areas.map((a) => a.id).sort()).toEqual([CITY_OF_LONDON_ID, METROPOLITAN_ID].sort());
    expect(geo.inset.areas.every((a) => a.d.length > 0)).toBe(true);
    expect(geo.inset.x + geo.inset.width).toBeLessThanOrEqual(geo.width);
    expect(geo.inset.y + geo.inset.height).toBeLessThanOrEqual(geo.height);
  });
});

describe("placeTooltip", () => {
  const size = { width: 200, height: 100 };
  const viewport = { width: 1000, height: 800 };

  it("sits below-right of the anchor when there is room", () => {
    expect(placeTooltip({ x: 100, y: 100 }, size, viewport)).toEqual({ left: 114, top: 114 });
  });

  it("flips at the right and bottom edges", () => {
    expect(placeTooltip({ x: 950, y: 760 }, size, viewport)).toEqual({ left: 736, top: 646 });
  });

  it("never leaves the top-left of the viewport", () => {
    expect(placeTooltip({ x: 150, y: 50 }, size, { width: 300, height: 120 })).toEqual({ left: 8, top: 8 });
  });
});

import { describe, expect, it } from "vitest";
import { loadDataset } from "@/lib/data";
import { buildForceModel, rankDomain } from "@/lib/force";
import { CITY_OF_LONDON_ID, rankForces } from "@/lib/metrics";
import { buildOverviewModel } from "@/lib/overview";

const ds = loadDataset();
const overview = buildOverviewModel(ds);

describe("buildForceModel", () => {
  it("is null for an unknown force", () => {
    expect(buildForceModel(ds, "nowhere")).toBeNull();
  });

  it.each(ds.forces.map((f) => f.id))("%s matches the overview for every month", (id) => {
    const model = buildForceModel(ds, id);
    expect(model?.months).toEqual(ds.meta.months);
    for (const month of ds.meta.months) {
      const view = model?.byMonth[month];
      const row = overview.byMonth[month].rows[id];
      expect(view?.standing?.rate ?? null).toBe(row.rate);
      expect(view?.standing?.total ?? null).toBe(row.total);
      expect(view?.standing?.rank ?? null).toBe(row.rank);
      expect(view?.standing?.of ?? null).toBe(row.of);
      expect(view?.standing?.vsNational ?? null).toBe(row.vsNational);
      expect(view?.nationalRate).toBe(overview.byMonth[month].rate);
      expect(view?.reporting).toBe(overview.byMonth[month].reporting);
      expect(view?.ranked).toHaveLength(overview.byMonth[month].reporting);
    }
  });

  it.each(Object.entries(ds.meta.missing).flatMap(([month, ids]) => ids.map((id) => [id, month])))(
    "%s has no figures, not zeros, in %s",
    (id, month) => {
      const model = buildForceModel(ds, id);
      const view = model?.byMonth[month];
      expect(view?.standing).toBeNull();
      expect(view?.change).toBeNull();
      expect(view?.categories).toBeNull();
      expect(model?.rateSeries[ds.meta.months.indexOf(month)]).toBeNull();
      expect(view?.ranked.some((r) => r.forceId === id)).toBe(false);
    },
  );

  it("sorts categories largest first and they add up to the force total", () => {
    for (const month of ds.meta.months) {
      const view = buildForceModel(ds, "west-yorkshire")?.byMonth[month];
      const counts = view?.categories?.map((c) => c.count) ?? [];
      expect(counts).toHaveLength(ds.categories.length);
      expect(counts).toEqual([...counts].sort((a, b) => b - a));
      expect(counts.reduce((a, b) => a + b, 0)).toBe(view?.standing?.total);
    }
  });

  it("knows the last month a force published", () => {
    expect(buildForceModel(ds, "greater-manchester")?.latestAvailable).toBeNull();
    expect(buildForceModel(ds, "west-yorkshire")?.latestAvailable).toBe(ds.meta.latestMonth);
    const model = buildForceModel(ds, "gloucestershire");
    const firstMissing = ds.meta.months.find((m) => ds.meta.missing[m]?.includes("gloucestershire"));
    expect(firstMissing).toBeDefined();
    expect(model?.latestAvailable).toBe(ds.meta.months[ds.meta.months.indexOf(firstMissing as string) - 1]);
  });
});

describe("rankDomain", () => {
  it("holds every force except City of London in every month", () => {
    for (const month of ds.meta.months) {
      const { min, max } = rankDomain(ds, month);
      expect(buildForceModel(ds, "kent")?.byMonth[month].rankDomain).toEqual({ min, max });
      for (const r of rankForces(ds, month)) {
        if (r.forceId === CITY_OF_LONDON_ID) continue;
        expect(r.rate).toBeGreaterThan(min);
        expect(r.rate).toBeLessThan(max);
      }
    }
  });

  it("clips City of London", () => {
    const city = rankForces(ds, ds.meta.latestMonth).find((r) => r.forceId === CITY_OF_LONDON_ID);
    expect(city?.rate).toBeGreaterThan(rankDomain(ds, ds.meta.latestMonth).max);
  });
});

import { describe, expect, it } from "vitest";
import { createDataset, forceMonthCounts, hasRows, loadDataset, type CountRow, type Force, type Meta } from "@/lib/data";

const meta: Meta = {
  months: ["2026-01", "2026-02"],
  latestMonth: "2026-02",
  generatedAt: "2026-03-01T00:00:00Z",
  populationYear: 2024,
  excludedCategories: ["Anti-social behaviour"],
  missing: { "2026-02": ["b"] },
};
const forces: Force[] = [
  { id: "a", name: "A", onsCode: "E1", population: 1000 },
  { id: "b", name: "B", onsCode: "E2", population: 2000 },
];
const rows: CountRow[] = [
  { forceId: "a", month: "2026-01", category: "Drugs", count: 6 },
  { forceId: "a", month: "2026-01", category: "Burglary", count: 4 },
  { forceId: "b", month: "2026-01", category: "Burglary", count: 10 },
  { forceId: "a", month: "2026-02", category: "Burglary", count: 8 },
];

describe("createDataset", () => {
  it("indexes rows by force-month and sorts categories", () => {
    const ds = createDataset(meta, forces, rows);
    expect(ds.categories).toEqual(["Burglary", "Drugs"]);
    expect(Object.fromEntries(forceMonthCounts(ds, "a", "2026-01") ?? [])).toEqual({ Burglary: 4, Drugs: 6 });
    expect(hasRows(ds, "b", "2026-02")).toBe(false);
    expect(forceMonthCounts(ds, "b", "2026-02")).toBeNull();
  });

  it("throws when a force-month has no rows but is not listed as missing", () => {
    expect(() => createDataset({ ...meta, missing: {} }, forces, rows)).toThrow(/b 2026-02: no rows/);
  });

  it("throws when a force-month is listed as missing but has rows", () => {
    const listed = { ...meta, missing: { "2026-01": ["a"], "2026-02": ["b"] } };
    expect(() => createDataset(listed, forces, rows)).toThrow(/a 2026-01: listed as missing/);
  });

  it("throws on unknown forces, unknown months and excluded categories", () => {
    expect(() => createDataset(meta, forces, [...rows, { ...rows[0], forceId: "btp" }])).toThrow(/unknown force/);
    expect(() => createDataset(meta, forces, [...rows, { ...rows[0], month: "2025-12" }])).toThrow(/not in meta/);
    expect(() =>
      createDataset(meta, forces, [...rows, { ...rows[0], category: "Anti-social behaviour" }]),
    ).toThrow(/excluded category/);
  });
});

describe("loadDataset (committed data)", () => {
  const ds = loadDataset();

  it("has 43 forces with populations and no excluded categories", () => {
    expect(ds.forces).toHaveLength(43);
    expect(ds.forces.every((f) => f.population > 0)).toBe(true);
    for (const c of ds.meta.excludedCategories) expect(ds.categories).not.toContain(c);
    expect(ds.categories.length).toBeGreaterThan(0);
  });

  it("agrees with meta.missing for every force-month", () => {
    for (const m of ds.meta.months) {
      const missing = new Set(ds.meta.missing[m] ?? []);
      for (const f of ds.forces) expect(hasRows(ds, f.id, m)).toBe(!missing.has(f.id));
    }
  });
});

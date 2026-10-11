import countsJson from "@/data/counts.json";
import forcesJson from "@/data/forces.json";
import metaJson from "@/data/meta.json";

export interface Meta {
  months: string[];
  latestMonth: string;
  generatedAt: string;
  populationYear: number;
  excludedCategories: string[];
  missing: Record<string, string[]>;
}

export interface Force {
  id: string;
  name: string;
  onsCode: string;
  population: number;
}

export interface CountRow {
  forceId: string;
  month: string;
  category: string;
  count: number;
}

export interface Dataset {
  meta: Meta;
  forces: Force[];
  forceById: ReadonlyMap<string, Force>;
  /** Categories present anywhere in the data, sorted. */
  categories: string[];
  /** `${forceId}|${month}` → category → count. A key exists only for force-months with rows. */
  counts: ReadonlyMap<string, ReadonlyMap<string, number>>;
}

const key = (forceId: string, month: string) => `${forceId}|${month}`;

/** Indexes the raw rows and fails loudly if they disagree with meta (so `next build` fails too). */
export function createDataset(meta: Meta, forces: Force[], rows: CountRow[]): Dataset {
  const forceById = new Map(forces.map((f) => [f.id, f]));
  const months = new Set(meta.months);
  const excluded = new Set(meta.excludedCategories);
  const counts = new Map<string, Map<string, number>>();
  const categories = new Set<string>();

  for (const r of rows) {
    if (!forceById.has(r.forceId)) throw new Error(`counts: unknown force ${r.forceId}`);
    if (!months.has(r.month)) throw new Error(`counts: month ${r.month} not in meta.months`);
    if (excluded.has(r.category)) throw new Error(`counts: excluded category ${r.category}`);
    const k = key(r.forceId, r.month);
    let byCat = counts.get(k);
    if (!byCat) counts.set(k, (byCat = new Map()));
    byCat.set(r.category, (byCat.get(r.category) ?? 0) + r.count);
    categories.add(r.category);
  }

  for (const m of meta.months) {
    const listed = new Set(meta.missing[m] ?? []);
    for (const f of forces) {
      const hasRows = counts.has(key(f.id, m));
      if (hasRows && listed.has(f.id)) throw new Error(`${f.id} ${m}: listed as missing but has rows`);
      if (!hasRows && !listed.has(f.id)) throw new Error(`${f.id} ${m}: no rows but not listed as missing`);
    }
  }

  return { meta, forces, forceById, categories: [...categories].sort(), counts };
}

/** Category counts for a force-month, or null when the force published nothing that month. */
export function forceMonthCounts(ds: Dataset, forceId: string, month: string): ReadonlyMap<string, number> | null {
  return ds.counts.get(key(forceId, month)) ?? null;
}

export function hasRows(ds: Dataset, forceId: string, month: string): boolean {
  return ds.counts.has(key(forceId, month));
}

let cached: Dataset | undefined;

export function loadDataset(): Dataset {
  cached ??= createDataset(metaJson as Meta, forcesJson as Force[], countsJson as CountRow[]);
  return cached;
}

import { forceMonthCounts, type Dataset } from "@/lib/data";

export const CITY_OF_LONDON_ID = "city-of-london";

/** Upper-exclusive class breaks for the choropleth (design's fixed bins): 7 classes. */
export const RATE_BINS = [5.5, 6.5, 7.5, 8.5, 9.5, 10.5] as const;

export interface CategoryCount {
  category: string;
  count: number;
}

export interface ForceMonth {
  forceId: string;
  month: string;
  total: number;
  rate: number | null;
  /** Every dataset category, in dataset order; absent ones are 0. */
  categories: CategoryCount[];
}

export type ReportingForceMonth = ForceMonth & { rate: number };

export interface NationalMonth {
  month: string;
  total: number;
  population: number;
  rate: number | null;
  reporting: number;
  reportingIds: string[];
  missingIds: string[];
  categories: CategoryCount[];
}

export interface RankedForce {
  forceId: string;
  rate: number;
  total: number;
  rank: number;
  of: number;
}

export interface HighestRate extends RankedForce {
  /** rate / national rate − 1 */
  vsNational: number | null;
}

export interface CategoryChange {
  category: string;
  current: number;
  previous: number;
  pct: number | null;
}

export interface MonthOverMonth {
  month: string;
  prevMonth: string;
  /** Forces reporting in both months; every figure below uses only these. */
  forces: number;
  forceIds: string[];
  current: number;
  previous: number;
  pct: number | null;
  /** Change in crimes per 1,000 over the same forces' combined population. */
  ratePoints: number | null;
  categories: CategoryChange[];
}

/** Crimes per 1,000 residents. The only place a rate is computed. */
export function rate(count: number | null, population: number): number | null {
  if (count === null || !(population > 0)) return null;
  return (count / population) * 1000;
}

function ratio(current: number, previous: number): number | null {
  return previous > 0 ? current / previous - 1 : null;
}

function population(ds: Dataset, forceId: string): number {
  return ds.forceById.get(forceId)?.population ?? 0;
}

/** Null when the force published no data for the month (missing, never 0). */
export function forceMonth(ds: Dataset, forceId: string, month: string): ForceMonth | null {
  const counts = forceMonthCounts(ds, forceId, month);
  if (!counts) return null;
  const categories = ds.categories.map((category) => ({ category, count: counts.get(category) ?? 0 }));
  const total = categories.reduce((a, c) => a + c.count, 0);
  return { forceId, month, total, rate: rate(total, population(ds, forceId)), categories };
}

/** Reporting = has rows that month AND a usable population, so it counts in both numerator and denominator. */
export function reportingForces(ds: Dataset, month: string): ReportingForceMonth[] {
  return ds.forces.flatMap((f) => {
    const fm = forceMonth(ds, f.id, month);
    return fm && fm.rate !== null ? [{ ...fm, rate: fm.rate }] : [];
  });
}

function sumCategories(rows: ForceMonth[], categories: string[]): CategoryCount[] {
  return categories.map((category, i) => ({ category, count: rows.reduce((a, r) => a + r.categories[i].count, 0) }));
}

export function national(ds: Dataset, month: string): NationalMonth {
  const rows = reportingForces(ds, month);
  const reportingIds = rows.map((r) => r.forceId);
  const reportingSet = new Set(reportingIds);
  const total = rows.reduce((a, r) => a + r.total, 0);
  const pop = reportingIds.reduce((a, id) => a + population(ds, id), 0);
  return {
    month,
    total,
    population: pop,
    rate: rows.length ? rate(total, pop) : null,
    reporting: rows.length,
    reportingIds,
    missingIds: ds.forces.filter((f) => !reportingSet.has(f.id)).map((f) => f.id),
    categories: sumCategories(rows, ds.categories),
  };
}

/** National rate for every month in order; the sparkline series (rates, never counts). */
export function nationalRateSeries(ds: Dataset): (number | null)[] {
  return ds.meta.months.map((m) => national(ds, m).rate);
}

/** Reporting forces by rate, highest first (ties by id). City of London is included. */
export function rankForces(ds: Dataset, month: string): RankedForce[] {
  const rows = reportingForces(ds, month);
  rows.sort((a, b) => b.rate - a.rate || (a.forceId < b.forceId ? -1 : a.forceId > b.forceId ? 1 : 0));
  return rows.map((r, i) => ({ forceId: r.forceId, rate: r.rate, total: r.total, rank: i + 1, of: rows.length }));
}

/** Highest-rate KPI: City of London is ranked but excluded here (tiny resident population). */
export function highestRate(ds: Dataset, month: string): HighestRate | null {
  const top = rankForces(ds, month).find((r) => r.forceId !== CITY_OF_LONDON_ID);
  if (!top) return null;
  const nat = national(ds, month).rate;
  return { ...top, vsNational: nat ? top.rate / nat - 1 : null };
}

/** Like-for-like change vs the previous month: only forces reporting in both. Null for the first month. */
export function monthOverMonth(ds: Dataset, month: string): MonthOverMonth | null {
  const i = ds.meta.months.indexOf(month);
  if (i <= 0) return null;
  const prevMonth = ds.meta.months[i - 1];
  const prevById = new Map(reportingForces(ds, prevMonth).map((r) => [r.forceId, r]));
  const cur = reportingForces(ds, month).filter((r) => prevById.has(r.forceId));
  const prev = cur.map((r) => prevById.get(r.forceId) as ReportingForceMonth);
  const current = cur.reduce((a, r) => a + r.total, 0);
  const previous = prev.reduce((a, r) => a + r.total, 0);
  const pop = cur.reduce((a, r) => a + population(ds, r.forceId), 0);
  const curRate = rate(current, pop);
  const prevRate = rate(previous, pop);
  const curCats = sumCategories(cur, ds.categories);
  const prevCats = sumCategories(prev, ds.categories);
  return {
    month,
    prevMonth,
    forces: cur.length,
    forceIds: cur.map((r) => r.forceId),
    current,
    previous,
    pct: ratio(current, previous),
    ratePoints: curRate !== null && prevRate !== null ? curRate - prevRate : null,
    categories: curCats.map((c, k) => ({
      category: c.category,
      current: c.count,
      previous: prevCats[k].count,
      pct: ratio(c.count, prevCats[k].count),
    })),
  };
}

/** Choropleth class 1–7, or null for no data. */
export function binIndex(value: number | null): number | null {
  if (value === null) return null;
  let i = 0;
  while (i < RATE_BINS.length && value >= RATE_BINS[i]) i++;
  return i + 1;
}

export interface ForceChange {
  prevMonth: string;
  /** Change in crimes per 1,000; same convention as MonthOverMonth.ratePoints. */
  ratePoints: number;
  pct: number | null;
}

export interface ForceCategory {
  category: string;
  count: number;
  per1000: number | null;
  /** National count over the reporting forces' population. */
  nationalPer1000: number | null;
  /** per1000 / nationalPer1000 − 1 */
  vsNational: number | null;
  /** Null when the force published nothing in the previous month. */
  momPct: number | null;
}

export type RankBand = "top" | "middle" | "bottom";

/** A force's rate for every month in order; null where it published nothing (a gap, never 0). */
export function forceRateSeries(ds: Dataset, forceId: string): (number | null)[] {
  return ds.meta.months.map((m) => forceMonth(ds, forceId, m)?.rate ?? null);
}

/** One force vs its own previous month. Null for the first month or when either month has no rate. */
export function forceChange(ds: Dataset, forceId: string, month: string): ForceChange | null {
  const i = ds.meta.months.indexOf(month);
  if (i <= 0) return null;
  const prevMonth = ds.meta.months[i - 1];
  const cur = forceMonth(ds, forceId, month);
  const prev = forceMonth(ds, forceId, prevMonth);
  if (!cur || !prev || cur.rate === null || prev.rate === null) return null;
  return { prevMonth, ratePoints: cur.rate - prev.rate, pct: ratio(cur.total, prev.total) };
}

/** Per-category rates for a force next to the national rate, in dataset order. Null when the force did not report. */
export function forceCategories(ds: Dataset, forceId: string, month: string): ForceCategory[] | null {
  const cur = forceMonth(ds, forceId, month);
  if (!cur) return null;
  const i = ds.meta.months.indexOf(month);
  const prev = i > 0 ? forceMonth(ds, forceId, ds.meta.months[i - 1]) : null;
  const nat = national(ds, month);
  const pop = population(ds, forceId);
  return cur.categories.map((c, k) => {
    const per1000 = rate(c.count, pop);
    const nationalPer1000 = nat.reporting ? rate(nat.categories[k].count, nat.population) : null;
    return {
      category: c.category,
      count: c.count,
      per1000,
      nationalPer1000,
      vsNational: per1000 !== null && nationalPer1000 ? per1000 / nationalPer1000 - 1 : null,
      momPct: prev ? ratio(c.count, prev.categories[k].count) : null,
    };
  });
}

/** Where a rank sits among the reporting forces (rank 1 = highest rate). */
export function rankBand(rank: number, of: number): RankBand {
  if (rank <= Math.ceil(of / 4)) return "top";
  return rank > of * 0.75 ? "bottom" : "middle";
}

/** National rate with one force left out: shows how a force dropping out moves the national figure. */
export function nationalWithout(ds: Dataset, month: string, forceId: string): number | null {
  const rows = reportingForces(ds, month).filter((r) => r.forceId !== forceId);
  if (!rows.length) return null;
  const total = rows.reduce((a, r) => a + r.total, 0);
  return rate(total, rows.reduce((a, r) => a + population(ds, r.forceId), 0));
}

export interface ForceStanding extends RankedForce {
  band: RankBand;
  /** rate / national rate − 1 */
  vsNational: number | null;
}

/** A force's rate, rank and distance from the national rate. Null when it is not reporting that month. */
export function forceStanding(ds: Dataset, forceId: string, month: string): ForceStanding | null {
  const r = rankForces(ds, month).find((x) => x.forceId === forceId);
  if (!r) return null;
  const nat = national(ds, month).rate;
  return { ...r, band: rankBand(r.rank, r.of), vsNational: nat ? r.rate / nat - 1 : null };
}

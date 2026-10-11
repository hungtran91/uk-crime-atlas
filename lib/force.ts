import type { Dataset } from "@/lib/data";
import {
  CITY_OF_LONDON_ID,
  forceCategories,
  forceChange,
  forceRateSeries,
  forceStanding,
  national,
  nationalRateSeries,
  rankForces,
  type ForceCategory,
  type ForceChange,
  type ForceStanding,
} from "@/lib/metrics";

export interface RankDot {
  forceId: string;
  rate: number;
  rank: number;
}

export interface ForceMonthView {
  month: string;
  /** Null when the force published no data for the month. */
  standing: ForceStanding | null;
  change: ForceChange | null;
  /** Largest first; null when the force published no data. */
  categories: ForceCategory[] | null;
  nationalRate: number | null;
  reporting: number;
  /** Every reporting force, highest rate first, for the rank plot. */
  ranked: RankDot[];
  rankDomain: RankDomain;
}

/** Everything one force page needs for every month; small enough to send to the client. */
export interface ForceModel {
  force: { id: string; name: string; population: number };
  months: string[];
  latestMonth: string;
  forces: { id: string; name: string }[];
  rateSeries: (number | null)[];
  nationalSeries: (number | null)[];
  /** Last month the force published data for, if any. */
  latestAvailable: string | null;
  byMonth: Record<string, ForceMonthView>;
}

export interface RankDomain {
  min: number;
  max: number;
}

/**
 * Axis range for one month's rank plot. City of London is left out (its rate is several times
 * any other) and is drawn clipped at the edge.
 */
export function rankDomain(ds: Dataset, month: string): RankDomain {
  const rates = rankForces(ds, month)
    .filter((r) => r.forceId !== CITY_OF_LONDON_ID)
    .map((r) => r.rate);
  if (!rates.length) return { min: 0, max: 1 };
  return { min: Math.floor(Math.min(...rates) - 0.5), max: Math.ceil(Math.max(...rates) + 0.5) };
}

function buildMonth(ds: Dataset, forceId: string, month: string): ForceMonthView {
  const nat = national(ds, month);
  const categories = forceCategories(ds, forceId, month);
  return {
    month,
    standing: forceStanding(ds, forceId, month),
    change: forceChange(ds, forceId, month),
    categories:
      categories && categories.slice().sort((a, b) => b.count - a.count || (a.category < b.category ? -1 : 1)),
    nationalRate: nat.rate,
    reporting: nat.reporting,
    ranked: rankForces(ds, month).map((r) => ({ forceId: r.forceId, rate: r.rate, rank: r.rank })),
    rankDomain: rankDomain(ds, month),
  };
}

export function buildForceModel(ds: Dataset, forceId: string): ForceModel | null {
  const force = ds.forceById.get(forceId);
  if (!force) return null;
  const rateSeries = forceRateSeries(ds, forceId);
  const lastIndex = rateSeries.findLastIndex((v) => v !== null);
  return {
    force: { id: force.id, name: force.name, population: force.population },
    months: ds.meta.months,
    latestMonth: ds.meta.latestMonth,
    forces: ds.forces.map((f) => ({ id: f.id, name: f.name })),
    rateSeries,
    nationalSeries: nationalRateSeries(ds),
    latestAvailable: lastIndex < 0 ? null : ds.meta.months[lastIndex],
    byMonth: Object.fromEntries(ds.meta.months.map((m) => [m, buildMonth(ds, forceId, m)])),
  };
}

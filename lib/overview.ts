import type { Dataset } from "@/lib/data";
import { binIndex, highestRate, monthOverMonth, national, nationalRateSeries, rankForces, rate } from "@/lib/metrics";

export interface OverviewForceRow {
  /** All null when the force has no data for the month. */
  rate: number | null;
  total: number | null;
  rank: number | null;
  of: number | null;
  vsNational: number | null;
  bin: number | null;
}

export interface OverviewCategory {
  category: string;
  count: number;
  share: number | null;
  per1000: number | null;
  /** Like-for-like change vs the previous month. */
  momPct: number | null;
}

export interface OverviewMonth {
  month: string;
  total: number;
  rate: number | null;
  reporting: number;
  missingNames: string[];
  mom: { prevMonth: string; forces: number; pct: number | null; ratePoints: number | null } | null;
  highest: { forceId: string; name: string; rate: number; vsNational: number | null } | null;
  rows: Record<string, OverviewForceRow>;
  /** Every category, largest first. */
  categories: OverviewCategory[];
}

/** Everything the overview page needs for every month; small enough to send to the client. */
export interface OverviewModel {
  months: string[];
  latestMonth: string;
  forces: { id: string; name: string }[];
  /** National rate per month, for the sparkline. */
  rateSeries: (number | null)[];
  byMonth: Record<string, OverviewMonth>;
}

const NO_DATA: OverviewForceRow = { rate: null, total: null, rank: null, of: null, vsNational: null, bin: null };

function buildMonth(ds: Dataset, month: string): OverviewMonth {
  const nat = national(ds, month);
  const mom = monthOverMonth(ds, month);
  const top = highestRate(ds, month);
  const name = (id: string) => ds.forceById.get(id)?.name ?? id;

  const rows: Record<string, OverviewForceRow> = Object.fromEntries(ds.forces.map((f) => [f.id, NO_DATA]));
  for (const r of rankForces(ds, month)) {
    rows[r.forceId] = {
      rate: r.rate,
      total: r.total,
      rank: r.rank,
      of: r.of,
      vsNational: nat.rate ? r.rate / nat.rate - 1 : null,
      bin: binIndex(r.rate),
    };
  }

  const momByCategory = new Map(mom?.categories.map((c) => [c.category, c.pct]));
  const categories = nat.categories
    .slice()
    .sort((a, b) => b.count - a.count || (a.category < b.category ? -1 : 1))
    .map((c) => ({
      category: c.category,
      count: c.count,
      share: nat.total > 0 ? c.count / nat.total : null,
      per1000: rate(c.count, nat.population),
      momPct: momByCategory.get(c.category) ?? null,
    }));

  return {
    month,
    total: nat.total,
    rate: nat.rate,
    reporting: nat.reporting,
    missingNames: nat.missingIds.map(name),
    mom: mom && { prevMonth: mom.prevMonth, forces: mom.forces, pct: mom.pct, ratePoints: mom.ratePoints },
    highest: top && { forceId: top.forceId, name: name(top.forceId), rate: top.rate, vsNational: top.vsNational },
    rows,
    categories,
  };
}

export function buildOverviewModel(ds: Dataset): OverviewModel {
  return {
    months: ds.meta.months,
    latestMonth: ds.meta.latestMonth,
    forces: ds.forces.map((f) => ({ id: f.id, name: f.name })),
    rateSeries: nationalRateSeries(ds),
    byMonth: Object.fromEntries(ds.meta.months.map((m) => [m, buildMonth(ds, m)])),
  };
}

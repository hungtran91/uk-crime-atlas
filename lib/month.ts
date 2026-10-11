export const MONTH_PARAM = "month";

/** The month a `?month=` value selects: anything absent or not in the data falls back to the latest month. */
export function parseMonth(value: string | null | undefined, months: readonly string[], latest: string): string {
  return value && months.includes(value) ? value : latest;
}

/** Calendar days in a "YYYY-MM" month. */
export function daysInMonth(month: string): number {
  return new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();
}

/** Groups the selected months into runs that are consecutive in `all`: [first, last] pairs, in order. */
export function monthRuns(selected: readonly string[], all: readonly string[]): [string, string][] {
  const picked = new Set(selected);
  const runs: [string, string][] = [];
  let open = false;
  for (const m of all) {
    if (!picked.has(m)) open = false;
    else if (open) runs[runs.length - 1][1] = m;
    else {
      runs.push([m, m]);
      open = true;
    }
  }
  return runs;
}

/** Adds `?month=` to an internal path. The latest month is the default, so it is left out. */
export function withMonth(path: string, month: string, latest: string): string {
  return month === latest ? path : `${path}?${MONTH_PARAM}=${month}`;
}

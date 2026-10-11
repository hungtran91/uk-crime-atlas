export const MONTH_PARAM = "month";

/** The month a `?month=` value selects: anything absent or not in the data falls back to the latest month. */
export function parseMonth(value: string | null | undefined, months: readonly string[], latest: string): string {
  return value && months.includes(value) ? value : latest;
}

/** Adds `?month=` to an internal path. The latest month is the default, so it is left out. */
export function withMonth(path: string, month: string, latest: string): string {
  return month === latest ? path : `${path}?${MONTH_PARAM}=${month}`;
}

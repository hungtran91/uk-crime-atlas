// Ported from design/ds/atlas-ds.js `fmt`. Minus signs use U+2212 as in the design.
const nf0 = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("en-GB", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const MINUS = "−";

/** Sign prefix for an already-rounded string, so a value that rounds to zero gets no sign. */
function signed(v: number, digits: string): string {
  if (Number(digits) === 0) return digits;
  return (v > 0 ? "+" : MINUS) + digits;
}

export const fmt = {
  int: (v: number) => nf0.format(v),
  dec1: (v: number) => nf1.format(v),
  dec2: (v: number) => nf2.format(v),
  compact: (v: number) => (v >= 1e6 ? nf1.format(v / 1e6) + "M" : v >= 1e4 ? nf0.format(v / 1e3) + "k" : nf0.format(v)),
  /** Ratio change as a signed percentage: 0.065 → "+6.5%". */
  pct: (v: number, decimals = 1) => signed(v, Math.abs(v * 100).toFixed(decimals)) + "%",
  /** Signed absolute change: 0.472 → "+0.47". */
  change: (v: number, decimals = 2) => signed(v, Math.abs(v).toFixed(decimals)),
  ordinal: (n: number) => {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  },
};

/** "2nd of 40 reporting" */
export function rankLabel(rank: number, of: number): string {
  return `${fmt.ordinal(rank)} of ${of} reporting`;
}

// Fixed names rather than toLocaleDateString: ICU versions differ ("Sep" vs "Sept"),
// which would make server and client render different text.
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-07" → "Jul" */
export function monthShort(month: string): string {
  return MONTH_NAMES[Number(month.slice(5, 7)) - 1];
}

/** "2026-07" → "Jul 2026" */
export function monthLabel(month: string): string {
  return `${monthShort(month)} ${month.slice(0, 4)}`;
}

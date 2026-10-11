import { fmt } from "@/lib/format";
import { RATE_BINS } from "@/lib/metrics";

const first = RATE_BINS[0];
const last = RATE_BINS[RATE_BINS.length - 1];
const LABELS = [
  `<${fmt.dec1(first)}`,
  ...RATE_BINS.slice(0, -1).map((t, i) => `${fmt.dec1(t)}–${fmt.dec1(RATE_BINS[i + 1])}`),
  `≥${fmt.dec1(last)}`,
];

export default function Legend() {
  return (
    <div className="legend map-legend">
      <div className="legend-row between">
        <span>Crimes per 1,000 residents, month</span>
        <span className="legend-item">
          <span className="sw nodata-fill" />
          No data
        </span>
      </div>
      <div className="legend-scale" aria-hidden="true">
        {LABELS.map((label, i) => (
          <span key={label} className={`seq-${i + 1}`} title={label} />
        ))}
      </div>
      <div className="legend-ticks">
        {LABELS.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
    </div>
  );
}

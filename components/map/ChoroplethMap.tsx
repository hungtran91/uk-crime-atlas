"use client";

import Link from "next/link";
import { useId, useState, type FocusEvent, type MouseEvent } from "react";
import Tooltip from "@/components/map/Tooltip";
import { fmt, monthLabel, rankLabel } from "@/lib/format";
import type { MapArea, MapGeometry } from "@/lib/geo";
import { withMonth } from "@/lib/month";
import type { OverviewForceRow } from "@/lib/overview";

interface Props {
  geometry: MapGeometry;
  month: string;
  latestMonth: string;
  rows: Record<string, OverviewForceRow>;
  names: Record<string, string>;
}

interface Active {
  id: string;
  d: string;
  anchor: { x: number; y: number };
}

export default function ChoroplethMap({ geometry, month, latestMonth, rows, names }: Props) {
  const [active, setActive] = useState<Active | null>(null);
  const tooltipId = useId();
  const row = active ? rows[active.id] : null;

  // inert=true: the London inset repeats two forces, so it is hover/click only and skipped by keyboard and screen readers.
  const renderArea = (a: MapArea, inert: boolean) => {
    const r = rows[a.id];
    const label = `${names[a.id]}: ${r.rate === null ? "no data" : `${fmt.dec2(r.rate)} crimes per 1,000 residents`}`;
    return (
      <Link
        key={a.id}
        href={withMonth(`/force/${a.id}`, month, latestMonth)}
        prefetch={false}
        aria-label={label}
        aria-describedby={!inert && active?.id === a.id ? tooltipId : undefined}
        aria-hidden={inert || undefined}
        tabIndex={inert ? -1 : undefined}
        onMouseMove={(e: MouseEvent) => setActive({ id: a.id, d: a.d, anchor: { x: e.clientX, y: e.clientY } })}
        onMouseLeave={() => setActive(null)}
        onFocus={(e: FocusEvent<Element>) => {
          // No pointer position on keyboard focus: anchor to the area itself.
          const box = e.currentTarget.getBoundingClientRect();
          setActive({ id: a.id, d: a.d, anchor: { x: box.right, y: box.top + box.height / 2 } });
        }}
        onBlur={() => setActive(null)}
        onKeyDown={(e) => e.key === "Escape" && setActive(null)}
      >
        <path className={r.bin === null ? "area nodata" : `area seq-${r.bin}`} d={a.d} />
      </Link>
    );
  };

  const { inset, leader } = geometry;

  return (
    <div className="map-wrap">
      <svg
        viewBox={`0 0 ${geometry.width} ${geometry.height}`}
        role="group"
        aria-label={`Map of crimes per 1,000 residents by police force area, ${monthLabel(month)}`}
      >
        <defs>
          <pattern id="nodata-hatch" width={5} height={5} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect className="hatch-bg" width={5} height={5} />
            <line className="hatch-line" x1={0} y1={0} x2={0} y2={5} />
          </pattern>
        </defs>
        <line className="inset-leader" {...leader} />
        <g>{geometry.areas.map((a) => renderArea(a, false))}</g>
        <g>
          <rect className="inset-box" x={inset.x} y={inset.y} width={inset.width} height={inset.height} rx={6} />
          <text className="inset-label" x={inset.x + 10} y={inset.y + 15}>
            London
          </text>
          {inset.areas.map((a) => renderArea(a, true))}
        </g>
        {active && <path className="area-hl" d={active.d} />}
      </svg>
      <Tooltip id={tooltipId} anchor={active?.anchor ?? null}>
        {active && row && (
          <>
            <div className="tt-title">{names[active.id]}</div>
            {row.rate === null ? (
              <div className="tt-row">
                <span>No data published for {monthLabel(month)}</span>
              </div>
            ) : (
              <>
                <TooltipRow label="Per 1,000 residents" value={fmt.dec2(row.rate)} />
                {row.total !== null && <TooltipRow label="Recorded crimes" value={fmt.int(row.total)} />}
                {row.rank !== null && row.of !== null && (
                  <TooltipRow label="Rank (highest first)" value={rankLabel(row.rank, row.of)} />
                )}
                {row.vsNational !== null && (
                  <TooltipRow label="vs national average" value={fmt.pct(row.vsNational, 0)} />
                )}
              </>
            )}
            <div className="tt-hint">Click to open force detail</div>
          </>
        )}
      </Tooltip>
    </div>
  );
}

function TooltipRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="tt-row">
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

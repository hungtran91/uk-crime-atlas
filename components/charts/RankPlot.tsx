"use client";

import Link from "next/link";
import { useId, useState, type FocusEvent, type MouseEvent } from "react";
import Tooltip from "@/components/map/Tooltip";
import type { RankDomain, RankDot } from "@/lib/force";
import { fmt, rankLabel } from "@/lib/format";

interface Props {
  ranked: RankDot[];
  domain: RankDomain;
  nationalRate: number | null;
  currentId: string;
  names: Record<string, string>;
  hrefFor: (forceId: string) => string;
}

interface Active {
  dot: RankDot;
  anchor: { x: number; y: number };
}

/** One dot per reporting force along a rate axis. Each dot is a link, so the plot works by keyboard. */
export default function RankPlot({ ranked, domain, nationalRate, currentId, names, hrefFor }: Props) {
  const [active, setActive] = useState<Active | null>(null);
  const tooltipId = useId();
  const span = domain.max - domain.min;
  const pct = (v: number) => `${((v - domain.min) / span) * 100}%`;
  const step = span > 10 ? 2 : 1;
  const ticks = Array.from({ length: Math.floor(span / step) + 1 }, (_, i) => domain.min + i * step);
  // Lowest rate first, so tabbing moves left to right.
  const dots = ranked.slice().reverse();
  const current = ranked.find((d) => d.forceId === currentId);
  const currentOver = current !== undefined && current.rate > domain.max;
  const currentShare = current ? (current.rate - domain.min) / span : 0;
  const nameAlign = currentOver ? " over" : currentShare > 0.85 ? " end" : currentShare < 0.15 ? " start" : "";

  return (
    <div className="rank-plot">
      {ticks.map((t) => (
        <span key={t} aria-hidden="true">
          <span className="rank-grid" style={{ left: pct(t) }} />
          <span className="rank-tick" style={{ left: pct(t) }}>
            {fmt.dec1(t)}
          </span>
        </span>
      ))}
      {nationalRate !== null && (
        <>
          <span className="rank-ref" style={{ left: pct(nationalRate) }} />
          <span className="rank-ref-label" style={{ left: pct(nationalRate) }}>
            National average {fmt.dec2(nationalRate)}
          </span>
        </>
      )}
      {dots.map((d) => {
        const over = d.rate > domain.max;
        const isCurrent = d.forceId === currentId;
        return (
          <Link
            key={d.forceId}
            href={hrefFor(d.forceId)}
            prefetch={false}
            className={`rank-dot${over ? " over" : ""}${isCurrent ? " hl" : ""}`}
            style={over ? undefined : { left: pct(d.rate) }}
            aria-label={`${names[d.forceId]}: ${fmt.dec2(d.rate)} per 1,000 residents, ${rankLabel(d.rank, ranked.length)}`}
            aria-current={isCurrent ? "page" : undefined}
            aria-describedby={active?.dot.forceId === d.forceId ? tooltipId : undefined}
            onMouseMove={(e: MouseEvent) => setActive({ dot: d, anchor: { x: e.clientX, y: e.clientY } })}
            onMouseLeave={() => setActive(null)}
            onFocus={(e: FocusEvent<Element>) => {
              const box = e.currentTarget.getBoundingClientRect();
              setActive({ dot: d, anchor: { x: box.right, y: box.bottom } });
            }}
            onBlur={() => setActive(null)}
            onKeyDown={(e) => e.key === "Escape" && setActive(null)}
          />
        );
      })}
      {current && (
        <span
          className={`rank-name${nameAlign}`}
          style={currentOver ? undefined : { left: pct(current.rate) }}
          aria-hidden="true"
        >
          {names[current.forceId]}
          {currentOver && ` ${fmt.dec1(current.rate)}`}
        </span>
      )}
      <Tooltip id={tooltipId} anchor={active?.anchor ?? null}>
        {active && (
          <>
            <div className="tt-title">{names[active.dot.forceId]}</div>
            <div className="tt-row">
              <span>Per 1,000 residents</span>
              <b>{fmt.dec2(active.dot.rate)}</b>
            </div>
            <div className="tt-row">
              <span>Rank (highest first)</span>
              <b>{rankLabel(active.dot.rank, ranked.length)}</b>
            </div>
            {active.dot.rate > domain.max && <div className="tt-hint">Beyond the axis: shown at the edge</div>}
          </>
        )}
      </Tooltip>
    </div>
  );
}

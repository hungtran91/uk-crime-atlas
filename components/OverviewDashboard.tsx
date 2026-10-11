"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import Delta from "@/components/cards/Delta";
import Sparkline from "@/components/cards/Sparkline";
import TopCategories from "@/components/charts/TopCategories";
import FilterBar from "@/components/filters/FilterBar";
import ChoroplethMap from "@/components/map/ChoroplethMap";
import Legend from "@/components/map/Legend";
import { fmt, monthLabel } from "@/lib/format";
import type { MapGeometry } from "@/lib/geo";
import type { OverviewModel } from "@/lib/overview";

export default function OverviewDashboard({ model, geometry }: { model: OverviewModel; geometry: MapGeometry }) {
  const [month, setMonth] = useState(model.latestMonth);
  const names = useMemo(() => Object.fromEntries(model.forces.map((f) => [f.id, f.name])), [model.forces]);
  const data = model.byMonth[month];
  const { mom, highest } = data;
  const label = monthLabel(month);
  const missing = data.missingNames;

  return (
    <div className="page">
      <div className="page-h">
        <div className="lead">
          <h1 className="h1">National overview</h1>
          <p className="muted page-sub">
            Police recorded crime across the {model.forces.length} territorial forces of England and Wales.
          </p>
        </div>
      </div>

      <FilterBar
        months={model.months}
        month={month}
        onMonthChange={setMonth}
        forces={model.forces}
        reporting={data.reporting}
      />

      <div className="kpi-row">
        <div className="card kpi">
          <div className="kpi-label">Recorded crimes</div>
          <div className="kpi-value">{fmt.int(data.total)}</div>
          <div />
          <div className="kpi-meta">
            {mom && mom.pct !== null ? (
              <>
                <Delta change={mom.pct} />
                <span>vs {monthLabel(mom.prevMonth)}, like-for-like</span>
              </>
            ) : (
              <span>First month in range</span>
            )}
          </div>
        </div>

        <div className="card kpi">
          <div className="kpi-label">Crimes per 1,000 residents</div>
          <div className="kpi-value">{data.rate === null ? "—" : fmt.dec2(data.rate)}</div>
          <Sparkline
            values={model.rateSeries}
            label={`National crimes per 1,000 residents, ${monthLabel(model.months[0])} to ${monthLabel(model.latestMonth)}`}
          />
          <div className="kpi-meta">
            {mom && mom.ratePoints !== null ? (
              <>
                <Delta change={mom.ratePoints} text={fmt.change(mom.ratePoints)} />
                <span>
                  per 1,000 vs {monthLabel(mom.prevMonth)}, like-for-like ({mom.forces} forces)
                </span>
              </>
            ) : (
              <span>First month in range</span>
            )}
          </div>
        </div>

        <div className="card kpi">
          <div className="kpi-label">
            Highest rate <span className="subtle">· excl. City of London</span>
          </div>
          <div className="kpi-value name">
            {highest ? <Link href={`/force/${highest.forceId}`}>{highest.name}</Link> : "—"}
          </div>
          <div />
          <div className="kpi-meta">
            {highest && (
              <>
                <span className="num strong">{fmt.dec2(highest.rate)}</span>
                <span>per 1,000</span>
                {highest.vsNational !== null && (
                  <Delta change={highest.vsNational} text={`${fmt.pct(highest.vsNational, 0)} vs avg`} />
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <div className="grid-12">
        <section className="card span-7">
          <div className="card-h">
            <div className="titles">
              <h2 className="card-t">Crimes per 1,000 residents by police force area</h2>
              <div className="card-s">{label} · hover for detail, click to open a force</div>
            </div>
          </div>
          <div className="card-b">
            <ChoroplethMap geometry={geometry} month={month} rows={data.rows} names={names} />
            <Legend />
          </div>
          {missing.length > 0 && (
            <div className="card-f">
              <span className="legend-item">
                <span className="sw nodata-fill" />
                <span>
                  {missing.join(", ")}: no data published for {label}. National figures exclude{" "}
                  {missing.length === 1 ? "this force" : "these forces"}. <Link href="/methodology">Methodology</Link>
                </span>
              </span>
            </div>
          )}
        </section>

        <section className="card span-5">
          <div className="card-h">
            <div className="titles">
              <h2 className="card-t">Crime categories</h2>
              <div className="card-s">
                {data.reporting} reporting forces · {label} · recorded crimes
              </div>
            </div>
          </div>
          <div className="card-b">
            <TopCategories categories={data.categories} label={`Crime categories by recorded crimes, ${label}`} />
          </div>
        </section>
      </div>
    </div>
  );
}

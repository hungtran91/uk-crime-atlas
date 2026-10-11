"use client";

import Link from "next/link";
import { useMemo } from "react";
import Delta from "@/components/cards/Delta";
import Sparkline from "@/components/cards/Sparkline";
import TopCategories from "@/components/charts/TopCategories";
import FilterBar from "@/components/filters/FilterBar";
import ChoroplethMap from "@/components/map/ChoroplethMap";
import WithMonth from "@/components/WithMonth";
import Legend from "@/components/map/Legend";
import { fmt, monthLabel } from "@/lib/format";
import type { MapGeometry } from "@/lib/geo";
import { withMonth } from "@/lib/month";
import type { OverviewModel } from "@/lib/overview";

interface Props {
  model: OverviewModel;
  geometry: MapGeometry;
}

export default function OverviewDashboard(props: Props) {
  return (
    <WithMonth months={props.model.months} latest={props.model.latestMonth}>
      {(month, setMonth) => <OverviewView {...props} month={month} onMonthChange={setMonth} />}
    </WithMonth>
  );
}

function OverviewView({
  model,
  geometry,
  month,
  onMonthChange,
}: Props & { month: string; onMonthChange: (month: string) => void }) {
  const href = (path: string) => withMonth(path, month, model.latestMonth);
  const names = useMemo(() => Object.fromEntries(model.forces.map((f) => [f.id, f.name])), [model.forces]);
  const data = model.byMonth[month];
  const { mom, highest } = data;
  const label = monthLabel(month);
  const { notPublishedNames, incompleteNames } = data;
  const excluded = notPublishedNames.length + incompleteNames.length;

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
        latestMonth={model.latestMonth}
        onMonthChange={onMonthChange}
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
            {highest ? (
              <Link href={href(`/force/${highest.forceId}`)} prefetch={false}>
                {highest.name}
              </Link>
            ) : (
              "—"
            )}
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
            <ChoroplethMap geometry={geometry} month={month} latestMonth={model.latestMonth} rows={data.rows} names={names} />
            <Legend />
          </div>
          {excluded > 0 && (
            <div className="card-f">
              <span className="legend-item">
                <span className="sw nodata-fill" />
                <span>
                  {notPublishedNames.length > 0 && `${notPublishedNames.join(", ")}: no data published for ${label}. `}
                  {incompleteNames.length > 0 && `${incompleteNames.join(", ")}: incomplete data for ${label} — excluded. `}
                  National figures exclude {excluded === 1 ? "this force" : "these forces"}.{" "}
                  <Link href={href("/methodology")}>Methodology</Link>
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

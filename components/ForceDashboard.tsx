"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import Delta from "@/components/cards/Delta";
import Sparkline from "@/components/cards/Sparkline";
import { CategoryChart, CategoryTable } from "@/components/charts/CategoryBreakdown";
import RankPlot from "@/components/charts/RankPlot";
import TrendChart from "@/components/charts/TrendChart";
import FilterBar from "@/components/filters/FilterBar";
import WithMonth from "@/components/WithMonth";
import type { ForceModel } from "@/lib/force";
import { fmt, monthLabel, noDataLabel } from "@/lib/format";
import { CITY_OF_LONDON_ID, type RankBand } from "@/lib/metrics";
import { withMonth } from "@/lib/month";

const BAND_LABEL: Record<RankBand, string> = {
  top: "Top quartile",
  middle: "Middle half",
  bottom: "Bottom quartile",
};

export default function ForceDashboard({ model }: { model: ForceModel }) {
  return (
    <WithMonth months={model.months} latest={model.latestMonth}>
      {(month, setMonth) => <ForceView model={model} month={month} onMonthChange={setMonth} />}
    </WithMonth>
  );
}

function ForceView({
  model,
  month,
  onMonthChange,
}: {
  model: ForceModel;
  month: string;
  onMonthChange: (month: string) => void;
}) {
  const [view, setView] = useState<"chart" | "table">("chart");
  const names = useMemo(() => Object.fromEntries(model.forces.map((f) => [f.id, f.name])), [model.forces]);
  const { force } = model;
  const data = model.byMonth[month];
  const { standing, change, categories } = data;
  const label = monthLabel(month);
  const incomplete = data.noData === "incomplete";
  const noData = noDataLabel(data.noData ?? "not-published", month);
  const range = `${monthLabel(model.months[0])} – ${monthLabel(model.latestMonth)}`;
  const href = (path: string) => withMonth(path, month, model.latestMonth);

  return (
    <div className="page">
      <div className="page-h">
        <div className="lead">
          <div className="crumb">
            <Link href={href("/")}>National overview</Link>
            <span>/</span>
            <span>Force detail</span>
          </div>
          <h1 className="h1">{force.name}</h1>
          <p className="muted page-sub">
            Resident population {fmt.int(force.population)}
            {force.id === CITY_OF_LONDON_ID &&
              " · rates are inflated by the small resident population relative to daytime visitors"}
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
        currentForce={force.id}
      />

      <div className="kpi-row">
        <div className="card kpi">
          <div className="kpi-label">Crimes per 1,000 residents</div>
          <div className="kpi-value">{standing ? fmt.dec2(standing.rate) : "—"}</div>
          {model.latestAvailable ? (
            <Sparkline
              values={model.rateSeries}
              label={`${force.name} crimes per 1,000 residents, ${monthLabel(model.months[0])} to ${monthLabel(model.latestMonth)}`}
            />
          ) : (
            <div />
          )}
          <div className="kpi-meta">
            {!standing ? (
              <span>{noData}</span>
            ) : change ? (
              <>
                <Delta change={change.ratePoints} text={fmt.change(change.ratePoints)} />
                <span>
                  per 1,000 vs {monthLabel(change.prevMonth)}
                  {change.pct !== null && ` (${fmt.pct(change.pct)})`} · {fmt.int(standing.total)} crimes
                </span>
              </>
            ) : (
              <span>{fmt.int(standing.total)} crimes</span>
            )}
          </div>
        </div>

        <div className="card kpi">
          <div className="kpi-label">Rank, highest rate first</div>
          <div className="kpi-value">
            {standing ? (
              <>
                {fmt.ordinal(standing.rank)}
                <small>of {standing.of} reporting</small>
              </>
            ) : (
              "—"
            )}
          </div>
          <div />
          <div className="kpi-meta">
            <span>{standing ? `${BAND_LABEL[standing.band]} of reporting forces` : "Not ranked this month"}</span>
          </div>
        </div>

        <div className="card kpi">
          <div className="kpi-label">vs national average</div>
          <div className="kpi-value">
            {standing && standing.vsNational !== null ? fmt.pct(standing.vsNational, 0) : "—"}
          </div>
          <div />
          <div className="kpi-meta">
            {standing && standing.vsNational !== null && data.nationalRate !== null && (
              <>
                <Delta change={standing.vsNational} text={standing.vsNational > 0 ? "Above" : "Below"} />
                <span>
                  {fmt.dec2(standing.rate)} vs {fmt.dec2(data.nationalRate)} per 1,000
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="grid-12">
        <section className="card span-7">
          <div className="card-h">
            <div className="titles">
              <h2 className="card-t">Category breakdown</h2>
              <div className="card-s">{label} · crimes per 1,000 residents</div>
            </div>
            <div className="seg" role="group" aria-label="Category view">
              <button type="button" aria-pressed={view === "chart"} onClick={() => setView("chart")}>
                Chart
              </button>
              <button type="button" aria-pressed={view === "table"} onClick={() => setView("table")}>
                Table
              </button>
            </div>
          </div>
          <div className="card-b">
            {!categories ? (
              <div className="empty">
                <span className="nodata-fill" aria-hidden="true" />
                <span className="empty-t">{noData}</span>
                <span className="empty-s">
                  {incomplete
                    ? `${force.name} published only part of this month's crimes, so it is left out of rates and rankings.`
                    : `${force.name} has not published crime data for this month.`}{" "}
                  {model.latestAvailable
                    ? `Latest available: ${monthLabel(model.latestAvailable)}.`
                    : `Nothing was published from ${monthLabel(model.months[0])} to ${monthLabel(model.latestMonth)}.`}{" "}
                  <Link href={href("/methodology")}>Methodology</Link>
                </span>
              </div>
            ) : view === "chart" ? (
              <CategoryChart
                categories={categories}
                forceName={force.name}
                label={`${force.name} crimes per 1,000 residents by category against the national rate, ${label}`}
              />
            ) : (
              <CategoryTable categories={categories} />
            )}
          </div>
        </section>

        <section className="card span-5">
          <div className="card-h">
            <div className="titles">
              <h2 className="card-t">12-month trend</h2>
              <div className="card-s">Crimes per 1,000 residents · {range}</div>
            </div>
          </div>
          <div className="card-b">
            <TrendChart
              months={model.months}
              force={model.rateSeries}
              national={model.nationalSeries}
              forceName={force.name}
              selected={month}
              label={`${force.name} and national crimes per 1,000 residents by month, ${range}`}
            />
          </div>
        </section>

        <section className="card span-12">
          <div className="card-h">
            <div className="titles">
              <h2 className="card-t">Rank against other forces</h2>
              <div className="card-s">
                {label} · {standing ? "each dot is one police force · click a dot to switch force" : "reporting forces only"}
              </div>
            </div>
          </div>
          <div className="card-b">
            {standing ? (
              <RankPlot
                ranked={data.ranked}
                domain={data.rankDomain}
                nationalRate={data.nationalRate}
                currentId={force.id}
                names={names}
                hrefFor={(id) => href(`/force/${id}`)}
              />
            ) : (
              <div className="empty">
                <span className="nodata-fill" aria-hidden="true" />
                <span className="empty-t">Not ranked this month</span>
                <span className="empty-s">
                  {incomplete
                    ? "Forces with incomplete data are excluded from the national ranking."
                    : "Forces without published data are excluded from the national ranking."}
                </span>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

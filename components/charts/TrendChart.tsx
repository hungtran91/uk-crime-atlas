"use client";

import { Bar, CartesianGrid, ComposedChart, Line, Tooltip, XAxis, YAxis } from "recharts";
import { NATIONAL_LABEL } from "@/components/charts/CategoryBreakdown";
import { useElementWidth } from "@/components/charts/useElementWidth";
import { fmt, monthLabel, monthShort } from "@/lib/format";

const HEIGHT = 250;

interface Point {
  month: string;
  force: number | null;
  national: number | null;
  /** 1 where the force published nothing: drawn as a hatched band, so a gap never reads as zero. */
  gap: number | null;
}

interface Props {
  months: string[];
  force: (number | null)[];
  national: (number | null)[];
  forceName: string;
  selected: string;
  label: string;
}

function TrendTooltip({
  active,
  payload,
  forceName,
}: {
  active?: boolean;
  payload?: readonly { payload: Point }[];
  forceName: string;
}) {
  const p = payload?.[0]?.payload;
  if (!active || !p) return null;
  return (
    <div className="tooltip static">
      <div className="tt-title">{monthLabel(p.month)}</div>
      <div className="tt-row">
        <span className="legend-item">
          <span className="sw-line sw-force" />
          {forceName}
        </span>
        <b>{p.force === null ? "No data" : fmt.dec2(p.force)}</b>
      </div>
      <div className="tt-row">
        <span className="legend-item">
          <span className="sw-dash" />
          {NATIONAL_LABEL}
        </span>
        <b>{p.national === null ? "No data" : fmt.dec2(p.national)}</b>
      </div>
    </div>
  );
}

export default function TrendChart({ months, force, national, forceName, selected, label }: Props) {
  const data: Point[] = months.map((month, i) => ({
    month,
    force: force[i],
    national: national[i],
    gap: force[i] === null ? 1 : null,
  }));
  const selectedIndex = months.indexOf(selected);
  const hasGap = force.some((v) => v === null);
  const [ref, width] = useElementWidth<HTMLDivElement>();

  return (
    <>
      <div ref={ref} className="trend" role="img" aria-label={label} style={{ height: HEIGHT }}>
        {/* No category gap: gap bands fill their month, so consecutive missing months join into one block. */}
        {width !== null && width > 0 && (
          <ComposedChart
            width={width}
            height={HEIGHT}
            data={data}
            margin={{ top: 12, right: 8, bottom: 0, left: 0 }}
            barCategoryGap={0}
          >
            <defs>
              <pattern id="trend-hatch" width={5} height={5} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect className="hatch-bg" width={5} height={5} />
                <line className="hatch-line" x1={0} y1={0} x2={0} y2={5} />
              </pattern>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="month" tickFormatter={monthShort} interval={0} tickLine={false} axisLine={false} />
            <YAxis
              width={40}
              domain={["auto", "auto"]}
              tickCount={5}
              tickFormatter={fmt.dec1}
              tickLine={false}
              axisLine={false}
            />
            <YAxis yAxisId="gap" hide domain={[0, 1]} />
            <Tooltip content={<TrendTooltip forceName={forceName} />} isAnimationActive={false} />
            <Bar
              yAxisId="gap"
              className="trend-gap"
              dataKey="gap"
              fill="url(#trend-hatch)"
              activeBar={false}
              isAnimationActive={false}
            />
            <Line
              className="line-national"
              dataKey="national"
              type="monotone"
              strokeWidth={1.5}
              strokeDasharray="4 3"
              dot={false}
              activeDot={false}
              isAnimationActive={false}
            />
            <Line
              className="line-force"
              dataKey="force"
              type="monotone"
              strokeWidth={2}
              activeDot={false}
              isAnimationActive={false}
              dot={({ cx, cy, index, value }) =>
                value != null && cx != null && cy != null ? (
                  <circle
                    key={index}
                    className={index === selectedIndex ? "trend-dot selected" : "trend-dot"}
                    cx={cx}
                    cy={cy}
                    r={index === selectedIndex ? 4 : 2.5}
                  />
                ) : (
                  <g key={index} />
                )
              }
            />
          </ComposedChart>
        )}
      </div>
      <div className="legend-row caption chart-legend">
        <span className="legend-item">
          <span className="sw-line sw-force" />
          {forceName}
        </span>
        <span className="legend-item">
          <span className="sw-dash" />
          {NATIONAL_LABEL}
        </span>
        {hasGap && (
          <span className="legend-item">
            <span className="sw nodata-fill" />
            No data
          </span>
        )}
      </div>
    </>
  );
}

"use client";

import { Bar, BarChart, Tooltip, XAxis, YAxis } from "recharts";
import { useElementWidth } from "@/components/charts/useElementWidth";
import { fmt } from "@/lib/format";
import type { OverviewCategory } from "@/lib/overview";

const ROW_HEIGHT = 22;
const BAR_HEIGHT = 16;
const LABEL_WIDTH = 170;
const VALUE_WIDTH = 48;

function CategoryTooltip({ active, payload }: { active?: boolean; payload?: readonly { payload: OverviewCategory }[] }) {
  const c = payload?.[0]?.payload;
  if (!active || !c) return null;
  const rows: [string, string][] = [["Crimes", fmt.int(c.count)]];
  if (c.share !== null) rows.push(["Share of all crime", `${(c.share * 100).toFixed(1)}%`]);
  if (c.per1000 !== null) rows.push(["Per 1,000 residents", fmt.dec2(c.per1000)]);
  if (c.momPct !== null) rows.push(["vs previous month", fmt.pct(c.momPct)]);
  return (
    <div className="tooltip static">
      <div className="tt-title">{c.category}</div>
      {rows.map(([k, v]) => (
        <div key={k} className="tt-row">
          <span>{k}</span>
          <b>{v}</b>
        </div>
      ))}
    </div>
  );
}

export default function TopCategories({ categories, label }: { categories: OverviewCategory[]; label: string }) {
  const max = Math.max(...categories.map((c) => c.count), 1) * 1.04;
  const countByCategory = new Map(categories.map((c) => [c.category, c.count]));
  const height = categories.length * ROW_HEIGHT;
  const [ref, width] = useElementWidth<HTMLDivElement>();

  return (
    <div ref={ref} className="cat-chart" role="img" aria-label={label} style={{ height }}>
      {width !== null && width > 0 && (
        <BarChart
          width={width}
          height={height}
          data={categories}
          layout="vertical"
          margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
          barCategoryGap={0}
        >
          <XAxis type="number" hide domain={[0, max]} />
          <YAxis
            type="category"
            dataKey="category"
            width={LABEL_WIDTH}
            axisLine={false}
            tickLine={false}
            interval={0}
            tick={({ y, payload }) => (
              <text className="cat-label" x={0} y={y} dy="0.35em" textAnchor="start">
                {payload.value}
              </text>
            )}
          />
          <YAxis
            yAxisId="values"
            orientation="right"
            type="category"
            dataKey="category"
            width={VALUE_WIDTH}
            axisLine={false}
            tickLine={false}
            interval={0}
            tick={({ x, y, payload }) => (
              <text className="cat-value" x={Number(x) + VALUE_WIDTH - 8} y={y} dy="0.35em" textAnchor="end">
                {fmt.compact(countByCategory.get(payload.value) ?? 0)}
              </text>
            )}
          />
          <Tooltip content={<CategoryTooltip />} cursor={false} isAnimationActive={false} />
          <Bar dataKey="count" barSize={BAR_HEIGHT} radius={2} background={{ radius: 2 }} isAnimationActive={false} />
        </BarChart>
      )}
    </div>
  );
}

"use client";

import { Bar, BarChart, Tooltip, XAxis, YAxis, type BarShapeProps } from "recharts";
import Delta from "@/components/cards/Delta";
import { useElementWidth } from "@/components/charts/useElementWidth";
import { fmt } from "@/lib/format";
import type { ForceCategory } from "@/lib/metrics";

export const NATIONAL_LABEL = "England & Wales (reporting forces)";

const ROW_HEIGHT = 22;
const BAR_HEIGHT = 16;
const LABEL_WIDTH = 170;
const VALUE_WIDTH = 48;
const TICK_OVERHANG = 3;

const dash = <span className="subtle">—</span>;

function CategoryTooltip({ active, payload }: { active?: boolean; payload?: readonly { payload: ForceCategory }[] }) {
  const c = payload?.[0]?.payload;
  if (!active || !c) return null;
  const rows: [string, string][] = [["Crimes", fmt.int(c.count)]];
  if (c.per1000 !== null) rows.push(["Per 1,000 residents", fmt.dec2(c.per1000)]);
  if (c.nationalPer1000 !== null) rows.push(["National per 1,000", fmt.dec2(c.nationalPer1000)]);
  if (c.vsNational !== null) rows.push(["vs national", fmt.pct(c.vsNational, 0)]);
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

interface Props {
  categories: ForceCategory[];
  forceName: string;
  label: string;
}

export function CategoryChart({ categories, forceName, label }: Props) {
  const max = Math.max(...categories.flatMap((c) => [c.per1000 ?? 0, c.nationalPer1000 ?? 0]), 0.01) * 1.04;
  const rateByCategory = new Map(categories.map((c) => [c.category, c.per1000]));
  const height = categories.length * ROW_HEIGHT;
  const [ref, width] = useElementWidth<HTMLDivElement>();

  // The bar plus a tick at the national rate. `background` is the full-width track, so it gives the axis extent.
  const renderBar = ({ x, y, width, height, background, payload }: BarShapeProps) => {
    const national = (payload as ForceCategory).nationalPer1000;
    const track = background?.x != null && background.width != null ? { x: background.x, width: background.width } : null;
    return (
      <g>
        <rect className="cat-bar" x={x} y={y} width={Math.max(width ?? 0, 0)} height={height} rx={2} />
        {national !== null && track && (
          <rect
            className="nat-tick"
            x={track.x + (track.width * national) / max - 1}
            y={(y ?? 0) - TICK_OVERHANG}
            width={2}
            height={(height ?? 0) + 2 * TICK_OVERHANG}
            rx={1}
          />
        )}
      </g>
    );
  };

  return (
    <>
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
              tick={({ x, y, payload }) => {
                const v = rateByCategory.get(payload.value) ?? null;
                return (
                  <text className="cat-value" x={Number(x) + VALUE_WIDTH - 8} y={y} dy="0.35em" textAnchor="end">
                    {v === null ? "—" : fmt.dec2(v)}
                  </text>
                );
              }}
            />
            <Tooltip content={<CategoryTooltip />} cursor={false} isAnimationActive={false} />
            <Bar
              dataKey="per1000"
              barSize={BAR_HEIGHT}
              background={{ radius: 2 }}
              shape={renderBar}
              isAnimationActive={false}
            />
          </BarChart>
        )}
      </div>
      <div className="legend-row caption chart-legend">
        <span className="legend-item">
          <span className="sw sw-force" />
          {forceName}
        </span>
        <span className="legend-item">
          <span className="sw-tick" />
          {NATIONAL_LABEL}
        </span>
      </div>
    </>
  );
}

export function CategoryTable({ categories }: { categories: ForceCategory[] }) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th scope="col">Category</th>
            <th scope="col" className="r">
              Crimes
            </th>
            <th scope="col" className="r">
              Per 1,000
            </th>
            <th scope="col" className="r">
              National
            </th>
            <th scope="col" className="r">
              vs national
            </th>
            <th scope="col" className="r">
              vs prev. month
            </th>
          </tr>
        </thead>
        <tbody>
          {categories.map((c) => (
            <tr key={c.category}>
              <th scope="row">{c.category}</th>
              <td className="r">{fmt.int(c.count)}</td>
              <td className="r">{c.per1000 === null ? dash : fmt.dec2(c.per1000)}</td>
              <td className="r muted">{c.nationalPer1000 === null ? dash : fmt.dec2(c.nationalPer1000)}</td>
              <td className="r">
                {c.vsNational === null ? dash : <Delta change={c.vsNational} text={fmt.pct(c.vsNational, 0)} />}
              </td>
              <td className="r">{c.momPct === null ? dash : <Delta change={c.momPct} />}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

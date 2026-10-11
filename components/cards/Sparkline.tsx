"use client";

import { Line, LineChart, YAxis } from "recharts";

const WIDTH = 96;
const HEIGHT = 30;

export default function Sparkline({ values, label }: { values: (number | null)[]; label: string }) {
  const data = values.map((v, i) => ({ i, v }));
  const last = values.findLastIndex((v) => v !== null);

  return (
    <div className="kpi-spark spark" role="img" aria-label={label}>
      <LineChart width={WIDTH} height={HEIGHT} data={data} margin={{ top: 3, right: 3, bottom: 3, left: 2 }}>
        <YAxis hide domain={["dataMin", "dataMax"]} />
        <Line
          dataKey="v"
          type="monotone"
          strokeWidth={1.5}
          isAnimationActive={false}
          activeDot={false}
          dot={({ cx, cy, index }) =>
            index === last && cx != null && cy != null ? (
              <circle key={index} className="spark-dot" cx={cx} cy={cy} r={2.5} />
            ) : (
              <g key={index} />
            )
          }
        />
      </LineChart>
    </div>
  );
}

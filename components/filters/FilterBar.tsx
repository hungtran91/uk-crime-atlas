"use client";

import { useRouter } from "next/navigation";
import { monthLabel } from "@/lib/format";

interface Props {
  months: string[];
  month: string;
  onMonthChange: (month: string) => void;
  forces: { id: string; name: string }[];
  reporting: number;
}

export default function FilterBar({ months, month, onMonthChange, forces, reporting }: Props) {
  const router = useRouter();
  const index = months.indexOf(month);

  return (
    <div className="filter-bar">
      <div className="field">
        <label htmlFor="month">Month</label>
        <div className="stepper">
          <button
            type="button"
            className="btn btn-icon"
            aria-label="Previous month"
            disabled={index <= 0}
            onClick={() => onMonthChange(months[index - 1])}
          >
            ‹
          </button>
          <select id="month" className="select" value={month} onChange={(e) => onMonthChange(e.target.value)}>
            {months.map((m) => (
              <option key={m} value={m}>
                {monthLabel(m)}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn-icon"
            aria-label="Next month"
            disabled={index >= months.length - 1}
            onClick={() => onMonthChange(months[index + 1])}
          >
            ›
          </button>
        </div>
      </div>
      <div className="field">
        <label htmlFor="goto">Go to force</label>
        <select
          id="goto"
          className="select select-force"
          value=""
          onChange={(e) => e.target.value && router.push(`/force/${e.target.value}`)}
        >
          <option value="">Select a force…</option>
          {forces.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </div>
      <div className="spacer" />
      <span className="chip">
        <span className={reporting < forces.length ? "dot partial" : "dot"} />
        {reporting} of {forces.length} forces reporting
      </span>
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { monthLabel } from "@/lib/format";
import { withMonth } from "@/lib/month";

interface Props {
  months: string[];
  month: string;
  latestMonth: string;
  onMonthChange: (month: string) => void;
  forces: { id: string; name: string }[];
  reporting: number;
  /** On a force page: the force select shows this force instead of a "go to" placeholder. */
  currentForce?: string;
}

export default function FilterBar({ months, month, latestMonth, onMonthChange, forces, reporting, currentForce }: Props) {
  const router = useRouter();
  const index = months.indexOf(month);

  const monthField = (
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
  );

  const forceField = (
    <div className="field">
      <label htmlFor="force">{currentForce ? "Police force" : "Go to force"}</label>
      <select
        id="force"
        className="select select-force"
        value={currentForce ?? ""}
        onChange={(e) => e.target.value && router.push(withMonth(`/force/${e.target.value}`, month, latestMonth))}
      >
        {!currentForce && <option value="">Select a force…</option>}
        {forces.map((f) => (
          <option key={f.id} value={f.id}>
            {f.name}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <div className="filter-bar">
      {currentForce ? forceField : monthField}
      {currentForce ? monthField : forceField}
      <div className="spacer" />
      <span className="chip">
        <span className={reporting < forces.length ? "dot partial" : "dot"} />
        {reporting} of {forces.length} forces reporting
      </span>
    </div>
  );
}

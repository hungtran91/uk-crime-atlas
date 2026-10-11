"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { MONTH_PARAM, parseMonth } from "@/lib/month";

type Render = (month: string, setMonth: (month: string) => void) => ReactNode;

interface Props {
  months: string[];
  latest: string;
  children: Render;
}

function FromUrl({ months, latest, children }: Props) {
  const params = useSearchParams();
  const month = parseMonth(params.get(MONTH_PARAM), months, latest);

  // replaceState keeps the page static (no request) and adds no history entry; Next syncs useSearchParams from it.
  const setMonth = (next: string) => {
    const query = new URLSearchParams(params.toString());
    if (next === latest) query.delete(MONTH_PARAM);
    else query.set(MONTH_PARAM, next);
    const qs = query.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  };

  return children(month, setMonth);
}

/**
 * Renders its children with the month from `?month=`. Pages are prerendered without search params,
 * so the static HTML is the latest-month view (the Suspense fallback) and the URL takes over on the client.
 */
export default function WithMonth(props: Props) {
  return (
    <Suspense fallback={props.children(props.latest, () => {})}>
      <FromUrl {...props} />
    </Suspense>
  );
}

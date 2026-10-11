"use client";

import { usePathname } from "next/navigation";
import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { MONTH_PARAM, parseMonth } from "@/lib/month";

type Render = (month: string, setMonth: (month: string) => void) => ReactNode;

interface Props {
  months: string[];
  latest: string;
  children: Render;
}

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("popstate", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("popstate", listener);
  };
}

const getSearch = () => window.location.search;
const getServerSearch = () => "";

/**
 * Renders its children with the month from `?month=`. Pages are prerendered without search params,
 * so the static HTML is the latest-month view; it hydrates as is and the URL takes over afterwards.
 * The query string is read from the location rather than useSearchParams, which would make the
 * prerender bail out to client rendering and rebuild the whole page after load.
 */
export default function WithMonth({ months, latest, children }: Props) {
  const pathname = usePathname();
  const search = useSyncExternalStore(subscribe, getSearch, getServerSearch);
  const month = parseMonth(new URLSearchParams(search).get(MONTH_PARAM), months, latest);

  // Next changes the URL on navigation without an event: re-read it once the new route has committed.
  useEffect(notify, [pathname]);

  // replaceState keeps the page static (no request) and adds no history entry.
  const setMonth = (next: string) => {
    const query = new URLSearchParams(window.location.search);
    if (next === latest) query.delete(MONTH_PARAM);
    else query.set(MONTH_PARAM, next);
    const qs = query.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
    notify();
  };

  return children(month, setMonth);
}

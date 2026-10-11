"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Width of an element in whole pixels, tracked with a ResizeObserver; null until first measured.
 * Charts take this as an explicit width, so their size never depends on Recharts' own measuring.
 */
export function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setWidth(Math.floor(el.getBoundingClientRect().width));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  return [ref, width] as const;
}

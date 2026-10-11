"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import { placeTooltip } from "@/lib/tooltip";

interface Props {
  id: string;
  /** Viewport coordinates to sit next to; null hides the tooltip. */
  anchor: { x: number; y: number } | null;
  children: ReactNode;
}

export default function Tooltip({ id, anchor, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  // Measured after render because the size depends on the content.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !anchor) return;
    const { left, top } = placeTooltip(
      anchor,
      { width: el.offsetWidth, height: el.offsetHeight },
      { width: window.innerWidth, height: window.innerHeight },
    );
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
  });

  return (
    // The role only while shown: an empty tooltip has no accessible name.
    <div ref={ref} id={id} role={anchor ? "tooltip" : undefined} className={anchor ? "tooltip on" : "tooltip"}>
      {children}
    </div>
  );
}

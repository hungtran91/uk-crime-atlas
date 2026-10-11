const OFFSET = 14;
const MARGIN = 8;

/**
 * Top-left position for a fixed tooltip next to an anchor point (pointer or focused element),
 * flipped to the other side when it would leave the viewport.
 */
export function placeTooltip(
  anchor: { x: number; y: number },
  size: { width: number; height: number },
  viewport: { width: number; height: number },
): { left: number; top: number } {
  let left = anchor.x + OFFSET;
  let top = anchor.y + OFFSET;
  if (left + size.width > viewport.width - MARGIN) left = anchor.x - size.width - OFFSET;
  if (top + size.height > viewport.height - MARGIN) top = anchor.y - size.height - OFFSET;
  return { left: Math.max(MARGIN, left), top: Math.max(MARGIN, top) };
}

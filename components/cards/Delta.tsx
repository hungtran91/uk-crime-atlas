import { fmt } from "@/lib/format";

const FLAT_THRESHOLD = 0.0005;

// Rising crime is "bad": up arrows are red, down arrows green.
export default function Delta({ change, text }: { change: number; text?: string }) {
  const dir = Math.abs(change) < FLAT_THRESHOLD ? "flat" : change > 0 ? "up" : "down";
  const tone = dir === "flat" ? "neutral" : dir === "up" ? "bad" : "good";
  return <span className={`delta ${dir} ${tone}`}>{text ?? fmt.pct(change)}</span>;
}

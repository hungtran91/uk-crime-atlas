import NavLinks from "@/components/NavLinks";
import ThemeToggle from "@/components/ThemeToggle";
import { loadDataset } from "@/lib/data";

export default function AppHeader() {
  const { months, latestMonth } = loadDataset().meta;

  return (
    <header className="app-bar">
      <NavLinks months={months} latest={latestMonth} />
      <div className="spacer" />
      <span className="caption">Source: data.police.uk · excl. anti-social behaviour</span>
      <ThemeToggle />
    </header>
  );
}

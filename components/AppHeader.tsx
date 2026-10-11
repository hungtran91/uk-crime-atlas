import Link from "next/link";
import NavLinks from "@/components/NavLinks";
import ThemeToggle from "@/components/ThemeToggle";

export default function AppHeader() {
  return (
    <header className="app-bar">
      <Link href="/" className="brand">
        <span className="brand-mark" aria-hidden="true" />
        UK Crime Atlas
      </Link>
      <NavLinks />
      <div className="spacer" />
      <span className="caption">Source: data.police.uk · excl. anti-social behaviour</span>
      <ThemeToggle />
    </header>
  );
}

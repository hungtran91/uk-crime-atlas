"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "National overview", isActive: (p: string) => p === "/" },
  { href: "/force/sample", label: "Force detail", isActive: (p: string) => p.startsWith("/force/") },
  { href: "/methodology", label: "Methodology", isActive: (p: string) => p === "/methodology" },
];

export default function NavLinks() {
  const pathname = usePathname();

  return (
    <nav className="tabs" aria-label="Main">
      {LINKS.map((l) => (
        <Link key={l.href} href={l.href} className="tab" aria-current={l.isActive(pathname) ? "page" : undefined}>
          {l.label}
        </Link>
      ))}
    </nav>
  );
}

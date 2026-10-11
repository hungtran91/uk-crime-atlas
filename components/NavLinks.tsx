"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import WithMonth from "@/components/WithMonth";
import { withMonth } from "@/lib/month";

const DEFAULT_FORCE = "/force/west-yorkshire";

const LINKS = [
  { href: "/", label: "National overview", isActive: (p: string) => p === "/" },
  { href: DEFAULT_FORCE, label: "Force detail", isActive: (p: string) => p.startsWith("/force/") },
  { href: "/methodology", label: "Methodology", isActive: (p: string) => p === "/methodology" },
];

/**
 * Brand link and main tabs. Both keep the selected month, so it survives moving between pages.
 * No prefetch: the overview payload is large and would be fetched on every page load.
 */
export default function NavLinks({ months, latest }: { months: string[]; latest: string }) {
  const pathname = usePathname();

  return (
    <WithMonth months={months} latest={latest}>
      {(month) => (
        <>
          <Link href={withMonth("/", month, latest)} prefetch={false} className="brand">
            <span className="brand-mark" aria-hidden="true" />
            UK Crime Atlas
          </Link>
          <nav className="tabs" aria-label="Main">
            {LINKS.map((l) => {
              const active = l.isActive(pathname);
              // On a force page the tab points at that force, not the default one.
              const path = active && l.href === DEFAULT_FORCE ? pathname : l.href;
              return (
                <Link
                  key={l.href}
                  href={withMonth(path, month, latest)}
                  prefetch={false}
                  className="tab"
                  aria-current={active ? "page" : undefined}
                >
                  {l.label}
                </Link>
              );
            })}
          </nav>
        </>
      )}
    </WithMonth>
  );
}

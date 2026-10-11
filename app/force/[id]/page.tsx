import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadDataset } from "@/lib/data";
import { fmt } from "@/lib/format";

type Props = { params: Promise<{ id: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return loadDataset().forces.map((f) => ({ id: f.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const force = loadDataset().forceById.get(id);
  return { title: force ? `${force.name} · UK Crime Atlas` : "UK Crime Atlas" };
}

// Placeholder until Phase 4 builds the force detail view.
export default async function ForceDetailPage({ params }: Props) {
  const { id } = await params;
  const force = loadDataset().forceById.get(id);
  if (!force) notFound();

  return (
    <div className="page">
      <div className="page-h">
        <div className="lead">
          <div className="crumb">
            <Link href="/">National overview</Link>
            <span>/</span>
            <span>Force detail</span>
          </div>
          <h1 className="h1">{force.name}</h1>
          <p className="muted page-sub">Resident population {fmt.int(force.population)}</p>
        </div>
      </div>
      <div className="empty">
        <span className="nodata-fill" aria-hidden="true" />
        <span className="empty-t">Force breakdown coming soon</span>
        <span className="empty-s">Category breakdown, 12-month trend and rank for {force.name} arrive in the next phase.</span>
      </div>
    </div>
  );
}

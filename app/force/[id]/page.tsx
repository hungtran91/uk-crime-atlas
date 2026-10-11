import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ForceDashboard from "@/components/ForceDashboard";
import { loadDataset } from "@/lib/data";
import { buildForceModel } from "@/lib/force";

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

export default async function ForceDetailPage({ params }: Props) {
  const { id } = await params;
  const model = buildForceModel(loadDataset(), id);
  if (!model) notFound();

  return <ForceDashboard model={model} />;
}

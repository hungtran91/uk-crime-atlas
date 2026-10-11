import Link from "next/link";

// Placeholder route until Phase 4 generates one page per force.
export const dynamicParams = false;

export function generateStaticParams() {
  return [{ id: "sample" }];
}

export default async function ForceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <div className="page">
      <div className="page-h">
        <div>
          <div className="crumb">
            <Link href="/">National overview</Link>
            <span>/</span>
            <span>Force detail</span>
          </div>
          <h1 className="h1">Force detail</h1>
          <p className="muted page-sub">
            Force id: <span className="mono">{id}</span>
          </p>
        </div>
      </div>
      <div className="empty">
        <span className="nodata-fill" aria-hidden="true" />
        <span className="empty-t">Force breakdown coming soon</span>
      </div>
    </div>
  );
}

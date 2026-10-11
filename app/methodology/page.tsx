import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Methodology · UK Crime Atlas",
};

export default function MethodologyPage() {
  return (
    <div className="page">
      <div className="page-h">
        <div>
          <h1 className="h1">Methodology</h1>
          <p className="muted page-sub">Sources, exclusions and how rates are calculated.</p>
        </div>
      </div>
      <div className="empty">
        <span className="nodata-fill" aria-hidden="true" />
        <span className="empty-t">Methodology notes coming soon</span>
      </div>
    </div>
  );
}

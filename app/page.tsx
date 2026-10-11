export default function OverviewPage() {
  return (
    <div className="page">
      <div className="page-h">
        <div>
          <h1 className="h1">National overview</h1>
          <p className="muted page-sub">
            Police recorded crime across the 43 territorial forces of England and Wales.
          </p>
        </div>
      </div>
      <div className="empty">
        <span className="nodata-fill" aria-hidden="true" />
        <span className="empty-t">Map and headline figures coming soon</span>
      </div>
    </div>
  );
}

import { Suspense } from "react";
import OverviewDashboard from "@/components/OverviewDashboard";
import { loadDataset } from "@/lib/data";
import { loadMapGeometry } from "@/lib/geo";
import { buildOverviewModel } from "@/lib/overview";

export default function OverviewPage() {
  // The boundary never shows a fallback: it lets React hydrate the dashboard in small slices instead of one long task.
  return (
    <Suspense>
      <OverviewDashboard model={buildOverviewModel(loadDataset())} geometry={loadMapGeometry()} />
    </Suspense>
  );
}

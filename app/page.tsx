import OverviewDashboard from "@/components/OverviewDashboard";
import { loadDataset } from "@/lib/data";
import { loadMapGeometry } from "@/lib/geo";
import { buildOverviewModel } from "@/lib/overview";

export default function OverviewPage() {
  return <OverviewDashboard model={buildOverviewModel(loadDataset())} geometry={loadMapGeometry()} />;
}

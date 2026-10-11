import { geoPath, geoTransverseMercator } from "d3-geo";
import type { FeatureCollection, Geometry } from "geojson";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import pfaTopology from "@/public/geo/pfa.topo.json";
import { CITY_OF_LONDON_ID } from "@/lib/metrics";

export const METROPOLITAN_ID = "metropolitan";
const INSET_IDS = [METROPOLITAN_ID, CITY_OF_LONDON_ID];

export interface MapArea {
  id: string;
  d: string;
}

/** Pre-projected SVG geometry in a fixed viewBox, so the client needs no d3-geo or topology. */
export interface MapGeometry {
  width: number;
  height: number;
  areas: MapArea[];
  inset: { x: number; y: number; width: number; height: number; areas: MapArea[] };
  /** Dashed line from London on the main map to the inset box. */
  leader: { x1: number; y1: number; x2: number; y2: number };
}

type ForceProps = { id: string };

const round = (v: number) => Math.round(v * 10) / 10;

// Layout numbers follow drawMap() in design/UK Crime Atlas.html.
export function buildMapGeometry(topology: Topology, width = 840, height = 600): MapGeometry {
  const fc = feature(topology, topology.objects.pfa as GeometryCollection<ForceProps>) as FeatureCollection<
    Geometry,
    ForceProps
  >;
  const toAreas = (features: typeof fc.features, path: ReturnType<typeof geoPath>): MapArea[] =>
    features.map((f) => ({ id: f.properties.id, d: path(f) ?? "" }));

  const projection = geoTransverseMercator()
    .rotate([2, 0])
    .fitExtent([[10, 10], [width * 0.78, height - 10]], fc);
  const path = geoPath(projection).digits(1);

  const box = {
    x: round(width * 0.74),
    y: round(height * 0.56),
    width: Math.min(190, round(width * 0.24)),
    height: Math.min(150, round(height * 0.26)),
  };
  const london: typeof fc = { ...fc, features: fc.features.filter((f) => INSET_IDS.includes(f.properties.id)) };
  const insetProjection = geoTransverseMercator()
    .rotate([2, 0])
    .fitExtent([[box.x + 8, box.y + 22], [box.x + box.width - 8, box.y + box.height - 8]], london);

  const met = fc.features.find((f) => f.properties.id === METROPOLITAN_ID);
  const [cx, cy] = met ? path.centroid(met) : [0, 0];

  return {
    width,
    height,
    areas: toAreas(fc.features, path),
    inset: { ...box, areas: toAreas(london.features, geoPath(insetProjection).digits(1)) },
    leader: { x1: round(cx + 8), y1: round(cy), x2: box.x, y2: round(box.y + box.height / 2) },
  };
}

export function loadMapGeometry(): MapGeometry {
  return buildMapGeometry(pfaTopology as unknown as Topology);
}

import { geoArea, geoPath, geoTransverseMercator } from "d3-geo";
import type { Feature, FeatureCollection, Geometry, Position } from "geojson";
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

const KM_PER_DEGREE = 111.32;
const MID_LATITUDE = 53;
/** About half a pixel on the national map and one pixel in the London inset. */
const THIN_TOLERANCE_KM = 0.4;

/**
 * Drops arc points closer than the tolerance to the last kept point. The source topology is far
 * denser than an 840px map can show. Working on shared arcs keeps neighbouring borders identical.
 */
export function thinTopology(topology: Topology, toleranceKm = THIN_TOLERANCE_KM): Topology {
  const [sx, sy] = topology.transform?.scale ?? [1, 1];
  const kx = sx * KM_PER_DEGREE * Math.cos((MID_LATITUDE * Math.PI) / 180);
  const ky = sy * KM_PER_DEGREE;
  const delta = topology.transform !== undefined;

  const arcs = topology.arcs.map((arc) => {
    let x = 0;
    let y = 0;
    const points = arc.map(([dx, dy]) => (delta ? [(x += dx), (y += dy)] : [dx, dy]));
    const end = points.length - 1;
    const kept = [points[0]];
    for (let i = 1; i < end; i++) {
      const last = kept[kept.length - 1];
      if (Math.hypot((points[i][0] - last[0]) * kx, (points[i][1] - last[1]) * ky) >= toleranceKm) kept.push(points[i]);
    }
    kept.push(points[end]);
    // A ring needs four points; small islands keep their original shape.
    const out = kept.length < 4 ? points : kept;
    return delta ? out.map((p, i) => (i === 0 ? p : [p[0] - out[i - 1][0], p[1] - out[i - 1][1]])) : out;
  });
  return { ...topology, arcs };
}

/**
 * Thinning can collapse a sub-pixel island into a sliver whose winding flips; d3-geo would then
 * read it as "everything except the island" and fill the whole map. Such polygons are dropped.
 */
function dropCollapsedPolygons<P>(f: Feature<Geometry, P>): Feature<Geometry, P> {
  const g = f.geometry;
  const ok = (coordinates: Position[][]) => geoArea({ type: "Polygon", coordinates }) < 2 * Math.PI;
  if (g.type === "MultiPolygon") return { ...f, geometry: { ...g, coordinates: g.coordinates.filter(ok) } };
  return f;
}

const round = (v: number) => Math.round(v * 10) / 10;

// Layout numbers follow drawMap() in design/UK Crime Atlas.html.
export function buildMapGeometry(topology: Topology, width = 840, height = 600): MapGeometry {
  const raw = feature(topology, topology.objects.pfa as GeometryCollection<ForceProps>) as FeatureCollection<
    Geometry,
    ForceProps
  >;
  const fc: typeof raw = { ...raw, features: raw.features.map(dropCollapsedPolygons) };
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
  return buildMapGeometry(thinTopology(pfaTopology as unknown as Topology));
}

import { geoArea } from "d3-geo";
import type { Position } from "geojson";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import { describe, expect, it } from "vitest";
import pfaTopology from "@/public/geo/pfa.topo.json";
import { thinTopology } from "@/lib/geo";

const EARTH_RADIUS_KM = 6371.0088;
/** Islands at least this big (Isle of Wight, Anglesey, ...) must survive thinning. */
const MIN_KEPT_KM2 = 20;

const topology = pfaTopology as unknown as Topology;

function polygonParts(t: Topology): Map<string, Position[][][]> {
  const fc = feature(t, t.objects.pfa as GeometryCollection<{ id: string }>);
  return new Map(
    fc.features.map((f) => [
      f.properties.id,
      f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.type === "MultiPolygon" ? f.geometry.coordinates : [],
    ]),
  );
}

const steradians = (coordinates: Position[][]) => geoArea({ type: "Polygon", coordinates });

describe("thinTopology", () => {
  const before = polygonParts(topology);
  const after = polygonParts(thinTopology(topology));

  it("keeps every polygon part of at least 20 km² at close to its original area", () => {
    let checked = 0;
    for (const [id, parts] of before) {
      parts.forEach((part, i) => {
        const km2 = steradians(part) * EARTH_RADIUS_KM ** 2;
        if (km2 < MIN_KEPT_KM2) return;
        const thinned = steradians((after.get(id) ?? [])[i]) * EARTH_RADIUS_KM ** 2;
        expect(Math.abs(thinned - km2) / km2, `${id} part ${i} (${km2.toFixed(0)} km²)`).toBeLessThan(0.1);
        checked++;
      });
    }
    expect(checked).toBeGreaterThanOrEqual(before.size);
  });

  it("only collapses sub-pixel slivers", () => {
    for (const [id, parts] of before) {
      parts.forEach((part, i) => {
        const collapsed = steradians((after.get(id) ?? [])[i]) >= 2 * Math.PI;
        if (collapsed) expect(steradians(part) * EARTH_RADIUS_KM ** 2, `${id} part ${i}`).toBeLessThan(1);
      });
    }
  });

  it("removes points", () => {
    const count = (t: Topology) => t.arcs.reduce((a, arc) => a + arc.length, 0);
    expect(count(thinTopology(topology))).toBeLessThan(count(topology));
  });
});

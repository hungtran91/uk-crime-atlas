"""Sanity checks for the generated data. Exits non-zero if any check fails.

Usage:
  validate.py                      run all checks; on success write data/reference.json
  validate.py --spot FORCE MONTH   compare one force-month in counts.json with its raw CSV
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import statistics
import sys
import zipfile
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
TOPO = ROOT / "public" / "geo" / "pfa.topo.json"
LOOKUP = ROOT / "scripts" / "force_lookup.csv"
ARCHIVE_GLOB = "data/raw/????-??.zip"
REFERENCE = "reference.json"

N_FORCES = 43
N_MONTHS = 12
EW_POPULATION_2024 = 61_806_682
RATE_RANGE = (6.0, 10.0)
INCOMPLETE_THRESHOLD = 0.5
TOPO_MAX_BYTES = 1_000_000
BANNED_STRINGS = ["Anti-social behaviour", "btp", "northern-ireland", "British Transport", "Northern Ireland", "PSNI"]

errors: list[str] = []


def check(ok: bool, msg: str) -> None:
    if not ok:
        errors.append(msg)


def load(name: str) -> object:
    return json.loads((DATA / name).read_text(encoding="utf-8"))


def next_month(m: str) -> str:
    y, mo = int(m[:4]), int(m[5:])
    return f"{y + mo // 12}-{mo % 12 + 1:02d}"


def check_forces(forces: list[dict]) -> set[str]:
    with open(LOOKUP, encoding="utf-8", newline="") as fh:
        lookup_ids = {r["force_id"] for r in csv.DictReader(fh)}
    ids = [f["id"] for f in forces]
    check(len(forces) == N_FORCES, f"forces.json: {len(forces)} forces, expected {N_FORCES}")
    check(len(set(ids)) == len(ids), "forces.json: duplicate ids")
    check(set(ids) == lookup_ids, f"forces.json ids differ from lookup: {sorted(set(ids) ^ lookup_ids)}")
    for f in forces:
        pop = f.get("population")
        check(isinstance(pop, int) and pop > 0, f"forces.json: {f['id']} has bad population {pop!r}")
        check(bool(f.get("name")) and bool(f.get("onsCode")), f"forces.json: {f['id']} missing name/onsCode")
    total = sum(f["population"] for f in forces if isinstance(f.get("population"), int))
    check(abs(total - EW_POPULATION_2024) / EW_POPULATION_2024 < 0.01, f"forces.json: population sum {total:,} not within 1% of {EW_POPULATION_2024:,}")
    return set(ids)


def check_meta(meta: dict, force_ids: set[str]) -> None:
    months = meta["months"]
    check(len(months) == N_MONTHS, f"meta.months: {len(months)} months, expected {N_MONTHS}")
    check(all(next_month(a) == b for a, b in zip(months, months[1:])), f"meta.months not consecutive: {months}")
    check(meta["latestMonth"] == months[-1], "meta.latestMonth != last month")
    check(meta["excludedCategories"] == ["Anti-social behaviour"], "meta.excludedCategories unexpected")
    for m, ids in meta["missing"].items():
        check(m in months, f"meta.missing: month {m} not in months")
        check(set(ids) <= force_ids, f"meta.missing[{m}]: unknown forces {sorted(set(ids) - force_ids)}")
    threshold = meta["incompleteThreshold"]
    check(threshold == INCOMPLETE_THRESHOLD, f"meta.incompleteThreshold: {threshold!r}, expected {INCOMPLETE_THRESHOLD}")
    for m, entries in meta["incomplete"].items():
        check(m in months, f"meta.incomplete: month {m} not in months")
        ids = [e["forceId"] for e in entries]
        check(len(set(ids)) == len(ids), f"meta.incomplete[{m}]: duplicate forces")
        for e in entries:
            fid = e["forceId"]
            check(fid in meta["missing"].get(m, []), f"meta.incomplete[{m}]: {fid} not listed in meta.missing")
            check(isinstance(e["count"], int) and e["count"] > 0, f"meta.incomplete[{m}]: {fid} has bad count {e['count']!r}")
            check(e["count"] < threshold * e["medianCount"], f"meta.incomplete[{m}]: {fid} is not below the threshold")


def check_incomplete(counts: list[dict], meta: dict) -> list[dict]:
    """Recomputes the incomplete rule from the published totals; the flagged set must equal meta.incomplete."""
    totals: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    for r in counts:
        totals[r["forceId"]][r["month"]] += r["count"]
    listed: dict[tuple[str, str], dict] = {}
    for m, entries in meta["incomplete"].items():
        for e in entries:
            listed[(e["forceId"], m)] = e
            # Excluded rows are not in counts.json, but they still count towards the force's median.
            totals[e["forceId"]][m] += e["count"]
    flagged: set[tuple[str, str]] = set()
    for fid, by_month in totals.items():
        median = float(statistics.median(by_month.values()))
        for m, total in by_month.items():
            if total < meta["incompleteThreshold"] * median:
                flagged.add((fid, m))
                entry = listed.get((fid, m))
                if entry is not None:
                    check(entry["medianCount"] == median, f"meta.incomplete: {fid} {m} medianCount {entry['medianCount']} != {median}")
    check(flagged == set(listed), f"incomplete force-months differ from meta.incomplete: {sorted(flagged ^ set(listed))}")
    rows = [{"forceId": f, "month": m, "count": e["count"], "medianCount": e["medianCount"]} for (f, m), e in listed.items()]
    return sorted(rows, key=lambda r: (r["month"], r["forceId"]))


def check_counts(counts: list[dict], meta: dict, force_ids: set[str]) -> None:
    months = set(meta["months"])
    missing = {(f, m) for m, ids in meta["missing"].items() for f in ids}
    seen: set[tuple[str, str, str]] = set()
    present: set[tuple[str, str]] = set()
    for r in counts:
        key = (r["forceId"], r["month"], r["category"])
        check(r["forceId"] in force_ids, f"counts: unknown force {r['forceId']}")
        check(r["month"] in months, f"counts: month {r['month']} not in meta.months")
        check(isinstance(r["count"], int) and r["count"] > 0, f"counts: bad count {r}")
        check(key not in seen, f"counts: duplicate {key}")
        check((r["forceId"], r["month"]) not in missing, f"counts: rows for missing force-month {key[:2]}")
        seen.add(key)
        present.add(key[:2])
    for f in force_ids:
        for m in months:
            if (f, m) not in missing:
                check((f, m) in present, f"counts: no rows for {f} {m} but it is not listed as missing")


def check_banned_strings() -> None:
    for path in [DATA / "meta.json", DATA / "forces.json", DATA / "counts.json", TOPO]:
        text = path.read_text(encoding="utf-8")
        for s in BANNED_STRINGS:
            # meta.excludedCategories names ASB on purpose; checked in check_meta.
            if path.name == "meta.json" and s == "Anti-social behaviour":
                continue
            check(s not in text, f"{path.name}: contains banned string {s!r}")


def check_rates(counts: list[dict], meta: dict, forces: list[dict]) -> dict:
    """Checks national rates and returns the reference figures that lib/ tests compare against."""
    pop = {f["id"]: f["population"] for f in forces}
    by_fm: dict[tuple[str, str], int] = defaultdict(int)
    for r in counts:
        by_fm[(r["forceId"], r["month"])] += r["count"]
    months = meta["months"]

    def reporting(m: str) -> list[str]:
        return [f for f in pop if f not in meta["missing"].get(m, [])]

    national = []
    mom = []
    print("National rate per 1,000 (reporting forces only); month-over-month like-for-like:")
    for i, m in enumerate(months):
        rep = reporting(m)
        rate = sum(by_fm[(f, m)] for f in rep) / sum(pop[f] for f in rep) * 1000
        national.append({"month": m, "rate": rate, "reporting": len(rep)})
        line = f"  {m}: {rate:5.2f}  ({len(rep)} forces)"
        check(RATE_RANGE[0] <= rate <= RATE_RANGE[1], f"rate {m}: {rate:.2f} outside {RATE_RANGE}")
        if i > 0:
            prev = months[i - 1]
            prev_rep = set(reporting(prev))
            both = [f for f in rep if f in prev_rep]
            cur_n = sum(by_fm[(f, m)] for f in both)
            prev_n = sum(by_fm[(f, prev)] for f in both)
            both_pop = sum(pop[f] for f in both)
            pct = cur_n / prev_n - 1
            points = cur_n / both_pop * 1000 - prev_n / both_pop * 1000
            mom.append({"month": m, "prevMonth": prev, "forces": len(both), "pct": pct, "ratePoints": points})
            line += f"   MoM {pct * 100:+6.2f}%  {points:+.3f} pts  ({len(both)} forces in both)"
        print(line)

    latest = meta["latestMonth"]
    # Same order as lib/metrics.ts rankForces: rate descending, then id ascending.
    ranked = sorted(((by_fm[(f, latest)] / pop[f] * 1000, f) for f in reporting(latest)), key=lambda x: (-x[0], x[1]))
    rows = [{"forceId": f, "rate": r, "rank": i + 1} for i, (r, f) in enumerate(ranked)]
    print(f"Highest {latest}: " + ", ".join(f"{x['forceId']} {x['rate']:.1f}" for x in rows[:3]))
    print(f"Lowest {latest}:  " + ", ".join(f"{x['forceId']} {x['rate']:.1f}" for x in rows[-3:]))
    return {
        "generatedFrom": meta["generatedAt"],
        "latestMonth": latest,
        "national": national,
        "monthOverMonth": mom,
        "latestRanks": {"of": len(rows), "top": rows[:3], "bottom": rows[-3:]},
    }


def ring_points(ring: list[int], arcs: list[list[list[int]]]) -> list[tuple[int, int]]:
    pts: list[tuple[int, int]] = []
    for i in ring:
        arc = arcs[i] if i >= 0 else arcs[~i][::-1]
        pts.extend(arc if not pts else arc[1:])
    return pts


def signed_area(pts: list[tuple[int, int]]) -> float:
    return sum(x0 * y1 - x1 * y0 for (x0, y0), (x1, y1) in zip(pts, pts[1:] + pts[:1])) / 2


def check_topo(force_ids: set[str]) -> None:
    size = TOPO.stat().st_size
    check(size < TOPO_MAX_BYTES, f"pfa.topo.json: {size:,} bytes, limit {TOPO_MAX_BYTES:,}")
    topo = json.loads(TOPO.read_text(encoding="utf-8"))
    obj = topo["objects"].get("pfa")
    if obj is None:
        check(False, "pfa.topo.json: no object 'pfa'")
        return
    geoms = obj["geometries"]
    ids = [g.get("properties", {}).get("id") for g in geoms]
    check(len(geoms) == N_FORCES, f"pfa.topo.json: {len(geoms)} geometries, expected {N_FORCES}")
    check(set(ids) == force_ids, f"pfa.topo.json ids differ from forces.json: {sorted(set(ids) ^ force_ids, key=str)}")

    # Absolute (undeltaed) quantized coordinates; the positive scale keeps orientation.
    arcs: list[list[list[int]]] = []
    for arc in topo["arcs"]:
        x = y = 0
        pts = []
        for dx, dy in arc:
            x, y = x + dx, y + dy
            pts.append((x, y))
        arcs.append(pts)

    for g in geoms:
        gid = g.get("properties", {}).get("id")
        if g.get("type") not in ("Polygon", "MultiPolygon") or not g.get("arcs"):
            check(False, f"pfa.topo.json: {gid} has null/empty geometry ({g.get('type')})")
            continue
        polygons = [g["arcs"]] if g["type"] == "Polygon" else g["arcs"]
        for poly in polygons:
            outer = ring_points(poly[0], arcs)
            # d3-geo treats clockwise (negative signed area with y = latitude) as the exterior.
            check(signed_area(outer) < 0, f"pfa.topo.json: {gid} has a counter-clockwise outer ring")
    col = next((g for g in geoms if g.get("properties", {}).get("id") == "city-of-london"), None)
    check(col is not None and bool(col.get("arcs")), "pfa.topo.json: city-of-london missing or empty")


def spot(force: str, month: str) -> int:
    counts = load("counts.json")
    agg = {r["category"]: r["count"] for r in counts if r["forceId"] == force and r["month"] == month}
    archives = sorted(ROOT.glob(ARCHIVE_GLOB))
    if not archives:
        print(f"no archive matching {ARCHIVE_GLOB}", file=sys.stderr)
        return 1
    member = f"{month}/{month}-{force}-street.csv"
    with zipfile.ZipFile(archives[-1]) as zf:
        if member not in zf.namelist():
            print(f"{member} not in {archives[-1].name} (force-month is missing)")
            return 0 if not agg else 1
        with zf.open(member) as fh:
            raw = Counter(r["Crime type"] for r in csv.DictReader(io.TextIOWrapper(fh, encoding="utf-8")))
    print(f"{member}  ({archives[-1].name})")
    excluded = next((e for e in load("meta.json")["incomplete"].get(month, []) if e["forceId"] == force), None)
    if excluded is not None:
        total_raw = sum(n for c, n in raw.items() if c != "Anti-social behaviour")
        share = excluded["count"] / excluded["medianCount"]
        print(f"excluded as incomplete: {share:.1%} of the force's median month ({excluded['medianCount']:,.1f})")
        print(f"{'TOTAL excl. ASB':32} {'raw CSV':>8} {'meta.json':>12}")
        print(f"{'':32} {total_raw:>8} {excluded['count']:>12}")
        if agg:
            print("MISMATCH: counts.json has rows for an incomplete force-month")
        return 0 if total_raw == excluded["count"] and not agg else 1
    print(f"{'category':32} {'raw CSV':>8} {'counts.json':>12}")
    ok = True
    for cat in sorted(set(raw) | set(agg)):
        expected = None if cat == "Anti-social behaviour" else raw.get(cat, 0)
        got = agg.get(cat, 0)
        flag = "" if expected is None or expected == got else "  MISMATCH"
        ok &= flag == ""
        print(f"{cat:32} {raw.get(cat, 0):>8} {got if cat in agg else '-':>12}{flag}")
    total_raw = sum(n for c, n in raw.items() if c != "Anti-social behaviour")
    print(f"{'TOTAL excl. ASB':32} {total_raw:>8} {sum(agg.values()):>12}")
    return 0 if ok else 1


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--spot", nargs=2, metavar=("FORCE", "MONTH"))
    args = parser.parse_args()
    if args.spot:
        return spot(*args.spot)

    meta = load("meta.json")
    forces = load("forces.json")
    counts = load("counts.json")
    force_ids = check_forces(forces)
    check_meta(meta, force_ids)
    check_counts(counts, meta, force_ids)
    check_banned_strings()
    incomplete = check_incomplete(counts, meta)
    reference = check_rates(counts, meta, forces)
    reference["incomplete"] = incomplete
    check_topo(force_ids)

    flagged = {(r["forceId"], r["month"]) for r in incomplete}
    not_published = {m: [f for f in ids if (f, m) not in flagged] for m, ids in meta["missing"].items()}
    not_published = {m: ids for m, ids in not_published.items() if ids}
    print(f"Not published: {sum(len(v) for v in not_published.values())} force-months " + json.dumps(not_published))
    print(f"Incomplete (below {meta['incompleteThreshold']:.0%} of the force's median month): {len(incomplete)} force-months")
    for r in incomplete:
        print(f"  {r['forceId']} {r['month']}: {r['count']:,} crimes, {r['count'] / r['medianCount']:.1%} of median {r['medianCount']:,.1f}")
    if errors:
        print(f"\nFAILED ({len(errors)}):", file=sys.stderr)
        for e in errors:
            print(f"  - {e}", file=sys.stderr)
        return 1
    # Only written on success, so lib/ tests never compare against figures from bad data.
    (DATA / REFERENCE).write_text(json.dumps(reference, indent=2) + "\n", encoding="utf-8")
    print(f"\nAll checks passed. Wrote data/{REFERENCE}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

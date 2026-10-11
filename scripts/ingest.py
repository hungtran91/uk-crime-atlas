"""Build data/*.json and data/raw/pfa.geojson from the pinned raw sources.

Crime: data.police.uk archive zip (downloaded manually, see ARCHIVE_URL).
Population: ONS mid-year estimates for police force areas (xlsx).
Boundaries: ONS Police Force Areas Dec 2024, generalised (BGC), as GeoJSON.

Run `npm run geo` afterwards to turn data/raw/pfa.geojson into TopoJSON.
"""

from __future__ import annotations

import csv
import json
import re
import statistics
import sys
import urllib.request
import zipfile
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
OUT = ROOT / "data"
LOOKUP = ROOT / "scripts" / "force_lookup.csv"

ARCHIVE_MONTH = "2026-07"
ARCHIVE_URL = f"https://policeuk-data.s3.amazonaws.com/archive/{ARCHIVE_MONTH}.zip"
ARCHIVE_SIZE = 1_733_868_300
ARCHIVE_PATH = RAW / f"{ARCHIVE_MONTH}.zip"

POP_YEAR = 2024
POP_URL = (
    "https://www.ons.gov.uk/file?uri=/peoplepopulationandcommunity/populationandmigration/"
    "populationestimates/adhocs/3194populationestimatesforpoliceforceareasinenglandandwales"
    "bysingleyearofageandsexmid1991tomid2024/policeforceareas1991to2024.xlsx"
)
POP_SIZE = 1_715_218
POP_PATH = RAW / "policeforceareas1991to2024.xlsx"
POP_SHEET = "Mid-2021 to Mid-2024"

GEO_URL = (
    "https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/"
    "Police_Force_Areas_Dec_2024_EW_BGC/FeatureServer/0/query"
    "?where=1%3D1&outFields=PFA24CD,PFA24NM&outSR=4326&f=geojson"
)
GEO_SRC_PATH = RAW / "pfa_bgc.geojson"
GEO_OUT_PATH = RAW / "pfa.geojson"

WINDOW = 12
EXCLUDED_CATEGORIES = ["Anti-social behaviour"]
# A force-month below this share of the force's median month is a partial upload: treated as missing.
INCOMPLETE_THRESHOLD = 0.5
N_FORCES = 43


def fail(msg: str) -> None:
    print(f"ERROR: {msg}", file=sys.stderr)
    sys.exit(1)


def check_archive() -> None:
    if ARCHIVE_PATH.exists() and ARCHIVE_PATH.stat().st_size == ARCHIVE_SIZE:
        return
    state = (
        f"size {ARCHIVE_PATH.stat().st_size:,} != expected {ARCHIVE_SIZE:,}"
        if ARCHIVE_PATH.exists()
        else "file not found"
    )
    fail(
        f"crime archive missing or incomplete ({state}).\n"
        f"  Download: {ARCHIVE_URL}\n"
        f"  Save as:  {ARCHIVE_PATH}"
    )


def download(url: str, dest: Path, expected_size: int | None) -> None:
    if dest.exists() and (expected_size is None or dest.stat().st_size == expected_size):
        print(f"  have {dest.name}")
        return
    print(f"  downloading {dest.name} ...")
    part = dest.with_name(dest.name + ".part")
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "uk-crime-atlas-ingest"})
        with urllib.request.urlopen(req, timeout=300) as resp, open(part, "wb") as fh:
            while chunk := resp.read(1 << 20):
                fh.write(chunk)
        if expected_size is not None and part.stat().st_size != expected_size:
            raise RuntimeError(f"{dest.name}: got {part.stat().st_size:,} bytes, expected {expected_size:,}")
        part.replace(dest)
    except BaseException:
        part.unlink(missing_ok=True)
        raise


def load_lookup() -> list[dict[str, str]]:
    with open(LOOKUP, encoding="utf-8", newline="") as fh:
        rows = list(csv.DictReader(fh))
    if len(rows) != N_FORCES:
        fail(f"force_lookup.csv has {len(rows)} rows, expected {N_FORCES}")
    for key in ("force_id", "ons_code"):
        if len({r[key] for r in rows}) != N_FORCES:
            fail(f"force_lookup.csv: duplicate {key}")
    return rows


def month_window(names: list[str]) -> list[str]:
    folders = sorted({n.split("/", 1)[0] for n in names if re.fullmatch(r"\d{4}-\d{2}/.+", n)})
    months = [m for m in folders if m <= ARCHIVE_MONTH][-WINDOW:]
    if len(months) != WINDOW:
        fail(f"archive has only {len(months)} months up to {ARCHIVE_MONTH}")
    expected = pd.period_range(end=months[-1], periods=WINDOW, freq="M").strftime("%Y-%m").tolist()
    if months != expected:
        fail(f"months not consecutive: {months}")
    return months


def aggregate_crime(
    lookup: list[dict[str, str]],
) -> tuple[list[str], dict[str, list[str]], dict[str, list[dict]], list[dict]]:
    counts: list[dict] = []
    missing: dict[str, list[str]] = {}
    with zipfile.ZipFile(ARCHIVE_PATH) as zf:
        names = set(zf.namelist())
        months = month_window(sorted(names))
        print(f"  window {months[0]} .. {months[-1]}")
        for month in months:
            for force in lookup:
                fid = force["force_id"]
                member = f"{month}/{month}-{fid}-street.csv"
                if member not in names:
                    missing.setdefault(month, []).append(fid)
                    continue
                with zf.open(member) as fh:
                    df = pd.read_csv(fh, usecols=["Month", "Crime type"], dtype=str)
                bad_months = set(df["Month"].unique()) - {month}
                if bad_months:
                    fail(f"{member}: unexpected Month values {sorted(bad_months)}")
                df = df[~df["Crime type"].isin(EXCLUDED_CATEGORIES)]
                for category, n in df.groupby("Crime type").size().items():
                    counts.append({"forceId": fid, "month": month, "category": str(category), "count": int(n)})
            print(f"  {month}: {len(lookup) - len(missing.get(month, []))} forces")
    incomplete = find_incomplete(counts)
    for month, entries in incomplete.items():
        for e in entries:
            missing.setdefault(month, []).append(e["forceId"])
            share = e["count"] / e["medianCount"]
            print(f"  incomplete: {e['forceId']} {month}: {e['count']:,} crimes, {share:.1%} of median month {e['medianCount']:,.1f}")
    dropped = {(e["forceId"], m) for m, entries in incomplete.items() for e in entries}
    counts = [r for r in counts if (r["forceId"], r["month"]) not in dropped]
    missing = {m: sorted(ids) for m, ids in sorted(missing.items())}
    counts.sort(key=lambda r: (r["forceId"], r["month"], r["category"]))
    return months, missing, incomplete, counts


def find_incomplete(counts: list[dict]) -> dict[str, list[dict]]:
    """Force-months whose total is below INCOMPLETE_THRESHOLD of that force's median published month."""
    totals: dict[str, dict[str, int]] = {}
    for r in counts:
        by_month = totals.setdefault(r["forceId"], {})
        by_month[r["month"]] = by_month.get(r["month"], 0) + r["count"]
    incomplete: dict[str, list[dict]] = {}
    for fid, by_month in sorted(totals.items()):
        median = float(statistics.median(by_month.values()))
        for month, total in by_month.items():
            if total < INCOMPLETE_THRESHOLD * median:
                incomplete.setdefault(month, []).append({"forceId": fid, "count": total, "medianCount": median})
    return dict(sorted(incomplete.items()))


def load_population(lookup: list[dict[str, str]]) -> dict[str, int]:
    df = pd.read_excel(POP_PATH, sheet_name=POP_SHEET, header=3)
    df = df[df["Year"] == POP_YEAR]
    age_cols = [c for c in df.columns if re.fullmatch(r"[FM]\d+", str(c))]
    totals = df.set_index("PFA 2023 Code")[age_cols].sum(axis=1).astype(int).to_dict()
    pop: dict[str, int] = {}
    for force in lookup:
        code = force["ons_code"]
        if code not in totals:
            fail(f"no {POP_YEAR} population for {force['force_id']} ({code})")
        pop[force["force_id"]] = int(totals[code])
    return pop


def write_boundaries(lookup: list[dict[str, str]]) -> None:
    src = json.loads(GEO_SRC_PATH.read_text(encoding="utf-8"))
    by_code = {f["ons_code"]: f["force_id"] for f in lookup}
    features = []
    for feat in src["features"]:
        code = feat["properties"]["PFA24CD"]
        if code not in by_code:
            fail(f"boundary {code} not in force_lookup.csv")
        features.append({"type": "Feature", "properties": {"id": by_code[code]}, "geometry": feat["geometry"]})
    if len(features) != N_FORCES or {f["properties"]["id"] for f in features} != set(by_code.values()):
        fail(f"boundaries: {len(features)} features, expected the {N_FORCES} lookup forces")
    features.sort(key=lambda f: f["properties"]["id"])
    GEO_OUT_PATH.write_text(json.dumps({"type": "FeatureCollection", "features": features}), encoding="utf-8")


def write_json(path: Path, data: object, one_row_per_line: bool = False) -> None:
    if one_row_per_line and isinstance(data, list):
        # One record per line keeps the file small but still diffable.
        text = "[\n" + ",\n".join(json.dumps(r, ensure_ascii=False, separators=(",", ":")) for r in data) + "\n]\n"
    else:
        text = json.dumps(data, ensure_ascii=False, indent=2) + "\n"
    path.write_text(text, encoding="utf-8", newline="\n")
    print(f"  wrote {path.relative_to(ROOT)} ({path.stat().st_size / 1024:.0f} KB)")


def main() -> None:
    RAW.mkdir(parents=True, exist_ok=True)
    print("1/5 raw sources")
    download(POP_URL, POP_PATH, POP_SIZE)
    download(GEO_URL, GEO_SRC_PATH, None)
    check_archive()

    lookup = load_lookup()

    print("2/5 crime counts")
    months, missing, incomplete, counts = aggregate_crime(lookup)

    print("3/5 population")
    pop = load_population(lookup)

    print("4/5 boundaries")
    write_boundaries(lookup)

    print("5/5 outputs")
    forces = sorted(
        ({"id": f["force_id"], "name": f["name"], "onsCode": f["ons_code"], "population": pop[f["force_id"]]} for f in lookup),
        key=lambda f: f["name"],
    )
    meta = {
        "months": months,
        "latestMonth": months[-1],
        "generatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "populationYear": POP_YEAR,
        "excludedCategories": EXCLUDED_CATEGORIES,
        "missing": missing,
        "incompleteThreshold": INCOMPLETE_THRESHOLD,
        "incomplete": incomplete,
    }
    write_json(OUT / "meta.json", meta)
    write_json(OUT / "forces.json", forces)
    write_json(OUT / "counts.json", counts, one_row_per_line=True)
    n_missing = sum(len(v) for v in missing.values())
    n_incomplete = sum(len(v) for v in incomplete.values())
    print(f"done: {len(counts)} count rows, {n_missing} missing force-months ({n_incomplete} of them incomplete)")


if __name__ == "__main__":
    main()

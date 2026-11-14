"""Synthetic fixtures for the pipeline tests: 3 forces, 3 months, no network, no data/raw.

Window 2026-01 .. 2026-03 (ARCHIVE_MONTH 2026-03, WINDOW 3). Crime totals excluding ASB:

    force           pop     2026-01  2026-02   2026-03
    alpha           12,500  100      110       90
    beta            12,500  100      100       40  <- below 50% of median 100: incomplete
    city-of-london   5,000   40      (no file) 40  <- missing, never 0

Every month also has ASB rows, British Transport Police and PSNI files, and a non-street file,
all of which must be ignored. Rates land at 7-9 per 1,000 so validate.py's real RATE_RANGE holds.
"""

from __future__ import annotations

import csv
import io
import json
import zipfile
from dataclasses import dataclass
from pathlib import Path

import openpyxl
import pytest

import ingest
import validate

MONTHS = ["2026-01", "2026-02", "2026-03"]

LOOKUP_ROWS = [
    # force_id, name, police_name, ons_code, ons_name
    ("alpha", "Alpha", "Alpha Constabulary", "E23000901", "Alpha"),
    ("beta", "Beta", "Beta Police", "E23000902", "Beta"),
    ("city-of-london", "City of London", "City of London Police", "E23000903", "London, City of"),
]

# Population columns F0, F1, M0, M1 per ONS code; 2024 sums to the "pop" column above.
POPULATION = {
    2023: {"E23000901": (1, 1, 1, 1), "E23000902": (2, 2, 2, 2), "E23000903": (3, 3, 3, 3)},
    2024: {"E23000901": (3000, 3250, 3100, 3150), "E23000902": (3125, 3125, 3125, 3125), "E23000903": (1200, 1300, 1250, 1250)},
}
POPULATION_2024_TOTAL = 30_000

# (month, member force slug) -> {category: rows}. ASB is always present and must be dropped.
CRIME = {
    ("2026-01", "alpha"): {"Burglary": 60, "Vehicle crime": 40, "Anti-social behaviour": 30},
    ("2026-02", "alpha"): {"Burglary": 70, "Vehicle crime": 40, "Anti-social behaviour": 25},
    ("2026-03", "alpha"): {"Burglary": 50, "Vehicle crime": 40, "Anti-social behaviour": 20},
    ("2026-01", "beta"): {"Burglary": 50, "Shoplifting": 50, "Anti-social behaviour": 10},
    ("2026-02", "beta"): {"Burglary": 50, "Shoplifting": 50, "Anti-social behaviour": 10},
    ("2026-03", "beta"): {"Burglary": 40, "Anti-social behaviour": 10},
    ("2026-01", "city-of-london"): {"Theft from the person": 40, "Anti-social behaviour": 5},
    ("2026-03", "city-of-london"): {"Theft from the person": 40, "Anti-social behaviour": 5},
}
# Present in the archive but not in force_lookup.csv: must never reach the outputs.
for _m in MONTHS:
    CRIME[(_m, "btp")] = {"Other theft": 500}
    CRIME[(_m, "northern-ireland")] = {"Violence and sexual offences": 500}
# Outside the window (older than the 3 months, and newer than ARCHIVE_MONTH): ignored.
CRIME[("2025-12", "alpha")] = {"Burglary": 9999}
CRIME[("2026-04", "alpha")] = {"Burglary": 9999}

CSV_HEADER = [
    "Crime ID", "Month", "Reported by", "Falls within", "Longitude", "Latitude",
    "Location", "LSOA code", "LSOA name", "Crime type", "Last outcome category", "Context",
]


def street_csv(month: str, categories: dict[str, int]) -> bytes:
    buf = io.StringIO()
    w = csv.writer(buf, lineterminator="\n")
    w.writerow(CSV_HEADER)
    for category, n in categories.items():
        for i in range(n):
            w.writerow([f"id{i}", month, "Some Police", "Some Police", "-0.1", "51.5",
                        "On or near High Street", "E01000001", "Somewhere 001A", category, "", ""])
    return buf.getvalue().encode("utf-8")


def build_archive(crime: dict[tuple[str, str], dict[str, int]]) -> bytes:
    """Archive laid out like data.police.uk's: YYYY-MM/YYYY-MM-<force>-street.csv."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for (month, slug), categories in sorted(crime.items()):
            zf.writestr(f"{month}/{month}-{slug}-street.csv", street_csv(month, categories))
            zf.writestr(f"{month}/{month}-{slug}-outcomes.csv", b"Crime ID,Month\nx,1999-01\n")
    return buf.getvalue()


def write_lookup(path: Path, rows: list[tuple[str, ...]]) -> None:
    with open(path, "w", encoding="utf-8", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["force_id", "name", "police_name", "ons_code", "ons_name"])
        w.writerows(rows)


def write_population(path: Path, population: dict[int, dict[str, tuple[int, ...]]]) -> None:
    """Mimics the ONS layout: 3 title rows, then the header on row 4 (pandas header=3)."""
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = ingest.POP_SHEET
    ws.append(["Population estimates for police force areas"])
    ws.append(["Synthetic test fixture"])
    ws.append([])
    ws.append(["PFA 2023 Code", "PFA 2023 Name", "Year", "F0", "F1", "M0", "M1"])
    for year, by_code in population.items():
        for code, values in by_code.items():
            ws.append([code, code, year, *values])
    wb.save(path)


def write_topo(path: Path, force_ids: list[str]) -> None:
    """One unit square per force, wound clockwise as d3-geo (and validate.py) expects."""
    arcs = [[[i * 2, 0], [0, 1], [1, 0], [0, -1], [-1, 0]] for i in range(len(force_ids))]
    geoms = [{"type": "Polygon", "arcs": [[i]], "properties": {"id": fid}} for i, fid in enumerate(force_ids)]
    path.write_text(json.dumps({"type": "Topology", "arcs": arcs, "objects": {"pfa": {"type": "GeometryCollection", "geometries": geoms}}}), encoding="utf-8")


@dataclass
class Pipeline:
    root: Path
    data: Path
    raw: Path
    archive: Path
    lookup: Path
    topo: Path

    def read(self, name: str) -> object:
        return json.loads((self.data / name).read_text(encoding="utf-8"))

    def write(self, name: str, obj: object) -> None:
        (self.data / name).write_text(json.dumps(obj), encoding="utf-8")


@pytest.fixture
def sources(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Pipeline:
    """Synthetic raw sources on disk, with ingest.py pointed at them. Nothing is run yet."""
    data = tmp_path / "data"
    raw = data / "raw"
    raw.mkdir(parents=True)
    (tmp_path / "public" / "geo").mkdir(parents=True)
    p = Pipeline(
        root=tmp_path,
        data=data,
        raw=raw,
        archive=raw / "2026-03.zip",
        lookup=tmp_path / "force_lookup.csv",
        topo=tmp_path / "public" / "geo" / "pfa.topo.json",
    )
    p.archive.write_bytes(build_archive(CRIME))
    write_lookup(p.lookup, LOOKUP_ROWS)
    write_population(raw / "pop.xlsx", POPULATION)
    write_topo(p.topo, [r[0] for r in LOOKUP_ROWS])

    for name, value in {
        "ROOT": tmp_path, "RAW": raw, "OUT": data, "LOOKUP": p.lookup,
        "ARCHIVE_MONTH": "2026-03", "ARCHIVE_PATH": p.archive, "POP_PATH": raw / "pop.xlsx",
        "WINDOW": 3, "N_FORCES": 3,
    }.items():
        monkeypatch.setattr(ingest, name, value)
    # The network and boundary steps are out of scope: no downloads, no geojson.
    monkeypatch.setattr(ingest, "download", lambda *a, **k: None)
    monkeypatch.setattr(ingest, "check_archive", lambda: None)
    monkeypatch.setattr(ingest, "write_boundaries", lambda lookup: None)
    return p


@pytest.fixture
def pipeline(sources: Pipeline, monkeypatch: pytest.MonkeyPatch) -> Pipeline:
    """Runs the real ingest.main() on the synthetic sources and points validate.py at the output."""
    ingest.main()
    for name, value in {
        "ROOT": sources.root, "DATA": sources.data, "TOPO": sources.topo, "LOOKUP": sources.lookup,
        "N_FORCES": 3, "N_MONTHS": 3, "EW_POPULATION_2024": POPULATION_2024_TOTAL,
        "errors": [],
    }.items():
        monkeypatch.setattr(validate, name, value)
    monkeypatch.setattr("sys.argv", ["validate.py"])
    return sources

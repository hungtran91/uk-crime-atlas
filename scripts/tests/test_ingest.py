"""Tests for scripts/ingest.py on the synthetic sources in conftest.py."""

from __future__ import annotations

import zipfile

import pytest

import ingest
from conftest import CRIME, MONTHS, Pipeline, build_archive, write_lookup, write_population, LOOKUP_ROWS, POPULATION


def totals(counts: list[dict]) -> dict[tuple[str, str], int]:
    out: dict[tuple[str, str], int] = {}
    for r in counts:
        out[(r["forceId"], r["month"])] = out.get((r["forceId"], r["month"]), 0) + r["count"]
    return out


# --- exclusions ---------------------------------------------------------------------------------

def test_asb_is_excluded_and_other_categories_are_counted_exactly(pipeline: Pipeline) -> None:
    counts = pipeline.read("counts.json")
    assert all(r["category"] != "Anti-social behaviour" for r in counts)
    alpha_jan = {r["category"]: r["count"] for r in counts if r["forceId"] == "alpha" and r["month"] == "2026-01"}
    assert alpha_jan == {"Burglary": 60, "Vehicle crime": 40}


def test_btp_and_psni_are_excluded(pipeline: Pipeline) -> None:
    ids = {r["forceId"] for r in pipeline.read("counts.json")}
    assert ids == {"alpha", "beta", "city-of-london"}
    for name in ("counts.json", "forces.json", "meta.json"):
        text = (pipeline.data / name).read_text(encoding="utf-8")
        assert "btp" not in text
        assert "northern-ireland" not in text


def test_meta_records_excluded_category(pipeline: Pipeline) -> None:
    assert pipeline.read("meta.json")["excludedCategories"] == ["Anti-social behaviour"]


# --- window -------------------------------------------------------------------------------------

def test_window_is_last_n_months_up_to_archive_month(pipeline: Pipeline) -> None:
    meta = pipeline.read("meta.json")
    assert meta["months"] == MONTHS
    assert meta["latestMonth"] == "2026-03"
    # 2025-12 (too old) and 2026-04 (after ARCHIVE_MONTH) are in the archive but not in the output.
    assert {r["month"] for r in pipeline.read("counts.json")} <= set(MONTHS)


def test_non_consecutive_months_fail(sources: Pipeline) -> None:
    crime = {k: v for k, v in CRIME.items() if k[0] != "2026-01"}  # leaves 2025-12, 2026-02, 2026-03
    sources.archive.write_bytes(build_archive(crime))
    with pytest.raises(SystemExit):
        ingest.aggregate_crime(ingest.load_lookup())


def test_too_few_months_fail(sources: Pipeline, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(ingest, "WINDOW", 12)
    with pytest.raises(SystemExit):
        ingest.aggregate_crime(ingest.load_lookup())


def test_unexpected_month_value_in_csv_fails(sources: Pipeline) -> None:
    with zipfile.ZipFile(sources.archive, "a") as zf:
        # Overwrites nothing; adds a file for a force with no 2026-02 file, whose rows claim 2026-01.
        zf.writestr("2026-02/2026-02-city-of-london-street.csv", "Month,Crime type\n2026-01,Burglary\n")
    with pytest.raises(SystemExit):
        ingest.aggregate_crime(ingest.load_lookup())


# --- missing: no rows, never 0 ------------------------------------------------------------------

def test_missing_force_month_has_no_rows_and_is_listed(pipeline: Pipeline) -> None:
    counts = pipeline.read("counts.json")
    meta = pipeline.read("meta.json")
    assert not [r for r in counts if r["forceId"] == "city-of-london" and r["month"] == "2026-02"]
    assert all(r["count"] > 0 for r in counts)
    assert "city-of-london" in meta["missing"]["2026-02"]
    # Not published is not the same as incomplete.
    assert "2026-02" not in meta["incomplete"]


def test_reporting_neighbours_of_a_missing_month_are_kept(pipeline: Pipeline) -> None:
    t = totals(pipeline.read("counts.json"))
    assert t[("city-of-london", "2026-01")] == 40
    assert t[("city-of-london", "2026-03")] == 40


# --- incomplete: below 50% of the force's median month -------------------------------------------

def test_incomplete_force_month_is_flagged_dropped_and_listed(pipeline: Pipeline) -> None:
    counts = pipeline.read("counts.json")
    meta = pipeline.read("meta.json")
    assert meta["incompleteThreshold"] == 0.5
    assert meta["incomplete"] == {"2026-03": [{"forceId": "beta", "count": 40, "medianCount": 100.0}]}
    assert "beta" in meta["missing"]["2026-03"]
    assert not [r for r in counts if r["forceId"] == "beta" and r["month"] == "2026-03"]
    # beta's complete months stay.
    t = totals(counts)
    assert t[("beta", "2026-01")] == 100 and t[("beta", "2026-02")] == 100


def test_full_missing_map(pipeline: Pipeline) -> None:
    assert pipeline.read("meta.json")["missing"] == {"2026-02": ["city-of-london"], "2026-03": ["beta"]}


def row(fid: str, month: str, n: int) -> dict:
    return {"forceId": fid, "month": month, "category": "Burglary", "count": n}


def test_find_incomplete_threshold_is_strict() -> None:
    # Median of 50, 100, 100 is 100: exactly 50% stays, just below is flagged.
    at = [row("a", "m1", 50), row("a", "m2", 100), row("a", "m3", 100)]
    below = [row("a", "m1", 49), row("a", "m2", 100), row("a", "m3", 100)]
    assert ingest.find_incomplete(at) == {}
    assert ingest.find_incomplete(below) == {"m1": [{"forceId": "a", "count": 49, "medianCount": 100.0}]}


def test_find_incomplete_sums_categories_and_uses_each_forces_own_median() -> None:
    counts = [
        row("a", "m1", 30), {**row("a", "m1", 30), "category": "Robbery"},  # a m1 = 60
        row("a", "m2", 100), row("a", "m3", 100),
        row("b", "m1", 10), row("b", "m2", 10), row("b", "m3", 4),  # b median 10: 4 < 5, flagged
    ]
    # a m1 is two rows of 30: per category each is below 50, but the month total (60) is not.
    assert ingest.find_incomplete(counts) == {"m3": [{"forceId": "b", "count": 4, "medianCount": 10.0}]}


def test_find_incomplete_median_of_even_count_is_midpoint() -> None:
    # Missing months are absent, so a force can have an even number of months.
    counts = [row("a", "m1", 10), row("a", "m2", 30)]  # median 20.0: 10 is exactly 50%, kept
    assert ingest.find_incomplete(counts) == {}


# --- population and lookup ----------------------------------------------------------------------

def test_population_uses_2024_and_sums_age_columns(pipeline: Pipeline) -> None:
    pop = {f["id"]: f["population"] for f in pipeline.read("forces.json")}
    assert pop == {"alpha": 12_500, "beta": 12_500, "city-of-london": 5_000}


def test_population_missing_code_fails(sources: Pipeline) -> None:
    write_population(ingest.POP_PATH, {2024: {k: v for k, v in POPULATION[2024].items() if k != "E23000902"}})
    with pytest.raises(SystemExit):
        ingest.load_population(ingest.load_lookup())


def test_lookup_duplicate_id_fails(sources: Pipeline) -> None:
    write_lookup(sources.lookup, [LOOKUP_ROWS[0], LOOKUP_ROWS[0], LOOKUP_ROWS[2]])
    with pytest.raises(SystemExit):
        ingest.load_lookup()


# --- output format ------------------------------------------------------------------------------

def test_forces_sorted_by_name_with_schema(pipeline: Pipeline) -> None:
    forces = pipeline.read("forces.json")
    assert [f["name"] for f in forces] == ["Alpha", "Beta", "City of London"]
    assert forces[0] == {"id": "alpha", "name": "Alpha", "onsCode": "E23000901", "population": 12_500}


def test_counts_sorted_and_one_row_per_line(pipeline: Pipeline) -> None:
    text = (pipeline.data / "counts.json").read_text(encoding="utf-8")
    lines = text.split("\n")
    assert lines[0] == "[" and lines[-2] == "]" and lines[-1] == ""
    assert lines[1] == '{"forceId":"alpha","month":"2026-01","category":"Burglary","count":60},'
    counts = pipeline.read("counts.json")
    assert counts == sorted(counts, key=lambda r: (r["forceId"], r["month"], r["category"]))


def test_write_json_formats(sources: Pipeline) -> None:
    path = sources.data / "x.json"
    ingest.write_json(path, {"a": [1, "é"]})
    assert path.read_bytes() == '{\n  "a": [\n    1,\n    "é"\n  ]\n}\n'.encode("utf-8")
    ingest.write_json(path, [{"a": 1}, {"b": 2}], one_row_per_line=True)
    assert path.read_bytes() == b'[\n{"a":1},\n{"b":2}\n]\n'

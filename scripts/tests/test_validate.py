"""Tests for scripts/validate.py: passes on ingest.py's synthetic output, fails on planted errors."""

from __future__ import annotations

import json
from typing import Callable

import pytest

import validate
from conftest import Pipeline, build_archive, CRIME


def run(capsys: pytest.CaptureFixture[str]) -> tuple[int, str]:
    code = validate.main()
    return code, capsys.readouterr().err


def plant(p: Pipeline, name: str, change: Callable[[object], object]) -> None:
    p.write(name, change(p.read(name)))


def test_passes_on_ingest_output_and_writes_reference(pipeline: Pipeline, capsys: pytest.CaptureFixture[str]) -> None:
    code, err = run(capsys)
    assert code == 0, err
    assert validate.errors == []
    ref = pipeline.read("reference.json")
    assert ref["latestMonth"] == "2026-03"
    assert [n["reporting"] for n in ref["national"]] == [3, 2, 2]
    # 2026-01: (100 + 100 + 40) / 30,000 * 1000
    assert ref["national"][0]["rate"] == pytest.approx(8.0)
    assert ref["incomplete"] == [{"forceId": "beta", "month": "2026-03", "count": 40, "medianCount": 100.0}]
    assert ref["latestRanks"]["of"] == 2


# Each case plants one error in otherwise valid output; validate.py must fail and name it.
PLANTED: dict[str, tuple[str, Callable[[object], object], str]] = {
    "row for a missing (not published) force-month": (
        "counts.json",
        lambda c: c + [{"forceId": "city-of-london", "month": "2026-02", "category": "Burglary", "count": 5}],
        "rows for missing force-month ('city-of-london', '2026-02')",
    ),
    "row for an incomplete force-month": (
        "counts.json",
        lambda c: c + [{"forceId": "beta", "month": "2026-03", "category": "Burglary", "count": 40}],
        "rows for missing force-month ('beta', '2026-03')",
    ),
    "zero instead of missing": (
        "counts.json",
        lambda c: c + [{"forceId": "city-of-london", "month": "2026-02", "category": "Burglary", "count": 0}],
        "bad count",
    ),
    "ASB row": (
        "counts.json",
        lambda c: c + [{"forceId": "alpha", "month": "2026-01", "category": "Anti-social behaviour", "count": 30}],
        "banned string 'Anti-social behaviour'",
    ),
    "BTP row": (
        "counts.json",
        lambda c: c + [{"forceId": "btp", "month": "2026-01", "category": "Other theft", "count": 500}],
        "unknown force btp",
    ),
    "PSNI row": (
        "counts.json",
        lambda c: c + [{"forceId": "northern-ireland", "month": "2026-01", "category": "Other theft", "count": 500}],
        "banned string 'northern-ireland'",
    ),
    "duplicate row": (
        "counts.json",
        lambda c: c + [c[0]],
        "duplicate ('alpha', '2026-01', 'Burglary')",
    ),
    "unlisted gap: missing force-month dropped from meta.missing": (
        "meta.json",
        lambda m: {**m, "missing": {k: v for k, v in m["missing"].items() if k != "2026-02"}},
        "no rows for city-of-london 2026-02 but it is not listed as missing",
    ),
    "incomplete force-month not listed in missing": (
        "meta.json",
        lambda m: {**m, "missing": {k: v for k, v in m["missing"].items() if k != "2026-03"}},
        "beta not listed in meta.missing",
    ),
    "incomplete entry that is above the threshold": (
        "meta.json",
        lambda m: {**m, "incomplete": {"2026-03": [{"forceId": "beta", "count": 60, "medianCount": 100.0}]}},
        "beta is not below the threshold",
    ),
    "wrong medianCount": (
        "meta.json",
        lambda m: {**m, "incomplete": {"2026-03": [{"forceId": "beta", "count": 40, "medianCount": 90.0}]}},
        "medianCount 90.0 != 100.0",
    ),
    "wrong threshold": (
        "meta.json",
        lambda m: {**m, "incompleteThreshold": 0.4},
        "meta.incompleteThreshold: 0.4",
    ),
    "a low month that should have been flagged": (
        "counts.json",
        lambda c: [{**r, "count": 1} if (r["forceId"], r["month"]) == ("alpha", "2026-02") else r for r in c],
        "incomplete force-months differ from meta.incomplete: [('alpha', '2026-02')]",
    ),
    "bad population": (
        "forces.json",
        lambda f: [{**x, "population": 0} if x["id"] == "beta" else x for x in f],
        "beta has bad population 0",
    ),
    "non-consecutive months": (
        "meta.json",
        lambda m: {**m, "months": ["2026-01", "2026-02", "2026-04"], "latestMonth": "2026-04"},
        "meta.months not consecutive",
    ),
}


@pytest.mark.parametrize("case", PLANTED, ids=list(PLANTED))
def test_fails_on_planted_error(pipeline: Pipeline, capsys: pytest.CaptureFixture[str], case: str) -> None:
    name, change, expected = PLANTED[case]
    plant(pipeline, name, change)
    code, err = run(capsys)
    assert code == 1
    assert "FAILED" in err
    assert any(expected in e for e in validate.errors), validate.errors
    # reference.json is only written on success.
    assert not (pipeline.data / "reference.json").exists()


def test_fails_on_counter_clockwise_ring(pipeline: Pipeline, capsys: pytest.CaptureFixture[str]) -> None:
    topo = json.loads(pipeline.topo.read_text(encoding="utf-8"))
    topo["arcs"][0] = [[0, 0], [1, 0], [0, 1], [-1, 0], [0, -1]]
    pipeline.topo.write_text(json.dumps(topo), encoding="utf-8")
    code, _ = run(capsys)
    assert code == 1
    assert any("alpha has a counter-clockwise outer ring" in e for e in validate.errors)


# --- --spot -------------------------------------------------------------------------------------

def spot(capsys: pytest.CaptureFixture[str], force: str, month: str) -> tuple[int, str]:
    code = validate.spot(force, month)
    return code, capsys.readouterr().out


def test_spot_matches_raw_csv(pipeline: Pipeline, capsys: pytest.CaptureFixture[str]) -> None:
    code, out = spot(capsys, "alpha", "2026-01")
    assert code == 0, out
    assert "MISMATCH" not in out


def test_spot_missing_force_month(pipeline: Pipeline, capsys: pytest.CaptureFixture[str]) -> None:
    code, out = spot(capsys, "city-of-london", "2026-02")
    assert code == 0
    assert "force-month is missing" in out


def test_spot_incomplete_force_month(pipeline: Pipeline, capsys: pytest.CaptureFixture[str]) -> None:
    code, out = spot(capsys, "beta", "2026-03")
    assert code == 0, out
    assert "excluded as incomplete" in out


def test_spot_detects_mismatch(pipeline: Pipeline, capsys: pytest.CaptureFixture[str]) -> None:
    crime = dict(CRIME)
    crime[("2026-01", "alpha")] = {"Burglary": 61, "Vehicle crime": 40}
    pipeline.archive.write_bytes(build_archive(crime))
    code, out = spot(capsys, "alpha", "2026-01")
    assert code == 1
    assert "MISMATCH" in out

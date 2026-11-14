"""Checks on the committed repo itself, not on synthetic fixtures.

The pinned archive in ingest.py and the committed data must describe the same window. A change
that bumps ARCHIVE_MONTH without the local data refresh (e.g. the new-archive routine's draft PR)
fails here, so CI stays red until data/ is regenerated and pushed to the same branch.
"""

import json
from pathlib import Path

import ingest

META = Path(__file__).resolve().parents[2] / "data" / "meta.json"


def test_archive_month_matches_committed_latest_month() -> None:
    # No fixture is used, so ingest.ARCHIVE_MONTH is the real constant, not a patched one.
    latest = json.loads(META.read_text(encoding="utf-8"))["latestMonth"]
    assert ingest.ARCHIVE_MONTH == latest, (
        f"scripts/ingest.py ARCHIVE_MONTH is {ingest.ARCHIVE_MONTH} but data/meta.json latestMonth "
        f"is {latest}: run the local data refresh (ingest.py, npm run geo, validate.py) and commit "
        "data/ and public/geo/"
    )

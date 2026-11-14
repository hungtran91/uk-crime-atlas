# Status: pytest for the Python pipeline (branch `feat/python-tests`)

Unattended run, 2026-11-04. Branch pushed; no PR opened. Nothing merged to main.

## What was done

- **41 pytest tests** in `scripts/tests/`, all passing:
  - `conftest.py`: builds a synthetic setup in a temp folder: a zip laid out like data.police.uk's
    (3 forces × 3 months plus decoys), a 3-row force lookup, a tiny ONS-style population xlsx and a
    3-square TopoJSON. It points the module constants in `ingest.py` / `validate.py` at those files
    with `monkeypatch`, then runs the real `ingest.main()` with the downloads, archive-size check
    and boundary step stubbed out.
  - `test_ingest.py` (20): ASB dropped and other categories counted exactly; BTP and PSNI files in
    the archive never reach the outputs; the 12-month window logic (last N months up to
    `ARCHIVE_MONTH`, fails on gaps or too few months, fails on a bad `Month` value); a missing
    force-month has no rows (never 0) and is in `meta.missing` but not `meta.incomplete`; the 50%
    rule (beta Mar = 40 vs median 100 is flagged, its rows dropped, listed in both `missing` and
    `incomplete`; exactly 50% is kept; categories are summed; each force uses its own median; an
    even number of months uses the midpoint); population uses 2024 only and sums the age columns;
    lookup and population errors exit; output sort order and the exact JSON byte format.
  - `test_validate.py` (21): `validate.main()` passes on the synthetic ingest output and writes
    `reference.json` with the expected figures. Then 15 planted errors, one per case, each of which
    must exit 1, name the error and *not* write `reference.json`: rows for a not-published
    force-month, rows for an incomplete force-month, a 0 instead of a gap, ASB / BTP / PSNI rows, a
    duplicate row, a gap missing from `meta.missing`, an incomplete entry missing from
    `meta.missing`, an entry above the threshold, a wrong `medianCount`, a wrong threshold, a low
    month that should have been flagged, a bad population, non-consecutive months. Plus a
    counter-clockwise TopoJSON ring and 4 `--spot` tests (match, missing, incomplete, mismatch).
- `requirements-dev.txt` (`-r requirements.txt` + `pytest==9.2.0`) and `pytest.ini`
  (`testpaths = scripts/tests`, `pythonpath = scripts`), so a bare `pytest` from the repo root works.
- Docs: pytest commands in CLAUDE.md "Commands" and in the README "Tests" section. I also changed
  one line each in the README "Stack" and "Folder structure" sections and in the CLAUDE.md "Stack"
  and "Folder structure" sections, so they mention pytest and `scripts/tests/`.

Commits on `feat/python-tests` (on top of main `3cf67ee`):
1. Tests: pytest for ingest.py on a synthetic 3-force, 3-month archive
2. Tests: pytest for validate.py, passing run and planted errors
3. Docs: pytest command in CLAUDE.md Commands and README Tests section
4. Docs: STATUS.md for the pytest work (this file)

## Checks run (Linux sandbox, Python 3.13, Node 22)

| Check | Result |
| --- | --- |
| `pytest` | 41 passed |
| `npm test` | 202 passed (unchanged) |
| `npm run lint` | 0 errors |
| `python3 scripts/validate.py` on the committed data | All checks passed |
| `git diff data/` after that | empty |
| `git diff main -- scripts/*.py app components lib data public docs/screenshots` | empty |
| Mutation check: broke ingest.py 5 ways by hand (no ASB filter, incomplete rows kept, incomplete not added to missing, `<` changed to `<=`, missing written as 0) | pytest failed each time; ingest.py restored with `git checkout` |

## What failed or was skipped

- Nothing failed.
- `npm run build` not run (it fails in this sandbox because next/font cannot reach Google Fonts; see
  CLAUDE.md). Nothing the build reads changed, so the Vercel preview build should be unaffected.
- Not covered by tests: `download()`, `check_archive()`, `write_boundaries()` and the mapshaper
  step. They are network or boundary-file steps, outside the brief.
- Python 3.14 (your laptop) not tested here; the sandbox has 3.13.

## Decisions & assumptions

1. **No refactor of ingest.py or validate.py.** Both read their module constants (`ARCHIVE_PATH`,
   `WINDOW`, `DATA`, `N_FORCES`, `errors`, …) when a function runs, not when the module is imported. So the
   tests swap those constants with `monkeypatch` and stub the 3 network/boundary functions. Both
   scripts are byte-for-byte unchanged, so the outputs are byte-identical by construction. I still
   ran `validate.py` and confirmed `git diff data/` is empty.
2. **Tests call the real `ingest.main()`**, not a copy of its output-assembly code, so the meta /
   forces / counts JSON that validate.py checks is exactly what ingest writes.
3. **Branch name `feat/python-tests`** as you asked. The session was set up with a different default
   branch (`claude/cool-johnson-ibczq4`). Your explicit instruction took priority, and nothing was
   pushed to that branch.
4. **"In-memory zip"**: the zip is built in a `BytesIO`, then written to pytest's temp folder,
   because `ingest.ARCHIVE_PATH` and `validate.py --spot` (a glob) expect a real path. It is a few
   KB and never touches `data/raw/`.
5. **BTP / PSNI exclusion is tested through the lookup**: ingest.py excludes them by reading only
   the 43 lookup forces, so the archive includes `btp` and `northern-ireland` files and the tests
   assert they never appear in the outputs.
6. **Synthetic sizes**: 3 forces (one of them `city-of-london`, because `check_topo` requires it),
   window of 3 months. The tests patch `N_FORCES`, `N_MONTHS`, `WINDOW` and `EW_POPULATION_2024` to
   match. `RATE_RANGE` is *not* patched: populations were chosen so national rates are 7.4–8.4 per
   1,000, inside the real 6–10 range.
7. **Test location `scripts/tests/`** keeps the Python next to the scripts; Vitest only includes
   `lib/**/*.test.ts`, so the two runners don't overlap. Config is `pytest.ini`, not
   `pyproject.toml`, to avoid adding a Python project file to a Next.js repo.
8. **pytest version 9.2.0**: the latest release pip resolved here. Exact pin, like `requirements.txt`.
   `requirements-dev.txt` includes `requirements.txt`, so one install command sets up everything.
9. **Not in CI.** There is no GitHub Actions workflow in the repo. Adding one is new work you have
   not approved, so I didn't.
10. **Local `.venv/`** created in the sandbox for running tests. It is already gitignored and was
    not committed. pytest's `.pytest_cache/` ignores itself.
11. CLAUDE.md "Current status" (202 Vitest tests) left as is until you merge.

## Verify locally (Windows, from the repo root)

```
git fetch origin
git checkout feat/python-tests
.venv\Scripts\python -m pip install -r requirements-dev.txt
.venv\Scripts\python -m pytest
.venv\Scripts\python scripts\validate.py
git diff --stat data/
npm test
npm run lint
npm run build
```

Expected: pytest `41 passed`; validate.py `All checks passed`; `git diff --stat data/` prints
nothing; npm test 202 passed; lint and build clean. If `.venv` does not exist yet, first run
`py -3.14 -m venv .venv` (or `py -3.11`).

Optional, to see a test catch a regression: in `scripts\ingest.py`, change `if total <
INCOMPLETE_THRESHOLD * median` to `<=`, run pytest (2 tests fail), then
`git checkout scripts\ingest.py`.

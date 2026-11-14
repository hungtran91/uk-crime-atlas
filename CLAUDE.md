# UK Crime Atlas

## Goal
Portfolio dashboard of police-recorded crime for the 43 territorial forces of
England & Wales: national choropleth + force detail, rates per 1,000 residents.
Public GitHub repo, deployed on Vercel Hobby.

## Current status (updated 2026-11-14)
- SHIPPED. Phases 1–5 in docs/PLAN.md are complete; every acceptance check passed.
  Live: https://uk-crime-atlas.vercel.app/ (Vercel deploys main automatically on push).
  Repo is public (MIT code, OGL v3.0 data). 202 Vitest tests and 42 pytest tests pass.
- Phase 6 (maintenance) is approved and built on branch chore/stage-6-maintenance: CI,
  Dependabot, the consistency test and the rules below. Its acceptance checks in docs/PLAN.md
  are open until the PR is merged and the repo settings are done.
- Data window: Aug 2025 – Jul 2026, from the pinned archive data/raw/2026-07.zip
  (ARCHIVE_MONTH / ARCHIVE_SIZE constants in scripts/ingest.py). Newer archives exist.
- No phase is approved beyond Phase 6. Any new work needs a plan and my approval first.

## Known issues and limits (none block the live site)
- Overview mobile performance is 91 on PageSpeed Insights, so there is little headroom over 90.
  The overview HTML (~730 KB raw) carries all 12 months. If it drops below 90, ship one month
  and load the others on demand. That is a design change, so plan it with me first.
- Force page accessibility is 96: the rank-plot dots are small, overlapping tap targets
  (by design). The force dropdown does the same job.
- A deep link to a non-latest month (?month=…) paints the latest month briefly, then switches,
  because static pages cannot read search params on the server.
- Nav links, the breadcrumb and the highest-rate link have prefetch off (keeps the overview payload
  from loading on every page), so the first click is slightly slower.
- npm audit: 0 production warnings; 5 high dev-only warnings (braces chain under
  eslint-config-next, no fixed version). Never run `npm audit fix --force`; it downgrades
  eslint-config-next and breaks linting.
- Data caveats, all explained on /methodology: Greater Manchester published nothing in the window
  (the data.police.uk changelog gives no reason); Northumbria Jan 2026 is excluded as incomplete;
  Northumbria Feb 2026 (70% of its median) is kept but listed as "low but kept"; rates are not
  adjusted for days in the month.
- Claude in Chrome's window is hidden on the dev machine, so resize and layout checks must use
  headless Chrome. Claude in Chrome is fine for clicking through pages and reading the console.
- Screenshots in docs/screenshots/ are the README's; retake all five if the UI changes visibly.

## Maintenance
- What runs by itself: Dependabot (Mondays: npm, pip, github-actions), CI on every pull request
  (.github/workflows/ci.yml: npm ci, npm test, npm run lint, pytest; no next build), a Vercel
  preview per PR, and one routine (the new-archive check below).
- Reviewing a Dependabot PR, in this order:
  1. CI jobs web and python are green.
  2. Open the PR's Vercel preview and check the overview and one force page (map, charts, both
     themes). CI cannot see visuals.
  3. Merge. Close it instead if next and eslint-config-next end up on different versions, or if
     any version goes down.
- Majors come as single PRs (except the next and react groups). A major of anything in the locked
  stack needs my approval before merging, and auto-fix is never used on a major.
- Re-measure PageSpeed on the overview after any next, react or recharts bump (it is at 91).
- Data refreshes stay local (see "Refresh to a newer archive" under Commands).
- scripts/tests/test_repo_consistency.py fails when ARCHIVE_MONTH in scripts/ingest.py differs from
  latestMonth in data/meta.json, so an archive bump without the data refresh cannot pass CI.

### Routine: new-archive check
Runs monthly in the cloud. Steps:
1. Read ARCHIVE_MONTH in scripts/ingest.py. For each later month up to the current one, send a
   HEAD request to https://policeuk-data.s3.amazonaws.com/archive/YYYY-MM.zip.
2. If none exists, or a claude/data-refresh-<month> branch already exists for the newest one,
   change nothing and end with the report.
3. Otherwise, on branch claude/data-refresh-<newest month>, set ARCHIVE_MONTH and ARCHIVE_SIZE
   (the Content-Length) in scripts/ingest.py, and nothing else. Open a draft PR whose report
   lists the local refresh steps as a checklist. Then stop; never return to that branch.
- Its python check is red on purpose (the consistency test) until I refresh the data locally,
  and the ruleset on main blocks merging it early. Say so in the report.
- Only I push the refreshed data/ and public/geo/ to the claude/data-refresh-<month> branch, and
  only after the routine's run has finished. Never while a cloud session is on that branch.
- Never turn on auto-fix for a claude/data-refresh-* PR; its red python check is expected until I
  refresh data locally.

## Working in a cloud session (Linux, no data/raw)
These rules apply to every cloud session, routine run and auto-fix run:
- Work on a claude/<topic> branch and end by opening one draft PR against main. Auto-fix pushes
  only to the branch of the PR it watches.
- Never push to main, merge, mark a PR ready for review, force-push or delete a branch.
- No new dependencies, no edits under data/ or public/geo/, never `npm audit fix --force`.
- If there is nothing to change, open no PR and end with the report as the final message.
- The PR body (or that final message) is this report, with these headings in this order:

```
## Report
**Trigger:** <routine name | manual cloud session | auto-fix>, <YYYY-MM-DD>
### What changed
### Checks
| Check | Result |
| --- | --- |
| npm test | |
| npm run lint | |
| pytest | |
| python3 scripts/validate.py | |
| npm run build | not run (cloud) |
### Skipped or failed
### Decisions and assumptions
### Verify locally
```

Environment notes:
- `npm ci`, `npm test` and `npm run lint` work. `npm run build` FAILS in the sandbox because
  next/font cannot reach fonts.googleapis.com. That is a network limit, not a bug (Vercel builds
  fine), so don't "fix" it by changing the fonts. Rely on test + lint here and check the Vercel build.
- The sandbox may have a different Node version than engines (24.x). Tests still pass.
- `python3 scripts/validate.py` works without data/raw (it only reads data/ and public/geo/).
  `ingest.py`, `npm run geo` and `validate.py --spot` need data/raw/, which only exists on my
  laptop (the archive is 1.6 GB), so data refreshes are done locally.
- Linux equivalents of the Windows commands below: `.venv/bin/python` instead of
  `.venv\Scripts\python`, and `python3 -m venv .venv` instead of `py -3.14 -m venv .venv`.

## Stack (locked; ask before changing)
- Next.js latest stable, App Router, TypeScript strict, fully static pages
- Map: d3-geo + topojson-client rendering SVG. No Leaflet, no map tiles.
- Charts: Recharts. Tests: Vitest for lib/, pytest for scripts/ (requirements-dev.txt).
- Styling: tokens ported from design/ds/atlas-ds.css; Geist + Geist Mono via next/font
- Data: Python 3 + pandas → static JSON committed in /data
- No API routes, no database, no auth

## Folder structure
design/        Claude Design export. REFERENCE ONLY, never imported by the app
app/           routes: / (overview), /force/[id], /methodology
components/    map, charts, cards, filter bar
lib/           data loading + metrics (rates, deltas, ranks), pure + tested
data/          generated JSON (committed)
data/raw/      downloaded CSV/XLSX (gitignored)
public/geo/    pfa.topo.json (committed)
scripts/       ingest.py, validate.py, force_lookup.csv; tests/ (pytest: synthetic fixtures,
               plus one check that ARCHIVE_MONTH matches the committed data)
docs/PLAN.md   phases + acceptance checks
.github/       ci.yml (checks on PRs), dependabot.yml

## Data sources (Open Government Licence v3.0; attribute in footer + /methodology)
- Crime: data.police.uk monthly street-level CSVs, latest 12 available months
- Population: ONS population estimates for police force areas (xlsx), mid-2024 total
- Boundaries: ONS Police Force Areas, generalised (BGC), converted to TopoJSON

## Data rules
- Exclude "Anti-social behaviour" (not recorded crime)
- Exclude British Transport Police and PSNI (Northern Ireland)
- A force-month with no rows is MISSING, never 0 → rate null → "no data" state
- A force-month whose total is below 50% of that force's median month in the window is
  INCOMPLETE (a partial upload): ingest.py drops its rows and lists it in meta.missing and
  meta.incomplete, so it is treated exactly like missing (no rate, out of national figures,
  ranks and deltas). UI text: "Incomplete data for {month} — excluded" instead of
  "No data published for {month}"; both come from noDataLabel() in lib/format.ts.
- City of London: shown on map/tables; excluded from "highest rate" KPI; clipped in rank plot
- Default month = latest month in data
- Rate = count / population × 1000, computed only in lib/metrics.ts
- Greater Manchester has no street-level data in this window: always "no data";
  /methodology explains why.
- National rates, averages and ranks use only forces reporting that month
  (numerator AND population). Ranks display as "Nth of N reporting".
- Month-over-month deltas are like-for-like: only forces reporting in both months.
- A category absent from a reporting force-month counts as 0.

## Data schema
data/meta.json    { months: "YYYY-MM"[] asc, latestMonth, generatedAt, populationYear,
                    excludedCategories: string[], missing: { [month]: forceId[] },
                    incompleteThreshold: 0.5,
                    incomplete: { [month]: [{ forceId, count, medianCount }] } }
                  missing = no usable data (not published OR incomplete); incomplete ⊆ missing
data/forces.json  [{ id: slug e.g. "west-yorkshire", name, onsCode, population }]
data/counts.json  [{ forceId, month, category, count }]  (long format)
data/reference.json  written by validate.py on success; expected figures for lib/ real-data tests
public/geo/pfa.topo.json  object "pfa"; each feature has properties.id = forceId

## Commands
npm run dev | build | lint | test
py -3.14 -m venv .venv                          # once; fall back to py -3.11 if a dep fails
.venv\Scripts\python -m pip install -r requirements.txt
# first download data/raw/2026-07.zip manually (ingest.py prints the URL if missing)
.venv\Scripts\python scripts\ingest.py          # download ONS files + aggregate → data/, data/raw/pfa.geojson
npm run geo                                     # data/raw/pfa.geojson → public/geo/pfa.topo.json (mapshaper)
.venv\Scripts\python scripts\validate.py        # sanity checks; non-zero exit on failure; writes data/reference.json
.venv\Scripts\python scripts\validate.py --spot kent 2026-06   # compare one force-month with its raw CSV
.venv\Scripts\python -m pip install -r requirements-dev.txt     # once; adds pytest
.venv\Scripts\python -m pytest                  # scripts/tests: ingest.py + validate.py on synthetic fixtures (no network, no data/raw)
Never call bare `python` (two versions installed). Process CSVs file by file.

Refresh to a newer archive (local only): set ARCHIVE_MONTH and ARCHIVE_SIZE in scripts/ingest.py,
download the zip to data/raw/, run ingest.py → npm run geo → validate.py → npm test, check the
"incomplete" list it prints, then commit data/ and public/geo/ together.

## Conventions
- Match design/ screens: layout, tokens, loading/empty/no-data states
- Light + dark via data-theme, dark default
- Server components by default; "use client" only where interactive
- No `any`; comment only non-obvious logic; one commit per completed step
- Next.js 16 differs from older versions — check current docs before using any API you're unsure of.

## Definition of done (every phase)
- All acceptance checks for the phase in docs/PLAN.md pass
- build, lint, test pass with zero errors; no browser console errors
- Report: what changed, how I verify it, anything skipped

## Don'ts
- Don't start the next phase (or any new work) without my approval
- Don't push to main; every change goes through a PR (main deploys straight to the live site,
  and a ruleset on main enforces this once it is set up)
- Don't import design/data/*; don't hardcode numbers from the mock
- Don't add dependencies not listed here without asking
- Don't commit data/raw or any file > 5 MB
- No hex-tile view, no API routes, no database
# UK Crime Atlas

## Goal
Portfolio dashboard of police-recorded crime for the 43 territorial forces of
England & Wales: national choropleth + force detail, rates per 1,000 residents.
Public GitHub repo, deployed on Vercel Hobby.

## Stack (locked; ask before changing)
- Next.js latest stable, App Router, TypeScript strict, fully static pages
- Map: d3-geo + topojson-client rendering SVG. No Leaflet, no map tiles.
- Charts: Recharts. Tests: Vitest for lib/.
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
scripts/       ingest.py, validate.py, force_lookup.csv
docs/PLAN.md   phases + acceptance checks

## Data sources (Open Government Licence v3.0; attribute in footer + /methodology)
- Crime: data.police.uk monthly street-level CSVs, latest 12 available months
- Population: ONS population estimates for police force areas (xlsx), mid-2024 total
- Boundaries: ONS Police Force Areas, generalised (BGC), converted to TopoJSON

## Data rules
- Exclude "Anti-social behaviour" (not recorded crime)
- Exclude British Transport Police and PSNI (Northern Ireland)
- A force-month with no rows is MISSING, never 0 → rate null → "no data" state
- City of London: shown on map/tables; excluded from "highest rate" KPI; clipped in rank plot
- Default month = latest month in data
- Rate = count / population × 1000, computed only in lib/metrics.ts

## Data schema
data/meta.json    { months: "YYYY-MM"[] asc, latestMonth, generatedAt, populationYear,
                    excludedCategories: string[], missing: { [month]: forceId[] } }
data/forces.json  [{ id: slug e.g. "west-yorkshire", name, onsCode, population }]
data/counts.json  [{ forceId, month, category, count }]  (long format)
public/geo/pfa.topo.json  object "pfa"; each feature has properties.id = forceId

## Commands
npm run dev | build | lint | test
py -3.14 -m venv .venv                          # once; fall back to py -3.11 if a dep fails
.venv\Scripts\python -m pip install -r requirements.txt
.venv\Scripts\python scripts\ingest.py          # download + aggregate → data/
.venv\Scripts\python scripts\validate.py        # sanity checks; non-zero exit on failure
Never call bare `python` (two versions installed). Process CSVs file by file.

## Conventions
- Match design/ screens: layout, tokens, loading/empty/no-data states
- Light + dark via data-theme, dark default
- Server components by default; "use client" only where interactive
- No `any`; comment only non-obvious logic; one commit per completed step

## Definition of done (every phase)
- All acceptance checks for the phase in docs/PLAN.md pass
- build, lint, test pass with zero errors; no browser console errors
- Report: what changed, how I verify it, anything skipped

## Don'ts
- Don't start the next phase without my approval
- Don't import design/data/*; don't hardcode numbers from the mock
- Don't add dependencies not listed here without asking
- Don't commit data/raw or any file > 5 MB
- No hex-tile view, no API routes, no database
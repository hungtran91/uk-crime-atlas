# Phase plan

## Phase 1: Scaffold + design system
- Next.js app in repo root; design/ untouched; .gitignore (node_modules, .venv, data/raw, design/.thumbnail)
- Port tokens from design/ds/atlas-ds.css; Geist fonts; light/dark toggle
- App shell: header tabs, 3 routes with placeholders, footer attribution
Acceptance:
- [ ] npm run dev shows the shell; theme toggle matches design in both modes
- [ ] build, lint, test (one trivial test) pass
- [ ] git diff shows no changes inside design/

## Phase 2: Data pipeline
- scripts/force_lookup.csv: data.police.uk name ↔ ONS code ↔ slug (43 rows)
- ingest.py: 12 months of crime CSVs, population xlsx, boundaries → TopoJSON
- validate.py implements the checks below
Acceptance:
- [ ] forces.json: 43 forces, all with population
- [ ] meta.months: 12 consecutive months
- [ ] no ASB, BTP or PSNI anywhere in outputs
- [ ] missing force-months listed in meta (may be empty)
- [ ] national monthly rate per 1,000 is plausible (roughly 6–10)
- [ ] pfa.topo.json: 43 features, ids match forces.json, file < 1 MB
- [ ] I spot-check one force-month count against its raw CSV

## Phase 3: National overview
- d3-geo choropleth + London inset + legend + tooltip; click → force page
- Filter bar (month, go-to-force); 3 KPI cards with sparklines; top categories chart
- lib/metrics.ts with Vitest tests (rate, delta, rank, null handling)
Acceptance:
- [ ] matches "design/UK Crime Atlas.html" overview in both themes
- [ ] changing month updates map, KPIs and chart
- [ ] a missing force renders as grey "no data"

## Phase 4: Force detail + methodology
- Category breakdown with national-average ticks + Chart/Table toggle
- 12-month trend vs England & Wales; rank dot plot (click → switch force)
- /methodology: sources, exclusions, population year, missing-data rule, licence
- Month kept in the URL (?month=YYYY-MM), shared by the overview and force pages;
  invalid or absent → latest month; links between the two carry it
- Force page title wording. Decided: the force name as in the data ("West Yorkshire",
  "Metropolitan Police"), no "Police" suffix
- Incomplete months (added in review): a force-month below 50% of the force's median
  month is excluded like a missing month; ingest.py flags it, validate.py rechecks it,
  /methodology lists it. Flags Northumbria Jan 2026 (2,719 crimes, 25% of its median)
- /methodology also covers the days-in-month effect
Acceptance:
- [x] all 43 force pages build statically
- [x] ?month= survives reload and navigation between overview and force pages
- [x] a force's figures match the overview page for the same month
- [x] tabs, toggle and selects work by keyboard

## Phase 5: Ship
- Public GitHub repo, Vercel Hobby deploy, README (screenshots, sources, refresh steps, stack)
Acceptance:
- [ ] live URL works; Lighthouse performance + accessibility ≥ 90
- [ ] fresh clone → npm install && npm run build succeeds
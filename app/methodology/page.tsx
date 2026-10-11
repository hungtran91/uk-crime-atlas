import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { BIN_LABELS } from "@/components/map/Legend";
import { loadDataset } from "@/lib/data";
import { fmt, monthLabel } from "@/lib/format";
import {
  CITY_OF_LONDON_ID,
  lowMonths,
  monthOverMonth,
  monthOverMonthPerDay,
  national,
  nationalWithout,
  rankForces,
} from "@/lib/metrics";
import { daysInMonth, monthRuns } from "@/lib/month";

export const metadata: Metadata = {
  title: "Methodology · UK Crime Atlas",
};

/** Kept force-months below this share of the force's median month are listed as low. */
const LOW_SHARE = 0.8;

const CHANGELOG_URL = "https://data.police.uk/changelog/";

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section className="card" aria-labelledby={id}>
      <div className="card-h">
        <h2 className="card-t" id={id}>
          {title}
        </h2>
      </div>
      <div className="card-b prose">{children}</div>
    </section>
  );
}

export default function MethodologyPage() {
  const ds = loadDataset();
  const { meta } = ds;
  const { months, latestMonth } = meta;
  const name = (id: string) => ds.forceById.get(id)?.name ?? id;
  const forceLink = (id: string) => <Link href={`/force/${id}`}>{name(id)}</Link>;
  const range = (first: string, last: string) =>
    first === last ? monthLabel(first) : `${monthLabel(first)} – ${monthLabel(last)}`;
  const totalPopulation = ds.forces.reduce((a, f) => a + f.population, 0);

  const incomplete = Object.entries(meta.incomplete).flatMap(([month, entries]) => entries.map((e) => ({ ...e, month })));
  const isIncomplete = (forceId: string, month: string) =>
    incomplete.some((e) => e.forceId === forceId && e.month === month);
  const notPublished = ds.forces
    .map((f) => ({
      id: f.id,
      months: months.filter((m) => meta.missing[m]?.includes(f.id) && !isIncomplete(f.id, m)),
    }))
    .filter((f) => f.months.length > 0)
    .sort((a, b) => b.months.length - a.months.length || (a.id < b.id ? -1 : 1));
  const neverPublished = notPublished.filter((f) => f.months.length === months.length);
  const low = lowMonths(ds, meta.incompleteThreshold, LOW_SHARE);

  const monthly = months.map((m) => ({
    nat: national(ds, m),
    mom: monthOverMonth(ds, m),
    perDay: monthOverMonthPerDay(ds, m),
  }));

  // Worked example: the reporting force whose absence would move the latest national rate most.
  const latest = national(ds, latestMonth);
  const example = latest.reportingIds
    .map((id) => ({ id, without: nationalWithout(ds, latestMonth, id) }))
    .flatMap((e) => (e.without !== null && latest.rate !== null ? [{ ...e, shift: e.without - latest.rate }] : []))
    .sort((a, b) => Math.abs(b.shift) - Math.abs(a.shift))[0];
  const exampleRate = example && rankForces(ds, latestMonth).find((r) => r.forceId === example.id)?.rate;

  const city = rankForces(ds, latestMonth).find((r) => r.forceId === CITY_OF_LONDON_ID);
  const cityPopulation = ds.forceById.get(CITY_OF_LONDON_ID)?.population;

  // A February with a month on each side, to show the calendar effect in this data.
  const febIndex = months.findIndex((m, i) => m.endsWith("-02") && i > 0 && i < months.length - 1);
  const feb = febIndex > 0 ? monthly[febIndex] : null;
  const mar = febIndex > 0 ? monthly[febIndex + 1] : null;

  return (
    <div className="page">
      <div className="page-h">
        <div>
          <h1 className="h1">Methodology</h1>
          <p className="muted page-sub">
            Sources, exclusions and how rates are calculated. Data covers {range(months[0], latestMonth)}; generated{" "}
            {meta.generatedAt.slice(0, 10)}.
          </p>
        </div>
      </div>

      <div className="method">
        <Section id="m-sources" title="1. Sources and licence">
          <ul>
            <li>
              <b>Crime:</b> <a href="https://data.police.uk/data/archive/">data.police.uk</a> monthly street-level
              crime files, one per force per month, for the latest {months.length} months available (
              {range(months[0], latestMonth)}).
            </li>
            <li>
              <b>Population:</b>{" "}
              <a href="https://www.ons.gov.uk/peoplepopulationandcommunity/populationandmigration/populationestimates">
                Office for National Statistics
              </a>{" "}
              population estimates for police force areas, mid-{meta.populationYear}, all ages.
            </li>
            <li>
              <b>Boundaries:</b> <a href="https://geoportal.statistics.gov.uk/">ONS Open Geography</a> Police Force
              Areas (December 2024), generalised, simplified further for display.
            </li>
          </ul>
          <p>
            All three contain public sector information licensed under the{" "}
            <a href="https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/">
              Open Government Licence v3.0
            </a>
            . Street-level files are what each force uploads to data.police.uk. They are not the official police
            recorded crime statistics published by the Home Office and ONS, and totals differ from those.
          </p>
        </Section>

        <Section id="m-rate" title="2. Crimes per 1,000 residents">
          <p className="formula">rate = recorded crimes in the month ÷ resident population × 1,000</p>
          <p>
            Every rate is for one calendar month and uses the mid-{meta.populationYear} resident population of the
            force area. The same population is used for all {months.length} months.
          </p>
          {city && cityPopulation !== undefined && (
            <p>
              {forceLink(CITY_OF_LONDON_ID)} has {fmt.int(cityPopulation)} residents but a far larger daytime
              population of workers and visitors, so its rate ({fmt.dec1(city.rate)} per 1,000 in{" "}
              {monthLabel(latestMonth)}) is not comparable with other forces. It is shown on the map and in tables and
              is ranked, but it is left out of the “highest rate” figure and drawn clipped at the edge of the rank
              plot.
            </p>
          )}
        </Section>

        <Section id="m-exclusions" title="3. Exclusions">
          <ul>
            {meta.excludedCategories.map((c) => (
              <li key={c}>
                <b>{c}:</b> published in the same files but these are incidents, not recorded crimes.
              </li>
            ))}
            <li>
              <b>British Transport Police:</b> not a territorial force and has no resident population.
            </li>
            <li>
              <b>Police Service of Northern Ireland:</b> outside England and Wales.
            </li>
          </ul>
          <p>That leaves the {ds.forces.length} territorial police forces of England and Wales.</p>
        </Section>

        <Section id="m-missing" title="4. Missing data">
          <p>
            A force-month with no file is missing, never zero. It has no rate, is drawn hatched grey on the map and as
            a gap in trend charts, and is left out of national figures and rankings. Force-months not published in
            this window:
          </p>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Force</th>
                  <th scope="col">Not published</th>
                  <th scope="col" className="r">
                    Months
                  </th>
                </tr>
              </thead>
              <tbody>
                {notPublished.map((f) => (
                  <tr key={f.id}>
                    <th scope="row">{forceLink(f.id)}</th>
                    <td>
                      {monthRuns(f.months, months)
                        .map(([a, b]) => range(a, b))
                        .join(", ")}
                    </td>
                    <td className="r">
                      {f.months.length} of {months.length}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {neverPublished.length > 0 && (
            <p>
              {neverPublished.map((f) => name(f.id)).join(", ")} published no street-level crime data in any month of
              this window, so {neverPublished.length === 1 ? "it always shows" : "they always show"} as “no data”.
              The <a href={CHANGELOG_URL}>data.police.uk changelog</a> lists Greater Manchester Police under known
              issues as having no crime data available and records its crime data as not provided for each month; it
              does not give a reason, so none is given here.
            </p>
          )}
        </Section>

        <Section id="m-incomplete" title={`5. Incomplete months and the ${fmt.share(meta.incompleteThreshold)} rule`}>
          <p>
            Some files exist but hold only part of a month. A force-month whose total is below{" "}
            {fmt.share(meta.incompleteThreshold)} of that force’s median month in this window is treated as incomplete
            and handled exactly like a missing month: no rate, hatched grey, and left out of national figures,
            rankings and month-over-month changes. Showing it would present a partial upload as a collapse in crime.
          </p>
          {incomplete.length > 0 ? (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Force</th>
                    <th scope="col">Month</th>
                    <th scope="col" className="r">
                      Crimes published
                    </th>
                    <th scope="col" className="r">
                      Median month
                    </th>
                    <th scope="col" className="r">
                      Share of median
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {incomplete.map((e) => (
                    <tr key={`${e.forceId}|${e.month}`}>
                      <th scope="row">{forceLink(e.forceId)}</th>
                      <td>{monthLabel(e.month)}</td>
                      <td className="r">{fmt.int(e.count)}</td>
                      <td className="r">{fmt.int(e.medianCount)}</td>
                      <td className="r">{fmt.share(e.count / e.medianCount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>No force-month in this window falls below the threshold.</p>
          )}
          <p>
            The threshold is deliberately low so that a real fall is never removed. That means a month can be visibly
            low and still be kept.{" "}
            {low.length > 0
              ? `Kept force-months below ${fmt.share(LOW_SHARE)} of the force’s median, which should be read with care:`
              : `No kept force-month is below ${fmt.share(LOW_SHARE)} of its force’s median.`}
          </p>
          {low.length > 0 && (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Force</th>
                    <th scope="col">Month</th>
                    <th scope="col" className="r">
                      Crimes published
                    </th>
                    <th scope="col" className="r">
                      Median month
                    </th>
                    <th scope="col" className="r">
                      Share of median
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {low.map((l) => (
                    <tr key={`${l.forceId}|${l.month}`}>
                      <th scope="row">{forceLink(l.forceId)}</th>
                      <td>{monthLabel(l.month)}</td>
                      <td className="r">{fmt.int(l.total)}</td>
                      <td className="r">{fmt.int(l.median)}</td>
                      <td className="r">{fmt.share(l.share)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        <Section id="m-reporting" title="6. Reporting forces only">
          <p>
            National rates, averages and ranks use only the forces reporting that month, in both the crime count and
            the population. Dividing by the whole population of England and Wales while some forces are absent would
            understate the rate. Ranks therefore read “Nth of N reporting”, and N changes from month to month.
          </p>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Month</th>
                  <th scope="col" className="r">
                    Forces reporting
                  </th>
                  <th scope="col" className="r">
                    Population covered
                  </th>
                  <th scope="col" className="r">
                    Share of population
                  </th>
                  <th scope="col" className="r">
                    National rate
                  </th>
                </tr>
              </thead>
              <tbody>
                {monthly.map(({ nat }) => (
                  <tr key={nat.month}>
                    <th scope="row">{monthLabel(nat.month)}</th>
                    <td className="r">
                      {nat.reporting} of {ds.forces.length}
                    </td>
                    <td className="r">{fmt.int(nat.population)}</td>
                    <td className="r">{fmt.share(nat.population / totalPopulation, 1)}</td>
                    <td className="r">{nat.rate === null ? "—" : fmt.dec2(nat.rate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {example && latest.rate !== null && exampleRate !== undefined && (
            <p>
              The set of reporting forces affects the national figure by itself. In {monthLabel(latestMonth)} the
              national rate is {fmt.dec2(latest.rate)} across {latest.reporting} forces. Had {name(example.id)} (
              {fmt.dec2(exampleRate)} per 1,000) not reported, it would be {fmt.dec2(example.without as number)}: a
              change of {fmt.change(example.shift)} per 1,000 with no change in crime anywhere.
            </p>
          )}
        </Section>

        <Section id="m-likeforlike" title="7. Like-for-like changes">
          <p>
            Because of that, month-over-month changes compare only the forces reporting in both months, over the same
            combined population. A force that starts or stops reporting cannot move the change. The number of forces
            compared is shown next to the figure. On a force page, the change is that force against its own previous
            month, and is blank when either month has no data.
          </p>
        </Section>

        <Section id="m-days" title="8. Days in the month">
          <p>
            Rates are per calendar month and are not adjusted for month length. A 28-day February with exactly the
            same crimes per day as a 31-day January has a rate {fmt.share(1 - 28 / 31, 1)} lower, and the March after
            it a rate {fmt.share(31 / 28 - 1, 1)} higher. That part of the fall into February and of the rise out of it is the
            calendar, not crime.
            {feb?.mom && feb.perDay !== null && mar?.mom && mar.perDay !== null && feb.mom.pct !== null && mar.mom.pct !== null && (
              <>
                {" "}
                In this data, {monthLabel(feb.nat.month)} is {fmt.pct(feb.mom.pct)} on {monthLabel(feb.mom.prevMonth)}{" "}
                like-for-like, but {fmt.pct(feb.perDay)} per day; {monthLabel(mar.nat.month)} is {fmt.pct(mar.mom.pct)}{" "}
                on {monthLabel(mar.mom.prevMonth)}, but {fmt.pct(mar.perDay)} per day.
              </>
            )}{" "}
            The same applies, less strongly, between 30- and 31-day months.
          </p>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Month</th>
                  <th scope="col" className="r">
                    Days
                  </th>
                  <th scope="col" className="r">
                    Change, like-for-like
                  </th>
                  <th scope="col" className="r">
                    Change per day
                  </th>
                </tr>
              </thead>
              <tbody>
                {monthly.map(({ nat, mom, perDay }) => (
                  <tr key={nat.month}>
                    <th scope="row">{monthLabel(nat.month)}</th>
                    <td className="r">{daysInMonth(nat.month)}</td>
                    <td className="r">{mom && mom.pct !== null ? fmt.pct(mom.pct) : "—"}</td>
                    <td className="r">{perDay !== null ? fmt.pct(perDay) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section id="m-bands" title="9. Fixed colour bands">
          <p>
            The map uses the same {BIN_LABELS.length} bands of crimes per 1,000 residents in every month, so a colour
            means the same thing whichever month is selected. Each band includes its lower bound.
          </p>
          <ul className="bands">
            {BIN_LABELS.map((label, i) => (
              <li key={label}>
                <span className={`sw seq-${i + 1}`} aria-hidden="true" />
                <span className="num">{label}</span>
              </li>
            ))}
            <li>
              <span className="sw nodata-fill" aria-hidden="true" />
              No data
            </li>
          </ul>
        </Section>
      </div>
    </div>
  );
}

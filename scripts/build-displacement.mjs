// Pulls forcibly-displaced population figures by country of origin from the
// UNHCR Refugee Data Finder API into src/data/displacement.generated.json.
// Run by the weekly data-refresh workflow; the committed file is the fallback
// when the API is unreachable, so the site never depends on UNHCR at runtime.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(here, '../src/data/displacement.generated.json');
const BASE = 'https://api.unhcr.org/population/v1/population/';
const UNRWA = 'https://api.unhcr.org/population/v1/unrwa/';
const IDMC = 'https://api.unhcr.org/population/v1/idmc/';
const COLUMNS = ['refugees', 'asylum_seekers', 'idps', 'oip'];
const KNOWN = new Set(JSON.parse(readFileSync(resolve(here, '../src/data/countries.generated.json'), 'utf8')).map((c) => c.cca3));
/**
 * UNHCR codes that are not countries. 'UNK' is UNHCR's "Unknown" origin, not
 * Kosovo (which ATLAS codes UNK and UNHCR counts inside its Serbia row under
 * S/RES/1244); XXA is stateless, TIB Tibetan.
 */
const NOT_COUNTRIES = new Set(['UNK', 'XXA', 'TIB']);
/**
 * Known source gaps: UNHCR's mandate excludes the Palestine refugees UNRWA
 * registers and carries no Gaza IDP figure. For these origins the UNRWA and
 * IDMC series the Refugee Data Finder publishes alongside its own are added
 * as a supplement with their own sources.
 */
const SUPPLEMENTED = ['PSE'];

async function fetchYear(year) {
  const params = new URLSearchParams({ limit: '1000', yearFrom: String(year), yearTo: String(year), coo_all: 'true' });
  for (const c of COLUMNS) params.append('columns[]', c);
  const res = await fetch(`${BASE}?${params}`, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`UNHCR API ${res.status}`);
  const json = await res.json();
  return Array.isArray(json.items) ? json.items : [];
}

function toRows(items) {
  const rows = [];
  for (const it of items) {
    const iso = String(it.coo_iso ?? '');
    if (!/^[A-Z]{3}$/.test(iso) || NOT_COUNTRIES.has(iso) || !KNOWN.has(iso)) continue;
    const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
    const row = { iso, refugees: n(it.refugees), asylumSeekers: n(it.asylum_seekers), idps: n(it.idps), oip: n(it.oip) };
    row.total = row.refugees + row.asylumSeekers + row.idps + row.oip;
    if (row.total > 0) rows.push(row);
  }
  return rows.sort((a, b) => b.total - a.total);
}

async function series(base, year) {
  const params = new URLSearchParams({ limit: '1000', yearFrom: String(year - 2), yearTo: String(year), coo_all: 'true' });
  const res = await fetch(`${base}?${params}`, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`UNHCR API ${base} ${res.status}`);
  const json = await res.json();
  return Array.isArray(json.items) ? json.items : [];
}

/** Newest value for an origin in a UNHCR-published series, no later than `year`. */
function newest(items, iso, year) {
  const hits = items.filter((it) => it.coo_iso === iso && Number(it.year) <= year && Number(it.total) > 0).sort((a, b) => b.year - a.year);
  return hits[0] ? { value: Number(hits[0].total), year: Number(hits[0].year) } : null;
}

async function supplements(rows, year) {
  const [unrwa, idmc] = await Promise.all([series(UNRWA, year), series(IDMC, year)]);
  for (const iso of SUPPLEMENTED) {
    const refugees = newest(unrwa, iso, year);
    const idps = newest(idmc, iso, year);
    if (!refugees && !idps) throw new Error(`no UNRWA or IDMC figure for ${iso}`);
    let row = rows.find((r) => r.iso === iso);
    if (!row) rows.push((row = { iso, refugees: 0, asylumSeekers: 0, idps: 0, oip: 0, total: 0 }));
    row.supplement = {
      unrwaRefugees: refugees?.value ?? 0,
      idps: idps?.value ?? 0,
      year: Math.max(refugees?.year ?? 0, idps?.year ?? 0),
      sources: [
        { name: 'UNRWA registered Palestine refugees (via UNHCR Refugee Data Finder)', url: 'https://www.unrwa.org/palestine-refugees' },
        { name: 'IDMC internal displacement (via UNHCR Refugee Data Finder)', url: 'https://www.internal-displacement.org/countries/palestine/' },
      ],
    };
  }
  return rows.sort((a, b) => b.total - a.total);
}

async function main() {
  const thisYear = new Date().getUTCFullYear();
  let year = thisYear;
  let items = [];
  try {
    for (; year >= thisYear - 2; year--) {
      items = await fetchYear(year);
      if (items.length > 50) break;
    }
  } catch (err) {
    if (existsSync(OUT)) {
      console.warn(`UNHCR fetch failed (${err.message}); keeping the committed file.`);
      return;
    }
    throw err;
  }
  let rows = toRows(items);
  try {
    rows = await supplements(rows, year);
  } catch (err) {
    // Keep the committed supplement rather than silently dropping it.
    const prev = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : null;
    console.warn(`UNRWA/IDMC fetch failed (${err.message}); keeping the committed supplements.`);
    for (const p of prev?.rows ?? []) {
      const row = rows.find((r) => r.iso === p.iso);
      if (p.supplement && row) row.supplement = p.supplement;
    }
  }
  if (rows.length < 50) {
    if (existsSync(OUT)) {
      console.warn(`UNHCR returned only ${rows.length} rows; keeping the committed file.`);
      return;
    }
    throw new Error('UNHCR returned too few rows');
  }
  const prev = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : null;
  const out = {
    source: { name: `UNHCR Refugee Data Finder (${year} figures, by country of origin)`, url: 'https://www.unhcr.org/refugee-statistics/' },
    year,
    fetchedAt: new Date().toISOString().slice(0, 10),
    rows,
  };
  // Avoid churn: if the data is identical, keep the previous fetchedAt so the PR is empty.
  if (prev && JSON.stringify(prev.rows) === JSON.stringify(rows) && prev.year === year) {
    console.log('displacement data unchanged');
    return;
  }
  writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
  console.log(`wrote ${rows.length} rows for ${year} -> ${OUT}`);
}

await main();
